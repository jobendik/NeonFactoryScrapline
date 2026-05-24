// Daily-seed personal-bests + leaderboard scaffold. See blueprint.md §16.3.
//
// The build ships PERSONAL BESTS only — every entry is the local player's
// own historical daily-seed scores. A global leaderboard would require a
// backend (none in the current build). The UI is labeled honestly as
// "PERSONAL BESTS" rather than pretending local-only entries are global
// rankings (which was an anti-retention pattern).
//
// `hasBackend()` returns false in the current build; a future backend swap
// just flips this and points `submitScore` at the real endpoint.

import { saveSystem } from '../platform/SaveSystem';

export interface LeaderboardEntry {
  date: string;        // YYYY-MM-DD
  score: number;
  // True for the entry the local player just posted. With no backend, all
  // entries are the local player's — used to highlight the most-recent row.
  isYou: boolean;
}

const MAX_HISTORY = 30;
const MAX_DISPLAY = 10;

export const LeaderboardSystem = {
  // True only when a real network backend is wired up. Until then the UI
  // surfaces personal-bests with honest labeling.
  hasBackend(): boolean {
    return false;
  },

  // Marks the daily-seed slot used for `date`. Called at raid launch so a
  // fail/collapse still consumes the day's attempt.
  markAttempted(date: string): void {
    saveSystem.get().dailySeedAttempted = date;
  },

  // Records the player's score for `date`. Called only on successful
  // extract.
  submitScore: async (date: string, score: number): Promise<boolean> => {
    const save = saveSystem.get();
    save.dailySeedHistory = [
      { date, score },
      ...save.dailySeedHistory,
    ].slice(0, MAX_HISTORY);
    // Backend swap: POST to remote endpoint here when hasBackend() flips.
    return true;
  },

  // Returns the top personal-best entries by score (descending). The most
  // recent date is flagged isYou so the UI can highlight it.
  getTopEntries(): LeaderboardEntry[] {
    const save = saveSystem.get();
    if (save.dailySeedHistory.length === 0) return [];
    const mostRecentDate = save.dailySeedHistory[0].date;
    return save.dailySeedHistory
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_DISPLAY)
      .map(e => ({ date: e.date, score: e.score, isYou: e.date === mostRecentDate }));
  },

  hasAttemptedToday(today: string): boolean {
    return saveSystem.get().dailySeedAttempted === today;
  },
};
