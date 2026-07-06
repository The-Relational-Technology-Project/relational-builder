# RTP Briefs

Print-ready briefs for the Relational Tech Project, designed in the
Relational Builder brand (Fraunces headings, Inter body, the craft palette
from `src/index.css`, and the tri-node mark from `src/components/RBMark.tsx`).

- `we-can-build-what-we-need.html` — the white paper (5 letter pages)
- `relational-builder.html` — the Relational Builder product brief (3 letter pages)
- `brief.css` — the shared print design system
- `fonts/` — Fraunces + Inter variable fonts (from `@fontsource-variable`),
  vendored so the briefs render standalone

## Building the PDFs

```sh
./build-pdfs.sh            # uses chromium / google-chrome / /opt/pw-browsers/chromium
./build-pdfs.sh /path/to/chrome
```

Each `.page` section is a fixed 8.5×11in box, so edits that add length must
fit their page — rebuild and eyeball every page after editing (e.g.
`pdftoppm -png -r 55 we-can-build-what-we-need.pdf out`).
