// Achievement unlock callout — gold chamfered toast distinct from the
// generic toast manager. Slides in from the right, holds for a beat,
// slides back out. Multiple unlocks queue sequentially.

import type Phaser from 'phaser';
import { UIOverlay, el } from './UIOverlay';

const HOLD_MS = 3500;
const ENTRY_MS = 360;
const EXIT_MS = 400;

interface QueuedCallout {
  name: string;
}

export class AchievementCallout {
  private zone: HTMLElement;
  private dismiss: () => void;
  private queue: QueuedCallout[] = [];
  private active = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.zone = el('div', 'nfr-achievement-callout-zone');
    this.dismiss = UIOverlay.mountHud(scene, this.zone);
  }

  show(name: string): void {
    if (this.destroyed) return;
    this.queue.push({ name });
    if (!this.active) this.drain();
  }

  private drain(): void {
    if (this.destroyed) return;
    const next = this.queue.shift();
    if (!next) {
      this.active = false;
      return;
    }
    this.active = true;
    this.present(next);
  }

  private present(item: QueuedCallout): void {
    const node = el('div', 'nfr-achievement-callout');

    const icon = el('div', 'nfr-achievement-callout__icon');
    const iconText = el('span', 'nfr-achievement-callout__icon-fallback');
    iconText.textContent = '★';
    icon.appendChild(iconText);
    node.appendChild(icon);

    const text = el('div', 'nfr-achievement-callout__text');
    const header = el('div', 'nfr-achievement-callout__header');
    header.textContent = 'ACHIEVEMENT UNLOCKED';
    const nameEl = el('div', 'nfr-achievement-callout__name');
    nameEl.textContent = item.name;
    text.appendChild(header);
    text.appendChild(nameEl);
    node.appendChild(text);

    this.zone.appendChild(node);

    setTimeout(() => {
      node.classList.add('is-leaving');
      setTimeout(() => {
        node.remove();
        this.drain();
      }, EXIT_MS);
    }, ENTRY_MS + HOLD_MS);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.queue = [];
    this.dismiss();
  }
}
