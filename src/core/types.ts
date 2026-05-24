import type { MaterialWallet, RaidZoneId } from '../config/ScraplineDefs';

// Shared type definitions used across systems.
// Concrete domain shapes (Player, RaidState, etc.) are added as those systems are built.

export type GameMode = 'factory' | 'raid';

export type RaidEndState = 'extracted' | 'failed' | 'collapsed';

export interface RaidEndPayload {
  endState: RaidEndState;
  loot: { scrap: number; cores: number; materials?: MaterialWallet };
  // Multiplier already applied to `loot` when state === 'extracted'. 1.0 otherwise.
  greedMult: number;
  // True when 50% unbanked-loot penalty was applied (state === 'failed' | 'collapsed').
  penaltyApplied: boolean;
  // True when this was the FTUE tutorial raid (drives summary copy + downstream filters).
  tutorial: boolean;
  // M17 — number of factory machines newly infested by this raid's outcome
  // (always 0 for tutorial / extracted / grace-period failures). Surfaced
  // on the SummaryScene as a prominent line so the player understands.
  newlyInfested?: number;
  // M17 — number of machines restored from cleanse this raid. Surfaced as
  // a smaller line beneath the loot card.
  machinesRestored?: number;
  // M20 — true unless REVIVE was already prompted this raid (§17.3 mutex).
  // Defaults to true server-side if absent; SummaryScene reads this to
  // decide whether the DOUBLE LOOT button is interactive.
  allowDoubleLoot?: boolean;
  zoneId?: RaidZoneId;
  zoneName?: string;
  unlockedZones?: string[];
}

export type RaidMode = 'tutorial' | 'normal' | 'dailySeed';

export interface RaidInitData {
  // Set by BootScene when !save.tutorialDone, by FactoryScene's deploy pad it's false.
  tutorial?: boolean;
  // M19 — explicit raid mode. When omitted, falls back to: tutorial→'tutorial',
  // else 'normal'. Daily-seed mode is set by FactoryScene's daily-seed deploy.
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
// time its unlock condition is met; never flips back. The FactoryScene's
// upgrade panel reads these to gate row visibility.
export interface FtueUnlocks {
  dailyClaim: boolean;
  droneUpgrade: boolean;
  magnetUpgrade: boolean;
  damageUpgrade: boolean;
  luckUpgrade: boolean;
  factoryBoost: boolean;
  missionBoard: boolean;
}
