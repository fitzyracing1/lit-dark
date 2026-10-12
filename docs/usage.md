# Usage

## read-light.mjs

```bash
node read-light.mjs [owner/repo]     # default: fitzyracing1/lit-dark
```

It reads the latest completed push-triggered Actions run for the repo and prints lit/dark and the active-low bit. Exit code 2 means a bad argument. Exit code 1 means an HTTP error or no completed push runs yet.

## scripts/add-merged.mjs

Records an upstream PR that turned a dark light lit. Needs an authenticated `gh`.

```bash
node scripts/add-merged.mjs owner/repo N --light "upstream job name" \
  --dark "why the light was dark" --dark-since 2026-04-01T05:30:13Z \
  --fix "what the PR changed, in one sentence" \
  [--dark-run URL] [--lit-run URL]
node scripts/add-merged.mjs --render   # regenerate HTML from docs/merged.json only
```

The script refuses PRs that are not merged. Re-running it for the same PR updates the existing entry instead of adding a second one. The output goes to `docs/merged.json` and the "Merged fixes" section of `docs/index.html`.
