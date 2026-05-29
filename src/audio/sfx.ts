// SFX synthesizers — cozy, magical one-shots for Starfall Garden.
//
// Everything here is procedurally synthesized via Web Audio (no external
// samples). The Starfall Garden re-skin called for sounds that feel soft,
// warm and twinkly rather than the harsh square/sawtooth blips of the old
// "Neon Factory" build, so this palette leans on:
//   • bell/chime timbres — a fundamental plus a couple of gently-detuned sine
//     partials with fast attack + long exponential decay (bell()),
//   • airy lowpass noise   — soft "poofs"/whooshes instead of white hiss
//     (puff()),
//   • smooth sine glides    — pitch slides without buzzy harmonics (glide()),
//   • a pentatonic palette  — rapid repeats (pickups, casting) land on
//     pleasant intervals instead of a monotone, so the moment-to-moment loop
//     sounds musical rather than mechanical.
//
// Scheduling uses the Web Audio clock (the `when` offset) instead of
// setTimeout, so arpeggios stay tight and jitter-free.
//
// Public API is unchanged from the old engine so callers don't change: every
// helper short-circuits on a null sfxBus (audio context not yet unlocked).
// The first user gesture triggers AudioBus.resume(), after which everything
// works.

import { AudioBus } from './AudioBus';

type WaveType = OscillatorType;

// MIDI note -> frequency (A4 = note 69 = 440Hz). Keeps the note math readable.
function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// A warm C-major pentatonic spread across a couple of octaves. Picking from
// this set means rapid-fire sounds always harmonize instead of droning.
//          C5     D5     E5     G5     A5     C6     D6     E6     G6
const PENTA = [hz(72), hz(74), hz(76), hz(79), hz(81), hz(84), hz(86), hz(88), hz(91)];

// ---- synthesis primitives ----

interface ToneOpts {
  freq: number;
  type?: WaveType;
  attack?: number;
  release?: number;
  gain?: number;
  detune?: number;
  when?: number; // schedule delay from "now", in seconds
  bus?: GainNode;
}

// Single oscillator with a soft attack/exponential-decay envelope.
function tone(opts: ToneOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const start = c.currentTime + Math.max(0, opts.when ?? 0);
  const osc = c.createOscillator();
  osc.frequency.value = opts.freq;
  osc.type = opts.type ?? 'sine';
  if (opts.detune) osc.detune.value = opts.detune;
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? 0.12;
  const peak = opts.gain ?? 0.16;
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  osc.connect(g).connect(sfx);
  osc.start(start);
  osc.stop(start + attack + release + 0.02);
}

interface BellOpts {
  freq: number;
  ratios?: number[]; // partial frequency ratios (default soft [1, 2, 3])
  amps?: number[]; // relative peak per partial (default [1, 0.35, 0.15])
  attack?: number; // seconds (default 0.004)
  release?: number; // decay tail of the fundamental (default 0.5)
  gain?: number; // overall peak scaler (default 0.14)
  detune?: number; // cents of shimmer applied to the upper partials
  vibrato?: number; // Hz of gentle pitch wobble (0/undefined = none)
  when?: number; // schedule delay from "now", in seconds
  bus?: GainNode;
}

// Bell/chime: a fundamental plus a few sine partials, each with its own
// envelope. Upper partials decay faster (as in a real bell), and an optional
// vibrato LFO adds a touch of "magic" shimmer. This is the workhorse timbre.
function bell(opts: BellOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const start = c.currentTime + Math.max(0, opts.when ?? 0);
  const ratios = opts.ratios ?? [1, 2, 3];
  const amps = opts.amps ?? [1, 0.35, 0.15];
  const attack = opts.attack ?? 0.004;
  const release = opts.release ?? 0.5;
  const peak = opts.gain ?? 0.14;

  const master = c.createGain();
  master.gain.value = peak;
  master.connect(sfx);

  // Optional shared vibrato LFO -> partial frequencies for a gentle wobble.
  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  if (opts.vibrato && opts.vibrato > 0) {
    lfo = c.createOscillator();
    lfo.frequency.value = opts.vibrato;
    lfoGain = c.createGain();
    lfoGain.gain.value = opts.freq * 0.006; // subtle (~0.6% of fundamental)
    lfo.connect(lfoGain);
  }

  let maxEnd = start;
  ratios.forEach((ratio, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = opts.freq * ratio;
    if (opts.detune && i > 0) osc.detune.value = opts.detune * (i % 2 === 0 ? 1 : -1);
    if (lfoGain) lfoGain.connect(osc.frequency);
    const g = c.createGain();
    const a = amps[i] ?? 0;
    const rel = release / (1 + i * 0.7); // higher partials fade quicker
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(a, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + rel);
    osc.connect(g).connect(master);
    const end = start + attack + rel + 0.02;
    osc.start(start);
    osc.stop(end);
    if (end > maxEnd) maxEnd = end;
  });
  if (lfo) {
    lfo.start(start);
    lfo.stop(maxEnd);
  }
}

