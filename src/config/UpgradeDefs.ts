// Upgrade track definitions. Cost formulas live in Balance.economy.upgrades
// (per blueprint §23); the labels/copy/start-level live here so the upgrade card
// UI never needs to reach back into Balance for strings.
//
// Cost formula: cost(currentLevel) = base * scale^(currentLevel - startLevel).
//   Gen starts at level 1 (default save), the rest start at 0.
//   First purchase of each track therefore costs exactly the base value.

import type { UpgradeLevels } from '../core/types';
import { Balance } from './Balance';

export type UpgradeKey = keyof UpgradeLevels;

export interface UpgradeDef {
  key: UpgradeKey;
  label: string;
  description: string;
  startLevel: number;
  // Per-track milestone notes (rendered as the "next milestone" hint on the card).
  // §8.5 (factory visual) and §9.4 (gameplay) milestones blend together here.
  milestones: Record<number, string>;
}

export const UpgradeDefs: Record<UpgradeKey, UpgradeDef> = {
  gen: {
    key: 'gen',
    label: 'GENERATOR',
    description: 'Higher SPM and Max HP',
    startLevel: 1,
    milestones: {
      2: 'Second generator',
      3: 'Conveyor belts',
      5: 'Factory expands',
      10: 'Reactor core',
    },
  },
  drone: {
    key: 'drone',
    label: 'DRONE',
    description: 'Drones in factory + SPM',
    startLevel: 0,
    milestones: {
      1: 'Bay deploys drones',
      3: 'Drone trails',
      5: 'Drones fire in raids',
    },
  },
  speed: {
    key: 'speed',
    label: 'SPEED',
    description: 'Faster movement',
    startLevel: 0,
    milestones: {
      5: 'Second dash charge',
    },
  },
  magnet: {
    key: 'magnet',
    label: 'MAGNET',
    description: 'Wider pickup radius',
    startLevel: 0,
    milestones: {
      3: 'Coil grows',
      5: 'Pickups orbit player',
    },
  },
  damage: {
    key: 'damage',
    label: 'DAMAGE',
    description: 'More damage and range',
    startLevel: 0,
    milestones: {
      5: 'Shots pierce one enemy',
      10: 'Shots split in two',
    },
  },
  luck: {
    key: 'luck',
    label: 'LUCK',
    description: 'Higher Core drop chance',
    startLevel: 0,
    milestones: {
      5: 'Cores leave gold trails',
      10: 'Cores can drop in pairs',
    },
  },
};

export const UPGRADE_KEYS: UpgradeKey[] = ['gen', 'drone', 'speed', 'magnet', 'damage', 'luck'];

export function nextCost(key: UpgradeKey, currentLevel: number): number {
  const cfg = Balance.economy.upgrades[key];
  const def = UpgradeDefs[key];
  const purchases = Math.max(0, currentLevel - def.startLevel);
  return Math.round(cfg.base * Math.pow(cfg.scale, purchases));
}

export function nextMilestone(key: UpgradeKey, currentLevel: number): { level: number; text: string } | null {
  const def = UpgradeDefs[key];
  const targetLevel = currentLevel + 1;
  const milestoneLevels = Object.keys(def.milestones)
    .map(n => Number(n))
    .filter(n => n >= targetLevel)
    .sort((a, b) => a - b);
  const next = milestoneLevels[0];
  if (next === undefined) return null;
  return { level: next, text: def.milestones[next] };
}
