import Phaser from 'phaser';
import { EnemyDefs, type EnemyKind } from '../config/EnemyDefs';
import { Balance } from '../config/Balance';
import { QualityManager } from './QualityManager';

export const PARTICLE_TEXTURE_KEY = 'particle-dot';

// Centralizes Phaser.ParticleEmitter instances per effect. Emitters are persistent and idle
// (emitting:false); call .explode() to fire a one-shot burst at a given position.
// Per architecture rules, particles never own physics bodies.
//
// M21: explode counts pass through QualityManager.particleQuantity() so the
// Low/Medium/High preset caps act as a live throttle without changing
// callsites.

export class ParticleEffects {
  private deathEmitters: Map<EnemyKind, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();

  constructor(scene: Phaser.Scene) {
    ParticleEffects.ensureTexture(scene);
    for (const kind of Object.keys(EnemyDefs) as EnemyKind[]) {
      const def = EnemyDefs[kind];
      const emitter = scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
        speed: { min: 80, max: 240 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 420,
        tint: def.color,
        emitting: false,
      });
      emitter.setDepth(40);
      this.deathEmitters.set(kind, emitter);
    }
  }

  enemyDeath(kind: EnemyKind, x: number, y: number, quantity = Balance.particles.enemyDeathCount): void {
    const e = this.deathEmitters.get(kind);
    if (!e) return;
    e.explode(QualityManager.particleQuantity(quantity), x, y);
  }

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(PARTICLE_TEXTURE_KEY)) return;
    // Soft glow dot so emitters look like neon embers instead of hard pixels.
    const dim = 12;
    const tex = scene.textures.createCanvas(PARTICLE_TEXTURE_KEY, dim, dim);
    if (!tex) return;
    const ctx = tex.context;
    const c = dim / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim, dim);
    tex.refresh();
  }

  destroy(): void {
    for (const e of this.deathEmitters.values()) e.destroy();
    this.deathEmitters.clear();
  }
}
