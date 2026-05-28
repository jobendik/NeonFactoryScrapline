// Music engine — real streamed tracks (no procedural synthesis).
//
// Loads the Suno-generated mp3 loops, decodes them via Web Audio, and plays
// them as looping AudioBufferSourceNodes routed through AudioBus.musicBus() so
// the user volume + mute controls (and platform/ad ducking) apply uniformly.
//
// Public API is unchanged from the old synth engine so callers don't change:
//   startTheme()   — main theme (boot / loading)
//   startFactory() — garden hub loop
//   startRaid()    — night-flight: cruise + intense layers, blended by
//                    setIntensity(tension, danger)
//   setIntensity() — cross-fades the two flight layers as danger rises
//   stop()         — fade everything out (idle)
//
// Tracks live in public/assets/audio/ and are referenced by URL (kept out of
// the JS bundle). Files are large-ish mp3s; loops are not sample-accurate
// gapless, but the crossfades hide the seam well enough for a web game.

import { AudioBus } from './AudioBus';

type TrackKey = 'theme' | 'hub' | 'flight' | 'flightIntense';

function audioBase(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base}assets/audio/`;
}

const TRACK_FILES: Record<TrackKey, string> = {
  theme: 'music-theme.mp3',
  hub: 'music-hub.mp3',
  flight: 'music-flight.mp3',
  flightIntense: 'music-flight-intense.mp3',
};

interface Voice {
  key: TrackKey;
  src: AudioBufferSourceNode;
  gain: GainNode;
  target: number;
}

type Mode = 'idle' | 'theme' | 'factory' | 'raid';

const FADE_IN = 1.1;
const FADE_OUT = 0.8;
const LAYER_RAMP = 0.45;

class MusicEngineImpl {
  private mode: Mode = 'idle';
  private buffers = new Map<TrackKey, AudioBuffer>();
  private loading = new Map<TrackKey, Promise<AudioBuffer | null>>();
  private voices: Voice[] = [];
  // Bumped on every mode change so async loads that resolve late can bail
  // instead of starting a track the player has already left behind.
  private gen = 0;
  // Latest requested flight blend (applied once the layers exist).
  private intensity = 0;

  startTheme(): void {
    if (this.mode === 'theme') return;
    this.mode = 'theme';
    const g = ++this.gen;
    this.fadeOutAll();
    void this.startVoice('theme', 1, g);
  }

  startFactory(): void {
    if (this.mode === 'factory') return;
    this.mode = 'factory';
    const g = ++this.gen;
    this.fadeOutAll();
    void this.startVoice('hub', 1, g);
  }

  startRaid(): void {
    if (this.mode === 'raid') return;
    this.mode = 'raid';
    this.intensity = 0;
    const g = ++this.gen;
    this.fadeOutAll();
    // Cruise bed always on; intense layer rides in via setIntensity().
    void this.startVoice('flight', 1, g);
    void this.startVoice('flightIntense', 0.0001, g);
  }

  stop(): void {
    this.mode = 'idle';
    this.gen++;
    this.fadeOutAll();
  }

  // Cross-fade the two flight layers. Called每 frame by RaidScene from HP /
  // glimmer / enemy-count thresholds. Only meaningful in raid mode.
  setIntensity(tension: number, danger: number): void {
    if (this.mode !== 'raid') return;
    const level = clamp01(Math.max(tension * 0.85, danger));
    this.intensity = level;
    // Keep a little cruise bed under the intense layer so it never drops out
    // entirely; the intense layer rises to full as danger peaks.
    this.setLayerGain('flight', Math.max(0.12, 1 - level * 0.9));
    this.setLayerGain('flightIntense', level);
  }

  // ---- internals ----

  private async ensureBuffer(key: TrackKey): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const inflight = this.loading.get(key);
    if (inflight) return inflight;
    const ctx = AudioBus.getCtx();
    if (!ctx) return null;
    const url = audioBase() + TRACK_FILES[key];
    const p = (async (): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(data);
        this.buffers.set(key, buf);
        return buf;
      } catch {
        return null; // missing/unsupported file — stay silent, never crash.
      } finally {
        this.loading.delete(key);
      }
    })();
    this.loading.set(key, p);
    return p;
  }

  private async startVoice(key: TrackKey, target: number, g: number): Promise<void> {
    const ctx = AudioBus.getCtx();
    const bus = AudioBus.musicBus();
    if (!ctx || !bus) return;
    AudioBus.resume();
    const buffer = await this.ensureBuffer(key);
    // The player moved on while we were decoding — abort.
    if (!buffer || g !== this.gen) return;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(bus);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gain);
    try {
      src.start();
    } catch {
      return;
    }
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + FADE_IN);
    this.voices.push({ key, src, gain, target });

    // If this is a flight layer, immediately reconcile with the latest
    // requested intensity (setIntensity may have fired before we loaded).
    if (this.mode === 'raid' && (key === 'flight' || key === 'flightIntense')) {
      this.setIntensity(this.intensity, this.intensity);
    }
  }

  private setLayerGain(key: TrackKey, target: number): void {
    const ctx = AudioBus.getCtx();
    if (!ctx) return;
    const voice = this.voices.find(v => v.key === key);
    if (!voice) return;
    if (Math.abs(voice.target - target) < 0.01) return;
    voice.target = target;
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + LAYER_RAMP);
  }

  private fadeOutAll(): void {
    const ctx = AudioBus.getCtx();
    const voices = this.voices;
    this.voices = [];
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const v of voices) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT);
        v.src.stop(now + FADE_OUT + 0.1);
      } catch {
        // already stopped — ignore.
      }
    }
  }
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export const MusicEngine = new MusicEngineImpl();
