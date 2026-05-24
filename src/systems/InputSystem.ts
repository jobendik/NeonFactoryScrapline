import Phaser from 'phaser';
import { VirtualJoystick } from './VirtualJoystick';

export interface InputFrame {
  x: number;
  y: number;
  dash: boolean;
}

// Unified input layer: collapses keyboard (WASD/arrows + Space) and the virtual
// joystick into a single per-frame {x, y, dash} snapshot read by the Player.

export class InputSystem {
  private joystick: VirtualJoystick;
  private keyW: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyS: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;
  private keyUp: Phaser.Input.Keyboard.Key;
  private keyDown: Phaser.Input.Keyboard.Key;
  private keyLeft: Phaser.Input.Keyboard.Key;
  private keyRight: Phaser.Input.Keyboard.Key;
  private keySpace: Phaser.Input.Keyboard.Key;
  private dashRequested = false;

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) {
      throw new Error('InputSystem requires keyboard input plugin');
    }
    const kbd = scene.input.keyboard;
    this.keyW = kbd.addKey('W');
    this.keyA = kbd.addKey('A');
    this.keyS = kbd.addKey('S');
    this.keyD = kbd.addKey('D');
    this.keyUp = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keySpace = kbd.addKey('SPACE');
    this.keySpace.on('down', this.onDashKey, this);

    this.joystick = new VirtualJoystick(scene);
  }

  private onDashKey(): void {
    this.dashRequested = true;
  }

  getInput(): InputFrame {
    let kx = 0;
    let ky = 0;
    if (this.keyW.isDown || this.keyUp.isDown) ky -= 1;
    if (this.keyS.isDown || this.keyDown.isDown) ky += 1;
    if (this.keyA.isDown || this.keyLeft.isDown) kx -= 1;
    if (this.keyD.isDown || this.keyRight.isDown) kx += 1;
    const kLen = Math.hypot(kx, ky);
    if (kLen > 1) {
      kx /= kLen;
      ky /= kLen;
    }

    const joy = this.joystick.getValue();
    const x = joy.active ? joy.x : kx;
    const y = joy.active ? joy.y : ky;

    const dash = this.dashRequested || this.joystick.consumeDash();
    this.dashRequested = false;

    return { x, y, dash };
  }

  destroy(): void {
    this.keySpace.off('down', this.onDashKey, this);
    this.joystick.destroy();
  }
}
