# RELIC — Product Requirements Document & Autonomous Build Spec
### "The Self-Healing Web Memory" · Bright Data 'Scrape-Verse' Hackathon

> **Audience:** This document is written for an autonomous coding agent (Claude Code). Build the project exactly as specified. Every command, file path, package name, and code block in this document has been verified against the current tooling (Bright Data CLI `@brightdata/cli`, Google Gen AI SDK `@google/genai`, Wayback Availability API). Do not substitute deprecated packages or invent CLI subcommands. Where a full file is given, write it verbatim. Where a file is described, implement it to the stated contract with no `TODO` stubs in any critical path.

---

## Section 0 — Ground Truth & Non-Negotiables (read first)

These three facts override any conflicting instruction elsewhere. They are the difference between a demo that works on camera and one that fails in front of Bright Data judges.

**0.1 — The Bright Data CLI has no `scraper run` or `scraper heal` command.**
The real, shipped CLI (`@brightdata/cli`, binaries `brightdata` / `bdata`, Node ≥ 20) exposes exactly these top-level commands: `login`, `logout`, `scrape`, `search`, `pipelines`, `status`, `zones`, `budget`, `config`, `init`, `skill`. There is **no** `scraper` subcommand and **no** `heal` command. Scraping is done with `bdata scrape <url> [-f markdown|html|json|screenshot]`. Any script or demo that types `bdata scraper heal ...` will error out live. **Do not generate that command anywhere.**

**0.2 — "Self-healing" is a RELIC feature, powered by Bright Data — not a Bright Data command.**
RELIC's heal is a two-layer extraction strategy (defined in §3 and §5). Layer 1 is a brittle CSS-selector extractor that breaks when a page's DOM changes. Layer 2 re-extracts the same Bright-Data-fetched content with Gemini, which is layout-agnostic, and "heals" the target. The healing command is RELIC's own: `npm run heal -- <targetId>`. This is honest, it still produces the exact on-screen "fail → heal" beat, and it is a *stronger* Bright Data story: Bright Data's Web Unlocker returns clean, bot-bypassed content even after the site mutates, and that resilient content is what makes the heal possible.

**0.3 — Use the current Gemini SDK.**
Use `@google/genai` (the unified Google Gen AI SDK). Do **not** use `@google/generative-ai` — that legacy package reached end-of-life on 2025-11-30. Import is `import { GoogleGenAI, Type } from '@google/genai'`. Default model string: `gemini-2.0-flash` (per project constraint; `gemini-2.5-flash` is a drop-in upgrade using the identical call signature — swap via the `GEMINI_MODEL` env var).

---

## Section 1 — Executive Summary & The "Dual-Heal" Strategy

### 1.1 The concept

RELIC monitors scientific and academic facility websites (national labs, university core facilities) and answers one question no ordinary scraper can: **"What knowledge did this page silently lose?"**

For each monitored target, RELIC:
1. Scrapes the **current** page through Bright Data.
2. Fetches the **historical** version through the Wayback Machine.
3. Runs a **Gemini semantic diff** between the two, extracting a `vitalityScore` and an explicit list of removed / added / modified equipment.

The thesis RELIC proves on stage: **a healthy scraper is not the same as preserved knowledge.** You can fix a scraper so it happily returns 200 OK and clean rows, and still be silently losing the fact that a lab decommissioned its Atomic Force Microscope. Scraper health is a plumbing metric; knowledge continuity is the real signal. RELIC surfaces both.

### 1.2 The "Dual-Heal" — two different kinds of "healing"

The name is deliberate. There are two heals in this product, and the demo contrasts them:

- **Heal #1 — Structural heal (the scraper heals itself).** When a target's DOM changes and the brittle Layer-1 extractor returns zero rows, RELIC re-extracts the *same Bright Data content* with Gemini (Layer 2), adapts to the new layout, and restores structured output. The scraper is "green" again. **This is the heal everyone celebrates and stops looking.**
- **Heal #2 — Semantic truth (the knowledge does NOT heal).** RELIC keeps going. It diffs the freshly-healed current data against the Wayback history and reports that even though the *scraper* recovered, a real capability — the AFM — is **gone**. The plumbing healed; the knowledge did not. **This is RELIC's punchline and its reason to exist.**

### 1.3 The 90-second winning demo flow

Rehearse this exact sequence. Timings are targets, not hard gates.

