import type { MaterialWallet, RaidZoneId } from '../config/ScraplineDefs';

// Shared type definitions used across systems.
// Concrete domain shapes (Player, night-flight state, etc.) are added as those systems are built.

export type GameMode = 'factory' | 'raid';

export type RaidEndState = 'extracted' | 'failed' | 'collapsed';

// Fine-grained "why did this night flight end" tag. RaidEndState only captures the
// outcome bucket (fly home vs. fail vs. collapse); endReason disambiguates
// `collapsed` (timer vs. voluntary leave) and gives the SummaryScene a
// concrete coaching line per playbook §7.3 ("make failure explain itself").
//   - 'extracted' : moongate locked, stardust secured
//   - 'died'      : player HP hit 0
//   - 'timer'     : night-flight timer expired before flying home
//   - 'voluntary' : player used LEAVE RAID on the SettingsMenu
export type RaidEndReason = 'extracted' | 'died' | 'timer' | 'voluntary';

export interface RaidEndPayload {
  endState: RaidEndState;
  // Disambiguates `collapsed` (timer vs. voluntary). When omitted,
  // SummaryScene falls back to the endState-derived default copy.
  endReason?: RaidEndReason;
  loot: { scrap: number; cores: number; materials?: MaterialWallet };
  // Multiplier already applied to `loot` when state === 'extracted'. 1.0 otherwise.
  greedMult: number;
  // True when 50% unbanked-loot penalty was applied (state === 'failed' | 'collapsed').
  penaltyApplied: boolean;
  // True when this was the FTUE tutorial night flight (drives summary copy + downstream filters).
  tutorial: boolean;
  // M17 — number of garden devices newly blighted by this flight's outcome
  // (always 0 for tutorial / flew-home / grace-period failures). Surfaced
  // on the SummaryScene as a prominent line so the player understands.
  newlyInfested?: number;
  // M17 — number of garden devices restored from cleanse this flight. Surfaced as
  // a smaller line beneath the loot card.
  machinesRestored?: number;
  // M20 — true unless REVIVE was already prompted this flight (§17.3 mutex).
  // Defaults to true server-side if absent; SummaryScene reads this to
  // decide whether the DOUBLE LOOT button is interactive.
  allowDoubleLoot?: boolean;
  zoneId?: RaidZoneId;
  zoneName?: string;
  unlockedZones?: string[];
  // Retention Phase 1 — run performance stats for the new summary screen.
  runStats?: RaidRunStats;
  // XP awarded this run (computed by PlayerXpSystem.computeRaidXp).
  xpEarned?: number;
  // Academy level before and after this run (for showing level-up in summary).
  accountLevelBefore?: number;
  accountLevelAfter?: number;
  // Medal for notable performance (e.g. 'personalBest', 'lastSecond', 'longRun').
  comebackMedal?: ComebackMedal;
  // Single-line "what to do next" hint for the next-best-action row.
  nextBestAction?: string;
  // Retention Phase 3 — when the run was a daily-seed fly-home, the score
  // submitted and whether it beat every previous daily-seed best on record.
  dailySeedScore?: number;
  dailySeedNewBest?: boolean;
}

// Per-run performance stats shown on the result screen.
export interface RaidRunStats {
  elapsedSec: number;
  killCount: number;
  damageDealt: number;
  damageTaken: number;
  bestCombo: number;
  // Stardust collected during the run.
  scrapCollectedInRun: number;
}

// Medal awarded for notable outcomes (shown as a chip on the result screen).
export type ComebackMedal =
  | 'personalBest'    // new longest run
  | 'lastSecond'      // flew home with ≤5s remaining
  | 'longRun'         // survived longer than previous run
  | 'fullCargo'       // flew home with zero unbanked penalty
  | 'greedyExtract'   // flew home with the glimmer multiplier active
  | 'taskComplete'    // completed a daily task this run
  | 'firstExtract';   // very first successful fly-home through the moongate

export type RaidMode = 'tutorial' | 'normal' | 'dailySeed';

export interface RaidInitData {
  // Set by BootScene when !save.tutorialDone, by FactoryScene's launch pad it's false.
  tutorial?: boolean;
  // M19 — explicit night-flight mode. When omitted, falls back to: tutorial→'tutorial',
  // else 'normal'. Daily-seed mode is set by FactoryScene's daily-seed launch.
  mode?: RaidMode;
  zoneId?: RaidZoneId;
}

export interface UpgradeLevels {
  gen: number;
  drone: number;
  speed: number;
  magnet: number;
  damage: number;
  luck: number;
  worker: number;
}

export interface RefineryLevels {
  [key: string]: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type WaypointKind = 'extract' | 'pickup' | 'powerup';

export interface WaypointTarget {
  x: number;
  y: number;
  kind: WaypointKind;
}

// Progressive UI reveal flags per blueprint §5.3. Each flips to true the first
// time its unlock condition is met; never flips back. The garden's
// upgrade panel reads these to gate row visibility.
export interface FtueUnlocks {
  dailyClaim: boolean;
  droneUpgrade: boolean;
  magnetUpgrade: boolean;
  damageUpgrade: boolean;
  luckUpgrade: boolean;
  factoryBoost: boolean;
  missionBoard: boolean;
  workerUpgrade: boolean;
}
