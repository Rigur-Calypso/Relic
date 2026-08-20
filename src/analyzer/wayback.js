import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchViaBrightData } from '../scraper/brightdata.js';
import { extractByAI } from '../scraper/aiExtract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_TS = '20240101';   // aim ~1 year back; Wayback returns the closest available
                                 // (a target may override this via "snapshotTs" in targets.json)

async function loadTargets() {
  return JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Markers that mean Wayback has no capture for this URL (returned as an error page).
const NOT_ARCHIVED = /wayback machine has not archived|this url has been excluded|got an http 30\d|page cannot be displayed|no archived versions|hrm\./i;

/**
 * Find the closest snapshot to SNAPSHOT_TS.
 * Primary: archive.org Availability API (gives the exact captured timestamp).
 * Fallback (when archive.org rate-limits our IP with 429): synthesize the
 * Wayback redirect URL and let Bright Data fetch it — Bright Data's proxies
 * bypass the IP-level rate limit, so RELIC's history keeps flowing.
 */
async function findSnapshot(url, ts, attempt = 0) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${ts}`;
  try {
    // Fail fast: archive.org's availability API is consistently rate-limited (429)
    // from a single IP. One quick attempt for the exact timestamp; on anything else
    // we drop straight to the Bright-Data-proxied redirect (no slow backoff at scale).
    const res = await fetch(api, { headers: { 'User-Agent': 'RELIC/1.0 (hackathon demo)' } });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('json')) {
      const data = await res.json();
      const c = data?.archived_snapshots?.closest;
      if (c && c.available) return { url: c.url, timestamp: c.timestamp, via: 'availability-api' };
    }
    throw new Error(`availability API unusable (HTTP ${res.status})`);
  } catch (e) {
    // Fallback: go through Bright Data on the Wayback redirect endpoint.
    console.log(`[wayback] availability API blocked (${e.message}); falling back to Bright Data redirect`);
    return {
      url: `http://web.archive.org/web/${ts}000000/${url}`,
      timestamp: `~${ts}`,   // approximate: closest capture to this date
      via: 'brightdata-redirect',
    };
  }
}

async function writeNoSnapshot(target) {
  const record = {
    targetId: target.id, snapshotUrl: null, snapshotTimestamp: null,
    fetchedAt: new Date().toISOString(), equipment: [],
    note: 'No historical snapshot available',
  };
  await writeFile(resolve(ROOT, 'data', 'historical', `${target.id}.json`), JSON.stringify(record, null, 2));
  console.log(`[wayback] ${target.id}: no snapshot`);
}

async function processTarget(target) {
  const ts = target.snapshotTs || DEFAULT_TS;   // per-target override (targets.json)
  const snap = await findSnapshot(target.url, ts);

  const md = await fetchViaBrightData(snap.url, { format: 'markdown' });
  if (!md || md.trim().length < 200 || NOT_ARCHIVED.test(md.slice(0, 600))) {
    return writeNoSnapshot(target);
  }

  const equipment = await extractByAI(md);
  if (equipment.length === 0) return writeNoSnapshot(target);

  const record = {
    targetId: target.id,
    snapshotUrl: snap.url,
    snapshotTimestamp: snap.timestamp,
    snapshotVia: snap.via,
    fetchedAt: new Date().toISOString(),
    equipment,
  };
  await writeFile(resolve(ROOT, 'data', 'historical', `${target.id}.json`), JSON.stringify(record, null, 2));
  console.log(`[wayback] ${target.id}: snapshot ${snap.timestamp} (${snap.via}) — ${equipment.length} item(s)`);
}

const only = process.argv[2];
const targets = (await loadTargets()).filter(t => !only || t.id === only);
for (const t of targets) {
  try { await processTarget(t); }
  catch (e) { console.error(`[wayback] ${t.id} ERROR:`, e.message); }
  await sleep(2000);   // be gentle with archive.org between targets
}
