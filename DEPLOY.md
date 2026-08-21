# Deploying RELIC for submission

Two artifacts to submit: a **GitHub repo** (everything you built) and a **live link**
(the interactive dashboard). The dashboard deploys as a **static site** — it reads the
101-lab JSON baked into the build, so no backend/API keys are exposed publicly. (Locally,
the same build auto-detects the Express backend and enables the live Scrape/Heal/Analyze
buttons.)

---

## 1. Push to GitHub

```bash
# from the project root
git add -A
git commit -m "RELIC: self-healing web memory — 22 labs"
# create an EMPTY repo on github.com (no README), then:
git remote add origin https://github.com/<you>/relic.git
git branch -M main
git push -u origin main
```

Your `.env` (with the Gemini keys) is gitignored and will **not** be pushed. Verify:
```bash
git check-ignore .env        # should print ".env"
```

---

## 2. Deploy the dashboard to Vercel

The repo ships a `vercel.json` that builds the frontend and bakes in the data — no config
needed.

1. Go to **vercel.com → Add New → Project** and import your `relic` repo.
2. Leave everything at defaults (the `vercel.json` sets the build command and output dir).
   - Build: `node scripts/make-static-data.mjs && cd src/frontend && npm install && npm run build`
   - Output: `src/frontend/dist`
3. Click **Deploy**. You'll get a URL like `https://relic-<you>.vercel.app`.

That URL is your submission link. It shows all 101 labs, vitality scores, and the semantic
diffs. Re-running the pipeline locally + `git push` will auto-redeploy with fresh data.

> Netlify works too: New site from Git → same build command → publish dir `src/frontend/dist`.

---

## 3. (Optional) The live break→heal demo

The one thing a static link can't show is the decoy's live *break → heal → knowledge-loss*
beat. For judging, either:

- **Record a 60–90s screen capture** of the local app doing it (see the demo beat in
  [SETUP.md](SETUP.md)) and link it in your submission, **or**
- **Present live** with the backend running locally; expose it briefly with
  `ngrok http 5173` if the judges need to click it themselves.

Keep this out of the public Vercel deploy — those buttons run billable Bright Data + Gemini
calls and need your keys.

---

## What the judge sees

| Link | Shows |
|------|-------|
| **GitHub repo** | Full pipeline, the multi-key Gemini rotation engine, Wayback-through-Bright-Data, all 101 analyses, `README.md`, `Finasco.txt` (problem log) |
| **Vercel link** | Interactive dashboard: 101 labs, 28 knowledge-loss cases, click-through semantic diffs |
| **Demo video** | The live self-heal + "scraper healthy, knowledge lost" punchline |
