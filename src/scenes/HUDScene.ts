import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { Strings } from '../config/Strings';
import { Economy } from '../systems/EconomySystem';
import { InfestationSystem } from '../systems/InfestationSystem';
import { MuteButton } from '../ui/MuteButton';
import { SettingsMenu } from '../ui/SettingsMenu';
import { AudioBus } from '../audio/AudioBus';
import { QualityManager } from '../systems/QualityManager';
import { bus, Events } from '../core/EventBus';
import { AchievementDefs, type AchievementId } from '../systems/AchievementSystem';
import { HUDOverlay } from '../ui/overlay/HUDOverlay';
import type { RaidScene } from './RaidScene';
import type { FactoryScene } from './FactoryScene';

// HUDScene runs as a persistent overlay above whatever gameplay scene is active.
// All static readouts (HP, timer, combo, greed, wallet, FPS, pips) live in an
// HTML+CSS overlay (HUDOverlay) — Phaser draws only the off-screen waypoint
// arrow (which needs camera-space coords) and the settings cog / mute button.

const HP_LOW_RATIO = 0.30;

export class HUDScene extends Phaser.Scene {
  private overlay!: HUDOverlay;
  // Phaser-only widgets that still need canvas-space coordinates / scene tweens.
  private waypoint!: Phaser.GameObjects.Graphics;
  private settingsMenu!: SettingsMenu;
  private perfOverlay: Phaser.GameObjects.Text | null = null;
  private perfOverlayOn = false;
  // FPS sampling for the rolling auto-detect window.
  private autoDetectAccum = 0;
  private lastFpsUpdate = 0;
  // HP flash bookkeeping — we still drive the visual via HUDOverlay's CSS
  // classes (.is-heal / .is-low) but track the timer ourselves so the heal
  // tint persists briefly after the HP delta.
  private lastHp = -1;
  private hpFlashKind: 'heal' | 'damage' | null = null;
  private hpFlashTimer = 0;
  // Deploy hint — small toast under the bottom-center when hovering the pad.
  private deployText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HUDScene', active: false });
  }

  create(): void {
    this.overlay = new HUDOverlay(this);

    // Off-screen waypoint arrow lives in canvas space because it depends on
    // RaidScene's camera scroll; keeping it as Phaser graphics is simpler.
    this.waypoint = this.add.graphics();
    this.waypoint.setScrollFactor(0).setDepth(2000).setVisible(false);

    // Bottom-center deploy hint (factory mode only). Cheap enough to keep
    // as Phaser text; HUDOverlay doesn't need a slot for it.
    this.deployText = this.add
      .text(this.scale.width / 2, this.scale.height - 28, '', {
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '15px',
        color: '#72ff9f',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

    // MuteButton + Settings cog stay as Phaser widgets — they pre-date the
    // HTML overlay and their hit zones already work cleanly.
    void new MuteButton(this);
    this.buildSettingsButton();
    this.settingsMenu = new SettingsMenu(this);

    // Audio unlock — Browsers refuse to start AudioContext until a user
    // gesture. We listen game-wide for the first pointer/key event and call
    // resume(); after that, sfx + music can play freely.
    const unlock = (): void => {
      AudioBus.resume();
      this.input.off('pointerdown', unlock);
      const keyboard = this.input.keyboard;
      if (keyboard) keyboard.off('keydown', unlock);
    };
    this.input.on('pointerdown', unlock);
    const keyboard = this.input.keyboard;
    if (keyboard) keyboard.on('keydown', unlock);

    // M21 — performance overlay toggle (backtick). Pure dev tool; left in
    // production but undocumented per §24.5.
    this.perfOverlay = this.add
      .text(this.scale.width - 12, this.scale.height - 12, '', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#88a0a8',
        backgroundColor: '#0a1014',
        padding: { x: 8, y: 6 },
        align: 'right',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(2400)
      .setVisible(false);
    if (keyboard) {
      keyboard.on('keydown-BACKTICK', () => this.togglePerfOverlay());
      keyboard.on('keydown-ESC', () => {
        if (this.settingsMenu.isOpen()) this.settingsMenu.close();
        else this.settingsMenu.open();
      });
    }

    // M23 — achievement unlock toast bridge.
    bus.on(Events.ACHIEVEMENT_UNLOCKED, (...args: unknown[]) => {
      const id = args[0] as AchievementId | undefined;
      if (!id) return;
      const def = AchievementDefs[id];
      if (!def) return;
      this.showAchievementToast(`${Strings.achievementUnlockedPrefix}${def.name}`);
    });
  }

  private showAchievementToast(text: string): void {
    const t = this.add
      .text(this.scale.width / 2, 100, text, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '17px',
        color: '#ffd75a',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#0a1014',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2250)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: 120,
      duration: 320,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(3800, () => {
      this.tweens.add({
        targets: t,
        alpha: 0,
        duration: 500,
        onComplete: () => t.destroy(),
      });
    });
  }

  private togglePerfOverlay(): void {
    this.perfOverlayOn = !this.perfOverlayOn;
    if (this.perfOverlay) this.perfOverlay.setVisible(this.perfOverlayOn);
  }

  private buildSettingsButton(): void {
    const size = 22;
    const padding = 12;
    const x = this.scale.width - padding - size - 8 - size;
    const y = padding;
    const g = this.add.graphics().setScrollFactor(0).setDepth(2300);
    g.setPosition(x + size / 2, y + size / 2);
    g.fillStyle(0x101820, 0.85);
    g.fillCircle(0, 0, size / 2);
    g.lineStyle(1.5, 0xffffff, 0.85);
    g.strokeCircle(0, 0, size / 2);
    g.lineStyle(2, 0xffffff, 0.95);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const inner = size / 2 - 5;
      const outer = size / 2 + 2;
      g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
    }
    g.lineStyle(1.5, 0xffffff, 0.85);
    g.strokeCircle(0, 0, 4);
    void g;

    const hit = this.add
      .zone(x, y, size, size)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2300)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (this.settingsMenu.isOpen()) this.settingsMenu.close();
      else this.settingsMenu.open();
    });
  }

  override update(time: number, deltaMs: number): void {
    const fps = this.game.loop.actualFps;
    if (time - this.lastFpsUpdate > Balance.ui.fpsUpdateMs) {
      this.lastFpsUpdate = time;
      this.overlay.setFps(fps);
    }

    const dt = Math.min(0.1, deltaMs / 1000);
    const toast = QualityManager.tick(dt, fps);
    if (toast) this.showAutoQualityToast(toast);

    if (this.perfOverlayOn && time - this.autoDetectAccum > 250) {
      this.autoDetectAccum = time;
      this.renderPerfOverlay(fps);
    }

    if (this.hpFlashTimer > 0) this.hpFlashTimer = Math.max(0, this.hpFlashTimer - dt);

    const raid = this.scene.get('RaidScene') as RaidScene | undefined;
    if (raid && raid.scene.isActive()) {
      this.renderRaid(raid);
      return;
    }

    const factory = this.scene.get('FactoryScene') as FactoryScene | undefined;
    if (factory && factory.scene.isActive()) {
      this.renderFactory(factory);
      return;
    }

    this.clearRaidHud();
  }

  private showAutoQualityToast(text: string): void {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height - 40, text, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#22f6ff',
        stroke: '#000000',
        strokeThickness: 3,
        backgroundColor: '#0a1014',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(2350)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: this.scale.height - 60,
      duration: 320,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(3500, () => {
      this.tweens.add({
        targets: t,
        alpha: 0,
        duration: 500,
        onComplete: () => t.destroy(),
      });
    });
  }

  private renderPerfOverlay(fps: number): void {
    if (!this.perfOverlay) return;
    const raid = this.scene.get('RaidScene') as RaidScene | undefined;
    let enemyCount = 0;
    let pickupCount = 0;
    let bulletCount = 0;
    let powerupCount = 0;
    if (raid && raid.scene.isActive()) {
      const counts = raid.getEntityCounts();
      enemyCount = counts.enemies;
      pickupCount = counts.pickups;
      bulletCount = counts.bullets;
      powerupCount = counts.powerups;
    }
    const preset = QualityManager.getPreset();
    const dpr = QualityManager.dprCap();
    const ft = fps > 0 ? (1000 / fps).toFixed(1) : '—';
    const lines = [
      `FPS:    ${Math.round(fps)}  (${ft} ms)`,
      `Enem:   ${enemyCount}`,
      `Pick:   ${pickupCount}`,
      `Bull:   ${bulletCount}`,
      `Pow:    ${powerupCount}`,
      `Qual:   ${preset.toUpperCase()}`,
      `DPRcap: ${dpr.toFixed(1)}`,
    ];
    this.perfOverlay.setText(lines.join('\n'));
  }

  private renderRaid(raid: RaidScene): void {
    this.overlay.hideSpm();
    this.deployText.setVisible(false);

    const hpInfo = raid.getPlayerHP();
    const ratio = hpInfo.max > 0 ? Math.max(0, hpInfo.hp / hpInfo.max) : 0;
    if (this.lastHp >= 0 && hpInfo.hp !== this.lastHp) {
      const delta = hpInfo.hp - this.lastHp;
      if (delta < 0) { this.hpFlashKind = 'damage'; this.hpFlashTimer = 0.22; }
      else if (delta > 0) { this.hpFlashKind = 'heal'; this.hpFlashTimer = 0.22; }
    }
    this.lastHp = hpInfo.hp;
    const flashHeal = this.hpFlashTimer > 0 && this.hpFlashKind === 'heal';
    this.overlay.setHp(hpInfo.hp, hpInfo.max, {
      flashHeal,
      lowFlash: ratio <= HP_LOW_RATIO,
    });

    const loot = raid.getRunLoot();
    this.overlay.setScrap(loot.scrap);
    this.overlay.setCores(loot.cores);

    this.overlay.setTimer(raid.getTimeRemaining());
    this.overlay.setCombo(raid.getCombo());

    const greed = raid.getGreedInfo();
    this.overlay.setGreed(greed.mult, greed.active);

    const ext = raid.getExtractionInfo();
    this.overlay.setExtract(ext.open, Strings.extractionOpened);

    const wp = raid.getWaypointTarget();
    if (wp) {
      const color = wp.kind === 'powerup' ? Balance.colors.reward : Balance.colors.extraction;
      this.drawWaypoint(raid, wp.x, wp.y, color);
    } else {
      this.waypoint.setVisible(false);
    }

    // Powerup pips
    const active = raid.getActivePowerups();
    const shieldCharges = raid.getShieldCharges();
    this.overlay.setPips(
      active.map(eff => ({
        iconText: eff.iconText,
        color: eff.color,
        remaining: eff.remaining,
        total: eff.total,
      })),
      shieldCharges,
    );

    // Cleanse counter
    const cleanse = raid.getCleanseInfo();
    if (cleanse.active) {
      const noun = cleanse.infestedRemaining === 1 ? 'machine' : 'machines';
      const txt = `${Strings.infestationCleansingPrefix}${cleanse.progressInWindow}${Strings.infestationCleansingMid}${cleanse.perMachine} — ${cleanse.infestedRemaining} ${noun}`;
      this.overlay.setCleanse(txt);
    } else {
      this.overlay.setCleanse(null);
    }
  }

  private renderFactory(factory: FactoryScene): void {
    this.overlay.hideTimer();
    this.overlay.setCombo(0);
    this.overlay.setGreed(0, false);
    this.overlay.setExtract(false);
    this.overlay.hideHp();
    this.waypoint.setVisible(false);
    this.overlay.setPips([], 0);
    this.overlay.setCleanse(null);
    void InfestationSystem;

    const wallet = Economy.getWallet();
    this.overlay.setScrap(wallet.scrap);
    this.overlay.setCores(wallet.cores);

    const spm = factory.getSpm();
    this.overlay.setSpm(spm);

    const hold = factory.getDeployHoldRatio();
    if (hold > 0) {
      this.deployText.setText(Strings.factoryDeployHint);
      this.deployText.setVisible(true);
    } else {
      this.deployText.setVisible(false);
    }
  }

  private clearRaidHud(): void {
    this.overlay.hideAllRaidElements();
    this.waypoint.setVisible(false);
    this.deployText.setVisible(false);
  }

  private drawWaypoint(raid: RaidScene, padX: number, padY: number, color: number = Balance.colors.extraction): void {
    const cam = raid.cameras.main;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const padScreenX = padX - cam.scrollX;
    const padScreenY = padY - cam.scrollY;

    const inset = 40;
    if (
      padScreenX >= inset &&
      padScreenX <= viewW - inset &&
      padScreenY >= inset &&
      padScreenY <= viewH - inset
    ) {
      this.waypoint.setVisible(false);
      return;
    }

    const cx = viewW / 2;
    const cy = viewH / 2;
    const dx = padScreenX - cx;
    const dy = padScreenY - cy;
    const angle = Math.atan2(dy, dx);
    const margin = Balance.extraction.waypointEdgeMargin;
    const halfW = viewW / 2 - margin;
    const halfH = viewH / 2 - margin;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const tx = Math.abs(cosA) > 1e-6 ? halfW / Math.abs(cosA) : Number.POSITIVE_INFINITY;
    const ty = Math.abs(sinA) > 1e-6 ? halfH / Math.abs(sinA) : Number.POSITIVE_INFINITY;
    const t = Math.min(tx, ty);
    const ax = cx + cosA * t;
    const ay = cy + sinA * t;

    const size = Balance.extraction.waypointSize;
    const localPts: Array<[number, number]> = [
      [size, 0],
      [-size * 0.6, -size * 0.7],
      [-size * 0.25, 0],
      [-size * 0.6, size * 0.7],
    ];
    this.waypoint.clear();
    this.waypoint.setVisible(true);
    this.waypoint.fillStyle(color, 1);
    this.waypoint.lineStyle(3, 0xffffff, 1);
    this.waypoint.beginPath();
    for (let i = 0; i < localPts.length; i++) {
      const pt = localPts[i];
      const lx = pt[0];
      const ly = pt[1];
      const sx = ax + lx * cosA - ly * sinA;
      const sy = ay + lx * sinA + ly * cosA;
      if (i === 0) this.waypoint.moveTo(sx, sy);
      else this.waypoint.lineTo(sx, sy);
    }
    this.waypoint.closePath();
    this.waypoint.fillPath();
    this.waypoint.strokePath();
  }
}
