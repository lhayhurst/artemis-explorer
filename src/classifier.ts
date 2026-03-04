import type { ArtemisPreset } from './types';

export function classifyPreset(p: ArtemisPreset): string {
  const b = p.base ?? {};

  // Envelope shape
  const a = b.vca_eg_a ?? 0;
  const d = b.vca_eg_d ?? 0;
  const s = b.vca_eg_s ?? 0;
  const r = b.vca_eg_r ?? 0;
  const longEnv  = a > 0.3 && r > 0.3;
  const shortEnv = a < 0.1 && d < 0.3 && r < 0.25;
  const pluckEnv = a < 0.05 && d > 0.15 && d < 0.7 && s < 0.3;
  const droneEnv = s > 0.8 && r > 0.5;

  // Filter
  const cut = b.lpf_cut ?? 0;

  // Oscillator
  const sub    = b.vco_sub_noise ?? 0;
  const sync   = b.vco_sync ?? false;
  const fm     = b.vco_fm ?? 0;

  // LFO modulation depth
  const lfo1vco   = b.lfo_1_vco_amount ?? 0;
  const lfo1vcf   = b.lfo_1_vcf_amount ?? 0;
  const lfo2morph = b.lfo_2_morph_amount ?? 0;
  const heavyLfo  = Math.abs(lfo1vco) > 0.1 || Math.abs(lfo1vcf) > 0.15 || Math.abs(lfo2morph) > 0.1;

  // Spread / voice mode
  const spread  = b.spread ?? 0;
  const mode    = b.play_mode ?? 'Poly';
  const isMono  = mode === 'Mono' || mode === 'Unison';
  const isPoly  = mode === 'Poly';

  // FX mix levels
  const revMix  = b.reverbs?.mix ?? 0;
  const modMix  = b.modulations?.mix ?? 0;
  const hasFX   = revMix > 0.2 || modMix > 0.2 || (b.delays?.mix ?? 0) > 0.2;

  // Distortion
  const distMix  = b.distortions?.mix ?? 0;
  const distGain = b.distortions?.gain ?? 0;

  // Sequencer / arp
  const seq = b.seq;
  const seqTyp = seq?.typ ?? '';
  const hasSeq = seqTyp === 'Sequencer' &&
    seq?.sequencer?.steps?.some(st => (st.notes?.length ?? 0) > 0) === true;
  const hasArp = seqTyp === 'Arpeggiator';

  // --- Classification ---
  if (hasSeq) return 'Sequence';
  if (hasArp) return 'Arp';

  if (isMono && cut < 0.2 && shortEnv && sub > 0.1) return 'Sub Bass';
  if (isMono && shortEnv && cut < 0.4)              return 'Bass';
  if (isMono && distMix > 0.2 && distGain > 0.2)   return 'Aggressive Lead';
  if (isMono && (sync || fm > 0.1))                 return 'Sync Lead';
  if (isMono && cut > 0.4)                          return 'Lead';
  if (isMono)                                        return 'Mono';

  if (isPoly && droneEnv && revMix > 0.3)                    return 'Drone';
  if (isPoly && longEnv && spread > 0.3 && (revMix > 0.2 || modMix > 0.2)) return 'Ambient Pad';
  if (isPoly && longEnv && heavyLfo)                          return 'Evolving Pad';
  if (isPoly && longEnv)                                      return 'Pad';
  if (isPoly && pluckEnv && !hasFX)                           return 'Pluck';
  if (isPoly && pluckEnv)                                     return 'Keys';
  if (isPoly && shortEnv && cut > 0.5)                        return 'Stab';
  if (isPoly && shortEnv)                                     return 'Keys';
  if (isPoly && heavyLfo)                                     return 'Motion';
  if (isPoly)                                                 return 'Poly';

  return 'Synth';
}

export function presetDisplayName(p: ArtemisPreset, bank: string, idx: number): string {
  const base = p.name ?? (bank + String(idx + 1).padStart(2, '0'));
  const cat = classifyPreset(p);
  return `${base} (${cat})`;
}
