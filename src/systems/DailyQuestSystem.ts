// Daily quest pick, progress tracking, claim. See blueprint.md §16.1.
//
// Subscribes to gameplay events (raid, kills, pickups, power-ups, greed,
// damage) on init() and increments save.daily.questProgress when relevant.
// RaidScene must call tickRaidElapsed(elapsed) each frame so the
// 'damageless60' quest can detect the 60-second window.
//
// Quest is rolled per UTC day; ensureTodaysQuest() picks a fresh quest if
// today's date doesn't match the last quest's date. Claim pays 100 Scrap +
// 1 Core + 1 cosmetic shard, then advances the streak via StreakSystem.

import { saveSystem } from '../platform/SaveSystem';
import { Economy } from './EconomySystem';
import { StreakSystem, type StreakAdvanceResult } from './StreakSystem';
import {
  QUEST_POOL,
  QuestDefs,
  todayUtcDate,
  type QuestDef,
  type QuestKind,
} from '../config/QuestDefs';
import { bus, Events } from '../core/EventBus';
import { DAILY_MODIFIER_DEFS, DAILY_MODIFIER_ORDER, type DailyModifierDef } from '../config/DailyModifierDefs';

interface RngLike {
  pick<T>(arr: readonly T[]): T;
}

const QUEST_REWARD_SCRAP = 100;
const QUEST_REWARD_CORES = 1;
const QUEST_REWARD_SHARDS = 1;


