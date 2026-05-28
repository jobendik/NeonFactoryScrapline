// FactoryWorker — autonomous "Hauler" entity that continuously collects scrap
// from the factory floor and delivers it to the deposit point.
//
// Visual: amber/orange body (~20 px), carry-cube offset above when loaded.
// Trail at level >= trailLevelUnlock.
//
// Locomotion uses direct setPosition() (no Arcade Physics) identical to
// how Drone.ts moves, keeping these lightweight.
//
// State machine: 'searching' → 'movingToPickup' → 'movingToDeposit' → 'depositing'
//
// Callers (WorkerSystem) must call destroy() when the worker is no longer needed.

import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { applyGlow } from '../systems/NeonFX';
import type { Pickup } from './Pickup';

export const WORKER_BODY_KEY = 'worker-body';
export const WORKER_CARRY_KEY = 'worker-carry';

export type WorkerState = 'searching' | 'movingToPickup' | 'movingToDeposit' | 'depositing';

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

// Worker color palette — amber/orange to distinguish from cyan player/drones.
const COLOR_FILL_A = '#ffb347';   // top gradient
const COLOR_FILL_B = '#e06000';   // bottom gradient
const COLOR_GLOW   = 0xff8800;    // Phaser hex glow tint
const COLOR_CARRY  = 0x22f6ff;    // carry-cube: same cyan as scrap pickups
const MAX_TRAIL_AGE = 0.5;

export class FactoryWorker {
  private sprite: Phaser.GameObjects.Sprite;
  private carryCube: Phaser.GameObjects.Sprite;
  private trailGfx: Phaser.GameObjects.Graphics | null = null;
  private trail: TrailPoint[] = [];

  state: WorkerState = 'searching';
  x = 0;
  y = 0;

  // Target pickup being pursued (null when searching / depositing).
  targetPickup: Pickup | null = null;
  // Accumulated carry value (scrap value of the picked-up items).
  carryValue = 0;
  // Max items this worker can carry per trip (1 or 2 per UpgradeEffects.workerCarry).
  carryCapacity = 1;
  // Pause timer after depositing before searching again.
  private depositPause = 0;
  // Separation nudge accumulator (applied after movement this frame).
  nudgeX = 0;
  nudgeY = 0;

