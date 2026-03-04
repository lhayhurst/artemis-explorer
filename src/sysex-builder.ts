import type { ArtemisPreset } from './types';

const DREADBOX_HEADER = [0xf0, 0x00, 0x21, 0x35, 0x00, 0x09];
const SYSEX_END = 0xf7;

function encodeSyxMessage(json: unknown): Uint8Array {
  const payload = new TextEncoder().encode(JSON.stringify(json));
  return new Uint8Array([...DREADBOX_HEADER, ...payload, SYSEX_END]);
}

/**
 * Wrap an array of presets into Artemis SysEx binary format.
 *
 * Produces a "PresetBackup" header message followed by one message per preset.
 * The result can be saved as a .syx file or sent via Web MIDI.
 */
export function buildSyx(presets: ArtemisPreset[]): Uint8Array {
  const messages = [
    encodeSyxMessage('PresetBackup'),
    ...presets.map(p => encodeSyxMessage(p)),
  ];
  const total = messages.reduce((n, m) => n + m.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const msg of messages) { out.set(msg, offset); offset += msg.length; }
  return out;
}
