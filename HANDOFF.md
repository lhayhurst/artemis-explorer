# Artemis Preset Explorer — Project Handoff Document

## What This Is

A web-based preset browser/librarian for the **Dreadbox Artemis** analog synthesizer. Currently a single HTML file (~350 lines) hosted on Neocities, with factory preset .bin files served alongside it. Design inspired by the Dreadbox website (dreadbox-fx.com/artemis/) — pure black background, white typography, minimal aesthetic.

## Current State

### Live Features
- **Bank browser**: 8 bank tabs (A–H), auto-loads factory presets as `.bin` files from same directory on page open
- **Preset sidebar**: searchable list with play mode badges, mini parameter sparklines, and heuristic classification tags (Bass, Pad, Lead, etc.)
- **Detail view**: full parameter breakdown in collapsible cards — VCO, VCF (LP/HP), envelopes, LFOs, global, 4 FX categories with active algorithm params, sequencer/arp step grid
- **Modulation matrix**: tabbed across 5 sources (mod wheel, velocity, aftertouch, CC74, key track), non-zero assignments highlighted
- **Table view**: sortable spreadsheet of key parameters, filterable by play mode (Poly/Mono/Uni/Tri/Duo)
- **Compare view**: right-click 2–3 presets for side-by-side diff with differences highlighted in orange
- **Drag-and-drop import**: load .syx bank exports from Artemis
- **Factory preset loading**: "Load Factory" button fetches .bin for current bank tab
- **Factory/User badges**: cyan "F" vs green "U" on bank tabs
- **Download All**: zips all loaded banks as .syx files + the HTML file itself (uses JSZip from CDN)
- **Web MIDI receive**: Chrome/Edge only, requires `sysex: true` permission
  - MIDI panel with port selector, start/stop listening, status display
  - Receives full bank dumps (65 SysEx messages: bank header + 64 presets)
  - Receives single preset exports (2 SysEx messages: header + preset)
  - Green flash animation on sidebar slot when single preset arrives
  - Pulsing green MIDI button while listening
- **Preset classification**: heuristic classifier based on envelope shape, filter settings, play mode, FX, sequencer state. Categories: Sub Bass, Bass, Lead, Sync Lead, Aggressive Lead, Mono, Pad, Ambient Pad, Evolving Pad, Drone, Keys, Pluck, Stab, Sequence, Arp, Motion, Poly, Synth
- **Dreadbox credit**: logo links to dreadbox-fx.com/artemis/, credit link in header