interface PuffOpts {
  duration: number;
  gain?: number;
  lowpass?: number; // default 1800 — soft and airy, not hissy
  highpass?: number;
  attack?: number; // default 0.005
  when?: number;
  bus?: GainNode;
}

// Soft filtered-noise "poof" — used for whooshes, banish puffs, soft impacts.
function puff(opts: PuffOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const start = c.currentTime + Math.max(0, opts.when ?? 0);
  const dur = opts.duration;
  const samples = Math.max(64, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, samples, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) ch[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = opts.lowpass ?? 1800;
  src.connect(lp);
  let tail: AudioNode = lp;
  if (opts.highpass) {
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = opts.highpass;
    lp.connect(hp);
    tail = hp;
  }

  const g = c.createGain();
  const peak = opts.gain ?? 0.14;
  const attack = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  tail.connect(g).connect(sfx);
  src.start(start);
  src.stop(start + dur + 0.02);
}

interface GlideOpts {
  from: number;
  to: number;
  type?: WaveType;
  duration: number;
  gain?: number;
  attack?: number;
  when?: number;
  bus?: GainNode;
}

// Smooth pitch glide on a sine/triangle (soft "swoosh"/"sigh" without buzz).
function glide(opts: GlideOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const start = c.currentTime + Math.max(0, opts.when ?? 0);
  const osc = c.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), start + opts.duration);
  const g = c.createGain();
  const peak = opts.gain ?? 0.16;
  const attack = opts.attack ?? 0.01;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
  osc.connect(g).connect(sfx);
  osc.start(start);
  osc.stop(start + opts.duration + 0.02);
}

// Stardust pickups climb a pentatonic ladder so a run of pickups arpeggiates
// like a little chime cascade. The ladder resets after a short pause.
const SCRAP_LADDER = [hz(79), hz(81), hz(84), hz(86), hz(88), hz(91), hz(93)]; // G5..G6
let scrapStep = 0;
let scrapLastT = -10;
function scrapNote(): number {
  const c = AudioBus.getCtx();
  const now = c ? c.currentTime : 0;
  if (now - scrapLastT > 1.1) scrapStep = 0; // restart the cascade after a gap
  scrapLastT = now;
  const f = SCRAP_LADDER[Math.min(scrapStep, SCRAP_LADDER.length - 1)];
  scrapStep++;
  return f;
}

// ---- SFX library (cozy/magical re-voicing of the §20.2 set) ----

// Player casts a spark-bolt — fires ~10x/sec, so keep it whisper-soft and
// short. A gentle triangle pluck drifting across a few high pentatonic notes
// twinkles instead of buzzing.
export function sfxShoot(): void {
  const f = PENTA[6 + Math.floor(Math.random() * 3)]; // D6 / E6 / G6 region
  tone({ freq: f, type: 'triangle', attack: 0.002, release: 0.06, gain: 0.035 });
}

// Player took damage — a soft, muffled "ow" (gentle minor-third drop + a
// rounded lowpass thump). Clear but never harsh.
export function sfxPlayerHurt(): void {
  glide({ from: 392, to: 311, type: 'sine', duration: 0.2, gain: 0.2 });
  puff({ duration: 0.1, gain: 0.08, lowpass: 700 });
}

// Player wilts (death) — a gentle descending bell "sigh" with a soft pad,
// like a flower closing up rather than an explosion.
export function sfxPlayerDeath(): void {
  glide({ from: 523, to: 196, type: 'sine', duration: 0.9, gain: 0.18 });
  bell({ freq: hz(67), ratios: [1, 2], amps: [0.9, 0.3], release: 0.9, gain: 0.16, when: 0.04 });
  puff({ duration: 0.3, gain: 0.07, lowpass: 600 });
}

// Dash — an airy leaf-rustle whoosh that lifts in pitch.
export function sfxDash(): void {
  puff({ duration: 0.18, gain: 0.1, lowpass: 2400, highpass: 500 });
  glide({ from: 280, to: 760, type: 'triangle', duration: 0.18, gain: 0.1 });
}

// Stardust pickup — a tiny bright twinkle that climbs the pentatonic ladder.
export function sfxScrap(): void {
  const f = scrapNote();
  bell({ freq: f, ratios: [1, 2.01, 3.2], amps: [1, 0.3, 0.12], release: 0.22, gain: 0.13, detune: 6 });
}

// Star Heart pickup — a warmer, richer chime with a sparkle tail.
export function sfxCore(): void {
  bell({ freq: hz(81), ratios: [1, 2, 3, 4.1], amps: [1, 0.4, 0.18, 0.08], release: 0.5, gain: 0.16, detune: 7 });
  bell({ freq: hz(93), ratios: [1, 2.4], amps: [0.7, 0.25], release: 0.4, gain: 0.09, when: 0.07 });
}

