import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { applyGlow } from '../systems/NeonFX';

export const GENERATOR_TEXTURE_KEY = 'machine-generator';
export const GENERATOR_SMOKE_TEXTURE_KEY = 'machine-generator-smoke';
export const GENERATOR_GEAR_TEXTURE_KEY = 'machine-generator-gear';
export const GENERATOR_SPARK_TEXTURE_KEY = 'machine-generator-spark';

// Generator is the only functional moonwell in M8 (theme: moonwell) — pulses visually and yields a
// stardust pickup on a fixed cadence. The cadence is driven by EconomySystem.SPM
// (gen_level × 14 base, divided across the active moonwell count) so leveling
// up Gen in M9 increases output uniformly.

export class Generator {
  readonly x: number;
  readonly y: number;
  readonly slotIndex: number;
  private sprite: Phaser.GameObjects.Sprite;
  // Spinning rune decal on top of the chassis — gives the moonwell a visible
  // "this enchanted device is working" beat that pairs with the production cadence.
  private gear: Phaser.GameObjects.Sprite;
  // Idle ambient spark emitter (always on while healthy) — small glimmers
  // dribbling off the chassis. Production bursts use .explode() on top of this.
  private ambientSparks: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  // Producing-flash overlay: brief tint kick the frame a drop is emitted.
  private productionFlash = 0;
  private intervalSec: number;
  private timer: number;
  private pulse = 0;
  // M17 curse. When true, the moonwell stops dropping stardust, gets a
  // red overlay + jitter tween, and a smoke emitter renders above it.
  private infested = false;
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private jitterTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, intervalSec: number, slotIndex: number = 0) {
    Generator.ensureTexture(scene);
    Generator.ensureSmokeTexture(scene);
    Generator.ensureGearTexture(scene);
    Generator.ensureSparkTexture(scene);
    this.x = x;
    this.y = y;
    this.slotIndex = slotIndex;
    this.sprite = scene.add.sprite(x, y, GENERATOR_TEXTURE_KEY);
    this.sprite.setDepth(2);
    applyGlow(this.sprite, Balance.colors.player, 5, 0);

    // Spinning rune sits on top of the chassis center as a magical
    // detail — slightly translucent so the chassis pattern shows through.
    this.gear = scene.add.sprite(x, y - 4, GENERATOR_GEAR_TEXTURE_KEY);
    this.gear.setDepth(3);
    this.gear.setAlpha(0.85);
    this.gear.setScale(0.75);
    applyGlow(this.gear, 0x7cc9ff, 3, 0, 0.14);

    // Ambient working glimmers falling off the side.
    this.ambientSparks = scene.add.particles(x, y + 6, GENERATOR_SPARK_TEXTURE_KEY, {
      speed: { min: 18, max: 50 },
      angle: { min: 70, max: 110 },
      lifespan: 520,
      frequency: 220,
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffd75a, 0x7cc9ff],
      gravityY: 80,
    });
    this.ambientSparks.setDepth(3);

    this.intervalSec = intervalSec;
    // Stagger so two moonwells don't drop on the same frame.
    this.timer = Math.random() * intervalSec;
  }

  // Called by the garden scene when the moonwell drops a stardust chunk so the
  // enchanted device visibly reacts (rune kick, glimmer burst, brief brightness flash).
  triggerProductionBurst(): void {
    if (this.infested) return;
    this.productionFlash = 1.0;
    if (this.ambientSparks) {
      this.ambientSparks.explode(8, this.x + (Math.random() * 16 - 8), this.y + 6);
    }
    // Quick rune-spin kick.
    this.gear.scene.tweens.add({
      targets: this.gear,
      angle: this.gear.angle + 60,
      duration: 220,
      ease: 'Cubic.easeOut',
    });
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
      this.gear.setTint(0xff416b);
      // Stop ambient glimmers while cursed — the enchanted device isn't working.
      this.ambientSparks?.stop();
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
      // Subtle horizontal jitter on the sprite to read as "cursed".
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
      this.gear.clearTint();
      this.ambientSparks?.start();
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
      // Continuous rune rotation — feels magically alive even when no
      // drop is being produced.
      this.gear.setRotation(this.gear.rotation + dt * 1.8);

      // Production flash decay. Tint the chassis brighter for a few frames
      // after a drop so the eye locks on which moonwell just produced.
      if (this.productionFlash > 0) {
        this.productionFlash = Math.max(0, this.productionFlash - dt * 3.5);
        const t = this.productionFlash;
        const intensity = Math.floor(t * 80);
        this.sprite.setTint(Phaser.Display.Color.GetColor(255, 255 - intensity, 255 - intensity * 2));
        if (this.productionFlash <= 0.01) this.sprite.clearTint();
      }
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer += this.intervalSec;
      return !this.infested; // cursed moonwells never drop
    }
    return false;
  }

  // Random offset around the moonwell so drops scatter onto the floor instead
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
    this.smokeEmitter = null;
    this.ambientSparks?.destroy();
    this.ambientSparks = null;
    this.gear.destroy();
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

  // Moonwell — a round stone well brimming with glowing moonlit water.
  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(GENERATOR_TEXTURE_KEY)) return;
    const dim = Balance.factory.generatorSize;
    const tex = scene.textures.createCanvas(GENERATOR_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const rim = dim / 2 - 3;

    // Moonlit back-glow so the well reads as "enchanted and alive" from afar.
    const halo = ctx.createRadialGradient(cx, cy, dim * 0.15, cx, cy, dim * 0.65);
    halo.addColorStop(0, 'rgba(124, 201, 255, 0.35)');
    halo.addColorStop(1, 'rgba(124, 201, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);

    // Stone well ring.
    const stone = ctx.createLinearGradient(0, cy - rim, 0, cy + rim);
    stone.addColorStop(0, '#34285c');
    stone.addColorStop(0.5, '#241a44');
    stone.addColorStop(1, '#160e2e');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.arc(cx, cy, rim, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(124, 201, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner lip.
    ctx.strokeStyle = 'rgba(124, 201, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rim - 5, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing moonlit pool.
    const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, rim - 5);
    pool.addColorStop(0, 'rgba(255,255,255,0.92)');
    pool.addColorStop(0.4, 'rgba(160,225,255,0.6)');
    pool.addColorStop(0.8, 'rgba(124,201,255,0.18)');
    pool.addColorStop(1, 'rgba(124,201,255,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(cx, cy, rim - 5, 0, Math.PI * 2);
    ctx.fill();

    // A couple of bright sparkles floating on the water.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [sx, sy, sr] of [[cx - rim * 0.3, cy - rim * 0.2, 1.6], [cx + rim * 0.25, cy + rim * 0.15, 2.1]] as const) {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.refresh();
  }

  // Spinning bloom-rune that floats over the moonwell: a 6-petal glowing
  // flower with a gold heart. Rotation makes it read as living magic.
  static ensureGearTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(GENERATOR_GEAR_TEXTURE_KEY)) return;
    const dim = 40;
    const tex = scene.textures.createCanvas(GENERATOR_GEAR_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;

    // Six petals radiating from the centre.
    const petals = 6;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      const px = cx + Math.cos(a) * 8;
      const py = cy + Math.sin(a) * 8;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      const petal = ctx.createLinearGradient(-6, 0, 6, 0);
      petal.addColorStop(0, 'rgba(185,140,255,0.35)');
      petal.addColorStop(1, 'rgba(124,201,255,0.85)');
      ctx.fillStyle = petal;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // Gold flower heart.
    const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
    heart.addColorStop(0, 'rgba(255,255,255,1)');
    heart.addColorStop(0.45, 'rgba(255,215,90,0.95)');
    heart.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = heart;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }

  // Tiny soft glimmer used by the ambient working-particle emitter.
  static ensureSparkTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(GENERATOR_SPARK_TEXTURE_KEY)) return;
    const dim = 8;
    const tex = scene.textures.createCanvas(GENERATOR_SPARK_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim, dim);
    tex.refresh();
  }
}
