import Phaser from 'phaser';
import { SDKBridge } from '../platform/SDKBridge';
import { saveSystem } from '../platform/SaveSystem';
import { startAutoSave } from '../platform/AutoSave';
import { Economy } from '../systems/EconomySystem';
import { Strings } from '../config/Strings';
import { DailyQuestSystem } from '../systems/DailyQuestSystem';
import { AchievementSystem } from '../systems/AchievementSystem';
import { installMigrationTest } from '../platform/MigrationTest';
import { Analytics } from '../platform/Analytics';
import { MissionBoard } from '../systems/MissionBoard';
import { RetentionSystem } from '../systems/RetentionSystem';
import { FunnelTracker } from '../platform/FunnelTracker';
import { PlayerXpSystem } from '../systems/PlayerXpSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#000000');
    // M22 — drive the HTML preloader from BootScene. The init + load steps
    // are quick enough that a single update on each gate is plenty.
    BootScene.setHtmlPreloadProgress(0.1);

    // Defense-in-depth: wrap the entire boot sequence so a single failing
    // subsystem can't strand the player on a black screen. We always reach
    // the scene-launch step at the bottom, even if init or migration throws.
    try {
      // CrazyGames SDK v3 requires init() to complete before any other SDK
      // method (loadingStart/Stop, gameplay, ad, data) — calling earlier
      // throws "CrazySDK is not initialized yet". Await first.
      await SDKBridge.init();
      SDKBridge.loadingStart();
      BootScene.setHtmlPreloadProgress(0.4);
      await saveSystem.load();
      BootScene.setHtmlPreloadProgress(0.75);

      // Offline production per §8.6 - compute against the just-loaded save, bank
      // the result into the wallet immediately so FactoryScene's HUD shows the
      // boosted total. The "+N Scrap from offline factory" toast pulls from the
      // saveSystem's transient slot.
      const offlineScrap = Economy.computeOfflineScrap();
      if (offlineScrap > 0) {
        saveSystem.setPendingOfflineScrap(offlineScrap);
      }

      // M18 — DailyQuestSystem subscribes to gameplay events. Init once at
      // boot so quest progress accrues even on the first tutorial raid (the
      // claim panel itself is gated on tutorialDone + first real raid).
      DailyQuestSystem.init();
      // M23 — AchievementSystem subscribes to PLAYER_DAMAGED + PICKUP_COLLECTED
      // for transient per-raid flags; the per-end audit is driven explicitly
      // from RaidScene.finishRaid.
      AchievementSystem.init();
      // Suggestions audit — Mission Board listens to ENEMY_KILLED /
      // POWERUP_COLLECTED / extract-with-cores events to advance contract
      // progress in real time.
      MissionBoard.init();
      // Retention Phase 1 — PlayerXpSystem subscribes to ENEMY_KILLED and
      // POWERUP_COLLECTED to accumulate per-session XP. Must run after
      // saveSystem.load() since it reads accountXp from the save.
      PlayerXpSystem.init();
      // Retention pass — run the comeback/payday/streak detection here so
      // the banner queue is ready before the first FactoryScene render
      // consumes it. MUST run after MissionBoard.init so almostThere() can
      // see claimable contracts on the first frame.
      RetentionSystem.onBoot();
      // Playbook §16.1 first-session funnel — wire bus subscriptions so the
      // first kill/powerup/extract this session emits an analytics event.
      // Must run after saveSystem.load() because bootContext reads it.
      FunnelTracker.init();

      startAutoSave();
      // M24 — install the v0→vCURRENT migration test on window so QA can
      // verify the migration chain via `window.__migrationTest()` in dev
      // tools. Idempotent.
      installMigrationTest();
      SDKBridge.loadingStop();
      BootScene.setHtmlPreloadProgress(1);

      console.log(Strings.bootOk);
      Analytics.track('session_start', {
        tutorialDone: saveSystem.get().tutorialDone,
        raidsCompleted: saveSystem.get().raidsCompleted,
      });
    } catch (err) {
      // Boot subsystem failure — log loudly but continue. The scene launches
      // below still run so the player gets a working game even if save load
      // or analytics misbehaved.
      console.error('[BootScene] init failed, continuing with defaults:', err);
      BootScene.setHtmlPreloadProgress(1);
    }

    BootScene.hideHtmlPreload();

    // First-time boot lands directly in the FTUE tutorial raid (§5.1: "no
    // tutorial modal at start - the game opens directly inside a playable
    // tutorial raid"). Returning players boot into the Factory hub.
    this.scene.launch('HUDScene');
    if (!saveSystem.get().tutorialDone) {
      this.scene.start('RaidScene', { tutorial: true });
    } else {
      this.scene.start('FactoryScene');
    }
  }

  // M22 — HTML preloader bridge. The preload screen in index.html owns its
  // own DOM and is faded out + removed once boot completes.
  static setHtmlPreloadProgress(ratio: number): void {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('nfr-preload-bar-fill');
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  static hideHtmlPreload(): void {
    if (typeof document === 'undefined') return;
    const node = document.getElementById('nfr-preload');
    if (!node) return;
    node.classList.add('fading');
    // Match the CSS transition (0.4s) plus a small margin to be safe.
    setTimeout(() => {
      node.remove();
    }, 500);
  }
}
