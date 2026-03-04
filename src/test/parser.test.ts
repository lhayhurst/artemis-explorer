import { describe, it, expect } from 'vitest';
import { parseSyx } from '../parser';
import type { ArtemisPreset } from '../types';

// Helper: build a minimal valid Artemis SysEx message around a JSON payload
function makeSyxMessage(json: unknown): Uint8Array {
  const header = [0xf0, 0x00, 0x21, 0x35, 0x00, 0x09];
  const payload = new TextEncoder().encode(JSON.stringify(json));
  return new Uint8Array([...header, ...payload, 0xf7]);
}

function concatMessages(...msgs: Uint8Array[]): ArrayBuffer {
  const total = msgs.reduce((n, m) => n + m.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const m of msgs) { buf.set(m, offset); offset += m.length; }
  return buf.buffer;
}

const MINIMAL_PRESET: ArtemisPreset = {
  name: 'Test',
  base: { play_mode: 'Poly', lpf_cut: 0.5 },
};

describe('parseSyx', () => {
  it('returns empty array for empty buffer', () => {
    expect(parseSyx(new ArrayBuffer(0))).toEqual([]);
  });

  it('returns empty array for buffer with no SysEx messages', () => {
    const buf = new Uint8Array([0x90, 0x40, 0x7f]).buffer;
    expect(parseSyx(buf)).toEqual([]);
  });

  it('parses a single preset message', () => {
    const msg = makeSyxMessage(MINIMAL_PRESET);
    const result = parseSyx(concatMessages(msg));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(MINIMAL_PRESET);
  });

  it('parses multiple preset messages', () => {
    const preset2: ArtemisPreset = { name: 'Second', base: { play_mode: 'Mono' } };
    const buf = concatMessages(makeSyxMessage(MINIMAL_PRESET), makeSyxMessage(preset2));
    const result = parseSyx(buf);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Test');
    expect(result[1]?.name).toBe('Second');
  });

  it('skips non-object SysEx messages (e.g. bank header string)', () => {
    // Bank header is {"BankBackup": 0} — an object, so it IS parsed
    // But a raw string like "PresetBackup" is also valid JSON — it's a string, not an object
    // parseSyx should only return objects (actual presets), not strings/numbers
    const headerMsg = makeSyxMessage('PresetBackup');
    const presetMsg = makeSyxMessage(MINIMAL_PRESET);
    const result = parseSyx(concatMessages(headerMsg, presetMsg));
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Test');
  });

  it('skips messages with invalid JSON payloads', () => {
    const header = [0xf0, 0x00, 0x21, 0x35, 0x00, 0x09];
    const garbage = new TextEncoder().encode('not valid json {{{');
    const badMsg = new Uint8Array([...header, ...garbage, 0xf7]);
    const goodMsg = makeSyxMessage(MINIMAL_PRESET);
    const result = parseSyx(concatMessages(badMsg, goodMsg));
    expect(result).toHaveLength(1);
  });

  it('handles a 65-message bank dump (header + 64 presets)', () => {
    const bankHeader = makeSyxMessage({ BankBackup: 0 });
    const presets = Array.from({ length: 64 }, (_, i) =>
      makeSyxMessage({ name: `P${i + 1}`, base: {} } satisfies ArtemisPreset)
    );
    const buf = concatMessages(bankHeader, ...presets);
    const result = parseSyx(buf);
    // parseSyx returns ALL objects — bank header { BankBackup: 0 } is an object too,
    // so caller is responsible for slicing; parseSyx just extracts all JSON objects
    expect(result.length).toBe(65);
    expect(result[0]).toEqual({ BankBackup: 0 });
    expect(result[1]).toEqual({ name: 'P1', base: {} });
  });

  it('handles messages with garbage bytes between valid SysEx messages', () => {
    const msg1 = makeSyxMessage(MINIMAL_PRESET);
    const msg2 = makeSyxMessage({ name: 'B', base: {} } satisfies ArtemisPreset);
    // Insert random bytes between the two messages
    const garbage = new Uint8Array([0xfe, 0x01, 0x02]);
    const buf = concatMessages(msg1, garbage, msg2);
    const result = parseSyx(buf);
    expect(result).toHaveLength(2);
  });
});
