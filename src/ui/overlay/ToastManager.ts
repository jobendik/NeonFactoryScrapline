// Queued HTML toast notification system. Replaces the ad-hoc Phaser
// `this.add.text(...)` toasts scattered through HUDScene with a single
// stage-mounted notification zone.
//
// Behavior:
//   - Fixed zone (top-center, below timer); max 3 visible at once.
//   - Queued overflow drains as toasts exit.
//   - 4 variants (info / warning / alert / reward) styled via CSS.
//   - Bottom progress bar fills right-to-left over the toast's duration.
//
// API:
//   const tm = new ToastManager(scene);
//   tm.show({ text: 'Quality lowered', variant: 'info', duration: 3000 });
//   tm.destroy(); // dismissed automatically on scene shutdown via UIOverlay

import type Phaser from 'phaser';
import { UIOverlay, el } from './UIOverlay';

export type ToastVariant = 'info' | 'warning' | 'alert' | 'reward';

export interface ToastConfig {
  text: string;
  variant?: ToastVariant;
  duration?: number; // ms; default 3000
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3000;

interface ActiveToast {
  el: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}

export class ToastManager {
  private zone: HTMLElement;
  private dismiss: () => void;
  private visible: ActiveToast[] = [];
  private queue: ToastConfig[] = [];
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.zone = el('div', 'nfr-toast-zone');
    this.dismiss = UIOverlay.mountHud(scene, this.zone);
  }

  show(config: ToastConfig): void {
    if (this.destroyed) return;
    if (this.visible.length >= MAX_VISIBLE) {
      this.queue.push(config);
      return;
    }
    this.present(config);
  }

  private present(config: ToastConfig): void {
    const variant: ToastVariant = config.variant ?? 'info';
    const duration = config.duration ?? DEFAULT_DURATION;

    const node = el('div', 'nfr-toast');
    node.setAttribute('data-variant', variant);
    node.style.setProperty('--nfr-toast-dur', `${duration}ms`);

    const text = el('div', 'nfr-toast__text');
    text.textContent = config.text;
    node.appendChild(text);

    const progress = el('div', 'nfr-toast__progress');
    node.appendChild(progress);

    this.zone.appendChild(node);

    const timer = setTimeout(() => this.expire(node), duration);
    this.visible.push({ el: node, timer });
  }

  private expire(node: HTMLElement): void {
    const idx = this.visible.findIndex(v => v.el === node);
    if (idx < 0) return;
    const v = this.visible[idx];
    clearTimeout(v.timer);
    this.visible.splice(idx, 1);
    node.classList.add('is-leaving');
    setTimeout(() => {
      node.remove();
      if (this.queue.length > 0 && this.visible.length < MAX_VISIBLE) {
        const next = this.queue.shift()!;
        this.present(next);
      }
    }, 260);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const v of this.visible) clearTimeout(v.timer);
    this.visible = [];
    this.queue = [];
    this.dismiss();
  }
}
