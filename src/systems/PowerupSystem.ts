import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { PowerupDefs, POWERUP_POOL, type PowerupKind } from '../config/PowerupDefs';
import { Powerup } from '../entities/Powerup';
import type { Rng } from '../core/Rng';

// PowerupSystem owns:
//   - field-spawn cadence per §7.5 (first spawn timing, 9-14s random subsequent, cap 10)
//   - the pool of timed buffs currently active on the player (durations tick here)
//   - convenience query methods read each frame by RaidScene / WeaponSystem
//
// Instant power-ups (Signal Nuke, +15s, Shield Bubble) are NOT tracked here -
// they fire callbacks on activation and live no further. Timed power-ups
// (Magnet Burst, Drone Swarm, Laser Overdrive, Freeze Pulse) sit in
// activeEffects with a remaining duration.
//
// Tutorial mode bypasses random spawn cadence and just fires Drone Swarm at
// 10s and Magnet Burst at 25s per §5.4.

export interface PowerupSystemOpts {
  tutorial: boolean;
}

export interface InstantHandlers {
  signalNuke: () => void;
  timeBonus: () => void;
  shieldGrant: () => void;
}

interface ActiveEffect {
  kind: PowerupKind;
  remaining: number;
  total: number;
}

export interface PlayerPositionProvider {
  (): { x: number; y: number };
}

export class PowerupSystem {
  private group: Phaser.GameObjects.Group;
  private getPlayerPos: PlayerPositionProvider;
  private opts: PowerupSystemOpts;
  private instants: InstantHandlers;
  private rng: Rng;
  private spawnTimer = 0;
  private elapsed = 0;
  private active: ActiveEffect[] = [];
  private tutorialDroneFired = false;
  private tutorialMagnetFired = false;
  private running = false;

  constructor(
    _scene: Phaser.Scene,
    group: Phaser.GameObjects.Group,
    getPlayerPos: PlayerPositionProvider,
    opts: PowerupSystemOpts,
    instants: InstantHandlers,
    rng: Rng,
  ) {
    this.group = group;
    this.getPlayerPos = getPlayerPos;
    this.opts = opts;
    this.instants = instants;
    this.rng = rng;
  }

  start(): void {
    this.running = true;
    this.elapsed = 0;
    this.active = [];
    this.tutorialDroneFired = false;
    this.tutorialMagnetFired = false;
    // First spawn: 4s in tutorial, 8s in normal. Tutorial doesn't actually
    // use spawnTimer (scripted spawns drive everything), but we initialize
    // it for parity.
    this.spawnTimer = this.opts.tutorial
      ? Balance.powerups.firstSpawnSecTutorial
      : Balance.powerups.firstSpawnSecNormal;
  }

  stop(): void {
    this.running = false;
  }

  update(dt: number): void {
    if (!this.running) return;
    this.elapsed += dt;

    // Tick active timed effects.
    for (const eff of this.active) eff.remaining -= dt;
    this.active = this.active.filter(eff => eff.remaining > 0);

    if (this.opts.tutorial) {
      this.tickTutorialSpawns();
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.countOnField() < Balance.powerups.maxOnField) {
      this.spawnRandom();
      this.spawnTimer = this.rng.range(
        Balance.powerups.spawnIntervalMin,
        Balance.powerups.spawnIntervalMax,
      );
    }
  }

  // Tutorial: scripted spawns at fixed timestamps per §5.4. We don't even
  // start a random cadence - the FTUE is hand-authored.
  private tickTutorialSpawns(): void {
    if (!this.tutorialDroneFired && this.elapsed >= Balance.tutorial.droneSwarmAtSec) {
      this.tutorialDroneFired = true;
      this.spawnAt('droneSwarm');
    }
    if (!this.tutorialMagnetFired && this.elapsed >= Balance.tutorial.magnetBurstAtSec) {
      this.tutorialMagnetFired = true;
      this.spawnAt('magnetBurst');
    }
  }

  private spawnRandom(): void {
    const kind = this.rng.pick(POWERUP_POOL);
    this.spawnAt(kind);
  }

