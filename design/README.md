# RELIC — dashboard redesign canvas

Source artboards for the redesign explored during the UI pass. Published as a
Claude Design canvas: https://claude.ai/code/artifact/43f1fbe6-fe0a-46ed-bef1-53c7c16197a1

| File | Artboard |
|------|----------|
| `Main.dc.html`   | Dashboard reframed around the knowledge-loss index, ranked worst-first |
| `Report.dc.html` | Facility report with the decay timeline and archived-proof links |
| `Atlas.dc.html`  | Instrument atlas — the corpus pivoted by instrument class |
| `canvas.json`    | Artboard layout, sticky notes, launch view |

All three are built on the live app's tokens (Bricolage Grotesque / Inter /
JetBrains Mono, the `#5B8CFF → #A66BFF` gradient, glass cards, the
good/warn/crit ramp) so they read as the same product.

**Shipped from this canvas:** the index band + ranked rows (`IndexBand.jsx`,
`LabRow.jsx`), the decay timeline (`DecayChart.jsx`, `scripts/build-timeline.mjs`),
and the instrument atlas (`Atlas.jsx`, `scripts/build-atlas.mjs`).

Region percentages on the Atlas artboard were illustrative placeholders; the
shipped page computes them from `data/atlas.json`.
