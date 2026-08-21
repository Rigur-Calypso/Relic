// One-off discovery: for a curated batch of NEW facilities, use `bdata search`
// (zero Gemini cost) to find the best real equipment/facility page, then validate
// it by fetching the page and scoring equipment-keyword density. Accepted targets
// are appended to targets.json; rejects are reported so nothing broken gets ingested.
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchViaBrightData } from '../src/scraper/brightdata.js';

const execFileAsync = promisify(execFile);
const BDATA = process.env.BDATA_BIN || 'bdata';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Non-facility hosts / content we never want as a target.
const JUNK = /youtube|quora|wikipedia|researchgate|linkedin|facebook|twitter|x\.com|instagram|scribd|\.pdf($|\?)|amazon|reddit|glassdoor|indeed|coursehero|maps\.google|rdworldonline|cleanroomtechnology|azonano|news|\/video|prnewswire|globenewswire|semiconductor-today/i;
// Path fragments that signal a genuine equipment/facility listing.
const GOOD_PATH = /equipment|instrument|tool|facilit|cleanroom|core-facilit|capabilit|nanofab|our-tools|toolset|micro-?nano/i;
// Equipment vocabulary — the density of these decides if a page really lists tools.
const EQUIP = /\b(sem|tem|s\/tem|stem|xrd|afm|fib|sputter|evaporat|lithograph|e-?beam|etch|deposition|pecvd|lpcvd|\bcvd\b|\bald\b|\bpvd\b|microscop|spectroscop|ellipsomet|profilometer|furnace|diffract|raman|\bicp\b|rie|plasma|wire bond|mask aligner|photoresist|reactive ion|thermal evaporat|nanoscribe|dektak|keyence|bruker|zeiss|jeol|oxford instruments)\b/gi;

const candidates = [
  { id: 'gt-ien',           name: 'Georgia Tech Institute for Electronics and Nanotechnology', q: 'Georgia Tech Institute for Electronics and Nanotechnology cleanroom equipment tools list' },
  { id: 'caltech-kni',      name: 'Caltech Kavli Nanoscience Institute',                        q: 'Caltech Kavli Nanoscience Institute cleanroom fabrication equipment tools' },
  { id: 'minnesota-mnc',    name: 'Minnesota Nano Center',                                      q: 'University of Minnesota Nano Center cleanroom equipment tools list' },
  { id: 'upenn-singh',      name: 'Penn Singh Center for Nanotechnology',                       q: 'University of Pennsylvania Singh Center Nanotechnology equipment tools facility' },
  { id: 'maryland-fablab',  name: 'Maryland NanoCenter FabLab',                                 q: 'University of Maryland NanoCenter FabLab equipment tools cleanroom' },
  { id: 'asu-nanofab',      name: 'ASU NanoFab',                                                q: 'Arizona State University NanoFab cleanroom equipment tools list' },
  { id: 'ufl-nrf',          name: 'Florida Nanoscale Research Facility',                        q: 'University of Florida Nanoscale Research Facility equipment tools cleanroom' },
  { id: 'pitt-nfcf',        name: 'Pitt Nanoscale Fabrication & Characterization Facility',     q: 'University of Pittsburgh Nanoscale Fabrication Characterization Facility equipment tools' },
  { id: 'argonne-cnm',      name: 'Argonne Center for Nanoscale Materials',                     q: 'Argonne Center for Nanoscale Materials instruments capabilities equipment' },
  { id: 'ornl-cnms',        name: 'Oak Ridge Center for Nanophase Materials Sciences',          q: 'Oak Ridge CNMS Center Nanophase Materials Sciences instruments capabilities' },
  { id: 'nist-cnst',        name: 'NIST Center for Nanoscale Science and Technology',           q: 'NIST Center Nanoscale Science Technology NanoFab equipment tools' },
  { id: 'epfl-cmi',         name: 'EPFL Center of MicroNanoTechnology (CMi)',                   q: 'EPFL CMi Center MicroNanoTechnology cleanroom equipment tools' },
  { id: 'delft-kavli',      name: 'TU Delft Kavli Nanolab',                                     q: 'TU Delft Kavli Nanolab cleanroom equipment tools' },
  { id: 'chalmers-mc2',     name: 'Chalmers Myfab MC2 Nanofabrication Laboratory',              q: 'Chalmers Myfab MC2 nanofabrication laboratory equipment tools' },
  { id: 'dtu-nanolab',      name: 'DTU Nanolab',                                                q: 'DTU Nanolab cleanroom equipment tools Denmark national centre' },
  { id: 'glasgow-jwnc',     name: 'Glasgow James Watt Nanofabrication Centre',                  q: 'University of Glasgow James Watt Nanofabrication Centre equipment tools' },
  { id: 'southampton-nano', name: 'Southampton Nanofabrication Centre',                         q: 'University of Southampton Nanofabrication Centre cleanroom equipment tools' },
  { id: 'twente-mesa',      name: 'Twente MESA+ Nanolab',                                       q: 'University of Twente MESA+ Nanolab cleanroom equipment tools' },
  { id: 'tyndall-ireland',  name: 'Tyndall National Institute',                                 q: 'Tyndall National Institute cleanroom nanofabrication equipment tools' },
  { id: 'nus-nanofab',      name: 'NUS Centre for Advanced 2D Materials / nanofab',             q: 'National University of Singapore nanofabrication cleanroom equipment tools facility' },
  { id: 'postech-nano',     name: 'POSTECH Nanofabrication Center',                             q: 'POSTECH nanofabrication center cleanroom equipment tools' },
  { id: 'iitk-4i',          name: 'IIT Kanpur Central Facilities',                              q: 'IIT Kanpur central facility instrumentation SEM XRD equipment list' },
  { id: 'iitr-iic',         name: 'IIT Roorkee Institute Instrumentation Centre',               q: 'IIT Roorkee Institute Instrumentation Centre equipment SEM XRD facilities' },
  { id: 'iitm-crf',         name: 'IIT Madras Central Research Facility / SAIF',                q: 'IIT Madras SAIF sophisticated analytical instrument facility equipment SEM' },
];

