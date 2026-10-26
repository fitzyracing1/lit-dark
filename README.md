# lit-dark

**Landing page for the light computer.** Site: [fitzyracing1.github.io/lit-dark](https://fitzyracing1.github.io/lit-dark/) · [White paper](https://fitzyracing1.github.io/lit-dark/whitepaper.html). One bit of CI truth, named only **lit** or **dark**.

| State | Logical value (active-low) | Lamp |
|---|---|---|
| **lit** | `0` | ● |
| **dark** | `1` | ○ |

Map once from GitHub Actions: `conclusion === "success"` → **lit**; any other conclusion → **dark**. After that, do not call lights green/red/passing/failing — call them lit or dark.

**Dark** means the upstream project’s latest relevant CI run mapped to dark. It does **not** mean “download failed”.

Full standard: [SPEC.md](SPEC.md).

Copyright (c) 2026 Joshua Almeida

---

## Merged fixes

The site lists upstream pull requests that took a **dark** light and made it **lit** upstream: [fitzyracing1.github.io/lit-dark/#merged](https://fitzyracing1.github.io/lit-dark/#merged). The data lives in [`docs/merged.json`](docs/merged.json); the "Merged fixes" section in `docs/index.html` is static HTML generated from it (no JS needed).

### Add a merge

Needs Node 18+ and an authenticated [`gh`](https://cli.github.com/). After a PR is merged upstream:

```bash
node scripts/add-merged.mjs owner/repo N --light "upstream job name" \
  --dark "why the light was dark" --dark-since 2026-04-01T05:30:13Z \
  --fix "what the PR changed, in one sentence" \
  [--dark-run https://github.com/owner/repo/actions/runs/BEFORE] [--lit-run https://github.com/owner/repo/actions/runs/AFTER]
git add docs/merged.json docs/index.html
git commit -m "merged: owner/repo#N"
git push
```

The script fetches the PR with `gh api`, refuses PRs that are not merged, and fills in `repo`, `pr`, `title`, `url`, `mergedAt` and `mergedBy` from the API. Each entry explains what happened: **Before** (which upstream light was dark, since when, why, and a link to a dark upstream run before the merge), **Fix** (one sentence) and **After** (the first upstream run on the default branch after the merge, with how many of the `--light` jobs are lit). Without `--dark-run` / `--lit-run` the script finds those runs itself on the default branch and checks the jobs whose name contains `--light`. Until the after-merge run is lit the page says "waiting for upstream light"; re-run the command later to refresh it. Re-running for the same PR updates the entry instead of duplicating it and keeps earlier text unless you pass new text. `node scripts/add-merged.mjs --render` only regenerates the HTML from `docs/merged.json`. GitHub Pages rebuilds from `main` `/docs` on push.

---

## The light computer

The light computer packs eight lights into one active-low byte, runs small programs on an 8-bit CPU, and (with companion tools) turns dark lights into suggested actions.

| Piece | Repo | Access |
|---|---|---|
| Spec + reproducible proof (you are here) | [`fitzyracing1/lit-dark`](https://github.com/fitzyracing1/lit-dark) | **public** |
| CPU, fetch, byte, programs | [`fitzyracing1/light-computer`](https://github.com/fitzyracing1/light-computer) | private for now |
| Suggest-only programs (standalone) | [`fitzyracing1/light-programs`](https://github.com/fitzyracing1/light-programs) | private for now |
| Opt-in registry (fork while mapped light is dark) | [`fitzyracing1/patch-cloud`](https://github.com/fitzyracing1/patch-cloud) | private for now |

If a private link 404s, that repo is not public yet — this landing page and the proof below still stand on their own.

---

## Reproduce it

Needs Node 18+ and `git`. `GITHUB_TOKEN` is optional (higher API rate limit).

```bash
git clone https://github.com/fitzyracing1/lit-dark
cd lit-dark
```

### Force lit

```bash
echo lit > LIGHT
git add LIGHT && git commit -m 'light: lit' && git push
# wait for the Actions run to finish, then:
node read-light.mjs fitzyracing1/lit-dark
# expect: ● lit  bit=0
```

### Force dark

```bash
echo dark > LIGHT
git add LIGHT && git commit -m 'light: dark' && git push
# wait for the Actions run to finish, then:
node read-light.mjs fitzyracing1/lit-dark
# expect: ○ dark  bit=1
```

On a fork, pass your fork: `node read-light.mjs you/lit-dark`.

The switch is the file [`LIGHT`](LIGHT) (`lit` or `dark`). Workflow: [`.github/workflows/light.yml`](.github/workflows/light.yml). Reader (no deps): [`read-light.mjs`](read-light.mjs).

### Proof runs (this repo)

Recorded Oct 11, 2026 ~11:58–11:59 PM ET on `fitzyracing1/lit-dark`:

| State | bit | Actions run | Reader |
|---|---|---|---|
| **lit** | `0` | https://github.com/fitzyracing1/lit-dark/actions/runs/38201903463 | `● lit  bit=0  fitzyracing1/lit-dark` |
| **dark** | `1` | https://github.com/fitzyracing1/lit-dark/actions/runs/38201942095 | `○ dark  bit=1  fitzyracing1/lit-dark` |

Anyone can re-run the steps above on a fork and get the same two states.

## Documentation

- In-repo docs: [docs/](docs/index.md)
- Wiki: [https://github.com/fitzyracing1/lit-dark/wiki](https://github.com/fitzyracing1/lit-dark/wiki)

## Plans

This project is free, and its license stays as is. Support it through [GitHub Sponsors](https://github.com/sponsors/fitzyracing1):

- **Free**: use the code, community support.
- **Pro ($49/month)**: priority issues and support.
- **Team ($199/month)**: priority support for your team plus early access.
