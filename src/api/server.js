import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = express();
app.use(cors());
app.use(express.json());

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const dataFile = (...seg) => resolve(ROOT, 'data', ...seg);

app.get('/api/targets', async (_req, res) => {
  try { res.json(await readJson(resolve(ROOT, 'targets.json'))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/current/:id', async (req, res) => {
  try { res.json(await readJson(dataFile('current', `${req.params.id}.json`))); }
  catch { res.status(404).json({ error: 'not scraped yet' }); }
});

app.get('/api/analysis', async (_req, res) => {
  try {
    const files = (await readdir(dataFile('analysis'))).filter(f => f.endsWith('.json'));
    const all = await Promise.all(files.map(f => readJson(dataFile('analysis', f))));
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analysis/:id', async (req, res) => {
  try { res.json(await readJson(dataFile('analysis', `${req.params.id}.json`))); }
  catch { res.status(404).json({ error: 'not analyzed yet' }); }
});

// One merged call per lab: target + its analysis + live instrument count.
export async function buildLabs(root) {
  const targets = JSON.parse(await readFile(resolve(root, 'targets.json'), 'utf8'));
  const readJ = (...s) => readFile(resolve(root, 'data', ...s), 'utf8').then(JSON.parse).catch(() => null);
  return Promise.all(targets.map(async (t) => {
    const [a, c] = await Promise.all([readJ('analysis', `${t.id}.json`), readJ('current', `${t.id}.json`)]);
    return {
      id: t.id, name: t.name, url: t.url,
      trackingCount: c?.equipment?.length ?? 0,
      healthy: c?.healthy ?? null,
      method: c?.method ?? null,
      scrapedAt: c?.scrapedAt ?? null,
      vitalityScore: a?.vitalityScore ?? null,
      knowledgeLoss: a?.knowledgeLoss ?? false,
      summary: a?.summary ?? null,
      removed: a?.removed ?? [], added: a?.added ?? [], modified: a?.modified ?? [],
    };
  }));
}

app.get('/api/labs', async (_req, res) => {
  try { res.json(await buildLabs(ROOT)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// On-demand: name any institution → Bright Data search+scrape → Wayback → Gemini diff.
app.post('/api/lookup', async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Provide an institution name.' });
  try {
    const { lookup } = await import('../lookup.js');
    res.json(await lookup(name));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Trigger scripts from the UI. Runs `node <script> <id>` and streams exit status back.
function runScript(relPath, id) {
  return new Promise((res) => {
    const child = spawn('node', [resolve(ROOT, relPath), id], { cwd: ROOT });
    let log = '';
    child.stdout.on('data', d => (log += d));
    child.stderr.on('data', d => (log += d));
    child.on('close', code => res({ code, log }));
  });
}

app.post('/api/scrape/:id',  async (req, res) => res.json(await runScript('src/scraper/scrape.js',   req.params.id)));
app.post('/api/heal/:id',    async (req, res) => res.json(await runScript('src/scraper/heal.js',     req.params.id)));
app.post('/api/analyze/:id', async (req, res) => res.json(await runScript('src/analyzer/diff.js',    req.params.id)));

app.listen(3001, () => console.log('RELIC API on http://localhost:3001'));
