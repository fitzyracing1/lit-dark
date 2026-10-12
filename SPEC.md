# Light specification

A **light** is one bit of CI truth for a GitHub repository (or a local override used for demos).

The vocabulary is only **lit** and **dark**. Once: GitHub Actions `conclusion === "success"` maps to **lit**; any other conclusion maps to **dark**. After that mapping, speak only in lit and dark.

## Lit and dark (active-low)

| State | Meaning | Logical value | Lamp |
|---|---|---|---|
| **lit** | Upstream’s latest relevant CI run is lit (`conclusion === "success"`) | `0` | ● |
| **dark** | That run is dark (any other conclusion) | `1` | ○ |

Encoding is **active-low**, like a hardware signal line: lit = 0, dark = 1.

### What “dark” means (and does not)

- **Dark** means: the upstream project’s **latest relevant CI run** mapped to dark.
- **Dark does not mean** “download failed”, “registry 404”, “npm install broke”, or “we could not fetch the API”. Those are fetch/transport errors — report them separately; do not invent a dark light from them.

“Relevant” = the newest **completed** GitHub Actions run with `event=push` (same filter used by `read-light.mjs`). If there is no such run, that is an error, not a dark light.

## Reading one light from GitHub Actions

```
GET /repos/{owner}/{repo}/actions/runs?per_page=1&status=completed&event=push
Accept: application/vnd.github+json
```

Take `workflow_runs[0]`. Map once: `conclusion === "success"` → **lit** (`lit: true`, bit `0`); anything else → **dark** (`lit: false`, bit `1`).

Optional: `GITHUB_TOKEN` raises the API rate limit. This repo’s reader: `node read-light.mjs [owner/repo]`.

## Consuming a byte of lights

Eight lights pack into one **active-low** byte (MSB = first repo):

- Repo index `i` (0…7) → bit `(7 - i)`
- Bit is **1 when dark**, **0 when lit**
- Example lamps `●●●●○○●●` → bits `00001100` → byte `12`

```js
// lit → 0, dark → 1
function lightsToByte(lights) {
  return lights.slice(0, 8).reduce(
    (b, l, i) => (l.lit ? b : b | (1 << (7 - i))),
    0,
  );
}
```

## Controllable light in this repo

The file `LIGHT` holds exactly one word: `lit` or `dark`. The workflow `.github/workflows/light.yml` exits 0 when the file says `lit`, and exits 1 when it says `dark`. That forces the Actions conclusion so the light is reproducible on any fork.

```bash
echo lit  > LIGHT && git commit -am 'light: lit'  && git push   # force ● lit
echo dark > LIGHT && git commit -am 'light: dark' && git push   # force ○ dark
node read-light.mjs fitzyracing1/lit-dark
```

See the README **Reproduce it** section for exact steps and recorded proof runs.
