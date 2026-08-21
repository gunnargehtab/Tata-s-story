/*
 * Sound, drawn the same way the art is: procedurally, from nothing.
 *
 * Everything here is synthesized in WebAudio at runtime — short envelope
 * oscillators and filtered noise for effects, a tiny step sequencer for the
 * scene music — so the game keeps its no-asset, no-dependency shape. If the
 * AudioContext is missing, refuses to start, or the player mutes it, every
 * call quietly does nothing.
 *
 * Mobile browsers gate audio behind a user gesture: initAudio() arms a
 * one-time unlock on the first pointer/key event.
 */

const SETTINGS_KEY = 'tata-settings-v1';

const A = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  wet: null,          // shared reverb send
  on: true,           // player preference, persisted
  unlocked: false,
};

// ------------------------------------------------------------- settings

function loadPrefs() {
  try {
    const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (typeof d.sound === 'boolean') A.on = d.sound;
  } catch { /* default stays on */ }
}

function savePrefs() {
  try {
    const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    d.sound = A.on;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(d));
  } catch { /* private mode: the toggle still works for this session */ }
}

export const soundOn = () => A.on;

export function setSoundOn(on) {
  A.on = !!on;
  savePrefs();
  if (A.master) A.master.gain.setTargetAtTime(A.on ? MASTER_LEVEL : 0, now(), 0.03);
  return A.on;
}

// ------------------------------------------------------------- context

const MASTER_LEVEL = 0.5;

const now = () => (A.ctx ? A.ctx.currentTime : 0);

function makeContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  const ctx = new Ctx();
  A.ctx = ctx;
  A.master = ctx.createGain();
  A.master.gain.value = A.on ? MASTER_LEVEL : 0;
  A.master.connect(ctx.destination);

  A.sfxBus = ctx.createGain();
  A.sfxBus.gain.value = 0.85;
  A.sfxBus.connect(A.master);

  A.musicBus = ctx.createGain();
  A.musicBus.gain.value = 0;            // faded in by the sequencer
  A.musicBus.connect(A.master);

  // one small generated room: a decaying-noise impulse gives the plucks air
  const dur = 1.4, rate = ctx.sampleRate;
  const impulse = ctx.createBuffer(2, dur * rate, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
  }
  const verb = ctx.createConvolver();
  verb.buffer = impulse;
  A.wet = ctx.createGain();
  A.wet.gain.value = 0.35;
  A.wet.connect(verb);
  verb.connect(A.master);
  return true;
}

export function initAudio() {
  loadPrefs();
  const unlock = () => {
    if (A.unlocked) return;
    if (!A.ctx && !makeContext()) return;
    A.ctx.resume().catch(() => {});
    A.unlocked = true;
    removeEventListener('pointerdown', unlock);
    removeEventListener('keydown', unlock);
  };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
}

/** Tab hidden: stop the clock so nothing piles up. */
export function suspendAudio() {
  if (A.ctx && A.ctx.state === 'running') A.ctx.suspend().catch(() => {});
}

export function resumeAudio() {
  if (A.ctx && A.unlocked) A.ctx.resume().catch(() => {});
}

const live = () => A.ctx && A.unlocked && A.on && A.ctx.state === 'running';

// ---------------------------------------------------------- synth atoms

/** One enveloped oscillator: freq f0 sliding to f1 over t seconds. */
function tone({ f0, f1 = null, t = 0.15, type = 'square', g = 0.2, when = 0, wet = 0 }) {
  const ctx = A.ctx;
  const t0 = now() + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f0), t0);
  if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + t);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(g, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + t);
  osc.connect(env);
  env.connect(A.sfxBus);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; env.connect(w); w.connect(A.wet); }
  osc.start(t0);
  osc.stop(t0 + t + 0.05);
}

