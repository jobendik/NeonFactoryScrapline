import Phaser from 'phaser';
import { QualityManager } from './QualityManager';
import type { ZoneVisualTheme } from '../config/ScraplineDefs';

// Centralized procedural-asset helpers. Generates radial-gradient glow textures,
// tiled night-garden backgrounds, and applies WebGL preFX glow to sprites/graphics so
// every drawable in the game shares the same moonlit magical aesthetic.
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

// Radial gradient glow dot. Used for additive particle emitters, spark-bolt
// halos, and as the base of larger magical glow effects.
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

// Tiny "spark" used for particle emitters — bright white core, thin moonlit halo.
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

// Generates a seamless 512×512 background tile for the night-flight arena: deep navy
// gradient with a moonlit shimmer + soft glowing grid + cluster of distant
// stars/stardust. Tiled across the world by RaidScene so the parallax layers feel
// dense without the cost of drawing thousands of primitives at runtime.
export function ensureRaidBackground(scene: Phaser.Scene, key: string): void {
  ensureRaidBackgroundFor(scene, key, {
    gradientFrom: '#04111a',
    gradientMid: '#070718',
    gradientTo: '#11041c',
    bloomColor: 'rgba(124, 201, 255, 0.10)',
    gridColor: 'rgba(124, 201, 255, 0.30)',
    accentColor: 0x7cc9ff,
    dustColor: 0xb98cff,
  });
}

// Per-zone variant. Each night-flight zone caches its own tile under
// raidBgKeyForZone(zoneId) so switching zones in the garden swaps the
// arena's whole palette without any runtime tint cost.
export function ensureRaidBackgroundFor(
  scene: Phaser.Scene,
  key: string,
  theme: ZoneVisualTheme,
): void {
  const size = 512;
  withCanvas(scene, key, size, size, (ctx, w, h) => {
    // FLAT base (theme.gradientMid) so the tile is perfectly seamless when
    // repeated. The dreamy depth comes from a soft camera-fixed gradient + the
    // moon that RaidScene layers on top — not from this tile.
    ctx.fillStyle = theme.gradientMid;
    ctx.fillRect(0, 0, w, h);

    // Soft drifting cloud wisps — low-alpha lighter bands for a dreamy sky.
    const rand = mulberry32(0x71c3a9);
    for (let i = 0; i < 5; i++) {
      const cx = rand() * w;
      const cy = rand() * h;
      const rx = 70 + rand() * 120;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.6, 0.7);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dense twinkling stars — the sky's main texture.
    drawStarField(ctx, w, h, 0xff42, 150, 0.85);
  });
}

export const MOON_KEY = 'fx-moon';

// A big friendly moon with a soft glow halo + a couple of gentle craters.
// Placed once by scenes as a low-parallax sky element (not tiled).
export function ensureMoon(scene: Phaser.Scene): void {
  const dim = 320;
  withCanvas(scene, MOON_KEY, dim, dim, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    // Soft outer glow.
    const halo = ctx.createRadialGradient(cx, cy, 40, cx, cy, dim / 2);
    halo.addColorStop(0, 'rgba(255, 248, 210, 0.5)');
    halo.addColorStop(0.5, 'rgba(255, 244, 190, 0.18)');
    halo.addColorStop(1, 'rgba(255, 244, 190, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    // Moon disc.
    const disc = ctx.createRadialGradient(cx - 22, cy - 24, 10, cx, cy, 96);
    disc.addColorStop(0, '#fffdf2');
    disc.addColorStop(0.7, '#fdeeb8');
    disc.addColorStop(1, '#f4d98a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, 0, Math.PI * 2);
    ctx.fill();
    // Gentle craters.
    ctx.fillStyle = 'rgba(226, 200, 140, 0.45)';
    for (const [dx, dy, dr] of [[-30, 18, 16], [26, -14, 12], [10, 40, 9], [40, 30, 7]] as const) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Texture-cache key for a zone's procedural arena tile. RaidScene ensures
// + uses this key in place of RAID_BG_KEY when a zone is active.
export function raidBgKeyForZone(zoneId: string): string {
  return `fx-bg-raid-${zoneId}`;
}

// Cozy moonlit-lawn floor tile — a bright, soft enchanted-garden grass.
// Warm, saturated greens (kids-friendly), gentle lighter "moonlight pool"
// dapples, soft grass tufts, and a sprinkle of tiny flowers. Tileable because
// every feature is placed by a seeded PRNG and kept soft/small.
export function ensureFactoryBackground(scene: Phaser.Scene, key: string): void {
  const size = 512;
  withCanvas(scene, key, size, size, (ctx, w, h) => {
    // Flat, cheerful grass base. IMPORTANT: no vertical gradient — a gradient
    // would seam every tile-height when this 512² tile repeats. The lawn's
    // lighting variation comes from the soft dapples below instead.
    ctx.fillStyle = '#46b583';
    ctx.fillRect(0, 0, w, h);

    const rand = mulberry32(0x5747a1);

    // Soft lighter "moonlight pool" dapples scattered across the lawn.
    for (let i = 0; i < 7; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 60 + rand() * 110;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(190, 255, 215, 0.16)');
      g.addColorStop(1, 'rgba(190, 255, 215, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft grass tufts — short paired blades in a slightly darker green.
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const tall = 5 + rand() * 5;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(46, 150, 104, 0.5)' : 'rgba(120, 220, 160, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 2, y - tall * 0.7, x - 3, y - tall);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y - tall * 0.7, x + 3, y - tall);
      ctx.stroke();
    }

    // Tiny flowers sprinkled about — cheerful little dots of colour.
    const petalCols = ['#ff9ec9', '#ffe066', '#b98cff', '#ffffff', '#7fd4ff'];
    for (let i = 0; i < 34; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const col = petalCols[Math.floor(rand() * petalCols.length)];
      const pr = 2.2 + rand() * 1.6;
      ctx.fillStyle = col;
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * pr, y + Math.sin(a) * pr, pr * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff6c2';
      ctx.beginPath();
      ctx.arc(x, y, pr * 0.6, 0, Math.PI * 2);
      ctx.fill();
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
// overlay used by RaidScene to focus attention on the player at high glimmer.
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

// Tracer dot — small bright spark-bolt head with a halo. Used as the projectile
// sprite end-cap so player tracers feel like spell bolts rather than lines.
export function ensureTracerDot(scene: Phaser.Scene): void {
  ensureGlowDot(scene, TRACER_DOT_KEY, 0x7cc9ff, 24);
}

// Spark-bolt glow — used for enemy projectiles in place of the flat fill.
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

// One-shot initializer called by BootScene / RaidScene / FactoryScene to make
// sure every shared FX texture exists before any GameObject tries to use it.
// Cheap and idempotent — each helper short-circuits if the key already exists.
export function ensureCommonFX(scene: Phaser.Scene): void {
  ensureGlowDot(scene, GLOW_DOT_KEY, 0x7cc9ff, 64);
  ensureSoftHalo(scene, SOFT_HALO_KEY, 0x7cc9ff, 96);
  ensureSpark(scene, SPARK_KEY);
  ensureTracerDot(scene);
  ensureBulletGlow(scene, 0xb98cff);
  ensureVignette(scene, VIGNETTE_KEY);
  ensureRaidBackground(scene, RAID_BG_KEY);
  ensureFactoryBackground(scene, FACTORY_BG_KEY);
  ensureStarfield(scene, STARFIELD_FAR_KEY, 0x9173afe, 80);
  ensureStarfield(scene, STARFIELD_NEAR_KEY, 0x1b4adef, 35);
  ensureMoon(scene);
}