/** FNV-1a 32-bit hash — deterministic, fast, good distribution for daily modifier bucketing. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function modifierForDate(date: string): DailyModifierDef {
  const idx = hashString(`modifier:${date}`) % DAILY_MODIFIER_ORDER.length;
  return DAILY_MODIFIER_DEFS[DAILY_MODIFIER_ORDER[idx]];
}

class DailyQuestSystemImpl {
  private inited = false;
  // Per-raid sub-counters that don't survive a raid end (powerups in single
  // raid; the damageless-60 timer base).
  private powerupsThisRaid = 0;
  private damagelessSinceElapsed = 0;
  private damageless60FiredThisRaid = false;
  // M19 — tutorial raids and daily-seed raids don't advance daily quest
  // progress (per spec). RAID_STARTED carries the mode; this flag suppresses
  // bumpCounter and the boolean-quest handlers while set.
  private suppressForRaid = false;

  init(): void {
    if (this.inited) return;
    this.inited = true;
    bus.on(Events.RAID_STARTED, this.onRaidStarted);
    bus.on(Events.EXTRACTION_COMPLETE, this.onExtractionComplete);
    bus.on(Events.PICKUP_COLLECTED, this.onPickupCollected);
    bus.on(Events.ENEMY_KILLED, this.onEnemyKilled);
    bus.on(Events.POWERUP_COLLECTED, this.onPowerupCollected);
    bus.on(Events.GREED_CHANGED, this.onGreedChanged);
    bus.on(Events.PLAYER_DAMAGED, this.onPlayerDamaged);
  }

  // Picks a fresh quest for today's UTC date if one isn't active. Idempotent
  // within the same UTC day.
  ensureTodaysQuest(rng?: RngLike): void {
    const save = saveSystem.get();
    const today = todayUtcDate();
    const modifier = modifierForDate(today);
    save.daily.modifierId = modifier.id;
    if (save.daily.questId && QuestDefs[save.daily.questId]) return;
    if (save.daily.lastClaim === today) return; // claimed today, wait til tomorrow
    const pick = rng ? rng.pick(QUEST_POOL) : QUEST_POOL[Math.floor(Math.random() * QUEST_POOL.length)];
    save.daily.questId = pick.id;
    save.daily.questProgress = 0;
    save.daily.questCompleted = false;
  }

  getModifier(): DailyModifierDef | null {
    DailyQuestSystem.ensureTodaysQuest();
    const id = saveSystem.get().daily.modifierId;
    return id ? DAILY_MODIFIER_DEFS[id] ?? null : null;
  }

  getModifierForDate(date: string): DailyModifierDef | null {
    return DAILY_MODIFIER_DEFS[modifierForDate(date).id] ?? null;
  }

  // Returns null when no quest is active OR when the current quest id was
  // somehow lost from the pool.
  getCurrent(): { def: QuestDef; progress: number; completed: boolean } | null {
    const save = saveSystem.get();
    if (!save.daily.questId) return null;
    const def = QuestDefs[save.daily.questId];
    if (!def) return null;
    return { def, progress: save.daily.questProgress, completed: save.daily.questCompleted };
  }

  // Returns true on success. Pays quest reward + advances streak (which
  // pays its own day-tier reward). Caller should refresh UI + persist.
  claim(): { ok: boolean; streak?: StreakAdvanceResult } {
    const save = saveSystem.get();
    if (!save.daily.questCompleted) return { ok: false };

    Economy.bankLoot(QUEST_REWARD_SCRAP, QUEST_REWARD_CORES);
    save.cosmeticShards += QUEST_REWARD_SHARDS;
    save.daily.questCompleted = false;
    save.daily.questId = '';
    save.daily.questProgress = 0;
    save.daily.lastClaim = todayUtcDate();

    const streak = StreakSystem.advance();
    return { ok: true, streak };
  }

  // Per-frame tick from RaidScene. Drives the damageless-60 quest only.
  tickRaidElapsed(elapsedSec: number): void {
    if (this.damageless60FiredThisRaid) return;
    const cur = this.getCurrent();
    if (!cur || cur.def.kind !== 'damageless60') return;
    if (this.damagelessSinceElapsed === Number.POSITIVE_INFINITY) {
      // PLAYER_DAMAGED reset us; rebase the window to the current elapsed.
      this.damagelessSinceElapsed = elapsedSec;
      return;
    }
    if (elapsedSec - this.damagelessSinceElapsed >= 60) {
      this.markBooleanComplete(cur.def);
      this.damageless60FiredThisRaid = true;
    }
  }

  // ---- internals ----

  private onRaidStarted = (...args: unknown[]): void => {
    this.powerupsThisRaid = 0;
    this.damagelessSinceElapsed = 0;
    this.damageless60FiredThisRaid = false;
    // First arg is RaidMode ('tutorial' | 'normal' | 'dailySeed'); fall back
    // to non-tutorial if undefined for backwards compatibility.
    const mode = args[0] as string | undefined;
    this.suppressForRaid = mode === 'tutorial' || mode === 'dailySeed';
  };

  private onExtractionComplete = (): void => {
    this.bumpCounter('extracts', 1);
  };

  private onPickupCollected = (...args: unknown[]): void => {
    const type = args[0] as string;
    const value = (args[1] as number) ?? 1;
    if (type === 'core') this.bumpCounter('cores', value);
  };

  private onEnemyKilled = (): void => {
    this.bumpCounter('kills', 1);
  };

  private onPowerupCollected = (): void => {
    this.powerupsThisRaid += 1;
    const cur = this.getCurrent();
    if (!cur || cur.def.kind !== 'powerupsInOneRaid' || cur.completed) return;
    if (this.powerupsThisRaid >= cur.def.threshold) this.markBooleanComplete(cur.def);
  };

  private onGreedChanged = (...args: unknown[]): void => {
    const mult = args[0] as number;
    const cur = this.getCurrent();
    if (!cur || cur.def.kind !== 'greedX2' || cur.completed) return;
    if (mult >= 2.0) this.markBooleanComplete(cur.def);
  };

  private onPlayerDamaged = (...args: unknown[]): void => {
    const applied = (args[0] as number) ?? 0;
    if (applied <= 0) return; // shielded hits don't count as damage
    const cur = this.getCurrent();
    if (!cur || cur.def.kind !== 'damageless60') return;
    this.damagelessSinceElapsed = Number.POSITIVE_INFINITY; // tick will reseat
  };

  // For the cumulative quests (extracts / cores / kills), bump progress and
  // mark completed if threshold reached. Idempotent after completion. Tutorial
  // and daily-seed raids are suppressed via suppressForRaid.
  private bumpCounter(kind: QuestKind, n: number): void {
    if (this.suppressForRaid) return;
    const cur = this.getCurrent();
    if (!cur || cur.def.kind !== kind || cur.completed) return;
    const save = saveSystem.get();
    save.daily.questProgress += n;
    if (save.daily.questProgress >= cur.def.threshold) {
      save.daily.questProgress = cur.def.threshold;
      save.daily.questCompleted = true;
    }
  }

  private markBooleanComplete(def: QuestDef): void {
    if (this.suppressForRaid) return;
    const save = saveSystem.get();
    save.daily.questProgress = def.threshold;
    save.daily.questCompleted = true;
  }
}

export const DailyQuestSystem = new DailyQuestSystemImpl();
