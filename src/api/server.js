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
