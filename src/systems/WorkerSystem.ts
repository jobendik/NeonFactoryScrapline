// WorkerSystem — manages a pool of FactoryWorker (pixie) entities on the garden floor.
//
// Lifecycle:
//   WorkerSystem.init(scene)   — create pixies based on current upgrade level
//   WorkerSystem.update(dt)    — tick all pixies, handle deposits
//   WorkerSystem.rebuild()     — destroy + recreate pixies (called on upgrade purchase)
//   WorkerSystem.destroy()     — clean up on scene shutdown
//
// Economy:
//   On deposit, calls Economy.bankLoot(value, 0) so all multipliers (potion cauldron,
//   Star Heart) apply automatically — same hook as the player pickup overlap.
//   Also emits Events.WORKER_DELIVERED for UI feedback (popup, stat counter).

import Phaser from 'phaser';
import { FactoryWorker } from '../entities/FactoryWorker';
import type { Pickup } from '../entities/Pickup';
import { UpgradeEffects } from '../systems/UpgradeSystem';
import { Economy } from './EconomySystem';
import { Balance } from '../config/Balance';
import { saveSystem } from '../platform/SaveSystem';
import { bus, Events } from '../core/EventBus';

// Callback invoked when a pixie delivers a load; passes the stardust value and
// pixie position so the scene can show a worldpin popup.
export type OnWorkerDeliverCb = (deliveredValue: number, workerX: number, workerY: number) => void;

// Module-level state (no class needed — pattern matches EconomySystem).
let workers: FactoryWorker[] = [];
let activeScene: Phaser.Scene | null = null;
let deliverCb: OnWorkerDeliverCb | null = null;

export const WorkerSystem = {
  /** Create pixies from saved upgrade level. Call once from FactoryScene.create(). */
  init(scene: Phaser.Scene, onDeliver?: OnWorkerDeliverCb): void {
    activeScene = scene;
    deliverCb = onDeliver ?? null;
    spawnWorkers(scene);
  },

  /** Tick all pixies. Call from FactoryScene.update() every frame. */
  update(dt: number, pickups: Phaser.GameObjects.Group): void {
    const dep = Balance.factory.workerDepositPoint;
    const depRange = Balance.workers.depositRange;

    const activePickups = (pickups.getChildren() as Pickup[]).filter(p => p.active);

    applySeparation();

    for (const w of workers) {
      const result = w.update(dt, activePickups, dep.x, dep.y, depRange);
      if (result === 'deposited') {
        const value = w.finishDeposit();
        if (value > 0) {
          Economy.bankLoot(value, 0);
          bus.emit(Events.WORKER_DELIVERED, value);
          deliverCb?.(value, w.x, w.y);
        }
      }
    }
  },

  /** Destroy and re-create all pixies (e.g. after an upgrade purchase). */
  rebuild(): void {
    for (const w of workers) w.destroy();
    workers = [];
    if (activeScene) spawnWorkers(activeScene);
  },

  /** Tear down all pixies. Call from FactoryScene.shutdown(). */
  destroy(): void {
    for (const w of workers) w.destroy();
    workers = [];
    activeScene = null;
    deliverCb = null;
  },

  getWorkerCount(): number {
    return workers.length;
  },
};

// ---- private helpers ----

function spawnWorkers(scene: Phaser.Scene): void {
  const count = UpgradeEffects.workerCount();
  const speed = UpgradeEffects.workerSpeed();
  const radius = UpgradeEffects.workerRadius();
  const carry = UpgradeEffects.workerCarry();
  const workerLevel = saveSystem.get().upgrades.worker;
  const withTrail = workerLevel >= Balance.workers.trailLevelUnlock;

  const gpos = Balance.factory.generatorPositions;
  for (let i = 0; i < count; i++) {
    const base = gpos[i % gpos.length];
    const angle = (i / Math.max(1, count)) * Math.PI * 2;
    const startX = base.x + Math.cos(angle) * 44;
    const startY = base.y + Math.sin(angle) * 44;
    const w = new FactoryWorker(scene, startX, startY, speed, radius, carry, withTrail);
    workers.push(w);
  }
}

function applySeparation(): void {
  const r = Balance.workers.separationRadius;
  for (let i = 0; i < workers.length; i++) {
    for (let j = i + 1; j < workers.length; j++) {
      const dx = workers[j].x - workers[i].x;
      const dy = workers[j].y - workers[i].y;
      const d = Math.hypot(dx, dy);
      if (d < r && d > 0.1) {
        const nx = dx / d;
        const ny = dy / d;
        workers[i].nudgeX -= nx;
        workers[i].nudgeY -= ny;
        workers[j].nudgeX += nx;
        workers[j].nudgeY += ny;
      }
    }
  }
}