  private spawnAt(kind: PowerupKind): void {
    const player = this.getPlayerPos();
    const angle = this.rng.next() * Math.PI * 2;
    const r = Balance.powerups.spawnRadius;
    const wb = Balance.player.worldBounds;
    const margin = 60;
    const x = Phaser.Math.Clamp(
      player.x + Math.cos(angle) * r,
      wb.minX + margin,
      wb.maxX - margin,
    );
    const y = Phaser.Math.Clamp(
      player.y + Math.sin(angle) * r,
      wb.minY + margin,
      wb.maxY - margin,
    );
    const p = this.group.get(x, y) as Powerup | null;
    if (!p) return;
    p.spawn(x, y, kind);
  }

  // Called by RaidScene's overlap callback when the player picks up a power-up.
  activate(kind: PowerupKind): void {
    const def = PowerupDefs[kind];
    if (def.instant) {
      // Each instant routes through the handler the owner provided. We don't
      // touch RaidScene directly here - keeps systems isolated.
      if (kind === 'signalNuke') this.instants.signalNuke();
      else if (kind === 'timeBonus') this.instants.timeBonus();
      else if (kind === 'shieldBubble') this.instants.shieldGrant();
      return;
    }
    // Refresh duration if same kind is already running; otherwise add.
    const existing = this.active.find(e => e.kind === kind);
    if (existing) {
      existing.remaining = def.durationSec;
      existing.total = def.durationSec;
    } else {
      this.active.push({ kind, remaining: def.durationSec, total: def.durationSec });
    }
  }

  // ---- per-frame queries (composed by callers) ----

  isActive(kind: PowerupKind): boolean {
    return this.active.some(e => e.kind === kind);
  }

  // Magnet Burst doubles-down on radius. Returns the multiplier to apply
  // on top of base magnet radius.
  getMagnetMult(): number {
    return this.isActive('magnetBurst') ? Balance.powerups.magnetBurstRadiusMult : 1;
  }

  // Laser Overdrive cranks fire rate. Returns multiplier > 1 when active.
  getFireRateMult(): number {
    if (!this.isActive('laserOverdrive')) return 1;
    // Map laserFireCooldown (0.06) to a multiplier over baseFireCooldown (0.105).
    return Balance.weapon.baseFireCooldown / Balance.weapon.laserFireCooldown;
  }

  getTargetsPerShot(): number {
    return this.isActive('laserOverdrive') ? Balance.weapon.laserTargets : 1;
  }

  // Drone Swarm reinterpreted per §13 as "chain shots to extra enemies":
  // each shot, after damaging the primary target, also damages up to N
  // additional nearest enemies within chainRadius.
  getChainCount(): number {
    return this.isActive('droneSwarm') ? Balance.powerups.droneSwarmChainCount : 0;
  }

  isFreezeActive(): boolean {
    return this.isActive('freezePulse');
  }

  // Golden Fever (§13): all enemy scrap drops worth 2x while active. RaidScene
  // reads this in spawnDrops to scale pickup `value`.
  getScrapDropMult(): number {
    return this.isActive('goldenFever') ? 2 : 1;
  }

  // Turret Drop (§13): RaidScene queries this each frame to drive a
  // friendly auto-fire turret at the player's location when the power-up
  // was activated.
  isTurretActive(): boolean {
    return this.isActive('turretDrop');
  }

  // ---- HUD ----

  getActiveEffectsView(): Array<{
    kind: PowerupKind;
    remaining: number;
    total: number;
    label: string;
    color: number;
    iconText: string;
  }> {
    return this.active.map(e => {
      const def = PowerupDefs[e.kind];
      return {
        kind: e.kind,
        remaining: e.remaining,
        total: e.total,
        label: def.label,
        color: def.color,
        iconText: def.iconText,
      };
    });
  }

  private countOnField(): number {
    let n = 0;
    for (const c of this.group.getChildren()) {
      if (c.active) n++;
    }
    return n;
  }
}

export const POWERUP_GROUP_KEY = 'powerups';
