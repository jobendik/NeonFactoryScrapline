import type Phaser from 'phaser';
import { UpgradeDefs, nextMilestone, type UpgradeKey } from '../config/UpgradeDefs';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { UIOverlay, el } from './overlay/UIOverlay';
import { upgradeIcon } from './overlay/Icons';

// Upgrade card per blueprint §21.4. Each card renders four data points:
// label, level transition, next-milestone hint, cost.
//
// M-overhaul: cards are now styled HTML rows mounted into a shared sidebar
// container per scene. The constructor signature is unchanged for backward
// compatibility — the (x, y) positioning args are ignored; cards flow in the
// sidebar via CSS flexbox.

interface SidebarEntry {
  container: HTMLElement;
  cards: Set<UpgradeCard>;
  remove: () => void;
}

const sidebars = new WeakMap<Phaser.Scene, SidebarEntry>();

function ensureSidebar(scene: Phaser.Scene): SidebarEntry {
  let entry = sidebars.get(scene);
  if (entry) return entry;

  const container = el('div', 'nfr-sidepanel');
  const header = el('div', 'nfr-sidepanel__title');
  header.textContent = 'FACTORY UPGRADES';
  container.appendChild(header);

  const remove = UIOverlay.mountHud(scene, container);
  entry = { container, cards: new Set(), remove };
  sidebars.set(scene, entry);
  return entry;
}

export class UpgradeCard {
  private key: UpgradeKey;
  private scene: Phaser.Scene;
  private root: HTMLElement;
  private labelEl: HTMLElement;
  private levelEl: HTMLElement;
  private hintEl: HTMLElement;
  private costEl: HTMLButtonElement;
  private onPurchase?: () => void;

  constructor(scene: Phaser.Scene, key: UpgradeKey, _x: number, _y: number) {
    this.scene = scene;
    this.key = key;

    const entry = ensureSidebar(scene);
    entry.cards.add(this);

    this.root = el('div', 'nfr-upgrade');

    const iconWrap = el('div', 'nfr-upgrade__icon');
    iconWrap.innerHTML = upgradeIcon(key);
    this.root.appendChild(iconWrap);

    const main = el('div', 'nfr-upgrade__main');
    this.labelEl = el('div', 'nfr-upgrade__label');
    this.levelEl = el('div', 'nfr-upgrade__level');
    this.hintEl  = el('div', 'nfr-upgrade__hint');
    main.appendChild(this.labelEl);
    main.appendChild(this.levelEl);
    main.appendChild(this.hintEl);
    this.root.appendChild(main);

    this.costEl = document.createElement('button');
    this.costEl.type = 'button';
    this.costEl.className = 'nfr-upgrade__cost';
    this.costEl.addEventListener('click', () => {
      if (UpgradeSystem.canAfford(this.key) && UpgradeSystem.purchase(this.key)) {
        this.refresh();
        if (this.onPurchase) this.onPurchase();
      }
    });
    this.root.appendChild(this.costEl);

    entry.container.appendChild(this.root);
  }

  setOnPurchase(fn: () => void): void {
    this.onPurchase = fn;
  }

  refresh(): void {
    const def = UpgradeDefs[this.key];
    const level = UpgradeSystem.getLevel(this.key);
    const cost = UpgradeSystem.getNextCost(this.key);
    const affordable = UpgradeSystem.canAfford(this.key);

    this.labelEl.textContent = def.label;
    this.levelEl.textContent = `Lv. ${level} → ${level + 1}`;

    const ms = nextMilestone(this.key, level);
    this.hintEl.textContent = ms ? `Lv. ${ms.level}: ${ms.text}` : def.description;

    this.costEl.textContent = `${cost} ◆`;
    this.costEl.classList.toggle('is-disabled', !affordable);
    if (affordable) {
      this.root.classList.add('is-affordable');
    } else {
      this.root.classList.remove('is-affordable');
    }
  }

  destroy(): void {
    this.root.remove();
    const entry = sidebars.get(this.scene);
    if (!entry) return;
    entry.cards.delete(this);
    if (entry.cards.size === 0) {
      entry.remove();
      sidebars.delete(this.scene);
    }
  }
}
