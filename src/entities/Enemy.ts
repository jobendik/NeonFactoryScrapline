import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { EnemyDefs, ENEMY_TEXTURE_DIM, type EnemyKind, type EnemyDef } from '../config/EnemyDefs';
import { applyGlow } from '../systems/NeonFX';
import type { Rng } from '../core/Rng';

// Texture dim per-spec: large canvas around each shape so the radial halo
// drawn by makeTexture has room to fade out without clipping. The pad is
// shared between makeTexture (draws the halo) and spawn (computes body offset)
// so both stay in sync.
const TEXTURE_PAD = 24;
function enemyTextureDim(size: number): number {
  return Math.max(ENEMY_TEXTURE_DIM, size + TEXTURE_PAD);
}

// Shift a 0xRRGGBB color toward black (delta < 0) or white (delta > 0).
function shade(color: number, delta: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const f = (c: number): number => {
    if (delta < 0) return Math.max(0, Math.round(c * (1 + delta)));
    return Math.min(255, Math.round(c + (255 - c) * delta));
  };
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

export interface EnemyFireRequest {
  fromX: number;
  fromY: number;
  dirX: number;
  dirY: number;
}

// Bomber explosion request — emitted from tick() when the bomber's telegraph
// elapses. RaidScene handles damage application + visual.
export interface EnemyExplosionRequest {
  x: number;
  y: number;
  radius: number;
  damage: number;
}

export interface EnemyTickResult {
  fired: EnemyFireRequest | null;
  exploded?: EnemyExplosionRequest | null;
  // True if the enemy is asking to be despawned (lootGoblin lifetime, etc.)
  expired?: boolean;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp = 0;
  maxHp = 0;
  kind: EnemyKind = 'grunt';
  private speed = 0;
  private body_!: Phaser.Physics.Arcade.Body;

  // Shooter state. Unused for chasers but kept on every Enemy because the pool
  // recycles instances - a pooled grunt may be re-spawned as a shooter later.
  private fireCooldown = 0;
  private telegraphLeft = 0;
  private telegraphTargetX = 0;
  private telegraphTargetY = 0;
  private telegraphGfx: Phaser.GameObjects.Graphics | null = null;
  // Knockback (M14). While > 0, the chaser tick is suppressed and the physics
  // body holds the externally-set velocity from applyKnockback().
  private knockbackTimer = 0;
  // M17 glitch jitter (infested-only). Drives a sub-degree rotation wobble
  // so the sprite reads as "corrupted" without affecting the body.
  private glitchPhase = 0;
  // M19 — per-raid Rng reference; supplied at spawn time. Drives the
  // shooter fire-cooldown rolls so daily-seed raids are reproducible.
  private rng: Rng | null = null;
  // Bomber: charge phase until in range, then expanding-ring telegraph.
  private bomberTelegraphLeft = 0;
  private bomberTelegraphGfx: Phaser.GameObjects.Graphics | null = null;
  // Loot Goblin: counts down to despawn so the player has a finite window
  // to chase the reward.
  private lifetimeLeft = 0;
  // Damage-reduction buff applied to this enemy by nearby Shield Carriers;
  // 0 = unbuffed, 1 = invulnerable. RaidScene updates this each frame.
  buffedDamageReduction = 0;
  // Tracks whether the preFX glow has been wired up for the current kind so
  // pool recycling doesn't re-add a duplicate filter every spawn.
  private glowApplied = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Enemy.ensureTextures(scene);
    super(scene, x, y, EnemyDefs.grunt.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body_ = this.body as Phaser.Physics.Arcade.Body;
    this.setActive(false).setVisible(false);
    this.body_.enable = false;
  }

  spawn(x: number, y: number, kind: EnemyKind, hpMult: number = 1, rng: Rng | null = null): void {
    const kindChanged = this.kind !== kind || !this.glowApplied;
    this.kind = kind;
    this.rng = rng;
    const spec = EnemyDefs[kind];
    const hp = Math.max(1, Math.round(spec.hp * hpMult));
    this.hp = hp;
    this.maxHp = hp;
    this.speed = spec.speed;
    this.setTexture(spec.textureKey);
    if (kindChanged) {
      // Re-apply preFX glow whenever the pooled sprite changes kind so the
      // glow color matches the new shape's accent palette.
      const fx = (this as unknown as { preFX?: { clear?: () => void } }).preFX;
      fx?.clear?.();
      // Stronger glow + inner bloom so enemies read at distance and feel "lit".
      applyGlow(this, spec.color, 8, 1, 0.2);
      this.glowApplied = true;
    }
    this.setPosition(x, y);
    const radius = spec.size / 2;
    const dim = enemyTextureDim(spec.size);
    const offset = (dim - spec.size) / 2;
    this.body_.setCircle(radius, offset, offset);
    this.body_.enable = true;
    this.setActive(true).setVisible(true);
    this.setAlpha(1);
    this.setRotation(0);

    const min = Balance.shooter.fireIntervalMinSec * 0.5;
    const max = Balance.shooter.fireIntervalMaxSec;
    this.fireCooldown = rng ? rng.range(min, max) : Phaser.Math.FloatBetween(min, max);
    this.telegraphLeft = 0;
    this.knockbackTimer = 0;
    if (this.telegraphGfx) this.telegraphGfx.clear();
    this.bomberTelegraphLeft = 0;
    if (this.bomberTelegraphGfx) this.bomberTelegraphGfx.clear();
    this.lifetimeLeft = kind === 'lootGoblin' ? Balance.enemies.lootGoblin.lifetimeSec : 0;
    this.buffedDamageReduction = 0;
  }

  kill(): void {
    this.body_.setVelocity(0, 0);
    this.body_.enable = false;
    this.setActive(false).setVisible(false);
    this.telegraphLeft = 0;
    if (this.telegraphGfx) this.telegraphGfx.clear();
    this.bomberTelegraphLeft = 0;
    if (this.bomberTelegraphGfx) this.bomberTelegraphGfx.clear();
    this.buffedDamageReduction = 0;
  }

  hit(amount: number): boolean {
    const reduced = amount * (1 - this.buffedDamageReduction);
    this.hp -= reduced;
    this.setAlpha(0.55);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.setAlpha(1);
    });
    return this.hp <= 0;
  }

  tick(dt: number, playerX: number, playerY: number, frozen: boolean = false): EnemyTickResult {
    if (!this.active) return { fired: null };
    if (frozen) {
      // Freeze Pulse (§13): enemies fully halt - no movement, no fire, no
      // telegraph charge-up. Visual tint is applied by RaidScene.
      this.body_.setVelocity(0, 0);
      return { fired: null };
    }
    if (this.knockbackTimer > 0) {
      // Don't override the velocity that applyKnockback set; just count down
      // and let physics drift the enemy along the impulse for a frame or two.
      this.knockbackTimer -= dt;
      return { fired: null };
    }
    const spec = EnemyDefs[this.kind];
    if (spec.behavior === 'shooter') {
      return this.tickShooter(dt, playerX, playerY);
    }
    if (spec.behavior === 'bomber') {
      return this.tickBomber(dt, playerX, playerY);
    }
    if (spec.behavior === 'fleeing') {
      return this.tickFleeing(dt, playerX, playerY);
    }
    // buffer + extractJammer share chaser movement; the buff/jamming aura
    // is read by RaidScene each frame from the active enemy list.
    this.tickChaser(playerX, playerY);
    if (this.kind === 'infested') {
      this.glitchPhase += dt * Balance.infestation.glitchHz;
      const jitter = Math.sin(this.glitchPhase) * Balance.infestation.glitchAmplitudeRad;
      this.setRotation(this.rotation + jitter);
    }
    return { fired: null };
  }

  // Bomber behavior: charge toward player at increased speed; once within
  // explosionRadius, lock in place and play a 0.5s expanding-ring telegraph.
  // When the telegraph elapses, emit an explosion request and self-kill.
  private tickBomber(dt: number, playerX: number, playerY: number): EnemyTickResult {
    const cfg = Balance.enemies.bomber;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.bomberTelegraphLeft > 0) {
      this.body_.setVelocity(0, 0);
      this.bomberTelegraphLeft -= dt;
      this.drawBomberTelegraph(cfg.telegraphSec, cfg.explosionRadius);
      if (this.bomberTelegraphLeft <= 0) {
        this.clearBomberTelegraph();
        return {
          fired: null,
          exploded: {
            x: this.x,
            y: this.y,
            radius: cfg.explosionRadius,
            damage: cfg.explosionDamage,
          },
        };
      }
      return { fired: null };
    }

    if (dist < cfg.explosionRadius * 0.65) {
      // Close enough to commit — start the telegraph.
      this.bomberTelegraphLeft = cfg.telegraphSec;
      this.body_.setVelocity(0, 0);
      return { fired: null };
    }

    // Charge.
    const sp = this.speed * cfg.chargeSpeedMult;
    if (dist > 0.5) {
      this.body_.setVelocity((dx / dist) * sp, (dy / dist) * sp);
      this.setRotation(Math.atan2(dy, dx));
    }
    return { fired: null };
  }

  // Loot Goblin behavior: runs AWAY from the player, despawns after lifetime
  // expires. Movement is bounded by physics body limits; the spawner places
  // it close enough to be visible but far enough that catching it requires
  // dashing.
  private tickFleeing(dt: number, playerX: number, playerY: number): EnemyTickResult {
    this.lifetimeLeft -= dt;
    if (this.lifetimeLeft <= 0) {
      return { fired: null, expired: true };
    }
    const cfg = Balance.enemies.lootGoblin;
    const dx = this.x - playerX;
    const dy = this.y - playerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const sp = this.speed * cfg.fleeSpeedMult;
      this.body_.setVelocity((dx / dist) * sp, (dy / dist) * sp);
      this.setRotation(Math.atan2(-dy, -dx));
    }
    return { fired: null };
  }

  // Bomber telegraph: expanding red ring that grows from 0 → explosionRadius
  // as telegraph elapses, so the player can see exactly where the AoE lands.
  private drawBomberTelegraph(totalSec: number, maxRadius: number): void {
    if (!this.bomberTelegraphGfx) {
      this.bomberTelegraphGfx = this.scene.add.graphics();
      this.bomberTelegraphGfx.setDepth(15);
    }
    const g = this.bomberTelegraphGfx;
    g.clear();
    const progress = 1 - Math.max(0, this.bomberTelegraphLeft) / totalSec;
    const r = maxRadius * Math.min(1, progress + 0.05);
    g.lineStyle(3, 0xff416b, 0.95);
    g.strokeCircle(this.x, this.y, r);
    g.fillStyle(0xff416b, 0.18);
    g.fillCircle(this.x, this.y, r);
  }

  private clearBomberTelegraph(): void {
    if (this.bomberTelegraphGfx) this.bomberTelegraphGfx.clear();
  }

  // Push the enemy away from (fromX, fromY) for knockbackDurSec. RaidScene
  // calls this on player-bullet hits. Tanks get a smaller impulse so they
  // still feel heavy.
  applyKnockback(fromX: number, fromY: number): void {
    if (!this.active) return;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d <= 0.001) return;
    const heavy = this.kind === 'tank' || this.kind === 'elite';
    const speed = Balance.raid.knockbackSpeed * (heavy ? 0.35 : 1.0);
    this.body_.setVelocity((dx / d) * speed, (dy / d) * speed);
    this.knockbackTimer = Balance.raid.knockbackDurSec;
  }

  private tickChaser(playerX: number, playerY: number): void {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      this.body_.setVelocity(0, 0);
      return;
    }
    this.body_.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    this.setRotation(Math.atan2(dy, dx));
  }

  private tickShooter(dt: number, playerX: number, playerY: number): EnemyTickResult {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    // Maintain a kiting distance from the player.
    let mvx = 0;
    let mvy = 0;
    if (dist > 0.5) {
      if (dist < Balance.shooter.minDistance) {
        mvx = -dx / dist;
        mvy = -dy / dist;
      } else if (dist > Balance.shooter.maxDistance) {
        mvx = dx / dist;
        mvy = dy / dist;
      }
    }
    this.body_.setVelocity(mvx * this.speed, mvy * this.speed);
    if (dist > 0.5) this.setRotation(Math.atan2(dy, dx));

    if (this.telegraphLeft > 0) {
      this.telegraphLeft -= dt;
      this.drawTelegraph();
      if (this.telegraphLeft <= 0) {
        this.clearTelegraph();
        const tdx = this.telegraphTargetX - this.x;
        const tdy = this.telegraphTargetY - this.y;
        const tdist = Math.hypot(tdx, tdy) || 1;
        const min = Balance.shooter.fireIntervalMinSec;
        const max = Balance.shooter.fireIntervalMaxSec;
        this.fireCooldown = this.rng ? this.rng.range(min, max) : Phaser.Math.FloatBetween(min, max);
        return {
          fired: {
            fromX: this.x,
            fromY: this.y,
            dirX: tdx / tdist,
            dirY: tdy / tdist,
          },
        };
      }
      return { fired: null };
    }

    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0 && dist <= Balance.shooter.fireRangeMax) {
      this.telegraphLeft = Balance.shooter.telegraphSec;
      this.telegraphTargetX = playerX;
      this.telegraphTargetY = playerY;
    }
    return { fired: null };
  }

  private drawTelegraph(): void {
    if (!this.telegraphGfx) {
      this.telegraphGfx = this.scene.add.graphics();
      this.telegraphGfx.setDepth(20);
    }
    this.telegraphGfx.clear();
    this.telegraphGfx.lineStyle(
      Balance.shooter.telegraphWidth,
      Balance.colors.enemyTelegraph,
      Balance.shooter.telegraphAlpha,
    );
    this.telegraphGfx.lineBetween(this.x, this.y, this.telegraphTargetX, this.telegraphTargetY);
  }

  private clearTelegraph(): void {
    if (this.telegraphGfx) this.telegraphGfx.clear();
  }

  static ensureTextures(scene: Phaser.Scene): void {
    for (const key of Object.keys(EnemyDefs) as EnemyKind[]) {
      const spec = EnemyDefs[key];
      if (scene.textures.exists(spec.textureKey)) continue;
      Enemy.makeTexture(scene, spec);
    }
  }

  private static makeTexture(scene: Phaser.Scene, spec: EnemyDef): void {
    const dim = enemyTextureDim(spec.size);
    const tex = scene.textures.createCanvas(spec.textureKey, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const r = spec.size / 2;
    const colorHex = `#${spec.color.toString(16).padStart(6, '0')}`;
    const haloRgba = (a: number): string => {
      const cr = (spec.color >> 16) & 0xff;
      const cg = (spec.color >> 8) & 0xff;
      const cb = spec.color & 0xff;
      return `rgba(${cr}, ${cg}, ${cb}, ${a})`;
    };

    // 1) Glow halo behind every enemy — gives the procedurally-drawn shape
    //    that neon "lit from within" read without depending on preFX glow.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.65);
    halo.addColorStop(0, haloRgba(0.55));
    halo.addColorStop(0.55, haloRgba(0.22));
    halo.addColorStop(1, haloRgba(0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);

    // 2) Build the shape path once, then both fill and stroke it.
    ctx.beginPath();
    if (spec.shape === 'triangle') {
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(cx - r * 0.55, cy - r * 0.85);
      ctx.lineTo(cx - r * 0.55, cy + r * 0.85);
      ctx.closePath();
    } else if (spec.shape === 'square') {
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
    } else if (spec.shape === 'pentagon') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (spec.shape === 'circle') {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (spec.shape === 'diamond') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
    } else if (spec.shape === 'hexagon') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      // Spiked star (Extract Jammer).
      const inner = r * 0.45;
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i / 16) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : inner;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    // Solid fill — radial gradient so the body looks volumetric.
    const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.1);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.25, colorHex);
    body.addColorStop(1, shade(spec.color, -0.55));
    ctx.fillStyle = body;
    ctx.fill();

    // Outer rim — bright white edge so the shape pops on the dark background.
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();

    // Per-shape detail decorations.
    if (spec.shape === 'square') {
      // Armor plating: inner rectangle + crosshatch + center band.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - r + 4, cy - r + 4, r * 2 - 8, r * 2 - 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(cx - r + 6, cy);
      ctx.lineTo(cx + r - 6, cy);
      ctx.stroke();
      // Hazard chevron at center.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 5, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 5, cy);
      ctx.closePath();
      ctx.fill();
    } else if (spec.shape === 'triangle') {
      // Forward-pointing thruster glow + eye slit.
      const eye = ctx.createRadialGradient(cx + r * 0.2, cy, 0, cx + r * 0.2, cy, r * 0.35);
      eye.addColorStop(0, 'rgba(255,255,255,1)');
      eye.addColorStop(1, haloRgba(0));
      ctx.fillStyle = eye;
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.shape === 'pentagon') {
      // Shooter — central optic + side panels.
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.shape === 'circle') {
      // Bomber — inner red core + warning ring.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.4);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.5, '#ff416b');
      core.addColorStop(1, 'rgba(255, 65, 107, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.shape === 'diamond') {
      // Loot Goblin — gold sparkle at center.
      const spark = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
      spark.addColorStop(0, '#ffffff');
      spark.addColorStop(0.4, '#ffd75a');
      spark.addColorStop(1, 'rgba(255,215,90,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // 4-pointed star highlight.
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.moveTo(cx - r * 0.45, cy);
      ctx.lineTo(cx + r * 0.45, cy);
      ctx.stroke();
    } else if (spec.shape === 'hexagon') {
      // Shield Carrier — emitter cross on top.
      ctx.strokeStyle = 'rgba(255, 65, 107, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy);
      ctx.lineTo(cx + r * 0.55, cy);
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx, cy + r * 0.55);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 65, 107, 0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Extract Jammer — bright red core glyph.
      const inner = r * 0.45;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.4, '#ff416b');
      core.addColorStop(1, 'rgba(255, 65, 107, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.fill();
    }

    tex.refresh();
  }
}
