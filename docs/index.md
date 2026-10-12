# lit-dark

lit-dark is the landing page and specification for the "light computer": one bit of CI truth per repository, named only **lit** or **dark**. It also holds a reproducible proof (a controllable `LIGHT` file plus a workflow) and a list of upstream merged fixes.

| State | Logical value (active-low) | Lamp |
|---|---|---|
| **lit** | `0` | ● |
| **dark** | `1` | ○ |

Mapping (from [SPEC.md](../SPEC.md)): a GitHub Actions `conclusion === "success"` is **lit**; any other conclusion is **dark**. Dark does **not** mean a fetch or download error. Those are reported separately.

- Site: https://fitzyracing1.github.io/lit-dark/ (GitHub Pages from `main` `/docs`)
- [Getting started](getting-started.md) · [Usage](usage.md) · [Architecture](architecture.md) · [Contributing](contributing.md)

Copyright (c) 2026 Joshua Almeida
