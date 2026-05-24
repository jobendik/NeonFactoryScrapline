// Adaptive music per blueprint §20.4. Three layers (base / tension / danger)
// run as continuous synthesized pads with their own gain nodes. Cross-fade
// is driven by setIntensity({tension, danger}) - typically called by
// RaidScene each frame based on HP% and Greed step.
//
// Implementation note: each layer is a pair of detuned oscillators (sine +
// triangle) feeding through a slow tremolo LFO into a per-layer gain.
// Frequencies and tremolo speeds rise with intensity, so each layer feels
// progressively more agitated.
//
// Music output routes through AudioBus.musicBus() so user volume + mute
// controls apply uniformly.

import { AudioBus } from './AudioBus';

interface Layer {
  // Tone-generating nodes - active while the music is running.
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  // Tremolo LFO + amp.
  lfo: OscillatorNode;
  lfoGain: GainNode;
  // Final mix gain. Cross-faded by setIntensity.
  layerGain: GainNode;
  targetGain: number;
}

interface ChordVoice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  envGain: GainNode;
}

interface ChordLayerSpec {
  fundamental: number;
  octaveShift: number;
  detuneCents: number;
  typeA: OscillatorType;
  typeB: OscillatorType;
  notesCents: number[];
}

const FACTORY_LAYER: ChordLayerSpec = {
  fundamental: 196.0, // G3
  octaveShift: 0,
  detuneCents: 5,
  typeA: 'sine',
  typeB: 'triangle',
  notesCents: [0, 700, 1200, 1900], // root, fifth, octave, octave+fifth
};

const BASE_LAYER: ChordLayerSpec = {
  fundamental: 174.61, // F3
  octaveShift: 0,
  detuneCents: 3,
  typeA: 'sine',
  typeB: 'triangle',
  notesCents: [0, 500, 1200], // power + octave
};

const TENSION_LAYER: ChordLayerSpec = {
  fundamental: 207.65, // G#3
  octaveShift: 0,
  detuneCents: 8,
  typeA: 'sawtooth',
  typeB: 'triangle',
  notesCents: [0, 600, 900, 1500], // dim-ish
};

const DANGER_LAYER: ChordLayerSpec = {
  fundamental: 110.0, // A2
  octaveShift: 0,
  detuneCents: 14,
  typeA: 'sawtooth',
  typeB: 'square',
  notesCents: [0, 100, 800], // halftone clash + sixth
};

type MusicMode = 'idle' | 'raid' | 'factory';

class MusicEngineImpl {
  private mode: MusicMode = 'idle';
  private base: Layer | null = null;
  private tension: Layer | null = null;
  private danger: Layer | null = null;
  // Chord progression scheduler - runs while music is playing.
  private chordTimer: number | null = null;
  private chordStep = 0;

  startRaid(): void {
    if (this.mode === 'raid') return;
    this.stopInternal();
    if (!AudioBus.musicBus()) return;
    this.base = this.buildLayer(BASE_LAYER, 0.4, 0.28);
    this.tension = this.buildLayer(TENSION_LAYER, 1.1, 0);
    this.danger = this.buildLayer(DANGER_LAYER, 2.2, 0);
    this.mode = 'raid';
    this.scheduleChord();
  }

  startFactory(): void {
    if (this.mode === 'factory') return;
    this.stopInternal();
    if (!AudioBus.musicBus()) return;
    this.base = this.buildLayer(FACTORY_LAYER, 0.3, 0.22);
    this.mode = 'factory';
    this.scheduleChord();
  }

  stop(): void {
    this.stopInternal();
    this.mode = 'idle';
  }

  // Drive the cross-fade. Values clamped to [0,1]. Called each frame by
  // RaidScene as HP/Greed/enemy-count thresholds cross.
  setIntensity(tension: number, danger: number): void {
    if (this.mode !== 'raid') return;
    if (this.tension) this.fadeLayer(this.tension, this.clamp01(tension) * 0.34);
    if (this.danger) this.fadeLayer(this.danger, this.clamp01(danger) * 0.40);
  }

