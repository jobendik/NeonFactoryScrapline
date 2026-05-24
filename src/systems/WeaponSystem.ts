import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { Enemy } from '../entities/Enemy';
import { sfxShoot } from '../audio/sfx';
import { applyGlow } from './NeonFX';
import type { RunMods } from './RunMods';
import type { Rng } from '../core/Rng';

// Auto-aim weapon per blueprint §6.3: targets the nearest active enemy within
// (baseRange + rangePerDamage * damageLevel) px, fires at Balance.weapon.baseFireCooldown.
//
// Visual model is a hitscan tracer (Graphics, fades via tween) - never a physics object.
// Per architecture rule "Player bullets are visual hitscan + manual overlap check":
// the nearest-in-range scan IS the manual overlap; no Phaser physics overlap is used.

export interface WeaponHit {
  target: Enemy;
  damage: number;
  // True when the hit rolled a critical strike (Crit Shot card). RaidScene
  // uses this to swap the popup color/size.
  crit: boolean;
}

export interface PlayerPositionProvider {
  (): { x: number; y: number };
}

export interface EnemyListProvider {
  (): Phaser.GameObjects.GameObject[];
}

import type { SpatialGrid } from './SpatialGrid';

export interface EnemyGridProvider {
  (): SpatialGrid<Enemy> | null;
}

interface TracerSegment {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: number;
  // Seconds since the tracer fired (drives alpha fade).
  age: number;
}

export class WeaponSystem {
  private scene: Phaser.Scene;
  private getPlayer: PlayerPositionProvider;
  private getEnemies: EnemyListProvider;
  private getEnemyGrid: EnemyGridProvider | null;
  private rng: Rng;
  // Scratch buffer reused across calls to keep the WeaponSystem allocation-
  // free in the hot path. Mutated each call; do not hold references.
  private gridQueryScratch: Enemy[] = [];
  private fireTimer = 0;
  // Pooled tracer renderer — a single Graphics object that redraws all active
  // tracer segments each frame instead of allocating a fresh Graphics per
  // shot. At 0.06s fire cooldown with multiple targets, the old per-shot
  // alloc path was ~80-120 Graphics/sec on Chromebooks.
  private tracerGfx: Phaser.GameObjects.Graphics | null = null;
  private tracers: TracerSegment[] = [];
  private tracerFadeSec = 0.15;
  private damageLevel = 0;
  private damageMult = 1;
  private fireRateMult = 1;
  private targetsPerShot = 1;
  // M15 — drafted card mods. Composed multiplicatively with the existing
  // tutorial damage multiplier and Laser Overdrive's fire-rate / target buffs.
  private modDamageMult = 1;
  private modFireRateMult = 1;
  private modPierce = 0;
  private modSplitShot = 0;
  private modCritChance = 0;
  private modCritMult = 3;
  private modBonusTargets = 0;

  constructor(
    scene: Phaser.Scene,
    getPlayer: PlayerPositionProvider,
    getEnemies: EnemyListProvider,
    rng: Rng,
    getEnemyGrid: EnemyGridProvider | null = null,
  ) {
    this.scene = scene;
    this.getPlayer = getPlayer;
    this.getEnemies = getEnemies;
    this.rng = rng;
    this.getEnemyGrid = getEnemyGrid;
  }

  setDamageLevel(level: number): void {
    this.damageLevel = level;
  }

  // Multiplier on top of the leveled damage. Tutorial sets 2.0 per §5.4.
  setDamageMult(mult: number): void {
    this.damageMult = Math.max(0.1, mult);
  }

  // Laser Overdrive bumps fire rate; default 1.0 = baseFireCooldown.
  setFireRateMult(mult: number): void {
    this.fireRateMult = Math.max(0.1, mult);
  }

  // Laser Overdrive ups targets/shot from 1 to laserTargets (2).
  setTargetsPerShot(n: number): void {
    this.targetsPerShot = Math.max(1, Math.floor(n));
  }

  // Drafted RunMods. Read every frame; cheap to swap mid-raid.
  applyRunMods(mods: RunMods): void {
    this.modDamageMult = mods.damageMult;
    this.modFireRateMult = mods.fireRateMult;
    this.modPierce = mods.pierce;
    this.modSplitShot = mods.splitShot;
    this.modCritChance = mods.critChance;
    this.modCritMult = mods.critMult;
    this.modBonusTargets = Math.max(0, Math.floor(mods.bonusWeaponTargets));
  }

