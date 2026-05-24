import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { RaidScene } from './scenes/RaidScene';
import { HUDScene } from './scenes/HUDScene';
import { SummaryScene } from './scenes/SummaryScene';
import { FactoryScene } from './scenes/FactoryScene';
import { DraftScene } from './scenes/DraftScene';
import { ModalScene } from './scenes/ModalScene';
import { Balance } from './config/Balance';
import { UIOverlay } from './ui/overlay/UIOverlay';
import { Analytics } from './platform/Analytics';

// CrazyGames SDK v3 in 'disabled' environments (localhost / un-whitelisted
// domains) emits unhandled errors from its own microtasks and event handlers
// — both as promise rejections AND as synchronous throws inside SDK-internal
// callbacks (where our try/catch can't reach). The bridge has already
// fallen back to stubs by the time any of these fire, so the errors are
// harmless. Swallow only SDK-disabled errors; everything else is routed to
// analytics per playbook §10.7 so post-launch crash-rate is visible.
if (typeof window !== 'undefined') {
  const isSdkDisabledError = (val: unknown): boolean => {
    if (!val || typeof val !== 'object') return false;
    const obj = val as { code?: unknown; message?: unknown };
    if (obj.code === 'sdkDisabled') return true;
    if (typeof obj.message === 'string' && /CrazySDK is disabled/i.test(obj.message)) return true;
    return false;
  };
  window.addEventListener('unhandledrejection', event => {
    if (isSdkDisabledError(event.reason)) {
      event.preventDefault();
      return;
    }
    Analytics.trackError('unhandledrejection', event.reason);
  });
  window.addEventListener(
    'error',
    event => {
      // Sync throws from inside SDK iframe-postMessage handlers / timers.
      // event.error is the thrown value (the SDK throws plain objects, not
      // Error instances, hence the "[object Object]" display).
      if (isSdkDisabledError(event.error)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      Analytics.trackError('window', event.error ?? event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    },
    true,
  );
}
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: Balance.rendering.backgroundColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: Balance.rendering.width,
    height: Balance.rendering.height,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
    powerPreference: 'high-performance',
  },
  scene: [BootScene, RaidScene, FactoryScene, HUDScene, SummaryScene, DraftScene, ModalScene],
};

const game = new Phaser.Game(config);

// Install the HTML+CSS overlay system on top of the Phaser canvas. All menus,
// panels, cards, and HUD chrome are HTML-driven from here on — Phaser keeps
// gameplay rendering only. See src/ui/overlay/UIOverlay.ts.
UIOverlay.install(game);
