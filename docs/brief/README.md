# The Relational Builder brief

`RB-brief.html` is the source for the three-page overview brief (`RB-brief.pdf`)
we hand to partners, funders, and curious neighbors. Audience-specific
variants (extra pages, tailored copy) are kept out of the repo — build them
from this source and share the PDF directly. Everything it needs lives
in this directory: fonts are the app's own (Fraunces + Inter, copied from
`@fontsource-variable`), and the screenshots in `images/` are real captures of
the running app — no mockups.

## Regenerating the screenshots

```bash
# from the repo root
VITE_ACCESS_CODE=6767 npm run dev -- --port 5199 --strictPort
npm i --no-save playwright-core   # once per checkout; stays out of package.json
node docs/brief/capture-screenshots.mjs           # ONLY=workspace re-shoots a subset
```

The capture script stages local state (a demo Alma Street Tool Library project,
a placeholder provider key so the composer renders signed-in) and shoots the
front door, the Studio Gallery (live commons data), and the workspace with the
demo app genuinely bundled by the preview engine. Details in the script header.

## Regenerating the PDF

```bash
cd docs/brief
chromium --headless --no-sandbox --print-to-pdf=RB-brief.pdf \
  --no-pdf-header-footer "file://$PWD/RB-brief.html"
```

## Keeping it current

Facts baked into the copy that drift over time (in both briefs):

- the commons item count (451 as of July 28, 2026) — count `commons_items` in
  the commons Supabase
- the free-tier model (Claude Opus 5 for planning, first builds, and edits,
  since July 27, 2026)
- the studios named in "Studios as first-class homes"