  // Returns an array of hits (0 to effectiveTargets). Multi-target firing
  // returns each chosen target once; chain effects (Drone Swarm + Chain
  // Lightning card) are layered on top by RaidScene after the primary hits
  // are processed.
  update(dt: number): WeaponHit[] {
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    // Age + render existing tracers regardless of whether we fire this tick.
    this.tickTracers(dt);
    if (this.fireTimer > 0) return [];

    // Effective target count = base × (1 + splitShot) + pierce + bonusTargets.
    // Split Shot multiplies the fork count (so 1 shot becomes 2/3/...).
    // Pierce adds extra targets along the line; for hitscan we approximate
    // by hitting the next-nearest enemies (no actual line geometry yet).
    // BonusTargets comes from operator-granted drones (Vanta: +2 on raid start)
    // and is multiplied by Drone Multiplier card.
    // §8.5 milestone effects (M22):
    //   - Damage Lv. 5  → +1 pierce (an extra enemy hit per fire)
    //   - Damage Lv. 10 → +1 split shot (fork into two parallel tracers)
    const upgradePierce = this.damageLevel >= 5 ? 1 : 0;
    const upgradeSplit = this.damageLevel >= 10 ? 1 : 0;
    const splitMult = 1 + this.modSplitShot + upgradeSplit;
    const effectiveTargets =
      this.targetsPerShot * splitMult + this.modPierce + upgradePierce + this.modBonusTargets;
    const targets = this.findNearestInRange(effectiveTargets);
    if (targets.length === 0) return [];

    const baseDamage =
      (Balance.weapon.baseDamage + this.damageLevel * Balance.weapon.damagePerLevel) *
      this.damageMult *
      this.modDamageMult;
    const hits: WeaponHit[] = [];
    for (const t of targets) {
      this.fireTracer(t.x, t.y);
      const crit = this.modCritChance > 0 && this.rng.next() < this.modCritChance;
      const damage = crit ? baseDamage * this.modCritMult : baseDamage;
      hits.push({ target: t, damage, crit });
    }
    sfxShoot();
    // Burst Fire (modFireRateMult) shortens the cooldown; Laser Overdrive's
    // fireRateMult composes multiplicatively on top.
    this.fireTimer =
      Balance.weapon.baseFireCooldown / (this.fireRateMult * this.modFireRateMult);
    return hits;
  }

  // Returns the `n` nearest enemies within range. Used both for normal firing
  // (n=1) and Laser Overdrive (n=2). Chain shots use a different chainRadius
  // and are processed by RaidScene, not here.
  //
  // M21: when a SpatialGrid provider is supplied (RaidScene rebuilds the
  // grid once per frame), we query only the cells within `range` of the
  // player instead of iterating the whole enemy group. Falls back to the
  // O(n) scan when no grid is present (e.g. tests).
  private findNearestInRange(n: number): Enemy[] {
    const range = Balance.weapon.baseRange + this.damageLevel * Balance.weapon.rangePerDamage;
    const range2 = range * range;
    const p = this.getPlayer();
    const candidates: Array<{ e: Enemy; d2: number }> = [];
    const grid = this.getEnemyGrid ? this.getEnemyGrid() : null;
    if (grid) {
      const nearby = grid.queryNearby(p.x, p.y, range, this.gridQueryScratch);
      for (const e of nearby) {
        if (!e.active) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < range2) candidates.push({ e, d2 });
      }
    } else {
      const list = this.getEnemies();
      for (const obj of list) {
        const e = obj as Enemy;
        if (!e.active) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < range2) candidates.push({ e, d2 });
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    return candidates.slice(0, n).map(c => c.e);
  }

  // Public so RaidScene can render a tracer for each chained enemy hit by
  // Drone Swarm. Source is the previous hit position rather than the player.
  drawTracer(fromX: number, fromY: number, toX: number, toY: number, color?: number): void {
    this.tracers.push({
      fromX,
      fromY,
      toX,
      toY,
      color: color ?? Balance.colors.bulletTracer,
      age: 0,
    });
  }

  private fireTracer(tx: number, ty: number): void {
    const p = this.getPlayer();
    this.drawTracer(p.x, p.y, tx, ty, Balance.colors.bulletTracer);
  }

  // Render all active tracer segments into a single pooled Graphics object.
  // Each segment fades alpha from 1 → 0 over tracerFadeSec, then is dropped.
  // The Graphics is created on first use so test contexts without a scene
  // canvas don't have to construct one.
  private tickTracers(dt: number): void {
    if (this.tracers.length === 0 && !this.tracerGfx) return;
    if (!this.tracerGfx) {
      this.tracerGfx = this.scene.add.graphics();
      this.tracerGfx.setDepth(4);
      this.tracerFadeSec = Balance.ui.tracerFadeMs / 1000;
      applyGlow(this.tracerGfx, Balance.colors.bulletTracer, 4, 0);
    }
    const fade = this.tracerFadeSec;
    // Compact in-place: keep tracers whose age < fade duration.
    let write = 0;
    for (let read = 0; read < this.tracers.length; read++) {
      const t = this.tracers[read];
      t.age += dt;
      if (t.age < fade) {
        this.tracers[write++] = t;
      }
    }
    this.tracers.length = write;

    const g = this.tracerGfx;
    g.clear();
    // Render each tracer as a stack of three lines: outer halo (thick, low
    // alpha), mid stroke, and bright white core. Combined with the fading
    // age they read as a tapered laser bolt rather than a hairline.
    for (const t of this.tracers) {
      const alpha = 1 - t.age / fade;
      g.lineStyle(6, t.color, alpha * 0.30);
      g.lineBetween(t.fromX, t.fromY, t.toX, t.toY);
      g.lineStyle(3, t.color, alpha * 0.85);
      g.lineBetween(t.fromX, t.fromY, t.toX, t.toY);
      g.lineStyle(1, 0xffffff, alpha);
      g.lineBetween(t.fromX, t.fromY, t.toX, t.toY);
    }
  }

  // Called by RaidScene.shutdown so the Graphics object doesn't outlive
  // the scene.
  destroy(): void {
    if (this.tracerGfx) {
      this.tracerGfx.destroy();
      this.tracerGfx = null;
    }
    this.tracers.length = 0;
  }
}
