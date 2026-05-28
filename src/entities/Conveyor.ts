import Phaser from 'phaser';

// Conveyor — visual-only animated flowing vine segment between two world points (theme: flowing vine).
// Renders a slate trough with two cyan rails, and scrolls chevron decals
// along the vine at a fixed speed. Also exposes a `sendCargo()` helper so
// callers (the garden scene) can spawn a small chunk traveling end-to-end as
// visible feedback when a moonwell drops stardust or a pixie delivers.
//
// Implementation notes:
//   - The static vine body is baked into a RenderTexture at construction
//     time (cheap; one draw call per frame regardless of vine length).
//   - The scrolling chevrons are a small pool of sprites moved per frame.
//   - Cargo is drawn from a shared pool of sprites to avoid GC churn.

export const CONVEYOR_BELT_KEY = 'conveyor-belt';
export const CONVEYOR_CHEVRON_KEY = 'conveyor-chevron';
export const CONVEYOR_CARGO_KEY = 'conveyor-cargo';

export type ConveyorTint = 'cyan' | 'gold' | 'violet';

const TINT_COLORS: Record<ConveyorTint, number> = {
  cyan: 0x7cc9ff,
  gold: 0xffd75a,
  violet: 0xb98cff,
};

const BELT_WIDTH = 22;
const CHEVRON_SPACING = 96;
const CHEVRON_SPEED_PX_S = 46;

interface CargoSprite {
  sprite: Phaser.GameObjects.Sprite;
  t: number; // 0..1 progress along the belt
  speedPerSec: number;
  active: boolean;
  onArrive?: () => void;
}

export class Conveyor {
  private scene: Phaser.Scene;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly length: number;
  readonly angle: number;
  private tint: ConveyorTint;
  private container: Phaser.GameObjects.Container;
  private chevrons: Phaser.GameObjects.Sprite[] = [];
  private chevronOffset = 0;
  private cargoPool: CargoSprite[] = [];

  constructor(
    scene: Phaser.Scene,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    tint: ConveyorTint = 'cyan',
  ) {
    Conveyor.ensureTextures(scene);
    this.scene = scene;
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.tint = tint;
    const dx = toX - fromX;
    const dy = toY - fromY;
    this.length = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);

    // Container so we can rotate everything in one transform.
    this.container = scene.add.container((fromX + toX) / 2, (fromY + toY) / 2);
    this.container.setDepth(-3);
    this.container.setRotation(this.angle);

    // Vine body — a horizontal strip rendered at length, height BELT_WIDTH.
    // The texture is a 64×BELT_WIDTH tile (slate base + cyan rails); we stretch
    // its width via a TileSprite so the rails read continuous.
    const beltKey = CONVEYOR_BELT_KEY + '-' + tint;
    const belt = scene.add.tileSprite(0, 0, Math.max(8, this.length), BELT_WIDTH, beltKey);
    belt.setOrigin(0.5, 0.5);
    belt.setAlpha(0.35); // faint soft trail, not a bright wire
    this.container.add(belt);

