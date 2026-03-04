import { parseSyx } from './parser';
import type { ArtemisPreset, BankLetter } from './types';

const BANK_LETTERS: BankLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Callbacks set by main.ts
export interface MidiCallbacks {
  onBankLoaded: (letter: BankLetter, presets: ArtemisPreset[]) => void;
  onPresetLoaded: (letter: BankLetter, slot: number, preset: ArtemisPreset) => void;
  onStatus: (html: string) => void;
  getActiveBank: () => BankLetter | null;
  getActivePresetIdx: () => number;
  isBankLoaded: (letter: BankLetter) => boolean;
}

let midiAccess: MIDIAccess | null = null;
let midiInput: MIDIInput | null = null;
let midiListening = false;
let midiBuffer: Uint8Array[] = [];
let midiTimeout: ReturnType<typeof setTimeout> | null = null;
let callbacks: MidiCallbacks | null = null;

export function initMidiCallbacks(cb: MidiCallbacks): void {
  callbacks = cb;
}

function setStatus(html: string): void {
  callbacks?.onStatus(html);
}

export async function initMidi(): Promise<void> {
  if (!navigator.requestMIDIAccess) {
    setStatus('Web MIDI not supported in this browser. Use Chrome or Edge.');
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    populateMidiPorts();
    midiAccess.onstatechange = () => populateMidiPorts();
  } catch {
    setStatus('MIDI access denied. Please allow SysEx access when prompted.');
  }
}

export function populateMidiPorts(): void {
  if (!midiAccess) return;
  const sel = document.getElementById('midiPortSelect') as HTMLSelectElement | null;
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Select MIDI Input —</option>';
  // MIDIInputMap only guarantees forEach in TS DOM lib — cast to access as Map
  const inputs = midiAccess.inputs as unknown as Map<string, MIDIInput>;
  inputs.forEach((port, id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = port.name + (port.manufacturer ? ` (${port.manufacturer})` : '');
    sel.appendChild(opt);
  });
  const prevOpt = sel.querySelector<HTMLOptionElement>(`option[value="${prev}"]`);
  if (prev && prevOpt) sel.value = prev;
  setStatus(
    inputs.size === 0
      ? 'No MIDI devices found. Connect your Artemis via USB and refresh.'
      : 'Select your Artemis MIDI input port above.'
  );
}

export function toggleListen(): void {
  midiListening ? stopListening() : startListening();
}

export function startListening(): void {
  if (!midiAccess) return;
  const sel = document.getElementById('midiPortSelect') as HTMLSelectElement | null;
  if (!sel?.value) { setStatus('Please select a MIDI input port first.'); return; }
  if (midiInput) midiInput.onmidimessage = null;
  midiInput = (midiAccess.inputs as unknown as Map<string, MIDIInput>).get(sel.value) ?? null;
  if (!midiInput) { setStatus('Port not found. Try refreshing.'); return; }

  midiBuffer = [];
  midiInput.onmidimessage = handleMidiMessage;
  midiListening = true;

  const listenBtn = document.getElementById('listenBtn');
  listenBtn?.classList.add('active');
  if (listenBtn) listenBtn.textContent = 'Stop Listening';
  document.getElementById('midiBtn')?.classList.add('listening');

  const activeBank = callbacks?.getActiveBank();
  const slot = callbacks?.getActivePresetIdx() ?? 0;
  const slotName = activeBank ? activeBank + String(slot + 1).padStart(2, '0') : '?';
  setStatus(
    `Listening on ${midiInput.name}...<br>Trigger a preset or bank export from your Artemis now.<br>Single presets will load into <span class="count">${slotName}</span>.`
  );
}

export function stopListening(): void {
  if (midiInput) midiInput.onmidimessage = null;
  midiListening = false;
  const listenBtn = document.getElementById('listenBtn');
  if (listenBtn) listenBtn.textContent = 'Start Listening';
  listenBtn?.classList.remove('active');
  document.getElementById('midiBtn')?.classList.remove('listening');
  setStatus(`Stopped listening. ${midiBuffer.length} SysEx message(s) in buffer.`);
}

function handleMidiMessage(e: MIDIMessageEvent): void {
  const d = e.data;
  if (!d || d[0] !== 0xf0) return;
  midiBuffer.push(new Uint8Array(d));
  const count = midiBuffer.length;
  setStatus(
    `Receiving... <span class="count">${count}</span> SysEx message(s)<br>` +
    (count === 1
      ? 'Got header — waiting for preset data...'
      : count <= 65 ? `Receiving presets... ${count - 1}/64` : `Received ${count} messages`)
  );
  if (midiTimeout) clearTimeout(midiTimeout);
  midiTimeout = setTimeout(() => processMidiBuffer(), 1500);
}

function processMidiBuffer(): void {
  if (!midiBuffer.length || !callbacks) return;

  let bankLetter: BankLetter | null = null;
  let presetMessages = midiBuffer;

  if (midiBuffer.length >= 2) {
    const firstPayload = midiBuffer[0]!.slice(6, midiBuffer[0]!.length - 1);
    const firstTxt = new TextDecoder().decode(firstPayload);
    try {
      const hdr = JSON.parse(firstTxt) as unknown;
      if (hdr !== null && typeof hdr === 'object' && 'BankBackup' in hdr) {
        const bankNum = parseInt(String((hdr as Record<string, unknown>)['BankBackup']));
        if (bankNum >= 0 && bankNum < 8) bankLetter = BANK_LETTERS[bankNum] ?? null;
        presetMessages = midiBuffer.slice(1);
      } else if (hdr === 'PresetBackup') {
        presetMessages = midiBuffer.slice(1);
      }
    } catch { /* not a recognized header */ }
  }

  const total = presetMessages.reduce((s, m) => s + m.length, 0);
  const combined = new Uint8Array(total);
  let off = 0;
  for (const m of presetMessages) { combined.set(m, off); off += m.length; }

  const presets = parseSyx(combined.buffer as ArrayBuffer);
  if (!presets.length) {
    setStatus(`Received ${midiBuffer.length} SysEx messages but could not parse any presets.`);
    return;
  }

  if (presets.length >= 64) {
    const target = bankLetter ?? findFreeBank();
    callbacks.onBankLoaded(target, presets.slice(0, 64));
    setStatus(`Bank ${target} loaded! <span class="count">${presets.length}</span> presets received via MIDI.`);
  } else {
    const activeBank = callbacks.getActiveBank();
    if (!activeBank) return;
    const slot = callbacks.getActivePresetIdx();
    callbacks.onPresetLoaded(activeBank, slot, presets[0]!);
    const slotName = activeBank + String(slot + 1).padStart(2, '0');
    setStatus(`Preset received → <span class="count">${slotName}</span>`);
  }

  midiBuffer = [];
}

function findFreeBank(): BankLetter {
  for (const l of BANK_LETTERS) {
    if (!callbacks?.isBankLoaded(l)) return l;
  }
  return 'A';
}

export function clearMidiBuffer(): void {
  midiBuffer = [];
  setStatus(midiListening && midiInput ? `Buffer cleared. Listening on ${midiInput.name}...` : 'Buffer cleared.');
}

export function getMidiAccess(): MIDIAccess | null { return midiAccess; }
export function isListening(): boolean { return midiListening; }
