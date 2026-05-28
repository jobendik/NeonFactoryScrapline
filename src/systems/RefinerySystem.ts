// Core Refinery per blueprint §10.2. Permanent global multipliers paid for
// with Cores. Each upgrade has a one-time cost and (currently) one purchase
// — they're permanent passives, not stackable level grinds. Persisted in
// saveSystem.get().refinery as { [upgradeId]: number } where 0 = unowned,
// 1 = owned.
//
// UpgradeEffects reads these directly via RefinerySystem.getMultiplier /
// getBonus methods so callsites don't have to import the def list.

import { saveSystem } from '../platform/SaveSystem';
import { Economy } from './EconomySystem';
import { Strings } from '../config/Strings';
import { RaidZoneSystem, type MaterialCost } from './RaidZoneSystem';

export type RefineryId =
  | 'scrapCatalyst1'
  | 'scrapCatalyst2'
  | 'scrapCatalyst3'
  | 'droneOverclock1'
  | 'magnetSurge1'
  | 'ironPlating1'
  | 'quickBoots'
  | 'luckyStrike'
  | 'alloyPress1'
  | 'circuitLoom1'
  | 'droneDispatcher1'
  | 'factoryShield1'
  | 'haulerOverdrive';

export interface RefineryDef {
  id: RefineryId;
  name: string;
  effect: string;
  costCores: number;
  costMaterials?: MaterialCost;
  // Display tier — purely cosmetic ordering in the UI.
  tier: 1 | 2 | 3;
  // Optional prerequisite (e.g., Catalyst III requires II requires I).
  requires?: RefineryId;
}

export const RefineryDefs: Record<RefineryId, RefineryDef> = {
  scrapCatalyst1: {
    id: 'scrapCatalyst1',
    name: Strings.refineryCatalyst1Name,
    effect: Strings.refineryCatalyst1Effect,
    costCores: 10,
    tier: 1,
  },
  scrapCatalyst2: {
    id: 'scrapCatalyst2',
    name: Strings.refineryCatalyst2Name,
    effect: Strings.refineryCatalyst2Effect,
    costCores: 25,
    tier: 2,
    requires: 'scrapCatalyst1',
  },
  scrapCatalyst3: {
    id: 'scrapCatalyst3',
    name: Strings.refineryCatalyst3Name,
    effect: Strings.refineryCatalyst3Effect,
    costCores: 60,
    tier: 3,
    requires: 'scrapCatalyst2',
  },
  droneOverclock1: {
    id: 'droneOverclock1',
    name: Strings.refineryDroneOverclockName,
    effect: Strings.refineryDroneOverclockEffect,
    costCores: 15,
    tier: 1,
  },
  magnetSurge1: {
    id: 'magnetSurge1',
    name: Strings.refineryMagnetSurgeName,
    effect: Strings.refineryMagnetSurgeEffect,
    costCores: 20,
    tier: 1,
  },
  ironPlating1: {
    id: 'ironPlating1',
    name: Strings.refineryIronPlatingName,
    effect: Strings.refineryIronPlatingEffect,
    costCores: 30,
    tier: 2,
  },
  quickBoots: {
    id: 'quickBoots',
    name: Strings.refineryQuickBootsName,
    effect: Strings.refineryQuickBootsEffect,
    costCores: 40,
    tier: 2,
  },
  luckyStrike: {
    id: 'luckyStrike',
    name: Strings.refineryLuckyStrikeName,
    effect: Strings.refineryLuckyStrikeEffect,
    costCores: 50,
    tier: 3,
  },
  alloyPress1: {
    id: 'alloyPress1',
    name: Strings.refineryAlloyPressName,
    effect: Strings.refineryAlloyPressEffect,
    costCores: 0,
    costMaterials: { alloy: 25 },
    tier: 1,
  },
  circuitLoom1: {
    id: 'circuitLoom1',
    name: Strings.refineryCircuitLoomName,
    effect: Strings.refineryCircuitLoomEffect,
    costCores: 0,
    costMaterials: { circuits: 16 },
    tier: 2,
  },
  droneDispatcher1: {
    id: 'droneDispatcher1',
    name: Strings.refineryDroneDispatcherName,
    effect: Strings.refineryDroneDispatcherEffect,
    costCores: 0,
    costMaterials: { alloy: 40, circuits: 10 },
    tier: 2,
    requires: 'alloyPress1',
  },
  factoryShield1: {
    id: 'factoryShield1',
    name: Strings.refineryFactoryShieldName,
    effect: Strings.refineryFactoryShieldEffect,
    costCores: 0,
    costMaterials: { alloy: 30, circuits: 20 },
    tier: 3,
    requires: 'circuitLoom1',
  },
  haulerOverdrive: {
    id: 'haulerOverdrive',
    name: 'Hauler Overdrive',
    effect: 'Haulers move 40% faster',
    costCores: 20,
    tier: 2,
    requires: 'droneOverclock1',
  },
};

