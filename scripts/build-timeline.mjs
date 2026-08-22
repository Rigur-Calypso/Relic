// Knowledge-decay timeline: pull SEVERAL Wayback snapshots per facility and
// measure how much of each era's documented inventory still survives today.
//
// Cost control: one Gemini call per snapshot (extraction only). Retention is
// computed locally by fuzzy name matching — no LLM. Resumable: a target that
// already has data/timeline/<id>.json is skipped unless --force.
//
//   node scripts/build-timeline.mjs [--limit N] [--force] [id ...]
import 'dotenv/config';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchViaBrightData } from '../src/scraper/brightdata.js';
import { extractByAI } from '../src/scraper/aiExtract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data', 'timeline');
const YEARS = ['2019', '2021', '2023', '2025'];
const NOT_ARCHIVED = /wayback machine has not archived|this url has been excluded|got an http 30\d|page cannot be displayed|no archived versions|hrm\./i;

const exists = (p) => access(p).then(() => true).catch(() => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Normalize an instrument name so "FEI Tecnai G2 F20 S-TWIN TEM" and
// "Tecnai F20 TEM" can be recognized as the same instrument.
const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));

function sameInstrument(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  let hit = 0; for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size) >= 0.6;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const onlyIds = args.filter((a) => !a.startsWith('--') && a !== String(limit));

const targets = JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'));
const rd = (...s) => readFile(resolve(ROOT, 'data', ...s), 'utf8').then(JSON.parse).catch(() => null);

// Default population: facilities with a real knowledge-loss finding — the ones
// whose decay curve is worth showing — worst first.
let pool = onlyIds.length ? targets.filter((t) => onlyIds.includes(t.id)) : [];
if (!pool.length) {
  const scored = [];
  for (const t of targets) {
    if (t.id === 'decoy') continue;
    const a = await rd('analysis', `${t.id}.json`);
    if (a?.knowledgeLoss && a.vitalityScore != null) scored.push({ t, v: a.vitalityScore });
  }
  pool = scored.sort((x, y) => x.v - y.v).map((s) => s.t);
}

await mkdir(OUT, { recursive: true });
let done = 0, skipped = 0, calls = 0;

for (const t of pool) {
  if (done >= limit) break;
  const outPath = resolve(OUT, `${t.id}.json`);
  if (!force && await exists(outPath)) { skipped++; continue; }

  const cur = await rd('current', `${t.id}.json`);
  const today = (cur?.equipment || []).map((e) => e.name).filter(Boolean);
  if (!today.length) { console.log(`[timeline] ${t.id}: no current inventory — skip`); continue; }

  console.log(`\n=== ${t.id} — ${t.name} ===`);
  const points = [];

  for (const yr of YEARS) {
    const snapUrl = `http://web.archive.org/web/${yr}0601000000/${t.url}`;
    try {
      const md = await fetchViaBrightData(snapUrl, { format: 'markdown' });
      if (!md || md.trim().length < 200 || NOT_ARCHIVED.test(md.slice(0, 600))) {
        console.log(`  ${yr}: no usable snapshot`); continue;
      }
      const equip = await extractByAI(md); calls++;
      if (!equip.length) { console.log(`  ${yr}: snapshot had no extractable equipment`); continue; }

      const names = equip.map((e) => e.name).filter(Boolean);
      const retained = names.filter((n) => today.some((c) => sameInstrument(n, c))).length;
      const pct = names.length ? Math.round((retained / names.length) * 100) : null;
      points.push({ year: yr, documented: names.length, retained, retentionPct: pct, snapshotUrl: snapUrl });
      console.log(`  ${yr}: ${names.length} documented · ${retained} still present (${pct}% retained)`);
    } catch (e) {
      console.log(`  ${yr}: fetch failed (${e.message.slice(0, 50)})`);
    }
    await sleep(1200);
  }

  if (points.length < 2) { console.log(`  → only ${points.length} usable point(s); not enough for a curve`); continue; }

  points.push({ year: 'now', documented: today.length, retained: today.length, retentionPct: 100, snapshotUrl: t.url });
  await writeFile(outPath, JSON.stringify({ targetId: t.id, builtAt: new Date().toISOString(), points }, null, 2));
  done++;
  console.log(`  → saved ${points.length} points`);
}

console.log(`\n[timeline] built ${done}, skipped ${skipped} (already had data), ${calls} Gemini calls used`);
