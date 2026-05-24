// Audio bus per blueprint §20. The whole audio layer is synthesized via
// Web Audio oscillators - no external assets, no Phaser SoundManager asset
// loading. We *do* honor Phaser's game.sound.mute as a global override so
// CrazyGames SDK mute events (which historically route through Phaser's
// sound system) still flip everything off.
//
// Three channels: master / music / sfx. Each is a GainNode in a fixed chain:
//
//   sound -> sfxGain   --\
//                          --> masterGain -> destination
//   music -> musicGain --/
//
// AudioContext is created lazily on first user-initiated sound, since
// browsers gate AudioContext creation until a user gesture.

type AudioContextCtor = new () => AudioContext;

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

const DEFAULT_VOLUMES: AudioVolumes = {
  master: 0.7,
  music: 0.5,
  sfx: 0.85,
};

class AudioBusImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private volumes: AudioVolumes = { ...DEFAULT_VOLUMES };
  private muted = false;
  private platformMute = false;

  // Creates the AudioContext + gain chain on first use. Callers that produce
  // sound should call getCtx() and bail if it returns null (browser refused
  // before a user gesture).
  getCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      AudioContext?: AudioContextCtor;
      webkitAudioContext?: AudioContextCtor;
    };
    const C = w.AudioContext ?? w.webkitAudioContext;
    if (!C) return null;
    try {
      this.ctx = new C();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes(0);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  // Audio nodes for SFX/music synth code to connect into. Returns null if
  // the context isn't ready (no user gesture yet); callers should bail.
  sfxBus(): GainNode | null {
    if (!this.getCtx()) return null;
    return this.sfxGain;
  }

  musicBus(): GainNode | null {
    if (!this.getCtx()) return null;
    return this.musicGain;
  }

  setVolume(channel: keyof AudioVolumes, value: number): void {
    this.volumes[channel] = Math.max(0, Math.min(1, value));
    this.applyVolumes();
  }

  getVolume(channel: keyof AudioVolumes): number {
    return this.volumes[channel];
  }

  getVolumes(): AudioVolumes {
    return { ...this.volumes };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted || this.platformMute;
  }

  // SDKBridge mute hook (stubbed). When the platform tells us to mute (e.g.
  // CrazyGames ad starting), we duck the master without touching the user's
  // muted-by-checkbox state.
  setPlatformMute(muted: boolean): void {
    this.platformMute = muted;
    this.applyVolumes();
  }

  // Ensures audio is unlocked: AudioContexts often start in "suspended" until
  // a user gesture. Call after the first input event.
  resume(): void {
    const c = this.ctx;
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  // Apply current volumes to the gain nodes. rampSec smooths volume changes
  // so slider drags don't pop.
  private applyVolumes(rampSec: number = 0.05): void {
    const c = this.ctx;
    if (!c || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const muteFactor = this.isMuted() ? 0 : 1;
    const now = c.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.cancelScheduledValues(now);
    this.sfxGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(
      Math.max(0.0001, this.volumes.master * muteFactor),
      now + rampSec,
    );
    this.musicGain.gain.linearRampToValueAtTime(
      Math.max(0.0001, this.volumes.music),
      now + rampSec,
    );
    this.sfxGain.gain.linearRampToValueAtTime(
      Math.max(0.0001, this.volumes.sfx),
      now + rampSec,
    );
  }
}

export const AudioBus = new AudioBusImpl();
