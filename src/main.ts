import { parseSyx } from './parser';
import { classifyPreset, presetDisplayName } from './classifier';
import { buildSyx } from './sysex-builder';
import {
  initMidi, initMidiCallbacks, toggleListen, clearMidiBuffer,
  populateMidiPorts, isListening, selectOutputPort, sendPreset, sendBank, updateMidiDots,
} from './midi';
import type { ArtemisPreset, BankLetter, BankSource, ViewName, ModSource } from './types';
// JSZip is loaded from CDN via index.html script tag
declare const JSZip: any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const BANKS: Partial<Record<BankLetter, ArtemisPreset[]>> = {};
const BANK_SOURCE: Partial<Record<BankLetter, BankSource>> = {};
const BANK_LETTERS: BankLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

let activeBank: BankLetter | null = null;
let activePresetIdx = 0;
let currentView: ViewName = 'detail';
let compareSelection: number[] = [];
let sortCol: number | null = null;
let sortDir = 1;
let filterMode: string | null = null;
let activeModTab: ModSource = 'mod_wheel';
let editMode = false;
const DIRTY_BANKS = new Set<BankLetter>();
const DIRTY_PRESETS = new Set<string>(); // keys: "A:3"
function clearDirtyBank(letter: BankLetter): void {
  DIRTY_BANKS.delete(letter);
  for (const k of DIRTY_PRESETS) { if (k.startsWith(`${letter}:`)) DIRTY_PRESETS.delete(k); }
}

// ---------------------------------------------------------------------------
// Constants / lookup tables
// ---------------------------------------------------------------------------
const MODES: Record<string, string> = {
  Poly: 'POLY', Mono: 'MONO', Unison: 'UNI', _3x2: 'TRI', _2x3: 'DUO',
};

const SECTIONS = [
  { id: 'vco', t: 'VCO — Oscillators',   c: 'var(--c-vco)',    k: ['vco_morph','vco_mix','vco_sub_noise','vco_sync','vco_2_tune','vco_detune','vco_glide','vco_pw','vco_fm','vco_fm_eg'] },
  { id: 'lpf', t: 'VCF — Low Pass',       c: 'var(--c-vcf)',    k: ['lpf_cut','lpf_reson','lpf_poles','lpf_track','lpf_cut_eg_amount','lpf_ffm','lpf_ffm_noise_source'] },
  { id: 'hpf', t: 'VCF — High Pass',      c: 'var(--c-vcf)',    k: ['hpf_cut','hpf_reson'] },
  { id: 'vca', t: 'Env — Amplitude',      c: 'var(--c-env)',    k: ['vca_eg_a','vca_eg_d','vca_eg_s','vca_eg_r'] },
  { id: 'eg',  t: 'Env — Filter/FM',      c: 'var(--c-env)',    k: ['eg_a','eg_d','eg_s','eg_r'] },
  { id: 'lfo1',t: 'LFO 1',               c: 'var(--c-lfo)',    k: ['lfo_1_rate','lfo_1_fade','lfo_1_wave','lfo_1_vco_target','lfo_1_vco_amount','lfo_1_vcf_amount'] },
  { id: 'lfo2',t: 'LFO 2',               c: 'var(--c-lfo)',    k: ['lfo_2_rate','lfo_2_xmod','lfo_2_wave','lfo_2_sync_mode','lfo_2_morph_amount','lfo_2_vco_1_pw_amount'] },
  { id: 'gl',  t: 'Global',              c: 'var(--c-global)', k: ['play_mode','legato','glide','drive_mode','spread','level','bpm','instability_depth','amp_velocity'] },
];

const FX_SECTIONS = [
  { id: 'distortions', t: 'FX — Distortion', c: 'var(--c-fx)' },
  { id: 'modulations', t: 'FX — Modulation', c: 'var(--c-fx)' },
  { id: 'delays',      t: 'FX — Delay',      c: 'var(--c-fx)' },
  { id: 'reverbs',     t: 'FX — Reverb',     c: 'var(--c-fx)' },
];

const ALGO_MAP: Record<string, string> = {
  Chorus:'chorus', Ensemble:'ensemble', TapeChorus:'tape_chorus', BBDChorus:'bbd_chorus',
  Flanger:'flanger', BBDFlanger:'bbd_flanger', ThroughZeroFlanger:'through_zero_flanger',
  Phaser:'phaser', BarberPolePhaser:'barber_pole_phaser', DoubleNotch:'double_notch',
  PitchShifter:'pitch_shifter', Stereo:'stereo', PingPong:'ping_pong', BBDDelay:'bbd',
  RandomRepeater:'random_repeater', Small:'small', Large:'large', Huge:'huge',
  Shimmer:'shimmer', Granular:'granular', Cloud:'granular',
};