| # | Time | On screen | What's happening underneath |
|---|------|-----------|-----------------------------|
| 1 | 0:00–0:15 | RELIC dashboard loads. A grid of monitored lab pages, each with a **Vitality Score**. Click **SAIF IIT Bombay**. The detail panel shows a real semantic diff, e.g. *"2 equipment specs were silently removed since last year."* | Frontend reads pre-generated JSON from `data/analysis/` via the Express API. This proves the core loop on a real ancient site with genuine Wayback history. |
| 2 | 0:15–0:30 | Switch to the **Decoy Lab** HTML page (your GitHub Pages site). It shows an equipment table: **SEM, XRD, AFM**. | This is the controllable target you own. |
| 3 | 0:30–0:45 | You break it live: rename the table's `id` (or wrap it in new `<div>`s) **and delete the AFM `<tr>`**. Save. | The DOM mutation invalidates RELIC's Layer-1 selector; the AFM knowledge is now physically gone from the page. |
| 4 | 0:45–0:60 | Run `npm run scrape -- decoy`. The terminal + dashboard show the decoy's scraper flip to **FAILED / 0 equipment found**. | Layer-1 brittle selector `#equipment-table` no longer matches → extraction returns an empty set → RELIC marks the target unhealthy. This is a *real* failure, honestly demonstrated. |
| 5 | 0:60–0:75 | Run `npm run heal -- decoy`. Terminal shows RELIC re-extracting via Bright Data content + Gemini. Dashboard flips the decoy scraper back to **HEALTHY** with equipment restored. | Layer-2 AI heal: same Bright-Data-fetched content, layout-agnostic Gemini extraction, structured rows recovered. The scraper is green again. |
| 6 | 0:75–0:90 | Run `npm run analyze -- decoy` (or it auto-chains after heal). Dashboard raises a **critical red warning**: *"Knowledge Lost: Atomic Force Microscope removed from lab facilities."* | The semantic diff compares the *healed* current data against Wayback history and flags the AFM as removed. **Scraper healthy, knowledge lost.** Mic drop. |

The emotional arc for judges: *"Oh, the scraper broke."* → *"Nice, it healed itself."* → *"Wait… it's telling me the lab quietly lost a microscope, and no ordinary scraper would ever have caught that."*

---

## Section 2 — Tech Stack & Hard Constraints

### 2.1 Stack (exact)

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | **Node.js ≥ 20 LTS** (20 or 22) | Required by `@brightdata/cli`. Use ESM (`"type": "module"`). |
| Backend server | **Express** | Serves flat JSON from `data/` on port **3001**. CORS enabled. |
| Frontend | **React + Vite** | Standalone Vite app in `src/frontend/`, dev server on **5173**, proxies `/api` → 3001. |
| Styling | **TailwindCSS** | Utility classes only; no component library required. |
| AI | **Gemini via `@google/genai`** | Model `gemini-2.0-flash`. Strict JSON via `responseMimeType: 'application/json'` + `responseSchema`. |
| History | **Wayback Machine Availability API** | `https://archive.org/wayback/available?url=<URL>&timestamp=<YYYYMMDD>` → JSON. |
| Scraping | **Bright Data CLI `@brightdata/cli`** | `bdata scrape <url> -f <format>`. Shelled out from Node via `child_process.execFile`. |
| HTML parsing | **cheerio** | Pure-JS, **no native bindings**. Used for the brittle Layer-1 selector extractor. |

### 2.2 HARD CONSTRAINT — storage (emphasized)

> **The build runs on an Apple Silicon (M3) Mac.** Do **NOT** use SQLite, `better-sqlite3`, Prisma, Drizzle-with-native-driver, `bcrypt`, `canvas`, or **any npm package with native C/C++ bindings or a node-gyp build step.** These frequently fail to compile on arm64 and will burn irreplaceable demo time.
>
> **ALL state is flat JSON files** written with the built-in `fs` module (`fs/promises`). No database process, no ORM, no migrations. The `data/` directory *is* the database. Permitted dependencies are pure-JS only: `express`, `cors`, `cheerio`, `@google/genai`, `dotenv` (and on the frontend: `react`, `react-dom`, `vite`, `tailwindcss`, `@vitejs/plugin-react`). If any other dependency is considered, verify it is pure JS before installing.

### 2.3 Secrets

A single root `.env`:
```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
BRIGHTDATA_API_KEY=your_key_here   # optional; skips interactive bdata login
BDATA_BIN=bdata                    # or an absolute path to the binary
```
The Bright Data CLI authenticates once via `bdata login` (browser OAuth) or via `BRIGHTDATA_API_KEY`. The Gemini key is read by the backend only — it is **never** shipped to the frontend.

---

## Section 3 — Data Pipeline & Architecture

### 3.1 Flow

