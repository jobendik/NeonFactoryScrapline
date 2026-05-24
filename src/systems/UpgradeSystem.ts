import { Economy } from './EconomySystem';
import { saveSystem } from '../platform/SaveSystem';
import { nextCost, type UpgradeKey } from '../config/UpgradeDefs';
import { bus, Events } from '../core/EventBus';
import { Balance } from '../config/Balance';
import { Analytics } from '../platform/Analytics';
import { RefinerySystem } from './RefinerySystem';

// Thin wrapper around the saveSystem.upgrades record. All purchase logic goes
// through here so M11's progressive-reveal panel and M10's auto-save can hang
// off Events.UPGRADE_PURCHASED without re-deriving levels independently.

export const UpgradeSystem = {
  getLevel(key: UpgradeKey): number {
    return saveSystem.get().upgrades[key];
  },

  getNextCost(key: UpgradeKey): number {
    return nextCost(key, UpgradeSystem.getLevel(key));
  },

  canAfford(key: UpgradeKey): boolean {
    return Economy.getWallet().scrap >= UpgradeSystem.getNextCost(key);
  },

  purchase(key: UpgradeKey): boolean {
    const cost = UpgradeSystem.getNextCost(key);
    if (!Economy.spendScrap(cost)) return false;
    const newLevel = saveSystem.get().upgrades[key] + 1;
    saveSystem.get().upgrades[key] = newLevel;
    bus.emit(Events.UPGRADE_PURCHASED, key, newLevel);
    Analytics.track('upgrade_purchased', { kind: key, newLevel, cost });
    return true;
  },
};

// Read-side helpers that the rest of the codebase uses to project upgrade
// levels onto concrete numbers. Putting them here means tuning the formula
// only requires touching one file.

// Refinery + Prestige multipliers compose on top of the leveled upgrades.
// Each refinery row is a one-time purchase persisting forever; Cyber-Cores
// (prestige) layer a stacking +10% on top.
function cyberCoreMult(): number {
  const cc = saveSystem.get().prestige.cyberCores;
  return 1 + cc * Balance.prestige.cyberCoreBonus;
}

export const UpgradeEffects = {
  playerMaxHp(): number {
    const lvl = saveSystem.get().upgrades.gen;
    const base = Balance.player.baseHP + Math.max(0, lvl - 1) * Balance.player.hpPerGenLevel;
    return base + RefinerySystem.bonusMaxHp();
  },
  playerSpeed(): number {
    const lvl = saveSystem.get().upgrades.speed;
    return Balance.player.baseSpeed + lvl * Balance.player.speedPerLevel;
  },
  magnetRadius(): number {
    const lvl = saveSystem.get().upgrades.magnet;
    return (Balance.magnet.baseRadius + lvl * Balance.magnet.radiusPerLevel) * RefinerySystem.magnetMult();
  },
  weaponDamageLevel(): number {
    return saveSystem.get().upgrades.damage;
  },
  coreDropChance(base: number): number {
    const lvl = saveSystem.get().upgrades.luck;
    return Math.min(1, base + lvl * Balance.economy.coreChancePerLuck + RefinerySystem.coreDropBonus());
  },
  droneCount(): number {
    return saveSystem.get().upgrades.drone + RefinerySystem.bonusStartingDrones();
  },
  // §10.2 Scrap multipliers + §10.3 Cyber-Core stack. Applied at bank time
  // in EconomySystem so it shows up in both raid loot and offline production.
  globalScrapMult(): number {
    return RefinerySystem.scrapMult() * cyberCoreMult();
  },
  // Dash cooldown multiplier from Quick Boots refinery upgrade.
  dashCooldownMult(): number {
    return RefinerySystem.dashCooldownMult();
  },
};
