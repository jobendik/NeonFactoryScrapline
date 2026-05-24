import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { applyGlow } from '../systems/NeonFX';

export const DRONE_TEXTURE_KEY = 'drone-body';

// Factory drone per blueprint §8.5 ("Drone Lv. 1 first drone takes off from bay").
// Orbits the player and tugs nearby pickups toward the player by extending the
// effective magnet radius around its own position. Drone Lv. 3 adds a trail
// (drawn as a fading line behind the drone). Raid drones - which actually fire
// at enemies - arrive in a later milestone.

export interface DroneOpts {
  orbitRadius: number;
  orbitSpeed: number;     // radians/sec
  baseAngle: number;
  pickupRadius: number;
  withTrail: boolean;
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export class Drone {
  private sprite: Phaser.GameObjects.Sprite;
  private opts: DroneOpts;
  private angle = 0;
  private trail: TrailPoint[] = [];
  private trailGfx: Phaser.GameObjects.Graphics | null = null;
  private readonly maxTrailAge = 0.45;

  constructor(scene: Phaser.Scene, opts: DroneOpts) {
    Drone.ensureTexture(scene);
    this.opts = opts;
    this.angle = opts.baseAngle;
    this.sprite = scene.add.sprite(0, 0, DRONE_TEXTURE_KEY);
    this.sprite.setDepth(3);
    applyGlow(this.sprite, Balance.colors.player, 4, 0);
    if (opts.withTrail) {
      this.trailGfx = scene.add.graphics();
      this.trailGfx.setDepth(2);
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  getPickupRadius(): number {
    return this.opts.pickupRadius;
  }

  update(dt: number, playerX: number, playerY: number): void {
    this.angle += this.opts.orbitSpeed * dt;
    const x = playerX + Math.cos(this.angle) * this.opts.orbitRadius;
    const y = playerY + Math.sin(this.angle) * this.opts.orbitRadius;
    this.sprite.setPosition(x, y);
    this.sprite.setRotation(this.angle + Math.PI / 2);

    if (this.trailGfx) {
      this.trail.push({ x, y, age: 0 });
      for (const p of this.trail) p.age += dt;
      while (this.trail.length > 0 && this.trail[0].age >= this.maxTrailAge) this.trail.shift();
      this.trailGfx.clear();
      for (let i = 1; i < this.trail.length; i++) {
        const prev = this.trail[i - 1];
        const cur = this.trail[i];
        const alpha = 1 - cur.age / this.maxTrailAge;
        this.trailGfx.lineStyle(2, Balance.colors.player, alpha * 0.7);
        this.trailGfx.lineBetween(prev.x, prev.y, cur.x, cur.y);
      }
    }
  }

  destroy(): void {
    this.sprite.destroy();
    if (this.trailGfx) this.trailGfx.destroy();
  }

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(DRONE_TEXTURE_KEY)) return;
    const dim = 28;
    const tex = scene.textures.createCanvas(DRONE_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    // Cyan halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    halo.addColorStop(0, 'rgba(34, 246, 255, 0.55)');
    halo.addColorStop(0.5, 'rgba(34, 246, 255, 0.25)');
    halo.addColorStop(1, 'rgba(34, 246, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);
    // Diamond body with gradient
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 7, cy + 1);
    ctx.lineTo(cx, cy + 7);
    ctx.lineTo(cx - 7, cy + 1);
    ctx.closePath();
    const body = ctx.createLinearGradient(cx, cy - 7, cx, cy + 7);
    body.addColorStop(0, '#e6ffff');
    body.addColorStop(0.4, '#22f6ff');
    body.addColorStop(1, '#0a4855');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Bright center pip
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
}
