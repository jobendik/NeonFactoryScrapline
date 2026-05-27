// Save data shape and persistence. See blueprint.md §22.6.
// Wraps SDKBridge.saveData/loadData so the save layer doesn't care whether the underlying
// store is localStorage or the CrazyGames Data SDK.

import { SDKBridge } from './SDKBridge';
import { Balance } from '../config/Balance';
import type { UpgradeLevels, RefineryLevels, FtueUnlocks } from '../core/types';
import type { OperatorId } from '../config/OperatorDefs';
import {
  DEFAULT_RAID_ZONE_ID,
  RaidZoneDefs,
  createEmptyMaterials,
  type MaterialWallet,
  type RaidZoneId,
} from '../config/ScraplineDefs';

export const SAVE_VERSION = 13;

export type QualityPreset = 'low' | 'medium' | 'high';
const SAVE_KEY = 'save';

export interface SaveStats {
  runs: number;
  extracts: number;
  totalScrap: number;
  bestRaid: number;
  killCount: number;
}

export interface SaveDaily {
  // YYYY-MM-DD UTC. New quest at midnight UTC; lastClaim tracks the date
  // the player most recently claimed a daily quest.
  lastClaim: string;
  // Current quest id (empty string when no active quest).
  questId: string;
  questProgress: number;
  questCompleted: boolean;
  // Streak: advances by 1 on quest claim. Forgives 1 missed day (skip-day
  // rule). lastStreakDate tracks the YYYY-MM-DD the streak last advanced.
  streakDay: number;
  lastStreakDate: string;
}

export interface SaveCosmetics {
  equipped: { trail: string; skin: string; theme: string };
  owned: string[];
}

