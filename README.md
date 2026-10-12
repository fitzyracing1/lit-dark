# lit-dark

**Landing page for the light computer.** One bit of CI truth, named only **lit** or **dark**.

| State | Logical value (active-low) | Lamp |
|---|---|---|
| **lit** | `0` | ● |
| **dark** | `1` | ○ |

Map once from GitHub Actions: `conclusion === "success"` → **lit**; any other conclusion → **dark**. After that, do not call lights green/red/passing/failing — call them lit or dark.

**Dark** means the upstream project’s latest relevant CI run mapped to dark. It does **not** mean “download failed”.

Full standard: [SPEC.md](SPEC.md).

Copyright (c) 2026 Joshua Almeida

---

## The light computer

The light computer packs eight lights into one active-low byte, runs small programs on an 8-bit CPU, and (with companion tools) turns dark lights into suggested actions.

- Spec and reproducible proof: **this public repo**
- Implementation (CPU, fetch, programs): [`fitzyracing1/light-computer`](https://github.com/fitzyracing1/light-computer) — **private for now**; link stays here so it works the moment it is opened
- Suggest-only programs (standalone): [`fitzyracing1/light-programs`](https://github.com/fitzyracing1/light-programs) — private for now
- Opt-in registry that can serve a fork while a mapped light is dark: [`fitzyracing1/patch-cloud`](https://github.com/fitzyracing1/patch-cloud) — private for now

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

| State | bit | Actions run | Reader output |
|---|---|---|---|
| lit | 0 | _(will fill)_ | _(will fill)_ |
| dark | 1 | _(will fill)_ | _(will fill)_ |
