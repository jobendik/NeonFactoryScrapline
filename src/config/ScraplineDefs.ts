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
    label: 'Alloy',
    shortLabel: 'ALLOY',
    color: '#9cf8ff',
  },
  circuits: {
    key: 'circuits',
    label: 'Circuits',
    shortLabel: 'CIRCUITS',
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
    name: 'Scrap Fields',
    tier: 1,
    unlockExtracts: 0,
    material: 'alloy',
    materialYieldPer100Scrap: 4,
    scrapMult: 1,
    threatMult: 1,
    enemyHpMult: 1,
    color: '#38f8ff',
    description: 'Starter yard. Reliable Alloy for early factory machinery.',
  },
  {
    id: 'glassDocks',
    name: 'Glass Docks',
    tier: 2,
    unlockExtracts: 2,
    material: 'alloy',
    materialYieldPer100Scrap: 8,
    scrapMult: 1.15,
    threatMult: 1.08,
    enemyHpMult: 1.05,
    color: '#45ff93',
    description: 'Sharper salvage and more pressure. Best early Alloy source.',
  },
  {
    id: 'plasmaGrave',
    name: 'Plasma Grave',
    tier: 3,
    unlockExtracts: 5,
    material: 'circuits',
    materialYieldPer100Scrap: 5,
    scrapMult: 1.3,
    threatMult: 1.18,
    enemyHpMult: 1.12,
    color: '#ff43df',
    description: 'Volatile ruins that feed Circuit-based automation.',
  },
  {
    id: 'quantumLot',
    name: 'Quantum Lot',
    tier: 4,
    unlockExtracts: 10,
    material: 'circuits',
    materialYieldPer100Scrap: 10,
    scrapMult: 1.55,
    threatMult: 1.32,
    enemyHpMult: 1.25,
    color: '#ffd45c',
    description: 'Late-launch danger zone with dense Circuit payloads.',
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

const DEFAULT_THEME: ZoneVisualTheme = {
  gradientFrom: '#04111a',
  gradientMid: '#070718',
  gradientTo: '#11041c',
  bloomColor: 'rgba(34, 246, 255, 0.10)',
  gridColor: 'rgba(34, 246, 255, 0.30)',
  accentColor: 0x22f6ff,
  dustColor: 0xa76cff,
};

const ZONE_THEMES: Record<RaidZoneId, ZoneVisualTheme> = {
  // Tier 1 — starter cyan/teal. Matches the original raid look so returning
  // players don't get a sudden re-skin on the default zone.
  scrapFields: DEFAULT_THEME,
  // Tier 2 — coastal jade. Deep teal gradient with green grid for a
  // "glass refraction over dark water" feel.
  glassDocks: {
    gradientFrom: '#04181a',
    gradientMid: '#062018',
    gradientTo: '#04140e',
    bloomColor: 'rgba(69, 255, 147, 0.12)',
    gridColor: 'rgba(69, 255, 147, 0.32)',
    accentColor: 0x45ff93,
    dustColor: 0x38f8ff,
  },
  // Tier 3 — volatile plasma magenta. Violet-to-magenta gradient with hot
  // pink grid; the dust plane reads red so the arena feels ionized.
  plasmaGrave: {
    gradientFrom: '#1a0420',
    gradientMid: '#20062a',
    gradientTo: '#100214',
    bloomColor: 'rgba(255, 67, 223, 0.14)',
    gridColor: 'rgba(255, 67, 223, 0.34)',
    accentColor: 0xff43df,
    dustColor: 0xff416b,
  },
  // Tier 4 — late-game danger gold-over-crimson. Deep amber/crimson base
  // with gold grid; reads as a high-stakes "endgame" zone.
  quantumLot: {
    gradientFrom: '#1a0a04',
    gradientMid: '#180c02',
    gradientTo: '#0c0410',
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
