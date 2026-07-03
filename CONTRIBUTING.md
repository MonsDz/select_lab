# Contributing to select-lab

Thanks for considering a contribution — bug reports, fixes, docs, and new ideas are all welcome.

This is a young, solo-maintained project, so please be patient with response times, and open an issue to discuss anything non-trivial (new attributes, behavior changes, a new framework adapter) before investing time in a big PR.

## Setup

```bash
git clone https://github.com/MonsDz/select_lab.git
cd select_lab
npm install
npm run dev   # demo harness at http://localhost:5173 (10k-row mock API)
```

## Making a change

- Keep PRs focused — one fix/feature per PR is much easier to review than a bundle of unrelated changes.
- Match the existing code style (see `src/core/`): no comments unless they explain a non-obvious *why*, prefer the smallest change that solves the problem.
- If you're touching behavior (pagination, dismiss/close logic, theming, icons), add or update a check under `tests/` — most of them are plain Node/Puppeteer scripts you can run directly, e.g. `node tests/icon-check.mjs`.

## Before opening a PR

There's no CI configured yet, so please run these locally:

```bash
npm run typecheck
npm run build
npm test               # DataController engine (pagination/search/cache/abort)
npm run test:browser   # drives the real UI in Chrome — start `npm run dev` first
```

Other browser checks under `tests/` (icon adapters, theming cascade, scroll-dismiss) are fully self-contained — they build their own bundle and load a local fixture from `tests/fixtures/`, so just run them directly, e.g. `node tests/theme-check.mjs`. No dev server needed for these.

## Reporting bugs / proposing ideas

Open a [GitHub issue](https://github.com/MonsDz/select_lab/issues) — include a minimal repro (a codepen/stackblitz or a few lines showing the attributes/data you used) whenever the bug is about rendering or behavior.

For security vulnerabilities, see [SECURITY.md](./SECURITY.md) instead of opening a public issue.
