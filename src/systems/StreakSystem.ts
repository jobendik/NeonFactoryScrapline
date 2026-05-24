// Daily streak with 1-day forgiveness. See blueprint.md §16.2.
//
// Advance is called when the player claims a daily quest. The skip-day rule:
//   - if (today - lastStreakDate) is exactly 1 day → streak += 1.
//   - if exactly 2 days → also streak += 1 (forgiven missed day).
//   - if 0 days → no-op (already advanced today).
//   - if more (3+) or never → reset to 1.
//
// Reward table per §16.2 is returned alongside the new streak value so the
// host (DailyQuestSystem) can pay it out atomically with the quest reward.

import { todayUtcDate, daysBetweenUtc } from '../config/QuestDefs';
import { saveSystem } from '../platform/SaveSystem';
import { Economy } from './EconomySystem';

export interface StreakAdvanceResult {
  // Day number after the advance (1, 2, 3, ...).
  newStreakDay: number;
  // Reward credited from the §16.2 table (0/0 when this day has no payout).
  rewardScrap: number;
  rewardCores: number;
  // True when this day's tier has a cosmetic — for now just bumps
  // cosmeticShards by 1 so the count surfaces somewhere.
  rewardCosmetic: boolean;
  // True when advance() actually changed streakDay (i.e. wasn't a same-day
  // double-claim). The UI uses this to suppress duplicate toasts.
  advanced: boolean;
}

// §16.2 reward table. Days not listed grant nothing extra (the daily quest
// already pays its own 100 Scrap + 1 Core + 1 Shard).
function rewardForDay(day: number): { scrap: number; cores: number; cosmetic: boolean } {
  switch (day) {
    case 1: return { scrap: 100, cores: 0, cosmetic: false };
    case 2: return { scrap: 150, cores: 0, cosmetic: false };
    case 3: return { scrap: 0, cores: 1, cosmetic: false };
    case 4: return { scrap: 250, cores: 0, cosmetic: false };
    case 5: return { scrap: 0, cores: 0, cosmetic: true };
    case 6: return { scrap: 0, cores: 3, cosmetic: false };
    case 7: return { scrap: 0, cores: 0, cosmetic: true };
    case 14: return { scrap: 0, cores: 10, cosmetic: true };
    case 30: return { scrap: 0, cores: 0, cosmetic: true };
    default: return { scrap: 0, cores: 0, cosmetic: false };
  }
}

export const StreakSystem = {
  // Returns the current streak day (0 when never advanced).
  getDay(): number {
    return saveSystem.get().daily.streakDay;
  },

  advance(): StreakAdvanceResult {
    const save = saveSystem.get();
    const today = todayUtcDate();
    const last = save.daily.lastStreakDate;
    let day = save.daily.streakDay;
    let advanced = false;

    if (!last) {
      day = 1;
      advanced = true;
    } else {
      const diff = daysBetweenUtc(last, today);
      if (Number.isNaN(diff)) {
        day = 1;
        advanced = true;
      } else if (diff === 0) {
        // Same UTC day. Streak unchanged (claim already happened today).
      } else if (diff === 1 || diff === 2) {
        day = day + 1;
        advanced = true;
      } else {
        day = 1;
        advanced = true;
      }
    }

    if (advanced) {
      save.daily.streakDay = day;
      save.daily.lastStreakDate = today;
      const reward = rewardForDay(day);
      if (reward.scrap > 0 || reward.cores > 0) {
        Economy.bankLoot(reward.scrap, reward.cores);
      }
      if (reward.cosmetic) save.cosmeticShards += 1;
      return {
        newStreakDay: day,
        rewardScrap: reward.scrap,
        rewardCores: reward.cores,
        rewardCosmetic: reward.cosmetic,
        advanced: true,
      };
    }

    return {
      newStreakDay: day,
      rewardScrap: 0,
      rewardCores: 0,
      rewardCosmetic: false,
      advanced: false,
    };
  },
};
