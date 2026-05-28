export interface DailyModifierDef {
  id: string;
  name: string;
  color: string;
  desc: string;
}

export const DAILY_MODIFIER_ORDER = [
  'core_bloom',
  'scrap_storm',
  'drone_festival',
  'overclock_field',
  'magnetic_resonance',
] as const;

export const DAILY_MODIFIER_DEFS: Record<string, DailyModifierDef> = {
  core_bloom: {
    id: 'core_bloom',
    name: 'STAR HEART BLOOM',
    color: '#ffd75a',
    desc: 'Star Heart drop ×1.5, elites arrive early.',
  },
  scrap_storm: {
    id: 'scrap_storm',
    name: 'STARDUST STORM',
    color: '#7cc9ff',
    desc: 'Garden Stardust/min ×1.25, loot sprites spawn ×3.',
  },
  drone_festival: {
    id: 'drone_festival',
    name: 'FIREFLY FESTIVAL',
    color: '#b98cff',
    desc: 'Firefly errands faster, firefly upgrades cheaper.',
  },
  overclock_field: {
    id: 'overclock_field',
    name: 'MOONLIGHT SURGE',
    color: '#72ff9f',
    desc: 'Player speed ×1.10, enemy speed ×1.15.',
  },
  magnetic_resonance: {
    id: 'magnetic_resonance',
    name: 'STARDUST RESONANCE',
    color: '#ffb24a',
    desc: 'Pickup radius ×1.5.',
  },
};
