import { describe, it, expect } from 'vitest';
import { classifyPreset, presetDisplayName } from '../classifier';
import type { ArtemisPreset } from '../types';

function preset(base: ArtemisPreset['base']): ArtemisPreset {
  return { name: 'Test', base };
}

describe('classifyPreset', () => {
  it('returns "Sequence" when sequencer has active steps', () => {
    const p = preset({
      seq: {
        typ: 'Sequencer',
        sequencer: {
          steps: [{ notes: [{ note: 60 }] }, {}, {}],
        },
      },
    });
    expect(classifyPreset(p)).toBe('Sequence');
  });

  it('returns "Arp" when seq type is Arpeggiator', () => {
    const p = preset({ seq: { typ: 'Arpeggiator' } });
    expect(classifyPreset(p)).toBe('Arp');
  });

  it('returns "Sub Bass" for mono, short env, low cutoff, sub presence', () => {
    const p = preset({
      play_mode: 'Mono',
      vca_eg_a: 0.02,
      vca_eg_d: 0.2,
      vca_eg_s: 0.0,
      vca_eg_r: 0.1,
      lpf_cut: 0.1,
      vco_sub_noise: 0.3,
    });
    expect(classifyPreset(p)).toBe('Sub Bass');
  });

  it('returns "Bass" for mono, short env, low cutoff, no sub', () => {
    const p = preset({
      play_mode: 'Mono',
      vca_eg_a: 0.02,
      vca_eg_d: 0.2,
      vca_eg_s: 0.0,
      vca_eg_r: 0.1,
      lpf_cut: 0.3,
    });
    expect(classifyPreset(p)).toBe('Bass');
  });

  it('returns "Aggressive Lead" for mono with heavy distortion', () => {
    // vca_eg_a > 0.1 ensures shortEnv=false, so Bass check doesn't fire first
    const p = preset({
      play_mode: 'Mono',
      vca_eg_a: 0.2,
      distortions: { typ: 'Decimator', mix: 0.5, gain: 0.5 },
    });
    expect(classifyPreset(p)).toBe('Aggressive Lead');
  });

  it('returns "Sync Lead" for mono with sync enabled', () => {
    const p = preset({ play_mode: 'Mono', vco_sync: true, lpf_cut: 0.7 });
    expect(classifyPreset(p)).toBe('Sync Lead');
  });

  it('returns "Sync Lead" for mono with FM', () => {
    const p = preset({ play_mode: 'Mono', vco_fm: 0.3, lpf_cut: 0.7 });
    expect(classifyPreset(p)).toBe('Sync Lead');
  });

  it('returns "Lead" for mono with high cutoff', () => {
    const p = preset({ play_mode: 'Mono', lpf_cut: 0.8 });
    expect(classifyPreset(p)).toBe('Lead');
  });

  it('returns "Mono" for generic mono preset', () => {
    // vca_eg_a > 0.1 ensures shortEnv=false so Bass/Lead don't fire first
    const p = preset({ play_mode: 'Mono', lpf_cut: 0.3, vca_eg_a: 0.2 });
    expect(classifyPreset(p)).toBe('Mono');
  });

  it('returns "Drone" for poly with drone envelope and reverb', () => {
    const p = preset({
      play_mode: 'Poly',
      vca_eg_s: 0.9,
      vca_eg_r: 0.8,
      reverbs: { typ: 'Large', mix: 0.6 },
    });
    expect(classifyPreset(p)).toBe('Drone');
  });

  it('returns "Ambient Pad" for poly with long env, spread, reverb/mod', () => {
    const p = preset({
      play_mode: 'Poly',
      vca_eg_a: 0.5,
      vca_eg_r: 0.5,
      spread: 0.5,
      reverbs: { typ: 'Large', mix: 0.5 },
    });
    expect(classifyPreset(p)).toBe('Ambient Pad');
  });

  it('returns "Evolving Pad" for poly with long env and heavy LFO', () => {
    const p = preset({
      play_mode: 'Poly',
      vca_eg_a: 0.5,
      vca_eg_r: 0.5,
      lfo_1_vco_amount: 0.3,
    });
    expect(classifyPreset(p)).toBe('Evolving Pad');
  });

  it('returns "Pad" for poly with long env', () => {
    const p = preset({
      play_mode: 'Poly',
      vca_eg_a: 0.5,
      vca_eg_r: 0.5,
    });
    expect(classifyPreset(p)).toBe('Pad');
  });

  it('returns "Pluck" for poly with pluck envelope and no FX', () => {
    const p = preset({
      play_mode: 'Poly',
      vca_eg_a: 0.02,
      vca_eg_d: 0.3,
      vca_eg_s: 0.1,
    });
    expect(classifyPreset(p)).toBe('Pluck');
  });

  it('returns "Keys" for poly with pluck envelope and FX', () => {
    const p = preset({
      play_mode: 'Poly',
      vca_eg_a: 0.02,
      vca_eg_d: 0.3,
      vca_eg_s: 0.1,
      reverbs: { typ: 'Small', mix: 0.4 },
    });
    expect(classifyPreset(p)).toBe('Keys');
  });

  it('returns "Stab" for poly with short env and high cutoff', () => {
    // d must be < 0.15 so pluckEnv doesn't fire before shortEnv
    const p = preset({
      play_mode: 'Poly',
      vca_eg_a: 0.02,
      vca_eg_d: 0.1,
      vca_eg_s: 0.0,
      vca_eg_r: 0.1,
      lpf_cut: 0.7,
    });
    expect(classifyPreset(p)).toBe('Stab');
  });

  it('returns "Motion" for poly with heavy LFO', () => {
    // vca_eg_r > 0.25 breaks shortEnv so Keys/Stab don't fire first
    const p = preset({
      play_mode: 'Poly',
      vca_eg_r: 0.5,
      lfo_1_vcf_amount: 0.3,
    });
    expect(classifyPreset(p)).toBe('Motion');
  });

  it('returns "Poly" for generic poly preset', () => {
    // vca_eg_r > 0.25 breaks shortEnv so Keys doesn't fire first
    const p = preset({ play_mode: 'Poly', vca_eg_r: 0.5 });
    expect(classifyPreset(p)).toBe('Poly');
  });

  it('returns "Synth" for unrecognized mode', () => {
    const p = preset({ play_mode: '_3x2' });
    expect(classifyPreset(p)).toBe('Synth');
  });

  it('handles preset with no base gracefully', () => {
    expect(() => classifyPreset({})).not.toThrow();
  });
});

describe('presetDisplayName', () => {
  it('uses preset name when present', () => {
    const p: ArtemisPreset = { name: 'Deep Bass', base: { play_mode: 'Mono', lpf_cut: 0.3 } };
    const result = presetDisplayName(p, 'A', 0);
    expect(result).toBe('Deep Bass (Bass)');
  });

  it('falls back to bank+index when name is null', () => {
    const p: ArtemisPreset = { name: null, base: { play_mode: 'Poly' } };
    const result = presetDisplayName(p, 'B', 4);
    expect(result).toMatch(/^B05 /);
  });

  it('falls back to bank+index when name is missing', () => {
    const p: ArtemisPreset = { base: { play_mode: 'Poly' } };
    const result = presetDisplayName(p, 'C', 11);
    expect(result).toMatch(/^C12 /);
  });

  it('pads index to 2 digits', () => {
    const p: ArtemisPreset = { base: { play_mode: 'Poly' } };
    expect(presetDisplayName(p, 'A', 0)).toMatch(/A01/);
    expect(presetDisplayName(p, 'A', 9)).toMatch(/A10/);
  });
});
