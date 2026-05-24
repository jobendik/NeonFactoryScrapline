import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../config/EnemyDefs';
import type { Rng } from '../core/Rng';
import { QualityManager } from './QualityManager';

// Spawn director per blueprint §7.2:
//   - Spawn cooldown ramps from 0.95s -> 0.24s as the raid progresses (intensity 0..1).
//   - Max simultaneous enemies = 7 + intensity * 25, capped at 32.
//   - Spawns 720px from the player on a random angle (off-screen on a 1280x720 canvas).
//
// Milestone 2 ships Grunt only. Weighted enemy roll lands in Milestone 5.

export interface PlayerPositionProvider {
  (): { x: number; y: number };
}

export interface WaveDirectorOpts {
  // Scales both the simultaneous-cap and the spawn cadence. Tutorial passes 0.4
  // per blueprint §5.4 ("enemy count: 40% normal").
  spawnRateMult?: number;
  // Multiplier applied to each enemy's hp on spawn. Tutorial passes 0.5.
  enemyHpMult?: number;
  // The reference duration for the intensity ramp. Tutorial passes 45 so
  // intensity reaches 1.0 at the end of a 45s tutorial instead of pretending
  // the raid is 75s long.
  raidDuration?: number;
  // M17 — when true, the director spawns an extra red-tinted swarmer wave
  // alongside the normal roll so the player has something to cleanse.
  infestationWave?: boolean;
}

export class WaveDirector {
  private group: Phaser.GameObjects.Group;
  private getPlayerPos: PlayerPositionProvider;
  private rng: Rng;
  private spawnTimer = 0;
  private elapsed = 0;
  private active = false;
  private spawnRateMult = 1;
  private enemyHpMult = 1;
  private raidDuration: number = Balance.raid.normalDuration;
  // M14 greed escalation. Re-read each tick from RaidScene; drives spawn-rate
  // boosts (multiplier on top of base spawnRateMult), tank-rush weighting
  // (extra share lifted from Grunt → Tank), and the one-shot elite spawn at
  // boss-wave step.
  private greedStep = 0;
  private eliteSpawned = false;
  // M17 infestation wave state. When the player has any infested machines,
  // the raid spawns periodic red-tinted swarmers in addition to the normal
  // roll. spawnInterval picks one every infestSpawnIntervalSec seconds.
  private infestationWave = false;
  private infestSpawnTimer = 0;
  // Suggestions audit — Loot Goblin appears on a random cadence per raid.
  // When the timer expires we spawn one and re-roll. Independent of the
  // normal spawn director.
  private lootGoblinTimer = 0;
  // Extract Jammer only spawns after extraction opens. RaidScene flips this
  // flag via setExtractionOpen().
  private extractionOpen = false;

  constructor(group: Phaser.GameObjects.Group, getPlayerPos: PlayerPositionProvider, rng: Rng) {
    this.group = group;
    this.getPlayerPos = getPlayerPos;
    this.rng = rng;
  }

  start(opts?: WaveDirectorOpts): void {
    this.active = true;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnRateMult = Math.max(0.05, opts?.spawnRateMult ?? 1);
    this.enemyHpMult = Math.max(0.1, opts?.enemyHpMult ?? 1);
    this.raidDuration = Math.max(1, opts?.raidDuration ?? Balance.raid.normalDuration);
    this.greedStep = 0;
    this.eliteSpawned = false;
    this.infestationWave = !!opts?.infestationWave;
    this.infestSpawnTimer = Balance.infestation.firstWaveDelaySec;
    this.lootGoblinTimer = this.rng.range(
      Balance.enemies.lootGoblin.spawnIntervalMin,
      Balance.enemies.lootGoblin.spawnIntervalMax,
    );
    this.extractionOpen = false;
  }

  setExtractionOpen(open: boolean): void {
    this.extractionOpen = open;
  }

  stop(): void {
    this.active = false;
  }

