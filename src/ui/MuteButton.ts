import Phaser from 'phaser';
import { AudioBus } from '../audio/AudioBus';

// Small circular mute toggle that lives in the top-right of the HUD. Click /
// tap flips AudioBus.muted; the icon redraws to match. Lives on the HUDScene
// so it persists across raid/factory transitions like the rest of the HUD.

const SIZE = 22;
const PADDING = 12;

export class MuteButton {
  private g: Phaser.GameObjects.Graphics;
  private hit: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene) {
    const x = scene.scale.width - PADDING - SIZE;
    const y = PADDING;
    this.g = scene.add.graphics();
    this.g.setScrollFactor(0).setDepth(2300);
    this.g.setPosition(x + SIZE / 2, y + SIZE / 2);

    this.hit = scene.add.zone(x, y, SIZE, SIZE);
    this.hit.setOrigin(0, 0);
    this.hit.setScrollFactor(0);
    this.hit.setDepth(2300);
    this.hit.setInteractive({ useHandCursor: true });
    this.hit.on('pointerdown', () => {
      AudioBus.toggleMute();
      this.redraw();
    });

    this.redraw();
  }

  // Updates the icon to a speaker (audio on) or speaker-with-slash (muted).
  redraw(): void {
    const muted = AudioBus.isMuted();
    const g = this.g;
    g.clear();
    const r = SIZE / 2 - 2;
    g.fillStyle(0x101820, 0.85);
    g.fillCircle(0, 0, r + 2);
    g.lineStyle(1.5, 0xffffff, 0.85);
    g.strokeCircle(0, 0, r + 2);

    // Speaker body
    g.fillStyle(0xffffff, 1);
    g.fillRect(-7, -3, 4, 6);
    g.fillTriangle(-3, -5, -3, 5, 3, 7);
    g.fillTriangle(-3, -5, -3, 5, 3, -7);

    if (muted) {
      // Diagonal slash to indicate muted.
      g.lineStyle(2, 0xff416b, 1);
      g.lineBetween(-r - 2, -r - 2, r + 2, r + 2);
    } else {
      // Two sound waves to the right.
      g.lineStyle(1.5, 0xffffff, 0.85);
      g.beginPath();
      g.arc(3, 0, 3, -Math.PI / 3, Math.PI / 3);
      g.strokePath();
      g.beginPath();
      g.arc(3, 0, 6, -Math.PI / 3, Math.PI / 3);
      g.strokePath();
    }
  }

  destroy(): void {
    this.g.destroy();
    this.hit.destroy();
  }
}