  private speed = 0;
  private pickupRadius = 0;
  // Wander target used in 'searching' state when no scrap is visible.
  private wanderX = 0;
  private wanderY = 0;
  private wanderTimer = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    speed: number,
    pickupRadius: number,
    carryCapacity: number,
    withTrail: boolean,
  ) {
    FactoryWorker.ensureTextures(scene);

    this.x = x;
    this.y = y;
    this.speed = speed;
    this.pickupRadius = pickupRadius;
    this.carryCapacity = carryCapacity;

    this.sprite = scene.add.sprite(x, y, WORKER_BODY_KEY);
    this.sprite.setDepth(3);
    applyGlow(this.sprite, COLOR_GLOW, 3, 0);

    this.carryCube = scene.add.sprite(x, y - 14, WORKER_CARRY_KEY);
    this.carryCube.setDepth(4);
    this.carryCube.setVisible(false);

    if (withTrail) {
      this.trailGfx = scene.add.graphics();
      this.trailGfx.setDepth(2);
    }

    // Pick a random initial wander destination near the generators.
    this.pickNewWanderTarget();
  }

  // Move to position (called after locomotion to sync sprite).
  private syncSprite(): void {
    this.sprite.setPosition(this.x, this.y);
    this.carryCube.setPosition(this.x, this.y - 14);
  }

  private pickNewWanderTarget(): void {
    const gpos = Balance.factory.generatorPositions;
    const base = gpos[Math.floor(Math.random() * gpos.length)];
    const r = Balance.workers.wanderRadius;
    this.wanderX = base.x + (Math.random() * 2 - 1) * r;
    this.wanderY = base.y + (Math.random() * 2 - 1) * r;
    this.wanderTimer = 2.5 + Math.random() * 2;
  }

  // ---- called by WorkerSystem each frame ----

  update(
    dt: number,
    pickups: Pickup[],
    depositX: number,
    depositY: number,
    depositRange: number,
  ): 'deposited' | null {
    // Apply separation nudge before anything else.
    if (this.nudgeX !== 0 || this.nudgeY !== 0) {
      this.x += this.nudgeX * dt * this.speed * 0.5;
      this.y += this.nudgeY * dt * this.speed * 0.5;
      this.nudgeX = 0;
      this.nudgeY = 0;
    }

    if (this.depositPause > 0) {
      this.depositPause -= dt;
      if (this.depositPause <= 0) this.state = 'searching';
    }

    let result: 'deposited' | null = null;

    switch (this.state) {
      case 'searching':
        result = this.tickSearching(dt, pickups, depositX, depositY);
        break;
      case 'movingToPickup':
        result = this.tickMovingToPickup(dt, pickups, depositX, depositY);
        break;
      case 'movingToDeposit':
        result = this.tickMovingToDeposit(dt, depositX, depositY, depositRange);
        break;
      case 'depositing':
        // depositing is handled externally by WorkerSystem; we just hold.
        break;
    }

    this.syncSprite();
    this.carryCube.setVisible(this.carryValue > 0);

    // Trail update.
    if (this.trailGfx) {
      this.trail.push({ x: this.x, y: this.y, age: 0 });
      for (const p of this.trail) p.age += dt;
      while (this.trail.length > 0 && this.trail[0].age >= MAX_TRAIL_AGE) this.trail.shift();
      this.trailGfx.clear();
      for (let i = 1; i < this.trail.length; i++) {
        const prev = this.trail[i - 1];
        const cur = this.trail[i];
        const alpha = (1 - cur.age / MAX_TRAIL_AGE) * 0.65;
        this.trailGfx.lineStyle(2, COLOR_GLOW, alpha);
        this.trailGfx.lineBetween(prev.x, prev.y, cur.x, cur.y);
      }
    }

    return result;
  }

  private moveToward(tx: number, ty: number, dt: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const step = Math.min(this.speed * dt, dist);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    // Subtle bob rotation so the worker looks alive.
    this.sprite.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
  }

  private tickSearching(
    dt: number,
    pickups: Pickup[],
    depositX: number,
    depositY: number,
  ): 'deposited' | null {
    // If already carrying maximum, head straight to deposit.
    if (this.carryValue >= this.carryCapacity) {
      this.state = 'movingToDeposit';
      return null;
    }

    // Find the nearest active scrap pickup within pickupRadius.
    let best: Pickup | null = null;
    let bestDist = this.pickupRadius;
    for (const p of pickups) {
      if (!p.active || p.type !== 'scrap') continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestDist) { bestDist = d; best = p; }
    }

    if (best) {
      this.targetPickup = best;
      this.state = 'movingToPickup';
      return null;
    }

    // No scrap visible — wander near the generators so the worker looks busy.
    this.wanderTimer -= dt;
    const wx = this.wanderX, wy = this.wanderY;
    const distToWander = Math.hypot(wx - this.x, wy - this.y);
    if (distToWander > 6) {
      this.moveToward(wx, wy, dt);
    }
    if (this.wanderTimer <= 0 || distToWander < 6) {
      this.pickNewWanderTarget();
    }

    // Opportunistically pick up scrap directly underfoot while wandering.
    return this.tryClaimPickup(pickups, depositX, depositY);
  }

  private tickMovingToPickup(
    dt: number,
    pickups: Pickup[],
    depositX: number,
    depositY: number,
  ): 'deposited' | null {
    const p = this.targetPickup;
    // Target may have been collected by another entity.
    if (!p || !p.active) {
      this.targetPickup = null;
      this.state = 'searching';
      return null;
    }

    // Move toward pickup.
    this.moveToward(p.x, p.y, dt);

    // Check if we're close enough to claim it.
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d <= 16) {
      this.claimPickup(p);
      this.targetPickup = null;
      if (this.carryValue >= this.carryCapacity) {
        this.state = 'movingToDeposit';
      } else {
        this.state = 'searching';
      }
    }

    return this.tryClaimPickup(pickups, depositX, depositY);
  }

  private tickMovingToDeposit(
    dt: number,
    depositX: number,
    depositY: number,
    depositRange: number,
  ): 'deposited' | null {
    this.moveToward(depositX, depositY, dt);
    const d = Math.hypot(depositX - this.x, depositY - this.y);
    if (d <= depositRange) {
      this.state = 'depositing';
      return 'deposited';
    }
    return null;
  }

  // Try to pick up any active scrap directly under the worker (opportunistic).
  private tryClaimPickup(pickups: Pickup[], _depositX: number, _depositY: number): 'deposited' | null {
    if (this.carryValue >= this.carryCapacity) {
      this.state = 'movingToDeposit';
      return null;
    }
    for (const p of pickups) {
      if (!p.active || p.type !== 'scrap') continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d <= 14) {
        this.claimPickup(p);
        if (this.carryValue >= this.carryCapacity) {
          this.state = 'movingToDeposit';
        }
        break;
      }
    }
    return null;
  }

  private claimPickup(p: Pickup): void {
    this.carryValue += p.value;
    p.kill();
  }

  // Called by WorkerSystem after 'depositing' is received to reset the trip.
  finishDeposit(): number {
    const value = this.carryValue;
    this.carryValue = 0;
    this.depositPause = Balance.workers.depositPauseSec;
    this.state = 'searching';
    return value;
  }

  destroy(): void {
    this.sprite.destroy();
    this.carryCube.destroy();
    if (this.trailGfx) this.trailGfx.destroy();
  }

  // ---- static texture builder (called once per scene) ----

  static ensureTextures(scene: Phaser.Scene): void {
    // Worker body — rounded amber hexagon with bright pip.
    if (!scene.textures.exists(WORKER_BODY_KEY)) {
      const dim = 22;
      const tex = scene.textures.createCanvas(WORKER_BODY_KEY, dim, dim);
      if (tex) {
        const ctx = tex.context;
        const cx = dim / 2;
        const cy = dim / 2;
        // Soft glow halo.
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
        halo.addColorStop(0, 'rgba(255,140,0,0.55)');
        halo.addColorStop(0.5, 'rgba(255,140,0,0.22)');
        halo.addColorStop(1, 'rgba(255,140,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, dim, dim);
        // Rounded-square body.
        const r = 5;
        const m = 4;
        ctx.beginPath();
        ctx.moveTo(cx - r, m);
        ctx.arcTo(cx + r + m - 1, m, cx + r + m - 1, cy + r + m - 1, r);
        ctx.arcTo(cx + r + m - 1, dim - m, cx - r, dim - m, r);
        ctx.arcTo(m, dim - m, m, cy - r, r);
        ctx.arcTo(m, m, cx - r, m, r);
        ctx.closePath();
        const body = ctx.createLinearGradient(cx, m, cx, dim - m);
        body.addColorStop(0, COLOR_FILL_A);
        body.addColorStop(1, COLOR_FILL_B);
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,130,0.9)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Bright center pip.
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        tex.refresh();
      }
    }

    // Carry cube — tiny cyan square (scrap look).
    if (!scene.textures.exists(WORKER_CARRY_KEY)) {
      const dim = 9;
      const tex = scene.textures.createCanvas(WORKER_CARRY_KEY, dim, dim);
      if (tex) {
        const ctx = tex.context;
        ctx.fillStyle = '#' + COLOR_CARRY.toString(16).padStart(6, '0');
        ctx.fillRect(1, 1, dim - 2, dim - 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, dim - 2, dim - 2);
        tex.refresh();
      }
    }
  }
}
