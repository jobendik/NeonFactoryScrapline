// Enemy definitions from blueprint.md §14.1 and §14.3.
// M5 ships the four base kinds (Grunt, Swarmer, Tank, Shooter).
// M14 adds the 'elite' boss-wave variant that spawns at Greed x3 per §7.3.
// Suggestions audit adds: Bomber, Loot Goblin, Shield Carrier, Splitter,
// Extract Jammer per §14.1.

import { Balance } from './Balance';

export type EnemyKind =
  | 'grunt'
  | 'swarmer'
  | 'tank'
  | 'shooter'
  | 'elite'
  | 'infested'
  | 'bomber'
  | 'lootGoblin'
  | 'shieldCarrier'
  | 'splitter'
  | 'extractJammer';

export type EnemyBehavior =
  | 'chaser'
  | 'shooter'
  | 'bomber'
  | 'fleeing'
  | 'buffer'
  | 'extractJammer';

export type EnemyShape =
  | 'triangle'
  | 'square'
  | 'pentagon'
  | 'circle'
  | 'diamond'
  | 'hexagon'
  | 'spiked';

export interface EnemyDef {
  hp: number;
  speed: number;
  size: number;
  color: number;
  textureKey: string;
  shape: EnemyShape;
  behavior: EnemyBehavior;
  scrapDrop: number;
  coreChance: number;
  contactDamage: number;
}

export const EnemyDefs: Record<EnemyKind, EnemyDef> = {
  grunt: {
    hp: 22,
    speed: 90,
    size: 28,
    color: Balance.colors.enemyGrunt,
    textureKey: 'enemy-grunt',
    shape: 'triangle',
    behavior: 'chaser',
    scrapDrop: 4,
    coreChance: 0.11,
    contactDamage: 10,
  },
  swarmer: {
    hp: 12,
    speed: 145,
    size: 22,
    color: Balance.colors.enemySwarmer,
    textureKey: 'enemy-swarmer',
    shape: 'triangle',
    behavior: 'chaser',
    scrapDrop: 3,
    coreChance: 0,
    contactDamage: 6,
  },
  tank: {
    hp: 60,
    speed: 58,
    size: 38,
    color: Balance.colors.enemyTank,
    textureKey: 'enemy-tank',
    shape: 'square',
    behavior: 'chaser',
    scrapDrop: 8,
    coreChance: 0.26,
    contactDamage: 18,
  },
  shooter: {
    hp: 28,
    speed: 72,
    size: 30,
    color: Balance.colors.enemyShooter,
    textureKey: 'enemy-shooter',
    shape: 'pentagon',
    behavior: 'shooter',
    scrapDrop: 5,
    coreChance: 0.14,
    contactDamage: 8,
  },
  // §7.3 boss-wave elite. Stats are 4× Tank per the M14 spec.
  elite: {
    hp: 240,
    speed: 64,
    size: 56,
    color: Balance.colors.elite,
    textureKey: 'enemy-elite',
    shape: 'square',
    behavior: 'chaser',
    scrapDrop: 24,
    coreChance: 0.55,
    contactDamage: 28,
  },
  // §4 infestation wave - red-tinted swarmer variant.
  infested: {
    hp: 18,
    speed: 130,
    size: 24,
    color: 0xff1644,
    textureKey: 'enemy-infested',
    shape: 'triangle',
    behavior: 'chaser',
    scrapDrop: 2,
    coreChance: 0,
    contactDamage: 6,
  },
  // §14.1 Bomber. Charges player, telegraphs 0.5s expanding ring, explodes
  // for AoE. Contact damage is 0 — the explosion is the threat. Spawns at
  // greed step 2+. Per-Bomber explosion stats live in Balance.enemies.bomber.
  bomber: {
    hp: 18,
    speed: 100,
    size: 26,
    color: 0xff7a3d,
    textureKey: 'enemy-bomber',
    shape: 'circle',
    behavior: 'bomber',
    scrapDrop: 5,
    coreChance: 0,
    contactDamage: 0,
  },
  // §14.1 Loot Goblin. Flees from player, drops fat reward if killed.
  // Despawns after lifetimeSec if not caught. 80% Core chance is the
  // highest in the roster; this is the dopamine-spike enemy.
  lootGoblin: {
    hp: 30,
    speed: 180,
    size: 26,
    color: 0xffd75a,
    textureKey: 'enemy-lootgoblin',
    shape: 'diamond',
    behavior: 'fleeing',
    scrapDrop: 30,
    coreChance: 0.80,
    contactDamage: 0,
  },
  // §14.1 Shield Carrier. Buffs nearby enemies (reduces damage they take).
  // Player must clear the Carrier first to break the formation.
  shieldCarrier: {
    hp: 45,
    speed: 50,
    size: 34,
    color: 0x4080ff,
    textureKey: 'enemy-shieldcarrier',
    shape: 'hexagon',
    behavior: 'buffer',
    scrapDrop: 7,
    coreChance: 0.18,
    contactDamage: 8,
  },
  // §14.1 Splitter. On death spawns 3 swarmers (handled in RaidScene at
  // kill time, not here — this entry just describes the parent).
  splitter: {
    hp: 35,
    speed: 80,
    size: 32,
    color: 0xff44ff,
    textureKey: 'enemy-splitter',
    shape: 'triangle',
    behavior: 'chaser',
    scrapDrop: 6,
    coreChance: 0.08,
    contactDamage: 10,
  },
  // §14.1 Extract Jammer. Targets the extraction pad. Slows the fill timer
  // while it's near the pad center. Only spawns after extraction opens.
  extractJammer: {
    hp: 40,
    speed: 90,
    size: 28,
    color: 0x222244,
    textureKey: 'enemy-extractjammer',
    shape: 'spiked',
    behavior: 'extractJammer',
    scrapDrop: 8,
    coreChance: 0.20,
    contactDamage: 12,
  },
};

export const ENEMY_TEXTURE_DIM = 44;
