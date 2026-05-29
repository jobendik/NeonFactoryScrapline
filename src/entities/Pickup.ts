import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { PARTICLE_TEXTURE_KEY } from '../systems/ParticleEffects';
import { applyGlow } from '../systems/NeonFX';
import { saveSystem } from '../platform/SaveSystem';
import type { Rng } from '../core/Rng';

export type PickupType = 'scrap' | 'core';

export const SCRAP_TEXTURE_KEY = 'pickup-scrap';
export const CORE_TEXTURE_KEY = 'pickup-core';

// Pickup entity — collectible stardust and Star Hearts. Pooled via a Phaser Group on the scene side.
// Magnet behavior is manual (per-frame distance check + direct velocity set)
// so it feels responsive; collection itself goes through Arcade overlap with
// the player body, per architecture rules ("Arcade Physics for pickup collision").

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  type: PickupType = 'scrap';
  value = 1;
  private body_!: Phaser.Physics.Arcade.Body;
  private age = 0;
  private glowApplied = false;
  // M22 §8.5 Magnet Lv. 5: pickups briefly orbit the player before final
  // collection. orbitTimer counts up while in orbit phase; once it exceeds
  // orbitDurationSec, the pickup beelines and is collected as usual.
  private orbitTimer = 0;
  private orbitAngle = 0;
  // M22 §8.5 Luck Lv. 5: Star Heart pickups leave a gold sparkle trail. One small
  // emitter per active Star Heart; cleared on kill.
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Pickup.ensureTextures(scene);
    super(scene, x, y, SCRAP_TEXTURE_KEY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body_ = this.body as Phaser.Physics.Arcade.Body;
    // Texture is up to 28px (Star Heart); body radius 7, offset (5,5) for the
    // 24px stardust texture centers around the mote. Star Hearts resize automatically
    // because Phaser keeps the body offset relative to the active texture's
    // bounds — recompute on spawn() if we add per-type radii later.
    this.body_.setCircle(7, 5, 5);
    this.setActive(false).setVisible(false);
    this.body_.enable = false;
  }

  spawn(x: number, y: number, type: PickupType, value = 1, rng: Rng | null = null): void {
    const typeChanged = this.type !== type || !this.glowApplied;
    this.type = type;
    this.value = Math.max(1, value);
    this.setTexture(type === 'scrap' ? SCRAP_TEXTURE_KEY : CORE_TEXTURE_KEY);
    // Re-center the collision circle on the active texture frame (stardust and
    // Star Heart frames differ in size), so magnet pickup stays accurate.
    const r = 7;
    this.body_.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setPosition(x, y);
    this.body_.enable = true;
    this.setActive(true).setVisible(true);
    this.setAlpha(1);
    this.age = 0;
    this.orbitTimer = 0;
    if (typeChanged) {
      const fx = (this as unknown as { preFX?: { clear?: () => void } }).preFX;
      fx?.clear?.();
      applyGlow(this, type === 'scrap' ? Balance.colors.scrap : Balance.colors.core, 7, 1, 0.18);
      this.glowApplied = true;
    }

    const angle = rng ? rng.next() * Math.PI * 2 : Math.random() * Math.PI * 2;
    const speed = rng
      ? rng.int(Balance.magnet.popOutSpeedMin, Balance.magnet.popOutSpeedMax)
      : Phaser.Math.Between(Balance.magnet.popOutSpeedMin, Balance.magnet.popOutSpeedMax);
    this.body_.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.body_.setDrag(Balance.magnet.popOutDrag, Balance.magnet.popOutDrag);

    // §8.5 Luck Lv. 5 — gold sparkle trail on Star Heart pickups. The emitter is
    // owned per-pickup (released on kill) since Star Hearts are short-lived.
    this.refreshSparkleEmitter();
  }

  // Used by the flying-home-through-the-moongate "moment": every active pickup beelines to the player
  // at flyInSpeed, ignoring magnet radius.
  flyIn(playerX: number, playerY: number, speed: number): void {
    if (!this.active) return;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.5) return;
    this.body_.setDrag(0, 0);
    this.body_.setVelocity((dx / d) * speed, (dy / d) * speed);
  }

  kill(): void {
    this.body_.setVelocity(0, 0);
    this.body_.enable = false;
    this.setActive(false).setVisible(false);
    if (this.sparkleEmitter) {
      this.sparkleEmitter.destroy();
      this.sparkleEmitter = null;
    }
  }

  // Build (or skip) the gold sparkle emitter per Luck Lv. 5. Idempotent —
  // calling on a non-Star-Heart pickup or a low-luck save is a no-op.
  private refreshSparkleEmitter(): void {
    if (this.sparkleEmitter) {
      this.sparkleEmitter.destroy();
      this.sparkleEmitter = null;
    }
    if (this.type !== 'core') return;
    const luck = saveSystem.get().upgrades.luck;
    if (luck < 5) return;
    if (!this.scene.textures.exists(PARTICLE_TEXTURE_KEY)) return;
    this.sparkleEmitter = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 20, max: 60 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 420,
      tint: Balance.colors.core,
      frequency: 70,
    });
    this.sparkleEmitter.setDepth(this.depth - 1);
  }

  // Pulls the pickup toward the player when within magnetRadius.
  // Speed scales linearly: minPullSpeed at the edge of magnetRadius,
  // maxPullSpeed when nearly on top of the player.
  // M22 §8.5 Magnet Lv. 5: when the pickup gets within the orbit-entry
  // radius, it spends `orbitDurationSec` orbiting the player at a fixed
  // radius before final collection. Pure visual flourish — the value lands
  // identically once the orbit timer expires.
  updateMagnet(dt: number, playerX: number, playerY: number, magnetRadius: number, forceOrbit = false): void {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= Balance.magnet.pickupLifespanSec) {
      this.kill();
      return;
    }
    // Keep the sparkle emitter glued to the pickup each frame.
    if (this.sparkleEmitter) {
      this.sparkleEmitter.setPosition(this.x, this.y);
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.5 || dist > magnetRadius) return;

    const magnetLvl = saveSystem.get().upgrades.magnet;
    const orbitEnabled = magnetLvl >= 5 || forceOrbit;
    const orbitEntryRadius = Balance.magnet.orbitEntryRadius;
    const orbitRadius = Balance.magnet.orbitRadius;

    // Enter orbit phase the first frame we're inside the orbit-entry
    // radius (if the milestone is unlocked).
    if (orbitEnabled && dist <= orbitEntryRadius && this.orbitTimer < Balance.magnet.orbitDurationSec) {
      if (this.orbitTimer === 0) {
        // Pick orbit angle from current relative position so the dance
        // starts where the pickup was. Subsequent frames advance the angle.
        this.orbitAngle = Math.atan2(this.y - playerY, this.x - playerX);
      }
      this.orbitTimer += dt;
      this.orbitAngle += dt * Balance.magnet.orbitSpeedRad;
      const ox = playerX + Math.cos(this.orbitAngle) * orbitRadius;
      const oy = playerY + Math.sin(this.orbitAngle) * orbitRadius;
      // Snap-position via velocity to keep the body in sync (no teleport).
      const odx = ox - this.x;
      const ody = oy - this.y;
      const odist = Math.hypot(odx, ody);
      const moveSpeed = Math.max(60, odist / Math.max(0.001, dt));
      this.body_.setVelocity(
        (odx / Math.max(0.001, odist)) * moveSpeed,
        (ody / Math.max(0.001, odist)) * moveSpeed,
      );
      this.body_.setDrag(0, 0);
      return;
    }

    const closeness = 1 - dist / magnetRadius;
    const speed = Phaser.Math.Linear(Balance.magnet.minPullSpeed, Balance.magnet.maxPullSpeed, closeness);
    this.body_.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    this.body_.setDrag(0, 0);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    // Stardust — a cute 4-point twinkle/sparkle star (moon-blue) with a bright
    // core and a soft halo, plus a tiny secondary sparkle for the "twinkle".
    if (!scene.textures.exists(SCRAP_TEXTURE_KEY)) {
      const dim = 26;
      const tex = scene.textures.createCanvas(SCRAP_TEXTURE_KEY, dim, dim);
      if (tex) {
        const ctx = tex.context;
        const cx = dim / 2;
        const cy = dim / 2;
        // Moon-blue glow halo.
        const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, cx);
        halo.addColorStop(0, 'rgba(124, 201, 255, 0.8)');
        halo.addColorStop(0.5, 'rgba(124, 201, 255, 0.32)');
        halo.addColorStop(1, 'rgba(124, 201, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, dim, dim);
        // 4-point sparkle: long points with concave waists.
        const outer = 9.5;
        const waist = 2.6;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + i * (Math.PI / 4);
          const rad = i % 2 === 0 ? outer : waist;
          const px = cx + Math.cos(a) * rad;
          const py = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
        body.addColorStop(0, '#ffffff');
        body.addColorStop(0.45, '#bfeaff');
        body.addColorStop(1, '#4aa6e8');
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Bright center + a small offset twinkle.
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + outer * 0.42, cy - outer * 0.42, 1.1, 0, Math.PI * 2);
        ctx.fill();
        tex.refresh();
      }
    }
    // Star Heart — a glossy gold/rose heart gem with a shine highlight and a
    // warm halo, distinct from the blue stardust sparkle.
    if (!scene.textures.exists(CORE_TEXTURE_KEY)) {
      const dim = 30;
      const tex = scene.textures.createCanvas(CORE_TEXTURE_KEY, dim, dim);
      if (tex) {
        const ctx = tex.context;
        const cx = dim / 2;
        const cy = dim / 2;
        // Warm gold glow halo.
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
        halo.addColorStop(0, 'rgba(255, 205, 120, 0.8)');
        halo.addColorStop(0.5, 'rgba(255, 205, 120, 0.32)');
        halo.addColorStop(1, 'rgba(255, 205, 120, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, dim, dim);
        // Heart path (two top lobes + bottom tip), centered.
        const s = 8.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.7);
        ctx.bezierCurveTo(cx - s * 1.15, cy - s * 0.15, cx - s * 0.7, cy - s * 1.05, cx, cy - s * 0.4);
        ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.05, cx + s * 1.15, cy - s * 0.15, cx, cy + s * 0.7);
        ctx.closePath();
        const body = ctx.createRadialGradient(cx - 2, cy - 3, 0, cx, cy, s * 1.2);
        body.addColorStop(0, '#fff6e0');
        body.addColorStop(0.4, '#ffd877');
        body.addColorStop(0.8, '#ff9ec4');
        body.addColorStop(1, '#d4607f');
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Glossy shine highlight on the left lobe.
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.45, cy - s * 0.45, s * 0.28, s * 0.18, -0.5, 0, Math.PI * 2);
        ctx.fill();
        tex.refresh();
      }
    }
  }
}
