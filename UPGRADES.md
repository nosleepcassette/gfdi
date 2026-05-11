# Small Upgrade Spec

## 0.3.1 - npm polish

- Add a CI job that runs `npm run typecheck`, targeted `oxlint`, `npm run build`,
  and `npm pack --dry-run`.
- Add a release checklist for `npm login`, `npm publish --access public`, and a
  post-publish `npx gfdi -- --version` smoke test.
- Add a `--version` smoke to README so users can verify the npx install path.

## 0.3.2 - count confidence

- Add `--explain-counts` to print per-adapter source totals and notes about
  recovered archives such as Claude history and Hermes JSON sessions.
- Add `--dedupe strict|session|none` with `session` as default.
- Add a tiny fixture suite for Claude, Codex, Hermes JSON/JSONL, and profile
  history parsing.

## 0.3.3 - dashboard ergonomics

- Add `--compact` for narrow terminals and screenshots.
- Add `--theme amber|mono|rage` with `amber` as the current house style.
- Add `--sort rate|swears|messages|name`; keep `rate` as default.

## 0.4.0 - useful exports

- Add `--csv` for spreadsheet-friendly totals.
- Add `--since last-week|last-month|today` shortcuts.
- Add `--save <path>` to write the rendered JSON result without changing stdout.
