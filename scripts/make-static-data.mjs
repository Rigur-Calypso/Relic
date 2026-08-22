// Bakes the pipeline's JSON output into the frontend's public/ folder so the
// dashboard works as a pure static site (no Express backend) when deployed.
// Run automatically by the Vercel build, and locally via `npm run static-data`.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src', 'frontend', 'public', 'data');

await mkdir(OUT, { recursive: true });

// targets.json → public/data/targets.json
const targets = JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'));
await writeFile(resolve(OUT, 'targets.json'), JSON.stringify(targets, null, 2));

// all analyses → public/data/analysis.json (array, same shape as GET /api/analysis)
// Skip any file that fails to parse (e.g. one being written mid-pipeline) so the
// build can never break on a partially-written snapshot.
const dir = resolve(ROOT, 'data', 'analysis');
const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
const analyses = [];
let skipped = 0;
for (const f of files) {
  try { analyses.push(JSON.parse(await readFile(resolve(dir, f), 'utf8'))); }
  catch { skipped++; }
}
await writeFile(resolve(OUT, 'analysis.json'), JSON.stringify(analyses, null, 2));

// merged per-lab feed → public/data/labs.json (same shape as GET /api/labs)
const readJ = (...s) => readFile(resolve(ROOT, 'data', ...s), 'utf8').then(JSON.parse).catch(() => null);
const labs = [];
for (const t of targets) {
  const [a, c] = await Promise.all([readJ('analysis', `${t.id}.json`), readJ('current', `${t.id}.json`)]);
  labs.push({
    id: t.id, name: t.name, url: t.url,
    trackingCount: c?.equipment?.length ?? 0,
    healthy: c?.healthy ?? null, method: c?.method ?? null, scrapedAt: c?.scrapedAt ?? null,
    vitalityScore: a?.vitalityScore ?? null, knowledgeLoss: a?.knowledgeLoss ?? false,
    summary: a?.summary ?? null, removed: a?.removed ?? [], added: a?.added ?? [], modified: a?.modified ?? [],
  });
}
await writeFile(resolve(OUT, 'labs.json'), JSON.stringify(labs, null, 2));

// instrument atlas → public/data/atlas.json (same shape as GET /api/atlas)
try {
  const atlas = await readFile(resolve(ROOT, 'data', 'atlas.json'), 'utf8');
  await writeFile(resolve(OUT, 'atlas.json'), atlas);
} catch { console.warn('[static-data] no data/atlas.json — run `npm run atlas` first'); }

// full per-lab detail → public/data/labs/<id>.json (same shape as GET /api/lab/:id)
const LAB_OUT = resolve(OUT, 'labs');
await mkdir(LAB_OUT, { recursive: true });
for (const t of targets) {
  const [current, historical, analysis, timeline] = await Promise.all([
    readJ('current', `${t.id}.json`), readJ('historical', `${t.id}.json`),
    readJ('analysis', `${t.id}.json`), readJ('timeline', `${t.id}.json`),
  ]);
  await writeFile(resolve(LAB_OUT, `${t.id}.json`), JSON.stringify({ target: t, current, historical, analysis, timeline }, null, 2));
}

console.log(`[static-data] wrote ${targets.length} targets + ${analyses.length} analyses + ${labs.length} labs` +
  ` + ${targets.length} detail files` +
  (skipped ? ` (${skipped} unparseable file(s) skipped)` : '') + ' to src/frontend/public/data/');