let noiseBuf = null;
function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const rate = A.ctx.sampleRate;
  noiseBuf = A.ctx.createBuffer(1, rate, rate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** A burst of filtered noise — gunfire, thumps, rift static. */
function noise({ t = 0.12, g = 0.25, hp = 0, lp = 9000, when = 0, wet = 0 }) {
  const ctx = A.ctx;
  const t0 = now() + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  let node = src;
  if (lp < 20000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
  if (hp > 0) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(g, t0 + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + t);
  node.connect(env);
  env.connect(A.sfxBus);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; env.connect(w); w.connect(A.wet); }
  src.start(t0);
  src.stop(t0 + t + 0.05);
}

// -------------------------------------------------------------- effects

/*
 * The whole effect vocabulary in one table. Names are what the game code
 * says is happening; how that sounds is decided here and only here.
 */
const FX = {
  // interface
  tap: () => tone({ f0: 660, t: 0.05, type: 'square', g: 0.08 }),
  blip: () => tone({ f0: 440, t: 0.04, type: 'square', g: 0.06 }),
  confirm: () => { tone({ f0: 520, t: 0.06, g: 0.09 }); tone({ f0: 780, t: 0.08, g: 0.09, when: 0.05 }); },
  back: () => tone({ f0: 320, f1: 220, t: 0.08, g: 0.08 }),
  dialog: () => tone({ f0: 950, t: 0.03, type: 'triangle', g: 0.07 }),
  notebook: () => { noise({ t: 0.09, g: 0.1, hp: 1200 }); noise({ t: 0.07, g: 0.08, hp: 1600, when: 0.07 }); },
  denied: () => tone({ f0: 180, t: 0.12, type: 'sawtooth', g: 0.08 }),

  // world
  step: () => noise({ t: 0.045, g: 0.035, hp: 300, lp: 1400 }),
  door: () => { tone({ f0: 140, f1: 90, t: 0.16, type: 'triangle', g: 0.14 }); noise({ t: 0.1, g: 0.07, lp: 800 }); },
  clue: () => { tone({ f0: 700, t: 0.09, type: 'triangle', g: 0.1, wet: 0.5 }); tone({ f0: 1050, t: 0.14, type: 'triangle', g: 0.1, when: 0.08, wet: 0.5 }); },
  coin: () => { tone({ f0: 900, t: 0.05, type: 'triangle', g: 0.1 }); tone({ f0: 1350, t: 0.1, type: 'triangle', g: 0.1, when: 0.04 }); },
  buy: () => { tone({ f0: 900, t: 0.05, type: 'triangle', g: 0.1 }); tone({ f0: 600, t: 0.08, type: 'triangle', g: 0.1, when: 0.05 }); },
  heal: () => { tone({ f0: 420, f1: 630, t: 0.22, type: 'sine', g: 0.12, wet: 0.4 }); },
  save: () => tone({ f0: 520, f1: 1040, t: 0.18, type: 'sine', g: 0.07, wet: 0.4 }),

  // combat
  encounter: () => { tone({ f0: 220, f1: 110, t: 0.3, type: 'sawtooth', g: 0.1 }); noise({ t: 0.25, g: 0.1, hp: 300, lp: 2500, when: 0.05 }); },
  smg: () => { for (let i = 0; i < 3; i++) noise({ t: 0.05, g: 0.2, hp: 900, lp: 6000, when: i * 0.07 }); },
  baton: () => { noise({ t: 0.07, g: 0.22, lp: 900 }); tone({ f0: 130, f1: 70, t: 0.1, type: 'triangle', g: 0.2 }); },
  flashbang: () => { noise({ t: 0.3, g: 0.3, hp: 500, wet: 0.6 }); tone({ f0: 2600, t: 0.5, type: 'sine', g: 0.05 }); },
  drone: () => { tone({ f0: 220, f1: 440, t: 0.35, type: 'sawtooth', g: 0.05 }); tone({ f0: 227, f1: 452, t: 0.35, type: 'sawtooth', g: 0.05 }); },
  hit: () => { noise({ t: 0.08, g: 0.18, lp: 1600 }); tone({ f0: 160, f1: 90, t: 0.09, type: 'triangle', g: 0.14 }); },
  miss: () => noise({ t: 0.1, g: 0.06, hp: 2000 }),
  hurt: () => { noise({ t: 0.1, g: 0.2, lp: 1000 }); tone({ f0: 110, f1: 60, t: 0.16, type: 'sawtooth', g: 0.12 }); },
  down: () => { tone({ f0: 200, f1: 45, t: 0.4, type: 'sawtooth', g: 0.14, wet: 0.3 }); noise({ t: 0.25, g: 0.1, lp: 700, when: 0.1 }); },
  question: () => tone({ f0: 330, f1: 392, t: 0.16, type: 'triangle', g: 0.09 }),
  breakMorale: () => { tone({ f0: 523, t: 0.1, type: 'triangle', g: 0.12, wet: 0.5 }); tone({ f0: 392, t: 0.12, g: 0.1, when: 0.09, wet: 0.5 }); tone({ f0: 311, t: 0.22, g: 0.1, when: 0.19, wet: 0.5 }); },
  evidence: () => { tone({ f0: 620, t: 0.07, type: 'square', g: 0.1 }); tone({ f0: 930, t: 0.1, g: 0.1, when: 0.06 }); tone({ f0: 1240, t: 0.16, g: 0.1, when: 0.12, wet: 0.4 }); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, t: 0.16, type: 'triangle', g: 0.11, when: i * 0.09, wet: 0.4 })); },
  flee: () => { noise({ t: 0.2, g: 0.07, hp: 400, lp: 3000 }); },
  lose: () => { [330, 262, 196, 131].forEach((f, i) => tone({ f0: f, t: 0.3, type: 'triangle', g: 0.1, when: i * 0.16, wet: 0.4 })); },
  levelup: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, t: 0.14, type: 'triangle', g: 0.1, when: i * 0.07, wet: 0.5 })); },

  // rifts and the strange
  riftOpen: () => { tone({ f0: 1400, f1: 300, t: 0.7, type: 'sine', g: 0.09, wet: 0.7 }); tone({ f0: 1407, f1: 305, t: 0.7, type: 'sine', g: 0.09, wet: 0.7 }); },
  riftSeal: () => { tone({ f0: 300, f1: 1200, t: 0.5, type: 'sine', g: 0.1, wet: 0.6 }); tone({ f0: 1600, t: 0.2, type: 'triangle', g: 0.08, when: 0.4, wet: 0.6 }); },
  riftCollapse: () => { noise({ t: 0.5, g: 0.2, lp: 1200, wet: 0.5 }); tone({ f0: 500, f1: 60, t: 0.5, type: 'sawtooth', g: 0.1 }); },
  shock: () => { noise({ t: 0.8, g: 0.25, lp: 2500, wet: 0.7 }); tone({ f0: 60, f1: 30, t: 0.9, type: 'sine', g: 0.25 }); },
};

