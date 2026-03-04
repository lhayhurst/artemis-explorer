import { describe, it, expect } from 'vitest';
import { buildSyx, buildBankSyx } from '../sysex-builder';
import { parseSyx } from '../parser';
import type { ArtemisPreset, BankLetter } from '../types';

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

describe('buildBankSyx', () => {
  const SIXTY_FOUR_PRESETS: ArtemisPreset[] = Array.from({ length: 64 }, (_, i) => ({
    name: `P${i + 1}`,
    base: { play_mode: 'Poly' },
  }));

  function countMessages(out: Uint8Array): number {
    return [...out].filter(b => b === 0xf0).length;
  }

  function nthMessagePayload(out: Uint8Array, n: number): string {
    // find the nth F0..F7 message (0-indexed)
    let found = 0;
    let i = 0;
    while (i < out.length) {
      if (out[i] === 0xf0) {
        let end = i + 1;
        while (end < out.length && out[end] !== 0xf7) end++;
        if (found === n) return new TextDecoder().decode(out.slice(i + DREADBOX_HEADER.length, end));
        found++;
        i = end + 1;
      } else { i++; }
    }
    throw new Error(`Message ${n} not found`);
  }

  it('first message payload is {"BankBackup":0} for bank A', () => {
    const out = buildBankSyx('A', SIXTY_FOUR_PRESETS);
    expect(JSON.parse(nthMessagePayload(out, 0))).toEqual({ BankBackup: 0 });
  });

  it('first message payload is {"BankBackup":7} for bank H', () => {
    const out = buildBankSyx('H', SIXTY_FOUR_PRESETS);
    expect(JSON.parse(nthMessagePayload(out, 0))).toEqual({ BankBackup: 7 });
  });

  it('produces exactly 65 messages for 64 presets', () => {
    const out = buildBankSyx('A', SIXTY_FOUR_PRESETS);
    expect(countMessages(out)).toBe(65);
  });

  it('pads to 64 preset messages when fewer presets provided', () => {
    const out = buildBankSyx('A', [PRESET_A, PRESET_B]);
    expect(countMessages(out)).toBe(65); // 1 header + 64 (2 real + 62 padding)
  });

  it('truncates to 64 preset messages when more than 64 provided', () => {
    const tooMany = Array.from({ length: 70 }, () => PRESET_A);
    const out = buildBankSyx('B', tooMany);
    expect(countMessages(out)).toBe(65);
  });

  it('round-trip: parseSyx recovers bank header object + all 64 preset objects', () => {
    const out = buildBankSyx('C', SIXTY_FOUR_PRESETS);
    const recovered = parseSyx(out.buffer as ArrayBuffer);
    // parseSyx returns all JSON objects including the bank header
    expect(recovered).toHaveLength(65);
    expect(recovered[0]).toEqual({ BankBackup: 2 }); // C = index 2
    expect(recovered[1]).toEqual(SIXTY_FOUR_PRESETS[0]);
    expect(recovered[64]).toEqual(SIXTY_FOUR_PRESETS[63]);
  });

  it('all bank letters map to correct indices', () => {
    const letters: BankLetter[] = ['A','B','C','D','E','F','G','H'];
    letters.forEach((letter, expectedIndex) => {
      const out = buildBankSyx(letter, SIXTY_FOUR_PRESETS);
      const payload = JSON.parse(nthMessagePayload(out, 0)) as { BankBackup: number };
      expect(payload.BankBackup).toBe(expectedIndex);
    });
  });
});