// Charm collected (power-up) — a cute ascending pentatonic pop.
export function sfxPowerup(): void {
  puff({ duration: 0.05, gain: 0.06, lowpass: 2600 });
  const notes = [hz(76), hz(81), hz(84), hz(88)]; // E5 A5 C6 E6
  notes.forEach((f, i) => {
    bell({ freq: f, release: 0.22, gain: 0.14, detune: 5, when: i * 0.05 });
  });
}

// Enemy hit — a very soft, muffled "tup". Low gain (fires fast in waves).
export function sfxEnemyHit(): void {
  tone({ freq: 240, type: 'sine', attack: 0.002, release: 0.05, gain: 0.06 });
  puff({ duration: 0.04, gain: 0.04, lowpass: 1200 });
}

// Critter banished — a friendly little "boop" (two soft notes down a third)
// with an airy poof, so clearing enemies feels gentle, not violent.
export function sfxEnemyDeath(): void {
  bell({ freq: hz(72), ratios: [1, 2], amps: [1, 0.3], release: 0.16, gain: 0.13 });
  bell({ freq: hz(68), ratios: [1, 2], amps: [1, 0.3], release: 0.18, gain: 0.12, when: 0.06 });
  puff({ duration: 0.12, gain: 0.07, lowpass: 1600 });
}

// Enemy spark-bolt — a soft, slightly hollow "pip".
export function sfxEnemyShoot(): void {
  tone({ freq: 430, type: 'triangle', attack: 0.002, release: 0.09, gain: 0.06 });
}

// Button tap — a soft rounded "tok" with a faint overtone.
export function sfxUiClick(): void {
  bell({ freq: hz(83), ratios: [1, 2.2], amps: [1, 0.25], attack: 0.002, release: 0.07, gain: 0.1 });
}

// Hover — a barely-there high tick.
export function sfxUiHover(): void {
  tone({ freq: hz(91), type: 'sine', attack: 0.002, release: 0.045, gain: 0.05 });
}

// Upgrade purchased — a bright, warm two-note bell up-step with a sparkle.
export function sfxUpgradePurchased(): void {
  bell({ freq: hz(76), release: 0.2, gain: 0.15, detune: 5 });
  bell({ freq: hz(83), ratios: [1, 2, 3], amps: [1, 0.4, 0.15], release: 0.3, gain: 0.16, detune: 6, when: 0.08 });
}

// Night-flight timer tick (final 10s) — a soft woodblock-ish click; gentle
// nudge of urgency without being alarming.
export function sfxTimerTick(): void {
  tone({ freq: hz(86), type: 'triangle', attack: 0.001, release: 0.045, gain: 0.07 });
}

// Moongate opens — an airy "portal" shimmer: a soft pad swell plus two
// rising chimes.
export function sfxExtractionOpen(): void {
  bell({ freq: hz(72), ratios: [1, 1.5, 2], amps: [0.9, 0.4, 0.25], attack: 0.05, release: 0.6, gain: 0.16, vibrato: 5 });
  bell({ freq: hz(79), release: 0.35, gain: 0.12, detune: 8, when: 0.12 });
  bell({ freq: hz(84), release: 0.4, gain: 0.12, detune: 8, when: 0.24 });
}

// Moongate tick — a subtle, breathing pulse while standing on the gate.
export function sfxExtractionTick(): void {
  tone({ freq: hz(84), type: 'sine', attack: 0.02, release: 0.12, gain: 0.05 });
}

// §20.3 fly-home success — a warm, joyful resolution: a soft (not noisy)
// boom, a rising shimmer, a sparkle cluster, then a major chord that blooms
// out on bells. Cozy-triumphant rather than "epic explosion".
export function sfxExtractionSuccess(): void {
  // Soft warm boom.
  glide({ from: 130, to: 55, type: 'sine', duration: 0.5, gain: 0.26 });
  // Rising shimmer.
  glide({ from: 330, to: 1320, type: 'triangle', duration: 0.6, gain: 0.1 });
  // Sparkle cluster — randomized high pentatonic twinkles.
  for (let i = 0; i < 6; i++) {
    const f = PENTA[5 + Math.floor(Math.random() * 4)];
    bell({ freq: f, ratios: [1, 2.3], amps: [0.8, 0.2], release: 0.25, gain: 0.07, when: 0.1 + i * 0.05 });
  }
  // Resolution chord (C major: C5 E5 G5 C6) blooming out.
  const chord = [hz(72), hz(76), hz(79), hz(84)];
  chord.forEach((f, i) => {
    bell({ freq: f, ratios: [1, 2, 3], amps: [1, 0.4, 0.16], release: 0.7, gain: 0.16, detune: 6, when: 0.18 + i * 0.08 });
  });
}

