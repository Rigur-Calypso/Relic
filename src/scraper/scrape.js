import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchViaBrightData } from './brightdata.js';
import { extractBySelector } from './extract.js';
import { extractByAI } from './aiExtract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function loadTargets() {
  const raw = await readFile(resolve(ROOT, 'targets.json'), 'utf8');
  return JSON.parse(raw);
}

async function scrapeTarget(target) {
  let equipment = [];
  let method = target.strategy === 'selector' ? 'selector' : 'ai-heal';

  if (target.strategy === 'selector') {
    const html = await fetchViaBrightData(target.url, { format: 'html' });
    equipment = extractBySelector(html);         // brittle path
  } else {
    const md = await fetchViaBrightData(target.url, { format: 'markdown' });
    equipment = await extractByAI(md);           // resilient path
  }

  const record = {
    targetId: target.id,
    name: target.name,
    url: target.url,
    scrapedAt: new Date().toISOString(),
    method,
    healthy: equipment.length > 0,
    equipment,
  };

  await writeFile(
    resolve(ROOT, 'data', 'current', `${target.id}.json`),
    JSON.stringify(record, null, 2),
  );

  const flag = record.healthy ? 'HEALTHY' : 'FAILED (0 equipment)';
  console.log(`[scrape] ${target.id}: ${flag} — ${equipment.length} item(s)`);
  return record;
}

const only = process.argv[2];                     // optional target id
const targets = (await loadTargets()).filter(t => !only || t.id === only);
if (targets.length === 0) { console.error(`No target matching "${only}"`); process.exit(1); }
for (const t of targets) {
  try { await scrapeTarget(t); }
  catch (e) { console.error(`[scrape] ${t.id} ERROR:`, e.message); }
}
