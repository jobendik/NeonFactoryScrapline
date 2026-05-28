import Phaser from 'phaser';
import { applyGlow } from '../systems/NeonFX';

// Smelter — central potion cauldron where pixies deliver stardust (theme: potion cauldron). Visual only
// (no gameplay state); the pixie deposit logic still uses the configured
// Balance.factory.workerDepositPoint. The cauldron occupies that point.
//
// Components:
//   - Stationary chassis (a wide trapezoid base + body)
//   - Rotating drum on top (driven sprite)
//   - Glowing cauldron mouth on the front (pulses)
//   - Continuous smoke plume from a stack
//   - Bright deposit funnel (the bowl-shaped intake the pixies fly up to)
//
// Call .pulseDeposit() when a pixie delivers — the cauldron mouth flashes
// brighter and an extra burst of embers shoots up the stack.

export const SMELTER_BASE_KEY = 'smelter-base';
export const SMELTER_DRUM_KEY = 'smelter-drum';
export const SMELTER_FUNNEL_KEY = 'smelter-funnel';
export const SMELTER_FURNACE_KEY = 'smelter-furnace';
export const SMELTER_EMBER_KEY = 'smelter-ember';

const COLOR_CYAN = 0x7cc9ff;
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
    // walk across the cauldron (it's a large 220×140 sprite — full occlusion
    // would feel bad). Drum + funnel + cauldron mouth go on top so the moving
    // elements + intake glow read clearly.
    //
    // Base chassis — large slate trapezoid + body. Sits a bit south so the
    // intake funnel lines up with the pixie deposit point.
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

    // Cauldron mouth glow — bright amber slot on the body's front.
    this.furnace = scene.add.sprite(x, y - 6, SMELTER_FURNACE_KEY);
    this.furnace.setDepth(0);
    applyGlow(this.furnace, COLOR_AMBER, 8, 1, 0.18);

    // Smoke plume rising off the cauldron stack. Stack lives at the
    // base sprite's top-right; mouth is roughly at world (x + 62, y - 58).
    const stackX = x + 62;
    const stackY = y - 58;
    this.smokeEmitter = scene.add.particles(stackX, stackY, SMELTER_EMBER_KEY, {
      speed: { min: 12, max: 32 },
      angle: { min: 255, max: 285 },
      lifespan: 2200,
      frequency: 90,
      scale: { start: 0.55, end: 1.2 },
      alpha: { start: 0.4, end: 0 },
      tint: 0xb98cff,
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
    // like ambient steam over the stardust intake.
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

    // Cauldron breathing pulse.
    const breath = 1 + Math.sin(this.pulseTimer * 2.6) * 0.06 + this.pulseFlash;
    this.furnace.setScale(breath);
    this.funnel.setScale(1 + this.pulseFlash * 0.5);

    if (this.pulseFlash > 0) {
      this.pulseFlash = Math.max(0, this.pulseFlash - dt * 1.6);
    }
  }

  // Called by the garden scene when a pixie delivers — visible kick to the
  // cauldron + extra ember burst from the stack.
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

  // Base: a rounded potion cauldron — belly, glowing rim, side handles, brew.
  private static ensureBaseTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_BASE_KEY)) return;
    const w = 220;
    const h = 140;
    const tex = scene.textures.createCanvas(SMELTER_BASE_KEY, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const cx = w / 2;

    // Soft lavender back-glow behind the cauldron.
    const halo = ctx.createRadialGradient(cx, h * 0.55, 8, cx, h * 0.55, w * 0.62);
    halo.addColorStop(0, 'rgba(185,140,255,0.22)');
    halo.addColorStop(1, 'rgba(185,140,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    const rimY = 52;

    // Two side handles (drawn behind the belly).
    ctx.strokeStyle = 'rgba(124,201,255,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(46, 82, 16, Math.PI * 0.55, Math.PI * 1.55, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 46, 82, 16, -Math.PI * 0.55, Math.PI * 0.55, false);
    ctx.stroke();

    // Cauldron belly — bright friendly purple pot, wider in the middle.
    const body = ctx.createLinearGradient(0, rimY, 0, 128);
    body.addColorStop(0, '#8f76d8');
    body.addColorStop(0.5, '#6a52b8');
    body.addColorStop(1, '#4c3a90');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(48, rimY);
    ctx.bezierCurveTo(18, rimY + 24, 22, 110, 64, 126);
    ctx.lineTo(w - 64, 126);
    ctx.bezierCurveTo(w - 22, 110, w - 18, rimY + 24, w - 48, rimY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,170,255,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Glossy highlight on the upper-left belly for a cute ceramic sheen.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - 34, rimY + 34, 16, 26, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Little stone base the cauldron rests on.
    ctx.fillStyle = '#1c1338';
    ctx.beginPath();
    ctx.ellipse(cx, 130, 56, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,201,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cauldron rim — dark mouth + glowing lip.
    ctx.fillStyle = '#160e2e';
    ctx.beginPath();
    ctx.ellipse(cx, rimY, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,201,255,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Glowing brew surface inside the rim (teal-green → lavender).
    const brew = ctx.createRadialGradient(cx, rimY - 1, 0, cx, rimY - 1, 64);
    brew.addColorStop(0, 'rgba(150,245,190,0.85)');
    brew.addColorStop(0.45, 'rgba(120,230,200,0.45)');
    brew.addColorStop(0.8, 'rgba(185,140,255,0.22)');
    brew.addColorStop(1, 'rgba(185,140,255,0)');
    ctx.fillStyle = brew;
    ctx.beginPath();
    ctx.ellipse(cx, rimY - 1, 62, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // A few bright bubbles on the brew.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const bubbles: Array<[number, number, number]> = [
      [cx - 28, rimY - 2, 2.2], [cx + 10, rimY + 1, 3], [cx + 34, rimY - 3, 1.8], [cx - 6, rimY - 4, 1.6],
    ];
    for (const [bx, by, br] of bubbles) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    tex.refresh();
  }

  // "Drum" sprite, repurposed: a slowly rotating magic swirl rising off the
  // brew (theme: stirring enchantment). Soft glowing spiral on transparent.
  private static ensureDrumTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_DRUM_KEY)) return;
    const dim = 56;
    const tex = scene.textures.createCanvas(SMELTER_DRUM_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;

    // Soft glow core.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, dim / 2);
    glow.addColorStop(0, 'rgba(150,245,190,0.5)');
    glow.addColorStop(0.5, 'rgba(124,201,255,0.18)');
    glow.addColorStop(1, 'rgba(124,201,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, dim, dim);

    // Two-arm swirl of sparkles.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05) {
        const a = arm * Math.PI + t * Math.PI * 1.6;
        const rr = 4 + t * (dim / 2 - 8);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Bright centre.
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }

  // Funnel: bowl-shaped intake with glowing rim — placed at the pixie
  // deposit point so the deposit visually "feeds" the cauldron body.
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
    ctx.strokeStyle = 'rgba(124,201,255,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner bowl.
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    grad.addColorStop(0, 'rgba(124,201,255,0.55)');
    grad.addColorStop(0.5, 'rgba(124,201,255,0.18)');
    grad.addColorStop(1, 'rgba(124,201,255,0)');
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

  // Warm magical glow of the brew — a soft radial light over the cauldron
  // mouth (no slot, no frame). Reads as the enchantment shining out of the pot.
  private static ensureFurnaceTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SMELTER_FURNACE_KEY)) return;
    const w = 96;
    const h = 40;
    const tex = scene.textures.createCanvas(SMELTER_FURNACE_KEY, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const cx = w / 2;
    const cy = h / 2;

    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, w * 0.5);
    grad.addColorStop(0, 'rgba(255,250,210,0.95)');
    grad.addColorStop(0.3, 'rgba(255,210,120,0.7)');
    grad.addColorStop(0.65, 'rgba(255,150,90,0.32)');
    grad.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.42); // flatten into the brew opening
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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