export interface SaveData {
  version: number;
  scrap: number;
  cores: number;
  materials: MaterialWallet;
  selectedZoneId: RaidZoneId;
  unlockedZoneIds: RaidZoneId[];
  upgrades: UpgradeLevels;
  refinery: RefineryLevels;
  // M16 — selectedOperator replaces v2's `operator`. The currently equipped
  // operator id; defaults to 'pulse'.
  selectedOperator: string;
  unlockedOperators: string[];
  achievements: string[];
  prestige: { count: number; cyberCores: number };
  daily: SaveDaily;
  cosmetics: SaveCosmetics;
  // M17 — infested machine indices into the active generator slot list.
  // failsBeforeFirst counts down from 3 (per §4.4); the first 3 failed raids
  // ignore infestation entirely.
  infestation: { machineIds: number[]; failsBeforeFirst: number };
  // M17 — flips true after the first-time infestation modal is dismissed
  // (per Run C clarification #3). Only mid-game text modal in the build.
  infestationTutorialSeen: boolean;
  stats: SaveStats;
  // M18 — cosmetic shards earned from daily quest claims. The actual
  // cosmetic system lands post-launch; this is just a counter for now.
  cosmeticShards: number;
  // M19 — daily-seed leaderboard state. dailySeedAttempted is the YYYY-MM-DD
  // of the last day the player ran the daily-seed raid (one attempt per day);
  // dailySeedHistory stores the most recent 30 entries so the local
  // leaderboard panel can render top scores.
  dailySeedAttempted: string;
  dailySeedHistory: { date: string; score: number }[];
  // M20 — rewarded ad state (per blueprint §17.2).
  //   factoryBoostLastMs: epoch ms of last FACTORY BOOST activation (0 = never).
  //   factoryBoostActiveUntilMs: epoch ms when current boost ends (0 = inactive).
  //   lastDailyCrate: YYYY-MM-DD UTC of the most recent DAILY CRATE claim.
  adState: {
    factoryBoostLastMs: number;
    factoryBoostActiveUntilMs: number;
    lastDailyCrate: string;
  };
  // M20 — OPERATOR TRY-OUT scaffolding. Set when the player accepts the
  // try-out ad on the operator picker; consumed at the next raid start in
  // place of selectedOperator. Cleared at raid end (any outcome).
  tryOutOperator: OperatorId | null;
  // M20 — last raid completion date (YYYY-MM-DD UTC). Gates DAILY CRATE
  // ("once per day after first raid of the day").
  lastRaidDate: string;
  // M21 — player settings persisted across sessions. qualityAutoDetect
  // controls whether the QualityManager may force a preset change based on
  // rolling FPS; the upgrade-to-high prompt has been shown at most once
  // (qualityUpgradeOffered) so it doesn't keep nagging.
  settings: {
    qualityPreset: QualityPreset;
    qualityAutoDetect: boolean;
    qualityUpgradeOffered: boolean;
    // Suggestions audit — Reduced Motion toggle. When true:
    //   - Camera shake magnitude halved (or fully disabled per scene call).
    //   - Greed vignette pulse + deep-end tint suppressed.
    //   - Particle counts capped at Low preset even at higher quality.
    // Auto-on when the OS reports prefers-reduced-motion: reduce.
    reducedMotion: boolean;
  };
  tutorialDone: boolean;
  // M11 FTUE tracking. raidsCompleted increments on any raid-end (including
  // tutorial); successfulExtracts only on extract. ftueUnlocks is the
  // progressive-reveal state for the upgrade panel (§5.3).
  raidsCompleted: number;
  successfulExtracts: number;
  firstCoreCollected: boolean;
  ftueUnlocks: FtueUnlocks;
  // Suggestions audit — Mission Board state (§16.6). `date` is the YYYY-MM-DD
  // of the last refresh; `slots` is the 3 active contracts.
  missions?: {
    date: string;
    slots: { id: string; progress: number; claimed: boolean }[];
  };
  // Retention pass — drives the welcome-back hook, comeback bonus, and the
  // rare DOUBLE PAYDAY event. All three are powerful CrazyGames retention
  // levers; see RetentionSystem for the rules.
  //   lastBootMs           : epoch ms of the previous app boot (so we can
  //                          measure absence at the NEXT boot and decide
  //                          whether to fire a comeback bonus).
  //   comebackBonusUntilMs : when set in the future, every Scrap drop
  //                          gets +100% for the window. Awarded after 7+
  //                          day absences with a 24h duration.
  //   comebackAnnouncedMs  : the lastBootMs that *triggered* the current
  //                          comeback window. Used so the welcome-back
  //                          banner shows only on the first boot after
  //                          a long absence, not every subsequent boot
  //                          while the buff is still live.
  //   doublePaydayActive   : true when the rare event banner should
  //                          render; raids during this window pay 2x.
  //   doublePaydayRaidsLeft: countdown so the event clears itself after
  //                          N raids regardless of date.
  //   doublePaydayDate     : YYYY-MM-DD UTC of the boot that rolled the
  //                          event so we never roll it twice in one day.
  retention: {
    lastBootMs: number;
    comebackBonusUntilMs: number;
    comebackAnnouncedMs: number;
    doublePaydayActive: boolean;
    doublePaydayRaidsLeft: number;
    doublePaydayDate: string;
  };
  lastSave: number;
  // Retention Phase 1 — account-level XP progression (never resets; carries
  // across all raids). seasonXp resets per season window; tracked separately
  // so the season system can read it without touching the global level.
  accountXp: number;
  seasonXp: number;
  // Track consecutive losses so the "easier-route nudge" can fire after 3 in
  // a row, and track the elapsed seconds of the most recent raid for the
  // "survived longer than last" comeback medal.
  consecutiveLosses: number;
  previousRaidElapsedSec: number;
}

