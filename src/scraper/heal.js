import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchViaBrightData } from './brightdata.js';
import { extractByAI } from './aiExtract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function loadTargets() {
  return JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'));
}

const id = process.argv[2];
if (!id) { console.error('Usage: npm run heal -- <targetId>'); process.exit(1); }

const target = (await loadTargets()).find(t => t.id === id);
if (!target) { console.error(`No target "${id}"`); process.exit(1); }

console.log(`[heal] Re-extracting ${id} via Bright Data content + Gemini (layout-agnostic)...`);
const md = await fetchViaBrightData(target.url, { format: 'markdown' });
const equipment = await extractByAI(md);

const record = {
  targetId: target.id,
  name: target.name,
  url: target.url,
  scrapedAt: new Date().toISOString(),
  method: 'ai-heal',
  healthy: equipment.length > 0,
  equipment,
};

await writeFile(
  resolve(ROOT, 'data', 'current', `${target.id}.json`),
  JSON.stringify(record, null, 2),
);

console.log(`[heal] ${id}: ${record.healthy ? 'HEALED' : 'STILL FAILING'} — ${equipment.length} item(s) recovered.`);
