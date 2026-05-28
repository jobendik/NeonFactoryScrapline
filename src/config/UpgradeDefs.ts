// Upgrade track definitions. Cost formulas live in Balance.economy.upgrades
// (per blueprint §23); the labels/copy/start-level live here so the upgrade card
// UI never needs to reach back into Balance for strings.
//
// Cost formula: cost(currentLevel) = base * scale^(currentLevel - startLevel).
//   Gen starts at level 1 (default save), the rest start at 0.
//   First purchase of each track therefore costs exactly the base value.

import type { UpgradeLevels } from '../core/types';
import { Balance } from './Balance';
import { DailyQuestSystem } from '../systems/DailyQuestSystem';

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
    label: 'MOONWELL',
    description: 'More Stardust/min and Max HP',
    startLevel: 1,
    milestones: {
      2: 'Second moonwell',
      3: 'Flowing vines',
      5: 'Garden expands',
      10: 'Moonwell heart',
    },
  },
  drone: {
    key: 'drone',
    label: 'FIREFLIES',
    description: 'Fireflies in garden + Stardust/min',
    startLevel: 0,
    milestones: {
      1: 'Roost wakes fireflies',
      3: 'Firefly trails',
      5: 'Fireflies cast in flights',
    },
  },
  speed: {
    key: 'speed',
    label: 'SWIFTNESS',
    description: 'Faster movement',
    startLevel: 0,
    milestones: {
      5: 'Second dash charge',
    },
  },
  magnet: {
    key: 'magnet',
    label: 'STARDUST PULL',
    description: 'Wider pickup radius',
    startLevel: 0,
    milestones: {
      3: 'Pull grows',
      5: 'Pickups orbit you',
    },
  },
  damage: {
    key: 'damage',
    label: 'SPELL POWER',
    description: 'More power and range',
    startLevel: 0,
    milestones: {
      5: 'Shots pierce one enemy',
      10: 'Shots split in two',
    },
  },
  luck: {
    key: 'luck',
    label: 'LUCK',
    description: 'Higher Star Heart drop chance',
    startLevel: 0,
    milestones: {
      5: 'Star Hearts leave gold trails',
      10: 'Star Hearts can drop in pairs',
    },
  },
  worker: {
    key: 'worker',
    label: 'PIXIE',
    description: 'Pixies gather stardust on their own',
    startLevel: 0,
    milestones: {
      1: 'First pixie wakes',
      2: 'Two pixies',
      4: 'Three pixies',
      5: 'Carry 2 stardust per trip',
      6: 'Four pixies',
      8: 'Pixie trails',
      10: 'Five pixies',
    },
  },
};

export const UPGRADE_KEYS: UpgradeKey[] = ['gen', 'drone', 'worker', 'speed', 'magnet', 'damage', 'luck'];

export function nextCost(key: UpgradeKey, currentLevel: number): number {
  const cfg = Balance.economy.upgrades[key];
  const def = UpgradeDefs[key];
  const purchases = Math.max(0, currentLevel - def.startLevel);
  const cost = Math.round(cfg.base * Math.pow(cfg.scale, purchases));
  const modifier = DailyQuestSystem.getModifier();
  if (key === 'drone' && modifier?.id === 'drone_festival') return Math.max(1, Math.round(cost * 0.75));
  return cost;
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