```
                 ┌─────────────────────────────────────────────────────────┐
                 │                      targets.json                        │
                 │        (9 targets, each with url + strategy)             │
                 └───────────────┬──────────────────────┬──────────────────┘
                                 │                      │
              (A) LIVE           │                      │ (B) HISTORICAL
        ┌────────────────────────▼───────┐   ┌──────────▼─────────────────────┐
        │ src/scraper                     │   │ src/analyzer/wayback.js         │
        │  brightdata.js  → bdata scrape  │   │  archive.org/wayback/available  │
        │  extract.js     → cheerio (L1)  │   │  → closest snapshot URL         │
        │  scrape.js      → orchestrate   │   │  → bdata scrape snapshot         │
        │  heal.js        → Gemini (L2)   │   │  → Gemini extract equipment      │
        └───────────────┬─────────────────┘   └──────────┬─────────────────────┘
                        │ writes                          │ writes
                        ▼                                 ▼
                data/current/<id>.json            data/historical/<id>.json
                        │                                 │
                        └───────────────┬─────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │ src/analyzer/diff.js           │
                        │  Gemini semantic diff          │
                        │  → vitalityScore + removed/     │
                        │    added/modified + knowledgeLoss│
                        └───────────────┬─────────────────┘
                                        │ writes
                                        ▼
                              data/analysis/<id>.json
                                        │
                        ┌───────────────▼─────────────────┐
                        │ src/api/server.js (Express :3001)│
                        │  GET /api/targets                │
                        │  GET /api/current/:id            │
                        │  GET /api/analysis[/:id]         │
                        │  POST /api/scrape|heal|analyze/:id│
                        └───────────────┬─────────────────┘
                                        │ HTTP (Vite proxy /api → 3001)
                                        ▼
                        ┌───────────────────────────────┐
                        │ src/frontend (React+Tailwind)  │
                        │  Vitality grid + Semantic Diff │
                        │  + Knowledge-Loss warnings     │
                        └───────────────────────────────┘
```

### 3.2 Canonical equipment record (the schema everything maps to)

Every scraper, historical extraction, and heal maps its target's page into this exact shape:

```json
{
  "name": "Atomic Force Microscope",
  "specifications": "Bruker Dimension Icon, 0.5 nm resolution",
  "location": "SAIF, 2nd Floor",
  "status": "Operational"
}
```

### 3.3 File contracts

**`data/current/<id>.json`** (written by `scrape.js` and `heal.js`):
```json
{
  "targetId": "decoy",
  "name": "Decoy University Lab",
  "url": "https://<you>.github.io/relic-decoy/",
  "scrapedAt": "2026-08-20T10:00:00.000Z",
  "method": "selector",            // "selector" (L1) | "ai-heal" (L2)
  "healthy": true,
  "equipment": [ /* array of canonical records */ ]
}
```

**`data/historical/<id>.json`** (written by `wayback.js`):
```json
{
  "targetId": "decoy",
  "snapshotUrl": "http://web.archive.org/web/2024.../...",
  "snapshotTimestamp": "20240115",
  "fetchedAt": "2026-08-20T10:00:00.000Z",
  "equipment": [ /* array of canonical records */ ]
}
```

**`data/analysis/<id>.json`** (written by `diff.js`):
```json
{
  "targetId": "decoy",
  "analyzedAt": "2026-08-20T10:00:00.000Z",
  "vitalityScore": 62,
  "summary": "One critical instrument removed; two spec downgrades.",
  "knowledgeLoss": true,
  "removed":  [ { "name": "Atomic Force Microscope", "reason": "Present in 2024 snapshot, absent now", "severity": "critical" } ],
  "added":    [ ],
  "modified": [ { "name": "SEM", "change": "Resolution spec dropped from listing" } ]
}
```

### 3.4 Required folder structure

```
relic/
├── .env
├── .gitignore
├── package.json                 # ESM, backend scripts, pure-JS deps only
├── targets.json                 # the 9 monitored targets
├── data/
│   ├── current/                 # live scrape output (per target)
│   ├── historical/              # wayback extractions (per target)
│   ├── analysis/                # gemini semantic diffs (per target)
│   └── raw/                     # cached raw bdata output (markdown/html) — optional
├── decoy-site/
│   └── index.html               # the controllable GitHub Pages target
└── src/
    ├── scraper/
    │   ├── brightdata.js         # execFile wrapper around `bdata scrape`
    │   ├── extract.js            # cheerio brittle selector extractor (Layer 1)
    │   ├── aiExtract.js          # Gemini layout-agnostic extractor (shared by heal + wayback)
    │   ├── scrape.js             # orchestrates a scrape run, writes data/current
    │   └── heal.js               # Layer-2 heal, writes data/current (method=ai-heal)
    ├── analyzer/
    │   ├── wayback.js            # fetch snapshot → aiExtract → data/historical
    │   └── diff.js               # gemini semantic diff → data/analysis
    ├── api/
    │   └── server.js             # Express :3001
    └── frontend/                 # standalone Vite app (own package.json/node_modules)
        ├── index.html
        ├── vite.config.js        # proxy /api → http://localhost:3001
        ├── tailwind.config.js
        ├── postcss.config.js
        └── src/
            ├── main.jsx
            ├── index.css         # tailwind directives
            ├── App.jsx
            └── components/
                ├── TargetGrid.jsx
                ├── VitalityBadge.jsx
                └── DiffPanel.jsx
```

