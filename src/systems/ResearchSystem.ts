import type { SaveData } from '../platform/SaveSystem';
import { saveSystem } from '../platform/SaveSystem';
import { Economy } from './EconomySystem';
import type { RunMods } from './RunMods';
import { UpgradeEffects } from './UpgradeSystem';

export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  costScrap: number;
  costCores: number;
  durationMs: number;
  requires?: (save: SaveData) => boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

export const RESEARCH_ORDER = [
  'orbital_loot',
  'combat_drones',
  'dual_capacitors',
  'rapid_extraction',
  'magnet_pulse',
  'vault_expansion',
  'augment_array',
] as const;

export const ResearchDefs: Record<string, ResearchDef> = {
  orbital_loot: {
    id: 'orbital_loot',
    name: 'ORBITAL LOOT',
    desc: 'Pickups briefly orbit before flying in.',
    costScrap: 200,
    costCores: 0,
    durationMs: 30 * MIN,
  },
  combat_drones: {
    id: 'combat_drones',
    name: 'COMBAT DRONES',
    desc: 'Your drones fire during raids.',
    costScrap: 500,
    costCores: 2,
    durationMs: 60 * MIN,
    requires: save => save.upgrades.drone >= 2,
  },
  dual_capacitors: {
    id: 'dual_capacitors',
    name: 'DUAL CAPACITORS',
    desc: 'Dash gains 2 charges.',
    costScrap: 1500,
    costCores: 5,
    durationMs: 2 * HOUR,
  },
  rapid_extraction: {
    id: 'rapid_extraction',
    name: 'RAPID EXTRACTION',
    desc: 'Extraction hold time reduced by 30%.',
    costScrap: 800,
    costCores: 3,
    durationMs: 90 * MIN,
  },
  magnet_pulse: {
    id: 'magnet_pulse',
    name: 'MAGNET PULSE',
    desc: 'Factory auto-pulses nearby scrap.',
    costScrap: 600,
    costCores: 1,
    durationMs: 60 * MIN,
    requires: save => save.upgrades.magnet >= 1,
  },
  vault_expansion: {
    id: 'vault_expansion',
    name: 'VAULT EXPANSION',
    desc: 'Offline production cap doubled.',
    costScrap: 400,
    costCores: 0,
    durationMs: 60 * MIN,
  },
  augment_array: {
    id: 'augment_array',
    name: 'AUGMENT ARRAY',
    desc: 'Draft offers 4 cards instead of 3.',
    costScrap: 2000,
    costCores: 6,
    durationMs: 3 * HOUR,
    requires: save => save.raidsCompleted >= 10,
  },
};

function ensureShape(): void {
  const save = saveSystem.get() as SaveData & {
    research?: { completed?: string[]; activeId?: string | null; activeStartMs?: number };
  };
  if (!save.research) {
    save.research = { completed: [], activeId: null, activeStartMs: 0 };
    return;
  }
  save.research.completed ??= [];
  save.research.activeId ??= null;
  save.research.activeStartMs ??= 0;
}

export const ResearchSystem = {
  ensureSaveShape(): void {
    ensureShape();
  },

  getDefs(): ResearchDef[] {
    ensureShape();
    return RESEARCH_ORDER.map(id => ResearchDefs[id]);
  },

  isCompleted(id: string): boolean {
    ensureShape();
    return saveSystem.get().research.completed.includes(id);
  },

  isAvailable(id: string): boolean {
    ensureShape();
    const def = ResearchDefs[id];
    if (!def || ResearchSystem.isCompleted(id)) return false;
    if (saveSystem.get().research.activeId) return false;
    return def.requires ? def.requires(saveSystem.get()) : true;
  },

  getActive(): { id: string; startMs: number } | null {
    ensureShape();
    const { activeId, activeStartMs } = saveSystem.get().research;
    return activeId ? { id: activeId, startMs: activeStartMs } : null;
  },

  startResearch(id: string): boolean {
    ensureShape();
    const def = ResearchDefs[id];
    if (!def || !ResearchSystem.isAvailable(id)) return false;
    if (!Economy.spendScrap(def.costScrap)) return false;
    if (!Economy.spendCores(def.costCores)) {
      saveSystem.get().scrap += def.costScrap;
      return false;
    }
    saveSystem.get().research.activeId = id;
    saveSystem.get().research.activeStartMs = Date.now();
    return true;
  },

  checkCompletion(nowMs: number = Date.now()): string | null {
    ensureShape();
    const active = ResearchSystem.getActive();
    if (!active) return null;
    const def = ResearchDefs[active.id];
    if (!def) return null;
    if (nowMs - active.startMs < def.durationMs) return null;
    const save = saveSystem.get();
    if (!save.research.completed.includes(active.id)) save.research.completed.push(active.id);
    save.research.activeId = null;
    save.research.activeStartMs = 0;
    return active.id;
  },

  getRemainingMs(nowMs: number = Date.now()): number {
    ensureShape();
    const active = ResearchSystem.getActive();
    if (!active) return 0;
    const def = ResearchDefs[active.id];
    if (!def) return 0;
    return Math.max(0, def.durationMs - (nowMs - active.startMs));
  },

  applyToRunMods(mods: RunMods): void {
    ensureShape();
    if (ResearchSystem.isCompleted('orbital_loot')) mods.orbitPickups = true;
    if (ResearchSystem.isCompleted('dual_capacitors')) mods.bonusDashCharges += 1;
    if (ResearchSystem.isCompleted('rapid_extraction')) mods.extractHoldMult *= 0.7;
    if (ResearchSystem.isCompleted('combat_drones')) {
      mods.bonusWeaponTargets += Math.max(1, UpgradeEffects.droneCount());
    }
  },

  hasMagnetPulse(): boolean {
    return ResearchSystem.isCompleted('magnet_pulse');
  },

  offlineCapMult(): number {
    return ResearchSystem.isCompleted('vault_expansion') ? 2 : 1;
  },

  draftOfferCount(): number {
    return ResearchSystem.isCompleted('augment_array') ? 4 : 3;
  },
};
