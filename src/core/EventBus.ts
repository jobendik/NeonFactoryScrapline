// Cross-system event bus. Wraps Phaser's EventEmitter so we can swap implementation later
// without touching every callsite, and so non-scene code (systems, save) doesn't need a scene reference.

import Phaser from 'phaser';

export type EventHandler = (...args: unknown[]) => void;

export class EventBus {
  private emitter = new Phaser.Events.EventEmitter();

  on(event: string, fn: EventHandler, context?: object): void {
    this.emitter.on(event, fn, context);
  }

  once(event: string, fn: EventHandler, context?: object): void {
    this.emitter.once(event, fn, context);
  }

  off(event: string, fn?: EventHandler, context?: object): void {
    this.emitter.off(event, fn, context);
  }

  emit(event: string, ...args: unknown[]): void {
    this.emitter.emit(event, ...args);
  }

  removeAllListeners(event?: string): void {
    this.emitter.removeAllListeners(event);
  }

  destroy(): void {
    this.emitter.destroy();
  }
}

// Single shared instance. Systems and scenes both import this.
export const bus = new EventBus();

// Canonical event names. Adding new strings here (instead of inline) keeps typos out of subscriber logic.
export const Events = {
  ENEMY_KILLED: 'enemy:killed',
  PICKUP_COLLECTED: 'pickup:collected',
  POWERUP_COLLECTED: 'powerup:collected',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_DIED: 'player:died',
  EXTRACTION_OPENED: 'extraction:opened',
  EXTRACTION_COMPLETE: 'extraction:complete',
  RAID_STARTED: 'raid:started',
  RAID_ENDED: 'raid:ended',
  GREED_CHANGED: 'greed:changed',
  COMBO_CHANGED: 'combo:changed',
  DRAFT_OFFERED: 'draft:offered',
  DRAFT_PICKED: 'draft:picked',
  UPGRADE_PURCHASED: 'upgrade:purchased',
  INFESTATION_ADDED: 'infestation:added',
  INFESTATION_CLEARED: 'infestation:cleared',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  SAVE_LOADED: 'save:loaded',
  SAVE_PERSISTED: 'save:persisted',
  OPERATOR_SELECTED: 'operator:selected',
  OPERATOR_UNLOCKED: 'operator:unlocked',
  QUALITY_CHANGED: 'quality:changed',
  // Suggestions audit — emitted by Player.dash() so cards (Nova Dash) and
  // analytics can react without polling.
  PLAYER_DASHED: 'player:dashed',
  // Retention Phase 1 — account XP / level events.
  ACCOUNT_LEVEL_UP: 'account:levelup',
  XP_GRANTED: 'xp:granted',
  // Factory workers — emitted each time a hauler deposits a scrap load.
  WORKER_DELIVERED: 'worker:delivered',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
