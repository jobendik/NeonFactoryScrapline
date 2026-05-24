import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { PowerupDefs, type PowerupKind } from '../config/PowerupDefs';
import { applyGlow } from '../systems/NeonFX';

// Field-spawned power-up per blueprint §13. Pentagon ring shape, color per
// def, magnetizes toward the player when in range (same pull profile as
// Pickup but with a wider radius). Pooled via a Phaser Group on the scene
// side, like Pickup/Enemy/Bullet.

export const POWERUP_TEXTURE_KEY = 'powerup-ring';

export class Powerup extends Phaser.Physics.Arcade.Sprite {
  kind: PowerupKind = 'magnetBurst';
  private pulse = 0;
  private age = 0;
  private body_!: Phaser.Physics.Arcade.Body;
  private glowApplied = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Powerup.ensureTexture(scene);
    super(scene, x, y, POWERUP_TEXTURE_KEY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body_ = this.body as Phaser.Physics.Arcade.Body;
    // 48px texture → center is (24, 24). Body radius 12, offset (12, 12).
    this.body_.setCircle(12, 12, 12);
    this.setActive(false).setVisible(false);
    this.body_.enable = false;
  }

  spawn(x: number, y: number, kind: PowerupKind): void {
    const kindChanged = this.kind !== kind || !this.glowApplied;
    this.kind = kind;
    const def = PowerupDefs[kind];
    this.setPosition(x, y);
    this.setTint(def.color);
    this.body_.enable = true;
    this.setActive(true).setVisible(true);
    this.setAlpha(1);
    this.setScale(1);
    this.pulse = 0;
    this.age = 0;
    this.body_.setVelocity(0, 0);
    this.body_.setDrag(0, 0);
    if (kindChanged) {
      const fx = (this as unknown as { preFX?: { clear?: () => void } }).preFX;
      fx?.clear?.();
      applyGlow(this, def.color, 6, 1);
      this.glowApplied = true;
    }
  }

  kill(): void {
    this.body_.setVelocity(0, 0);
    this.body_.enable = false;
    this.setActive(false).setVisible(false);
  }

  // Magnet behavior modeled after Pickup. Power-ups have a larger pull radius
  // so the player doesn't have to walk directly onto them.
  updateMagnet(dt: number, playerX: number, playerY: number, magnetRadius: number): void {
    if (!this.active) return;
    this.age += dt;
    this.pulse += dt;
    const scale = 1 + Math.sin(this.pulse * 5.0) * 0.08;
    this.setScale(scale);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.5 || dist > magnetRadius) return;

    const closeness = 1 - dist / magnetRadius;
    const speed = Phaser.Math.Linear(180, 520, closeness);
    this.body_.setVelocity((dx / dist) * speed, (dy / dist) * speed);
  }

  // Generates the shared pentagon-ring texture once per scene. Drawn white +
  // outlined so setTint() can recolor it cleanly per power-up kind.
  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(POWERUP_TEXTURE_KEY)) return;
    const dim = 48;
    const tex = scene.textures.createCanvas(POWERUP_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const r = 13;
    // Soft white halo — setTint colors it per powerup kind.
    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, cx);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    halo.addColorStop(0.5, 'rgba(255, 255, 255, 0.30)');
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);
    // Outer dim ring
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    // Pentagon body + bright outline
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    body.addColorStop(0, 'rgba(255,255,255,0.95)');
    body.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    body.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Bright center dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
}

// Read by PowerupSystem so it doesn't accidentally over-shoot the §13 cap.
export const POWERUP_MAX_ON_FIELD = Balance.powerups.maxOnField;
