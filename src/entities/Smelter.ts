import Phaser from 'phaser';
import { applyGlow } from '../systems/NeonFX';

// Smelter — central refinery building where workers deliver scrap. Visual only
// (no gameplay state); the worker deposit logic still uses the configured
// Balance.factory.workerDepositPoint. The Smelter occupies that point.
//
// Components:
//   - Stationary chassis (a wide trapezoid base + body)
//   - Rotating drum on top (driven sprite)
//   - Glowing furnace mouth on the front (pulses)
//   - Continuous smoke plume from a stack
//   - Bright deposit funnel (the bowl-shaped intake the workers walk up to)
//
// Call .pulseDeposit() when a worker delivers — the furnace mouth flashes
// brighter and an extra burst of embers shoots up the stack.

export const SMELTER_BASE_KEY = 'smelter-base';
export const SMELTER_DRUM_KEY = 'smelter-drum';
export const SMELTER_FUNNEL_KEY = 'smelter-funnel';
export const SMELTER_FURNACE_KEY = 'smelter-furnace';
export const SMELTER_EMBER_KEY = 'smelter-ember';

const COLOR_CYAN = 0x22f6ff;
const COLOR_AMBER = 0xff8c2a;

export class Smelter {
  readonly x: number;
  readonly y: number;
  private base: Phaser.GameObjects.Sprite;
  private drum: Phaser.GameObjects.Sprite;
  private funnel: Phaser.GameObjects.Sprite;
  private furnace: Phaser.GameObjects.Sprite;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private emberEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private depositGlowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private pulseTimer = 0;
  private pulseFlash = 0;
  private stackX = 0;
  private stackY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Smelter.ensureTextures(scene);
    this.x = x;
    this.y = y;

    // Depth budget — base sprite at -1 keeps the player visible if they
    // walk across the smelter (it's a large 220×140 sprite — full occlusion
    // would feel bad). Drum + funnel + furnace go on top so the moving
    // elements + intake glow read clearly.
    //
    // Base chassis — large slate trapezoid + body. Sits a bit south so the
    // intake funnel lines up with the worker deposit point.
    this.base = scene.add.sprite(x, y + 12, SMELTER_BASE_KEY);
    this.base.setDepth(-1);
    applyGlow(this.base, COLOR_CYAN, 5, 0, 0.14);

    // Rotating drum sitting atop the chassis.
    this.drum = scene.add.sprite(x, y - 38, SMELTER_DRUM_KEY);
    this.drum.setDepth(2);
    applyGlow(this.drum, COLOR_CYAN, 4, 0, 0.15);

    // Deposit funnel on the front face — bright cyan bowl with rim glow.
    this.funnel = scene.add.sprite(x, y + 8, SMELTER_FUNNEL_KEY);
    this.funnel.setDepth(0);
    applyGlow(this.funnel, COLOR_CYAN, 6, 1, 0.16);

    // Furnace mouth glow — bright amber slot on the body's front.
    this.furnace = scene.add.sprite(x, y - 6, SMELTER_FURNACE_KEY);
    this.furnace.setDepth(0);
    applyGlow(this.furnace, COLOR_AMBER, 8, 1, 0.18);

    // Smoke plume rising off the smelter stack. Stack lives at the
    // base sprite's top-right; mouth is roughly at world (x + 62, y - 58).
    const stackX = x + 62;
    const stackY = y - 58;
    this.smokeEmitter = scene.add.particles(stackX, stackY, SMELTER_EMBER_KEY, {
      speed: { min: 12, max: 32 },
      angle: { min: 255, max: 285 },
      lifespan: 2200,
      frequency: 90,
      scale: { start: 0.55, end: 1.2 },
      alpha: { start: 0.45, end: 0 },
      tint: 0x6d8aa3,
    });
    this.smokeEmitter.setDepth(3);

    // Ember sparks shooting straight up periodically from the stack.
    this.emberEmitter = scene.add.particles(stackX, stackY, SMELTER_EMBER_KEY, {
      speed: { min: 20, max: 80 },
      angle: { min: 260, max: 280 },
      lifespan: 900,
      frequency: 280,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: COLOR_AMBER,
    });
    this.emberEmitter.setDepth(3);
    this.stackX = stackX;
    this.stackY = stackY;

