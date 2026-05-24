import { saveSystem } from '../platform/SaveSystem';
import {
  DEFAULT_RAID_ZONE_ID,
  MaterialDefs,
  RaidZoneDefs,
  createEmptyMaterials,
  getRaidZoneDef,
  type MaterialKey,
  type MaterialWallet,
  type RaidZoneDef,
  type RaidZoneId,
} from '../config/ScraplineDefs';

export type MaterialCost = Partial<MaterialWallet>;

function sanitizeMaterials(raw: Partial<MaterialWallet> | undefined): MaterialWallet {
  return {
    alloy: Math.max(0, Math.floor(Number(raw?.alloy ?? 0))),
    circuits: Math.max(0, Math.floor(Number(raw?.circuits ?? 0))),
  };
}

function materialKeys(): MaterialKey[] {
  return ['alloy', 'circuits'];
}

export const RaidZoneSystem = {
  ensureSaveShape(): void {
    const save = saveSystem.get();
    save.materials = sanitizeMaterials(save.materials);

    const unlocked = new Set<RaidZoneId>(
      Array.isArray(save.unlockedZoneIds)
        ? save.unlockedZoneIds.filter(id => RaidZoneDefs.some(z => z.id === id))
        : [],
    );
    unlocked.add(DEFAULT_RAID_ZONE_ID);
    save.unlockedZoneIds = [...unlocked];

    if (!RaidZoneDefs.some(z => z.id === save.selectedZoneId)) {
      save.selectedZoneId = DEFAULT_RAID_ZONE_ID;
    }
    if (!save.unlockedZoneIds.includes(save.selectedZoneId)) {
      save.selectedZoneId = DEFAULT_RAID_ZONE_ID;
    }
  },

  syncUnlocks(): RaidZoneDef[] {
    this.ensureSaveShape();
    const save = saveSystem.get();
    const newlyUnlocked: RaidZoneDef[] = [];
    for (const zone of RaidZoneDefs) {
      if (save.successfulExtracts >= zone.unlockExtracts && !save.unlockedZoneIds.includes(zone.id)) {
        save.unlockedZoneIds.push(zone.id);
        newlyUnlocked.push(zone);
      }
    }
    return newlyUnlocked;
  },

  getZones(): RaidZoneDef[] {
    this.syncUnlocks();
    return RaidZoneDefs;
  },

  getZone(id: string | undefined): RaidZoneDef {
    return getRaidZoneDef(id);
  },

  getSelectedZone(): RaidZoneDef {
    this.syncUnlocks();
    return getRaidZoneDef(saveSystem.get().selectedZoneId);
  },

  getUnlockedZoneIds(): RaidZoneId[] {
    this.syncUnlocks();
    return [...saveSystem.get().unlockedZoneIds];
  },

  isUnlocked(id: RaidZoneId): boolean {
    this.syncUnlocks();
    return saveSystem.get().unlockedZoneIds.includes(id);
  },

  selectZone(id: RaidZoneId): boolean {
    this.syncUnlocks();
    if (!this.isUnlocked(id)) return false;
    saveSystem.get().selectedZoneId = id;
    return true;
  },

  getMaterials(): MaterialWallet {
    this.ensureSaveShape();
    return sanitizeMaterials(saveSystem.get().materials);
  },

  bankMaterials(materials: MaterialCost): void {
    this.ensureSaveShape();
    const save = saveSystem.get();
    for (const key of materialKeys()) {
      save.materials[key] += Math.max(0, Math.floor(Number(materials[key] ?? 0)));
    }
  },

  canAffordMaterials(cost: MaterialCost | undefined): boolean {
    if (!cost) return true;
    const wallet = this.getMaterials();
    return materialKeys().every(key => wallet[key] >= Math.max(0, Math.floor(Number(cost[key] ?? 0))));
  },

  spendMaterials(cost: MaterialCost | undefined): boolean {
    if (!cost) return true;
    if (!this.canAffordMaterials(cost)) return false;
    const save = saveSystem.get();
    for (const key of materialKeys()) {
      save.materials[key] -= Math.max(0, Math.floor(Number(cost[key] ?? 0)));
    }
    return true;
  },

  computeMaterialPayout(zoneId: RaidZoneId, bankedScrap: number, tutorial: boolean): MaterialWallet {
    if (tutorial || bankedScrap <= 0) return createEmptyMaterials();
    const zone = getRaidZoneDef(zoneId);
    const qty = Math.floor((bankedScrap / 100) * zone.materialYieldPer100Scrap);
    const materials = createEmptyMaterials();
    materials[zone.material] = Math.max(0, qty);
    return materials;
  },

  formatMaterialCost(cost: MaterialCost | undefined): string {
    if (!cost) return '';
    return materialKeys()
      .filter(key => (cost[key] ?? 0) > 0)
      .map(key => `${Math.floor(cost[key] ?? 0)} ${MaterialDefs[key].shortLabel}`)
      .join(' / ');
  },

  formatMaterialWallet(materials: MaterialCost): string {
    return materialKeys()
      .filter(key => (materials[key] ?? 0) > 0)
      .map(key => `+${Math.floor(materials[key] ?? 0)} ${MaterialDefs[key].label}`)
      .join(' / ');
  },

  totalMaterials(materials: MaterialCost): number {
    return materialKeys().reduce((sum, key) => sum + Math.max(0, Math.floor(materials[key] ?? 0)), 0);
  },
};
