import Phaser from 'phaser';
import { QualityManager } from './QualityManager';
import type { ZoneVisualTheme } from '../config/ScraplineDefs';

// Centralized procedural-asset helpers. Generates radial-gradient glow textures,
// tiled neon backgrounds, and applies WebGL preFX glow to sprites/graphics so
// every drawable in the game shares the same neon aesthetic.
//
// All textures are cached on the scene's TextureManager — re-calls with the
// same key are no-ops, mirroring the entity ensureTexture pattern.

export const GLOW_DOT_KEY = 'fx-glow-dot';
export const SOFT_HALO_KEY = 'fx-soft-halo';
export const SPARK_KEY = 'fx-spark';
export const RAID_BG_KEY = 'fx-bg-raid';
export const FACTORY_BG_KEY = 'fx-bg-factory';
export const STARFIELD_FAR_KEY = 'fx-starfield-far';
export const STARFIELD_NEAR_KEY = 'fx-starfield-near';
export const VIGNETTE_KEY = 'fx-vignette';
export const BULLET_GLOW_KEY = 'fx-bullet-glow';
export const TRACER_DOT_KEY = 'fx-tracer-dot';

// Helper: pull r/g/b channels out of a 0xRRGGBB integer.
function rgb(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function rgba(color: number, a: number): string {
  const [r, g, b] = rgb(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Creates a canvas texture and gives the caller the 2D context to draw with.
// The texture is registered with the scene's TextureManager under `key` and
// refreshed once the draw closure returns.
function withCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.context, w, h);
  tex.refresh();
}

// Radial gradient glow dot. Used for additive particle emitters, bullet
// halos, and as the base of larger neon effects.
export function ensureGlowDot(scene: Phaser.Scene, key: string, color: number, dim: number, falloff = 1.2): void {
  withCanvas(scene, key, dim, dim, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0.0, rgba(0xffffff, 1.0));
    grad.addColorStop(0.18, rgba(color, 1.0));
    grad.addColorStop(0.55, rgba(color, 0.45));
    grad.addColorStop(1.0, rgba(color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    void falloff;
  });
}

// Soft halo without a bright core — useful as a backdrop glow.
export function ensureSoftHalo(scene: Phaser.Scene, key: string, color: number, dim: number): void {
  withCanvas(scene, key, dim, dim, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0.0, rgba(color, 0.55));
    grad.addColorStop(0.4, rgba(color, 0.32));
    grad.addColorStop(1.0, rgba(color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

// Tiny "spark" used for particle emitters — bright white core, thin cyan halo.
// 8x8 keeps the GPU fill cost low at 200+ particles.
export function ensureSpark(scene: Phaser.Scene, key: string): void {
  withCanvas(scene, key, 8, 8, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

// Generates a seamless 512×512 background tile for the raid arena: deep navy
// gradient with a scanline shimmer + bright neon grid + cluster of distant
// stars/dust. Tiled across the world by RaidScene so the parallax layers feel
// dense without the cost of drawing thousands of primitives at runtime.
export function ensureRaidBackground(scene: Phaser.Scene, key: string): void {
  ensureRaidBackgroundFor(scene, key, {
    gradientFrom: '#04111a',
    gradientMid: '#070718',
    gradientTo: '#11041c',
    bloomColor: 'rgba(34, 246, 255, 0.10)',
    gridColor: 'rgba(34, 246, 255, 0.30)',
    accentColor: 0x22f6ff,
    dustColor: 0xa76cff,
  });
}

// Per-zone variant. Each raid zone caches its own tile under
// raidBgKeyForZone(zoneId) so switching zones in the factory swaps the
// arena's whole palette without any runtime tint cost.
export function ensureRaidBackgroundFor(
  scene: Phaser.Scene,
  key: string,
  theme: ZoneVisualTheme,
): void {
  const size = 512;
  withCanvas(scene, key, size, size, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, theme.gradientFrom);
    bg.addColorStop(0.55, theme.gradientMid);
    bg.addColorStop(1, theme.gradientTo);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const bloom = ctx.createRadialGradient(w * 0.25, h * 0.3, 0, w * 0.25, h * 0.3, w * 0.6);
    bloom.addColorStop(0, theme.bloomColor);
    bloom.addColorStop(1, fadeRgba(theme.bloomColor));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    drawStarField(ctx, w, h, 0xff42, 110, 0.6);

    // Neon grid — dim base + brighter accent line every 8 cells.
    drawNeonGrid(ctx, w, h, 64, dimRgba(theme.gridColor, 0.33), 1);
    drawNeonGrid(ctx, w, h, 64, theme.gridColor, 0.5, 8);
  });
}

// Texture-cache key for a zone's procedural arena tile. RaidScene ensures
// + uses this key in place of RAID_BG_KEY when a zone is active.
export function raidBgKeyForZone(zoneId: string): string {
  return `fx-bg-raid-${zoneId}`;
}

// Helpers for tinting the theme's rgba bloom string. The tile's bloom needs
// to fade fully transparent at the radial edge; the theme stores the rgba
// at peak intensity, so we derive a 0-alpha variant for the edge stop.
function fadeRgba(input: string): string {
  return input.replace(/,\s*[\d.]+\s*\)/, ', 0)');
}

// Lower the alpha of an rgba string by a fixed multiplier so the dim base
// grid line can be derived from the same theme color.
function dimRgba(input: string, mult: number): string {
  return input.replace(/,\s*([\d.]+)\s*\)/, (_m, a) => `, ${Math.max(0, Number(a) * mult).toFixed(3)})`);
}

// Factory floor tile — warmer, industrial. Diagonal cyan stripes + rivets.
export function ensureFactoryBackground(scene: Phaser.Scene, key: string): void {
  const size = 512;
  withCanvas(scene, key, size, size, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#06121a');
    bg.addColorStop(1, '#020a12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Diagonal hazard stripes, dim.
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#22f6ff';
    const stripeW = 28;
    ctx.beginPath();
    for (let x = -h; x < w + h; x += stripeW * 2) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.lineTo(x + h + stripeW, h);
      ctx.lineTo(x + stripeW, 0);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();

    // Grid + rivets.
    drawNeonGrid(ctx, w, h, 64, 'rgba(34, 246, 255, 0.16)', 1);
    drawNeonGrid(ctx, w, h, 64, 'rgba(34, 246, 255, 0.4)', 0.5, 8);

    // Rivets at grid intersections.
    ctx.fillStyle = 'rgba(34, 246, 255, 0.65)';
    for (let y = 0; y <= h; y += 64) {
      for (let x = 0; x <= w; x += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// Sparse parallax starfield tile. The bright dots are surrounded by faint
// halos so when tiled with a low scrollFactor they read as twinkling stars.
export function ensureStarfield(scene: Phaser.Scene, key: string, seed: number, density: number): void {
  const size = 512;
  withCanvas(scene, key, size, size, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawStarField(ctx, w, h, seed, density, 1.0);
  });
}

// Radial vignette — black at the edges, transparent in the center. Camera-fixed
// overlay used by RaidScene to focus attention on the player at high greed.
export function ensureVignette(scene: Phaser.Scene, key: string): void {
  const w = 1280;
  const h = 720;
  withCanvas(scene, key, w, h, (ctx, ww, hh) => {
    const grad = ctx.createRadialGradient(ww / 2, hh / 2, hh * 0.25, ww / 2, hh / 2, hh * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ww, hh);
  });
}

// Tracer dot — small bright bullet head with a halo. Used as the projectile
// sprite end-cap so player tracers feel like laser bolts rather than lines.
export function ensureTracerDot(scene: Phaser.Scene): void {
  ensureGlowDot(scene, TRACER_DOT_KEY, 0x22f6ff, 24);
}

// Bullet glow — used for enemy projectiles in place of the flat fill.
export function ensureBulletGlow(scene: Phaser.Scene, color: number): void {
  ensureGlowDot(scene, BULLET_GLOW_KEY, color, 24);
}

// Applies a WebGL glow to a GameObject if quality permits. Prefers preFX
// (sprites, text) but falls back to postFX so Graphics + Containers also get
// the bloom. Safe no-op on Canvas renderer or when the object type doesn't
// support either FX pipeline.
export function applyGlow(
  go: Phaser.GameObjects.GameObject,
  color: number,
  outer = 4,
  inner = 0,
  quality = 0.1,
): void {
  if (!QualityManager.glowEnabled()) return;
  type FXLike = { addGlow?: (c: number, o: number, i: number, k: boolean, q: number) => unknown };
  const any = go as unknown as { preFX?: FXLike | null; postFX?: FXLike | null };
  const fx = any.preFX ?? any.postFX;
  if (!fx || typeof fx.addGlow !== 'function') return;
  try {
    fx.addGlow(color, outer, inner, false, quality);
  } catch {
    // Some scene contexts (no WebGL, headless tests) throw on addGlow — swallow.
  }
}

// ----- private helpers -----

// Deterministic PRNG (mulberry32) so star field placement is identical across
// runs and seam tiles match up.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function drawStarField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  count: number,
  intensity: number,
): void {
  const rand = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const size = 0.6 + rand() * 1.4;
    const a = (0.35 + rand() * 0.55) * intensity;
    // Hue lean: most stars cyan-white; a sprinkle warm.
    const warm = rand() < 0.12;
    const color = warm ? `rgba(255, 215, 90, ${a})` : `rgba(180, 240, 255, ${a})`;
    const halo = warm ? 'rgba(255, 215, 90,' : 'rgba(140, 220, 255,';
    // Halo.
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, `${halo}${a * 0.3})`);
    grad.addColorStop(1, `${halo}0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size * 4, 0, Math.PI * 2);
    ctx.fill();
    // Core.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNeonGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step: number,
  stroke: string,
  thickness: number,
  highlightEvery = 0,
): void {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
  if (highlightEvery > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 246, 255, 0.18)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const bigStep = step * highlightEvery;
    for (let x = 0; x <= w; x += bigStep) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += bigStep) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// One-shot initializer called by BootScene / RaidScene / FactoryScene to make
// sure every shared FX texture exists before any GameObject tries to use it.
// Cheap and idempotent — each helper short-circuits if the key already exists.
export function ensureCommonFX(scene: Phaser.Scene): void {
  ensureGlowDot(scene, GLOW_DOT_KEY, 0x22f6ff, 64);
  ensureSoftHalo(scene, SOFT_HALO_KEY, 0x22f6ff, 96);
  ensureSpark(scene, SPARK_KEY);
  ensureTracerDot(scene);
  ensureBulletGlow(scene, 0xa76cff);
  ensureVignette(scene, VIGNETTE_KEY);
  ensureRaidBackground(scene, RAID_BG_KEY);
  ensureFactoryBackground(scene, FACTORY_BG_KEY);
  ensureStarfield(scene, STARFIELD_FAR_KEY, 0x9173afe, 80);
  ensureStarfield(scene, STARFIELD_NEAR_KEY, 0x1b4adef, 35);
}
