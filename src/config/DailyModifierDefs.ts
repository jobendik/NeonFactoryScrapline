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
    name: 'CORE BLOOM',
    color: '#ffd75a',
    desc: 'Core drop chance ×1.5, elites arrive early.',
  },
  scrap_storm: {
    id: 'scrap_storm',
    name: 'SCRAP STORM',
    color: '#22f6ff',
    desc: 'Factory SPM ×1.25, loot goblins spawn ×3.',
  },
  drone_festival: {
    id: 'drone_festival',
    name: 'DRONE FESTIVAL',
    color: '#a76cff',
    desc: 'Drone missions faster, drone upgrades cheaper.',
  },
  overclock_field: {
    id: 'overclock_field',
    name: 'OVERCLOCK FIELD',
    color: '#72ff9f',
    desc: 'Player speed ×1.10, enemy speed ×1.15.',
  },
  magnetic_resonance: {
    id: 'magnetic_resonance',
    name: 'MAGNETIC RESONANCE',
    color: '#ffb24a',
    desc: 'Pickup radius ×1.5.',
  },
};
