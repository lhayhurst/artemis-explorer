# Artemis Preset Explorer

A web-based preset browser and librarian for the [Dreadbox Artemis](https://dreadbox-fx.com/artemis/) analog synthesizer.

Browse, search, compare, and import/export presets. Receive presets live over Web MIDI.

---

## Features

- **Bank browser** — 8 banks (A–H), auto-loads factory presets on open
- **Preset sidebar** — searchable, with play mode badges and mini parameter sparklines
- **Detail view** — collapsible cards for VCO, VCF, envelopes, LFOs, FX, sequencer/arp
- **Modulation matrix** — 5 sources: mod wheel, velocity, aftertouch, CC74, key track
- **Table view** — sortable spreadsheet, filterable by play mode
- **Compare view** — right-click 2–3 presets for side-by-side diff (differences in orange)
- **Drag-and-drop import** — drop `.syx` bank files onto the window
- **Web MIDI receive** — receive bank dumps and single presets from the Artemis (Chrome/Edge)
- **Download All** — zip all loaded banks as `.syx` files

---

## Developer Guide

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Development

Start the Vite dev server with hot reload:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The factory `.bin` files in `public/` are served automatically.

### Testing

Run all tests once (CI mode):

```bash
npm test
```

Watch mode for TDD:

```bash
npm run test:watch
```

Tests live in `src/test/`. Pure functions (parser, classifier, SysEx builder) are fully covered. Browser-API code (MIDI, UI rendering) is verified manually via the dev server.

### Type Checking

```bash
npm run typecheck
```

Runs `tsc --noEmit` — checks types without emitting files.

### Build

```bash
npm run build
```

Produces `dist/index.html` — a self-contained single-file app ready for static hosting. The factory `.bin` files are copied to `dist/` alongside it.

---

## Project Structure

```
├── index.html              Entry point (CSS + HTML shell; JS loaded from src/)
├── public/                 Static assets served as-is
│   └── artemis-bank-{a-h}.bin  Factory preset banks
├── src/
│   ├── types.ts            TypeScript interfaces: ArtemisPreset, PresetBase, etc.
│   ├── parser.ts           parseSyx(buffer) — extract presets from SysEx binary
│   ├── classifier.ts       classifyPreset(p), presetDisplayName(p, bank, idx)
│   ├── sysex-builder.ts    buildSyx(presets) — wrap presets into SysEx binary
│   ├── midi.ts             Web MIDI state and handlers
│   ├── main.ts             UI rendering and app wiring
│   └── test/
│       ├── parser.test.ts
│       ├── classifier.test.ts
│       └── sysex-builder.test.ts
├── CLAUDE.md               Development conventions for Claude Code sessions
└── HANDOFF.md              Project context document
```

---

## SysEx Protocol

All Artemis data is JSON wrapped in SysEx:

```
F0 00 21 35 00 09 [UTF-8 JSON] F7
```

**Bank dump** (65 messages): `{"BankBackup": N}` header + 64 preset objects
**Single preset** (2 messages): `"PresetBackup"` header + 1 preset object

Sending back uses the same format — see `src/sysex-builder.ts`.

---

## Deployment

Pushes to `main` trigger the GitHub Actions CI pipeline:

1. Type check (`tsc --noEmit`)
2. Tests (`vitest run`)
3. Build (`vite build`)
4. Deploy to GitHub Pages

To enable GitHub Pages: repo **Settings → Pages → Source → GitHub Actions**.

---

## Development Conventions

See [CLAUDE.md](CLAUDE.md) for the full guide. Key rule: **always write a failing test before implementing new logic** (red → green → refactor).
