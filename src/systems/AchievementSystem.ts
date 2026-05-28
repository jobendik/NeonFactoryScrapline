import { saveSystem } from '../platform/SaveSystem';
import { bus, Events } from '../core/EventBus';
import type { RaidEndState } from '../core/types';

// AchievementSystem — §10.4 unlockables. M23 ships 8 achievements; the rest
// are post-launch content. The list itself is accessible from
// SettingsMenu → ACHIEVEMENTS. Toasts are emitted via ACHIEVEMENT_UNLOCKED
// so HUDScene can surface them without a direct dependency.

export type AchievementId =
  | 'first-extraction'
  | 'first-core'
  | 'ten-raids'
  | 'hundred-raids'
  | 'no-damage-extract'
  | 'greed-x3-extract'
  | 'first-prestige'
  | 'seven-day-streak';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  // True when the achievement has no trigger wired yet (e.g. first-prestige
  // since the Prestige system is post-launch). The list UI shows these
  // greyed-out with a "coming soon" hint.
  deferred?: boolean;
}

export const AchievementDefs: Record<AchievementId, AchievementDef> = {
  'first-extraction': {
    id: 'first-extraction',
    name: 'FIRST FLIGHT',
    description: 'Complete your first flight home.',
  },
  'first-core': {
    id: 'first-core',
    name: 'FIRST STAR HEART',
    description: 'Collect your first Star Heart.',
  },
  'ten-raids': {
    id: 'ten-raids',
    name: '10 FLIGHTS',
    description: 'Complete 10 flights.',
  },
  'hundred-raids': {
    id: 'hundred-raids',
    name: '100 FLIGHTS',
    description: 'Complete 100 flights.',
  },
  'no-damage-extract': {
    id: 'no-damage-extract',
    name: 'UNTOUCHED',
    description: 'Fly home without taking damage.',
  },
  'greed-x3-extract': {
    id: 'greed-x3-extract',
    name: 'GLIMMERING',
    description: 'Fly home at Glimmer x3.',
  },
  'first-prestige': {
    id: 'first-prestige',
    name: 'NEW MOON',
    description: 'Begin a New Moon once.',
    deferred: true,
  },
  'seven-day-streak': {
    id: 'seven-day-streak',
    name: '7-DAY STREAK',
    description: 'Claim a daily quest seven days in a row.',
  },
};

export const ACHIEVEMENT_ORDER: AchievementId[] = [
  'first-extraction',
  'first-core',
  'ten-raids',
  'hundred-raids',
  'no-damage-extract',
  'greed-x3-extract',
  'first-prestige',
  'seven-day-streak',
];

// Transient per-raid state.
let damagedThisRaid = false;
let initialized = false;

export const AchievementSystem = {
  // Subscribes to gameplay events. Call once at boot (idempotent).
  init(): void {
    if (initialized) return;
    initialized = true;
    bus.on(Events.RAID_STARTED, () => {
      damagedThisRaid = false;
    });
    bus.on(Events.PLAYER_DAMAGED, (...args: unknown[]) => {
      const applied = (args[0] as number) ?? 0;
      if (applied > 0) damagedThisRaid = true;
    });
    bus.on(Events.PICKUP_COLLECTED, (...args: unknown[]) => {
      const type = args[0] as string | undefined;
      if (type === 'core') AchievementSystem.maybeUnlock('first-core');
    });
  },

  // Called explicitly from RaidScene.finishRaid. Receives the same payload
  // the SummaryScene uses so we can read greedMult / state without an
  // extra event.
  handleRaidEnd(opts: { state: RaidEndState; greedMult: number; tutorial: boolean }): void {
    if (opts.tutorial) return;
    const save = saveSystem.get();
    if (opts.state === 'extracted') {
      AchievementSystem.maybeUnlock('first-extraction');
      if (!damagedThisRaid) AchievementSystem.maybeUnlock('no-damage-extract');
      if (opts.greedMult >= 3.0) AchievementSystem.maybeUnlock('greed-x3-extract');
    }
    if (save.raidsCompleted >= 10) AchievementSystem.maybeUnlock('ten-raids');
    if (save.raidsCompleted >= 100) AchievementSystem.maybeUnlock('hundred-raids');
    if (save.daily.streakDay >= 7) AchievementSystem.maybeUnlock('seven-day-streak');
  },

  maybeUnlock(id: AchievementId): boolean {
    const save = saveSystem.get();
    if (save.achievements.includes(id)) return false;
    save.achievements = [...save.achievements, id];
    bus.emit(Events.ACHIEVEMENT_UNLOCKED, id);
    return true;
  },

  isUnlocked(id: AchievementId): boolean {
    return saveSystem.get().achievements.includes(id);
  },

  getAll(): AchievementDef[] {
    return ACHIEVEMENT_ORDER.map(id => AchievementDefs[id]);
  },
};
