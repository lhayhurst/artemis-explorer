// Artemis SysEx preset types
// JSON payload format: F0 00 21 35 00 09 [UTF-8 JSON] F7

export interface FxBlock {
  typ: string;
  mix: number;
  gain?: number;
  // algorithm-specific sub-objects keyed by camelCase algorithm name
  [key: string]: unknown;
}

export interface SequencerStep {
  notes?: Array<{ note: number; velocity?: number }>;
  tied?: boolean;
}

export interface SequencerData {
  length?: number;
  divisions?: number;
  gate?: number;
  steps?: SequencerStep[];
}

export interface ArpeggiatorData {
  [key: string]: unknown;
}

export interface SeqBlock {
  typ: 'Sequencer' | 'Arpeggiator' | string;
  sequencer?: SequencerData;
  arpeggiator?: ArpeggiatorData;
}

export interface PresetBase {
  // VCO
  vco_morph?: number;
  vco_mix?: number;
  vco_sub_noise?: number;
  vco_sync?: boolean;
  vco_2_tune?: number;
  vco_detune?: number;
  vco_glide?: number;
  vco_pw?: number;
  vco_fm?: number;
  vco_fm_eg?: number;
  // VCF LP
  lpf_cut?: number;
  lpf_reson?: number;
  lpf_poles?: boolean;
  lpf_track?: number;
  lpf_cut_eg_amount?: number;
  lpf_ffm?: number;
  lpf_ffm_noise_source?: boolean;
  // VCF HP
  hpf_cut?: number;
  hpf_reson?: number;
  // Amplitude Envelope
  vca_eg_a?: number;
  vca_eg_d?: number;
  vca_eg_s?: number;
  vca_eg_r?: number;
  // Filter/FM Envelope
  eg_a?: number;
  eg_d?: number;
  eg_s?: number;
  eg_r?: number;
  // LFO 1
  lfo_1_rate?: number;
  lfo_1_fade?: number;
  lfo_1_wave?: string;
  lfo_1_vco_target?: string;
  lfo_1_vco_amount?: number;
  lfo_1_vcf_amount?: number;
  // LFO 2
  lfo_2_rate?: number;
  lfo_2_xmod?: number;
  lfo_2_wave?: string;
  lfo_2_sync_mode?: string;
  lfo_2_morph_amount?: number;
  lfo_2_vco_1_pw_amount?: number;
  // Global
  play_mode?: 'Poly' | 'Mono' | 'Unison' | '_3x2' | '_2x3';
  legato?: boolean;
  glide?: number;
  drive_mode?: string;
  spread?: number;
  level?: number;
  bpm?: number;
  instability_depth?: number;
  amp_velocity?: number;
  // FX
  distortions?: FxBlock;
  modulations?: FxBlock;
  delays?: FxBlock;
  reverbs?: FxBlock;
  // Sequencer / Arpeggiator
  seq?: SeqBlock;
}

export interface ModMatrix {
  [section: string]: { [param: string]: number } | number;
}

export interface ArtemisPreset {
  name?: string | null;
  base?: PresetBase;
  mod_wheel?: ModMatrix;
  velocity?: ModMatrix;
  aftertouch?: ModMatrix;
  cc_74?: ModMatrix;
  key_track?: ModMatrix;
}

export type BankLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type BankSource = 'factory' | 'user';
export type ViewName = 'detail' | 'table' | 'compare';
export type ModSource = 'mod_wheel' | 'velocity' | 'aftertouch' | 'cc_74' | 'key_track';
