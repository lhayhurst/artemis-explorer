# Artemis Preset Explorer — User Guide

A browser-based tool for browsing, comparing, and transferring presets on the [Dreadbox Artemis](https://dreadbox-fx.com/artemis/) synthesizer.

---

## Getting Started

Open the app in Chrome or Edge (Web MIDI is not supported in Firefox or Safari).

The app loads the Dreadbox factory banks automatically on startup. If they are available, bank tabs will show a cyan **F** badge and a green dot.

---

## Bank Tabs

Eight bank tabs (A–H) run across the top of the screen.

| Indicator | Meaning |
|-----------|---------|
| Green dot | Bank is loaded |
| Cyan **F** badge | Factory preset bank |
| Green **U** badge | User-loaded bank |
| Bold/highlighted | Currently active bank |

Click any bank tab to switch to it. If the bank is empty you will see an empty state with options to load presets.

---

## Loading Presets

### Load .syx file
Click **Load .syx** or drag and drop one or more `.syx` files onto the window. The app reads the SysEx data and loads it into the appropriate bank slot.

- Files named with a bank letter (e.g. `bank-a.syx`, `mypresets_B.syx`) are placed in that bank.
- Files without a recognizable bank letter go into the first empty bank slot.
- A bank file may contain up to 64 presets.

### Load Factory
Select a bank tab and click **Load Factory** to fetch the Dreadbox factory preset file for that bank. Requires an internet or local server connection to the `.bin` files.

### Receive from Artemis via MIDI
See the [MIDI — Receive](#receive-from-artemis) section below.

---

## Preset Sidebar

The sidebar on the left lists all 64 presets in the active bank.

- **Filter box** — type to filter by name or play mode.
- **Mini bars** — a small visualization of cutoff, resonance, attack, and release.
- **Mode badge** — shows POLY, MONO, UNI, TRI, or DUO.
- **Left-click** a preset to select it and view its details.
- **Right-click** a preset to add it to the compare selection (up to 3).

---

## Views

Switch between views using the **Detail / Table / Compare** tabs in the header.

### Detail View

Shows all parameters for the selected preset, organized into collapsible cards:

| Card | Parameters |
|------|-----------|
| VCO — Oscillators | Wave/Morph, Mix, Sub/Noise, Sync, VCO2 Tune, Detune, Glide, PW, FM |
| VCF — Low Pass | Cutoff, Resonance, Poles, Key Track, Env Amount, Filter FM |
| VCF — High Pass | Cutoff, Resonance |
| Env — Amplitude | Attack, Decay, Sustain, Release |
| Env — Filter/FM | Attack, Decay, Sustain, Release |
| LFO 1 | Rate, Fade In, Wave, VCO Target, VCO/VCF amounts |
| LFO 2 | Rate, X-Mod, Wave, Sync, Morph/PW amounts |
| Global | Play Mode, Legato, Glide, Drive, Spread, Level, BPM, Instability, Amp Velocity |
| FX — Distortion/Modulation/Delay/Reverb | Algorithm, Mix, and algorithm-specific parameters |
| Seq / Arp | Type, length, gate, step grid with notes and ties |

Click a card header to collapse or expand it.

**Modulation Matrix** — below the cards, tabs show the routing for each modulation source: Mod Wheel, Velocity, Aftertouch, CC74, and Key Track. A small orange dot on a tab means that source has active (non-zero) routing.

### Table View

Displays all presets in a sortable table. Click any column header to sort; click again to reverse. Use the mode filter chips (ALL / POLY / MONO / etc.) to narrow the list. Click any row to select the preset and jump to it in the sidebar.

### Compare View

After right-clicking 2 or 3 presets in the sidebar, the Compare view shows their parameters side by side. Parameters that differ between presets are highlighted in orange.

---

## MIDI

Click the **MIDI** button in the header to open the MIDI panel. This requires Chrome or Edge with SysEx access granted.

### Receive from Artemis

1. Select your Artemis from the **INPUT** dropdown.
2. Click **Start Listening**.
3. On your Artemis, trigger a preset export or bank export from the front panel.
4. The app shows progress as SysEx messages arrive.
5. After a brief pause the data is parsed and loaded automatically.

**Single preset** — loads into the currently selected bank slot (shown in the status line while listening). The slot flashes green when received.

**Bank dump** — all 64 presets load into the bank identified in the SysEx header (or the first free bank if unidentified).

Click **Stop Listening** to stop, or **Clear Buffer** to discard buffered messages without processing them.

### Send to Artemis

1. Select your Artemis from the **OUTPUT** dropdown.
2. Use the sidebar to select the preset or bank you want to send.
3. Click **Send Preset** or **Send Bank**.

**Send Preset** — sends the currently selected preset to the Artemis in preview mode. The Artemis loads it into temporary memory; use the front panel to save it if you want to keep it.

**Send Bank** — sends all 64 presets from the active bank. The Artemis will prompt you to choose which bank slot to load into before saving.

---

## Export

Click **Download All** to export all loaded banks as a `.zip` file containing one `.syx` file per bank, ready to back up or share.

---

## Keyboard / Browser Tips

- The app is entirely client-side — no data leaves your browser except via MIDI.
- Multiple `.syx` files can be dropped at once to load several banks in one go.
- The app works offline once loaded (factory banks require a server connection).
- If MIDI ports are not appearing, disconnect and reconnect the USB cable and refresh the browser.
