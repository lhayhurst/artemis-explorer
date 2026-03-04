import type { ArtemisPreset } from './types';

const SYSEX_START = 0xf0;
const SYSEX_END = 0xf7;
const DREADBOX_HEADER_LEN = 6; // F0 00 21 35 00 09

/**
 * Extract all JSON objects from an Artemis SysEx binary buffer.
 *
 * Each SysEx message has the form:
 *   F0 00 21 35 00 09 [UTF-8 JSON] F7
 *
 * Returns only messages whose JSON payload is a plain object (i.e. actual
 * presets or bank headers). Strings (e.g. "PresetBackup") and invalid JSON
 * are silently skipped.
 *
 * Callers are responsible for interpreting the first message if it is a bank
 * header ({ BankBackup: N }) and slicing appropriately.
 */
export function parseSyx(buffer: ArrayBuffer): ArtemisPreset[] {
  const bytes = new Uint8Array(buffer);
  const results: ArtemisPreset[] = [];

  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] !== SYSEX_START) { i++; continue; }

    let end = i + 1;
    while (end < bytes.length && bytes[end] !== SYSEX_END) end++;

    const payloadStart = i + DREADBOX_HEADER_LEN;
    if (payloadStart < end) {
      const payload = bytes.slice(payloadStart, end);
      const text = new TextDecoder().decode(payload);
      if (text.startsWith('{')) {
        try {
          results.push(JSON.parse(text) as ArtemisPreset);
        } catch {
          // malformed JSON — skip silently
        }
      }
    }

    i = end + 1;
  }

  return results;
}
