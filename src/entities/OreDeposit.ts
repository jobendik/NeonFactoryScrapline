import Phaser from 'phaser';
import { applyGlow } from '../systems/NeonFX';

// OreDeposit — a static, decorative ore vein on the factory floor. Represents
// the raw material that generators "process" into Scrap. Visual only: shimmers,
// occasionally puffs a glint particle, and pulses with a soft cyan/violet halo.
//
// Each ore deposit is paired (in FactoryScene) with a conveyor belt that
// transports ore from the deposit into a generator. The deposit itself does
// not produce gameplay state — the visual just sells the fiction that the
// factory has a feedstock.

export const ORE_DEPOSIT_TEXTURE_KEY = 'ore-deposit';
export const ORE_SHARD_TEXTURE_KEY = 'ore-shard';

export type OreTint = 'cyan' | 'violet' | 'gold';

const TINT_COLORS: Record<OreTint, number> = {
  cyan: 0x22f6ff,
  violet: 0xa76cff,
  gold: 0xffd75a,
};

export class OreDeposit {
  readonly x: number;
  readonly y: number;
  readonly tint: OreTint;
  private sprite: Phaser.GameObjects.Sprite;
  private haloSprite: Phaser.GameObjects.Sprite;
  private shimmer: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private pulseTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, tint: OreTint = 'cyan') {
    OreDeposit.ensureTextures(scene);
    this.x = x;
    this.y = y;
    this.tint = tint;
    const colorNum = TINT_COLORS[tint];

    // Soft halo underneath the ore to make it read as "lit from within".
    this.haloSprite = scene.add.sprite(x, y, ORE_DEPOSIT_TEXTURE_KEY + '-halo-' + tint);
    this.haloSprite.setDepth(0);
    this.haloSprite.setAlpha(0.55);

    this.sprite = scene.add.sprite(x, y, ORE_DEPOSIT_TEXTURE_KEY + '-' + tint);
    this.sprite.setDepth(1);
    applyGlow(this.sprite, colorNum, 6, 0, 0.18);

    // Subtle shimmer particles — small sparkles drifting upward off the shards.
    this.shimmer = scene.add.particles(x, y - 4, ORE_SHARD_TEXTURE_KEY, {
      speed: { min: 8, max: 26 },
      angle: { min: 250, max: 290 },
      lifespan: 1100,
      frequency: 280,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: colorNum,
    });
    this.shimmer.setDepth(2);
  }

  // Per-frame: subtle scale pulse on the halo so the ore looks alive.
  update(dt: number): void {
    this.pulseTimer += dt;
    const scale = 1 + Math.sin(this.pulseTimer * 1.8) * 0.08;
    this.haloSprite.setScale(scale);
    const rot = this.sprite.rotation + dt * 0.06;
    this.sprite.setRotation(rot);
  }

  destroy(): void {
    this.sprite.destroy();
    this.haloSprite.destroy();
    this.shimmer?.destroy();
    this.shimmer = null;
  }

  static ensureTextures(scene: Phaser.Scene): void {
    // Tiny shard particle used by all tints — colored at emit time.
    if (!scene.textures.exists(ORE_SHARD_TEXTURE_KEY)) {
      const dim = 8;
      const tex = scene.textures.createCanvas(ORE_SHARD_TEXTURE_KEY, dim, dim);
      if (tex) {
        const ctx = tex.context;
        const cx = dim / 2;
        const cy = dim / 2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, dim, dim);
        tex.refresh();
      }
    }

    for (const tint of Object.keys(TINT_COLORS) as OreTint[]) {
      const color = TINT_COLORS[tint];
      OreDeposit.ensureHaloTexture(scene, tint, color);
      OreDeposit.ensureShardTexture(scene, tint, color);
    }
  }

  // Big radial halo behind the ore.
  private static ensureHaloTexture(scene: Phaser.Scene, tint: OreTint, color: number): void {
    const key = ORE_DEPOSIT_TEXTURE_KEY + '-halo-' + tint;
    if (scene.textures.exists(key)) return;
    const dim = 128;
    const tex = scene.textures.createCanvas(key, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dim / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},0.22)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim, dim);
    tex.refresh();
  }

  // Crystal cluster — five jagged shards arranged in a starburst.
  private static ensureShardTexture(scene: Phaser.Scene, tint: OreTint, color: number): void {
    const key = ORE_DEPOSIT_TEXTURE_KEY + '-' + tint;
    if (scene.textures.exists(key)) return;
    const dim = 72;
    const tex = scene.textures.createCanvas(key, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Base rocky mound — dark slate ring around the shards.
    ctx.fillStyle = 'rgba(8,14,22,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Crystal shards — 5 of them, jagged angular faces.
    const shards: Array<{ angle: number; len: number; w: number }> = [
      { angle: -Math.PI / 2, len: 24, w: 9 },
      { angle: -Math.PI / 2 - 0.7, len: 18, w: 6 },
      { angle: -Math.PI / 2 + 0.7, len: 18, w: 6 },
      { angle: -Math.PI / 2 - 1.3, len: 13, w: 4 },
      { angle: -Math.PI / 2 + 1.3, len: 13, w: 4 },
    ];

    for (const s of shards) {
      const tipX = cx + Math.cos(s.angle) * s.len;
      const tipY = cy + Math.sin(s.angle) * s.len + 2;
      const perpX = Math.cos(s.angle + Math.PI / 2);
      const perpY = Math.sin(s.angle + Math.PI / 2);
      const baseLX = cx + perpX * s.w * 0.5;
      const baseLY = cy + perpY * s.w * 0.5 + 4;
      const baseRX = cx - perpX * s.w * 0.5;
      const baseRY = cy - perpY * s.w * 0.5 + 4;

      // Gradient body — bright core to darker edge.
      const grad = ctx.createLinearGradient(tipX, tipY, (baseLX + baseRX) / 2, (baseLY + baseRY) / 2);
      grad.addColorStop(0, `rgba(255,255,255,1)`);
      grad.addColorStop(0.3, `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)},1)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.85)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseLX, baseLY);
      ctx.lineTo(baseRX, baseRY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,0.9)`;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Inner facet highlight on one side.
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo((tipX + baseLX) / 2, (tipY + baseLY) / 2);
      ctx.lineTo(baseLX, baseLY);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,0.4)`;
      ctx.fill();
    }

    // Bright pip in the cluster center.
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 2.4, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }
}
