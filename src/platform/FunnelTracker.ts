// First-session funnel events per CrazyGames playbook §16.1.
//
// CrazyGames' platform metrics tell you conversion and average playtime,
// but not WHERE in the first session a player dropped off. The funnel
// here fills that gap: each event fires at most once per page load, with
// `elapsedSec` measured from session_start so the dashboard can answer
// "median time from boot to first kill" etc.
//
// Events emitted (all session-scoped, idempotent):
//   - first_input    : player issued first movement / dash
//   - first_kill     : first enemy died this session
//   - first_powerup  : first power-up collected this session
//   - first_extract  : first successful extraction this session
//
// All events carry the boot context (tutorialDone, raidsCompleted) so a
// returning player's "first kill" is distinguishable from a new player's
// "first kill". The flags live in module scope — a refresh resets them,
// which is exactly the granularity CrazyGames analytics expects.

import { Analytics } from './Analytics';
import { bus, Events } from '../core/EventBus';
import { saveSystem } from './SaveSystem';

const fired = {
  first_input: false,
  first_kill: false,
  first_powerup: false,
  first_extract: false,
};

let sessionStartMs = 0;
let initialized = false;

function elapsedSec(): number {
  if (sessionStartMs === 0) return 0;
  return Math.round((Date.now() - sessionStartMs) / 1000);
}

function bootContext(): Record<string, unknown> {
  const save = saveSystem.get();
  return {
    elapsedSec: elapsedSec(),
    tutorialDone: save.tutorialDone,
    raidsCompleted: save.raidsCompleted,
  };
}

export const FunnelTracker = {
  // Wire bus subscriptions once. Idempotent — calling twice does not
  // double-fire. BootScene invokes this after save load so bootContext()
  // reads the migrated/loaded state.
  init(): void {
    if (initialized) return;
    initialized = true;
    sessionStartMs = Date.now();

    bus.on(Events.ENEMY_KILLED, () => {
      if (fired.first_kill) return;
      fired.first_kill = true;
      Analytics.track('first_kill', bootContext());
    });

    bus.on(Events.POWERUP_COLLECTED, () => {
      if (fired.first_powerup) return;
      fired.first_powerup = true;
      Analytics.track('first_powerup', bootContext());
    });

    bus.on(Events.EXTRACTION_COMPLETE, () => {
      if (fired.first_extract) return;
      fired.first_extract = true;
      Analytics.track('first_extract', bootContext());
    });
  },

  // Called by RaidScene each frame with the current input frame. Cheap
  // boolean check — once first_input has fired the call short-circuits.
  noteInput(hasMove: boolean, hasDash: boolean): void {
    if (fired.first_input) return;
    if (!hasMove && !hasDash) return;
    fired.first_input = true;
    Analytics.track('first_input', { ...bootContext(), inputKind: hasDash ? 'dash' : 'move' });
  },
};