const NAMES: Record<string, string> = {
  vco_morph:'Wave/Morph', vco_mix:'VCO Mix', vco_sub_noise:'Sub/Noise', vco_sync:'Sync',
  vco_2_tune:'VCO2 Tune', vco_detune:'Detune', vco_glide:'Glide', vco_pw:'Pulse Width',
  vco_fm:'FM Amount', vco_fm_eg:'FM→Env', lpf_cut:'Cutoff', lpf_reson:'Resonance',
  lpf_poles:'12dB', lpf_track:'Key Track', lpf_cut_eg_amount:'Env Amount', lpf_ffm:'Filter FM',
  lpf_ffm_noise_source:'FFM Noise', hpf_cut:'Cutoff', hpf_reson:'Resonance',
  vca_eg_a:'Attack', vca_eg_d:'Decay', vca_eg_s:'Sustain', vca_eg_r:'Release',
  eg_a:'Attack', eg_d:'Decay', eg_s:'Sustain', eg_r:'Release',
  lfo_1_rate:'Rate', lfo_1_fade:'Fade In', lfo_1_wave:'Wave', lfo_1_vco_target:'VCO Target',
  lfo_1_vco_amount:'VCO Amt', lfo_1_vcf_amount:'VCF Amt', lfo_2_rate:'Rate', lfo_2_xmod:'X-Mod',
  lfo_2_wave:'Wave', lfo_2_sync_mode:'Sync', lfo_2_morph_amount:'Wave Amt', lfo_2_vco_1_pw_amount:'PW Amt',
  play_mode:'Play Mode', legato:'Legato', glide:'Glide', drive_mode:'Drive', spread:'Spread',
  level:'Level', bpm:'BPM', instability_depth:'Instability', amp_velocity:'Amp Vel',
  typ:'Algorithm', mix:'Mix', gain:'Gain', decimator_frequency:'Rate', decimator_bitcrush:'Bits',
  depth:'Depth', feedback:'Feedback', speed:'Speed', width:'Width', time:'Time',
  left_time:'L Time', right_time:'R Time', damping:'Damping', pan:'Pan',
  mod_frequency:'Mod Freq', mod_depth:'Mod Depth', phase_shift:'Phase', notch:'Notch',
  pitch_left:'Pitch L', pitch_right:'Pitch R', pre_delay:'Pre-Delay', size:'Size',
  decay:'Decay', pitch:'Pitch', grains:'Grains', grain_size:'Grain Size', detune:'Detune',
  length:'Length', envelope:'Envelope', repeats:'Repeats', probability:'Prob', bpm_sync:'BPM Sync',
};

const MOD_SOURCES: ModSource[] = ['mod_wheel', 'velocity', 'aftertouch', 'cc_74', 'key_track'];
const MOD_LABELS: Record<ModSource, string> = {
  mod_wheel: 'Mod Wheel', velocity: 'Velocity', aftertouch: 'Aftertouch', cc_74: 'CC74', key_track: 'Key Track',
};

const BOOLEAN_PARAMS = new Set([
  'vco_sync', 'lpf_poles', 'lpf_ffm_noise_source', 'legato',
]);
const ENUM_PARAMS = new Set([
  'play_mode', 'drive_mode', 'lfo_1_wave', 'lfo_1_vco_target',
  'lfo_2_wave', 'lfo_2_sync_mode',
]);
const KNOWN_ENUM_VALUES: Record<string, string[]> = {
  play_mode: ['Poly', 'Mono', 'Unison', '_3x2', '_2x3'],
};

