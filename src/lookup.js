import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Type } from '@google/genai';
import { fetchViaBrightData } from './scraper/brightdata.js';
import { extractByAI } from './scraper/aiExtract.js';
import { generateJSON } from './gemini.js';

const execFileAsync = promisify(execFile);
const BDATA = process.env.BDATA_BIN || 'bdata';
const SNAP_TS = '20230101';

const JUNK = /youtube|quora|wikipedia|researchgate|linkedin|facebook|twitter|instagram|scribd|\.pdf($|\?)|amazon|reddit|glassdoor|indeed|coursehero|maps\.google/i;
const NOT_ARCHIVED = /wayback machine has not archived|keep the news in the wayback|this url has been excluded|no archived versions|page cannot be displayed/i;

const DIFF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vitalityScore: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    knowledgeLoss: { type: Type.BOOLEAN },
    removed: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      name: { type: Type.STRING }, reason: { type: Type.STRING }, severity: { type: Type.STRING } }, required: ['name', 'severity'] } },
    added: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ['name'] } },
    modified: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      name: { type: Type.STRING }, change: { type: Type.STRING } }, required: ['name', 'change'] } },
  },
  required: ['vitalityScore', 'summary', 'knowledgeLoss', 'removed', 'added', 'modified'],
};

/** Find the best facility/equipment page for a free-text institution name. */
async function findFacilityUrl(name) {
  const query = `${name} facility equipment instruments list of tools`;
  const { stdout } = await execFileAsync(BDATA, ['search', query], { maxBuffer: 1024 * 1024 * 10, timeout: 90000 });
  const urls = stdout.match(/https?:\/\/[^\s|)]+/g) || [];
  for (const u of urls) if (!JUNK.test(u)) return u.replace(/[.,]+$/, '');
  return null;
}

async function fetchHistorical(url) {
  const snapUrl = `http://web.archive.org/web/${SNAP_TS}000000/${url}`;
  try {
    const md = await fetchViaBrightData(snapUrl, { format: 'markdown' });
    if (!md || md.trim().length < 200 || NOT_ARCHIVED.test(md.slice(0, 600))) return { equipment: [], snapshotUrl: null };
    const equipment = await extractByAI(md);
    return { equipment, snapshotUrl: snapUrl, snapshotTimestamp: `~${SNAP_TS}` };
  } catch { return { equipment: [], snapshotUrl: null }; }
}

async function semanticDiff(current, historical, label) {
  if (!historical.length) {
    return { vitalityScore: null, summary: 'No historical snapshot available to compare against.', knowledgeLoss: false, removed: [], added: [], modified: [] };
  }
  const prompt = [
    'Compare a lab facility page ACROSS TIME. HISTORICAL (Wayback) vs CURRENT (today).',
    'Identify knowledge lost or changed; match items by meaning, not exact string.',
    'Removed = present historically, absent now (knowledge loss). severity "critical" for a whole instrument,',
    '"moderate"/"minor" otherwise. vitalityScore 0-100 (100 = all preserved). knowledgeLoss=true if anything meaningful removed.',
    '', `HISTORICAL (${label}):`, JSON.stringify(historical, null, 2), '', 'CURRENT:', JSON.stringify(current, null, 2),
  ].join('\n');
  const text = await generateJSON({ contents: prompt, responseSchema: DIFF_SCHEMA });
  return JSON.parse(text);
}

/**
 * Full on-demand pipeline for a free-text institution name.
 * search → scrape (Bright Data) → extract (Gemini) → Wayback → diff (Gemini).
 * Returns a lab-shaped object the dashboard can render directly.
 */
export async function lookup(name) {
  const url = await findFacilityUrl(name);
  if (!url) throw new Error(`No facility page found for “${name}”.`);

  const md = await fetchViaBrightData(url, { format: 'markdown' });
  const current = await extractByAI(md);
  const historical = await fetchHistorical(url);
  const analysis = await semanticDiff(current, historical.equipment, historical.snapshotTimestamp || 'unknown');

  return {
    id: 'lookup:' + url,
    name,
    url,
    trackingCount: current.length,
    healthy: current.length > 0,
    method: 'lookup',
    scrapedAt: new Date().toISOString(),
    vitalityScore: analysis.vitalityScore,
    knowledgeLoss: analysis.knowledgeLoss,
    summary: analysis.summary,
    removed: analysis.removed || [],
    added: analysis.added || [],
    modified: analysis.modified || [],
    historicalCount: historical.equipment.length,
    adhoc: true,
  };
}
