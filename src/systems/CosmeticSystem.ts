import { saveSystem } from '../platform/SaveSystem';
import { CosmeticDefs, DEFAULT_EQUIPPED, type CosmeticKind } from '../config/CosmeticDefs';

// CosmeticSystem — equip/unlock plumbing for §17.4 cosmetics. Scaffolding
// for post-launch content; M23 ships colors-only (no art). All state lives
// in saveSystem.get().cosmetics.

export const CosmeticSystem = {
  // True when the cosmetic id is in save.cosmetics.owned OR is the default
  // entry for its category. Unknown ids return false.
  isOwned(id: string): boolean {
    const def = CosmeticDefs[id];
    if (!def) return false;
    if (def.defaultUnlocked) return true;
    return saveSystem.get().cosmetics.owned.includes(id);
  },

  // Adds the cosmetic id to save.cosmetics.owned (idempotent). Used by
  // future hooks (achievements, season pass, IAP).
  unlock(id: string): boolean {
    const def = CosmeticDefs[id];
    if (!def) return false;
    if (CosmeticSystem.isOwned(id)) return true;
    const save = saveSystem.get();
    save.cosmetics.owned = [...save.cosmetics.owned, id];
    return true;
  },

  // Equip an owned cosmetic. Returns false if unowned or unknown.
  equip(id: string): boolean {
    const def = CosmeticDefs[id];
    if (!def) return false;
    if (!CosmeticSystem.isOwned(id)) return false;
    const eq = saveSystem.get().cosmetics.equipped;
    if (def.kind === 'trail') eq.trail = id;
    else if (def.kind === 'skin') eq.skin = id;
    else if (def.kind === 'theme') eq.theme = id;
    return true;
  },

  // Returns the currently-equipped id for a category (falls back to default).
  getEquipped(kind: CosmeticKind): string {
    const eq = saveSystem.get().cosmetics.equipped;
    const raw = kind === 'trail' ? eq.trail : kind === 'skin' ? eq.skin : eq.theme;
    if (raw && raw in CosmeticDefs && CosmeticDefs[raw].kind === kind) return raw;
    return DEFAULT_EQUIPPED[kind];
  },

  // Helpers — return the tint color for the currently-equipped cosmetic.
  // Consumers (Player thruster, Player sprite, FactoryScene grid) read
  // these at construction time.
  getEquippedTrailColor(): number {
    return CosmeticDefs[CosmeticSystem.getEquipped('trail')].color;
  },

  getEquippedSkinColor(): number {
    return CosmeticDefs[CosmeticSystem.getEquipped('skin')].color;
  },

  getEquippedThemeColor(): number {
    return CosmeticDefs[CosmeticSystem.getEquipped('theme')].color;
  },
};