---

## Section 4 — Target Sources

### 4.1 `targets.json` (write verbatim)

`strategy: "selector"` uses the brittle Layer-1 extractor (only the decoy, so we can demo break/heal). `strategy: "ai"` uses the layout-agnostic Gemini extractor (all real sites — they each have a different DOM, which is exactly why per-site selectors are unviable and Bright Data + AI extraction wins).

```json
[
  {
    "id": "decoy",
    "name": "Decoy University Lab (Demo-Controlled)",
    "url": "https://YOUR_GH_USERNAME.github.io/relic-decoy/",
    "strategy": "selector",
    "note": "We control this. Delete the AFM row live to trigger knowledge-loss detection."
  },
  {
    "id": "saif-iitb",
    "name": "SAIF IIT Bombay",
    "url": "http://www.saif.iitb.ac.in",
    "strategy": "ai",
    "note": "Ancient HTML, confirmed Wayback history — the hero real-world case."
  },
  {
    "id": "crf-iitd",
    "name": "IIT Delhi Central Research Facility",
    "url": "https://crf.iitd.ac.in",
    "strategy": "ai"
  },
  {
    "id": "cense-iisc",
    "name": "IISc Bangalore CeNSE",
    "url": "https://www.cense.iisc.ac.in/facilities",
    "strategy": "ai"
  },
  {
    "id": "npl-csir",
    "name": "CSIR–National Physical Laboratory",
    "url": "https://www.nplindia.org/index.php/facilities/",
    "strategy": "ai"
  },
  {
    "id": "iiser-pune",
    "name": "IISER Pune Research Infrastructure",
    "url": "https://www.iiserpune.ac.in/research/facilities",
    "strategy": "ai"
  },
  {
    "id": "bits-pilani",
    "name": "BITS Pilani Central Analytical Lab",
    "url": "https://www.bits-pilani.ac.in/pilani/central-analytical-laboratory/",
    "strategy": "ai"
  },
  {
    "id": "mit-mrsec",
    "name": "MIT MRSEC Shared Facilities",
    "url": "https://mrsec.mit.edu/facilities",
    "strategy": "ai"
  },
  {
    "id": "snsf-stanford",
    "name": "Stanford Nano Shared Facilities",
    "url": "https://snsf.stanford.edu/equipment/",
    "strategy": "ai"
  }
]
```

> Replace `YOUR_GH_USERNAME` after the decoy is deployed (Phase 1). For any real target that has thin or no Wayback history, RELIC should degrade gracefully (see §5 Phase 3 — analyzer must not crash when a snapshot is missing; it writes an analysis with `vitalityScore: null` and a `"No historical snapshot available"` summary). The decoy and SAIF IIT Bombay are the two guaranteed-good demo cases.

### 4.2 Standardized output schema

All 9 collectors normalize to the four fields in §3.2: **`name`, `specifications`, `location`, `status`**. Missing fields are emitted as empty strings, never omitted, so the diff engine always compares like-for-like.

---

## Section 5 — Step-by-Step Implementation Roadmap

Execute phases in order. After each phase, the stated verification must pass before moving on.

### Phase 0 — Prerequisites (verify, don't assume)

```bash
node -v            # must be >= 20
npm i -g @brightdata/cli
bdata version
bdata login        # one-time browser OAuth; creates cli_unlocker/cli_browser zones
bdata scrape https://example.com | head    # smoke test: should print markdown
```

---

### Phase 1 — Scaffolding + Decoy site

**1.1 Root project**
```bash
mkdir relic && cd relic
mkdir -p data/current data/historical data/analysis data/raw decoy-site
mkdir -p src/scraper src/analyzer src/api
npm init -y
npm pkg set type=module
npm i express cors cheerio @google/genai dotenv
```

**1.2 Root `package.json` scripts** — set these:
```bash
npm pkg set scripts.api="node src/api/server.js"
npm pkg set scripts.scrape="node src/scraper/scrape.js"
npm pkg set scripts.heal="node src/scraper/heal.js"
npm pkg set scripts.wayback="node src/analyzer/wayback.js"
npm pkg set scripts.analyze="node src/analyzer/diff.js"
npm pkg set scripts.pipeline="node src/scraper/scrape.js && node src/analyzer/wayback.js && node src/analyzer/diff.js"
```
Usage: `npm run scrape -- decoy`, `npm run heal -- decoy`, etc. (the `--` forwards the target id).

**1.3 `.gitignore`**
```
node_modules/
.env
data/raw/
src/frontend/node_modules/
src/frontend/dist/
```

