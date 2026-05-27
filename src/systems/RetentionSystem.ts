// RetentionSystem — central rules for the CrazyGames-style retention hooks
// added in the post-M25 retention pass. None of the logic here is wired
// into the gameplay loop; this module is read-only ground truth for
// UI/EconomySystem callers asking "should I render the comeback banner",
// "what's the current scrap multiplier", "is DOUBLE PAYDAY live".
//
// Three pillars:
//   1. Comeback bonus — 7+ day absence triggers a 24h 2× Scrap window so
//      the rebound boot feels like an event, not a slog.
//   2. DOUBLE PAYDAY — rare boot-time roll that flags the next N raids as
//      2×. Variable-reward FOMO. Once a UTC day.
//   3. "Almost there" aggregator — exposes a single source of truth for
//      notification dots and progress nudges on the Factory UI (next
//      operator cost and claimable contracts).
//
// All state lives in SaveData.retention; nothing here keeps module-scope
// timers. The system is safe to call from any scene/init order.

import { saveSystem } from '../platform/SaveSystem';
import { todayUtcDate } from '../config/QuestDefs';
import { OperatorDefs, OPERATOR_ORDER, type OperatorId } from '../config/OperatorDefs';
import { OperatorSystem } from './OperatorSystem';
import { MissionBoard, MISSION_DEFS } from './MissionBoard';
import { StreakSystem } from './StreakSystem';
import { daysBetweenUtc } from '../config/QuestDefs';

const COMEBACK_ABSENCE_DAYS = 7;
const COMEBACK_DURATION_MS = 24 * 3600 * 1000;
const COMEBACK_MULT = 2;
const DOUBLE_PAYDAY_RAIDS = 3;
const DOUBLE_PAYDAY_MULT = 2;
const DOUBLE_PAYDAY_CHANCE = 0.10;

// Session-scope: onBoot runs once per app load even if the Factory hub is
// rebuilt several times (e.g. raid → summary → factory → raid → factory).
// `pendingBanners` is the queue the first FactoryScene visit consumes;
// subsequent visits get an empty array.
let bootProcessed = false;
let pendingBanners: BootBanner[] = [];

export interface BootBanner {
  // 'comeback' = 7+ day absence; 'payday' = rolled DOUBLE PAYDAY this boot;
  // 'streakLost' = today's quest hasn't been claimed and the streak just
  // collapsed past the 2-day forgiveness window; 'streakWarn' = streak is
  // alive but the 1-day forgiveness has been consumed (warn the player).
  kind: 'comeback' | 'payday' | 'streakLost' | 'streakWarn';
}

export interface OfflineSummary {
  scrap: number;
  awayMs: number;
  awayDescription: string; // "3h 42m", "2 days", etc.
}

