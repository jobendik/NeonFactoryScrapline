import Phaser from 'phaser';
import { Balance } from '../config/Balance';

export interface JoystickValue {
  x: number;
  y: number;
  active: boolean;
}

// Floating left-half joystick + bottom-right dash button per blueprint §6.4.
// The joystick appears wherever the player first touches the left half of the screen;
// it fades when released.

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private baseGfx: Phaser.GameObjects.Graphics;
  private knobGfx: Phaser.GameObjects.Graphics;
  private dashGfx: Phaser.GameObjects.Graphics;

  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;
  private active = false;
  private pointerId: number | null = null;
  private dashPointerId: number | null = null;
  private dashPressed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.baseGfx = scene.add.graphics().setScrollFactor(0).setDepth(1000).setVisible(false);
    this.knobGfx = scene.add.graphics().setScrollFactor(0).setDepth(1001).setVisible(false);
    this.dashGfx = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.redrawDashButton(false);

    scene.input.on('pointerdown', this.handleDown, this);
    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    scene.input.on('pointerupoutside', this.handleUp, this);
    scene.scale.on('resize', this.handleResize, this);
  }

  private handleResize(): void {
    this.redrawDashButton(false);
  }

  private dashCenter(): { x: number; y: number } {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    return { x: w - Balance.ui.dashButtonOffset, y: h - Balance.ui.dashButtonOffset };
  }

  private isOverDashButton(x: number, y: number): boolean {
    const c = this.dashCenter();
    return Phaser.Math.Distance.Between(x, y, c.x, c.y) <= Balance.ui.dashButtonRadius;
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    if (this.isOverDashButton(pointer.x, pointer.y)) {
      this.dashPointerId = pointer.id;
      this.dashPressed = true;
      this.redrawDashButton(true);
      return;
    }
    if (this.active) return;
    if (pointer.x > this.scene.scale.width / 2) return;

    this.active = true;
    this.pointerId = pointer.id;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.currentX = pointer.x;
    this.currentY = pointer.y;
    this.drawBase();
    this.drawKnob();
    this.baseGfx.setVisible(true);
    this.knobGfx.setVisible(true);
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const dist = Math.hypot(dx, dy);
    const max = Balance.ui.joystickMaxRadius;
    if (dist > max) {
      this.currentX = this.originX + (dx / dist) * max;
      this.currentY = this.originY + (dy / dist) * max;
    } else {
      this.currentX = pointer.x;
      this.currentY = pointer.y;
    }
    this.drawKnob();
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.dashPointerId) {
      this.dashPointerId = null;
      this.redrawDashButton(false);
    }
    if (this.active && pointer.id === this.pointerId) {
      this.active = false;
      this.pointerId = null;
      this.baseGfx.setVisible(false);
      this.knobGfx.setVisible(false);
    }
  }

  getValue(): JoystickValue {
    if (!this.active) return { x: 0, y: 0, active: false };
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const dist = Math.hypot(dx, dy);
    const max = Balance.ui.joystickMaxRadius;
    if (dist < max * Balance.ui.joystickDeadZone) {
      return { x: 0, y: 0, active: true };
    }
    const norm = Math.min(1, dist / max);
    return {
      x: (dx / dist) * norm,
      y: (dy / dist) * norm,
      active: true,
    };
  }

  consumeDash(): boolean {
    const v = this.dashPressed;
    this.dashPressed = false;
    return v;
  }

  private drawBase(): void {
    this.baseGfx.clear();
    this.baseGfx.lineStyle(2, Balance.colors.player, 0.4);
    this.baseGfx.strokeCircle(this.originX, this.originY, Balance.ui.joystickMaxRadius);
    this.baseGfx.fillStyle(Balance.colors.player, 0.06);
    this.baseGfx.fillCircle(this.originX, this.originY, Balance.ui.joystickMaxRadius);
  }

  private drawKnob(): void {
    this.knobGfx.clear();
    this.knobGfx.fillStyle(Balance.colors.player, 0.55);
    this.knobGfx.fillCircle(this.currentX, this.currentY, Balance.ui.joystickMaxRadius * 0.4);
  }

  private redrawDashButton(pressed: boolean): void {
    const c = this.dashCenter();
    this.dashGfx.clear();
    this.dashGfx.fillStyle(Balance.colors.reward, pressed ? 0.5 : 0.22);
    this.dashGfx.fillCircle(c.x, c.y, Balance.ui.dashButtonRadius);
    this.dashGfx.lineStyle(2, Balance.colors.reward, 0.85);
    this.dashGfx.strokeCircle(c.x, c.y, Balance.ui.dashButtonRadius);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handleDown, this);
    this.scene.input.off('pointermove', this.handleMove, this);
    this.scene.input.off('pointerup', this.handleUp, this);
    this.scene.input.off('pointerupoutside', this.handleUp, this);
    this.scene.scale.off('resize', this.handleResize, this);
    this.baseGfx.destroy();
    this.knobGfx.destroy();
    this.dashGfx.destroy();
  }
}
