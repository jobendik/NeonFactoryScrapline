// Operator definitions per blueprint §11.
//
// Run C ships Pulse + Vanta only (per scope discipline). Surge and Lodestone
// are listed as `locked: true` with no `apply` so future content milestones
// can fill them in without restructuring this file. Reverb is post-launch
// content (season unlock).
//
// Each operator's `apply` mutates the shared RunMods at raid start. M16 calls
// this BEFORE the first draft window so card picks layer cleanly on top.

import { Strings } from './Strings';
import type { RunMods } from '../systems/RunMods';

export type OperatorId = 'pulse' | 'vanta' | 'surge' | 'lodestone';

export interface OperatorDef {
  id: OperatorId;
  name: string;
  description: string;
  unlockCost: number;       // in Cores
  // Tinted color for the silhouette; used by the operator picker UI.
  color: number;
  // True for operators not yet implemented - the picker greys them out and
  // disables both unlock and selection.
  locked: boolean;
  apply: (mods: RunMods) => void;
}

export const OperatorDefs: Record<OperatorId, OperatorDef> = {
  pulse: {
    id: 'pulse',
    name: Strings.operatorPulseName,
    description: Strings.operatorPulseDesc,
    unlockCost: 0,
    color: 0x22f6ff,
    locked: false,
    apply: () => {
      // Pulse is the balanced default; no kit modifications.
    },
  },
  vanta: {
    id: 'vanta',
    name: Strings.operatorVantaName,
    description: Strings.operatorVantaDesc,
    unlockCost: 50,
    color: 0xa76cff,
    locked: false,
    apply: m => {
      // +2 drones on raid start. Modeled as +2 simultaneous weapon targets.
      // The Drone Multiplier card multiplies whatever is here, so a Vanta
      // raid with that card picks up to +4 targets per shot.
      m.bonusWeaponTargets += 2;
      // -10% blaster damage trade-off.
      m.damageMult *= 0.9;
    },
  },
  // §11 Surge — glass cannon. +50% damage, -25% HP. Player.applyOperatorMods
  // bakes the bonusHP delta from RunMods into max HP at raid start; here we
  // mark it negative to drop HP. Damage runs through the standard damageMult.
  surge: {
    id: 'surge',
    name: Strings.operatorSurgeName,
    description: Strings.operatorSurgeDesc,
    unlockCost: 100,
    color: 0xff416b,
    locked: false,
    apply: m => {
      m.damageMult *= 1.5;
      // -25% HP — Player reads baseHP and adds bonusHP at raid start.
      // Negative bonusHP becomes negative max-HP delta in applyRunMods.
      m.bonusHP -= 26; // -25% of baseHP 105 ≈ 26
    },
  },
  // §11 Lodestone — loot vacuum. +100% magnet, slower movement.
  lodestone: {
    id: 'lodestone',
    name: Strings.operatorLodestoneName,
    description: Strings.operatorLodestoneDesc,
    unlockCost: 200,
    color: 0xffd75a,
    locked: false,
    apply: m => {
      m.magnetMult *= 2.0;
      m.speedMult *= 0.85;
    },
  },
};

export const OPERATOR_ORDER: OperatorId[] = ['pulse', 'vanta', 'surge', 'lodestone'];
