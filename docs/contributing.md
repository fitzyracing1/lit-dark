# Contributing

There is no test suite in this repo. Before you open a PR:

- Keep the vocabulary to **lit** and **dark** (see `SPEC.md`).
- To add a merged fix, use `scripts/add-merged.mjs` instead of editing `docs/merged.json` or the HTML by hand.
- Check the light end to end with `node read-light.mjs`.
