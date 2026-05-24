import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { applyGlow } from '../systems/NeonFX';

export const GENERATOR_TEXTURE_KEY = 'machine-generator';
export const GENERATOR_SMOKE_TEXTURE_KEY = 'machine-generator-smoke';

// Generator is the only functional machine in M8 — pulses visually and yields a
// scrap pickup on a fixed cadence. The cadence is driven by EconomySystem.SPM
// (gen_level × 14 base, divided across the active generator count) so leveling
// up Gen in M9 increases output uniformly.

export class Generator {
  readonly x: number;
  readonly y: number;
  readonly slotIndex: number;
  private sprite: Phaser.GameObjects.Sprite;
  private intervalSec: number;
  private timer: number;
  private pulse = 0;
  // M17 infestation. When true, the generator stops dropping scrap, gets a
  // red overlay + jitter tween, and a smoke emitter renders above it.
  private infested = false;
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private jitterTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, intervalSec: number, slotIndex: number = 0) {
    Generator.ensureTexture(scene);
    Generator.ensureSmokeTexture(scene);
    this.x = x;
    this.y = y;
    this.slotIndex = slotIndex;
    this.sprite = scene.add.sprite(x, y, GENERATOR_TEXTURE_KEY);
    this.sprite.setDepth(2);
    applyGlow(this.sprite, Balance.colors.player, 5, 0);
    this.intervalSec = intervalSec;
    // Stagger so two generators don't drop on the same frame.
    this.timer = Math.random() * intervalSec;
  }

  setIntervalSec(sec: number): void {
    this.intervalSec = sec;
  }

  setInfested(infested: boolean): void {
    if (this.infested === infested) return;
    this.infested = infested;
    const scene = this.sprite.scene;
    if (infested) {
      this.sprite.setTint(0xff416b);
      this.overlay = scene.add.graphics().setDepth(3);
      this.overlay.fillStyle(0xff1644, 0.28);
      this.overlay.fillRect(
        this.x - Balance.factory.generatorSize / 2,
        this.y - Balance.factory.generatorSize / 2,
        Balance.factory.generatorSize,
        Balance.factory.generatorSize,
      );
      this.overlay.lineStyle(2, 0xff1644, 0.85);
      this.overlay.strokeRect(
        this.x - Balance.factory.generatorSize / 2,
        this.y - Balance.factory.generatorSize / 2,
        Balance.factory.generatorSize,
        Balance.factory.generatorSize,
      );
      // Subtle horizontal jitter on the sprite to read as "glitched".
      this.jitterTween = scene.tweens.add({
        targets: this.sprite,
        x: { from: this.x - 2, to: this.x + 2 },
        duration: 110,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      });
      this.smokeEmitter = scene.add.particles(this.x, this.y - 12, GENERATOR_SMOKE_TEXTURE_KEY, {
        speed: { min: 18, max: 38 },
        angle: { min: 250, max: 290 },
        lifespan: 900,
        frequency: 110,
        scale: { start: 0.65, end: 0.05 },
        alpha: { start: 0.85, end: 0 },
        tint: 0xff416b,
      });
      this.smokeEmitter.setDepth(4);
    } else {
      this.sprite.clearTint();
      this.overlay?.destroy();
      this.overlay = null;
      this.jitterTween?.stop();
      this.jitterTween = null;
      this.sprite.setX(this.x);
      this.smokeEmitter?.destroy();
      this.smokeEmitter = null;
    }
  }

  isInfested(): boolean {
    return this.infested;
  }

  // Returns true on the frames where a drop should be spawned. The caller
  // pulls a Pickup out of the scene's pool and calls .spawn(...) accordingly.
  tick(dt: number): boolean {
    this.pulse += dt;
    if (!this.infested) {
      const scale = 1 + Math.sin(this.pulse * Balance.factory.generatorPulseHz * Math.PI * 2) * 0.05;
      this.sprite.setScale(scale);
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer += this.intervalSec;
      return !this.infested; // infested machines never drop
    }
    return false;
  }

  // Random offset around the generator so drops scatter onto the floor instead
  // of stacking at one pixel.
  randomDropPosition(): { x: number; y: number } {
    const minR = Balance.factory.generatorDropOffsetMin;
    const maxR = Balance.factory.generatorDropOffsetMax;
    const r = minR + Math.random() * (maxR - minR);
    const a = Math.random() * Math.PI * 2;
    return { x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r };
  }

  destroy(): void {
    this.overlay?.destroy();
    this.jitterTween?.stop();
    this.smokeEmitter?.destroy();
    this.sprite.destroy();
  }

  static ensureSmokeTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(GENERATOR_SMOKE_TEXTURE_KEY)) return;
    const dim = 24;
    const tex = scene.textures.createCanvas(GENERATOR_SMOKE_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const grad = ctx.createRadialGradient(dim / 2, dim / 2, 0, dim / 2, dim / 2, dim / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim, dim);
    tex.refresh();
  }

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(GENERATOR_TEXTURE_KEY)) return;
    const dim = Balance.factory.generatorSize;
    const tex = scene.textures.createCanvas(GENERATOR_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    // Cyan back-glow so the chassis reads as "powered on" from afar.
    const halo = ctx.createRadialGradient(cx, cy, dim * 0.2, cx, cy, dim * 0.65);
    halo.addColorStop(0, 'rgba(34, 246, 255, 0.35)');
    halo.addColorStop(1, 'rgba(34, 246, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);
    // Chassis — slate body with metallic gradient.
    const chassis = ctx.createLinearGradient(0, 0, 0, dim);
    chassis.addColorStop(0, '#1c2a3a');
    chassis.addColorStop(0.5, '#101724');
    chassis.addColorStop(1, '#070c14');
    ctx.fillStyle = chassis;
    roundRect(ctx, 3, 3, dim - 6, dim - 6, 8);
    ctx.fill();
    // Outline + inner panel inset
    ctx.strokeStyle = 'rgba(34, 246, 255, 0.95)';
    ctx.lineWidth = 2;
    roundRect(ctx, 3, 3, dim - 6, dim - 6, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34, 246, 255, 0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, 8, 8, dim - 16, dim - 16, 5);
    ctx.stroke();
    // Bolt heads in corners.
    ctx.fillStyle = '#22f6ff';
    for (const [bx, by] of [[8, 8], [dim - 8, 8], [8, dim - 8], [dim - 8, dim - 8]] as const) {
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sine wave indicator with glow.
    const w = dim - 22;
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#22f6ff';
    ctx.strokeStyle = '#22f6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const px = cx - w / 2 + t * w;
      const py = cy + Math.sin(t * Math.PI * 4) * 8;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    // Top status LED.
    const led = ctx.createRadialGradient(cx, 11, 0, cx, 11, 4);
    led.addColorStop(0, '#ffffff');
    led.addColorStop(0.5, '#72ff9f');
    led.addColorStop(1, 'rgba(114, 255, 159, 0)');
    ctx.fillStyle = led;
    ctx.beginPath();
    ctx.arc(cx, 11, 4, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