const score = (md) => ((md.match(EQUIP) || []).length);

function pickUrl(organic) {
  const clean = (organic || [])
    .map(r => ({ url: (r.url || r.link || '').replace(/[.,)]+$/, ''), title: r.title || '' }))
    .filter(r => /^https?:\/\//.test(r.url) && !JUNK.test(r.url));
  // Prefer institutional/gov/ac domains whose path looks like an equipment listing.
  const inst = clean.filter(r => /\.(edu|ac\.[a-z]{2}|gov)(\/|$)|\.ch\/|\.nl\/|\.se\/|\.dk\/|\.sg\/|\.kr\/|\.ie\//i.test(r.url));
  const ranked = [
    ...inst.filter(r => GOOD_PATH.test(r.url)),
    ...clean.filter(r => GOOD_PATH.test(r.url)),
    ...inst,
    ...clean,
  ];
  return [...new Set(ranked.map(r => r.url))];
}

const accepted = [];
const rejected = [];

for (const c of candidates) {
  process.stdout.write(`\n▶ ${c.id} — ${c.name}\n`);
  let organic = [];
  try {
    const { stdout } = await execFileAsync(BDATA, ['search', c.q, '--json'], { maxBuffer: 1024 * 1024 * 20, timeout: 90000 });
    organic = JSON.parse(stdout).organic || [];
  } catch (e) { rejected.push({ ...c, why: 'search failed: ' + e.message.slice(0, 80) }); console.log('  ✗ search failed'); continue; }

  const urls = pickUrl(organic).slice(0, 4);   // try up to 4 candidates
  let chosen = null;
  for (const url of urls) {
    try {
      const md = await fetchViaBrightData(url, { format: 'markdown' });
      const s = score(md);
      console.log(`  · ${url}  (len ${md.length}, equip-hits ${s})`);
      if (md.length > 600 && s >= 4) { chosen = { url, s, len: md.length }; break; }
    } catch (e) { console.log(`  · ${url}  (fetch failed: ${e.message.slice(0, 50)})`); }
  }

  if (chosen) {
    accepted.push({ id: c.id, name: c.name, url: chosen.url, strategy: 'ai', note: `Discovered via SERP; equip-density ${chosen.s}.` });
    console.log(`  ✓ ACCEPT ${chosen.url}`);
  } else {
    rejected.push({ ...c, why: 'no candidate passed density check' });
    console.log('  ✗ reject (no strong equipment page)');
  }
}

await writeFile(resolve(ROOT, 'scripts', '.discovered.json'), JSON.stringify({ accepted, rejected }, null, 2));
console.log(`\n=== DISCOVERY DONE: ${accepted.length} accepted, ${rejected.length} rejected ===`);
console.log('accepted ids:', accepted.map(a => a.id).join(', '));
console.log('rejected ids:', rejected.map(r => r.id).join(', '));
