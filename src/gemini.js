import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GoogleGenAI } from '@google/genai';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = resolve(ROOT, 'data', '.gemini-state.json');

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/**
 * Collect API keys from the environment. Supports:
 *   GEMINI_API_KEYS = key1,key2,key3   (rotation pool — beats the 20/day/key cap)
 *   GEMINI_API_KEY  = key              (single key, back-compat)
 * Whitespace and blank entries are ignored; duplicates are removed.
 */
function loadKeys() {
  const raw = [
    ...(process.env.GEMINI_API_KEYS || '').split(','),
    process.env.GEMINI_API_KEY || '',
  ];
  const keys = [...new Set(raw.map(k => k.trim()).filter(Boolean))];
  if (keys.length === 0) {
    throw new Error('No Gemini API key found. Set GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY in .env');
  }
  return keys;
}

// A short, non-sensitive fingerprint so the state file never stores full keys.
const fingerprint = (k) => k.slice(0, 4) + '…' + k.slice(-4);

// Google's free tier resets at midnight Pacific — bucket exhaustion by LA day.
const laDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

async function loadState() {
  try { return JSON.parse(await readFile(STATE_FILE, 'utf8')); }
  catch { return {}; }
}

async function saveState(state) {
  try {
    await mkdir(dirname(STATE_FILE), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* state is best-effort; never fail a run over it */ }
}

const errText = (e) => `${e?.status || ''} ${e?.message || ''}`.toLowerCase();

// Daily/again-later quota — remember this key as spent for today.
const isQuotaError = (e) => {
  const s = errText(e);
  return s.includes('429') || s.includes('resource_exhausted') || s.includes('quota') || s.includes('rate limit');
};

// Transient server-side hiccup (model overloaded / 5xx) — retry the SAME key.
const isTransientError = (e) => {
  const s = errText(e);
  return s.includes('503') || s.includes('500') || s.includes('unavailable') ||
         s.includes('overloaded') || s.includes('deadline') || s.includes('internal');
};

// A permanently bad key in the pool (typo, revoked). Skip it, but don't record it
// as "exhausted today" — it's just invalid, not out of quota.
const isBadKeyError = (e) => {
  const s = errText(e);
  return s.includes('api key not valid') || s.includes('api_key_invalid') ||
         s.includes('permission_denied') || s.includes('403') ||
         s.includes('401') || s.includes('unauthenticated') ||
         s.includes('unauthorized') || s.includes('invalid authentication') ||
         (s.includes('400') && s.includes('key'));
};

/**
 * Run a JSON-mode Gemini generation, rotating across the key pool on quota errors.
 * Returns the model's raw text (JSON string) — callers JSON.parse it.
 */
async function geminiGenerate({ contents, responseSchema, temperature = 0, model = MODEL }) {
  const keys = loadKeys();
  const state = await loadState();
  const today = laDay();

  // Quota buckets are per-key AND per-model, so track them independently.
  const sk = (k) => `${model}|${fingerprint(k)}`;

  // Keys not marked exhausted today go first; exhausted ones are kept as a
  // last-resort retry (in case the reset already happened).
  const fresh = [], stale = [];
  for (const k of keys) {
    (state[sk(k)]?.day === today ? stale : fresh).push(k);
  }
  const order = [...fresh, ...stale];

  let lastErr;
  for (const key of order) {
    const ai = new GoogleGenAI({ apiKey: key });
    try {
      // Retry the same key a couple times on transient 5xx/overload before rotating.
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents,
            config: { responseMimeType: 'application/json', responseSchema, temperature },
          });
          return res.text;
        } catch (e) {
          if (isTransientError(e) && attempt < 2) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            console.warn(`[gemini] transient error (${e.status || '5xx'}) — retry ${attempt + 1}/2 on same key`);
            continue;
          }
          throw e;
        }
      }
    } catch (e) {
      lastErr = e;
      if (isQuotaError(e)) {
        state[sk(key)] = { day: today, at: new Date().toISOString() };
        await saveState(state);
        console.warn(`[gemini] key ${fingerprint(key)} exhausted/limited — rotating to next key`);
        continue;
      }
      if (isBadKeyError(e)) {
        console.warn(`[gemini] key ${fingerprint(key)} invalid — skipping it`);
        continue;
      }
      throw e;   // real config error (e.g. bad model name, malformed request) — surface it
    }
  }

  throw new Error(
    `All ${keys.length} Gemini key(s) are quota-exhausted for today (${today} Pacific). ` +
    `Add more keys to GEMINI_API_KEYS in .env, or enable billing. Last error: ${lastErr?.message || lastErr}`
  );
}

/* ===== Grok (xAI) fallback — OpenAI-compatible, no extra dependency ===== */
export const hasGrok = () => !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

// Gemini's schema uses UPPERCASE Type enums; OpenAI/xAI wants standard JSON Schema.
function toJsonSchema(s) {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  if (s.type) out.type = String(s.type).toLowerCase();
  if (s.enum) out.enum = s.enum;
  if (s.items) out.items = toJsonSchema(s.items);
  if (s.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(s.properties)) out.properties[k] = toJsonSchema(v);
  }
  if (s.required) out.required = s.required;
  return out;
}

async function callGrok({ contents, responseSchema, temperature = 0 }) {
  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!key) throw new Error('No xAI key. Set XAI_API_KEY in .env');
  const model = process.env.GROK_MODEL || 'grok-3';
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: 'user', content: contents }],
      response_format: { type: 'json_schema', json_schema: { name: 'relic_result', schema: toJsonSchema(responseSchema) } },
    }),
  });
  if (!res.ok) throw new Error(`Grok HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Grok returned no content');
  return content;
}

/**
 * Provider-aware JSON generation.
 *   LLM_PROVIDER=grok   → use Grok directly.
 *   LLM_PROVIDER=gemini → Gemini only (no fallback).
 *   (unset / "auto")    → Gemini with rotation, auto-falling back to Grok when
 *                         every Gemini key is quota-exhausted (or no Gemini key).
 */
export async function generateJSON(opts) {
  const provider = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  if (provider === 'grok') return callGrok(opts);
  try {
    return await geminiGenerate(opts);
  } catch (e) {
    const msg = e?.message || '';
    const exhausted = /exhausted|quota|429|resource_exhausted|no gemini api key/i.test(msg);
    if (provider !== 'gemini' && hasGrok() && exhausted) {
      console.warn(`[llm] Gemini unavailable — falling back to Grok (${process.env.GROK_MODEL || 'grok-3'})`);
      return callGrok(opts);
    }
    throw e;
  }
}