    // Soft deposit glow particles floating upward from the funnel — looks
    // like ambient steam over the scrap intake.
    this.depositGlowEmitter = scene.add.particles(x, y + 8, SMELTER_EMBER_KEY, {
      speed: { min: 6, max: 18 },
      angle: { min: 255, max: 285 },
      lifespan: 1400,
      frequency: 220,
      scale: { start: 0.45, end: 0.05 },
      alpha: { start: 0.7, end: 0 },
      tint: COLOR_CYAN,
    });
    this.depositGlowEmitter.setDepth(2);
  }

  update(dt: number): void {
    this.pulseTimer += dt;
    // Rotating drum.
    this.drum.setRotation(this.drum.rotation + dt * 1.4);

    // Furnace breathing pulse.
    const breath = 1 + Math.sin(this.pulseTimer * 2.6) * 0.06 + this.pulseFlash;
    this.furnace.setScale(breath);
    this.funnel.setScale(1 + this.pulseFlash * 0.5);

    if (this.pulseFlash > 0) {
      this.pulseFlash = Math.max(0, this.pulseFlash - dt * 1.6);
    }
  }

  // Called by FactoryScene when a worker delivers — visible kick to the
  // furnace + extra ember burst from the stack.
  pulseDeposit(): void {
    this.pulseFlash = 0.35;
    if (this.emberEmitter) {
      this.emberEmitter.explode(14, this.stackX, this.stackY);
    }
  }

  destroy(): void {
    this.base.destroy();
    this.drum.destroy();
    this.funnel.destroy();
    this.furnace.destroy();
    this.smokeEmitter?.destroy();
    this.emberEmitter?.destroy();
    this.depositGlowEmitter?.destroy();
  }

  static ensureTextures(scene: Phaser.Scene): void {
    Smelter.ensureBaseTexture(scene);
    Smelter.ensureDrumTexture(scene);
    Smelter.ensureFunnelTexture(scene);
    Smelter.ensureFurnaceTexture(scene);
    Smelter.ensureEmberTexture(scene);
  }

  // Base: wide trapezoid + body with rivets and side vents.
  private static ensureBaseTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_BASE_KEY)) return;
    const w = 220;
    const h = 140;
    const tex = scene.textures.createCanvas(SMELTER_BASE_KEY, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const cx = w / 2;

    // Soft cyan back-glow behind the chassis.
    const halo = ctx.createRadialGradient(cx, h * 0.55, 8, cx, h * 0.55, w * 0.6);
    halo.addColorStop(0, 'rgba(34,246,255,0.22)');
    halo.addColorStop(1, 'rgba(34,246,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Trapezoid base — wider at the bottom.
    const baseTop = h * 0.35;
    const baseBot = h - 12;
    const baseInset = 22;
    const grad = ctx.createLinearGradient(0, baseTop, 0, baseBot);
    grad.addColorStop(0, '#1a2a3a');
    grad.addColorStop(0.5, '#101824');
    grad.addColorStop(1, '#070d16');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseInset, baseTop);
    ctx.lineTo(w - baseInset, baseTop);
    ctx.lineTo(w - 8, baseBot);
    ctx.lineTo(8, baseBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,246,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner panel inset.
    ctx.strokeStyle = 'rgba(34,246,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baseInset + 8, baseTop + 6);
    ctx.lineTo(w - baseInset - 8, baseTop + 6);
    ctx.lineTo(w - 16, baseBot - 6);
    ctx.lineTo(16, baseBot - 6);
    ctx.closePath();
    ctx.stroke();

    // Body box on top.
    const bodyTop = h * 0.1;
    const bodyBot = baseTop;
    const bodyInset = 38;
    const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
    bodyGrad.addColorStop(0, '#1c2c40');
    bodyGrad.addColorStop(0.5, '#0e1a2a');
    bodyGrad.addColorStop(1, '#0a121c');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(bodyInset, bodyTop, w - bodyInset * 2, bodyBot - bodyTop);
    ctx.strokeStyle = 'rgba(34,246,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bodyInset, bodyTop, w - bodyInset * 2, bodyBot - bodyTop);

    // Side vents — vertical louver slits on both sides of the body.
    ctx.fillStyle = 'rgba(34,246,255,0.45)';
    for (let i = 0; i < 5; i++) {
      const vy = bodyTop + 14 + i * 10;
      ctx.fillRect(bodyInset + 6, vy, 8, 3);
      ctx.fillRect(w - bodyInset - 14, vy, 8, 3);
    }

    // Smokestack on top-right.
    const stackX = w - bodyInset - 18;
    const stackY = bodyTop - 16;
    ctx.fillStyle = '#0c1622';
    ctx.fillRect(stackX, stackY, 16, 24);
    ctx.strokeStyle = 'rgba(34,246,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(stackX, stackY, 16, 24);
    // Stack mouth glow.
    ctx.fillStyle = 'rgba(255,140,42,0.55)';
    ctx.fillRect(stackX + 2, stackY + 1, 12, 4);

    // Indicator LED strip across the body front.
    for (let i = 0; i < 6; i++) {
      const lx = bodyInset + 16 + i * 22;
      const ly = bodyBot - 10;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(114,255,159,0.95)' : 'rgba(34,246,255,0.85)';
      ctx.beginPath();
      ctx.arc(lx, ly, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rivets on the base trapezoid.
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const rivetYs = [baseTop + 4, baseBot - 8];
    for (const ry of rivetYs) {
      for (let i = 0; i < 8; i++) {
        const rx = baseInset + 6 + i * ((w - baseInset * 2 - 12) / 7);
        ctx.beginPath();
        ctx.arc(rx, ry, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    tex.refresh();
  }

  // Rotating drum on top — a banded cylinder with cyan bolt heads.
  private static ensureDrumTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_DRUM_KEY)) return;
    const dim = 56;
    const tex = scene.textures.createCanvas(SMELTER_DRUM_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;

    // Drum body.
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, dim / 2);
    grad.addColorStop(0, '#22384f');
    grad.addColorStop(0.5, '#13202e');
    grad.addColorStop(1, '#06101a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, dim / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,246,255,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bolt heads around the rim.
    ctx.fillStyle = 'rgba(34,246,255,0.9)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bx = cx + Math.cos(a) * (dim / 2 - 6);
      const by = cy + Math.sin(a) * (dim / 2 - 6);
      ctx.beginPath();
      ctx.arc(bx, by, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cross-spokes.
    ctx.strokeStyle = 'rgba(34,246,255,0.5)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (dim / 2 - 6), cy + Math.sin(a) * (dim / 2 - 6));
      ctx.stroke();
    }

    // Inner hub.
    ctx.fillStyle = '#22f6ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }

  // Funnel: bowl-shaped intake with glowing rim — placed at the worker
  // deposit point so the deposit visually "feeds" the smelter body.
  private static ensureFunnelTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_FUNNEL_KEY)) return;
    const w = 64;
    const h = 32;
    const tex = scene.textures.createCanvas(SMELTER_FUNNEL_KEY, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const cx = w / 2;
    const cy = h / 2;

    // Funnel outer ring.
    ctx.fillStyle = '#0a141e';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,246,255,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner bowl.
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    grad.addColorStop(0, 'rgba(34,246,255,0.55)');
    grad.addColorStop(0.5, 'rgba(34,246,255,0.18)');
    grad.addColorStop(1, 'rgba(34,246,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rim highlights — short tick marks around the funnel.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r1 = 26;
      const r2 = 28;
      const sx = cx + Math.cos(a) * r1;
      const sy = cy + Math.sin(a) * (r1 / 28 * 12);
      const ex = cx + Math.cos(a) * r2;
      const ey = cy + Math.sin(a) * (r2 / 28 * 12);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    tex.refresh();
  }

  // Furnace mouth — bright amber horizontal slot.
  private static ensureFurnaceTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_FURNACE_KEY)) return;
    const w = 80;
    const h = 24;
    const tex = scene.textures.createCanvas(SMELTER_FURNACE_KEY, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const cx = w / 2;
    const cy = h / 2;

    // Outer slot — slate frame.
    ctx.fillStyle = '#0a121c';
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.strokeStyle = 'rgba(255,140,42,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Glowing inner fire.
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, w * 0.45);
    grad.addColorStop(0, 'rgba(255,255,200,1)');
    grad.addColorStop(0.3, 'rgba(255,200,80,0.95)');
    grad.addColorStop(0.7, 'rgba(255,90,30,0.7)');
    grad.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(4, 4, w - 8, h - 8);

    // Horizontal heat-shimmer bars.
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 4; i++) {
      const ly = 6 + i * 4;
      ctx.fillRect(8 + i * 2, ly, w - 16 - i * 4, 1);
    }

    tex.refresh();
  }

  // Small ember/smoke particle — radial soft dot.
  private static ensureEmberTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_EMBER_KEY)) return;
    const dim = 10;
    const tex = scene.textures.createCanvas(SMELTER_EMBER_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim, dim);
    tex.refresh();
  }
}
