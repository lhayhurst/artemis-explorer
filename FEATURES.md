# Artemis Preset Explorer — Feature Backlog

Status key: ✅ Done · 🔜 Next · 📋 Planned · 🔭 Long-term

---

## ✅ Completed

- Bank browser (A–H tabs, factory/user badges)
- Preset sidebar with search, mini bars, mode badges, heuristic classification
- Detail view (collapsible cards: VCO, VCF, envelopes, LFOs, FX, Seq/Arp, global)
- Modulation matrix (5 sources, non-zero assignments highlighted)
- Table view (sortable, filterable by play mode)
- Compare view (right-click 2–3 presets, diffs in orange)
- Drag-and-drop / file picker `.syx` import
- Load Factory button (fetches factory `.bin` per bank)
- Download All (zip of all loaded banks as `.syx`)
- Web MIDI receive — bank dump (65 messages) and single preset (2 messages)
- Web MIDI send — Send Preset (audition) and Send Bank (with destination prompt)
- In-app user guide (? button → modal)
- GitHub issues link in header
- TypeScript + Vite + Vitest + GitHub Actions CI/CD
- Regression test: all HTML onclick handlers verified against window exports
- Preset editing — ✎ Edit / Done toggle in detail view; sliders, dropdowns, toggles, name input; per-preset dirty dot (orange ●) in sidebar; bank tab dirty badge
- MIDI footer bar — persistent bottom strip replacing floating panel; IN/OUT sections with connectivity dots (red/green); buttons disabled until port selected
- Sidebar preset names no longer include category suffix (badge already shows it)

---

## 🐛 Known Bugs

### MIDI connectivity dots don't go red on device power-off
The IN/OUT dots correctly turn green when ports are selected, but do not reliably
turn red when the Artemis is powered off. Chrome fires `onstatechange` but port
state in `midiAccess.inputs`/`outputs` maps appears stale at the time of the
callback even with `setTimeout(0)` deferral. Root cause is a Chrome Web MIDI
quirk. Workaround: re-select ports manually after reconnecting.

---

## 🔜 Near-term

### Librarian features
- Rename presets (edit `name` field in sidebar or detail header)
- Copy/paste preset between slots and banks
- Reorder presets by drag-and-drop in the sidebar

### Unsaved changes warning
- `beforeunload` prompt if dirty banks: "You have unsaved changes. Download your banks before leaving."

---

## 📋 Medium-term

### Keyboard navigation
- `↑` / `↓` arrows to move through preset list
- `Escape` to close open panels (MIDI, help modal)
- `A`–`H` to switch bank tabs

### Export single preset
- Button in detail view header (or right-click menu) to download the selected
  preset as a standalone `.syx` file, useful for sharing individual sounds.

### Patch sharing via URL
- Compress a single preset's JSON to base64 and store in the URL hash (`#preset=…`)
- Anyone opening that URL sees the preset loaded automatically
- Zero backend required

### Cross-bank search
- Global search across all loaded banks, not just the active one
- Results show bank letter + slot, clicking navigates there

### Local storage persistence
- Save loaded banks to `localStorage` on change
- Restore on page load so reloads don't lose work

### Embedded presets in HTML for offline use
- "Download Offline Copy" bakes current preset data into a self-contained HTML file
  that works from `file://` without a server (no fetch for `.bin` files)

---

## 🔭 Long-term

### Patch hub
- Browsable community preset library
- Upload, tag, search, download individual presets
- Needs a backend (Firebase / Supabase / GitHub-backed JSON store)
- Dreadbox team expressed interest in collaboration here
