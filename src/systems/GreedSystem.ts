import { Balance } from '../config/Balance';
import { bus, Events } from '../core/EventBus';

// GreedSystem per blueprint §7.3. Starts ticking the moment the moongate
// opens; the multiplier reads off Balance.raid.greedSteps as a step function of
// seconds-since-open. The multiplier composes on top of combo (which already
// scales pickup value during the night flight): combo is "did you chain defeats?" and
// glimmer is "did you gamble by lingering in the garden?". Both apply at the moment you fly home.

export class GreedSystem {
  private elapsed = 0;
  private running = false;
  private lastEmittedMult = 1.0;

  start(): void {
    this.elapsed = 0;
    this.running = true;
    this.lastEmittedMult = 1.0;
  }

  stop(): void {
    this.running = false;
  }

  reset(): void {
    this.elapsed = 0;
    this.running = false;
    this.lastEmittedMult = 1.0;
  }

  update(dt: number): void {
    if (!this.running) return;
    this.elapsed += dt;
    const mult = this.computeMultiplier();
    if (mult !== this.lastEmittedMult) {
      this.lastEmittedMult = mult;
      bus.emit(Events.GREED_CHANGED, mult);
    }
  }

  getMultiplier(): number {
    return this.computeMultiplier();
  }

  isRunning(): boolean {
    return this.running;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  // Step index 0..N-1 matching Balance.raid.greedSteps and the parallel
  // Balance.raid.greedEscalation table (the glimmer escalation). 0 = inactive / not yet started.
  // M14 systems (WaveDirector escalation, HUD vignette, etc.) read this
  // each frame and apply step-keyed effects.
  getStep(): number {
    if (!this.running) return 0;
    let step = 0;
    const steps = Balance.raid.greedSteps;
    for (let i = 0; i < steps.length; i++) {
      if (this.elapsed >= steps[i].afterSeconds) step = i;
    }
    return step;
  }

  private computeMultiplier(): number {
    let mult = 1.0;
    for (const step of Balance.raid.greedSteps) {
      if (this.elapsed >= step.afterSeconds) mult = step.mult;
    }
    return mult;
  }
}
