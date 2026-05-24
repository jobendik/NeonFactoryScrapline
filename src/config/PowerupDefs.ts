// Power-up definitions per blueprint §13. PowerupSystem spawns these on the
// raid field; activation applies the effect to RaidScene state (some are
// timed buffs, some are instant). Tutorial raid (M11/M12) spawns only Drone
// Swarm + Magnet Burst on the §5.4 script.
//
// TODO(post-launch): Golden Fever (2x scrap drop, 8s) and Turret Drop
// (auto-fire turret, 12s) from §13 are deferred - the systems they touch
// (drops, friendly-AI shooter) need their own scoping pass before they're
// production-ready.

export type PowerupKind =
  | 'magnetBurst'
  | 'signalNuke'
  | 'droneSwarm'
  | 'laserOverdrive'
  | 'timeBonus'
  | 'shieldBubble'
  | 'freezePulse'
  | 'goldenFever'
  | 'turretDrop';

export interface PowerupDef {
  id: PowerupKind;
  label: string;
  color: number;
  // Duration of the active effect in seconds. 0 means the effect fires once
  // on pickup (instants: Signal Nuke, +15s). Shield Bubble is a one-charge
  // persistent buff modeled as a single charge on the Player.
  durationSec: number;
  // Short label for the HUD pip (active-effects strip).
  iconText: string;
  // True for instant effects: no HUD pip shown, just a popup on pickup.
  instant: boolean;
}

export const PowerupDefs: Record<PowerupKind, PowerupDef> = {
  magnetBurst: {
    id: 'magnetBurst',
    label: 'MAGNET BURST',
    color: 0x22f6ff,
    durationSec: 5.5,
    iconText: 'MAG',
    instant: false,
  },
  signalNuke: {
    id: 'signalNuke',
    label: 'SIGNAL NUKE',
    color: 0xff416b,
    durationSec: 0,
    iconText: 'NUKE',
    instant: true,
  },
  droneSwarm: {
    id: 'droneSwarm',
    label: 'DRONE SWARM',
    color: 0xa76cff,
    durationSec: 9.0,
    iconText: 'CHAIN',
    instant: false,
  },
  laserOverdrive: {
    id: 'laserOverdrive',
    label: 'LASER OVERDRIVE',
    color: 0x72ff9f,
    durationSec: 6.0,
    iconText: 'LASER',
    instant: false,
  },
  timeBonus: {
    id: 'timeBonus',
    label: '+15 SECONDS',
    color: 0xffd75a,
    durationSec: 0,
    iconText: '+15s',
    instant: true,
  },
  shieldBubble: {
    id: 'shieldBubble',
    label: 'SHIELD BUBBLE',
    color: 0xffffff,
    // §13 lists duration as "until used" - we mark it instant since pickup
    // grants a charge on the Player, not a timed effect on the field. The HUD
    // pip renders separately based on Player.shieldCharges.
    durationSec: 0,
    iconText: 'SHLD',
    instant: true,
  },
  freezePulse: {
    id: 'freezePulse',
    label: 'FREEZE PULSE',
    color: 0xb3e0ff,
    durationSec: 4.0,
    iconText: 'FRZE',
    instant: false,
  },
  goldenFever: {
    id: 'goldenFever',
    label: 'GOLDEN FEVER',
    color: 0xffd75a,
    durationSec: 8.0,
    iconText: 'GOLD',
    instant: false,
  },
  turretDrop: {
    id: 'turretDrop',
    label: 'TURRET DROP',
    color: 0xff9c3d,
    durationSec: 12.0,
    iconText: 'TURR',
    instant: false,
  },
};

// Random-spawn pool for normal raids. Tutorial spawns are scripted by
// PowerupSystem.scheduleTutorialSpawns and ignore this list.
export const POWERUP_POOL: PowerupKind[] = [
  'magnetBurst',
  'signalNuke',
  'droneSwarm',
  'laserOverdrive',
  'timeBonus',
  'shieldBubble',
  'freezePulse',
  'goldenFever',
  'turretDrop',
];