**1.4 `decoy-site/index.html`** — write verbatim. Note the `id="equipment-table"` (Layer-1 selector target) and the clearly-marked AFM row you will delete live.
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Decoy University — Central Instrumentation Facility</title>
  <style>
    body { font-family: Georgia, serif; max-width: 820px; margin: 40px auto; color: #1a1a1a; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #999; padding: 10px; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Central Instrumentation Facility</h1>
  <p>Shared experimental equipment available to all research groups.</p>

  <!-- RELIC Layer-1 selector targets #equipment-table.
       DEMO STEP: (a) rename this id (e.g. to "equip-tbl") OR wrap the table in a <div>,
       and (b) DELETE the Atomic Force Microscope <tr> below, then save. -->
  <table id="equipment-table">
    <thead>
      <tr><th>Equipment Name</th><th>Specifications</th><th>Location</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>Scanning Electron Microscope</td><td>Zeiss Gemini, 1 nm resolution</td><td>Room 101</td><td>Operational</td></tr>
      <tr><td>X-Ray Diffractometer</td><td>Rigaku SmartLab, Cu Kα source</td><td>Room 102</td><td>Operational</td></tr>
      <!-- DELETE THIS ROW DURING THE DEMO -->
      <tr><td>Atomic Force Microscope</td><td>Bruker Dimension Icon, 0.5 nm resolution</td><td>Room 103</td><td>Operational</td></tr>
    </tbody>
  </table>
</body>
</html>
```

**1.5 Deploy the decoy to GitHub Pages** (so it has a real, scrapeable URL and a genuine snapshot lineage):
```bash
# In a separate repo, e.g. relic-decoy
git init && git add index.html && git commit -m "decoy v1"
git branch -M main
git remote add origin https://github.com/YOUR_GH_USERNAME/relic-decoy.git
git push -u origin main
# Enable Pages: repo Settings → Pages → Deploy from branch → main → / (root)
```
Then set the decoy URL in `targets.json`.

**Verify Phase 1:** `bdata scrape https://YOUR_GH_USERNAME.github.io/relic-decoy/ -f html | grep equipment-table` returns the table.

---

### Phase 2 — Bright Data wrapper + Layer-1 extractor + scrape orchestrator

**2.1 `src/scraper/brightdata.js`** (verbatim)
```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BDATA = process.env.BDATA_BIN || 'bdata';

/**
 * Fetch a URL through Bright Data. Returns raw stdout in the requested format.
 * format: 'markdown' | 'html' | 'json'
 */
export async function fetchViaBrightData(url, { format = 'markdown', country } = {}) {
  const args = ['scrape', url, '-f', format];
  if (country) args.push('--country', country);
  const { stdout } = await execFileAsync(BDATA, args, {
    maxBuffer: 1024 * 1024 * 25,       // 25 MB, big pages are fine
    timeout: 120000,                   // 2 min hard cap
  });
  return stdout;
}
```

**2.2 `src/scraper/extract.js`** — brittle Layer-1 (verbatim)
```js
import * as cheerio from 'cheerio';

/**
 * Layer 1: extract equipment via a hardcoded selector. INTENTIONALLY BRITTLE.
 * When the target's DOM changes, this returns [] and the scrape is marked unhealthy.
 */
export function extractBySelector(html) {
  const $ = cheerio.load(html);
  const rows = $('#equipment-table tbody tr');   // brittle by design
  const equipment = [];
  rows.each((_, el) => {
    const cells = $(el).find('td').map((__, td) => $(td).text().trim()).get();
    if (cells.length >= 4) {
      equipment.push({
        name: cells[0] || '',
        specifications: cells[1] || '',
        location: cells[2] || '',
        status: cells[3] || '',
      });
    }
  });
  return equipment;
}
```

**2.3 `src/scraper/aiExtract.js`** — layout-agnostic Gemini extractor (verbatim). Shared by `heal.js` and `wayback.js`.
```js
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const EQUIPMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    equipment: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:           { type: Type.STRING },
          specifications: { type: Type.STRING },
          location:       { type: Type.STRING },
          status:         { type: Type.STRING },
        },
        required: ['name', 'specifications', 'location', 'status'],
      },
    },
  },
  required: ['equipment'],
};

/**
 * Layer 2 / historical extraction: pull structured equipment from ANY page content,
 * regardless of HTML layout. `content` is markdown or text from Bright Data.
 */
export async function extractByAI(content) {
  const prompt = [
    'You are extracting scientific lab equipment from a facility web page.',
    'Return ONLY equipment/instruments (microscopes, spectrometers, diffractometers, etc.).',
    'For each item, fill name, specifications, location, and status.',
    'If a field is unknown, use an empty string. Do not invent equipment that is not present.',
    '',
    'PAGE CONTENT:',
    content.slice(0, 100000),
  ].join('\n');

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: EQUIPMENT_SCHEMA,
      temperature: 0,
    },
  });

  const parsed = JSON.parse(res.text);
  return Array.isArray(parsed.equipment) ? parsed.equipment : [];
}
```

**2.4 `src/scraper/scrape.js`** — orchestrator (verbatim)
```js
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
```

**Verify Phase 2:** `npm run scrape -- decoy` writes `data/current/decoy.json` with `healthy: true` and 3 items. Then, on the *broken* decoy (id renamed), the same command writes `healthy: false` with 0 items.

---

### Phase 3 — Heal (Layer 2) + Wayback fetcher + Gemini diff

**3.1 `src/scraper/heal.js`** — the structural heal (verbatim)
```js
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
```

**3.2 `src/analyzer/wayback.js`** — history fetcher (verbatim). Degrades gracefully when there is no snapshot.
```js
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchViaBrightData } from '../scraper/brightdata.js';
import { extractByAI } from '../scraper/aiExtract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNAPSHOT_TS = '20240101';   // aim ~1 year back; Wayback returns the closest available

async function loadTargets() {
  return JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8'));
}

async function findSnapshot(url) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${SNAPSHOT_TS}`;
  const res = await fetch(api);
  const data = await res.json();
  return data?.archived_snapshots?.closest || null;   // { url, timestamp, available }
}

