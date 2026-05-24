import { Balance } from '../config/Balance';
import { saveSystem } from '../platform/SaveSystem';
import type { QualityPreset } from '../platform/SaveSystem';
import { bus, Events } from '../core/EventBus';

// QualityManager — central read for Low/Medium/High preset values per §24.3.
// Stateless on the read side; configuration lives in SaveData.settings.
// Auto-detect logic (§24.4) is a separate tick() driven by HUDScene each
// frame against the rolling FPS average.

interface FpsWindow {
  // Time since the window started accumulating samples (sec).
  elapsed: number;
  // Running average FPS over the window.
  avgFps: number;
  samples: number;
}

const DOWNGRADE_TOAST = 'Performance mode enabled';
const UPGRADE_PROMPT_LABEL = 'High quality available';

// Strongly typed preset getter. Falls back to default if SaveData has a
// stray value (e.g. user edited storage by hand).
function readPreset(): QualityPreset {
  const v = saveSystem.get().settings.qualityPreset;
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return Balance.quality.defaultPreset;
}

class QualityManagerImpl {
  private down: FpsWindow = { elapsed: 0, avgFps: 60, samples: 0 };
  private up: FpsWindow = { elapsed: 0, avgFps: 60, samples: 0 };
  private toastQueued: string | null = null;

  getPreset(): QualityPreset {
    return readPreset();
  }

  // True when the user has explicitly opted in to auto-detect.
  isAutoDetectEnabled(): boolean {
    return saveSystem.get().settings.qualityAutoDetect;
  }

  setAutoDetectEnabled(on: boolean): void {
    saveSystem.get().settings.qualityAutoDetect = on;
    if (!on) this.resetWindows();
  }

  // User-driven preset change (from SettingsMenu). Persists immediately so
  // a refresh keeps the choice. Emits QUALITY_CHANGED so listeners (HUD,
  // RaidScene caps) can update without polling.
  setPreset(preset: QualityPreset, source: 'user' | 'auto' = 'user'): void {
    const save = saveSystem.get();
    if (save.settings.qualityPreset === preset) return;
    const previous = save.settings.qualityPreset;
    save.settings.qualityPreset = preset;
    if (source === 'auto') this.resetWindows();
    bus.emit(Events.QUALITY_CHANGED, preset, previous, source);
  }

  // ---- Live config reads ----

  // Max simultaneous enemies. WaveDirector consumes this each frame so a
  // mid-raid downgrade takes effect immediately. Capped by the absolute
  // ceiling in Balance.enemies.maxOnScreen.
  enemyCap(): number {
    const preset = readPreset();
    return Math.min(Balance.enemies.maxOnScreen, Balance.quality.presets[preset].enemyCap);
  }

  // Scale a base particle quantity down for lower presets. ParticleEffects
  // callers pass the raw count from Balance.particles; this is the gate.
  particleQuantity(baseQuantity: number): number {
    const preset = readPreset();
    const cap = Balance.quality.presets[preset].maxParticles;
    const ratio = cap / Balance.quality.presets.high.maxParticles;
    return Math.max(1, Math.floor(baseQuantity * ratio));
  }

  parallaxLayers(): number {
    const preset = readPreset();
    return Balance.quality.presets[preset].parallaxLayers;
  }

  glowEnabled(): boolean {
    const preset = readPreset();
    return Balance.quality.presets[preset].glow;
  }

  dprCap(): number {
    const preset = readPreset();
    return Balance.quality.presets[preset].dprCap;
  }

  // Reduced-motion toggle (Suggestions audit P1-6). When true, callers should
  // suppress / scale down screen shake, vignette pulses, and big particle
  // bursts. Stored on save settings so the choice persists; defaults on for
  // OS-level prefers-reduced-motion.
  isReducedMotion(): boolean {
    return saveSystem.get().settings.reducedMotion === true;
  }

  setReducedMotion(on: boolean): void {
    saveSystem.get().settings.reducedMotion = on;
  }

  // Multiplier callers can apply to camera-shake intensity, particle counts,
  // etc. Returns 0 to fully disable, or 1 for full intensity. Use this in
  // hot loops instead of branching on isReducedMotion().
  motionScale(): number {
    return this.isReducedMotion() ? 0 : 1;
  }

  // ---- Auto-detect tick ----

  // Called by HUDScene each frame with current FPS. Keeps a rolling average
  // over the §24.4 windows. Returns a toast string when a state change just
  // fired (e.g. "Performance mode enabled" after dropping to Low) so the
  // caller can render a tiny popup; null otherwise.
  tick(dt: number, fps: number): string | null {
    if (!this.isAutoDetectEnabled()) return null;
    if (!Number.isFinite(fps) || fps <= 0) return null;
    const preset = readPreset();

    // Downgrade window: sustain <40fps for autoDowngradeWindowSec → drop to Low.
    this.advanceWindow(this.down, dt, fps);
    const downSat = this.down.elapsed >= Balance.quality.autoDowngradeWindowSec;
    if (downSat && this.down.avgFps < Balance.quality.autoDowngradeBelowFps && preset !== 'low') {
      this.setPreset('low', 'auto');
      this.toastQueued = DOWNGRADE_TOAST;
    } else if (downSat) {
      this.resetWindow(this.down);
    }

    // Upgrade window: sustained >58fps for autoUpgradeWindowSec at Medium
    // → emit one-time offer. Auto-upgrade is NOT applied; we just flag the
    // possibility for the host to surface a prompt.
    this.advanceWindow(this.up, dt, fps);
    const upSat = this.up.elapsed >= Balance.quality.autoUpgradeWindowSec;
    const offered = saveSystem.get().settings.qualityUpgradeOffered;
    if (upSat && this.up.avgFps > Balance.quality.autoUpgradeAboveFps && preset === 'medium' && !offered) {
      saveSystem.get().settings.qualityUpgradeOffered = true;
      this.toastQueued = UPGRADE_PROMPT_LABEL;
    } else if (upSat) {
      this.resetWindow(this.up);
    }

    const t = this.toastQueued;
    this.toastQueued = null;
    return t;
  }

  // Returns the rolling-window FPS averages (for the performance overlay).
  getDebugSnapshot(): { avgDown: number; avgUp: number; elapsedDown: number; elapsedUp: number } {
    return {
      avgDown: this.down.avgFps,
      avgUp: this.up.avgFps,
      elapsedDown: this.down.elapsed,
      elapsedUp: this.up.elapsed,
    };
  }

  private advanceWindow(w: FpsWindow, dt: number, fps: number): void {
    w.elapsed += dt;
    w.samples += 1;
    // Exponential moving average — bias toward recent frames so a brief
    // 60fps gap doesn't reset a sustained dip immediately.
    const alpha = Math.min(1, dt / 0.5);
    w.avgFps = w.avgFps + (fps - w.avgFps) * alpha;
  }

  private resetWindow(w: FpsWindow): void {
    w.elapsed = 0;
    w.samples = 0;
  }

  private resetWindows(): void {
    this.resetWindow(this.down);
    this.resetWindow(this.up);
  }
}

export const QualityManager = new QualityManagerImpl();