function getEnumOptions(key: string): string[] {
  if (KNOWN_ENUM_VALUES[key]) return KNOWN_ENUM_VALUES[key]!;
  const seen = new Set<string>();
  for (const l of BANK_LETTERS) {
    for (const p of BANKS[l] ?? []) {
      const v = (p.base as Record<string, unknown> | undefined)?.[key];
      if (typeof v === 'string') seen.add(v);
    }
  }
  return [...seen].sort();
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const EMPTY_SVG = '<svg width="80" height="80" viewBox="0 0 80 80" fill="none"><path d="M40 8L12 68h56L40 8z" stroke="#fff" stroke-width="1" fill="none"/><circle cx="40" cy="32" r="2" fill="#fff"/><circle cx="30" cy="52" r="1.5" fill="#fff"/><circle cx="50" cy="52" r="1.5" fill="#fff"/><line x1="40" y1="32" x2="30" y2="52" stroke="#fff" stroke-width=".5"/><line x1="40" y1="32" x2="50" y2="52" stroke="#fff" stroke-width=".5"/><line x1="30" y1="52" x2="50" y2="52" stroke="#fff" stroke-width=".5"/></svg>';

// ---------------------------------------------------------------------------
// Table column definitions
// ---------------------------------------------------------------------------
const TABLE_COLS = [
  { k: '_num',   l: '#',       fn: (_: ArtemisPreset, i: number) => String(i + 1).padStart(2, '0'), num: false },
  { k: '_name',  l: 'Name',    fn: (p: ArtemisPreset, i: number) => presetDisplayName(p, activeBank ?? 'A', i), num: false },
  { k: 'play_mode', l: 'Mode', fn: (p: ArtemisPreset) => MODES[(p.base?.play_mode ?? '')] ?? (p.base?.play_mode ?? ''), num: false },
  { k: 'vco_morph', l: 'Wave', fn: (p: ArtemisPreset) => p.base?.vco_morph, num: true },
  { k: 'vco_pw',    l: 'PW',   fn: (p: ArtemisPreset) => p.base?.vco_pw, num: true },
  { k: 'lpf_cut',   l: 'Cut',  fn: (p: ArtemisPreset) => p.base?.lpf_cut, num: true },
  { k: 'lpf_reson', l: 'Res',  fn: (p: ArtemisPreset) => p.base?.lpf_reson, num: true },
  { k: 'lpf_cut_eg_amount', l: 'Env→Cut', fn: (p: ArtemisPreset) => p.base?.lpf_cut_eg_amount, num: true },
  { k: 'vca_eg_a', l: 'VCA A', fn: (p: ArtemisPreset) => p.base?.vca_eg_a, num: true },
  { k: 'vca_eg_d', l: 'VCA D', fn: (p: ArtemisPreset) => p.base?.vca_eg_d, num: true },
  { k: 'vca_eg_s', l: 'VCA S', fn: (p: ArtemisPreset) => p.base?.vca_eg_s, num: true },
  { k: 'vca_eg_r', l: 'VCA R', fn: (p: ArtemisPreset) => p.base?.vca_eg_r, num: true },
  { k: 'dist_t', l: 'Dist',   fn: (p: ArtemisPreset) => p.base?.distortions?.typ ?? '—', num: false },
  { k: 'dist_m', l: 'D.Mix',  fn: (p: ArtemisPreset) => p.base?.distortions?.mix, num: true },
  { k: 'mod_t',  l: 'Mod',    fn: (p: ArtemisPreset) => p.base?.modulations?.typ ?? '—', num: false },
  { k: 'mod_m',  l: 'M.Mix',  fn: (p: ArtemisPreset) => p.base?.modulations?.mix, num: true },
  { k: 'del_t',  l: 'Delay',  fn: (p: ArtemisPreset) => p.base?.delays?.typ ?? '—', num: false },
  { k: 'del_m',  l: 'Dl.Mix', fn: (p: ArtemisPreset) => p.base?.delays?.mix, num: true },
  { k: 'rev_t',  l: 'Reverb', fn: (p: ArtemisPreset) => p.base?.reverbs?.typ ?? '—', num: false },
  { k: 'rev_m',  l: 'R.Mix',  fn: (p: ArtemisPreset) => p.base?.reverbs?.mix, num: true },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmt(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : (v * 100).toFixed(1) + '%';
  return String(v);
}
function isZero(v: unknown): boolean {
  return (typeof v === 'number' && Math.abs(v) < 0.001) || v === false || v === 'Off';
}
function pct(v: unknown): number {
  return typeof v === 'number' ? Math.min(Math.abs(v) * 100, 100) : 0;
}
function midiNote(n: number): string {
  const ns = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return (ns[n % 12] ?? '') + (Math.floor(n / 12) - 1);
}

function paramRow(key: string, val: unknown, color: string): string {
  const name = NAMES[key] ?? key.replace(/_/g, ' ');
  if (editMode) {
    let control: string;
    if (BOOLEAN_PARAMS.has(key)) {
      const bval = !!val;
      control = `<button class="toggle-btn${bval ? ' on' : ''}" onclick="setParam('${key}','${!bval}')">${bval ? 'ON' : 'OFF'}</button>`;
    } else if (ENUM_PARAMS.has(key)) {
      const opts = getEnumOptions(key)
        .map(o => `<option value="${escHtml(o)}"${o === val ? ' selected' : ''}>${escHtml(o)}</option>`)
        .join('');
      control = `<select class="param-select" onchange="setParam('${key}',this.value)">${opts}</select>`;
    } else if (key === 'bpm') {
      control = `<input type="number" class="param-num" min="60" max="300" step="1" value="${Math.round(Number(val ?? 120))}" oninput="setParam('${key}',this.value)">`;
    } else if (key === 'vco_2_tune') {
      control = `<input type="number" class="param-num" min="-24" max="24" step="1" value="${Math.round(Number(val ?? 0))}" oninput="setParam('${key}',this.value)">`;
    } else {
      control = `<input type="range" class="param-slider" min="0" max="1" step="0.001" value="${Number(val ?? 0).toFixed(3)}" oninput="setParam('${key}',this.value)">`;
    }
    return `<div class="pr"><div class="pr-n">${name}</div>${control}<div class="pr-v" id="pv-${key}">${fmt(val)}</div></div>`;
  }
  const f = fmt(val);
  const isNum = typeof val === 'number';
  const cls = typeof val === 'string' ? 'str' : (val === true ? 'on' : (isZero(val) ? 'zero' : ''));
  const bar = isNum ? `<div class="pr-bar"><div class="pr-fill" style="width:${pct(val)}%;background:${color}"></div></div>` : '';
  return `<div class="pr"><div class="pr-n">${name}</div>${bar}<div class="pr-v ${cls}">${f}</div></div>`;
}

// ---------------------------------------------------------------------------
// Bank tabs
// ---------------------------------------------------------------------------
function renderBankTabs(): void {
  const el = document.getElementById('bankTabs');
  if (!el) return;
  el.innerHTML = BANK_LETTERS.map(l => {
    const loaded = !!BANKS[l], src = BANK_SOURCE[l];
    const isDirty = DIRTY_BANKS.has(l);
    const badge = isDirty
      ? `<span class="src-badge dirty">●</span>`
      : src ? `<span class="src-badge ${src}">${src === 'factory' ? 'F' : 'U'}</span>`
      : '';
    return `<div class="bank-tab ${l === activeBank ? 'active' : ''} ${loaded ? 'loaded' : ''} ${src ?? ''}" onclick="switchBank('${l}')">${l}${badge}</div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Bank / preset switching
// ---------------------------------------------------------------------------
function switchBank(letter: BankLetter): void {
  editMode = false;
  activeBank = letter;
  activePresetIdx = 0;
  compareSelection = [];
  filterMode = null;
  sortCol = null;
  sortDir = 1;
  renderBankTabs();
  renderSidebar();
  renderView();
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function renderSidebar(): void {
  const list = document.getElementById('presetList');
  if (!list) return;
  if (!activeBank || !BANKS[activeBank]) { list.innerHTML = ''; return; }
  const presets = BANKS[activeBank]!;
  const query = (document.getElementById('search') as HTMLInputElement | null)?.value.toLowerCase() ?? '';
  list.innerHTML = presets.map((p, i) => {
    const b = p.base ?? {};
    const name = presetDisplayName(p, activeBank!, i);
    const mode = MODES[b.play_mode ?? ''] ?? b.play_mode ?? '?';
    if (query && !name.toLowerCase().includes(query) && !mode.toLowerCase().includes(query)) return '';
    const isActive = i === activePresetIdx;
    const isCompare = compareSelection.includes(i);
    const isDirtyPreset = DIRTY_PRESETS.has(`${activeBank}:${i}`);
    const bars = [b.lpf_cut ?? 0, b.lpf_reson ?? 0, b.vca_eg_a ?? 0, b.vca_eg_r ?? 0];
    const miniHtml = '<div class="preset-mini-bars">' +
      bars.map(v => `<div class="preset-mini-bar" style="height:${Math.max(2, v * 14)}px;background:${v > 0.5 ? '#fff' : '#333'}"></div>`).join('') +
      '</div>';
    const dirtyDot = isDirtyPreset ? '<span class="preset-dirty">●</span>' : '';
    return `<div class="preset-item ${isActive ? 'active' : ''} ${isCompare ? 'compare-selected' : ''}" onclick="selectPreset(${i})" oncontextmenu="toggleCompare(event,${i})"><div class="preset-num">${String(i + 1).padStart(2, '0')}</div><div class="preset-label">${name}${dirtyDot}</div>${miniHtml}<div class="preset-mode-badge">${mode}</div></div>`;
  }).join('');
}

function filterList(): void { renderSidebar(); }

function selectPreset(i: number): void {
  editMode = false;
  activePresetIdx = i;
  renderSidebar();
  if (currentView === 'detail') renderDetail();
  else document.querySelectorAll('table.data tr').forEach((tr, idx) => {
    if (idx > 0) tr.classList.toggle('active', idx - 1 === i);
  });
}

function toggleCompare(e: MouseEvent, i: number): void {
  e.preventDefault();
  const idx = compareSelection.indexOf(i);
  if (idx >= 0) compareSelection.splice(idx, 1);
  else if (compareSelection.length < 3) compareSelection.push(i);
  renderSidebar();
  if (currentView === 'compare') renderCompare();
}

// ---------------------------------------------------------------------------
// View routing
// ---------------------------------------------------------------------------
function switchView(v: ViewName): void {
  currentView = v;
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('active', (t as HTMLElement).dataset['view'] === v);
  });
  renderView();
}

function renderView(): void {
  const area = document.getElementById('contentArea');
  if (!area) return;
  if (!activeBank || !BANKS[activeBank]) {
    area.innerHTML = `<div class="empty-state">${EMPTY_SVG}<h3>No bank loaded</h3><p>Click "Load .syx" to import your own bank, "Load Factory" to fetch the factory default for Bank ${activeBank ?? '?'}, or drag and drop a .syx file onto this window.</p></div>`;
    return;
  }
  if (currentView === 'detail') renderDetail();
  else if (currentView === 'table') renderTable();
  else renderCompare();
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------
function renderDetail(): void {
  const area = document.getElementById('contentArea');
  if (!area || !activeBank) return;
  const p = BANKS[activeBank]?.[activePresetIdx];
  if (!p) return;
  const b = p.base ?? {};
  const name = presetDisplayName(p, activeBank, activePresetIdx);
  const mode = MODES[b.play_mode ?? ''] ?? b.play_mode ?? '';

  const editBtn = `<button class="edit-btn${editMode ? ' active' : ''}" onclick="toggleEditMode()">${editMode ? 'Done' : '✎ Edit'}</button>`;
  const titleHtml = editMode
    ? `<input class="detail-name-input" type="text" value="${escHtml(p.name ?? '')}" placeholder="Preset name" oninput="setPresetName(this.value)">`
    : `<div class="detail-title">${name}</div>`;
  let html = `<div class="detail-header"><div class="detail-header-row">${titleHtml}${editBtn}</div><div class="detail-subtitle" id="detailSubtitle">${mode} · BPM ${(b.bpm ?? 120).toFixed(0)} · Drive: ${b.drive_mode ?? 'Off'} · Right-click presets in sidebar to compare</div></div><div class="detail-grid">`;

  for (const s of SECTIONS) {
    let rows = '';
    for (const k of s.k) {
      const val = (b as Record<string, unknown>)[k];
      if (val !== undefined) rows += paramRow(k, val, s.c);
    }
    const cnt = s.k.filter(k => (b as Record<string, unknown>)[k] !== undefined).length;
    html += `<div class="card"><div class="card-head open" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><div class="card-dot" style="background:${s.c}"></div><div class="card-title">${s.t}</div><div class="card-count">${cnt}</div><div class="card-chevron">▶</div></div><div class="card-body open">${rows}</div></div>`;
  }

  for (const fx of FX_SECTIONS) {
    const d = (b as Record<string, unknown>)[fx.id] as Record<string, unknown> | undefined;
    if (!d) continue;
    let rows = paramRow('typ', d['typ'], fx.c) + paramRow('mix', d['mix'], fx.c);
    for (const [k, v] of Object.entries(d)) {
      if (['typ', 'mix'].includes(k) || typeof v === 'object') continue;
      rows += paramRow(k, v, fx.c);
    }
    const algoKey = ALGO_MAP[String(d['typ'] ?? '')] ?? '';
    const algoBlock = algoKey ? d[algoKey] : undefined;
    if (algoBlock && typeof algoBlock === 'object') {
      for (const [k, v] of Object.entries(algoBlock as Record<string, unknown>)) rows += paramRow(k, v, fx.c);
    }
    html += `<div class="card"><div class="card-head open" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><div class="card-dot" style="background:${fx.c}"></div><div class="card-title">${fx.t}</div><div class="card-chevron">▶</div></div><div class="card-body open">${rows}</div></div>`;
  }

  if (b.seq) {
    const seq = b.seq;
    let rows = paramRow('typ', seq.typ, 'var(--c-seq)');
    if (seq.arpeggiator) {
      for (const [k, v] of Object.entries(seq.arpeggiator)) rows += paramRow(k, v, 'var(--c-seq)');
    }
    if (seq.sequencer) {
      const sq = seq.sequencer;
      if (sq.length !== undefined) rows += paramRow('length', sq.length, 'var(--c-seq)');
      if (sq.divisions !== undefined) rows += paramRow('divisions', sq.divisions, 'var(--c-seq)');
      if (sq.gate !== undefined) rows += paramRow('gate', sq.gate, 'var(--c-seq)');
      if (sq.steps) {
        let sg = '<div class="seq-grid">';
        const len = sq.length ?? 64;
        sq.steps.slice(0, len).forEach((st, i) => {
          const on = (st.notes?.length ?? 0) > 0;
          const notes = on ? (st.notes ?? []).map(n => midiNote(n.note)).join(' ') : '—';
          sg += `<div class="sq ${on ? 'on' : ''} ${st.tied ? 'tie' : ''}"><div class="sq-n">${i + 1}</div>${notes}${st.tied ? ' TIE' : ''}</div>`;
        });
        sg += '</div>';
        rows += sg;
      }
    }
    html += `<div class="card"><div class="card-head open" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><div class="card-dot" style="background:var(--c-seq)"></div><div class="card-title">Seq / Arp</div><div class="card-chevron">▶</div></div><div class="card-body open">${rows}</div></div>`;
  }

  html += '</div>';
  html += '<div class="mod-section"><div class="mod-title">Modulation Matrix</div><div class="mod-tabs">';
  for (const src of MOD_SOURCES) {
    const modData = p[src];
    if (!modData) continue;
    const has = hasModData(modData);
    html += `<div class="mod-tab ${src === activeModTab ? 'active' : ''}" onclick="setModTab('${src}')">${MOD_LABELS[src]}${has ? '<span class="dot"></span>' : ''}</div>`;
  }
  html += '</div>';
  const currentMod = p[activeModTab];
  if (currentMod) html += renderModGrid(currentMod);
  html += '</div>';
  area.innerHTML = html;
}

function hasModData(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v === 'object' && v !== null) {
      for (const v2 of Object.values(v as Record<string, unknown>)) {
        if (typeof v2 === 'number' && Math.abs(v2) > 0.001) return true;
      }
    } else if (typeof v === 'number' && Math.abs(v) > 0.001) return true;
  }
  return false;
}

function renderModGrid(mod: unknown): string {
  if (typeof mod !== 'object' || mod === null) return '';
  let html = '<div class="mod-grid">';
  for (const [k, v] of Object.entries(mod as Record<string, unknown>)) {
    if (typeof v === 'object' && v !== null) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (typeof v2 !== 'number') continue;
        const has = Math.abs(v2) > 0.001;
        const f = v2 === 0 ? '0' : (v2 > 0 ? '+' : '') + (v2 * 100).toFixed(1) + '%';
        html += `<div class="mg-row ${has ? 'has' : ''}"><div class="mg-n">${(k + '.' + k2).replace(/_/g, ' ')}</div><div class="mg-v">${f}</div></div>`;
      }
    } else if (typeof v === 'number') {
      const has = Math.abs(v) > 0.001;
      const f = v === 0 ? '0' : (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
      html += `<div class="mg-row ${has ? 'has' : ''}"><div class="mg-n">${k.replace(/_/g, ' ')}</div><div class="mg-v">${f}</div></div>`;
    }
  }
  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------
function renderTable(): void {
  const area = document.getElementById('contentArea');
  if (!area || !activeBank || !BANKS[activeBank]) return;
  const presets = BANKS[activeBank]!;
  const modes = [...new Set(presets.map(p => p.base?.play_mode).filter(Boolean))];

  let html = `<div class="filter-row"><div class="filter-chip ${!filterMode ? 'active' : ''}" onclick="setFilter(null)">ALL</div>`;
  for (const m of modes) {
    if (!m) continue;
    html += `<div class="filter-chip ${filterMode === m ? 'active' : ''}" onclick="setFilter('${m}')">${MODES[m] ?? m}</div>`;
  }
  html += '</div>';

  let filtered = presets.map((p, i) => ({ p, i }));
  if (filterMode) filtered = filtered.filter(({ p }) => p.base?.play_mode === filterMode);

  if (sortCol !== null) {
    const col = TABLE_COLS[sortCol];
    if (col) {
      filtered.sort((a, b) => {
        const va = col.fn(a.p, a.i);
        const vb = col.fn(b.p, b.i);
        if (col.num) return (((va as number) ?? 0) - ((vb as number) ?? 0)) * sortDir;
        return String(va ?? '').localeCompare(String(vb ?? '')) * sortDir;
      });
    }
  }

  html += '<div class="table-wrap"><table class="data"><thead><tr>';
  TABLE_COLS.forEach((c, ci) => {
    html += `<th class="${sortCol === ci ? 'sorted' : ''}" onclick="sortTable(${ci})">${c.l}${sortCol === ci ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (const { p, i } of filtered) {
    html += `<tr class="${i === activePresetIdx ? 'active' : ''}" onclick="selectPreset(${i})">`;
    for (const col of TABLE_COLS) {
      const v = col.fn(p, i);
      if (col.num && typeof v === 'number') {
        const p100 = (v * 100).toFixed(0);
        html += `<td>${p100}%<div class="td-bar" style="width:${Math.min(v * 40, 40)}px;background:#fff"></div></td>`;
      } else {
        html += `<td>${v ?? '—'}</td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  area.innerHTML = html;
}

function sortTable(ci: number): void {
  if (sortCol === ci) sortDir *= -1; else { sortCol = ci; sortDir = 1; }
  renderTable();
}

function setFilter(mode: string | null): void {
  filterMode = mode;
  renderTable();
}

// ---------------------------------------------------------------------------
// Compare view
// ---------------------------------------------------------------------------
function renderCompare(): void {
  const area = document.getElementById('contentArea');
  if (!area) return;
  if (compareSelection.length < 2) {
    area.innerHTML = `<div class="empty-state">${EMPTY_SVG}<h3>Compare Presets</h3><p>Right-click 2 or 3 presets in the sidebar to select them for comparison. Differences will be highlighted.</p></div>`;
    return;
  }
  const ps = compareSelection.map(i => ({ idx: i, p: BANKS[activeBank!]![i]! }));
  const cols = ps.length;
  let html = `<div class="compare-grid" style="grid-template-columns:160px repeat(${cols},1fr)"><div></div>`;
  for (const { idx, p } of ps) {
    html += `<div class="compare-col-head">${presetDisplayName(p, activeBank!, idx)}</div>`;
  }
  for (const s of SECTIONS) {
    html += `<div class="compare-section-title" style="grid-column:1/-1">${s.t}</div>`;
    for (const k of s.k) {
      const vals = ps.map(({ p }) => (p.base as Record<string, unknown> | undefined)?.[k]);
      const allSame = vals.every(v => fmt(v) === fmt(vals[0]));
      html += `<div class="cmp-label">${NAMES[k] ?? k}</div>`;
      for (const v of vals) html += `<div class="cmp-val ${!allSame ? 'diff' : ''}">${fmt(v)}</div>`;
    }
  }
  for (const fx of FX_SECTIONS) {
    html += `<div class="compare-section-title" style="grid-column:1/-1">${fx.t}</div>`;
    const types = ps.map(({ p }) => ((p.base as Record<string, unknown> | undefined)?.[fx.id] as Record<string, unknown> | undefined)?.['typ'] ?? '—');
    const typeSame = types.every(t => t === types[0]);
    html += `<div class="cmp-label">Algorithm</div>`;
    for (const t of types) html += `<div class="cmp-val ${!typeSame ? 'diff' : ''}">${t}</div>`;
    const mixes = ps.map(({ p }) => ((p.base as Record<string, unknown> | undefined)?.[fx.id] as Record<string, unknown> | undefined)?.['mix'] ?? 0);
    const mixSame = mixes.every(m => fmt(m) === fmt(mixes[0]));
    html += `<div class="cmp-label">Mix</div>`;
    for (const m of mixes) html += `<div class="cmp-val ${!mixSame ? 'diff' : ''}">${fmt(m)}</div>`;
  }
  html += '</div>';
  area.innerHTML = html;
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------
function handleFiles(e: Event): void {
  const input = e.target as HTMLInputElement;
  for (const file of Array.from(input.files ?? [])) loadFile(file);
}

function loadFile(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result;
    if (!(result instanceof ArrayBuffer)) return;
    const presets = parseSyx(result);
    if (!presets.length) { alert(`No presets found in ${file.name}`); return; }

    let letter: BankLetter | null = null;
    const m = file.name.match(/bank[_\-\s]*([a-hA-H])/i) ?? file.name.match(/[_\-\s]([a-hA-H])\.(syx|bin)$/i);
    if (m?.[1]) letter = m[1].toUpperCase() as BankLetter;
    if (!letter) {
      for (const l of BANK_LETTERS) if (!BANKS[l]) { letter = l; break; }
    }
    if (!letter) letter = 'A';

    BANKS[letter] = presets.length === 65 ? presets.slice(1) : presets.slice(0, 64);
    BANK_SOURCE[letter] = 'user';
    clearDirtyBank(letter);
    renderBankTabs();
    switchBank(letter);
  };
  reader.readAsArrayBuffer(file);
}

async function autoLoadBanks(): Promise<void> {
  for (const letter of BANK_LETTERS) {
    const filename = `artemis-bank-${letter.toLowerCase()}.bin`;
    try {
      const resp = await fetch(filename);
      if (!resp.ok) continue;
      const buffer = await resp.arrayBuffer();
      const presets = parseSyx(buffer);
      if (!presets.length) continue;
      BANKS[letter] = presets.length === 65 ? presets.slice(1) : presets.slice(0, 64);
      BANK_SOURCE[letter] = 'factory';
      renderBankTabs();
      if (letter === activeBank) { renderSidebar(); renderView(); }
    } catch { /* file not available */ }
  }
}

async function loadFactoryBank(): Promise<void> {
  if (!activeBank) return;
  const filename = `artemis-bank-${activeBank.toLowerCase()}.bin`;
  try {
    const resp = await fetch(filename);
    if (!resp.ok) { alert(`Factory file not found: ${filename}`); return; }
    const buffer = await resp.arrayBuffer();
    const presets = parseSyx(buffer);
    if (!presets.length) { alert(`No presets found in ${filename}`); return; }
    BANKS[activeBank] = presets.length === 65 ? presets.slice(1) : presets.slice(0, 64);
    BANK_SOURCE[activeBank] = 'factory';
    clearDirtyBank(activeBank);
    renderBankTabs();
    renderSidebar();
    renderView();
  } catch { alert(`Could not load factory file: ${filename}`); }
}

async function downloadAll(): Promise<void> {
  const loadedBanks = BANK_LETTERS.filter(l => BANKS[l]);
  if (!loadedBanks.length) { alert('No banks loaded to download.'); return; }
  const zip = new JSZip();
  for (const l of loadedBanks) {
    const syx = buildSyx(BANKS[l]!);
    zip.file(`artemis-bank-${l.toLowerCase()}.syx`, syx);
  }
  try {
    const htmlResp = await fetch(window.location.href);
    if (htmlResp.ok) zip.file('artemis-explorer.html', await htmlResp.text());
  } catch { zip.file('artemis-explorer.html', '<!-- Could not include HTML - save it manually from your browser -->'); }
  const blob = await zip.generateAsync({ type: 'blob' }) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'artemis-presets.zip'; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Preset editing
// ---------------------------------------------------------------------------
function toggleEditMode(): void {
  editMode = !editMode;
  renderDetail();
}

function setParam(key: string, raw: string): void {
  const p = activeBank ? BANKS[activeBank]?.[activePresetIdx] : undefined;
  if (!p) return;
  if (!p.base) p.base = {};
  const b = p.base as Record<string, unknown>;

  if (BOOLEAN_PARAMS.has(key))   b[key] = (raw === 'true');
  else if (ENUM_PARAMS.has(key)) b[key] = raw;
  else                           b[key] = parseFloat(raw);

  if (activeBank) { DIRTY_BANKS.add(activeBank); DIRTY_PRESETS.add(`${activeBank}:${activePresetIdx}`); }
  renderBankTabs();

  // Patch subtitle in-place (mode/BPM/Drive may have changed)
  const base = p.base;
  const mode = MODES[base.play_mode ?? ''] ?? base.play_mode ?? '';
  const sub = document.getElementById('detailSubtitle');
  if (sub) sub.textContent =
    `${mode} · BPM ${(base.bpm ?? 120).toFixed(0)} · Drive: ${base.drive_mode ?? 'Off'} · Right-click presets in sidebar to compare`;

  // Patch value label in-place (avoids full re-render so slider keeps focus)
  const valEl = document.getElementById(`pv-${key}`);
  if (valEl) valEl.textContent = fmt(b[key]);
}

function setPresetName(value: string): void {
  const p = activeBank ? BANKS[activeBank]?.[activePresetIdx] : undefined;
  if (!p) return;
  p.name = value || null;
  if (activeBank) { DIRTY_BANKS.add(activeBank); DIRTY_PRESETS.add(`${activeBank}:${activePresetIdx}`); }
  renderBankTabs();
  renderSidebar();
}

function toggleHelpModal(): void {
  document.getElementById('helpOverlay')?.classList.toggle('open');
}

function closeHelpModal(): void {
  document.getElementById('helpOverlay')?.classList.remove('open');
}

function setModTab(src: ModSource): void {
  activeModTab = src;
  renderDetail();
}

// ---------------------------------------------------------------------------
// Send to Artemis
// ---------------------------------------------------------------------------
async function sendCurrentPreset(): Promise<void> {
  const p = activeBank ? BANKS[activeBank]?.[activePresetIdx] : undefined;
  if (!p) { document.getElementById('midiStatus')!.textContent = 'No preset selected.'; return; }
  await sendPreset(p);
}

async function sendCurrentBank(): Promise<void> {
  if (!activeBank || !BANKS[activeBank]) { document.getElementById('midiStatus')!.textContent = 'No bank loaded.'; return; }
  await sendBank(activeBank, BANKS[activeBank]!);
}

// ---------------------------------------------------------------------------
// Expose to HTML onclick handlers (Vite doesn't expose module scope globally)
// ---------------------------------------------------------------------------
declare global { interface Window { [key: string]: unknown } }
Object.assign(window, {
  switchBank, switchView, selectPreset, toggleCompare, filterList,
  sortTable, setFilter,
  toggleHelpModal, closeHelpModal,
  toggleListen, clearMidiBuffer,
  selectOutputPort, sendCurrentPreset, sendCurrentBank,
  loadFactoryBank, downloadAll, handleFiles,
  setModTab,
  toggleEditMode, setParam, setPresetName,
  updateMidiDots,
});

// ---------------------------------------------------------------------------
// MIDI callbacks
// ---------------------------------------------------------------------------
initMidiCallbacks({
  onBankLoaded(letter, presets) {
    BANKS[letter] = presets;
    BANK_SOURCE[letter] = 'user';
    clearDirtyBank(letter);
    renderBankTabs();
    switchBank(letter);
  },
  onPresetLoaded(letter, slot, preset) {
    if (!BANKS[letter]) BANKS[letter] = [];
    BANKS[letter]![slot] = preset;
    DIRTY_PRESETS.delete(`${letter}:${slot}`);
    BANK_SOURCE[letter] = BANK_SOURCE[letter] ?? 'user';
    renderBankTabs();
    renderSidebar();
    renderView();
    setTimeout(() => {
      const items = document.querySelectorAll('.preset-item');
      const item = items[slot];
      if (item) {
        item.classList.add('flash');
        setTimeout(() => item.classList.remove('flash'), 1000);
      }
    }, 50);
  },
  onStatus(html) {
    const el = document.getElementById('midiStatus');
    if (el) el.innerHTML = html;
  },
  getActiveBank: () => activeBank,
  getActivePresetIdx: () => activePresetIdx,
  isBankLoaded: (letter) => !!BANKS[letter],
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderBankTabs();
switchBank('A');
autoLoadBanks();
initMidi();
