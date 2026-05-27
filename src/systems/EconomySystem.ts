import { Balance } from '../config/Balance';
import { saveSystem } from '../platform/SaveSystem';
import { InfestationSystem } from './InfestationSystem';
import { RefinerySystem } from './RefinerySystem';
import { RetentionSystem } from './RetentionSystem';
import { DailyQuestSystem } from './DailyQuestSystem';
import { ResearchSystem } from './ResearchSystem';

// EconomySystem centralizes the few rules that touch the player wallet:
//   - SPM formula per blueprint §8.7
//   - Banking raid loot to the persistent save
//   - Spending Scrap (used by upgrade purchases starting in M9)
//
// It's a thin module-scoped object rather than a class because there's no
// per-instance state - the wallet lives in saveSystem, the formula reads
// upgrades the same way.

function clampInfestation(ratio: number): number {
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

export const Economy = {
  // SPM = 14 × gen_level × (1 + drone_level × 0.22) × boostMult × (1 - infestation_ratio)
  // Per blueprint §8.7. Infestation ratio defaults to the live save state so
  // every caller (FactoryScene SPM display, generator drop cadence, offline
  // production) automatically zeroes-out infested machine contribution.
  // M20: boostActive defaults to the persisted FACTORY BOOST window in
  // SaveData.adState — Economy.computeSpm callers auto-double SPM while the
  // boost is live without threading the flag.
  computeSpm(opts?: { boostActive?: boolean; infestationRatio?: number }): number {
    const save = saveSystem.get();
    const genLevel = Math.max(1, save.upgrades.gen);
    const droneLevel = Math.max(0, save.upgrades.drone);
    const boostActive = opts?.boostActive ?? save.adState.factoryBoostActiveUntilMs > Date.now();
    const boost = boostActive ? Balance.economy.factoryBoostMult : 1;
    const dailyMod = DailyQuestSystem.getModifier();
    const dailySpm = dailyMod?.id === 'scrap_storm' ? 1.25 : 1;
    const infest = clampInfestation(opts?.infestationRatio ?? InfestationSystem.getInfestationRatio());
    // Refinery + prestige multipliers compose so offline production benefits
    // from Scrap Catalysts and Cyber-Cores too, not just raid loot.
    const globalMult =
      RefinerySystem.scrapMult() *
      RefinerySystem.factoryOutputMult() *
      (1 + save.prestige.cyberCores * Balance.prestige.cyberCoreBonus);
    return (
      Balance.economy.spm.base *
      genLevel *
      (1 + droneLevel * Balance.economy.spm.drone) *
      boost *
      dailySpm *
      (1 - infest) *
      globalMult
    );
  },

  // Seconds between successive scrap drops at the current SPM.
  generatorDropIntervalSec(opts?: { boostActive?: boolean; infestationRatio?: number }): number {
    const spm = Economy.computeSpm(opts);
    if (spm <= 0) return Number.POSITIVE_INFINITY;
    return 60 / spm;
  },

  bankLoot(scrap: number, cores: number): void {
    const save = saveSystem.get();
    // Apply Refinery + Cyber-Core + retention multipliers to banked Scrap.
    // Cores are not multiplied — they're rare-drop currency the player
    // earns directly. Retention multipliers (comeback bonus, DOUBLE
    // PAYDAY) stack multiplicatively so the rare events feel genuinely
    // exceptional rather than diluted by background progression.
    const globalMult =
      RefinerySystem.scrapMult() *
      (1 + save.prestige.cyberCores * Balance.prestige.cyberCoreBonus) *
      RetentionSystem.scrapMultiplier();
    save.scrap += Math.max(0, Math.floor(scrap * globalMult));
    save.cores += Math.max(0, Math.floor(cores));
  },

  // Returns true if the spend succeeded.
  spendScrap(amount: number): boolean {
    const save = saveSystem.get();
    if (save.scrap < amount) return false;
    save.scrap -= amount;
    return true;
  },

  // Returns true if the spend succeeded. Operator unlocks consume Cores.
  spendCores(amount: number): boolean {
    const save = saveSystem.get();
    if (save.cores < amount) return false;
    save.cores -= amount;
    return true;
  },

  getWallet(): { scrap: number; cores: number } {
    const save = saveSystem.get();
    return { scrap: save.scrap, cores: save.cores };
  },

  // Offline production per §8.6: SPM × minutes-offline, capped at
  // Balance.economy.offlineCapHours. Infested machines don't contribute
  // (no infestation in the system yet, so the ratio is 0 in M10).
  computeOfflineScrap(nowMs: number = Date.now()): number {
    const save = saveSystem.get();
    const last = save.lastSave || nowMs;
    if (last >= nowMs) return 0;
    const elapsedSec = (nowMs - last) / 1000;
    const cappedSec = Math.min(elapsedSec, RefinerySystem.offlineCapHours() * ResearchSystem.offlineCapMult() * 3600);
    if (cappedSec <= 0) return 0;
    const spm = Economy.computeSpm();
    return Math.floor(spm * (cappedSec / 60));
  },
};
