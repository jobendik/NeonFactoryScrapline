// Mission Board per blueprint §16.6. Three contracts at a time, refreshing
// after 24h or when all three are claimed. Lighter than the daily quest:
// quests fire one at a time and grant a streak; contracts are a parallel
// 3-track that collectively pays out small rewards.
//
// Persisted on save under `missions`. Each slot stores progress + claimed
// flag; refresh re-rolls slots from MISSION_DEFS.

import { Economy } from './EconomySystem';
import { saveSystem } from '../platform/SaveSystem';
import { Strings } from '../config/Strings';
import { bus, Events } from '../core/EventBus';
import { todayUtcDate } from '../config/QuestDefs';
import { RaidZoneSystem, type MaterialCost } from './RaidZoneSystem';

export interface MissionDef {
  id: string;
  label: string;
  target: number;
  rewardScrap: number;
  rewardCores: number;
  rewardMaterials?: MaterialCost;
  // Mission progression hook. Mission Board listens to the gameplay events
  // listed here and increments progress by amount returned.
  progressFor(event: string, payload?: unknown): number;
}

const ZERO = (): number => 0;

export const MISSION_DEFS: Record<string, MissionDef> = {
  extracts2: {
    id: 'extracts2',
    label: Strings.missionExtract,
    target: 1,
    rewardScrap: 100,
    rewardCores: 0,
    progressFor: (event, _payload) => {
      // Triggered when the player extracts with at least 2 Cores in run loot.
      // The summary scene emits a 'mission:extractedWithCores' event with
      // the core count.
      return event === 'mission:extractedWithCores'
        ? Number((_payload as { cores?: number })?.cores ?? 0) >= 2
          ? 1
          : 0
        : 0;
    },
  },
  killSwarmers: {
    id: 'killSwarmers',
    label: Strings.missionKillSwarmers,
    target: 30,
    rewardScrap: 50,
    rewardCores: 1,
    progressFor: (event, payload) => {
      if (event !== Events.ENEMY_KILLED) return 0;
      const kind = (payload as { kind?: string })?.kind;
      return kind === 'swarmer' ? 1 : 0;
    },
  },
  useMagnet: {
    id: 'useMagnet',
    label: Strings.missionUseMagnet,
    target: 2,
    rewardScrap: 75,
    rewardCores: 0,
    progressFor: (event, payload) => {
      if (event !== Events.POWERUP_COLLECTED) return 0;
      return payload === 'magnetBurst' ? 1 : 0;
    },
  },
  killBomber: {
    id: 'killBomber',
    label: Strings.missionKillBomber,
    target: 5,
    rewardScrap: 60,
    rewardCores: 1,
    progressFor: (event, payload) => {
      if (event !== Events.ENEMY_KILLED) return 0;
      const kind = (payload as { kind?: string })?.kind;
      return kind === 'bomber' ? 1 : 0;
    },
  },
  useFreeze: {
    id: 'useFreeze',
    label: Strings.missionUseFreeze,
    target: 1,
    rewardScrap: 40,
    rewardCores: 0,
    progressFor: (event, payload) => {
      if (event !== Events.POWERUP_COLLECTED) return 0;
      return payload === 'freezePulse' ? 1 : 0;
    },
  },
  extractGreedX2: {
    id: 'extractGreedX2',
    label: Strings.missionExtractGreedX2,
    target: 1,
    rewardScrap: 80,
    rewardCores: 2,
    progressFor: ZERO, // dispatched explicitly from RaidScene
  },
  extractGlassDocks: {
    id: 'extractGlassDocks',
    label: 'Forage in Crystal Pools',
    target: 1,
    rewardScrap: 120,
    rewardCores: 0,
    rewardMaterials: { alloy: 6 },
    progressFor: (event, payload) => {
      if (event !== 'mission:zoneExtract') return 0;
      return (payload as { zoneId?: string })?.zoneId === 'glassDocks' ? 1 : 0;
    },
  },
  bankAlloy: {
    id: 'bankAlloy',
    label: 'Bank 25 Petals',
    target: 25,
    rewardScrap: 80,
    rewardCores: 0,
    rewardMaterials: { alloy: 5 },
    progressFor: (event, payload) => {
      if (event !== 'mission:materialsBanked') return 0;
      return Math.max(0, Math.floor(Number((payload as { alloy?: number })?.alloy ?? 0)));
    },
  },
  bankCircuits: {
    id: 'bankCircuits',
    label: 'Bank 10 Essence',
    target: 10,
    rewardScrap: 160,
    rewardCores: 1,
    progressFor: (event, payload) => {
      if (event !== 'mission:materialsBanked') return 0;
      return Math.max(0, Math.floor(Number((payload as { circuits?: number })?.circuits ?? 0)));
    },
  },
};