// Night flight failed — a soft, melancholy descending bell phrase (a sigh),
// gentle rather than ominous.
export function sfxRaidFailed(): void {
  const notes = [hz(74), hz(72), hz(67)]; // D5 C5 G4 — a gentle fall
  notes.forEach((f, i) => {
    bell({ freq: f, ratios: [1, 2], amps: [1, 0.3], release: 0.6, gain: 0.16, when: i * 0.16 });
  });
  glide({ from: 196, to: 110, type: 'sine', duration: 0.8, gain: 0.12, when: 0.32 });
}

// Account level-up — a "bloom": a rising pentatonic run over a soft warm pad
// swell, finished with a sparkle. Wired to ACCOUNT_LEVEL_UP in HUDScene.
export function sfxLevelUp(): void {
  // Warm pad swell underneath.
  bell({ freq: hz(60), ratios: [1, 1.5, 2], amps: [0.7, 0.3, 0.2], attack: 0.08, release: 0.9, gain: 0.12, vibrato: 4 });
  // Rising pentatonic bloom.
  const run = [hz(72), hz(76), hz(79), hz(84), hz(88)]; // C5 E5 G5 C6 E6
  run.forEach((f, i) => {
    bell({ freq: f, ratios: [1, 2, 3], amps: [1, 0.4, 0.16], release: 0.4, gain: 0.15, detune: 6, when: i * 0.07 });
  });
  // Sparkle on top.
  bell({ freq: hz(91), ratios: [1, 2.5], amps: [0.7, 0.25], release: 0.5, gain: 0.1, when: 0.4 });
}

// Charm effects -------------------------------------------------------

// Radial cleanse — a big but soft magical "bloom": warm low boom, an
// expanding shimmer, and a sparkle, instead of a harsh explosion.
export function sfxNuke(): void {
  glide({ from: 110, to: 42, type: 'sine', duration: 0.6, gain: 0.3 });
  puff({ duration: 0.45, gain: 0.14, lowpass: 900 });
  glide({ from: 300, to: 1500, type: 'triangle', duration: 0.4, gain: 0.12 });
  bell({ freq: hz(84), ratios: [1, 2, 3], amps: [1, 0.4, 0.18], release: 0.5, gain: 0.12, when: 0.08 });
}

// Magnet burst — a rising shimmer-whoosh that resolves on a chime.
export function sfxMagnetBurst(): void {
  glide({ from: 260, to: 1180, type: 'triangle', duration: 0.42, gain: 0.12 });
  bell({ freq: hz(88), release: 0.4, gain: 0.12, detune: 7, when: 0.18 });
}

// Spell Overdrive — a warm sustained shimmer chord (root + fifth, gently
// detuned) for the magical surge.
export function sfxLaserOverdrive(): void {
  bell({ freq: hz(69), ratios: [1, 1.5, 2], amps: [0.9, 0.5, 0.3], release: 0.6, gain: 0.13, detune: 9, vibrato: 5 });
  bell({ freq: hz(81), ratios: [1, 2], amps: [0.7, 0.3], release: 0.5, gain: 0.09, detune: 10, when: 0.04 });
}

// Freeze pulse — a glassy, crystalline chime with cold shimmer over a soft pad.
export function sfxFreezePulse(): void {
  bell({ freq: hz(96), ratios: [1, 2, 3.4], amps: [1, 0.35, 0.2], release: 0.45, gain: 0.13, detune: 10 });
  bell({ freq: hz(108), ratios: [1, 2.7], amps: [0.5, 0.2], release: 0.5, gain: 0.07, detune: 12, when: 0.03 });
  tone({ freq: hz(60), type: 'sine', attack: 0.01, release: 0.4, gain: 0.05 });
}

// Shield granted — a warm, protective ascending fifth on bells.
export function sfxShieldGrant(): void {
  bell({ freq: hz(72), ratios: [1, 2], amps: [1, 0.3], release: 0.3, gain: 0.13 });
  bell({ freq: hz(79), ratios: [1, 2, 3], amps: [1, 0.4, 0.16], release: 0.4, gain: 0.13, detune: 6, when: 0.07 });
}

// Time bonus — a hopeful two-note up-chime.
export function sfxTimeBonus(): void {
  bell({ freq: hz(81), release: 0.22, gain: 0.14 });
  bell({ freq: hz(88), ratios: [1, 2, 3], amps: [1, 0.4, 0.16], release: 0.3, gain: 0.15, detune: 6, when: 0.07 });
}

// Garden moonwell drops a Stardust pickup — a soft, low-key "plip" (fires
// repeatedly in the hub, so it stays in the background).
export function sfxGeneratorProduce(): void {
  tone({ freq: hz(81), type: 'triangle', attack: 0.002, release: 0.07, gain: 0.05 });
}