    // Chevron decals — scrolled per frame.
    const chevronKey = CONVEYOR_CHEVRON_KEY + '-' + tint;
    const chevronCount = Math.max(1, Math.floor(this.length / CHEVRON_SPACING));
    for (let i = 0; i < chevronCount; i++) {
      const c = scene.add.sprite(0, 0, chevronKey);
      c.setOrigin(0.5, 0.5);
      c.setScale(0.55);
      c.setAlpha(0.8);
      this.container.add(c);
      this.chevrons.push(c);
    }
    this.layoutChevrons();
  }

  update(dt: number): void {
    // Scroll chevrons.
    this.chevronOffset += CHEVRON_SPEED_PX_S * dt;
    if (this.chevronOffset >= CHEVRON_SPACING) this.chevronOffset -= CHEVRON_SPACING;
    this.layoutChevrons();

    // Advance any in-flight cargo.
    for (const c of this.cargoPool) {
      if (!c.active) continue;
      c.t += c.speedPerSec * dt;
      if (c.t >= 1) {
        c.t = 1;
        const cb = c.onArrive;
        c.active = false;
        c.sprite.setVisible(false);
        if (cb) cb();
        continue;
      }
      const localX = -this.length / 2 + this.length * c.t;
      const worldX = (this.fromX + this.toX) / 2 + Math.cos(this.angle) * localX;
      const worldY = (this.fromY + this.toY) / 2 + Math.sin(this.angle) * localX;
      c.sprite.setPosition(worldX, worldY);
    }
  }

  // Spawn a small cargo chunk traveling from `from` end to `to` end of the
  // vine over `durationSec`. Optional onArrive fires when it reaches the end.
  sendCargo(durationSec: number, onArrive?: () => void): void {
    let slot = this.cargoPool.find(c => !c.active);
    if (!slot) {
      const sprite = this.scene.add.sprite(this.fromX, this.fromY, CONVEYOR_CARGO_KEY + '-' + this.tint);
      sprite.setDepth(-2);
      slot = { sprite, t: 0, speedPerSec: 1, active: false };
      this.cargoPool.push(slot);
    }
    slot.t = 0;
    slot.speedPerSec = 1 / Math.max(0.1, durationSec);
    slot.onArrive = onArrive;
    slot.active = true;
    slot.sprite.setVisible(true);
    slot.sprite.setPosition(this.fromX, this.fromY);
  }

  destroy(): void {
    for (const c of this.cargoPool) c.sprite.destroy();
    this.cargoPool = [];
    this.container.destroy();
    this.chevrons = [];
  }

  private layoutChevrons(): void {
    const startX = -this.length / 2;
    for (let i = 0; i < this.chevrons.length; i++) {
      const x = startX + i * CHEVRON_SPACING + this.chevronOffset;
      this.chevrons[i].setPosition(x, 0);
      this.chevrons[i].setVisible(x >= startX && x <= this.length / 2);
    }
  }

  // ---- static texture builders ----

  static ensureTextures(scene: Phaser.Scene): void {
    for (const tint of Object.keys(TINT_COLORS) as ConveyorTint[]) {
      const color = TINT_COLORS[tint];
      Conveyor.ensureBeltTexture(scene, tint, color);
      Conveyor.ensureChevronTexture(scene, tint, color);
      Conveyor.ensureCargoTexture(scene, tint, color);
    }
  }

  private static ensureBeltTexture(scene: Phaser.Scene, tint: ConveyorTint, color: number): void {
    const key = CONVEYOR_BELT_KEY + '-' + tint;
    if (scene.textures.exists(key)) return;
    const w = 64;
    const h = BELT_WIDTH;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // A soft faint trail of light — barely-there so the garden reads calm.
    ctx.clearRect(0, 0, w, h);
    const band = ctx.createLinearGradient(0, 0, 0, h);
    band.addColorStop(0.0, `rgba(${r},${g},${b},0)`);
    band.addColorStop(0.5, `rgba(${r},${g},${b},0.42)`);
    band.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.32, w, h * 0.36);

    tex.refresh();
  }

  private static ensureChevronTexture(scene: Phaser.Scene, tint: ConveyorTint, color: number): void {
    const key = CONVEYOR_CHEVRON_KEY + '-' + tint;
    if (scene.textures.exists(key)) return;
    const w = 16;
    const h = 16;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.context;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const cx = w / 2;
    const cy = h / 2;

    // Drifting stardust mote: soft glow + a tiny four-point sparkle. Reads as
    // motes of stardust flowing along the vine rather than a conveyor arrow.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.4, `rgba(${r},${g},${b},0.7)`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx + 5, cy);
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
    tex.refresh();
  }

  private static ensureCargoTexture(scene: Phaser.Scene, tint: ConveyorTint, color: number): void {
    const key = CONVEYOR_CARGO_KEY + '-' + tint;
    if (scene.textures.exists(key)) return;
    const dim = 16;
    const tex = scene.textures.createCanvas(key, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Halo.
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    halo.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
    halo.addColorStop(0.5, `rgba(${r},${g},${b},0.4)`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);

    // Moonstone chunk.
    const body = ctx.createLinearGradient(cx - 4, cy - 4, cx + 4, cy + 4);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.5, `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)},1)`);
    body.addColorStop(1, `rgba(${r},${g},${b},1)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx - 4, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1;
    ctx.stroke();
    tex.refresh();
  }
}
