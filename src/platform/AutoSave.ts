import { saveSystem } from './SaveSystem';
import { bus, Events } from '../core/EventBus';

// Auto-save per M10 gate: every 10 seconds, plus on successful extract /
// raid failed / raid collapsed (all signaled by RAID_ENDED), plus on every
// upgrade purchase. Scene-transition saves are handled by the individual
// scenes themselves (they call saveSystem.persist in shutdown) so each
// trigger sits next to the action it brackets.

const AUTOSAVE_MS = 10_000;

let intervalId: number | null = null;

const persistNow = (): void => {
  void saveSystem.persist();
};

export function startAutoSave(): void {
  if (intervalId !== null) return;
  intervalId = window.setInterval(persistNow, AUTOSAVE_MS);
  bus.on(Events.UPGRADE_PURCHASED, persistNow);
  bus.on(Events.RAID_ENDED, persistNow);
}

export function stopAutoSave(): void {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  bus.off(Events.UPGRADE_PURCHASED, persistNow);
  bus.off(Events.RAID_ENDED, persistNow);
}
