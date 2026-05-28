// WelcomeBack — boot-time UI ceremony for the garden hub. Runs once per
// FactoryScene.create when there is something worth celebrating: offline
// stardust accrual, a comeback bonus, a DOUBLE BLOOM roll, a live streak,
// or a lost streak that needs acknowledging.
//
// Design goal (CrazyGames retention pass): turn the silent garden boot
// into a 3-4 second "reward arrival" sequence so the first thing the
// returning player sees is the game noticing them. Banners are sequenced
// not stacked — each one slides in, holds, slides out — so the player
// processes them in order rather than triaging a wall of text.

import Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { RetentionSystem, type BootBanner } from '../systems/RetentionSystem';

interface WelcomeBackOptions {
  offlineScrap: number;
  banners: BootBanner[];
}

const TOAST_TOP_Y = 70;
const TOAST_GAP_MS = 260; // delay between sequential toasts
const TOAST_HOLD_MS = 3600;
const TOAST_FADE_MS = 320;

export const WelcomeBack = {
  // Renders the welcome-back sequence on the given scene. Returns the
  // number of toasts that were queued so callers can decide whether to
  // suppress conflicting UI nudges (infestation toast, daily-quest toast
  // etc.) during the welcome window.
  show(scene: Phaser.Scene, opts: WelcomeBackOptions): number {
    const queue: Array<() => void> = [];

    // 1) "WELCOME BACK + Xk Scrap" — only when there was meaningful
    //    offline accrual. Without anything to show, skip the line so a
    //    quick refresh doesn't spam the player.
    if (opts.offlineScrap > 0) {
      queue.push(() => renderWelcomeOffline(scene, opts.offlineScrap));
    }

    // 2) Each retention banner — comeback first (rarest, biggest payoff),
    //    payday second, streak warnings last.
    const ordered = [...opts.banners].sort((a, b) => bannerOrder(a.kind) - bannerOrder(b.kind));
    for (const banner of ordered) {
      queue.push(() => renderBanner(scene, banner));
    }

    // 3) Persistent streak indicator (separate from the banners — it's a
    //    pinned chip, not a toast). Always rendered when streak > 0 so
    //    the player has constant visibility of their fire.
    const streakDay = RetentionSystem.currentStreakDay();
    if (streakDay > 0) {
      renderStreakChip(scene, streakDay);
    }

    // 4) Persistent DOUBLE PAYDAY badge (separate from the boot banner).
    if (RetentionSystem.isPaydayActive()) {
      renderPaydayBadge(scene, RetentionSystem.paydayRaidsRemaining());
    }

    // Run the queue with staggered timing.
    let delay = 240;
    for (const fn of queue) {
      scene.time.delayedCall(delay, fn);
      delay += TOAST_HOLD_MS + TOAST_GAP_MS;
    }

    return queue.length;
  },
};

function bannerOrder(kind: BootBanner['kind']): number {
  switch (kind) {
    case 'comeback':
      return 0;
    case 'payday':
      return 1;
    case 'streakLost':
      return 2;
    case 'streakWarn':
      return 3;
  }
}

// Count-up animator. Reads the integer target and tweens a counter object
// so the displayed text increments smoothly. Cheaper than tween-on-text
// because we only allocate one tween + one update closure.
function renderWelcomeOffline(scene: Phaser.Scene, amount: number): void {
  const w = scene.scale.width;
  const text = scene.add
    .text(w / 2, TOAST_TOP_Y, `${Strings.welcomeBackTitle}  +0`, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#7cc9ff',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#0a1014',
      padding: { x: 18, y: 10 },
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(2300)
    .setAlpha(0);

  scene.tweens.add({
    targets: text,
    alpha: 1,
    y: TOAST_TOP_Y + 12,
    duration: 320,
    ease: 'Cubic.easeOut',
  });

  const counter = { v: 0 };
  scene.tweens.add({
    targets: counter,
    v: amount,
    duration: Math.min(2600, 400 + Math.sqrt(amount) * 50),
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const shown = Math.floor(counter.v);
      text.setText(
        `${Strings.welcomeBackTitle}  ${Strings.welcomeBackOfflinePrefix}${shown}${Strings.welcomeBackOfflineSuffix}`,
      );
    },
    onComplete: () => {
      text.setText(
        `${Strings.welcomeBackTitle}  ${Strings.welcomeBackOfflinePrefix}${amount}${Strings.welcomeBackOfflineSuffix}`,
      );
    },
  });

  scene.time.delayedCall(TOAST_HOLD_MS, () => {
    scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: TOAST_FADE_MS,
      onComplete: () => text.destroy(),
    });
  });
}

