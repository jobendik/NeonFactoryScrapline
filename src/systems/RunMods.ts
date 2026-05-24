// Run-scoped modifier surface. Drafting cards (§12) and operator passives (§11)
// both compose onto this struct - cards by mutating fields in their `apply`
// hooks, operators by being seeded at raid start before drafting can run.
//
// Design rule: every field is a pure additive (or multiplicative) modifier.
// No conditional branches inside the modifier. Systems read these fields each
// frame and combine them with their own base values.

export interface RunMods {
  // -------- Combat --------
  damageMult: number;        // 1.0 base, +0.15 per Sharper Shots
  fireRateMult: number;      // 1.0 base, +0.10 per Burst Fire
  pierce: number;            // 0 base, +1 per Pierce - extra targets along fire path
  splitShot: number;         // 0 base, +1 per Split Shot - extra forks per shot
  chainBonus: number;        // 0 base, +N from Chain Lightning - chain hops on top of Drone Swarm
  critChance: number;        // 0 base, +0.15 per Crit Shot
  critMult: number;          // 3.0 default, used when crit roll succeeds

  // -------- Movement --------
  speedMult: number;         // 1.0 base, +0.10 per Quick Feet
  dashCooldownMult: number;  // 1.0 base, ×0.7 per Dash Master (multiplicative)

  // -------- Survival --------
  bonusHP: number;           // 0 base, +20 per Hardy
  healOnPickup: number;      // 0 base, +1 HP per stack on each scrap pickup
  vampiricChance: number;    // 0 base, +0.10 per Vampiric
  vampiricHeal: number;      // 5 default
  orbitalShieldEnabled: boolean;
  orbitalShieldRegenSec: number;  // 12 default
  phoenixCharges: number;    // 0 base, max 1 (revive at 50% HP)

  // -------- Loot / Magnet --------
  coreChanceBonus: number;   // 0 base, +0.05 per Lucky
  magnetMult: number;        // 1.0 base, +0.20 per Wide Magnet
  magnetStormDurAdd: number; // 0 base, +8 per Magnet Storm — auto-fires Magnet Burst-equivalent
  greedSurgeMult: number;    // 1.0 base, ×1.5 per Greed Surge — multiplicative with greed step

  // -------- Drones --------
  // Bonus simultaneous weapon targets per shot. Operators (Vanta: +2) seed
  // this at raid start; Drone Multiplier card multiplies whatever's already
  // here ("doubles even if 0"). WeaponSystem adds it to effective targets.
  bonusWeaponTargets: number;

  // -------- Suggestions audit: previously-deferred cards --------
  // Slow Field: enemies within slowFieldRadius of the player are slowed
  // by slowFieldFactor (0 = no slow, 1 = full slow). 0 base.
  slowFieldFactor: number;
  // Frenzy Mode: when player HP < frenzyHpFraction, weapon fire cooldown is
  // multiplied by frenzyFireMult (<1 = faster). 0 = inactive.
  frenzyHpFraction: number;
  frenzyFireMult: number;
  // Nova Dash: when > 0, a damaging ring (radius novaDashRadius, damage
  // novaDashDamage) emits on every dash start.
  novaDashRadius: number;
  novaDashDamage: number;
  // Time Dilation: global enemy speed multiplier. 1.0 = no effect.
  enemySpeedMult: number;
  // Pyrokinetic: on enemy death, deal pyroAoeDamage in pyroAoeRadius around
  // the corpse. 0 = inactive.
  pyroAoeRadius: number;
  pyroAoeDamage: number;
  // Ricochet: enables wall-bounce for player bullets (not used by hitscan
  // tracer model). Lifted to a stack count for future use.
  ricochetStacks: number;
}

export function createDefaultRunMods(): RunMods {
  return {
    damageMult: 1.0,
    fireRateMult: 1.0,
    pierce: 0,
    splitShot: 0,
    chainBonus: 0,
    critChance: 0,
    critMult: 3.0,

    speedMult: 1.0,
    dashCooldownMult: 1.0,

    bonusHP: 0,
    healOnPickup: 0,
    vampiricChance: 0,
    vampiricHeal: 5,
    orbitalShieldEnabled: false,
    orbitalShieldRegenSec: 12,
    phoenixCharges: 0,

    coreChanceBonus: 0,
    magnetMult: 1.0,
    magnetStormDurAdd: 0,
    greedSurgeMult: 1.0,

    bonusWeaponTargets: 0,

    slowFieldFactor: 0,
    frenzyHpFraction: 0,
    frenzyFireMult: 1.0,
    novaDashRadius: 0,
    novaDashDamage: 0,
    enemySpeedMult: 1.0,
    pyroAoeRadius: 0,
    pyroAoeDamage: 0,
    ricochetStacks: 0,
  };
}
