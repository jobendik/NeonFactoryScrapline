// PlayerXpSystem — account-level XP and title progression.
//
// XP is earned every raid regardless of outcome. Tutorial raids grant 50%
// of normal XP so new players still feel rewarded without inflating their
// level before they understand the game. The level curve is slightly
// front-loaded: levels 1-5 are fast to reach so the player sees level-ups
// in their first session, then slow gradually.
//
// This system is a singleton backed by SaveSystem. It exposes:
//   init()              — subscribe to events, restore state from save
//   beginRaid(bool)     — call at raid start to open a per-session accumulator
//   computeRaidXp(...)  — compute total XP for a completed raid
//   addXp(n)            — award XP and emit ACCOUNT_LEVEL_UP if threshold crossed
//   getXp()             — current total XP
//   getLevel()          — current level (1-based, no cap)
//   getTitle()          — title string for current level
//   getProgress()       — { xp, level, title, xpForLevel, xpIntoLevel }

import { bus, Events } from '../core/EventBus';
import { saveSystem } from '../platform/SaveSystem';

// XP curve: xpRequired[i] is the total XP needed to *reach* level i+1.
// Level 1 starts at 0 XP. The first few levels are intentionally fast.
// Formula: BASE * i^EXPONENT but hand-tuned for the first 10 levels.
const BASE_XP = 200;
const EXPONENT = 1.35;

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(BASE_XP * Math.pow(level - 1, EXPONENT));
}

// Cumulative XP required to reach a given level (1-based).
function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += xpForLevel(l);
  return total;
}

// Titles — every 5 levels a new rank is earned. Intermediate levels show
// the same title with a subtle level number so progress still feels visible.
const TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 1,  title: 'STARDUST SEEDLING' },
  { minLevel: 6,  title: 'NIGHT FORAGER'   },
  { minLevel: 11, title: 'MOON FLYER'      },
  { minLevel: 16, title: 'GLADE KEEPER'    },
  { minLevel: 21, title: 'HEART GUARDIAN'  },
  { minLevel: 26, title: 'TWILIGHT WISP'   },
  { minLevel: 31, title: 'STARLIGHT CASTER' },
  { minLevel: 36, title: 'GARDEN SPIRIT'   },
  { minLevel: 41, title: 'MOON SAGE'       },
  { minLevel: 46, title: 'LEGEND'          },
];

// Per-event XP rewards.
export const XP_REWARDS = {
  enemyKilled:       1,
  powerupCollected:  5,
  extractionComplete: 50,
  raidCompletedBase: 20, // awarded on ANY raid end (win or loss)
  perMinuteSurvived: 8,  // bonus for time survived
  tutorialMultiplier: 0.5,
} as const;

export interface RaidXpResult {
  total: number;
  breakdown: {
    base: number;
    timeSurvived: number;
    extracted: boolean;
  };
}

export interface XpProgress {
  xp: number;
  level: number;
  title: string;
  xpForCurrentLevel: number; // XP required to complete the current level
  xpIntoCurrentLevel: number; // XP already accumulated within the current level
}

class PlayerXpSystemImpl {
  // Per-raid accumulation counters (reset in beginRaid).
  private sessionKills = 0;
  private sessionPowerups = 0;
  private isTutorial = false;

  init(): void {
    // Subscribe to in-raid events so the system auto-tracks kills and pickups
    // during a raid without RaidScene needing to call us explicitly.
    bus.on(Events.ENEMY_KILLED, () => {
      if (this.isTutorial) return; // tutorial tracked in computeRaidXp
      this.sessionKills += 1;
    });
    bus.on(Events.POWERUP_COLLECTED, () => {
      if (this.isTutorial) return;
      this.sessionPowerups += 1;
    });
  }

  // Call at the start of each raid.
  beginRaid(isTutorial: boolean): void {
    this.sessionKills = 0;
    this.sessionPowerups = 0;
    this.isTutorial = isTutorial;
  }

  // Compute XP for the completed raid and add it to the account total.
  // Returns the breakdown so the SummaryScene can display it.
  computeRaidXp(opts: {
    elapsedSec: number;
    extracted: boolean;
    isTutorial: boolean;
  }): RaidXpResult {
    const kills = this.sessionKills;
    const powerups = this.sessionPowerups;

    const killXp = kills * XP_REWARDS.enemyKilled;
    const powerupXp = powerups * XP_REWARDS.powerupCollected;
    const base = XP_REWARDS.raidCompletedBase + killXp + powerupXp;
    const timeSurvived = Math.floor(opts.elapsedSec / 60) * XP_REWARDS.perMinuteSurvived;
    const extractBonus = opts.extracted ? XP_REWARDS.extractionComplete : 0;
    let total = base + timeSurvived + extractBonus;

    if (opts.isTutorial) total = Math.round(total * XP_REWARDS.tutorialMultiplier);

    this.addXp(total);
    return {
      total,
      breakdown: {
        base: base + extractBonus,
        timeSurvived,
        extracted: opts.extracted,
      },
    };
  }

  // Add raw XP and fire level-up events when thresholds are crossed.
  addXp(amount: number): void {
    if (amount <= 0) return;
    const save = saveSystem.get();
    const before = this.getLevel();
    save.accountXp += amount;
    save.seasonXp += amount;
    const after = this.getLevel();
    bus.emit(Events.XP_GRANTED, { amount, total: save.accountXp });
    if (after > before) {
      bus.emit(Events.ACCOUNT_LEVEL_UP, {
        level: after,
        title: this.getTitleForLevel(after),
      });
    }
  }

  getXp(): number {
    return saveSystem.get().accountXp;
  }

  getLevel(): number {
    return this.levelFromXp(this.getXp());
  }

  getTitle(): string {
    return this.getTitleForLevel(this.getLevel());
  }

  getTitleForLevel(level: number): string {
    let found = TITLES[0].title;
    for (const t of TITLES) {
      if (level >= t.minLevel) found = t.title;
    }
    return found;
  }

  getProgress(): XpProgress {
    const xp = this.getXp();
    const level = this.levelFromXp(xp);
    const xpAtLevel = cumulativeXpForLevel(level);
    const xpAtNext = cumulativeXpForLevel(level + 1);
    const xpForCurrentLevel = xpAtNext - xpAtLevel;
    const xpIntoCurrentLevel = xp - xpAtLevel;
    return {
      xp,
      level,
      title: this.getTitleForLevel(level),
      xpForCurrentLevel,
      xpIntoCurrentLevel,
    };
  }

  private levelFromXp(xp: number): number {
    let level = 1;
    while (cumulativeXpForLevel(level + 1) <= xp) level += 1;
    return level;
  }
}

export const PlayerXpSystem = new PlayerXpSystemImpl();