/** Play a named effect. Unknown names are ignored on purpose. */
export function sfx(name) {
  if (!live()) return;
  const fn = FX[name];
  if (fn) fn();
}

// ---------------------------------------------------------------- music

/*
 * A sixteen-step sequencer, two bars of eighth notes per loop. Lanes are
 * strings over a dorian scale — digits are scale degrees, '.' is a rest,
 * 'x'/'X' are soft/hard percussion in a noise lane. Sparse on purpose:
 * the score is a few ink lines, not a wall of paint.
 */
const ROOT = 110;                      // A2
const SCALE = [0, 2, 3, 5, 7, 9, 10]; // dorian
const degFreq = (d, oct) => ROOT * Math.pow(2, oct + SCALE[d % 7] / 12 + Math.floor(d / 7));

const TRACKS = {
  title: {
    bpm: 66, level: 0.32,
    lanes: [
      { pat: '0.......5.......', oct: -1, type: 'sine', g: 0.5, t: 1.6, wet: 0.5 },
      { pat: '....7...6...4...', oct: 1, type: 'triangle', g: 0.22, t: 0.9, wet: 0.8 },
    ],
  },
  village: {
    bpm: 76, level: 0.3,
    lanes: [
      { pat: '0...4...5...4...', oct: -1, type: 'sine', g: 0.45, t: 0.9, wet: 0.3 },
      { pat: '..7...5...9.8...', oct: 1, type: 'triangle', g: 0.16, t: 0.5, wet: 0.7 },
      { pat: 'x.......x.......', noise: true, g: 0.05, t: 0.05 },
    ],
  },
  forest: {
    bpm: 70, level: 0.3,
    lanes: [
      { pat: '0.....3.2.....5.', oct: -1, type: 'sine', g: 0.42, t: 1.1, wet: 0.5 },
      { pat: '......9.......4.', oct: 2, type: 'sine', g: 0.15, t: 1.2, wet: 0.9 },
    ],
  },
  market: {
    bpm: 88, level: 0.3,
    lanes: [
      { pat: '0.0.4.4.5.5.3.4.', oct: -1, type: 'triangle', g: 0.4, t: 0.35, wet: 0.2 },
      { pat: '..7...9..8..7...', oct: 1, type: 'triangle', g: 0.15, t: 0.4, wet: 0.6 },
      { pat: 'x...x...x...x..x', noise: true, g: 0.05, t: 0.04 },
    ],
  },
  dark: {
    bpm: 56, level: 0.34,
    lanes: [
      { pat: '0...............', oct: -2, type: 'sine', g: 0.6, t: 3.4, wet: 0.6 },
      { pat: '........2.......', oct: -1, type: 'sine', g: 0.35, t: 1.8, wet: 0.6 },
      { pat: '......x.......x.', noise: true, g: 0.035, t: 0.3, lp: 900 },
    ],
  },
  interro: {
    bpm: 72, level: 0.28,
    lanes: [
      { pat: '0.......1.......', oct: -1, type: 'sine', g: 0.45, t: 1.4, wet: 0.4 },
      { pat: 'x...x...x...x...', noise: true, g: 0.04, t: 0.05 },
    ],
  },
  battle: {
    bpm: 112, level: 0.32,
    lanes: [
      { pat: '0.0...3.0.0...5.', oct: -1, type: 'triangle', g: 0.42, t: 0.22, wet: 0.15 },
      { pat: 'x.X.x.X.x.X.x.XX', noise: true, g: 0.07, t: 0.05 },
      { pat: '....7.......6...', oct: 1, type: 'square', g: 0.07, t: 0.25, wet: 0.5 },
    ],
  },
  boss: {
    bpm: 120, level: 0.36,
    lanes: [
      { pat: '0.0.1.0.0.0.5.4.', oct: -2, type: 'sawtooth', g: 0.3, t: 0.22, wet: 0.2 },
      { pat: 'X.x.X.x.X.x.X.xx', noise: true, g: 0.09, t: 0.05 },
      { pat: '7...6...7...9.3.', oct: 1, type: 'square', g: 0.06, t: 0.3, wet: 0.5 },
    ],
  },
};