async function processTarget(target) {
  const snap = await findSnapshot(target.url);
  if (!snap || !snap.available) {
    const record = {
      targetId: target.id, snapshotUrl: null, snapshotTimestamp: null,
      fetchedAt: new Date().toISOString(), equipment: [],
      note: 'No historical snapshot available',
    };
    await writeFile(resolve(ROOT, 'data', 'historical', `${target.id}.json`), JSON.stringify(record, null, 2));
    console.log(`[wayback] ${target.id}: no snapshot`);
    return;
  }

  const md = await fetchViaBrightData(snap.url, { format: 'markdown' });
  const equipment = await extractByAI(md);

  const record = {
    targetId: target.id,
    snapshotUrl: snap.url,
    snapshotTimestamp: snap.timestamp,
    fetchedAt: new Date().toISOString(),
    equipment,
  };
  await writeFile(resolve(ROOT, 'data', 'historical', `${target.id}.json`), JSON.stringify(record, null, 2));
  console.log(`[wayback] ${target.id}: snapshot ${snap.timestamp} — ${equipment.length} item(s)`);
}

const only = process.argv[2];
const targets = (await loadTargets()).filter(t => !only || t.id === only);
for (const t of targets) {
  try { await processTarget(t); }
  catch (e) { console.error(`[wayback] ${t.id} ERROR:`, e.message); }
}
```

**3.3 `src/analyzer/diff.js`** — semantic diff (verbatim)
```js
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const DIFF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vitalityScore: { type: Type.NUMBER },   // 0-100, higher = more knowledge preserved
    summary: { type: Type.STRING },
    knowledgeLoss: { type: Type.BOOLEAN },
    removed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          reason: { type: Type.STRING },
          severity: { type: Type.STRING },   // "critical" | "moderate" | "minor"
        },
        required: ['name', 'severity'],
      },
    },
    added: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ['name'] },
    },
    modified: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, change: { type: Type.STRING } },
        required: ['name', 'change'],
      },
    },
  },
  required: ['vitalityScore', 'summary', 'knowledgeLoss', 'removed', 'added', 'modified'],
};

async function analyze(id) {
  const current = JSON.parse(await readFile(resolve(ROOT, 'data', 'current', `${id}.json`), 'utf8'));
  const historical = JSON.parse(await readFile(resolve(ROOT, 'data', 'historical', `${id}.json`), 'utf8'));

  if (!historical.equipment || historical.equipment.length === 0) {
    const record = {
      targetId: id, analyzedAt: new Date().toISOString(),
      vitalityScore: null, summary: 'No historical snapshot to compare against.',
      knowledgeLoss: false, removed: [], added: [], modified: [],
    };
    await writeFile(resolve(ROOT, 'data', 'analysis', `${id}.json`), JSON.stringify(record, null, 2));
    console.log(`[diff] ${id}: no history`);
    return;
  }

  const prompt = [
    'Compare a lab facility page ACROSS TIME. You are given the HISTORICAL equipment list',
    '(from a Wayback snapshot) and the CURRENT equipment list (scraped today).',
    'Identify what knowledge was lost or changed. Match items by meaning, not exact string.',
    'Removed = present historically, absent now (this is knowledge loss). Set severity',
    '"critical" for a whole instrument disappearing, "moderate"/"minor" for lesser changes.',
    'vitalityScore = 0-100 where 100 means all historical knowledge is preserved and 0 means',
    'severe loss. Set knowledgeLoss=true if anything meaningful was removed.',
    '',
    `HISTORICAL (${historical.snapshotTimestamp || 'unknown date'}):`,
    JSON.stringify(historical.equipment, null, 2),
    '',
    'CURRENT:',
    JSON.stringify(current.equipment, null, 2),
  ].join('\n');

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: DIFF_SCHEMA, temperature: 0 },
  });

  const analysis = JSON.parse(res.text);
  const record = { targetId: id, analyzedAt: new Date().toISOString(), ...analysis };
  await writeFile(resolve(ROOT, 'data', 'analysis', `${id}.json`), JSON.stringify(record, null, 2));
  console.log(`[diff] ${id}: vitality ${analysis.vitalityScore}, removed ${analysis.removed.length}`);
}

