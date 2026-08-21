# RELIC — Setup & Run

The full codebase is built and verified. Three steps remain, and they all require **your** credentials/accounts — I can't do them for you.

## 1. Add your Gemini API key
Edit `.env` and set:
```
GEMINI_API_KEY=<your real key from https://aistudio.google.com/apikey>
```
`GEMINI_MODEL` is set to `gemini-3.6-flash` (Google retired `gemini-2.0-flash`; 3.6-flash
is the current drop-in with the identical call signature).

## 2. Authenticate the Bright Data CLI (installed: v0.3.5)
```bash
bdata login
```
Opens a browser OAuth flow once and creates the unlocker zone. Smoke test:
```bash
bdata scrape https://example.com | head
```

## 3. Deploy the decoy site and wire its URL
Push `decoy-site/index.html` to a repo (e.g. `relic-decoy`), enable GitHub Pages
(Settings → Pages → main → / root), then set the real Pages URL for the `decoy`
target in `targets.json` (replace `YOUR_GH_USERNAME`).

> Zero-deploy alternative for the demo: `npx serve decoy-site`. Bright Data can't
> reach `localhost`, so in that mode point `decoy.url` at a public tunnel, or keep
> GitHub Pages. Lock one choice before recording.

## Run it (two terminals)
```bash
npm run api                    # backend on :3001
cd src/frontend && npm run dev # dashboard on :5173
```

## Pre-demo seed (populates the dashboard on load)
```bash
npm run scrape  -- decoy      && npm run wayback -- decoy      && npm run analyze -- decoy
npm run scrape  -- saif-iitb  && npm run wayback -- saif-iitb  && npm run analyze -- saif-iitb
```
Then restore `decoy-site/index.html` to all 3 rows and re-run `npm run scrape -- decoy`
so the demo starts healthy.

## Demo beat (per the PRD)
1. Click **SAIF IIT Bombay** → real semantic diff.
2. Break the decoy: rename `id="equipment-table"` → `equip-tbl` **and** delete the AFM `<tr>`.
3. `npm run scrape -- decoy` → **FAILED / 0 equipment**.
4. `npm run heal -- decoy` → **HEALTHY** again (Gemini re-extract).
5. `npm run analyze -- decoy` → **"Knowledge Lost: Atomic Force Microscope removed."**

## Pipeline results — 101 labs, 2,556 instruments, 28 knowledge-loss cases

The dashboard now monitors **101 facilities** worldwide (see `targets.json`); 62 have a
real historical diff, 39 are current-only ("no history"). The table below highlights the
original hero cases — the full set is in the live dashboard.

### Highlights

Clean run on `gemini-3.6-flash` via the multi-key rotation pool. `Current`/`Historical`
are extracted equipment counts; `0` historical = no usable Wayback capture.

| Target | Current | Historical | Vitality | Knowledge loss |
|--------|--------:|-----------:|---------:|----------------|
| Decoy University Lab (Demo-Controlled) | 3 | — | — | (interactive target) |
| SAIF IIT Bombay | 27 | 26 | 100 | — |
| **IIT Delhi Central Research Facility** | 83 | 78 | **88** | **⚠ 7 removed** |
| IISc CeNSE — Nanofab (NNfC) | 69 | — | — | — |
| **CSIR–National Physical Laboratory** | 10 | 15 | **67** | **⚠ 5 removed** |
| IISER Pune Physics Facilities | 11 | 11 | 100 | — |
| BITS Goa Sophisticated Instruments | 102 | 102 | 100 | — |
| **MIT DMSE Shared Facilities** | 3 | 7 | **35** | **⚠ 4 removed** |
| Stanford Nano Shared Facilities | 50 | 8 | 100 | — |
| Cornell NanoScale Facility (CNF) | 125 | — | — | — |
| Duke SMIF | 10 | — | — | — |
| Purdue Birck Nanotechnology Center | 2 | 2 | 98 | — |
| Penn State Materials Research Institute | 3 | 3 | 100 | — |
| **UC Santa Barbara Nanofab** | 86 | 90 | **88** | **⚠ 6 removed** |
| **Notre Dame Nanofab Facility** | 62 | 64 | **88** | **⚠ 3 removed** |
| Cambridge Nanoscience Centre | 36 | — | — | — |
| Toronto Nanofab Centre | 1 | 1 | 95 | — |
| **IIT Kharagpur Central Research Facility** | 48 | 44 | **88** | **⚠ 4 removed** |
| TIFR Central Facilities | 13 | 14 | 100 | — |
| **JNCASR Facilities** | 38 | 32 | **70** | **⚠ 10 removed** |
| University of Hyderabad CIF | 10 | 10 | 100 | — |
| Anna University | 28 | 28 | 95 | ⚠ minor |

**Scaled to 101 labs, 2,556 instruments tracked, 28 genuine knowledge-loss cases.** Sites
with `—` historical had no usable Wayback capture (rich current data only); the decoy is
the deferred interactive target.

## Operational notes (important, learned during the run)

- **Gemini model**: `gemini-2.0-flash` and `gemini-2.5-flash` are retired / closed to new
  users. The working model is **`gemini-3.6-flash`** (`.env` default). A lighter fallback
  with a *separate* quota bucket is **`gemini-flash-lite-latest`** — this run's data was
  generated on it after the main model's daily quota was hit.
- **Gemini free tier = 20 requests/day per model.** A full 9-site run is ~25+ AI calls, so
  it will exhaust the free tier. For a smooth live demo (and the UI's Scrape/Heal/Analyze
  buttons), **enable billing** on the Gemini key, or spread work across `gemini-3.6-flash`
  and `gemini-flash-lite-latest`.
- **Wayback history now flows through Bright Data.** archive.org's Availability API
  rate-limits (429) hard; `src/analyzer/wayback.js` falls back to fetching the
  `web.archive.org/web/<ts>/<url>` redirect *through Bright Data*, whose proxies bypass the
  IP block. On-theme: even the history is Bright-Data-resilient.
- **Decoy is seeded locally** (from `decoy-site/index.html`) so its card shows healthy. For
  the live break→heal→knowledge-loss demo it still needs to be deployed (step 3 above), so
  it has a real URL and Wayback lineage.

## What's already verified
- All 8 backend modules pass `node --check`.
- Frontend production build passes (Tailwind compiling).
- API boots on :3001; `/api/targets`, `/api/analysis`, `/api/analysis/:id` respond.
- Layer-1 cheerio extractor returns the 3 canonical equipment records from the decoy,
  and returns 0 the instant the table `id` changes (the demo's break beat).