export const MISSION_POOL = Object.keys(MISSION_DEFS);

export interface MissionSlot {
  id: string;
  progress: number;
  claimed: boolean;
}

const MAX_SLOTS = 3;

function ensureSaveShape(): void {
  const save = saveSystem.get() as unknown as { missions?: { date: string; slots: MissionSlot[] } };
  if (!save.missions) {
    save.missions = { date: '', slots: [] };
  }
}

export const MissionBoard = {
  // Subscribed once at boot. Each event the board cares about funnels into
  // every active slot.
  init(): void {
    ensureSaveShape();
    const listen = (event: string): void => {
      bus.on(event, (...args: unknown[]) => {
        MissionBoard.applyEvent(event, args[0]);
      });
    };
    listen(Events.ENEMY_KILLED);
    listen(Events.POWERUP_COLLECTED);
    bus.on('mission:extractedWithCores', (...args: unknown[]) => {
      MissionBoard.applyEvent('mission:extractedWithCores', args[0]);
    });
    bus.on('mission:extractedAtGreed', (...args: unknown[]) => {
      const greed = Number((args[0] as { greed?: number } | undefined)?.greed ?? 0);
      if (greed < 1.5) return;
      MissionBoard.bumpById('extractGreedX2', 1);
    });
    bus.on('mission:zoneExtract', (...args: unknown[]) => {
      MissionBoard.applyEvent('mission:zoneExtract', args[0]);
    });
    bus.on('mission:materialsBanked', (...args: unknown[]) => {
      MissionBoard.applyEvent('mission:materialsBanked', args[0]);
    });
  },

  refreshIfNeeded(): void {
    ensureSaveShape();
    const save = saveSystem.get() as unknown as { missions: { date: string; slots: MissionSlot[] } };
    const today = todayUtcDate();
    const allClaimed = save.missions.slots.length === MAX_SLOTS && save.missions.slots.every(s => s.claimed);
    if (save.missions.date === today && !allClaimed && save.missions.slots.length === MAX_SLOTS) return;
    // Shuffle pool, pick MAX_SLOTS distinct ids.
    const ids = [...MISSION_POOL];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    save.missions = {
      date: today,
      slots: ids.slice(0, MAX_SLOTS).map(id => ({ id, progress: 0, claimed: false })),
    };
  },

  getActive(): MissionSlot[] {
    ensureSaveShape();
    MissionBoard.refreshIfNeeded();
    return (saveSystem.get() as unknown as { missions: { slots: MissionSlot[] } }).missions.slots;
  },

  applyEvent(event: string, payload?: unknown): void {
    ensureSaveShape();
    const save = saveSystem.get() as unknown as { missions: { slots: MissionSlot[] } };
    for (const slot of save.missions.slots) {
      if (slot.claimed) continue;
      const def = MISSION_DEFS[slot.id];
      if (!def) continue;
      const inc = def.progressFor(event, payload);
      if (inc > 0) slot.progress = Math.min(def.target, slot.progress + inc);
    }
  },

  bumpById(id: string, amount: number): void {
    ensureSaveShape();
    const save = saveSystem.get() as unknown as { missions: { slots: MissionSlot[] } };
    for (const slot of save.missions.slots) {
      if (slot.id !== id || slot.claimed) continue;
      const def = MISSION_DEFS[id];
      if (!def) continue;
      slot.progress = Math.min(def.target, slot.progress + amount);
    }
  },

  claim(id: string): boolean {
    const save = saveSystem.get() as unknown as { missions: { slots: MissionSlot[] } };
    const slot = save.missions.slots.find(s => s.id === id);
    if (!slot || slot.claimed) return false;
    const def = MISSION_DEFS[id];
    if (!def || slot.progress < def.target) return false;
    slot.claimed = true;
    Economy.bankLoot(def.rewardScrap, def.rewardCores);
    RaidZoneSystem.bankMaterials(def.rewardMaterials ?? {});
    return true;
  },
};