  // Called by RaidScene each frame; the latest greed step drives the
  // §7.3 escalation table (Balance.raid.greedEscalation).
  setGreedStep(step: number): void {
    this.greedStep = Math.max(0, Math.min(Balance.raid.greedEscalation.length - 1, step));
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    this.spawnTimer -= dt;

    // M17 infestation wave: spawn one extra red-tinted swarmer every N seconds
    // independently of the main spawn director, so cleanse pace is predictable.
    if (this.infestationWave) {
      this.infestSpawnTimer -= dt;
      if (this.infestSpawnTimer <= 0) {
        this.spawnOne('infested');
        this.infestSpawnTimer = Balance.infestation.spawnIntervalSec;
      }
    }

    // Loot Goblin (§14.1): independent timer. Re-rolled each time.
    this.lootGoblinTimer -= dt;
    if (this.lootGoblinTimer <= 0) {
      this.spawnOne('lootGoblin');
      this.lootGoblinTimer = this.rng.range(
        Balance.enemies.lootGoblin.spawnIntervalMin,
        Balance.enemies.lootGoblin.spawnIntervalMax,
      );
    }

    // Bomber (§7.3 / §14.1): per-second chance scaled by greed step, on top
    // of the normal wave. Skip on first few seconds so it doesn't interrupt
    // the FTUE rhythm.
    if (this.elapsed > 6) {
      const bomberChance =
        Balance.enemies.bomber.spawnChancePerSecByGreedStep[this.greedStep] ?? 0;
      if (bomberChance > 0 && this.rng.next() < bomberChance * dt) {
        this.spawnOne('bomber');
      }
    }

    // Extract Jammer (§14.1): only while extraction is open, low cadence.
    if (this.extractionOpen && this.elapsed > 1 && this.rng.next() < 0.4 * dt) {
      this.spawnOne('extractJammer');
    }

    const esc = Balance.raid.greedEscalation[this.greedStep];
    const greedSpawnMult = esc.spawnRateMult;
    const effectiveSpawnMult = this.spawnRateMult * greedSpawnMult;
    const intensity = Math.min(1, this.elapsed / this.raidDuration);
    const rawCap = 7 + Math.floor(intensity * 25);
    // M21 — the absolute ceiling is the active quality preset's enemyCap
    // rather than Balance.enemies.maxOnScreen, so a Low-quality drop
    // squeezes the simultaneous-cap immediately.
    const qualityCap = QualityManager.enemyCap();
    const cap = Math.min(qualityCap, Math.max(1, Math.floor(rawCap * effectiveSpawnMult)));

    // Boss wave (§7.3 greed x3): spawn a single elite the first time we cross
    // a step that calls for one. The eliteSpawned latch ensures we don't
    // re-summon on every frame after the threshold.
    if (!this.eliteSpawned && esc.eliteCount > 0) {
      for (let i = 0; i < esc.eliteCount; i++) this.spawnOne('elite');
      this.eliteSpawned = true;
    }

    if (this.spawnTimer > 0) return;
    if (this.countActive() >= cap) return;

    this.spawnOne();
    // Lower spawn rate stretches the cooldown so total throughput scales with the multiplier.
    const baseCooldown = Phaser.Math.Linear(
      Balance.enemies.spawnCooldownStart,
      Balance.enemies.spawnCooldownEnd,
      intensity,
    );
    this.spawnTimer = baseCooldown / effectiveSpawnMult;
  }

  private pickKind(): EnemyKind {
    // Weighted roll across §7.2 base spawn weights, with the §7.3 tank-rush
    // factor lifting share from Grunt → Tank as greed escalates. Splitter
    // unlocks at greed step 1+ and Shield Carrier at step 2+ per Balance.
    const w = Balance.enemies.weights;
    const tankRush = Balance.raid.greedEscalation[this.greedStep].tankRushFactor;
    const gruntShare = Math.max(0.05, w.grunt - tankRush);
    const tankShare = w.tank + tankRush;
    const splitterShare =
      this.greedStep >= Balance.enemies.splitter.unlockAtGreedStep
        ? Balance.enemies.splitter.spawnWeight
        : 0;
    const carrierShare =
      this.greedStep >= Balance.enemies.shieldCarrier.unlockAtGreedStep
        ? Balance.enemies.shieldCarrier.spawnWeight
        : 0;
    const r = this.rng.next();
    let acc = gruntShare;
    if (r < acc) return 'grunt';
    acc += w.swarmer;
    if (r < acc) return 'swarmer';
    acc += w.shooter;
    if (r < acc) return 'shooter';
    acc += tankShare;
    if (r < acc) return 'tank';
    acc += splitterShare;
    if (r < acc) return 'splitter';
    acc += carrierShare;
    if (r < acc) return 'shieldCarrier';
    return 'tank';
  }

  private spawnOne(kindOverride?: EnemyKind): void {
    const player = this.getPlayerPos();
    const angle = this.rng.next() * Math.PI * 2;
    const dist = Balance.enemies.spawnDistance;
    const wb = Balance.player.worldBounds;
    const margin = 24;
    const x = Phaser.Math.Clamp(player.x + Math.cos(angle) * dist, wb.minX + margin, wb.maxX - margin);
    const y = Phaser.Math.Clamp(player.y + Math.sin(angle) * dist, wb.minY + margin, wb.maxY - margin);

    const enemy = this.group.get(x, y) as Enemy | null;
    if (!enemy) return;
    enemy.spawn(x, y, kindOverride ?? this.pickKind(), this.enemyHpMult, this.rng);
  }

  private countActive(): number {
    let n = 0;
    for (const c of this.group.getChildren()) {
      if (c.active) n++;
    }
    return n;
  }
}