function defaultFtueUnlocks(): FtueUnlocks {
  return {
    dailyClaim: false,
    droneUpgrade: false,
    magnetUpgrade: false,
    damageUpgrade: false,
    luckUpgrade: false,
    factoryBoost: false,
    missionBoard: false,
  };
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    scrap: Balance.economy.startingScrap,
    cores: 0,
    materials: createEmptyMaterials(),
    selectedZoneId: DEFAULT_RAID_ZONE_ID,
    unlockedZoneIds: [DEFAULT_RAID_ZONE_ID],
    upgrades: { gen: 1, drone: 0, speed: 0, magnet: 0, damage: 0, luck: 0 },
    refinery: {},
    selectedOperator: 'pulse',
    unlockedOperators: ['pulse'],
    achievements: [],
    prestige: { count: 0, cyberCores: 0 },
    daily: {
      lastClaim: '',
      questId: '',
      questProgress: 0,
      questCompleted: false,
      streakDay: 0,
      lastStreakDate: '',
    },
    cosmetics: { equipped: { trail: '', skin: '', theme: '' }, owned: [] },
    infestation: { machineIds: [], failsBeforeFirst: Balance.infestation.failsBeforeInfestation },
    infestationTutorialSeen: false,
    stats: { runs: 0, extracts: 0, totalScrap: 0, bestRaid: 0, killCount: 0 },
    cosmeticShards: 0,
    dailySeedAttempted: '',
    dailySeedHistory: [],
    adState: {
      factoryBoostLastMs: 0,
      factoryBoostActiveUntilMs: 0,
      lastDailyCrate: '',
    },
    tryOutOperator: null,
    lastRaidDate: '',
    settings: {
      qualityPreset: Balance.quality.defaultPreset,
      qualityAutoDetect: true,
      qualityUpgradeOffered: false,
      reducedMotion:
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    },
    tutorialDone: false,
    raidsCompleted: 0,
    successfulExtracts: 0,
    firstCoreCollected: false,
    ftueUnlocks: defaultFtueUnlocks(),
    missions: { date: '', slots: [] },
    retention: {
      lastBootMs: 0,
      comebackBonusUntilMs: 0,
      comebackAnnouncedMs: 0,
      doublePaydayActive: false,
      doublePaydayRaidsLeft: 0,
      doublePaydayDate: '',
    },
    accountXp: 0,
    seasonXp: 0,
    consecutiveLosses: 0,
    previousRaidElapsedSec: 0,
    lastSave: Date.now(),
  };
}

// Loose intermediate shape used during migration. Migrations operate on this
// object then we cast to SaveData once the chain is done.
type MigratingSave = Record<string, unknown> & { version?: number };

// v1 → v2: M11 adds raidsCompleted / successfulExtracts / firstCoreCollected /
// ftueUnlocks. Carry over everything else, fill new fields with safe defaults.
// Heuristic: a v1 save that already passed the tutorial (tutorialDone === true)
// is most likely past the FTUE gates too, so we unlock the full panel for them
// rather than re-hiding rows behind the new flags.
function migrateV1toV2(v1: MigratingSave): MigratingSave {
  const alreadyPlayed = v1.tutorialDone === true;
  const ftueUnlocks: FtueUnlocks = alreadyPlayed
    ? {
        dailyClaim: true,
        droneUpgrade: true,
        magnetUpgrade: true,
        damageUpgrade: true,
        luckUpgrade: true,
        factoryBoost: true,
        missionBoard: false,
      }
    : defaultFtueUnlocks();
  const stats = (v1.stats ?? {}) as { runs?: number; extracts?: number };
  return {
    ...v1,
    version: 2,
    raidsCompleted: stats.runs ?? 0,
    successfulExtracts: stats.extracts ?? 0,
    firstCoreCollected: ((v1.cores as number) ?? 0) > 0,
    ftueUnlocks,
  };
}

// v2 → v3: M16 renames `operator` → `selectedOperator`. Carry over
// unlockedOperators (already present on v2) and default selectedOperator
// to the old `operator` value if any, falling back to 'pulse'.
function migrateV2toV3(v2: MigratingSave): MigratingSave {
  const selected = (typeof v2.operator === 'string' && v2.operator.length > 0
    ? v2.operator
    : 'pulse');
  const unlocked = Array.isArray(v2.unlockedOperators) && (v2.unlockedOperators as unknown[]).length > 0
    ? (v2.unlockedOperators as string[])
    : ['pulse'];
  const { operator: _unused, ...rest } = v2 as MigratingSave & { operator?: string };
  void _unused;
  return {
    ...rest,
    version: 3,
    selectedOperator: selected,
    unlockedOperators: unlocked,
  };
}

// v3 → v4: M17 extends infestation with failsBeforeFirst (3-raid grace) and
// adds infestationTutorialSeen (one-time mechanic explainer modal). Carry
// existing machineIds; never start an existing player mid-grace if they
// already failed raids in v3 (we have no way to know, so reset grace fresh).
function migrateV3toV4(v3: MigratingSave): MigratingSave {
  const oldInfest = (v3.infestation ?? {}) as { machineIds?: number[]; failsBeforeFirst?: number };
  return {
    ...v3,
    version: 4,
    infestation: {
      machineIds: Array.isArray(oldInfest.machineIds) ? oldInfest.machineIds : [],
      failsBeforeFirst:
        typeof oldInfest.failsBeforeFirst === 'number'
          ? oldInfest.failsBeforeFirst
          : Balance.infestation.failsBeforeInfestation,
    },
    infestationTutorialSeen: false,
  };
}