### Hosting
- **Neocities** (free static hosting)
- `.syx` extension not allowed on Neocities free tier — factory files renamed to `.bin` (SysEx binary, extension doesn't matter)
- Single HTML file + 8 `.bin` files = complete deployment
- No build step, no dependencies beyond JSZip CDN

## Artemis SysEx Protocol

### Format
All data is JSON wrapped in SysEx:
```
F0 00 21 35 00 09 [JSON bytes] F7
```
- `F0` = SysEx start
- `00 21 35` = Dreadbox manufacturer ID
- `00 09` = Artemis device ID
- JSON payload (UTF-8)
- `F7` = SysEx end

### Preset Structure
Each preset is a JSON object with:
- `name`: string or null
- `base`: object with all synthesis parameters (VCO, VCF, envelopes, LFOs, global, FX, sequencer)
- `mod_wheel`, `velocity`, `aftertouch`, `cc_74`, `key_track`: modulation matrix objects

### Bank Dump (65 messages)
1. Header: `{"BankBackup": N}` where N = 0–7 (A=0, B=1, ..., H=7)
2. Messages 2–65: 64 preset JSON objects

### Single Preset Dump (2 messages)
1. Header: `"PresetBackup"` (just the string, in quotes)
2. Preset JSON object

### Sending Presets TO Artemis (confirmed by Dreadbox engineer Orfeas Moraitis)
- **Single preset**: send the 2-message sequence (header + data). Loads into temporary memory as a preview — user can audition and optionally save from the Artemis front panel.
- **Full bank**: send the 65-message sequence (bank header + 64 presets). Artemis shows a prompt letting user choose which bank slot to load into. Must be exactly 64 presets after the header.
- **No remote dump request command** exists — user must trigger export from Artemis menu (MENU → EXPORT → BANK/PRESET). The web app just listens.
- The protocol is symmetrical: export format = import format.

## Architecture Notes

### Current Structure
Everything is in one HTML file:
- CSS: custom properties, Outfit + JetBrains Mono fonts from Google Fonts
- HTML: header with logo/tabs/buttons, sidebar, content area, MIDI panel
- JS: all logic inline — parser, classifier, renderers, MIDI, file I/O

### Key Functions
- `parseSyx(buffer)` — extracts JSON presets from SysEx binary
- `buildSyx(presets)` — wraps preset array back into SysEx binary (for .syx export)
- `classifyPreset(p)` — heuristic categorization based on parameter values
- `presetDisplayName(p, bank, idx)` — returns "A01 (Pad)" style display name
- `renderSidebar()`, `renderDetail()`, `renderTable()`, `renderCompare()` — view renderers
- `handleMidiMessage(e)` — buffers incoming SysEx, processes after 1.5s silence
- `processMidiBuffer()` — parses buffered messages as bank or single preset
- `autoLoadBanks()` — fetches artemis-bank-{a-h}.bin on page load
- `downloadAll()` — creates zip with .syx files + HTML

### State
All in-memory, stateless across page loads:
- `BANKS{}` — loaded preset arrays keyed by letter
- `BANK_SOURCE{}` — 'factory' or 'user' per bank
- `activeBank`, `activePresetIdx`, `currentView`, `compareSelection[]`

## Planned Features (Roadmap)

### Near-term (from user/Dreadbox feedback)
1. **Send to Artemis** (MIDI output) — send currently selected preset or full bank. Protocol known, just needs Web MIDI output implementation.
2. **Preset editing** — inline parameter editing (sliders for floats, dropdowns for enums, toggles for booleans). Write back to in-memory JSON, export as .syx.
3. **Librarian features** — reorder presets (drag in sidebar), copy/paste between banks, rename presets (edit `name` field).
4. **Unsaved changes warning** — `beforeunload` prompt if banks have been modified.

### Medium-term
5. **Patch sharing** — URL-encoded presets (compress JSON to base64 in URL hash) or JSON file exchange
6. **Embedded presets in HTML** — for local offline use, bake preset data into the downloaded HTML so it works from file:// without a server

### Longer-term
7. **Patch hub** — browsable community preset library (needs backend: Firebase/Supabase or GitHub-backed)

## Technical Debt / Next Steps for Proper Project Setup
- **No tests** — classifier, parser, SysEx builder, bank header parsing all need unit tests
- **No module structure** — pure functions (parser, classifier, builder) should be extracted to importable modules
- **Minified inline code** — built iteratively in chat, needs formatting and cleanup
- **No linting or type checking**
- **Suggested stack for GitLab project**:
  - Extract JS modules: `src/parser.js`, `src/classifier.js`, `src/sysex-builder.js`, `src/midi.js`
  - Test framework: Vitest or Node built-in `node --test`
  - Build: Vite (bundles back to single HTML for Neocities deploy)
  - CI/CD: GitLab CI pipeline — lint, test, build, deploy to Neocities via API
  - Consider TypeScript for the parameter types

## Key Contacts
- **Orfeas Moraitis** — Dreadbox hardware/software engineer. Responsive, has provided MIDI protocol details and feedback. Collaborated via email.
- **Dreadbox team** — liked the project, open to further collaboration, interested in full librarian/editor

## Files
- `artemis-explorer.html` — the complete application (348 lines)
- `artemis-bank-{a-h}.bin` — factory preset bank files (renamed from .syx for Neocities compatibility)
- `ARTEMIS-DIGITAL-MANUAL_12_09_2025.txt` — Artemis user manual (reference)
