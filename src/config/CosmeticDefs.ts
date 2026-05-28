// Cosmetic placeholders per blueprint §17.4. M23 ships the SYSTEM only — no
// production cosmetic art beyond color swaps. The IAP flow + real cosmetic
// library is post-launch.
//
// Three categories, each with a free default + one or more locked variants:
//   - trail  → player firefly-trail particle tint
//   - skin   → player glider sprite tint
//   - theme  → garden grid color tint
//
// `unlockCondition` is a free-text label rendered on the cosmetics menu
// next to locked items; the actual unlock plumbing (e.g. "7-day streak"
// → flips the item into save.cosmetics.owned) lands when each gate's
// system is in place. For now, locked items stay locked unless the player
// manually adds the id to owned via a future shop / season pass.

export type CosmeticKind = 'trail' | 'skin' | 'theme';

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  // RGB hex used for tinting (trails / skins) or theme background.
  color: number;
  // Text shown next to locked entries on the cosmetics menu.
  unlockCondition: string;
  // True when this cosmetic is automatically considered owned (the default
  // entry per category).
  defaultUnlocked: boolean;
}

export const CosmeticDefs: Record<string, CosmeticDef> = {
  // ---- Trails ----
  'trail-cyan': {
    id: 'trail-cyan',
    kind: 'trail',
    name: 'MOONLIGHT TRAIL',
    description: 'Default firefly glow.',
    color: 0x7cc9ff,
    unlockCondition: '',
    defaultUnlocked: true,
  },
  'trail-purple': {
    id: 'trail-purple',
    kind: 'trail',
    name: 'LAVENDER TRAIL',
    description: 'Soft lavender sparkle.',
    color: 0xb98cff,
    unlockCondition: '7-day streak',
    defaultUnlocked: false,
  },
  'trail-gold': {
    id: 'trail-gold',
    kind: 'trail',
    name: 'STARGOLD TRAIL',
    description: 'High-prestige shimmer.',
    color: 0xffd75a,
    unlockCondition: 'Reach Glimmer x3 flight',
    defaultUnlocked: false,
  },

  // ---- Glider skins ----
  'skin-default': {
    id: 'skin-default',
    kind: 'skin',
    name: 'MOONLIGHT GLIDER',
    description: 'Starter glider.',
    color: 0xffffff, // applied as a no-op tint
    unlockCondition: '',
    defaultUnlocked: true,
  },
  'skin-crimson': {
    id: 'skin-crimson',
    kind: 'skin',
    name: 'ROSE GLIDER',
    description: 'Forged at the Moon Altar.',
    color: 0xff416b,
    unlockCondition: '100 Star Hearts spent at Moon Altar',
    defaultUnlocked: false,
  },

  // ---- Garden themes ----
  'theme-cyan': {
    id: 'theme-cyan',
    kind: 'theme',
    name: 'MOONLIT GARDEN',
    description: 'Default garden mood.',
    color: 0x7cc9ff,
    unlockCondition: '',
    defaultUnlocked: true,
  },
  'theme-purple': {
    id: 'theme-purple',
    kind: 'theme',
    name: 'TWILIGHT GARDEN',
    description: 'Deep midnight bloom.',
    color: 0x4a2d8f,
    unlockCondition: 'Buy with Moon Coins (coming soon)',
    defaultUnlocked: false,
  },
};

export function cosmeticsOfKind(kind: CosmeticKind): CosmeticDef[] {
  return Object.values(CosmeticDefs).filter(c => c.kind === kind);
}

// Equip-by-default ids per category. CosmeticSystem.getEquipped falls back
// to these when the saved equipped value is empty.
export const DEFAULT_EQUIPPED: Record<CosmeticKind, string> = {
  trail: 'trail-cyan',
  skin: 'skin-default',
  theme: 'theme-cyan',
};