const only = process.argv[2];
const targets = only
  ? [only]
  : JSON.parse(await readFile(resolve(ROOT, 'targets.json'), 'utf8')).map(t => t.id);
for (const id of targets) {
  try { await analyze(id); }
  catch (e) { console.error(`[diff] ${id} ERROR:`, e.message); }
}
```

**Verify Phase 3:** With a broken-then-healed decoy, `npm run wayback -- decoy` then `npm run analyze -- decoy` produces `data/analysis/decoy.json` with the AFM in `removed` at `severity: "critical"` and `knowledgeLoss: true`.

---

### Phase 4 — Express API

**4.1 `src/api/server.js`** (verbatim)
```js
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
```

**Verify Phase 4:** `npm run api`, then `curl http://localhost:3001/api/analysis/decoy` returns the analysis JSON.

---

### Phase 5 — Vite React + Tailwind dashboard

**5.1 Scaffold**
```bash
cd src
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

**5.2 `src/frontend/tailwind.config.js`**
```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

**5.3 `src/frontend/src/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**5.4 `src/frontend/vite.config.js`** — proxy `/api` to the Express server:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
```

**5.5 `src/frontend/src/main.jsx`**
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

**5.6 `src/frontend/src/components/VitalityBadge.jsx`**
```jsx
export default function VitalityBadge({ score }) {
  if (score == null) return <span className="text-xs text-gray-400">no history</span>;
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <span className="text-xs text-gray-400">vitality</span>
    </div>
  );
}
```

**5.7 `src/frontend/src/components/DiffPanel.jsx`**
```jsx
export default function DiffPanel({ analysis }) {
  if (!analysis) return <div className="text-gray-400 p-6">Select a target.</div>;
  const { summary, removed = [], added = [], modified = [], knowledgeLoss } = analysis;
  return (
    <div className="p-6 space-y-5">
      {knowledgeLoss && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-4 rounded">
          <div className="text-red-400 font-bold text-sm uppercase tracking-wide">⚠ Knowledge Lost</div>
          <div className="text-gray-200 mt-1">{summary}</div>
        </div>
      )}
      {!knowledgeLoss && <div className="text-gray-300">{summary}</div>}

      {removed.length > 0 && (
        <section>
          <h3 className="text-red-400 font-semibold mb-2">Removed since last snapshot</h3>
          <ul className="space-y-1">
            {removed.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-gray-200">
                <span className={`text-xs px-2 py-0.5 rounded ${r.severity === 'critical' ? 'bg-red-600' : 'bg-amber-600'}`}>
                  {r.severity}
                </span>
                <span className="font-medium">{r.name}</span>
                {r.reason && <span className="text-gray-500 text-sm">— {r.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {modified.length > 0 && (
        <section>
          <h3 className="text-amber-400 font-semibold mb-2">Modified</h3>
          <ul className="space-y-1 text-gray-300">
            {modified.map((m, i) => <li key={i}><span className="font-medium">{m.name}</span> — {m.change}</li>)}
          </ul>
        </section>
      )}

      {added.length > 0 && (
        <section>
          <h3 className="text-green-400 font-semibold mb-2">Added</h3>
          <ul className="space-y-1 text-gray-300">{added.map((a, i) => <li key={i}>{a.name}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
```

**5.8 `src/frontend/src/components/TargetGrid.jsx`**
```jsx
import VitalityBadge from './VitalityBadge.jsx';

export default function TargetGrid({ targets, analyses, activeId, onSelect }) {
  const byId = Object.fromEntries(analyses.map(a => [a.targetId, a]));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {targets.map(t => {
        const a = byId[t.id];
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`text-left p-4 rounded-lg border transition
              ${active ? 'border-indigo-400 bg-indigo-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}
          >
            <div className="flex justify-between items-start">
              <div className="font-semibold text-gray-100">{t.name}</div>
              {a?.knowledgeLoss && <span className="text-red-400 text-lg leading-none">⚠</span>}
            </div>
            <div className="mt-2"><VitalityBadge score={a ? a.vitalityScore : null} /></div>
          </button>
        );
      })}
    </div>
  );
}
```

**5.9 `src/frontend/src/App.jsx`**
```jsx
import { useEffect, useState, useCallback } from 'react';
import TargetGrid from './components/TargetGrid.jsx';
import DiffPanel from './components/DiffPanel.jsx';

