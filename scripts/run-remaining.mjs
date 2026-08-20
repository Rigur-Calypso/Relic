// Resumable pipeline runner: for every target missing its analysis output, run
// scrape → wayback → diff (reusing the existing scripts, so Gemini key-rotation
// applies). Safe to run repeatedly — already-processed targets are skipped, so it
// resumes cleanly after a quota ceiling or interruption.
import { spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exists = (p) => access(p).then(() => true).catch(() => false);

function run(rel, id) {
  return new Promise((res) => {
    const child = spawn('node', [resolve(ROOT, rel), id], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (out += d));
    child.on('close', () => res(out.trim()));
  });
}

const targets = JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'));
let done = 0, processed = 0;
for (const t of targets) {
  if (t.id === 'decoy') { continue; }                         // seeded locally
  const analysisPath = resolve(ROOT, 'data', 'analysis', `${t.id}.json`);
  const currentPath = resolve(ROOT, 'data', 'current', `${t.id}.json`);
  if (await exists(analysisPath) && await exists(currentPath)) { done++; continue; }

  processed++;
  console.log(`\n=== [${processed}] ${t.id} — ${t.name} ===`);
  const s = await run('src/scraper/scrape.js', t.id);   console.log(s.split('\n').filter(l => l.includes('[scrape]') || l.includes('rotating')).join('\n'));
  const w = await run('src/analyzer/wayback.js', t.id);  console.log(w.split('\n').filter(l => l.includes('[wayback]') && !l.includes('availability API blocked')).join('\n'));
  const d = await run('src/analyzer/diff.js', t.id);     console.log(d.split('\n').filter(l => l.includes('[diff]')).join('\n'));
}
console.log(`\nDONE. already-done=${done}, processed-this-run=${processed}`);
