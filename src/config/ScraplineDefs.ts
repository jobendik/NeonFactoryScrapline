export type MaterialKey = 'alloy' | 'circuits';

export interface MaterialWallet {
  alloy: number;
  circuits: number;
}

export interface MaterialDef {
  key: MaterialKey;
  label: string;
  shortLabel: string;
  color: string;
}

export const MaterialDefs: Record<MaterialKey, MaterialDef> = {
  alloy: {
    key: 'alloy',
    label: 'Petals',
    shortLabel: 'PETALS',
    color: '#9cf8ff',
  },
  circuits: {
    key: 'circuits',
    label: 'Essence',
    shortLabel: 'ESSENCE',
    color: '#b5ff7a',
  },
};

export function createEmptyMaterials(): MaterialWallet {
  return { alloy: 0, circuits: 0 };
}

export type RaidZoneId = 'scrapFields' | 'glassDocks' | 'plasmaGrave' | 'quantumLot';

export interface RaidZoneDef {
  id: RaidZoneId;
  name: string;
  tier: number;
  unlockExtracts: number;
  material: MaterialKey;
  materialYieldPer100Scrap: number;
  scrapMult: number;
  threatMult: number;
  enemyHpMult: number;
  color: string;
  description: string;
}

export const DEFAULT_RAID_ZONE_ID: RaidZoneId = 'scrapFields';

export const RaidZoneDefs: RaidZoneDef[] = [
  {
    id: 'scrapFields',
    name: 'Moonlit Meadow',
    tier: 1,
    unlockExtracts: 0,
    material: 'alloy',
    materialYieldPer100Scrap: 4,
    scrapMult: 1,
    threatMult: 1,
    enemyHpMult: 1,
    color: '#38f8ff',
    description: 'Starter glade. Reliable Petals for early garden growth.',
  },
  {
    id: 'glassDocks',
    name: 'Crystal Pools',
    tier: 2,
    unlockExtracts: 2,
    material: 'alloy',
    materialYieldPer100Scrap: 8,
    scrapMult: 1.15,
    threatMult: 1.08,
    enemyHpMult: 1.05,
    color: '#45ff93',
    description: 'Sharper foraging and more pressure. Best early Petal source.',
  },
  {
    id: 'plasmaGrave',
    name: 'Thornwood',
    tier: 3,
    unlockExtracts: 5,
    material: 'circuits',
    materialYieldPer100Scrap: 5,
    scrapMult: 1.3,
    threatMult: 1.18,
    enemyHpMult: 1.12,
    color: '#ff43df',
    description: 'Tangled ruins that yield potion Essence.',
  },
  {
    id: 'quantumLot',
    name: 'Eclipse Hollow',
    tier: 4,
    unlockExtracts: 10,
    material: 'circuits',
    materialYieldPer100Scrap: 10,
    scrapMult: 1.55,
    threatMult: 1.32,
    enemyHpMult: 1.25,
    color: '#ffd45c',
    description: 'Late-night danger glade with dense Essence.',
  },
];

export function getRaidZoneDef(id: string | undefined): RaidZoneDef {
  return RaidZoneDefs.find(z => z.id === id) ?? RaidZoneDefs[0];
}

// Per-zone arena visual theme. Drives the procedural background tile + the
// foreground grid / accent / parallax dust tints so each zone reads as a
// distinct place rather than the same arena with a different HUD label.
//
// gradient* are CSS color strings (the canvas draw uses createLinearGradient).
// bloom is the corner radial bloom rgba (kept low-alpha so it doesn't fight
// gameplay readability). gridColor is rgba for the foreground grid lines.
// accentColor + dustColor are 0xRRGGBB hex ints consumed by Graphics tints.
export interface ZoneVisualTheme {
  gradientFrom: string;
  gradientMid: string;
  gradientTo: string;
  bloomColor: string;
  gridColor: string;
  accentColor: number;
  dustColor: number;
}

// gradientMid is the FLAT sky base for the night-flight tile (see
// NeonFX.ensureRaidBackgroundFor). Brightened to a dreamy, kid-friendly
// twilight rather than a near-black void.
const DEFAULT_THEME: ZoneVisualTheme = {
  gradientFrom: '#4a4d92',
  gradientMid: '#3c3f7e',
  gradientTo: '#5a4a86',
  bloomColor: 'rgba(150, 215, 255, 0.16)',
  gridColor: 'rgba(124, 201, 255, 0.30)',
  accentColor: 0x9fd0ff,
  dustColor: 0xc7a6ff,
};

const ZONE_THEMES: Record<RaidZoneId, ZoneVisualTheme> = {
  // Tier 1 — starter moonlit blue. The default glade, so returning players
  // don't get a sudden re-skin on the zone they know.
  scrapFields: DEFAULT_THEME,
  // Tier 2 — crystal jade. Deep teal gradient with green grid for a
  // "moonlight refracting through crystal pools" feel.
  glassDocks: {
    gradientFrom: '#2f7a7e',
    gradientMid: '#2a6e74',
    gradientTo: '#246060',
    bloomColor: 'rgba(69, 255, 147, 0.12)',
    gridColor: 'rgba(69, 255, 147, 0.32)',
    accentColor: 0x45ff93,
    dustColor: 0x38f8ff,
  },
  // Tier 3 — tangled thornwood magenta. Violet-to-magenta gradient with hot
  // pink grid; the dust plane reads rose so the glade feels enchanted-wild.
  plasmaGrave: {
    gradientFrom: '#6a3f80',
    gradientMid: '#5c3a74',
    gradientTo: '#4a2e60',
    bloomColor: 'rgba(255, 67, 223, 0.14)',
    gridColor: 'rgba(255, 67, 223, 0.34)',
    accentColor: 0xff43df,
    dustColor: 0xff416b,
  },
  // Tier 4 — late-game eclipse gold-over-rose. Deep amber/rose base
  // with gold grid; reads as a high-stakes "endgame" glade.
  quantumLot: {
    gradientFrom: '#6a5586',
    gradientMid: '#5c4a7c',
    gradientTo: '#4a3a68',
    bloomColor: 'rgba(255, 212, 92, 0.14)',
    gridColor: 'rgba(255, 212, 92, 0.34)',
    accentColor: 0xffd45c,
    dustColor: 0xff9c3d,
  },
};

export function getZoneVisualTheme(id: string | undefined): ZoneVisualTheme {
  const zone = getRaidZoneDef(id);
  return ZONE_THEMES[zone.id] ?? DEFAULT_THEME;
}
