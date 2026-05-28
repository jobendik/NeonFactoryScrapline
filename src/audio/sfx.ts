// SFX synthesizers per blueprint §20.2. Each function emits a short
// Web Audio graph (oscillator + envelope + connect to sfxBus), so SFX
// volume scales with the user's slider via the gain chain in AudioBus.
//
// Pattern: every helper short-circuits on a null sfxBus (audio context
// not yet unlocked). The first user gesture triggers AudioBus.resume(),
// after which everything works.

import { AudioBus } from './AudioBus';

type WaveType = OscillatorType;

interface ToneOpts {
  freq: number;
  type?: WaveType;
  attack?: number;
  release?: number;
  gain?: number;
  detune?: number;
  bus?: GainNode;
}

function tone(opts: ToneOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.value = opts.freq;
  osc.type = opts.type ?? 'sine';
  if (opts.detune) osc.detune.value = opts.detune;
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? 0.12;
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  osc.connect(g).connect(sfx);
  osc.start(now);
  osc.stop(now + attack + release + 0.02);
}

// Frequency sweep (rising or falling). Used for sweeps, woosh, dash, etc.
interface SweepOpts {
  from: number;
  to: number;
  type?: WaveType;
  duration: number;
  gain?: number;
  bus?: GainNode;
}

function sweep(opts: SweepOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sawtooth';
  osc.frequency.setValueAtTime(opts.from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), now + opts.duration);
  const peak = opts.gain ?? 0.16;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  osc.connect(g).connect(sfx);
  osc.start(now);
  osc.stop(now + opts.duration + 0.02);
}

// White noise burst. Used for hits, dust, explosions.
interface NoiseOpts {
  duration: number;
  gain?: number;
  highpass?: number;
  bus?: GainNode;
}

