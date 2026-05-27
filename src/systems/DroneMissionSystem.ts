import { saveSystem } from '../platform/SaveSystem';
import { Economy } from './EconomySystem';
import { DailyQuestSystem } from './DailyQuestSystem';
import { InfestationSystem } from './InfestationSystem';

export interface DroneMissionDef {
  id: string;
  name: string;
  durationMs: number;
  desc: string;
}

export interface CollectedMission {
  missionId: string;
  slotIdx: number;
  scrap: number;
  cores: number;
  clearedInfestation: boolean;
}

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

export const DRONE_MISSION_ORDER = [
  'scrap_run',
  'core_hunt',
  'corruption_scan',
  'rare_salvage',
] as const;

export const DroneMissionDefs: Record<string, DroneMissionDef> = {
  scrap_run: { id: 'scrap_run', name: 'SCRAP RUN', durationMs: 30 * MIN, desc: 'Returns with Scrap scaled by generator level.' },
  core_hunt: { id: 'core_hunt', name: 'CORE HUNT', durationMs: 4 * HOUR, desc: 'Returns with 100 Scrap and 2 Cores.' },
  corruption_scan: { id: 'corruption_scan', name: 'CORRUPTION SCAN', durationMs: 8 * HOUR, desc: 'Returns with loot and clears 1 infested machine.' },
  rare_salvage: { id: 'rare_salvage', name: 'RARE SALVAGE', durationMs: 12 * HOUR, desc: 'Long mission with big rewards.' },
};

function ensureShape(): void {
  const save = saveSystem.get() as {
    droneMissions?: { active?: Array<{ missionId: string; startMs: number; slotIdx: number }> };
  };
  save.droneMissions ??= { active: [] };
  save.droneMissions.active ??= [];
}

function durationMultForStart(startMs: number): number {
  const modifier = DailyQuestSystem.getModifierForDate(new Date(startMs).toISOString().slice(0, 10));
  return modifier?.id === 'drone_festival' ? 0.75 : 1;
}

export const DroneMissionSystem = {
  ensureSaveShape(): void {
    ensureShape();
  },

  getSlotCount(): number {
    const lvl = saveSystem.get().upgrades.drone;
    if (lvl < 2) return 0;
    return Math.min(4, Math.floor(lvl / 2));
  },

  getDefs(): DroneMissionDef[] {
    ensureShape();
    return DRONE_MISSION_ORDER.map(id => DroneMissionDefs[id]);
  },

  getActive(): Array<{ missionId: string; startMs: number; slotIdx: number }> {
    ensureShape();
    return saveSystem.get().droneMissions.active.slice().sort((a, b) => a.slotIdx - b.slotIdx);
  },

  canLaunch(_missionId: string): boolean {
    return DroneMissionSystem.getActive().length < DroneMissionSystem.getSlotCount();
  },

  launch(missionId: string, slotIdx: number): boolean {
    ensureShape();
    if (!DroneMissionDefs[missionId]) return false;
    const slots = DroneMissionSystem.getSlotCount();
    if (slotIdx < 0 || slotIdx >= slots) return false;
    const active = saveSystem.get().droneMissions.active;
    if (active.some(m => m.slotIdx === slotIdx)) return false;
    active.push({ missionId, startMs: Date.now(), slotIdx });
    return true;
  },

  getMissionDurationMs(missionId: string, startMs: number = Date.now()): number {
    const def = DroneMissionDefs[missionId];
    if (!def) return 0;
    return Math.round(def.durationMs * durationMultForStart(startMs));
  },

  checkCompletions(nowMs: number = Date.now()): CollectedMission[] {
    ensureShape();
    const collected: CollectedMission[] = [];
    const remaining: Array<{ missionId: string; startMs: number; slotIdx: number }> = [];
    for (const active of saveSystem.get().droneMissions.active) {
      const durationMs = DroneMissionSystem.getMissionDurationMs(active.missionId, active.startMs);
      if (nowMs - active.startMs < durationMs) {
        remaining.push(active);
        continue;
      }
      let scrap = 0;
      let cores = 0;
      let clearedInfestation = false;
      if (active.missionId === 'scrap_run') {
        scrap = 200 * Math.max(1, saveSystem.get().upgrades.gen);
      } else if (active.missionId === 'core_hunt') {
        scrap = 100; cores = 2;
      } else if (active.missionId === 'corruption_scan') {
        scrap = 150; cores = 1;
        clearedInfestation = InfestationSystem.clearOneInfestation();
      } else if (active.missionId === 'rare_salvage') {
        scrap = 1000; cores = 5;
      }
      Economy.bankLoot(scrap, cores);
      collected.push({ missionId: active.missionId, slotIdx: active.slotIdx, scrap, cores, clearedInfestation });
    }
    saveSystem.get().droneMissions.active = remaining;
    return collected;
  },

  getTimeRemainingMs(slotIdx: number, nowMs: number = Date.now()): number {
    ensureShape();
    const active = saveSystem.get().droneMissions.active.find(m => m.slotIdx === slotIdx);
    if (!active) return 0;
    const durationMs = DroneMissionSystem.getMissionDurationMs(active.missionId, active.startMs);
    return Math.max(0, durationMs - (nowMs - active.startMs));
  },
};
