import Phaser from 'phaser';
import { AudioBus, type AudioVolumes } from '../audio/AudioBus';
import { QualityManager } from '../systems/QualityManager';
import { saveSystem, type QualityPreset } from '../platform/SaveSystem';
import { Strings } from '../config/Strings';
import { CosmeticDefs, cosmeticsOfKind, type CosmeticKind } from '../config/CosmeticDefs';
import { CosmeticSystem } from '../systems/CosmeticSystem';
import { AchievementSystem, AchievementDefs, ACHIEVEMENT_ORDER } from '../systems/AchievementSystem';

// SettingsMenu scaffold per blueprint §21.6. M13 ships only audio controls:
// Master / Music / SFX sliders. Quality, key bindings, and the reset-save
// button arrive in later milestones - the class is structured so those
// rows can be added without changing the open/close lifecycle.
//
// Usage: `new SettingsMenu(scene).open()`. The menu is a modal overlay
// drawn at depth 3000+ so it sits above the HUD. close() unwires inputs
// and destroys all created game objects.

interface SliderHandle {
  container: Phaser.GameObjects.Container;
  knob: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  valueText: Phaser.GameObjects.Text;
  channel: keyof AudioVolumes;
  trackX: number;
  trackW: number;
}

const PANEL_W = 420;
const PANEL_H = 680;
const ROW_Y_GAP = 56;
const SLIDER_W = 240;
const SLIDER_H = 14;
const KNOB_W = 14;

export class SettingsMenu {
  private scene: Phaser.Scene;
  private open_ = false;
  private root: Phaser.GameObjects.Container | null = null;
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private sliders: SliderHandle[] = [];
  private dragHandle: SliderHandle | null = null;
  // M21 — quality preset row + auto-detect toggle. Built once per open();
  // mutating them rebuilds the row to reflect the new active state.
  private qualityRowObjects: Phaser.GameObjects.GameObject[] = [];
  // M23 — sub-modals (cosmetics, achievements) launched from the settings
  // panel. Each is a self-contained overlay; only one at a time.
  private subModalRoot: Phaser.GameObjects.Container | null = null;
  private subModalBackdrop: Phaser.GameObjects.Rectangle | null = null;
  // Playbook §12.5 — scenes we explicitly paused on open() so close() can
  // resume only those. We do NOT pause scenes that were already paused
  // (e.g. raid paused for a draft modal) so the existing flow's resume
  // call still owns lifecycle.
  private pausedSceneKeys: string[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  isOpen(): boolean {
    return this.open_;
  }

  open(): void {
    if (this.open_) return;
    this.open_ = true;
    this.pauseUnderlyingGameplay();
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;

    this.backdrop = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.65)
      .setOrigin(0, 0)
      .setDepth(2900)
      .setInteractive();
    // Clicking the dim backdrop dismisses the menu.
    this.backdrop.on('pointerdown', () => this.close());

    this.root = scene.add.container(w / 2 - PANEL_W / 2, h / 2 - PANEL_H / 2);
    this.root.setDepth(3000);

    const panel = scene.add
      .rectangle(0, 0, PANEL_W, PANEL_H, 0x101820, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x22f6ff, 0.85);
    this.root.add(panel);

    const title = scene.add
      .text(PANEL_W / 2, 20, 'SETTINGS', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#22f6ff',
      })
      .setOrigin(0.5, 0);
    this.root.add(title);