  private clamp01(v: number): number {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  // Build one layer: two detuned oscillators -> per-osc gain -> layer gain.
  // A tremolo LFO modulates the layer gain so the pad has motion.
  private buildLayer(spec: ChordLayerSpec, tremoloHz: number, initialGain: number): Layer | null {
    const c = AudioBus.getCtx();
    const bus = AudioBus.musicBus();
    if (!c || !bus) return null;

    const layerGain = c.createGain();
    layerGain.gain.value = 0.0001;
    layerGain.connect(bus);

    const oscA = c.createOscillator();
    const oscB = c.createOscillator();
    oscA.type = spec.typeA;
    oscB.type = spec.typeB;
    oscA.frequency.value = spec.fundamental;
    oscB.frequency.value = spec.fundamental;
    oscB.detune.value = spec.detuneCents;

    const oscGain = c.createGain();
    oscGain.gain.value = 0.0; // silenced until a chord-voice plays
    oscA.connect(oscGain);
    oscB.connect(oscGain);
    oscGain.connect(layerGain);

    // Tremolo LFO
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = tremoloHz;
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(layerGain.gain);

    const now = c.currentTime;
    oscA.start(now);
    oscB.start(now);
    lfo.start(now);

    const layer: Layer = {
      oscA,
      oscB,
      lfo,
      lfoGain,
      layerGain,
      targetGain: initialGain,
    };
    layerGain.gain.cancelScheduledValues(now);
    layerGain.gain.linearRampToValueAtTime(initialGain, now + 0.6);
    // Voice the layer's drone gain - pad uses the oscillator-summed gain.
    oscGain.gain.cancelScheduledValues(now);
    oscGain.gain.linearRampToValueAtTime(0.18, now + 0.4);
    return layer;
  }

  // Simple chord-step generator: every ~3.4s, shift the root by one step in
  // a slow progression. Keeps the loop from feeling static.
  private scheduleChord(): void {
    if (this.chordTimer !== null) window.clearInterval(this.chordTimer);
    this.chordStep = 0;
    this.chordTimer = window.setInterval(() => this.nextChord(), 3400);
  }

  private nextChord(): void {
    const c = AudioBus.getCtx();
    if (!c) return;
    const now = c.currentTime;
    // Step the root through a small interval pattern (semitones).
    const steps = [0, -3, -5, -2];
    this.chordStep = (this.chordStep + 1) % steps.length;
    const semis = steps[this.chordStep];
    const detune = semis * 100;
    for (const layer of [this.base, this.tension, this.danger]) {
      if (!layer) continue;
      layer.oscA.detune.cancelScheduledValues(now);
      layer.oscB.detune.cancelScheduledValues(now);
      layer.oscA.detune.linearRampToValueAtTime(detune, now + 1.2);
      layer.oscB.detune.linearRampToValueAtTime(detune + 8, now + 1.2);
    }
  }

  private fadeLayer(layer: Layer, target: number): void {
    const c = AudioBus.getCtx();
    if (!c) return;
    if (Math.abs(layer.targetGain - target) < 0.01) return;
    layer.targetGain = target;
    const now = c.currentTime;
    layer.layerGain.gain.cancelScheduledValues(now);
    layer.layerGain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + 0.5);
  }

  private stopInternal(): void {
    if (this.chordTimer !== null) {
      window.clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    const c = AudioBus.getCtx();
    if (!c) {
      this.base = this.tension = this.danger = null;
      return;
    }
    const now = c.currentTime;
    for (const layer of [this.base, this.tension, this.danger]) {
      if (!layer) continue;
      try {
        layer.layerGain.gain.cancelScheduledValues(now);
        layer.layerGain.gain.linearRampToValueAtTime(0.0001, now + 0.35);
        layer.oscA.stop(now + 0.45);
        layer.oscB.stop(now + 0.45);
        layer.lfo.stop(now + 0.45);
      } catch {
        // already-stopped oscillator throws on stop(); ignore.
      }
    }
    this.base = this.tension = this.danger = null;
  }
}

export const MusicEngine = new MusicEngineImpl();

// Eliminate unused-warning churn - ChordVoice may grow in a later pass.
export type _ChordVoice = ChordVoice;