// v4 → v5: M18 reshapes daily (drop `streak`, add questCompleted +
// streakDay + lastStreakDate). Adds cosmeticShards counter. Carry the
// old streak number into streakDay if present.
function migrateV4toV5(v4: MigratingSave): MigratingSave {
  const oldDaily = (v4.daily ?? {}) as {
    lastClaim?: string;
    streak?: number;
    questId?: string;
    questProgress?: number;
  };
  const carriedStreak = typeof oldDaily.streak === 'number' ? oldDaily.streak : 0;
  return {
    ...v4,
    version: 5,
    daily: {
      lastClaim: typeof oldDaily.lastClaim === 'string' ? oldDaily.lastClaim : '',
      questId: typeof oldDaily.questId === 'string' ? oldDaily.questId : '',
      questProgress: typeof oldDaily.questProgress === 'number' ? oldDaily.questProgress : 0,
      questCompleted: false,
      streakDay: carriedStreak,
      lastStreakDate: '',
    },
    cosmeticShards: typeof v4.cosmeticShards === 'number' ? (v4.cosmeticShards as number) : 0,
  };
}

// v5 → v6: M19 adds dailySeedAttempted + dailySeedHistory.
function migrateV5toV6(v5: MigratingSave): MigratingSave {
  return {
    ...v5,
    version: 6,
    dailySeedAttempted: typeof v5.dailySeedAttempted === 'string' ? v5.dailySeedAttempted : '',
    dailySeedHistory: Array.isArray(v5.dailySeedHistory) ? v5.dailySeedHistory : [],
  };
}

// v6 → v7: M20 adds adState (factory-boost cooldowns + daily-crate date),
// tryOutOperator (one-raid operator override), lastRaidDate (date of last
// raid end, gates daily crate eligibility).
function migrateV6toV7(v6: MigratingSave): MigratingSave {
  return {
    ...v6,
    version: 7,
    adState: {
      factoryBoostLastMs: 0,
      factoryBoostActiveUntilMs: 0,
      lastDailyCrate: '',
    },
    tryOutOperator: null,
    lastRaidDate: '',
  };
}

// v7 → v8: M21 adds settings (qualityPreset / autoDetect / upgradeOffered).
function migrateV7toV8(v7: MigratingSave): MigratingSave {
  return {
    ...v7,
    version: 8,
    settings: {
      qualityPreset: Balance.quality.defaultPreset,
      qualityAutoDetect: true,
      qualityUpgradeOffered: false,
    },
  };
}

// v8 -> v9: retired milestone reserved for a postponed experimental mode.
function migrateV8toV9(v8: MigratingSave): MigratingSave {
  return {
    ...v8,
    version: 9,
  };
}

// v9 -> v10: Suggestions audit adds reducedMotion to settings.
// Honor any prefers-reduced-motion OS preference on first
// migration so motion-sensitive users on existing saves get an opt-out
// without having to find the menu.
function migrateV9toV10(v9: MigratingSave): MigratingSave {
  const settings = (v9.settings ?? {}) as Record<string, unknown>;
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    ...v9,
    version: 10,
    settings: {
      ...settings,
      reducedMotion,
    },
  };
}

// v10 → v11: Retention pass adds the `retention` block (lastBootMs,
// comebackBonusUntilMs, comebackAnnouncedMs, doublePaydayActive,
// doublePaydayRaidsLeft, doublePaydayDate). Seeding lastBootMs from lastSave
// gives existing players a non-zero baseline so the first comeback-bonus
// check has a real "time since last seen" to compare against.
function migrateV10toV11(v10: MigratingSave): MigratingSave {
  const lastSave = typeof v10.lastSave === 'number' ? (v10.lastSave as number) : 0;
  return {
    ...v10,
    version: 11,
    retention: {
      lastBootMs: lastSave,
      comebackBonusUntilMs: 0,
      comebackAnnouncedMs: 0,
      doublePaydayActive: false,
      doublePaydayRaidsLeft: 0,
      doublePaydayDate: '',
    },
  };
}

