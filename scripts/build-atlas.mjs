// Pivot the corpus by INSTRUMENT rather than by facility.
// Pure aggregation over data/ — no network, no LLM. Writes data/atlas.json,
// which make-static-data.mjs bakes into the frontend feed.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Instrument taxonomy. Order matters — first match wins, so the more specific
// patterns (STEM before SEM) come first.
const CLASSES = [
  ['tem',      'TEM / STEM',      /\b(s\/tem|stem|tem)\b|transmission electron/i],
  ['sem',      'SEM',             /\bsem\b|scanning electron|fegsem|esem/i],
  ['afm',      'AFM / SPM',       /\bafm\b|\bspm\b|atomic force|scanning probe/i],
  ['xrd',      'XRD',             /\bxrd\b|diffractomet|x-ray diffract/i],
  ['litho',    'Lithography',     /lithograph|mask aligner|stepper|photoresist|\bmla\b|nanoscribe/i],
  ['etch',     'Etching',         /\betch|\brie\b|\bicp\b|plasma clean/i],
  ['dep',      'Deposition',      /sputter|evaporat|\bpecvd\b|\blpcvd\b|\bcvd\b|\bald\b|\bpvd\b|deposition/i],
  ['spec',     'Spectroscopy',    /spectromet|spectroscop|\bxps\b|\bftir\b|\bnmr\b|mass spec|maldi|\bicp-?ms\b/i],
  ['raman',    'Raman',           /raman/i],
  ['profil',   'Profilometry',    /profilomet|ellipsomet|dektak|surface profil/i],
  ['thermal',  'Thermal',         /furnace|anneal|\brtp\b|\btga\b|\bdsc\b|calorimet/i],
  ['optical',  'Optical imaging', /optical microscop|confocal|fluorescence microscop/i],
  ['mech',     'Mechanical test', /tensile|hardness|nanoindent|rheomet|mechanical test/i],
];

const classify = (name = '') => (CLASSES.find(([, , re]) => re.test(name)) || [null])[0];

const REGION = [
  [/\.edu$|\.gov$|\.us$/i, 'North America'],
  [/\.ca$/i, 'North America'],
  [/\.ac\.in$|\.res\.in$|\.iisc|\.iitb|\.edu\.in$|\.in$/i, 'India'],
  [/\.ac\.uk$|\.uk$|\.de$|\.fr$|\.nl$|\.se$|\.fi$|\.dk$|\.be$|\.ch$|\.ie$|\.it$|\.es$|\.at$|\.no$|\.pt$|\.eu$/i, 'Europe'],
  [/\.ac\.jp$|\.jp$|\.ac\.kr$|\.kr$|\.edu\.sg$|\.sg$|\.hk$|\.tw$|\.cn$|\.edu\.au$|\.au$|\.nz$/i, 'Asia-Pacific'],
  [/\.il$|\.sa$|\.ae$|\.tr$/i, 'Middle East'],
  [/\.br$|\.mx$|\.ar$|\.cl$/i, 'Latin America'],
];
const regionOf = (url) => {
  let host = ''; try { host = new URL(url).host; } catch { return 'Other'; }
  return (REGION.find(([re]) => re.test(host)) || [null, 'Other'])[1];
};

const yearOf = (ts) => { const s = String(ts ?? '').replace(/\D/g, ''); return s.length >= 4 ? s.slice(0, 4) : null; };

const targets = JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'))
  .filter((t) => t.id !== 'decoy');                    // demo prop, not a real facility
const nameOf = Object.fromEntries(targets.map((t) => [t.id, t.name]));
const urlOf = Object.fromEntries(targets.map((t) => [t.id, t.url]));

const rd = (...s) => readFile(resolve(ROOT, 'data', ...s), 'utf8').then(JSON.parse).catch(() => null);

const cls = Object.fromEntries(CLASSES.map(([k, label]) => [k, { key: k, label, present: 0, removed: 0, facilities: new Set(), where: [] }]));
const regions = {};
let totalInstruments = 0, totalRemoved = 0, facilitiesLosing = 0;

for (const t of targets) {
  const [cur, hist, an] = await Promise.all([rd('current', `${t.id}.json`), rd('historical', `${t.id}.json`), rd('analysis', `${t.id}.json`)]);
  const region = regionOf(t.url);
  regions[region] ??= { name: region, facilities: 0, losing: 0, removed: 0 };
  regions[region].facilities++;

  for (const e of (cur?.equipment || [])) {
    totalInstruments++;
    const k = classify(e.name);
    if (k) cls[k].present++;
  }

  const removed = an?.removed || [];
  if (an?.knowledgeLoss && removed.length) { facilitiesLosing++; regions[region].losing++; }

  for (const r of removed) {
    totalRemoved++;
    regions[region].removed++;
    const k = classify(r.name);
    if (!k) continue;
    cls[k].removed++;
    cls[k].facilities.add(t.id);
    cls[k].where.push({
      id: t.id, name: nameOf[t.id], instrument: r.name,
      severity: r.severity || 'moderate', region,
      lastSeen: yearOf(hist?.snapshotTimestamp),
    });
  }
}

const classes = Object.values(cls)
  .map((c) => ({ ...c, facilities: c.facilities.size, where: c.where.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '')) }))
  .filter((c) => c.present > 0 || c.removed > 0)
  .sort((a, b) => b.removed - a.removed || b.present - a.present);

const regionList = Object.values(regions)
  .map((r) => ({ ...r, rate: r.facilities ? Math.round((r.losing / r.facilities) * 100) : 0 }))
  .sort((a, b) => b.rate - a.rate || b.facilities - a.facilities);

const atlas = {
  generatedAt: new Date().toISOString(),
  totals: { facilities: targets.length, instruments: totalInstruments, removed: totalRemoved, facilitiesLosing },
  classes, regions: regionList,
};

await writeFile(resolve(ROOT, 'data', 'atlas.json'), JSON.stringify(atlas, null, 2));
console.log(`[atlas] ${classes.length} instrument classes · ${totalRemoved} removals · ${totalInstruments} instruments · ${regionList.length} regions`);
console.log('[atlas] top losses: ' + classes.slice(0, 5).map((c) => `${c.label} ${c.removed}`).join(', '));