export const REFINERY_ORDER: RefineryId[] = [
  'alloyPress1',
  'circuitLoom1',
  'droneDispatcher1',
  'factoryShield1',
  'scrapCatalyst1',
  'scrapCatalyst2',
  'scrapCatalyst3',
  'droneOverclock1',
  'haulerOverdrive',
  'magnetSurge1',
  'ironPlating1',
  'quickBoots',
  'luckyStrike',
];

export const RefinerySystem = {
  isOwned(id: RefineryId): boolean {
    return (saveSystem.get().refinery[id] ?? 0) > 0;
  },

  // Per-upgrade requirement check. Refinery upgrades with `requires` only
  // appear purchasable once the prerequisite is owned.
  isAvailable(id: RefineryId): boolean {
    const def = RefineryDefs[id];
    if (!def.requires) return true;
    return RefinerySystem.isOwned(def.requires);
  },

  canAfford(id: RefineryId): boolean {
    const def = RefineryDefs[id];
    return (
      Economy.getWallet().cores >= def.costCores &&
      RaidZoneSystem.canAffordMaterials(def.costMaterials)
    );
  },

  purchase(id: RefineryId): boolean {
    if (RefinerySystem.isOwned(id)) return false;
    if (!RefinerySystem.isAvailable(id)) return false;
    const def = RefineryDefs[id];
    if (!RefinerySystem.canAfford(id)) return false;
    if (def.costCores > 0 && !Economy.spendCores(def.costCores)) return false;
    if (!RaidZoneSystem.spendMaterials(def.costMaterials)) return false;
    saveSystem.get().refinery[id] = 1;
    return true;
  },

  // ---- read-side projections ----

  // Total Scrap multiplier from Catalysts (additive: +5% +10% +20% if all).
  scrapMult(): number {
    let mult = 1;
    if (RefinerySystem.isOwned('scrapCatalyst1')) mult += 0.05;
    if (RefinerySystem.isOwned('scrapCatalyst2')) mult += 0.10;
    if (RefinerySystem.isOwned('scrapCatalyst3')) mult += 0.20;
    return mult;
  },

  factoryOutputMult(): number {
    let mult = 1;
    if (RefinerySystem.isOwned('alloyPress1')) mult += 0.10;
    if (RefinerySystem.isOwned('circuitLoom1')) mult += 0.15;
    return mult;
  },

  offlineCapHours(): number {
    return 8 + (RefinerySystem.isOwned('circuitLoom1') ? 4 : 0);
  },

  // +1 starting drone per Drone Overclock owned.
  bonusStartingDrones(): number {
    return (
      (RefinerySystem.isOwned('droneOverclock1') ? 1 : 0) +
      (RefinerySystem.isOwned('droneDispatcher1') ? 1 : 0)
    );
  },

  // +25% magnet range per Surge owned.
  magnetMult(): number {
    return RefinerySystem.isOwned('magnetSurge1') ? 1.25 : 1;
  },

  // +25 max HP per Iron Plating owned.
  bonusMaxHp(): number {
    return RefinerySystem.isOwned('ironPlating1') ? 25 : 0;
  },

  // -10% dash cooldown per Quick Boots owned.
  dashCooldownMult(): number {
    return RefinerySystem.isOwned('quickBoots') ? 0.9 : 1;
  },

  // +15% core drop rate per Lucky Strike owned.
  coreDropBonus(): number {
    return RefinerySystem.isOwned('luckyStrike') ? 0.15 : 0;
  },

  // Hauler Overdrive: factory workers move 40% faster.
  workerSpeedMult(): number {
    return RefinerySystem.isOwned('haulerOverdrive') ? 1.4 : 1;
  },
};
