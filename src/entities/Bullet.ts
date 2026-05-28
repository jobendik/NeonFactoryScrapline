import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { applyGlow } from '../systems/NeonFX';

export const ENEMY_BULLET_TEXTURE_KEY = 'enemy-bullet';

// Spark bolt entity used for shooter spells (and future ability spark bolts).
// Physics sprite so it travels through the world and the player can dodge it,
// matching the architecture rule "Shooter projectiles are physics sprites (travel, dodgeable)."

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  private body_!: Phaser.Physics.Arcade.Body;
  private age = 0;
  private lifespan = Balance.shooter.bulletLifespanSec;
  private glowApplied = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Bullet.ensureTexture(scene);
    super(scene, x, y, ENEMY_BULLET_TEXTURE_KEY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body_ = this.body as Phaser.Physics.Arcade.Body;
    // 28px texture → center is (14, 14). Body radius 5, offset (9, 9) puts
    // the hit circle on the spark bolt's bright core.
    this.body_.setCircle(5, 9, 9);
    this.setActive(false).setVisible(false);
    this.body_.enable = false;
  }

  fire(fromX: number, fromY: number, dirX: number, dirY: number, speed: number, damage: number): void {
    this.damage = damage;
    this.age = 0;
    this.setPosition(fromX, fromY);
    this.body_.enable = true;
    this.body_.setVelocity(dirX * speed, dirY * speed);
    this.setActive(true).setVisible(true);
    this.setRotation(Math.atan2(dirY, dirX));
    if (!this.glowApplied) {
      applyGlow(this, Balance.colors.enemyShooter, 6, 0);
      this.glowApplied = true;
    }
  }

  kill(): void {
    this.body_.setVelocity(0, 0);
    this.body_.enable = false;
    this.setActive(false).setVisible(false);
  }

  tick(dt: number): void {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.lifespan) this.kill();
  }

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(ENEMY_BULLET_TEXTURE_KEY)) return;
    const dim = 28;
    const tex = scene.textures.createCanvas(ENEMY_BULLET_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const cx = dim / 2;
    const cy = dim / 2;
    const color = Balance.colors.enemyShooter;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    // Outer halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
    halo.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.45)`);
    halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, dim, dim);
    // Bright core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 5);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
    core.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
}
