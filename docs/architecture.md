# Architecture

| Path | Role |
|---|---|
| `SPEC.md` | the light standard (lit/dark, active-low encoding) |
| `LIGHT` | controllable state for the proof workflow |
| `.github/workflows/light.yml` | on push / dispatch: reads `LIGHT`, exits 0 (lit) or 1 (dark) |
| `read-light.mjs` | dependency-free reader of a repo's latest completed push run via the GitHub REST API |
| `scripts/add-merged.mjs` | maintains `docs/merged.json` and renders static HTML into `docs/index.html` |
| `docs/index.html`, `docs/whitepaper.html`, `docs/styles.css` | GitHub Pages site |

Related repos named in the README: `light-computer`, `light-programs`, and `patch-cloud`. They are private for now.
