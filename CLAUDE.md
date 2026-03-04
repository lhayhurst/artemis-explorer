# Artemis Preset Explorer — Development Guide

## Test-Driven Development (Required)
Always use red-green-refactor for all new logic:
1. Write a failing test first
2. Implement the minimum code to make it pass
3. Refactor for clarity

Never implement a function before its test exists.

## Scripts
- `npm run dev` — Vite dev server with hot reload
- `npm run build` — production build → dist/
- `npm run typecheck` — tsc --noEmit (type-check without emitting)
- `npm test` — vitest run (CI mode, exits after run)
- `npm run test:watch` — vitest watch (interactive dev mode)

## Architecture
Pure functions (parser, classifier, sysex-builder) live in `src/` and are fully unit-tested.
Browser-API-dependent code (midi.ts, main.ts) is not unit-tested — verify manually via `npm run dev`.

## Key Files
- `src/types.ts` — ArtemisPreset and related interfaces
- `src/parser.ts` — parseSyx(buffer): ArtemisPreset[]
- `src/classifier.ts` — classifyPreset(p), presetDisplayName(p, bank, idx)
- `src/sysex-builder.ts` — buildSyx(presets): Uint8Array
- `src/midi.ts` — Web MIDI state and handlers (browser API)
- `src/main.ts` — UI rendering and app wiring (browser API)
- `public/` — static assets: artemis-bank-{a-h}.bin factory presets, manual PDF
- `src/test/` — unit tests for pure functions

## Hosting
Deployed to GitHub Pages via GitHub Actions on push to main.
CI pipeline: typecheck → test → build → deploy.
