// Weekly Boss — Signal Hydra raid mode per blueprint §16.4.
//
// Tracks the player's fastest-kill leaderboard for the current ISO week and
// keeps a rolling history of recent weeks so the panel can render a personal
// best leaderboard locally. There is no backend (matches LeaderboardSystem's
// posture): every entry is the local player's own historical best per week.
//
// Reward grant on victory is centralized here so the panel doesn't have to
// know the payout formula:
//   • Big Core payout: 5 + 1 per boss tier survived (3 phases = 3 tiers).
//   • Cosmetic shards: 25 baseline + 10 per remaining minute on the timer.
//
// Persistence: a new `weeklyBoss` block is added to SaveData (migration
// v13 → v14 below).

import { saveSystem } from '../platform/SaveSystem';
import { Economy } from './EconomySystem';

export interface WeeklyBossEntry {
  weekKey: string;       // ISO-year + ISO-week, e.g. "2026-W22"
  killTimeMs: number;    // best (lowest) time-to-kill for that week
}

export interface WeeklyBossSaveSlice {
  history: WeeklyBossEntry[];   // most-recent-first; capped to MAX_HISTORY
  totalKills: number;           // lifetime victories
}

const MAX_HISTORY = 26;       // ~half a year of weeks retained
const MAX_LEADERBOARD = 10;   // show top 10 fastest

// ISO-8601 week key (YYYY-Www). Weeks start Monday; the week containing the
// year's first Thursday is week 1. Matches what most "weekly reset" trackers
// in games like Path of Exile / Destiny use, so the boundary lines up with
// real calendars.
export function isoWeekKey(date: Date = new Date()): string {
  // Copy and shift to UTC Thursday of the same week so day-of-week math
  // doesn't trip on locale offsets.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // 0=Sun..6=Sat → ISO 1=Mon..7=Sun
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

// Milliseconds remaining until the next ISO week boundary (Monday 00:00 UTC).
export function msUntilNextWeek(now: Date = new Date()): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Days until next Monday (1..7).
  const daysToMonday = 8 - dayNum;
  const nextMonday = new Date(d);
  nextMonday.setUTCDate(d.getUTCDate() + daysToMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  return Math.max(0, nextMonday.getTime() - now.getTime());
}

export function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// Format milliseconds down to a short HH:MM countdown for "next reset in ..."
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getSlice(): WeeklyBossSaveSlice {
  const save = saveSystem.get();
  if (!save.weeklyBoss) {
    save.weeklyBoss = { history: [], totalKills: 0 };
  }
  return save.weeklyBoss;
}

export const WeeklyBossSystem = {
  ensureSaveShape(): void {
    getSlice();
  },

  currentWeekKey(): string {
    return isoWeekKey();
  },

  msUntilWeeklyReset(): number {
    return msUntilNextWeek();
  },

  // Best kill-time recorded this ISO week, or null if none yet.
  bestThisWeek(): WeeklyBossEntry | null {
    const slice = getSlice();
    const key = isoWeekKey();
    return slice.history.find(e => e.weekKey === key) ?? null;
  },

  // Returns the top fastest entries from history (lowest time first).
  topEntries(): WeeklyBossEntry[] {
    const slice = getSlice();
    return slice.history
      .slice()
      .sort((a, b) => a.killTimeMs - b.killTimeMs)
      .slice(0, MAX_LEADERBOARD);
  },

  totalKills(): number {
    return getSlice().totalKills;
  },

  // Records a victory. Returns true if this run set a new personal best for
  // the current week (so the UI can flag the row / play a stinger).
  recordVictory(killTimeMs: number): boolean {
    const slice = getSlice();
    const key = isoWeekKey();
    slice.totalKills += 1;

    const existingIdx = slice.history.findIndex(e => e.weekKey === key);
    if (existingIdx >= 0) {
      const existing = slice.history[existingIdx];
      if (killTimeMs < existing.killTimeMs) {
        slice.history[existingIdx] = { weekKey: key, killTimeMs };
        return true;
      }
      return false;
    }
    // First clear of the week → always a PB.
    slice.history = [{ weekKey: key, killTimeMs }, ...slice.history].slice(0, MAX_HISTORY);
    return true;
  },

  // Grants the victory reward via Economy + cosmetic shards. Returns the
  // payout for the UI to display.
  grantVictoryReward(opts: { phasesCleared: number; timeRemainingMs: number }): { cores: number; shards: number } {
    const cores = 5 + Math.max(0, opts.phasesCleared);
    const minutesLeft = Math.max(0, Math.floor(opts.timeRemainingMs / 60000));
    const shards = 25 + minutesLeft * 10;

    Economy.bankLoot(0, cores);
    const save = saveSystem.get();
    save.cosmeticShards = Math.max(0, (save.cosmeticShards ?? 0) + shards);
    return { cores, shards };
  },
};
