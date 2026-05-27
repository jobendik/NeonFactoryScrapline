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
import { ToastManager } from '../ui/overlay/ToastManager';
import { AchievementCallout } from '../ui/overlay/AchievementCallout';
import { UIOverlay as nfrUIOverlay, el as nfrEl } from '../ui/overlay/UIOverlay';
import { PlayerXpSystem } from '../systems/PlayerXpSystem';
import type { RaidScene } from './RaidScene';
import type { FactoryScene } from './FactoryScene';

// HUDScene runs as a persistent overlay above whatever gameplay scene is active.
// All static readouts (HP, timer, combo, greed, wallet, FPS, pips) live in an
// HTML+CSS overlay (HUDOverlay) — Phaser draws only the off-screen waypoint
// arrow (which needs camera-space coords) and the settings cog / mute button.

const HP_LOW_RATIO = 0.30;

export class HUDScene extends Phaser.Scene {
  private overlay!: HUDOverlay;
  private toasts!: ToastManager;
  private achievementCallout!: AchievementCallout;
  // HUD chrome is fully HTML/SVG; the canvas only renders gameplay.
  private waypointEl: HTMLElement | null = null;
  private waypointPoly: SVGPolygonElement | null = null;
  private settingsMenu!: SettingsMenu;
  private perfOverlayEl: HTMLElement | null = null;
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
  // Bottom-center deploy hint (factory mode only). HTML overlay so it
  // matches the rest of the chrome's typography.
  private deployTextEl!: HTMLElement;

  constructor() {
    super({ key: 'HUDScene', active: false });
  }

  create(): void {
    this.overlay = new HUDOverlay(this);
    this.toasts = new ToastManager(this);
    this.achievementCallout = new AchievementCallout(this);

    // Off-screen waypoint arrow — SVG triangle inside an HTML wrapper that
    // we reposition + rotate each frame from RaidScene's camera scroll.
    this.buildWaypoint();

    // Bottom-center deploy hint (factory mode only).
    this.deployTextEl = nfrEl('div', 'nfr-hud-deploy-hint');
    this.deployTextEl.style.display = 'none';
    nfrUIOverlay.mountHud(this, this.deployTextEl);

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

    // M21 — performance overlay toggle (backtick). HTML overlay so it can
    // pick up the JetBrains Mono font without re-rasterizing the canvas.
    this.perfOverlayEl = nfrEl('div', 'nfr-hud-perf');
    this.perfOverlayEl.style.display = 'none';
    nfrUIOverlay.mountHud(this, this.perfOverlayEl);
    if (keyboard) {
      keyboard.on('keydown-BACKTICK', () => this.togglePerfOverlay());
      keyboard.on('keydown-ESC', () => {
        if (this.settingsMenu.isOpen()) this.settingsMenu.close();
        else this.settingsMenu.open();
      });
    }

    // M23 — achievement unlock callout bridge.
    bus.on(Events.ACHIEVEMENT_UNLOCKED, (...args: unknown[]) => {
      const id = args[0] as AchievementId | undefined;
      if (!id) return;
      const def = AchievementDefs[id];
      if (!def) return;
      this.achievementCallout.show(def.name);
    });
  }

  private togglePerfOverlay(): void {
    this.perfOverlayOn = !this.perfOverlayOn;
    if (this.perfOverlayEl) this.perfOverlayEl.style.display = this.perfOverlayOn ? 'block' : 'none';
  }

