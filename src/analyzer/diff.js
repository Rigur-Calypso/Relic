import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Type } from '@google/genai';
import { generateJSON } from '../gemini.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DIFF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vitalityScore: { type: Type.NUMBER },   // 0-100, higher = more knowledge preserved
    summary: { type: Type.STRING },
    knowledgeLoss: { type: Type.BOOLEAN },
    removed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          reason: { type: Type.STRING },
          severity: { type: Type.STRING },   // "critical" | "moderate" | "minor"
        },
        required: ['name', 'severity'],
      },
    },
    added: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ['name'] },
    },
    modified: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, change: { type: Type.STRING } },
        required: ['name', 'change'],
      },
    },
  },
  required: ['vitalityScore', 'summary', 'knowledgeLoss', 'removed', 'added', 'modified'],
};

async function analyze(id) {
  const current = JSON.parse(await readFile(resolve(ROOT, 'data', 'current', `${id}.json`), 'utf8'));
  const historical = JSON.parse(await readFile(resolve(ROOT, 'data', 'historical', `${id}.json`), 'utf8'));

  if (!historical.equipment || historical.equipment.length === 0) {
    const record = {
      targetId: id, analyzedAt: new Date().toISOString(),
      vitalityScore: null, summary: 'No historical snapshot to compare against.',
      knowledgeLoss: false, removed: [], added: [], modified: [],
    };
    await writeFile(resolve(ROOT, 'data', 'analysis', `${id}.json`), JSON.stringify(record, null, 2));
    console.log(`[diff] ${id}: no history`);
    return;
  }

  const prompt = [
    'Compare a lab facility page ACROSS TIME. You are given the HISTORICAL equipment list',
    '(from a Wayback snapshot) and the CURRENT equipment list (scraped today).',
    'Identify what knowledge was lost or changed. Match items by meaning, not exact string.',
    'Removed = present historically, absent now (this is knowledge loss). Set severity',
    '"critical" for a whole instrument disappearing, "moderate"/"minor" for lesser changes.',
    'vitalityScore = 0-100 where 100 means all historical knowledge is preserved and 0 means',
    'severe loss. Set knowledgeLoss=true if anything meaningful was removed.',
    '',
    `HISTORICAL (${historical.snapshotTimestamp || 'unknown date'}):`,
    JSON.stringify(historical.equipment, null, 2),
    '',
    'CURRENT:',
    JSON.stringify(current.equipment, null, 2),
  ].join('\n');

  const text = await generateJSON({ contents: prompt, responseSchema: DIFF_SCHEMA });

  const analysis = JSON.parse(text);
  const record = { targetId: id, analyzedAt: new Date().toISOString(), ...analysis };
  await writeFile(resolve(ROOT, 'data', 'analysis', `${id}.json`), JSON.stringify(record, null, 2));
  console.log(`[diff] ${id}: vitality ${analysis.vitalityScore}, removed ${analysis.removed.length}`);
}

const only = process.argv[2];
const targets = only
  ? [only]
  : JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8')).map(t => t.id);
for (const id of targets) {
  try { await analyze(id); }
  catch (e) { console.error(`[diff] ${id} ERROR:`, e.message); }
}
