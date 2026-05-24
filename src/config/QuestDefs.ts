// Daily quest pool per blueprint §16.1.
//
// Six quest archetypes; one is rolled per UTC day. The `kind` drives which
// event listener in DailyQuestSystem advances progress:
//   - 'extracts'           — counts EXTRACTION_COMPLETE across the day.
//   - 'cores'              — counts core PICKUP_COLLECTED across the day.
//   - 'kills'              — counts ENEMY_KILLED across the day.
//   - 'powerupsInOneRaid'  — counts POWERUP_COLLECTED within a single raid;
//                            once the threshold is met in any raid, locked.
//   - 'greedX2'            — fires once when GREED_CHANGED hits >= 2.0.
//   - 'damageless60'       — fires once when 60 seconds pass in a single raid
//                            without the player taking damage.

import { Strings } from './Strings';

export type QuestKind =
  | 'extracts'
  | 'cores'
  | 'kills'
  | 'powerupsInOneRaid'
  | 'greedX2'
  | 'damageless60';

export interface QuestDef {
  id: string;
  text: string;
  threshold: number;
  kind: QuestKind;
}

export const QuestDefs: Record<string, QuestDef> = {
  extracts2: { id: 'extracts2', text: Strings.questExtractsText, threshold: 2, kind: 'extracts' },
  cores3: { id: 'cores3', text: Strings.questCoresText, threshold: 3, kind: 'cores' },
  kills50: { id: 'kills50', text: Strings.questKillsText, threshold: 50, kind: 'kills' },
  powerups3: { id: 'powerups3', text: Strings.questPowerupsText, threshold: 3, kind: 'powerupsInOneRaid' },
  greedX2: { id: 'greedX2', text: Strings.questGreedX2Text, threshold: 1, kind: 'greedX2' },
  damageless60: { id: 'damageless60', text: Strings.questDamagelessText, threshold: 1, kind: 'damageless60' },
};

export const QUEST_POOL: QuestDef[] = Object.values(QuestDefs);

// YYYY-MM-DD for the current UTC day. Used as a calendar key for daily
// rotation + streak tracking.
export function todayUtcDate(): string {
  const d = new Date();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

// Days between two YYYY-MM-DD strings (b - a). Returns NaN if parsing fails.
export function daysBetweenUtc(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}
