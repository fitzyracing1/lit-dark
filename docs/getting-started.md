# Getting started

Needs Node 18+ and `git`. `GITHUB_TOKEN` is optional (it raises the API rate limit).

```bash
git clone https://github.com/fitzyracing1/lit-dark
cd lit-dark
node read-light.mjs fitzyracing1/lit-dark   # prints ● lit bit=0 or ○ dark bit=1
```

## Force the light

`LIGHT` must contain the single word `lit` or `dark`. On every push, `.github/workflows/light.yml` exits 0 for `lit` (the run is lit) and 1 for `dark` (the run is dark).

```bash
echo lit > LIGHT
git add LIGHT && git commit -m 'light: lit' && git push
# after the Actions run finishes:
node read-light.mjs fitzyracing1/lit-dark
```