function noise(opts: NoiseOpts): void {
  const c = AudioBus.getCtx();
  const sfx = opts.bus ?? AudioBus.sfxBus();
  if (!c || !sfx) return;
  const dur = opts.duration;
  const samples = Math.max(64, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, samples, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) ch[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const peak = opts.gain ?? 0.18;
  const now = c.currentTime;
  g.gain.setValueAtTime(peak, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  if (opts.highpass) {
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = opts.highpass;
    src.connect(hp).connect(g).connect(sfx);
  } else {
    src.connect(g).connect(sfx);
  }
  src.start(now);
  src.stop(now + dur + 0.02);
}

// ---- §20.2 SFX library ----

// Player casts a spell - tiny bleep, every 0.1s during the night flight. Keep gain very low.
export function sfxShoot(): void {
  tone({ freq: 1200, type: 'square', attack: 0.002, release: 0.05, gain: 0.045 });
}

// Player took damage.
export function sfxPlayerHurt(): void {
  sweep({ from: 320, to: 110, type: 'sawtooth', duration: 0.18, gain: 0.22 });
  noise({ duration: 0.07, gain: 0.12, highpass: 800 });
}

// Player death - longer descending wail.
export function sfxPlayerDeath(): void {
  sweep({ from: 440, to: 80, type: 'sawtooth', duration: 0.9, gain: 0.28 });
  noise({ duration: 0.35, gain: 0.18 });
}

// Dash whoosh.
export function sfxDash(): void {
  sweep({ from: 220, to: 880, type: 'triangle', duration: 0.18, gain: 0.18 });
  noise({ duration: 0.06, gain: 0.08, highpass: 1200 });
}

// Stardust pickup - short bright blip.
export function sfxScrap(): void {
  tone({ freq: 1320, type: 'triangle', attack: 0.005, release: 0.10, gain: 0.16 });
}

// Star Heart pickup - higher, longer with a chime tail.
export function sfxCore(): void {
  tone({ freq: 880, type: 'triangle', attack: 0.005, release: 0.16, gain: 0.18 });
  tone({ freq: 1760, type: 'sine', attack: 0.005, release: 0.30, gain: 0.10 });
}

// Power-up collect - chirp arpeggio.
export function sfxPowerup(): void {
  const c = AudioBus.getCtx();
  if (!c) return;
  const notes = [659.25, 880, 1108.73, 1318.51];
  notes.forEach((f, i) => {
    setTimeout(() => tone({ freq: f, type: 'triangle', release: 0.12, gain: 0.16 }), i * 55);
  });
}

// Enemy hit - softer thud.
export function sfxEnemyHit(): void {
  tone({ freq: 320, type: 'square', attack: 0.002, release: 0.04, gain: 0.08 });
}

// Enemy death - small punch.
export function sfxEnemyDeath(): void {
  sweep({ from: 240, to: 90, type: 'sawtooth', duration: 0.16, gain: 0.16 });
  noise({ duration: 0.06, gain: 0.08, highpass: 600 });
}

// Enemy spark-bolt fire (shooter).
export function sfxEnemyShoot(): void {
  tone({ freq: 540, type: 'sawtooth', attack: 0.002, release: 0.08, gain: 0.07 });
}

// Combo-tier popup spawn or button click.
export function sfxUiClick(): void {
  tone({ freq: 980, type: 'triangle', attack: 0.002, release: 0.05, gain: 0.10 });
}

export function sfxUiHover(): void {
  tone({ freq: 1240, type: 'sine', attack: 0.002, release: 0.04, gain: 0.05 });
}

// Upgrade purchased - bright two-note up-step.
export function sfxUpgradePurchased(): void {
  tone({ freq: 660, type: 'triangle', attack: 0.005, release: 0.12, gain: 0.16 });
  setTimeout(() => tone({ freq: 990, type: 'triangle', release: 0.14, gain: 0.18 }), 70);
}

// Night-flight timer tick (final 10s). Quick metronome click.
export function sfxTimerTick(): void {
  tone({ freq: 1480, type: 'square', attack: 0.001, release: 0.03, gain: 0.06 });
}

// Moongate opens - airy chime.
export function sfxExtractionOpen(): void {
  tone({ freq: 523.25, type: 'triangle', attack: 0.01, release: 0.30, gain: 0.18 });
  tone({ freq: 783.99, type: 'sine', attack: 0.01, release: 0.40, gain: 0.12 });
}

// Moongate tick - subtle pulse while standing on the gate.
export function sfxExtractionTick(): void {
  tone({ freq: 1320, type: 'sine', attack: 0.001, release: 0.04, gain: 0.05 });
}

// §20.3 layered fly-home success: boom + sweep + sparkle + chord.
// The "chord" is the existing rising A-major arpeggio (flying home through the moongate).
export function sfxExtractionSuccess(): void {
  // Boom
  sweep({ from: 110, to: 30, type: 'sine', duration: 0.5, gain: 0.35 });
  noise({ duration: 0.18, gain: 0.18 });
  // Rising synth sweep
  sweep({ from: 220, to: 1760, type: 'sawtooth', duration: 0.7, gain: 0.16 });
  // Sparkle cluster - randomized high tones
  const c = AudioBus.getCtx();
  if (c) {
    for (let i = 0; i < 6; i++) {
      const delay = 100 + i * 50 + Math.random() * 40;
      const f = 1200 + Math.random() * 1600;
      setTimeout(() => tone({ freq: f, type: 'triangle', release: 0.20, gain: 0.10 }), delay);
    }
  }
  // Resolution chord (A major arpeggio).
  const notes = [440, 554.37, 659.25, 880];
  notes.forEach((f, i) => {
    setTimeout(() => tone({ freq: f, type: 'triangle', release: 0.55, gain: 0.18 }), 180 + i * 80);
  });
}

// Night flight failed - low ominous fall.
export function sfxRaidFailed(): void {
  sweep({ from: 220, to: 55, type: 'sawtooth', duration: 1.1, gain: 0.30 });
}

// Power-up effects -----------------------------------------------------

export function sfxNuke(): void {
  // Big low boom + sweep up to indicate the radial cleanse.
  sweep({ from: 80, to: 20, type: 'sine', duration: 0.55, gain: 0.42 });
  noise({ duration: 0.4, gain: 0.25 });
  sweep({ from: 240, to: 880, type: 'sawtooth', duration: 0.35, gain: 0.16 });
}

export function sfxMagnetBurst(): void {
  sweep({ from: 220, to: 1320, type: 'triangle', duration: 0.45, gain: 0.16 });
  tone({ freq: 1760, type: 'sine', attack: 0.01, release: 0.35, gain: 0.10 });
}

export function sfxLaserOverdrive(): void {
  // Two stacked higher tones, decay slowly (the Spell Overdrive surge).
  tone({ freq: 880, type: 'sawtooth', attack: 0.005, release: 0.5, gain: 0.14 });
  tone({ freq: 1320, type: 'sawtooth', attack: 0.005, release: 0.5, gain: 0.10, detune: 12 });
}

export function sfxFreezePulse(): void {
  // Glassy chime with detune for cold shimmer.
  tone({ freq: 1480, type: 'triangle', attack: 0.005, release: 0.35, gain: 0.16 });
  tone({ freq: 2960, type: 'sine', attack: 0.005, release: 0.45, gain: 0.08, detune: 8 });
  tone({ freq: 740, type: 'sine', attack: 0.005, release: 0.45, gain: 0.06 });
}

export function sfxShieldGrant(): void {
  tone({ freq: 660, type: 'triangle', attack: 0.005, release: 0.25, gain: 0.14 });
  tone({ freq: 990, type: 'sine', attack: 0.005, release: 0.30, gain: 0.10 });
}

export function sfxTimeBonus(): void {
  tone({ freq: 880, type: 'triangle', attack: 0.005, release: 0.18, gain: 0.16 });
  setTimeout(() => tone({ freq: 1320, type: 'triangle', release: 0.20, gain: 0.18 }), 60);
}

// Garden moonwell drops a Stardust pickup.
export function sfxGeneratorProduce(): void {
  tone({ freq: 780, type: 'square', attack: 0.002, release: 0.05, gain: 0.06 });
}
