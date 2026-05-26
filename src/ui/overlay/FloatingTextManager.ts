// Pool-backed HTML floating text — damage numbers, scrap pickups,
// milestone popups. World-space positions are projected through the
// owning Phaser camera each spawn (we sample once; the float trajectory
// is screen-space after that).
//
// Pool sized for raid combat density (~40 sim numbers). Elements are
// recycled via visibility rather than DOM destroy/create.

import type Phaser from 'phaser';
import { UIOverlay, el } from './UIOverlay';

export type FloatKind = 'dmg' | 'crit' | 'hit' | 'heal' | 'scrap' | 'cores' | 'score' | 'milestone';

export interface FloatSpawn {
  text: string;
  worldX: number;
  worldY: number;
  kind?: FloatKind;
  fontSize?: number; // px override; defaults computed by kind
  durationMs?: number; // default per-kind
}

const POOL_SIZE = 40;
const DEFAULT_DURATIONS: Record<FloatKind, number> = {
  dmg: 800,
  crit: 1100,
  hit: 900,
  heal: 900,
  scrap: 700,
  cores: 800,
  score: 1000,
  milestone: 1400,
};

interface Slot {
  el: HTMLElement;
  busy: boolean;
  endsAt: number;
}

export class FloatingTextManager {
  private layer: HTMLElement;
  private dismiss: () => void;
  private camera: Phaser.Cameras.Scene2D.Camera | null;
  private slots: Slot[] = [];
  private destroyed = false;
  // Accumulation window for rapid scrap pickups (spec §5).
  private scrapAccumValue = 0;
  private scrapAccumX = 0;
  private scrapAccumY = 0;
  private scrapAccumTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(scene: Phaser.Scene) {
    this.layer = el('div', 'nfr-float-layer');
    this.dismiss = UIOverlay.mountHud(scene, this.layer);
    this.camera = scene.cameras?.main ?? null;
    for (let i = 0; i < POOL_SIZE; i++) {
      const node = el('div', 'nfr-float-text');
      this.layer.appendChild(node);
      this.slots.push({ el: node, busy: false, endsAt: 0 });
    }
  }

  spawn(opts: FloatSpawn): void {
    if (this.destroyed) return;
    const kind: FloatKind = opts.kind ?? 'dmg';
    const slot = this.acquireSlot();
    if (!slot) return;
    const duration = opts.durationMs ?? DEFAULT_DURATIONS[kind];
    const screen = this.project(opts.worldX, opts.worldY);
    const driftX = (Math.random() * 40 - 20).toFixed(0);
    const riseY = kind === 'milestone' ? -10 : -60 - Math.random() * 20;
    const sizePx = opts.fontSize ?? defaultSize(kind, opts.text);

    const e = slot.el;
    e.setAttribute('data-kind', kind);
    e.textContent = opts.text;
    e.style.left = `${screen.x}px`;
    e.style.top = `${screen.y}px`;
    e.style.fontSize = `${sizePx}px`;
    e.style.transform = 'translate(-50%, -50%) scale(1)';
    e.style.opacity = '1';
    e.style.transition = 'none';
    e.classList.add('is-active');
    // Force reflow so the transition kicks in on the next frame.
    void e.offsetWidth;
    e.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${duration}ms ease-out`;
    e.style.transform = `translate(calc(-50% + ${driftX}px), calc(-50% + ${riseY}px)) scale(${kind === 'milestone' ? 0.85 : 1})`;
    e.style.opacity = '0';

    slot.busy = true;
    slot.endsAt = performance.now() + duration;
    setTimeout(() => this.release(slot), duration + 20);
  }

  // Accumulated scrap pickup popup — collapses rapid +1 pickups into a
  // single +N popup over a 120ms window.
  pickupScrap(value: number, worldX: number, worldY: number): void {
    if (this.destroyed || value <= 0) return;
    this.scrapAccumValue += value;
    this.scrapAccumX = worldX;
    this.scrapAccumY = worldY;
    if (this.scrapAccumTimer != null) return;
    this.scrapAccumTimer = setTimeout(() => {
      const v = this.scrapAccumValue;
      this.scrapAccumValue = 0;
      this.scrapAccumTimer = null;
      if (v <= 0) return;
      this.spawn({
        text: `+${v} SCRAP`,
        worldX: this.scrapAccumX,
        worldY: this.scrapAccumY,
        kind: 'scrap',
      });
    }, 120);
  }

  private acquireSlot(): Slot | null {
    // First free slot, else recycle the oldest expiring.
    let oldest: Slot | null = null;
    for (const s of this.slots) {
      if (!s.busy) return s;
      if (!oldest || s.endsAt < oldest.endsAt) oldest = s;
    }
    return oldest;
  }

  private release(slot: Slot): void {
    if (this.destroyed) return;
    slot.busy = false;
    slot.el.classList.remove('is-active');
    slot.el.style.transition = 'none';
    slot.el.style.opacity = '0';
  }

  private project(wx: number, wy: number): { x: number; y: number } {
    if (!this.camera) return { x: wx, y: wy };
    return { x: wx - this.camera.scrollX, y: wy - this.camera.scrollY };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.scrapAccumTimer != null) clearTimeout(this.scrapAccumTimer);
    this.scrapAccumTimer = null;
    this.dismiss();
  }
}

function defaultSize(kind: FloatKind, text: string): number {
  if (kind === 'milestone') return 40;
  if (kind === 'crit') {
    const v = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    return Math.max(20, Math.min(48, 14 * Math.max(1, Math.log10(v + 1))));
  }
  if (kind === 'dmg' || kind === 'hit') {
    const v = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    return Math.max(16, Math.min(36, 14 * Math.max(1, Math.log10(v + 1))));
  }
  return 18;
}