export const RetentionSystem = {
  // Called by BootScene after save load + offline-scrap computation. Updates
  // the last-boot stamp, decides whether to fire a comeback bonus, and
  // rolls the DOUBLE PAYDAY event. Stashes the banner queue (in display
  // order) for the first FactoryScene visit to consume.
  //
  // Idempotent per session — if called twice (BootScene + FactoryScene as
  // a safety net), the second call returns the cached queue without
  // re-rolling anything.
  onBoot(nowMs: number = Date.now()): BootBanner[] {
    if (bootProcessed) return pendingBanners;
    const banners: BootBanner[] = [];
    const save = saveSystem.get();
    const r = save.retention;

    // Comeback detection — gated on time since the *previous* boot, not
    // since lastSave (which ticks on every Phaser shutdown).
    const lastBoot = r.lastBootMs > 0 ? r.lastBootMs : save.lastSave;
    const absenceMs = Math.max(0, nowMs - lastBoot);
    const absenceDays = absenceMs / (24 * 3600 * 1000);
    const alreadyAnnounced = r.comebackAnnouncedMs === lastBoot;
    if (absenceDays >= COMEBACK_ABSENCE_DAYS && !alreadyAnnounced) {
      r.comebackBonusUntilMs = nowMs + COMEBACK_DURATION_MS;
      r.comebackAnnouncedMs = lastBoot;
      banners.push({ kind: 'comeback' });
    }

    // DOUBLE PAYDAY — once per UTC day, rolled at boot. Carries forward
    // across reloads if the player ate raids but the active flag would
    // double-fire the toast, so we only push the banner when the date is
    // fresh.
    const today = todayUtcDate();
    const rolledTodayAlready = r.doublePaydayDate === today;
    if (!rolledTodayAlready) {
      r.doublePaydayDate = today;
      if (Math.random() < DOUBLE_PAYDAY_CHANCE) {
        r.doublePaydayActive = true;
        r.doublePaydayRaidsLeft = DOUBLE_PAYDAY_RAIDS;
        banners.push({ kind: 'payday' });
      }
    } else if (r.doublePaydayActive && r.doublePaydayRaidsLeft > 0) {
      // Same-day re-boot mid-event — surface the badge but no fresh banner.
    }

    // Streak FOMO — diff the saved streakDate against today.
    if (save.daily.streakDay > 0 && save.daily.lastStreakDate) {
      const diff = daysBetweenUtc(save.daily.lastStreakDate, today);
      if (!Number.isNaN(diff)) {
        if (diff >= 3) {
          // 3+ day gap → streak collapsed past the forgiveness window.
          banners.push({ kind: 'streakLost' });
          save.daily.streakDay = 0;
          save.daily.lastStreakDate = '';
        } else if (diff === 2) {
          // 1 day was skipped — forgiveness consumed. Warn the player so
          // they realize tomorrow is do-or-die.
          banners.push({ kind: 'streakWarn' });
        }
      }
    }

    // Always update lastBootMs so the next session has a clean baseline.
    r.lastBootMs = nowMs;
    bootProcessed = true;
    pendingBanners = banners;
    return banners;
  },

  // Consume-and-clear: FactoryScene calls this on its first visit after
  // boot. Returns whatever onBoot stashed; clears the queue so subsequent
  // factory visits don't re-show the banners.
  consumeBootBanners(): BootBanner[] {
    const out = pendingBanners;
    pendingBanners = [];
    return out;
  },

  // Called from EconomySystem.bankLoot so banked Scrap reflects the active
  // retention multipliers. Stacks multiplicatively with Refinery + Cyber
  // Cores so the comeback + double-payday windows feel exceptional.
  scrapMultiplier(nowMs: number = Date.now()): number {
    const r = saveSystem.get().retention;
    let mult = 1;
    if (r.comebackBonusUntilMs > nowMs) mult *= COMEBACK_MULT;
    if (r.doublePaydayActive && r.doublePaydayRaidsLeft > 0) mult *= DOUBLE_PAYDAY_MULT;
    return mult;
  },

  // Called by RaidScene at end of a successful raid (any state that counts
  // as a "raid played") so DOUBLE PAYDAY counts down. Tutorial raids are
  // excluded by the caller so the rare event doesn't burn on the FTUE.
  consumePaydayRaid(): void {
    const r = saveSystem.get().retention;
    if (!r.doublePaydayActive || r.doublePaydayRaidsLeft <= 0) return;
    r.doublePaydayRaidsLeft -= 1;
    if (r.doublePaydayRaidsLeft <= 0) {
      r.doublePaydayActive = false;
    }
  },

  isComebackActive(nowMs: number = Date.now()): boolean {
    return saveSystem.get().retention.comebackBonusUntilMs > nowMs;
  },

  comebackRemainingMs(nowMs: number = Date.now()): number {
    return Math.max(0, saveSystem.get().retention.comebackBonusUntilMs - nowMs);
  },

  isPaydayActive(): boolean {
    const r = saveSystem.get().retention;
    return r.doublePaydayActive && r.doublePaydayRaidsLeft > 0;
  },

  paydayRaidsRemaining(): number {
    return Math.max(0, saveSystem.get().retention.doublePaydayRaidsLeft);
  },

  // Human-friendly absence string. Caps at "many days" so a corrupted
  // clock or migrated save doesn't read "12783 days".
  describeAbsence(awayMs: number): string {
    const sec = Math.floor(awayMs / 1000);
    if (sec < 60) return 'a moment';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ${min % 60}m`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} day${day === 1 ? '' : 's'}`;
    return 'a long time';
  },

  // The most powerful retention surface on the Factory: a single struct
  // collecting every "you are X actions away from a reward" hook so the
  // UI can render dots + progress text in one place. The aggregator is
  // pure — recomputes from the live save every call so callers don't
  // have to subscribe to events.
  almostThere(): {
    nextOperator: { id: OperatorId; cost: number; cores: number; ready: boolean } | null;
    missionsReadyToClaim: number;
    affordableOperatorUnlock: boolean;
    streakTodayClaimable: boolean;
  } {
    const save = saveSystem.get();

    // Next operator the player can chase — first locked-but-unlockable in
    // OPERATOR_ORDER. Skips `locked: true` defs (not-yet-implemented) and
    // already-unlocked operators.
    let nextOperator: { id: OperatorId; cost: number; cores: number; ready: boolean } | null = null;
    for (const id of OPERATOR_ORDER) {
      const def = OperatorDefs[id];
      if (def.locked) continue;
      if (OperatorSystem.isUnlocked(id)) continue;
      nextOperator = {
        id,
        cost: def.unlockCost,
        cores: save.cores,
        ready: save.cores >= def.unlockCost,
      };
      break;
    }

    // Mission Board claimables — number of slots whose progress hit target.
    let claimable = 0;
    try {
      const slots = MissionBoard.getActive();
      for (const slot of slots) {
        if (slot.claimed) continue;
        const def = MISSION_DEFS[slot.id];
        if (def && slot.progress >= def.target) claimable += 1;
      }
    } catch {
      // MissionBoard not initialized yet (very early boot); 0 is correct.
    }

    return {
      nextOperator,
      missionsReadyToClaim: claimable,
      affordableOperatorUnlock: !!nextOperator && nextOperator.ready,
      streakTodayClaimable: !save.daily.questCompleted && !!save.daily.questId,
    };
  },

  // Convenience: today's UI streak number (StreakSystem stores the
  // canonical value but the welcome-back banner wants to read it without
  // also importing StreakSystem).
  currentStreakDay(): number {
    return StreakSystem.getDay();
  },

  // Compute a single "next best action" string for the result screen.
  // Priority order: claimable mission → daily quest → operator unlock → season → generic.
  computeNextBestAction(): string {
    try {
      const save = saveSystem.get();
      const at = RetentionSystem.almostThere();

      // 1. Claimable contract
      if (at.missionsReadyToClaim > 0) {
        return `${at.missionsReadyToClaim} contract${at.missionsReadyToClaim > 1 ? 's' : ''} ready to claim in Factory.`;
      }

      // 2. Daily quest not yet completed
      if (at.streakTodayClaimable) {
        return 'Complete your Daily Quest to fill the Chest.';
      }

      // 3. Operator within reach (≤150% of current cores)
      if (at.nextOperator) {
        const { cost, cores, id } = at.nextOperator;
        if (cores >= cost) {
          return `Unlock ${id.charAt(0).toUpperCase() + id.slice(1)} Operator — cores ready.`;
        }
        if (cores >= cost * 0.66) {
          return `${cost - cores} Cores to unlock the next Operator.`;
        }
      }

      // 4. Generic loop nudge
      if (save.stats.extracts === 0) {
        return 'Try extracting loot to earn a bonus.';
      }
      if (save.stats.runs < 5) {
        return 'Each raid builds your Factory. One more run.';
      }
      return 'One more raid.';
    } catch {
      return 'One more raid.';
    }
  },
};
