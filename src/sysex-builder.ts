import type { ArtemisPreset, BankLetter } from './types';

const DREADBOX_HEADER = [0xf0, 0x00, 0x21, 0x35, 0x00, 0x09];
const SYSEX_END = 0xf7;
const BANK_INDEX: Record<BankLetter, number> = { A:0, B:1, C:2, D:3, E:4, F:5, G:6, H:7 };

function encodeSyxMessage(json: unknown): Uint8Array {
  const payload = new TextEncoder().encode(JSON.stringify(json));
  return new Uint8Array([...DREADBOX_HEADER, ...payload, SYSEX_END]);
}

function concatMessages(messages: Uint8Array[]): Uint8Array {
  const total = messages.reduce((n, m) => n + m.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const msg of messages) { out.set(msg, offset); offset += msg.length; }
  return out;
}

/**
 * Wrap an array of presets into PresetBackup SysEx format (for .syx file export
 * or sending a single preset to Artemis for audition).
 *
 * Format: "PresetBackup" header + one message per preset.
 */
export function buildSyx(presets: ArtemisPreset[]): Uint8Array {
  return concatMessages([
    encodeSyxMessage('PresetBackup'),
    ...presets.map(p => encodeSyxMessage(p)),
  ]);
}

/**
 * Build a BankBackup SysEx dump for sending a full bank to Artemis.
 *
 * Format: {"BankBackup": N} header + exactly 64 preset messages.
 * Pads with empty presets if fewer than 64 are provided; truncates if more.
 * Artemis will show a prompt to choose which bank slot to load into.
 */
export function buildBankSyx(bankLetter: BankLetter, presets: ArtemisPreset[]): Uint8Array {
  const padded: ArtemisPreset[] = presets.slice(0, 64);
  while (padded.length < 64) padded.push({});
  return concatMessages([
    encodeSyxMessage({ BankBackup: BANK_INDEX[bankLetter] }),
    ...padded.map(p => encodeSyxMessage(p)),
  ]);
}

/**
 * Split a concatenated SysEx binary into individual F0..F7 messages.
 * Used when sending — Web MIDI send() expects one message at a time.
 */
export function splitSyxMessages(buf: Uint8Array): Uint8Array[] {
  const messages: Uint8Array[] = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] !== 0xf0) { i++; continue; }
    let end = i + 1;
    while (end < buf.length && buf[end] !== SYSEX_END) end++;
    messages.push(buf.slice(i, end + 1));
    i = end + 1;
  }
  return messages;
}
