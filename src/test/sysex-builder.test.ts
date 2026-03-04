import { describe, it, expect } from 'vitest';
import { buildSyx } from '../sysex-builder';
import { parseSyx } from '../parser';
import type { ArtemisPreset } from '../types';

const DREADBOX_HEADER = [0xf0, 0x00, 0x21, 0x35, 0x00, 0x09];

const PRESET_A: ArtemisPreset = { name: 'Alpha', base: { play_mode: 'Poly', lpf_cut: 0.5 } };
const PRESET_B: ArtemisPreset = { name: 'Beta',  base: { play_mode: 'Mono', lpf_cut: 0.3 } };

function firstMessagePayload(out: Uint8Array): string {
  const end = out.indexOf(0xf7);
  return new TextDecoder().decode(out.slice(DREADBOX_HEADER.length, end));
}

describe('buildSyx', () => {
  it('output starts with Dreadbox SysEx header on first message', () => {
    const out = buildSyx([PRESET_A]);
    for (let i = 0; i < DREADBOX_HEADER.length; i++) {
      expect(out[i]).toBe(DREADBOX_HEADER[i]);
    }
  });

  it('first message payload is "PresetBackup" header string', () => {
    const out = buildSyx([PRESET_A]);
    expect(firstMessagePayload(out)).toBe('"PresetBackup"');
  });

  it('output ends with SysEx end byte (0xF7)', () => {
    const out = buildSyx([PRESET_A]);
    expect(out[out.length - 1]).toBe(0xf7);
  });

  it('buildSyx([]) produces only the header message', () => {
    const out = buildSyx([]);
    // Should be exactly one SysEx message
    const f0Count = [...out].filter(b => b === 0xf0).length;
    const f7Count = [...out].filter(b => b === 0xf7).length;
    expect(f0Count).toBe(1);
    expect(f7Count).toBe(1);
    expect(firstMessagePayload(out)).toBe('"PresetBackup"');
  });

  it('produces one SysEx message per preset plus the header', () => {
    const out = buildSyx([PRESET_A, PRESET_B]);
    const f0Count = [...out].filter(b => b === 0xf0).length;
    expect(f0Count).toBe(3); // header + 2 presets
  });

  it('round-trips: parseSyx(buildSyx([preset]).buffer) recovers the preset', () => {
    const out = buildSyx([PRESET_A]);
    const recovered = parseSyx(out.buffer as ArrayBuffer);
    // parseSyx skips non-object messages ("PresetBackup" is a string, not an object)
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toEqual(PRESET_A);
  });

  it('round-trips multiple presets in order', () => {
    const presets = [PRESET_A, PRESET_B];
    const out = buildSyx(presets);
    const recovered = parseSyx(out.buffer as ArrayBuffer);
    expect(recovered).toHaveLength(2);
    expect(recovered[0]).toEqual(PRESET_A);
    expect(recovered[1]).toEqual(PRESET_B);
  });
});
