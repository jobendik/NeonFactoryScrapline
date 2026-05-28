import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { bus, Events } from '../core/EventBus';

// Moongate per blueprint §7.7:
//   - Opens at `openAt` seconds (20s normal, 18s tutorial).
//   - Player on the gate → fill rises, reaches 1.0 in `extractionHoldTime` seconds (5s).
//   - Player off the gate → fill decays at `extractionDecayRate` × fill rate (0.85×).
//   - At fill = 1: emit EXTRACTION_COMPLETE; scene handles flying home through the moongate.
//
// Rendering: closed gate is a dim yellow disc; open gate is bright green with a
// pulsing outline. Fill ring is a separate Graphics object so it can be redrawn
// cheaply each frame without recomputing the static base.

export type ExtractionState = 'closed' | 'open' | 'filling' | 'decaying' | 'extracting' | 'done';

export class ExtractionSystem {
  private padX: number;
  private padY: number;
  private padRadius: number;
  private openAt: number;
  private elapsed = 0;
  private fill = 0;
  private state: ExtractionState = 'closed';
  private base: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private pulse = 0;
  private alreadyEmittedOpen = false;
  // External slow factor applied to fill rate. Extract Jammer enemies in
  // range of the gate bring this below 1.0 each frame to slow the timer per
  // §14.1.
  private externalFillMult = 1;
  private holdTimeMult = 1;

  constructor(scene: Phaser.Scene, padX: number, padY: number, padRadius: number, openAt: number) {
    this.padX = padX;
    this.padY = padY;
    this.padRadius = padRadius;
    this.openAt = openAt;
    this.base = scene.add.graphics();
    this.base.setDepth(4);
    this.ring = scene.add.graphics();
    this.ring.setDepth(5);
    this.draw();
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (this.state === 'done' || this.state === 'extracting') {
      this.draw();
      return;
    }

    this.elapsed += dt;
    this.pulse += dt;

    if (this.state === 'closed') {
      if (this.elapsed >= this.openAt) {
        this.state = 'open';
        if (!this.alreadyEmittedOpen) {
          this.alreadyEmittedOpen = true;
          bus.emit(Events.EXTRACTION_OPENED);
        }
      }
    } else {
      const inside = this.isPlayerInside(playerX, playerY);
      const fillPerSec = 1 / (Balance.raid.extractionHoldTime * this.holdTimeMult);
      if (inside) {
        // Extract Jammer slow applies only to the fill direction; decay is
        // unaffected so leaving the gate still drains at the normal rate.
        this.fill = Math.min(1, this.fill + dt * fillPerSec * this.externalFillMult);
        this.state = 'filling';
      } else {
        this.fill = Math.max(0, this.fill - dt * fillPerSec * Balance.raid.extractionDecayRate);
        this.state = this.fill > 0 ? 'decaying' : 'open';
      }
      // Reset to 1.0 each frame — RaidScene re-applies the slow before the
      // next tick if Extract Jammers are still in range.
      this.externalFillMult = 1;
      if (this.fill >= 1) {
        this.state = 'extracting';
        bus.emit(Events.EXTRACTION_COMPLETE);
      }
    }

    this.draw();
  }

  finish(): void {
    this.state = 'done';
    this.draw();
  }

  isOpen(): boolean {
    return this.state !== 'closed';
  }

  isExtracting(): boolean {
    return this.state === 'extracting';
  }

  getFill(): number {
    return this.fill;
  }

  getState(): ExtractionState {
    return this.state;
  }

  getPadPosition(): { x: number; y: number } {
    return { x: this.padX, y: this.padY };
  }

  // Called by RaidScene each frame BEFORE update() — when an Extract Jammer
  // is in range of the gate, mult < 1.0 slows the fill rate. Reset to 1.0
  // after every update() so the next frame requires re-application.
  setExternalFillMult(mult: number): void {
    this.externalFillMult = Math.max(0, Math.min(1, mult));
  }

  setHoldTimeMult(mult: number): void {
    this.holdTimeMult = Math.max(0.1, mult);
  }

  destroy(): void {
    this.base.destroy();
    this.ring.destroy();
  }

  private isPlayerInside(px: number, py: number): boolean {
    const dx = px - this.padX;
    const dy = py - this.padY;
    return Math.hypot(dx, dy) <= this.padRadius;
  }

  private draw(): void {
    this.base.clear();
    this.ring.clear();

    if (this.state === 'closed') {
      // Dim yellow glow - "available later".
      this.base.fillStyle(Balance.colors.reward, 0.06);
      this.base.fillCircle(this.padX, this.padY, this.padRadius);
      this.base.lineStyle(2, Balance.colors.reward, 0.30);
      this.base.strokeCircle(this.padX, this.padY, this.padRadius);
      this.base.lineStyle(1, Balance.colors.reward, 0.18);
      this.base.strokeCircle(this.padX, this.padY, this.padRadius * 0.6);
      return;
    }

    const pulseScale = 1 + Math.sin(this.pulse * 4.2) * 0.05;
    this.base.fillStyle(Balance.colors.extraction, 0.16);
    this.base.fillCircle(this.padX, this.padY, this.padRadius);
    this.base.lineStyle(3, Balance.colors.extraction, 0.9);
    this.base.strokeCircle(this.padX, this.padY, this.padRadius * pulseScale);
    this.base.lineStyle(1, Balance.colors.extraction, 0.45);
    this.base.strokeCircle(this.padX, this.padY, this.padRadius * 0.55);

    if (this.fill > 0) {
      this.ring.lineStyle(6, Balance.colors.extraction, 1);
      const start = -Math.PI / 2;
      const end = start + this.fill * Math.PI * 2;
      this.ring.beginPath();
      this.ring.arc(this.padX, this.padY, this.padRadius * 0.82, start, end, false);
      this.ring.strokePath();
    }
  }
}