    const volumes = AudioBus.getVolumes();
    const channels: Array<{ label: string; key: keyof AudioVolumes }> = [
      { label: 'MASTER', key: 'master' },
      { label: 'MUSIC', key: 'music' },
      { label: 'SFX', key: 'sfx' },
    ];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const y = 80 + i * ROW_Y_GAP;
      this.sliders.push(this.buildSlider(ch.label, ch.key, volumes[ch.key], y));
    }

    // M21 — quality preset row + auto-detect toggle below the audio sliders.
    this.buildQualityRow(80 + channels.length * ROW_Y_GAP + 10);

    // Accessibility toggles sit under the quality row.
    this.buildAccessibilityRow(80 + channels.length * ROW_Y_GAP + 140);

    // M23 — cosmetics + achievements menu buttons. Both open sub-modals;
    // the SettingsMenu stays beneath them so closing the sub-modal returns
    // the player here.
    const subY = 80 + channels.length * ROW_Y_GAP + 210;
    this.buildSubMenuButton(PANEL_W / 4, subY, Strings.cosmeticsMenuButton, () =>
      this.openCosmeticsModal(),
    );
    this.buildSubMenuButton((PANEL_W * 3) / 4, subY, Strings.achievementsMenuButton, () =>
      this.openAchievementsModal(),
    );

    // M24 — Controls help / Credits / Reset Save. Three small buttons
    // on a single row below the cosmetics + achievements pair.
    const utilY = subY + 50;
    this.buildSubMenuButton(PANEL_W / 6, utilY, 'CONTROLS', () => this.openControlsModal());
    this.buildSubMenuButton(PANEL_W / 2, utilY, 'CREDITS', () => this.openCreditsModal());
    this.buildSubMenuButton((PANEL_W * 5) / 6, utilY, 'RESET SAVE', () => this.openResetSaveModal());

    // Playbook §7.5 — visible LEAVE RAID button so the player never has to
    // close the tab to exit a run. Only surfaced when a RaidScene is
    // actually active (the menu also opens from FactoryScene, where the
    // button has no meaning). Danger-styled in red so it can't be
    // mistaken for a navigation action.
    if (this.isRaidActive()) {
      this.buildLeaveRaidButton(PANEL_W / 2, utilY + 48);
    }

    const closeBtn = scene.add
      .rectangle(PANEL_W / 2, PANEL_H - 44, 140, 36, 0x22f6ff, 1)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, 0xffffff, 0.85)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.root.add(closeBtn);
    const closeText = scene.add
      .text(PANEL_W / 2, PANEL_H - 44, 'CLOSE', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#000000',
      })
      .setOrigin(0.5);
    this.root.add(closeText);

    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.dragHandle = null;
    this.sliders = [];
    this.qualityRowObjects = [];
    this.accessibilityRowObjects = [];
    this.closeSubModal();
    this.root?.destroy(true);
    this.root = null;
    this.backdrop?.destroy();
    this.backdrop = null;
    this.resumeUnderlyingGameplay();
  }

  // Playbook §12.5 — pause gameplay scenes that are actively running when
  // the menu opens, so a player checking controls or audio doesn't take
  // damage while reading. Scenes that are already paused (raid waiting on
  // a draft modal, etc.) are skipped — their existing resume path owns
  // lifecycle and we shouldn't compete.
  private pauseUnderlyingGameplay(): void {
    const mgr = this.scene.scene;
    for (const key of ['RaidScene', 'FactoryScene']) {
      const target = mgr.get(key);
      if (target && target.scene.isActive()) {
        target.scene.pause();
        this.pausedSceneKeys.push(key);
      }
    }
  }

  private resumeUnderlyingGameplay(): void {
    if (this.pausedSceneKeys.length === 0) return;
    const mgr = this.scene.scene;
    for (const key of this.pausedSceneKeys) {
      const target = mgr.get(key);
      // Only resume if the scene is still paused — guard against a draft
      // / ad flow having taken ownership of pause/resume while we were
      // open. resume() on an active scene is a no-op anyway, but the
      // explicit check makes the intent obvious.
      if (target && target.scene.isPaused()) {
        target.scene.resume();
      }
    }
    this.pausedSceneKeys = [];
  }

  private buildSubMenuButton(x: number, y: number, label: string, onClick: () => void): void {
    if (!this.root) return;
    const scene = this.scene;
    const bw = 150;
    const bh = 36;
    const bg = scene.add
      .rectangle(x, y, bw, bh, 0x22f6ff, 0.18)
      .setStrokeStyle(2, 0x22f6ff, 0.85)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    const labelText = scene.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#22f6ff',
      })
      .setOrigin(0.5);
    this.root.add(bg);
    this.root.add(labelText);
  }

  // True iff a RaidScene is the active gameplay layer. The menu pauses
  // gameplay on open(), so by the time we render the LEAVE RAID button
  // the underlying raid will already be paused — but only if WE paused
  // it. A raid paused by a draft or ad modal is not ours and would
  // strand the forfeit's delayedCall, so we still exclude that case.
  private isRaidActive(): boolean {
    const raid = this.scene.scene.get('RaidScene');
    if (!raid) return false;
    if (raid.scene.isActive()) return true;
    return this.pausedSceneKeys.includes('RaidScene');
  }

  // Red-tinted danger button so it can't be confused with a navigation
  // action. Confirmation modal opens on click; only the modal's LEAVE
  // button forfeits.
  private buildLeaveRaidButton(x: number, y: number): void {
    if (!this.root) return;
    const scene = this.scene;
    const bw = 200;
    const bh = 36;
    const dangerColor = 0xff416b;
    const bg = scene.add
      .rectangle(x, y, bw, bh, dangerColor, 0.18)
      .setStrokeStyle(2, dangerColor, 0.85)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(dangerColor, 0.3));
    bg.on('pointerout', () => bg.setFillStyle(dangerColor, 0.18));
    bg.on('pointerdown', () => this.openLeaveRaidConfirm());
    const labelText = scene.add
      .text(x, y, Strings.leaveRaidButton, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ff8aa6',
      })
      .setOrigin(0.5);
    this.root.add(bg);
    this.root.add(labelText);
  }

  // Lightweight confirmation modal — single backdrop + panel, no need for
  // a full sub-modal harness. Cancels safely if the SettingsMenu closes
  // mid-prompt (e.g. ESC).
  private openLeaveRaidConfirm(): void {
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const panelW = 340;
    const panelH = 180;
    const objects: Phaser.GameObjects.GameObject[] = [];

    const backdrop = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setDepth(3100)
      .setInteractive();
    objects.push(backdrop);

    const panel = scene.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x101820, 0.98)
      .setStrokeStyle(2, 0xff416b, 0.9)
      .setDepth(3101);
    objects.push(panel);

    const title = scene.add
      .text(w / 2, h / 2 - 56, Strings.leaveRaidConfirmTitle, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ff8aa6',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(3102);
    objects.push(title);

    const body = scene.add
      .text(w / 2, h / 2 - 18, Strings.leaveRaidConfirmBody, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#cfe9f0',
        align: 'center',
        wordWrap: { width: panelW - 40 },
      })
      .setOrigin(0.5)
      .setDepth(3102);
    objects.push(body);

    const destroyAll = (): void => {
      for (const o of objects) o.destroy();
    };

    const yesBtn = scene.add
      .rectangle(w / 2 - 70, h / 2 + 42, 120, 36, 0xff416b, 1)
      .setStrokeStyle(1, 0xffffff, 0.85)
      .setDepth(3102)
      .setInteractive({ useHandCursor: true });
    yesBtn.on('pointerdown', () => {
      destroyAll();
      this.close();
      // Resolve the active RaidScene at click time so a paused/resumed
      // scene sequence stays consistent.
      const raid = scene.scene.get('RaidScene') as
        | (Phaser.Scene & { requestLeaveRaid?: () => void })
        | undefined;
      raid?.requestLeaveRaid?.();
    });
    objects.push(yesBtn);
    const yesLabel = scene.add
      .text(w / 2 - 70, h / 2 + 42, Strings.leaveRaidConfirmYes, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(3103);
    objects.push(yesLabel);

    const noBtn = scene.add
      .rectangle(w / 2 + 70, h / 2 + 42, 120, 36, 0x22f6ff, 1)
      .setStrokeStyle(1, 0xffffff, 0.85)
      .setDepth(3102)
      .setInteractive({ useHandCursor: true });
    noBtn.on('pointerdown', destroyAll);
    objects.push(noBtn);
    const noLabel = scene.add
      .text(w / 2 + 70, h / 2 + 42, Strings.leaveRaidConfirmNo, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#000000',
      })
      .setOrigin(0.5)
      .setDepth(3103);
    objects.push(noLabel);

    // Backdrop click cancels (matches the SettingsMenu's own dismissal idiom).
    backdrop.on('pointerdown', destroyAll);
  }

  // Accessibility settings stored on save.settings and read by QualityManager.
  private accessibilityRowObjects: Phaser.GameObjects.GameObject[] = [];
  private buildAccessibilityRow(y: number): void {
    const scene = this.scene;
    if (!this.root) return;
    for (const o of this.accessibilityRowObjects) o.destroy();
    this.accessibilityRowObjects = [];

    const labelX = (PANEL_W - SLIDER_W) / 2;
    const save = saveSystem.get();
    const motionOn = save.settings.reducedMotion === true;

    // Reduced-motion toggle row.
    const motionBg = scene.add
      .rectangle(labelX, y, 18, 18, motionOn ? 0x22f6ff : 0x222a36, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true });
    if (motionOn) {
      const check = scene.add
        .text(labelX + 9, y + 9, '✓', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#000000',
        })
        .setOrigin(0.5);
      this.root.add(check);
      this.accessibilityRowObjects.push(check);
    }
    const motionLabel = scene.add
      .text(labelX + 28, y + 9, 'REDUCED MOTION', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#88a0a8',
      })
      .setOrigin(0, 0.5);
    motionBg.on('pointerdown', () => {
      QualityManager.setReducedMotion(!motionOn);
      void saveSystem.persist();
      this.buildAccessibilityRow(y);
    });
    this.root.add(motionBg);
    this.root.add(motionLabel);
    this.accessibilityRowObjects.push(motionBg);
    this.accessibilityRowObjects.push(motionLabel);
  }

  // M21 — quality preset selector + auto-detect toggle (§24.3 / §24.4).
  private buildQualityRow(y: number): void {
    const scene = this.scene;
    if (!this.root) return;
    // Wipe and rebuild so calls during re-render are idempotent.
    for (const o of this.qualityRowObjects) o.destroy();
    this.qualityRowObjects = [];

    const labelX = (PANEL_W - SLIDER_W) / 2;
    const label = scene.add.text(labelX, y, 'QUALITY', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    this.root.add(label);
    this.qualityRowObjects.push(label);

    // Three preset pills (LOW / MED / HIGH).
    const presets: Array<{ id: QualityPreset; label: string }> = [
      { id: 'low', label: 'LOW' },
      { id: 'medium', label: 'MED' },
      { id: 'high', label: 'HIGH' },
    ];
    const pillW = 72;
    const pillH = 24;
    const pillGap = 6;
    const currentPreset = QualityManager.getPreset();
    const rowY = y + 22;
    for (let i = 0; i < presets.length; i++) {
      const p = presets[i];
      const px = labelX + i * (pillW + pillGap);
      const selected = currentPreset === p.id;
      const bg = scene.add
        .rectangle(px, rowY, pillW, pillH, selected ? 0x22f6ff : 0x222a36, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, selected ? 0.95 : 0.4)
        .setInteractive({ useHandCursor: true });
      const labelTxt = scene.add
        .text(px + pillW / 2, rowY + pillH / 2, p.label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: selected ? '#000000' : '#ffffff',
        })
        .setOrigin(0.5);
      bg.on('pointerdown', () => {
        QualityManager.setPreset(p.id, 'user');
        // Persist immediately so a refresh keeps the choice.
        void saveSystem.persist();
        this.buildQualityRow(y);
      });
      this.root.add(bg);
      this.root.add(labelTxt);
      this.qualityRowObjects.push(bg);
      this.qualityRowObjects.push(labelTxt);
    }

    // Auto-detect toggle. Disabled when the user wants strict control.
    const autoY = rowY + pillH + 12;
    const autoOn = QualityManager.isAutoDetectEnabled();
    const autoBg = scene.add
      .rectangle(labelX, autoY, 18, 18, autoOn ? 0x22f6ff : 0x222a36, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true });
    if (autoOn) {
      const check = scene.add
        .text(labelX + 9, autoY + 9, '✓', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#000000',
        })
        .setOrigin(0.5);
      this.root.add(check);
      this.qualityRowObjects.push(check);
    }
    const autoLabel = scene.add
      .text(labelX + 28, autoY + 9, 'AUTO-DETECT', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#88a0a8',
      })
      .setOrigin(0, 0.5);
    autoBg.on('pointerdown', () => {
      QualityManager.setAutoDetectEnabled(!autoOn);
      void saveSystem.persist();
      this.buildQualityRow(y);
    });
    this.root.add(autoBg);
    this.root.add(autoLabel);
    this.qualityRowObjects.push(autoBg);
    this.qualityRowObjects.push(autoLabel);
  }

  private buildSlider(label: string, channel: keyof AudioVolumes, initial: number, y: number): SliderHandle {
    const scene = this.scene;
    const trackX = (PANEL_W - SLIDER_W) / 2;
    const trackY = y + 24;

    const labelText = scene.add.text(trackX, y, label, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    this.root!.add(labelText);

    const trackBg = scene.add
      .rectangle(trackX, trackY, SLIDER_W, SLIDER_H, 0x222a36, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff, 0.4);
    this.root!.add(trackBg);

    const fill = scene.add
      .rectangle(trackX + 1, trackY + 1, Math.max(0, SLIDER_W * initial - 2), SLIDER_H - 2, 0x22f6ff, 1)
      .setOrigin(0, 0);
    this.root!.add(fill);

    const knob = scene.add
      .rectangle(trackX + SLIDER_W * initial - KNOB_W / 2, trackY - 3, KNOB_W, SLIDER_H + 6, 0xffffff, 1)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.root!.add(knob);

    const valueText = scene.add
      .text(trackX + SLIDER_W + 12, trackY + SLIDER_H / 2, `${Math.round(initial * 100)}%`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    this.root!.add(valueText);

    const handle: SliderHandle = {
      container: this.root!,
      knob,
      fill,
      valueText,
      channel,
      trackX,
      trackW: SLIDER_W,
    };

    knob.on('pointerdown', () => {
      this.dragHandle = handle;
    });
    return handle;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragHandle) return;
    this.updateHandleFromPointer(this.dragHandle, pointer);
  }

  private onPointerUp(): void {
    this.dragHandle = null;
  }

  // Maps the pointer's screen X back to the slider's [0,1] range, applies
  // it to the AudioBus, and redraws the visual.
  private updateHandleFromPointer(h: SliderHandle, pointer: Phaser.Input.Pointer): void {
    if (!this.root) return;
    const localX = pointer.x - this.root.x - h.trackX;
    const v = Math.max(0, Math.min(1, localX / h.trackW));
    AudioBus.setVolume(h.channel, v);
    h.knob.x = h.trackX + h.trackW * v - KNOB_W / 2;
    h.fill.setSize(Math.max(0, h.trackW * v - 2), SLIDER_H - 2);
    h.valueText.setText(`${Math.round(v * 100)}%`);
  }

  // M23 — sub-modal lifecycle. Only one open at a time; each rebuilds from
  // scratch on open() so the displayed state always matches save data.
  private openCosmeticsModal(): void {
    this.closeSubModal();
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const pW = 540;
    const pH = 460;
    this.subModalBackdrop = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.82)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3300)
      .setInteractive();
    this.subModalBackdrop.on('pointerdown', () => this.closeSubModal());
    this.subModalRoot = scene.add.container(w / 2 - pW / 2, h / 2 - pH / 2);
    this.subModalRoot.setDepth(3301);
    const panel = scene.add
      .rectangle(0, 0, pW, pH, 0x101820, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xa76cff, 0.9);
    this.subModalRoot.add(panel);
    const title = scene.add
      .text(pW / 2, 18, Strings.cosmeticsMenuTitle, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#a76cff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.subModalRoot.add(title);

    const sections: Array<{ kind: CosmeticKind; label: string }> = [
      { kind: 'trail', label: Strings.cosmeticsTabTrail },
      { kind: 'skin', label: Strings.cosmeticsTabSkin },
      { kind: 'theme', label: Strings.cosmeticsTabTheme },
    ];
    let cursorY = 56;
    for (const s of sections) {
      this.buildCosmeticSection(s.label, s.kind, cursorY, pW);
      cursorY += 110;
    }

    const closeY = pH - 64;
    const closeBg = scene.add
      .rectangle(pW / 2, closeY, 160, 36, 0x22f6ff, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });
    closeBg.on('pointerdown', () => this.closeSubModal());
    this.subModalRoot.add(closeBg);
    this.subModalRoot.add(
      scene.add
        .text(pW / 2, closeY, 'CLOSE', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#000000',
        })
        .setOrigin(0.5),
    );
  }

  private buildCosmeticSection(
    label: string,
    kind: CosmeticKind,
    y: number,
    panelW: number,
  ): void {
    if (!this.subModalRoot) return;
    const scene = this.scene;
    this.subModalRoot.add(
      scene.add
        .text(20, y, label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#88a0a8',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0, 0),
    );
    const items = cosmeticsOfKind(kind);
    const equipped = CosmeticSystem.getEquipped(kind);
    const tileW = 160;
    const tileH = 70;
    const gap = 8;
    const startX = 20;
    const startY = y + 18;
    const cap = Math.floor((panelW - startX * 2 + gap) / (tileW + gap));
    for (let i = 0; i < Math.min(items.length, cap); i++) {
      const it = items[i];
      const x = startX + i * (tileW + gap);
      const owned = CosmeticSystem.isOwned(it.id);
      const isEquipped = equipped === it.id;
      const bg = scene.add
        .rectangle(x, startY, tileW, tileH, owned ? it.color : 0x222a36, owned ? 0.5 : 0.85)
        .setOrigin(0, 0)
        .setStrokeStyle(isEquipped ? 3 : 1, isEquipped ? 0xffffff : 0xffffff, isEquipped ? 1 : 0.4);
      this.subModalRoot.add(bg);
      this.subModalRoot.add(
        scene.add
          .text(x + 8, startY + 6, it.name, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: owned ? '#ffffff' : '#888888',
          })
          .setOrigin(0, 0),
      );
      this.subModalRoot.add(
        scene.add
          .text(x + 8, startY + 22, it.description, {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: owned ? '#88a0a8' : '#555555',
            wordWrap: { width: tileW - 16 },
          })
          .setOrigin(0, 0),
      );
      if (!owned) {
        this.subModalRoot.add(
          scene.add
            .text(x + 8, startY + tileH - 16, `${Strings.cosmeticsLockedPrefix}${it.unlockCondition}`, {
              fontFamily: 'monospace',
              fontSize: '8px',
              color: '#ffd75a',
              wordWrap: { width: tileW - 16 },
            })
            .setOrigin(0, 0),
        );
      } else {
        this.subModalRoot.add(
          scene.add
            .text(x + tileW - 8, startY + tileH - 16, isEquipped ? Strings.cosmeticsEquipped : Strings.cosmeticsEquip, {
              fontFamily: 'monospace',
              fontSize: '10px',
              color: isEquipped ? '#72ff9f' : '#22f6ff',
            })
            .setOrigin(1, 0),
        );
        if (!isEquipped) {
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerdown', () => {
            CosmeticSystem.equip(it.id);
            void saveSystem.persist();
            this.openCosmeticsModal();
          });
        }
      }
    }
    // Unused — keeps the def import live for callers that pull descriptions
    // outside this helper (e.g. future tooltip work).
    void CosmeticDefs;
  }

  private openAchievementsModal(): void {
    this.closeSubModal();
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const pW = 520;
    const pH = 460;
    this.subModalBackdrop = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.82)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3300)
      .setInteractive();
    this.subModalBackdrop.on('pointerdown', () => this.closeSubModal());
    this.subModalRoot = scene.add.container(w / 2 - pW / 2, h / 2 - pH / 2);
    this.subModalRoot.setDepth(3301);
    const panel = scene.add
      .rectangle(0, 0, pW, pH, 0x101820, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffd75a, 0.9);
    this.subModalRoot.add(panel);
    this.subModalRoot.add(
      scene.add
        .text(pW / 2, 18, Strings.achievementsMenuTitle, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#ffd75a',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0),
    );

    const startY = 60;
    const rowH = 42;
    for (let i = 0; i < ACHIEVEMENT_ORDER.length; i++) {
      const id = ACHIEVEMENT_ORDER[i];
      const def = AchievementDefs[id];
      const unlocked = AchievementSystem.isUnlocked(id);
      const rowY = startY + i * rowH;
      const color = def.deferred ? '#555555' : unlocked ? '#72ff9f' : '#88a0a8';
      this.subModalRoot.add(
        scene.add
          .rectangle(20, rowY, pW - 40, rowH - 4, 0x0a1014, 0.6)
          .setOrigin(0, 0)
          .setStrokeStyle(1, unlocked ? 0x72ff9f : 0x222a36, unlocked ? 0.9 : 0.5),
      );
      this.subModalRoot.add(
        scene.add
          .text(32, rowY + 6, def.name, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color,
          })
          .setOrigin(0, 0),
      );
      this.subModalRoot.add(
        scene.add
          .text(32, rowY + 22, def.description, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#88a0a8',
          })
          .setOrigin(0, 0),
      );
      const statusText = def.deferred
        ? Strings.achievementDeferredLabel
        : unlocked
          ? '✓'
          : Strings.achievementLockedLabel;
      this.subModalRoot.add(
        scene.add
          .text(pW - 32, rowY + (rowH - 4) / 2, statusText, {
            fontFamily: 'monospace',
            fontSize: unlocked && !def.deferred ? '18px' : '10px',
            color,
          })
          .setOrigin(1, 0.5),
      );
    }

    const closeY = pH - 36;
    const closeBg = scene.add
      .rectangle(pW / 2, closeY, 140, 36, 0xffd75a, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });
    closeBg.on('pointerdown', () => this.closeSubModal());
    this.subModalRoot.add(closeBg);
    this.subModalRoot.add(
      scene.add
        .text(pW / 2, closeY, 'CLOSE', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#000000',
        })
        .setOrigin(0.5),
    );
  }

  private closeSubModal(): void {
    this.subModalRoot?.destroy(true);
    this.subModalRoot = null;
    this.subModalBackdrop?.destroy();
    this.subModalBackdrop = null;
  }

  // M24 — Controls help. Plain text modal listing all bindings; pure
  // reference for first-time / lapsed players.
  private openControlsModal(): void {
    this.openTextModal(
      'CONTROLS',
      [
        'Move      — WASD or arrow keys / floating joystick (mobile)',
        'Dash      — Space / dash button (bottom-right)',
        'Pause     — ESC / settings cog',
        'Mute      — speaker icon (top-right)',
        'Auto-aim and auto-fire — no manual aiming.',
        '',
        'Pickups magnetize within range; Cores drop rarely.',
        'Hold the green pad to extract; stay past extract for Greed.',
      ].join('\n'),
      0x22f6ff,
    );
  }

  // M24 — Credits. Plain text. Single column.
  private openCreditsModal(): void {
    this.openTextModal(
      'CREDITS',
      [
        'NEON FACTORY RAID',
        '',
        'Design  — Per blueprint v1.0',
        'Code    — Claude (Runs A / B / C / D)',
        'Audio   — Web Audio synthesis, in-game',
        'Engine  — Phaser 3',
        '',
        'Built for CrazyGames.',
      ].join('\n'),
      0xffd75a,
    );
  }

  // M24 — Reset save. Confirmation modal so a misclick can't wipe progress.
  private openResetSaveModal(): void {
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const layer: Phaser.GameObjects.GameObject[] = [];
    const bd = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3500)
      .setInteractive();
    layer.push(bd);
    const panel = scene.add
      .rectangle(w / 2, h / 2, 480, 220, 0x101820, 0.98)
      .setStrokeStyle(2, 0xff416b, 0.95)
      .setScrollFactor(0)
      .setDepth(3501);
    layer.push(panel);
    layer.push(
      scene.add
        .text(w / 2, h / 2 - 80, 'RESET SAVE?', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ff416b',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3502),
    );
    layer.push(
      scene.add
        .text(
          w / 2,
          h / 2 - 20,
          'This wipes all upgrades, unlocks, cosmetics,\nstreaks, and the leaderboard locally. Are you sure?',
          {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            align: 'center',
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3502),
    );
    const cancelBg = scene.add
      .rectangle(w / 2 - 90, h / 2 + 60, 140, 36, 0x22f6ff, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setScrollFactor(0)
      .setDepth(3502)
      .setInteractive({ useHandCursor: true });
    layer.push(cancelBg);
    layer.push(
      scene.add
        .text(w / 2 - 90, h / 2 + 60, 'CANCEL', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#000000',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3503),
    );
    const confirmBg = scene.add
      .rectangle(w / 2 + 90, h / 2 + 60, 140, 36, 0xff416b, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setScrollFactor(0)
      .setDepth(3502)
      .setInteractive({ useHandCursor: true });
    layer.push(confirmBg);
    layer.push(
      scene.add
        .text(w / 2 + 90, h / 2 + 60, 'WIPE', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#000000',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3503),
    );
    const dismiss = (): void => {
      for (const o of layer) o.destroy();
    };
    cancelBg.on('pointerdown', dismiss);
    bd.on('pointerdown', dismiss);
    confirmBg.on('pointerdown', () => {
      try {
        localStorage.removeItem('nfr:save');
      } catch {
        // ignore quota / disabled-storage errors
      }
      // Hard reload so a fresh save is created cleanly. The HTML
      // preloader will appear during the reboot.
      window.location.reload();
    });
  }

  // Shared text-only modal. Single block of body text + close button.
  private openTextModal(title: string, body: string, borderColor: number): void {
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const layer: Phaser.GameObjects.GameObject[] = [];
    const bd = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3500)
      .setInteractive();
    layer.push(bd);
    const pW = 540;
    const pH = 320;
    const panel = scene.add
      .rectangle(w / 2, h / 2, pW, pH, 0x101820, 0.98)
      .setStrokeStyle(2, borderColor, 0.95)
      .setScrollFactor(0)
      .setDepth(3501);
    layer.push(panel);
    layer.push(
      scene.add
        .text(w / 2, h / 2 - pH / 2 + 22, title, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: this.hexToCssColor(borderColor),
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(3502),
    );
    layer.push(
      scene.add
        .text(w / 2 - pW / 2 + 24, h / 2 - 80, body, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          lineSpacing: 4,
          wordWrap: { width: pW - 48 },
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(3502),
    );
    const closeBg = scene.add
      .rectangle(w / 2, h / 2 + pH / 2 - 30, 140, 36, borderColor, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setScrollFactor(0)
      .setDepth(3502)
      .setInteractive({ useHandCursor: true });
    layer.push(closeBg);
    layer.push(
      scene.add
        .text(w / 2, h / 2 + pH / 2 - 30, 'CLOSE', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#000000',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3503),
    );
    const dismiss = (): void => {
      for (const o of layer) o.destroy();
    };
    closeBg.on('pointerdown', dismiss);
    bd.on('pointerdown', dismiss);
  }

  private hexToCssColor(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }
}
