import Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { sfxUiClick } from '../audio/sfx';

// ModalScene — top-of-stack overlay for the §17 rewarded-ad confirmation
// prompts (per blueprint §21.3 "ad confirmation"). Built as a generic
// reusable modal so the seven M20 placements share one code path.
//
// Usage:
//   scene.scene.launch('ModalScene', {
//     title: '…',
//     description: '…',
//     onResult: accepted => { ... },
//   });
//
// The launcher is responsible for pausing/resuming its own scene. ModalScene
// does NOT touch the launcher's lifecycle — it just renders, gathers a
// boolean choice, and calls back via onResult.

export interface ModalAdInit {
  title: string;
  description: string;
  acceptLabel?: string;
  declineLabel?: string;
  // Optional border tint (defaults to reward yellow). REVIVE uses extraction
  // green, CLEAR INFESTATION uses danger red.
  borderColor?: number;
  // Called with true on accept, false on decline. Scene stops itself
  // immediately before the callback fires so onResult logic can launch the
  // next scene without contention.
  onResult: (accepted: boolean) => void;
}

const DEFAULT_BORDER = 0xffd75a;

export class ModalScene extends Phaser.Scene {
  private cfg!: ModalAdInit;
  private resolved = false;

  constructor() {
    super({ key: 'ModalScene' });
  }

  init(data: ModalAdInit): void {
    this.cfg = data;
    this.resolved = false;
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Backdrop swallows clicks outside the panel (no click-to-decline; the
    // player must pick a button so the choice is deliberate).
    const bd = this.add
      .rectangle(0, 0, w, h, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3000)
      .setInteractive();
    bd.on('pointerdown', () => {
      /* swallow */
    });

    const panelW = 540;
    const panelH = 280;
    const border = this.cfg.borderColor ?? DEFAULT_BORDER;
    this.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x101820, 0.98)
      .setStrokeStyle(3, border, 0.95)
      .setScrollFactor(0)
      .setDepth(3001);

    this.add
      .text(w / 2, h / 2 - panelH / 2 + 28, this.cfg.title, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: this.hexToCssColor(border),
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(3002);

    this.add
      .text(w / 2, h / 2 - 18, this.cfg.description, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: panelW - 60 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(3002);

    const buttonY = h / 2 + panelH / 2 - 40;
    const acceptLabel = this.cfg.acceptLabel ?? Strings.adWatchButton;
    const declineLabel = this.cfg.declineLabel ?? Strings.adDeclineButton;

    this.makeButton(w / 2 - 110, buttonY, declineLabel, 0x444444, '#ffffff', () =>
      this.finish(false),
    );
    this.makeButton(w / 2 + 110, buttonY, acceptLabel, border, '#000000', () =>
      this.finish(true),
    );
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    bgColor: number,
    textColor: string,
    onClick: () => void,
  ): void {
    const bw = 200;
    const bh = 44;
    const bg = this.add
      .rectangle(x, y, bw, bh, bgColor, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setScrollFactor(0)
      .setDepth(3002)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(bgColor, 0.85));
    bg.on('pointerout', () => bg.setFillStyle(bgColor, 1));
    bg.on('pointerdown', () => {
      sfxUiClick();
      onClick();
    });
    this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: textColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3003);
  }

  private finish(accepted: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    const cb = this.cfg.onResult;
    this.scene.stop();
    cb(accepted);
  }

  private hexToCssColor(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }
}