// v11 -> v12: merged Scrapline progression. Adds tiered raid-zone selection
// plus Alloy/Circuits materials used by factory tech/refinery upgrades.
function migrateV11toV12(v11: MigratingSave): MigratingSave {
  const rawMaterials = (v11.materials ?? {}) as Partial<MaterialWallet>;
  const unlockedRaw = Array.isArray(v11.unlockedZoneIds) ? (v11.unlockedZoneIds as string[]) : [];
  const validZoneIds = new Set(RaidZoneDefs.map(z => z.id));
  const unlocked = unlockedRaw.filter((id): id is RaidZoneId => validZoneIds.has(id as RaidZoneId));
  if (!unlocked.includes(DEFAULT_RAID_ZONE_ID)) unlocked.unshift(DEFAULT_RAID_ZONE_ID);
  const selected =
    typeof v11.selectedZoneId === 'string' && unlocked.includes(v11.selectedZoneId as RaidZoneId)
      ? (v11.selectedZoneId as RaidZoneId)
      : DEFAULT_RAID_ZONE_ID;
  return {
    ...v11,
    version: 12,
    materials: {
      alloy: Math.max(0, Math.floor(Number(rawMaterials.alloy ?? 0))),
      circuits: Math.max(0, Math.floor(Number(rawMaterials.circuits ?? 0))),
    },
    selectedZoneId: selected,
    unlockedZoneIds: unlocked,
  };
}

// v12 → v13: Retention Phase 1 adds account-level XP, season XP, consecutive-
// loss tracking, and previous-raid elapsed time. All fields default to 0 for
// existing players so nothing breaks; they simply start the XP curve at 0.
function migrateV12toV13(v12: MigratingSave): MigratingSave {
  return {
    ...v12,
    version: 13,
    accountXp: typeof v12.accountXp === 'number' ? (v12.accountXp as number) : 0,
    seasonXp: typeof v12.seasonXp === 'number' ? (v12.seasonXp as number) : 0,
    consecutiveLosses: typeof v12.consecutiveLosses === 'number' ? (v12.consecutiveLosses as number) : 0,
    previousRaidElapsedSec: typeof v12.previousRaidElapsedSec === 'number' ? (v12.previousRaidElapsedSec as number) : 0,
  };
}

// Migration path - new versions add their case here. Old saves walk forward step
// by step. Per the M10 gate: a v0 save (no `version` field, written before
// versioning existed) is treated as a fresh save - we don't try to merge
// arbitrary partial shapes from a pre-history era.
function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return createDefaultSave();
  let save = raw as MigratingSave;

  if (!save.version) {
    // v0 (pre-versioning) → discard, start fresh.
    return createDefaultSave();
  }

  if (save.version === 1) save = migrateV1toV2(save);
  if (save.version === 2) save = migrateV2toV3(save);
  if (save.version === 3) save = migrateV3toV4(save);
  if (save.version === 4) save = migrateV4toV5(save);
  if (save.version === 5) save = migrateV5toV6(save);
  if (save.version === 6) save = migrateV6toV7(save);
  if (save.version === 7) save = migrateV7toV8(save);
  if (save.version === 8) save = migrateV8toV9(save);
  if (save.version === 9) save = migrateV9toV10(save);
  if (save.version === 10) save = migrateV10toV11(save);
  if (save.version === 11) save = migrateV11toV12(save);
  if (save.version === 12) save = migrateV12toV13(save);

  if (save.version === SAVE_VERSION) {
    return save as unknown as SaveData;
  }

  // Future migration steps register here:
  //   if (save.version === 10) save = migrateV10toV11(save);
  // Unknown / future versions fall through to a fresh save - safer than
  // running mismatched logic against a shape we don't understand.
  return createDefaultSave();
}

export class SaveSystem {
  private data: SaveData = createDefaultSave();
  // Transient: offline scrap computed at boot, displayed once as a toast.
  private pendingOfflineScrap = 0;

  async load(): Promise<SaveData> {
    const raw = await SDKBridge.loadData<SaveData>(SAVE_KEY);
    this.data = raw ? migrate(raw) : createDefaultSave();
    return this.data;
  }

  async persist(): Promise<void> {
    this.data.lastSave = Date.now();
    await SDKBridge.saveData(SAVE_KEY, this.data);
  }

  get(): SaveData {
    return this.data;
  }

  set(data: SaveData): void {
    this.data = data;
  }

  setPendingOfflineScrap(amount: number): void {
    this.pendingOfflineScrap = Math.max(0, amount);
  }

  consumePendingOfflineScrap(): number {
    const v = this.pendingOfflineScrap;
    this.pendingOfflineScrap = 0;
    return v;
  }
}

export const saveSystem = new SaveSystem();