function renderBanner(scene: Phaser.Scene, banner: BootBanner): void {
  const { title, sub, color, bg, border } = bannerCopy(banner.kind);
  const w = scene.scale.width;
  const container = scene.add.container(w / 2, TOAST_TOP_Y).setDepth(2310).setScrollFactor(0);

  const padding = 18;
  const titleText = scene.add
    .text(0, 0, title, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0);

  const subText = scene.add
    .text(0, 30, sub, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cfe9f0',
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5, 0);

  const innerW = Math.max(titleText.width, subText.width) + padding * 2;
  const innerH = titleText.height + subText.height + padding * 2 - 8;
  const bgRect = scene.add
    .rectangle(0, innerH / 2, innerW, innerH, bg, 0.96)
    .setStrokeStyle(2, border, 0.95);

  container.add(bgRect);
  container.add(titleText);
  container.add(subText);
  container.setAlpha(0);
  container.setScale(0.9);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    y: TOAST_TOP_Y + 16,
    duration: 360,
    ease: 'Back.easeOut',
  });

  // Banner-only flourish: a quick screen-glow tint pulse for the rarest
  // banners so they feel like events rather than text. Comeback +
  // payday only — streak warnings stay quiet.
  if (banner.kind === 'comeback' || banner.kind === 'payday') {
    const flash = scene.add
      .rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, border, 0.18)
      .setScrollFactor(0)
      .setDepth(2305);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  scene.time.delayedCall(TOAST_HOLD_MS + 200, () => {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: TOAST_TOP_Y,
      duration: TOAST_FADE_MS,
      onComplete: () => container.destroy(),
    });
  });
}

function bannerCopy(kind: BootBanner['kind']): {
  title: string;
  sub: string;
  color: string;
  bg: number;
  border: number;
} {
  switch (kind) {
    case 'comeback':
      return {
        title: Strings.comebackTitle,
        sub: Strings.comebackSub,
        color: '#ffd75a',
        bg: 0x12100a,
        border: 0xffd75a,
      };
    case 'payday':
      return {
        title: Strings.paydayTitle,
        sub: Strings.paydaySub,
        color: '#72ff9f',
        bg: 0x07140d,
        border: 0x72ff9f,
      };
    case 'streakLost':
      return {
        title: Strings.streakBrokenTitle,
        sub: Strings.streakBrokenSub,
        color: '#ff416b',
        bg: 0x1a0a14,
        border: 0xff416b,
      };
    case 'streakWarn':
      return {
        title: Strings.streakWarnSkipUsed,
        sub: Strings.streakWarnLastChance,
        color: '#ffd75a',
        bg: 0x14120a,
        border: 0xffd75a,
      };
  }
}

// Pinned streak chip — top-left, persistent through the factory visit so
// players see their fire constantly. The day count drives the chip color
// (deeper warm orange as the streak climbs) so longer runs feel earned.
function renderStreakChip(scene: Phaser.Scene, day: number): void {
  const x = 18;
  const y = 130;
  // Color ramp: 1-3 days white-warm, 4-6 amber, 7+ orange-red.
  const color = day >= 7 ? '#ff7a3a' : day >= 4 ? '#ffd75a' : '#ffe6c8';
  const bg = scene.add
    .rectangle(x, y, 1, 1, 0x12100a, 0.9)
    .setOrigin(0, 0)
    .setStrokeStyle(2, day >= 7 ? 0xff7a3a : 0xffd75a, 0.9)
    .setScrollFactor(0)
    .setDepth(2200);

  const label = scene.add
    .text(x + 10, y + 8, `${Strings.streakFire} ${Strings.streakDayPrefix}${day}${Strings.streakDaySuffix}`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(2201);

  bg.setSize(label.width + 20, label.height + 16);

  // Subtle pulse on longer streaks to draw the eye when the player
  // arrives. Stops after 4 cycles so it doesn't distract once the
  // session settles in.
  if (day >= 4) {
    scene.tweens.add({
      targets: [bg, label],
      scale: { from: 1, to: 1.06 },
      duration: 520,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });
  }
}

function renderPaydayBadge(scene: Phaser.Scene, raidsLeft: number): void {
  const x = 18;
  const y = 168;
  const label = scene.add
    .text(
      x + 10,
      y + 8,
      `${Strings.paydayBadgePrefix}2${Strings.paydayBadgeMid}${raidsLeft}${Strings.paydayBadgeSuffix}`,
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#72ff9f',
        stroke: '#000000',
        strokeThickness: 3,
      },
    )
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(2201);

  const bg = scene.add
    .rectangle(x, y, label.width + 20, label.height + 16, 0x07140d, 0.92)
    .setOrigin(0, 0)
    .setStrokeStyle(2, 0x72ff9f, 0.9)
    .setScrollFactor(0)
    .setDepth(2200);

  scene.tweens.add({
    targets: [bg, label],
    alpha: { from: 1, to: 0.65 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