const Music = {
  cur: null,        // track id playing
  want: null,       // track id asked for
  step: 0,
  nextAt: 0,        // ctx time of the next unscheduled step
  fadingOut: false,
};

/** Ask for a scene's track; null fades to silence. Safe to call every frame. */
export function setMusic(id) {
  Music.want = id && TRACKS[id] ? id : null;
}

function scheduleStep(track, step, when) {
  for (const lane of track.lanes) {
    const ch = lane.pat[step % lane.pat.length];
    if (ch === '.') continue;
    if (lane.noise) {
      noiseNote(lane, ch === 'X' ? 1.6 : 1, when);
      continue;
    }
    const deg = ch.charCodeAt(0) - 48;    // single digits 0-9; octave comes from the lane
    if (deg < 0 || deg > 9) continue;
    laneNote(lane, deg, when);
  }
}

function laneNote(lane, deg, when) {
  const ctx = A.ctx;
  const osc = ctx.createOscillator();
  osc.type = lane.type;
  osc.frequency.value = degFreq(deg, lane.oct);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(lane.g, when + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0006, when + lane.t);
  osc.connect(env);
  env.connect(A.musicBus);
  if (lane.wet) { const w = ctx.createGain(); w.gain.value = lane.wet; env.connect(w); w.connect(A.wet); }
  osc.start(when);
  osc.stop(when + lane.t + 0.05);
}

function noiseNote(lane, mul, when) {
  const ctx = A.ctx;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lane.lp || 5000;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(lane.g * mul, when + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0006, when + lane.t);
  src.connect(f); f.connect(env); env.connect(A.musicBus);
  src.start(when);
  src.stop(when + lane.t + 0.05);
}

/** Called once per frame: crossfades tracks and keeps the pattern scheduled. */
export function updateAudio() {
  if (!A.ctx || !A.unlocked || A.ctx.state !== 'running') return;
  const t = now();
  const bus = A.musicBus.gain;

  if (Music.want !== Music.cur) {
    if (!Music.fadingOut) {
      Music.fadingOut = true;
      bus.cancelScheduledValues(t);
      bus.setTargetAtTime(0, t, 0.18);
      Music.fadeDone = t + 0.6;
    } else if (t >= Music.fadeDone) {
      Music.cur = Music.want;
      Music.fadingOut = false;
      Music.step = 0;
      Music.nextAt = t + 0.08;
      if (Music.cur) bus.setTargetAtTime(TRACKS[Music.cur].level, t, 0.4);
    }
    if (Music.fadingOut) return;
  }

  // mute lives on the master gain, so the pattern keeps its place while silent
  const track = Music.cur && TRACKS[Music.cur];
  if (!track) return;
  const stepDur = 60 / track.bpm / 2;   // eighth notes
  // stay ~0.25s ahead of the clock; catch up after a stall instead of bursting
  if (Music.nextAt < t - 0.5) Music.nextAt = t + 0.05;
  while (Music.nextAt < t + 0.25) {
    scheduleStep(track, Music.step, Music.nextAt);
    Music.step = (Music.step + 1) % 16;
    Music.nextAt += stepDur;
  }
}
