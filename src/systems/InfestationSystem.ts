// The differentiator. See blueprint.md §4.
//
// On a failed night flight, shadow weeds "blight" 1-3 of the player's garden devices,
// disabling their SPM contribution until the player clears them on their
// next night flight by defeating blight-wave enemies.
//
// Anti-frustration safeguards (§4.4):
//   - Tutorial night flight never blights.
//   - First 3 failed night flights never blight (failsBeforeFirst grace).
//   - Cap at 50% of total garden devices (so a single-device garden can't lose
//     its only moonwell).
//
// State lives entirely in saveSystem.get(). InfestationSystem is a thin
// stateless module that reads/mutates that state. Per-flight cleanse progress
// is a transient owned by RaidScene and handed to handleRaidEnd().

import { Balance } from '../config/Balance';
import { saveSystem } from '../platform/SaveSystem';
import { bus, Events } from '../core/EventBus';
import type { RaidEndState } from '../core/types';

interface RngLike {
  next(): number;
  int(a: number, b: number): number;
}

export interface InfestationOutcome {
  // Number of garden devices newly marked blighted by this flight's outcome.
  newlyInfested: number;
  // Number of garden devices restored from cleanse-progress this flight.
  restored: number;
  // Whether this flight produced the FIRST blight event ever for this
  // save (drives the one-time tutorial modal in FactoryScene).
  firstEverInfestation: boolean;
}

// Total visible / functional garden-device slots. Currently the FactoryScene only
// renders generatorPositions.length slots regardless of gen level, so that
// IS the upper bound on blightable devices. If gen unlocks more slots later,
// extend Balance.factory.generatorPositions.
function totalMachineSlots(): number {
  const genLevel = Math.max(1, saveSystem.get().upgrades.gen);
  return Math.min(genLevel, Balance.factory.generatorPositions.length);
}

export const InfestationSystem = {
  getInfestedIndices(): number[] {
    return saveSystem.get().infestation.machineIds.slice();
  },

  hasInfestation(): boolean {
    return saveSystem.get().infestation.machineIds.length > 0;
  },

  // Fraction of garden-device slots currently blighted. Used by Economy.computeSpm
  // and the offline-production calc so blighted devices contribute nothing.
  getInfestationRatio(): number {
    const total = totalMachineSlots();
    if (total <= 0) return 0;
    const infested = saveSystem.get().infestation.machineIds.filter(
      i => i >= 0 && i < total,
    ).length;
    return infested / total;
  },

  totalSlots(): number {
    return totalMachineSlots();
  },

  // Called once per flight end (any outcome, including tutorial). Order:
  //   1. Apply cleanse from per-flight defeats (extracted OR failed).
  //   2. If state is fail/collapse and not tutorial and grace expired,
  //      add new blighted devices (capped).
  // Persists state immediately - the host (RaidScene.finishRaid) already
  // calls saveSystem.persist() right after.
  handleRaidEnd(opts: {
    isTutorial: boolean;
    state: RaidEndState;
    cleanseProgress: number;
    rng?: RngLike;
  }): InfestationOutcome {
    const save = saveSystem.get();
    const isFail = opts.state === 'failed' || opts.state === 'collapsed';
    let restored = 0;
    let newlyInfested = 0;
    const wasFirstSeen = !save.infestationTutorialSeen;

    // Cleanse: each killsToRestoreMachine defeats clears one device. Spillover
    // wraps to the next flight's progress is NOT carried (per spec — clean
    // boundary is simpler and forgiving enough).
    if (opts.cleanseProgress > 0 && save.infestation.machineIds.length > 0) {
      const machinesToRestore = Math.floor(
        opts.cleanseProgress / Balance.infestation.killsToRestoreMachine,
      );
      for (let i = 0; i < machinesToRestore; i++) {
        if (save.infestation.machineIds.length === 0) break;
        const removed = save.infestation.machineIds.pop();
        if (removed !== undefined) {
          restored++;
          bus.emit(Events.INFESTATION_CLEARED, removed);
        }
      }
    }

    // Tutorial never blights, never modifies grace counter (blueprint §5.4).
    if (opts.isTutorial) {
      return { newlyInfested: 0, restored, firstEverInfestation: false };
    }

    if (isFail) {
      // Grace period: first 3 failed night flights ignore blight.
      if (save.infestation.failsBeforeFirst > 0) {
        save.infestation.failsBeforeFirst -= 1;
      } else {
        const total = totalMachineSlots();
        const cap = Math.floor(total * Balance.infestation.maxMachineRatio);
        const currentInfested = save.infestation.machineIds.length;
        const room = Math.max(0, cap - currentInfested);
        if (room > 0) {
          const range = Balance.infestation.machinesLostPerFail;
          const wantRandom = opts.rng
            ? opts.rng.int(range.min, range.max)
            : range.min + Math.floor(Math.random() * (range.max - range.min + 1));
          const shieldReduction = (save.refinery.factoryShield1 ?? 0) > 0 ? 1 : 0;
          const want = Math.min(room, Math.max(1, wantRandom - shieldReduction));
          // Pick `want` indices not already blighted.
          const available: number[] = [];
          for (let i = 0; i < total; i++) {
            if (!save.infestation.machineIds.includes(i)) available.push(i);
          }
          for (let i = 0; i < want && available.length > 0; i++) {
            const pickIdx = opts.rng
              ? opts.rng.int(0, available.length - 1)
              : Math.floor(Math.random() * available.length);
            const slot = available[pickIdx];
            save.infestation.machineIds.push(slot);
            available.splice(pickIdx, 1);
            newlyInfested++;
            bus.emit(Events.INFESTATION_ADDED, slot);
          }
          // Belt-and-suspenders: clamp to cap in case of any rounding drift.
          if (save.infestation.machineIds.length > cap) {
            save.infestation.machineIds = save.infestation.machineIds.slice(0, cap);
          }
        }
      }
    }

    return {
      newlyInfested,
      restored,
      firstEverInfestation: wasFirstSeen && newlyInfested > 0,
    };
  },

  // Marks the one-time mechanic modal as seen. Called by FactoryScene after
  // the player dismisses the modal (the garden-blight intro).
  markTutorialSeen(): void {
    saveSystem.get().infestationTutorialSeen = true;
  },

  // M20 ad path stub. Returns true if it cleared anything.
  clearOneInfestation(): boolean {
    const save = saveSystem.get();
    const slot = save.infestation.machineIds.pop();
    if (slot === undefined) return false;
    bus.emit(Events.INFESTATION_CLEARED, slot);
    return true;
  },

  clearAllInfestation(): boolean {
    const save = saveSystem.get();
    if (save.infestation.machineIds.length === 0) return false;
    const cleared = [...save.infestation.machineIds];
    save.infestation.machineIds = [];
    for (const slot of cleared) bus.emit(Events.INFESTATION_CLEARED, slot);
    return true;
  },
};