export default function App() {
  const [targets, setTargets] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([
      fetch('/api/targets').then(r => r.json()),
      fetch('/api/analysis').then(r => r.json()).catch(() => []),
    ]);
    setTargets(t);
    setAnalyses(Array.isArray(a) ? a : []);
    if (!activeId && t.length) setActiveId(t[0].id);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  const active = analyses.find(a => a.targetId === activeId);

  async function trigger(kind) {
    if (!activeId) return;
    setBusy(kind);
    await fetch(`/api/${kind}/${activeId}`, { method: 'POST' }).then(r => r.json());
    if (kind !== 'analyze') await fetch(`/api/analyze/${activeId}`, { method: 'POST' });
    await load();
    setBusy('');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="px-8 py-5 border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight">RELIC <span className="text-indigo-400">· the self-healing web memory</span></h1>
        <p className="text-gray-400 text-sm">A healthy scraper is not the same as preserved knowledge.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr]">
        <aside className="p-6 border-r border-gray-800">
          <div className="flex gap-2 mb-4">
            {['scrape', 'heal', 'analyze'].map(k => (
              <button key={k} disabled={!!busy} onClick={() => trigger(k)}
                className="px-3 py-1.5 text-sm rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 capitalize">
                {busy === k ? `${k}…` : k}
              </button>
            ))}
          </div>
          <TargetGrid targets={targets} analyses={analyses} activeId={activeId} onSelect={setActiveId} />
        </aside>

        <main>
          <div className="px-6 pt-6 text-lg font-semibold">
            {targets.find(t => t.id === activeId)?.name || '—'}
          </div>
          <DiffPanel analysis={active} />
        </main>
      </div>
    </div>
  );
}
```

**5.10 Run everything (two terminals)**
```bash
# Terminal 1 — backend
npm run api

# Terminal 2 — frontend
cd src/frontend && npm run dev   # open http://localhost:5173
```

**Verify Phase 5:** Dashboard lists all 9 targets; clicking the decoy shows its diff; the scrape/heal/analyze buttons drive the pipeline live.

---

## Appendix A — Pre-demo seed run

Generate real analysis JSON for the two guaranteed-good cases before recording, so the dashboard is populated on load:
```bash
npm run scrape  -- decoy      && npm run wayback -- decoy      && npm run analyze -- decoy
npm run scrape  -- saif-iitb  && npm run wayback -- saif-iitb  && npm run analyze -- saif-iitb
```
Then reset the decoy to the intact `index.html` (all three rows) and re-run `npm run scrape -- decoy` so the demo starts from a healthy state.

## Appendix B — Demo runbook (exact keystrokes)

1. Ensure `npm run api` and the Vite dev server are running; dashboard open at `:5173`.
2. Click **SAIF IIT Bombay** → show the real semantic diff.
3. Open `decoy-site/index.html` in the editor; rename `id="equipment-table"` → `id="equip-tbl"` **and** delete the AFM `<tr>`; push to GitHub Pages (or serve locally and point the decoy URL at `http://localhost:PORT` for zero deploy latency).
4. `npm run scrape -- decoy` → dashboard shows decoy **FAILED**.
5. `npm run heal -- decoy` → dashboard shows decoy **HEALTHY** again.
6. `npm run analyze -- decoy` → dashboard raises **"Knowledge Lost: Atomic Force Microscope removed."**

> Demo-latency tip: GitHub Pages can take a minute to redeploy. For a zero-wait demo, serve the decoy locally (`npx serve decoy-site`) and set the decoy `url` to that local address — Bright Data can't reach `localhost`, so in that mode have `brightdata.js` read the local file directly for the `decoy` id, OR keep GitHub Pages and rehearse the redeploy timing. Pick one and lock it before recording.

## Appendix C — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `bdata: command not found` | CLI not installed / not on PATH | `npm i -g @brightdata/cli`, or set `BDATA_BIN` to the absolute path |
| `Invalid or expired API key` from bdata | Not logged in | `bdata login` (or set `BRIGHTDATA_API_KEY`) |
| Gemini call throws `text` undefined | Wrong SDK | Must be `@google/genai`; access `res.text` (a property, not a function) |
| `node-gyp` / arm64 compile error | A native-binding dep sneaked in | Remove it; use only the pure-JS deps in §2.2 |
| Decoy still shows 3 items after "breaking" it | GitHub Pages hasn't redeployed | Wait for deploy, hard-refresh, or use the local-serve mode |
| Analysis empty for a real site | No Wayback snapshot | Expected; RELIC writes `vitalityScore: null`. Use decoy + SAIF IIT Bombay as the demo heroes |
| CORS error in browser | API not running / proxy misconfigured | Start `npm run api`; confirm Vite proxy `/api → :3001` |