  private buildSettingsButton(): void {
    // HTML+SVG gear button mounted in top-right (next to the mute button).
    // The SVG keeps the previous radial-cog silhouette but renders crisply
    // at any DPR and inherits the design-system colors.
    const btn = nfrEl('button', 'nfr-hud-iconbtn nfr-hud-settings');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Settings');
    btn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9" fill="#101820" fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85"/>
        <g stroke="#ffffff" stroke-width="2" stroke-opacity="0.95" stroke-linecap="round">
          <line x1="11" y1="2.5" x2="11" y2="5.5"/>
          <line x1="11" y1="16.5" x2="11" y2="19.5"/>
          <line x1="2.5" y1="11" x2="5.5" y2="11"/>
          <line x1="16.5" y1="11" x2="19.5" y2="11"/>
          <line x1="5" y1="5" x2="7" y2="7"/>
          <line x1="15" y1="15" x2="17" y2="17"/>
          <line x1="17" y1="5" x2="15" y2="7"/>
          <line x1="7" y1="15" x2="5" y2="17"/>
        </g>
        <circle cx="11" cy="11" r="4" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85"/>
      </svg>
    `;
    btn.addEventListener('click', () => {
      if (this.settingsMenu.isOpen()) this.settingsMenu.close();
      else this.settingsMenu.open();
    });
    nfrUIOverlay.mountHud(this, btn);
  }

  // Builds the off-screen waypoint arrow as an SVG element wrapped in an
  // absolutely-positioned HTML node. drawWaypoint() repositions + rotates
  // this node each frame; no Phaser graphics involved.
  private buildWaypoint(): void {
    const wrap = nfrEl('div', 'nfr-hud-waypoint');
    wrap.style.display = 'none';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '-20 -16 40 32');
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '32');
    const poly = document.createElementNS(svgNS, 'polygon');
    // Same triangle silhouette as the old Phaser version: tip at +x,
    // notched butt at the rear.
    poly.setAttribute('points', '16,0 -10,-11 -4,0 -10,11');
    poly.setAttribute('fill', '#22f6ff');
    poly.setAttribute('stroke', '#ffffff');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);
    wrap.appendChild(svg);
    nfrUIOverlay.mountHud(this, wrap);
    this.waypointEl = wrap;
    this.waypointPoly = poly;
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
    this.toasts.show({ text, variant: 'info', duration: 3500 });
  }

  private renderPerfOverlay(fps: number): void {
    if (!this.perfOverlayEl) return;
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
    this.perfOverlayEl.textContent = lines.join('\n');
  }

  private renderRaid(raid: RaidScene): void {
    this.overlay.hideSpm();
    if (this.deployTextEl) this.deployTextEl.style.display = 'none';

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

    // Retention Phase 1 — live XP bar.
    const xpProg = PlayerXpSystem.getProgress();
    this.overlay.updateXp(xpProg.xpIntoCurrentLevel, xpProg.xpForCurrentLevel, xpProg.level);

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
    } else if (this.waypointEl) {
      this.waypointEl.style.display = 'none';
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
    if (this.waypointEl) this.waypointEl.style.display = 'none';
    this.overlay.setPips([], 0);
    this.overlay.setCleanse(null);
    void InfestationSystem;

    const wallet = Economy.getWallet();
    this.overlay.setScrap(wallet.scrap);
    this.overlay.setCores(wallet.cores);

    const spm = factory.getSpm();
    this.overlay.setSpm(spm);

    const hold = factory.getDeployHoldRatio();
    if (this.deployTextEl) {
      if (hold > 0) {
        this.deployTextEl.textContent = Strings.factoryDeployHint;
        this.deployTextEl.style.display = 'block';
      } else {
        this.deployTextEl.style.display = 'none';
      }
    }
  }

  private clearRaidHud(): void {
    this.overlay.hideAllRaidElements();
    if (this.waypointEl) this.waypointEl.style.display = 'none';
    if (this.deployTextEl) this.deployTextEl.style.display = 'none';
  }

  private drawWaypoint(raid: RaidScene, padX: number, padY: number, color: number = Balance.colors.extraction): void {
    if (!this.waypointEl || !this.waypointPoly) return;
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
      this.waypointEl.style.display = 'none';
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

    // Convert the (#RRGGBB) color int to a CSS hex string for the SVG fill.
    const cssColor = '#' + color.toString(16).padStart(6, '0');
    this.waypointPoly.setAttribute('fill', cssColor);

    // Project the design-space arrow position into stage CSS pixels by
    // applying the canvas display scale. UIOverlay already aligns the stage
    // with the canvas, so the same conversion used by world-pin works here.
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const cssScale = viewW > 0 ? canvasRect.width / viewW : 1;
    const cssX = ax * cssScale;
    const cssY = ay * cssScale;
    const deg = (angle * 180) / Math.PI;
    this.waypointEl.style.display = 'block';
    this.waypointEl.style.transform = `translate(calc(${cssX.toFixed(1)}px - 50%), calc(${cssY.toFixed(1)}px - 50%)) rotate(${deg.toFixed(1)}deg)`;
  }
}
