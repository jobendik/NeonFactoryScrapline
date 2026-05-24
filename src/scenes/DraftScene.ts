import Phaser from 'phaser';
import { Balance } from '../config/Balance';
import { Strings } from '../config/Strings';
import type { CardDef, CardRarity } from '../config/CardDefs';
import { bus, Events } from '../core/EventBus';
import { sfxUpgradePurchased } from '../audio/sfx';
import { UIOverlay, el } from '../ui/overlay/UIOverlay';
import { cardIcon } from '../ui/overlay/Icons';

// DraftScene per blueprint §12. Launched as an overlay by RaidScene at the
// 20s and 45s draft windows; RaidScene pauses itself before launch so the
// player is safe while choosing.
//
// M-overhaul: the card picker is now an HTML+CSS overlay (see UIOverlay) so
// we get real fonts, glow, gradients, and proper iconography for each card.
// The Phaser scene survives only as an input + tween host that mounts the
// overlay on create() and tears it down on pick / timeout.

export interface DraftSceneInit {
  cards: CardDef[];
  draftIndex: number;
  raidSceneKey: string;
}

const RARITY_CLASS: Record<CardRarity, string> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
};

const RARITY_LABEL: Record<CardRarity, string> = {
  common: Strings.draftRarityCommon,
  rare: Strings.draftRarityRare,
  epic: Strings.draftRarityEpic,
};

export class DraftScene extends Phaser.Scene {
  private cards: CardDef[] = [];
  private raidSceneKey = 'RaidScene';
  private remaining: number = Balance.cards.autoPickSec;
  private picked = false;
  private timerLabel: HTMLElement | null = null;
  private dismissOverlay: (() => void) | null = null;

  constructor() {
    super({ key: 'DraftScene' });
  }

  init(data: DraftSceneInit): void {
    this.cards = data?.cards ?? [];
    this.raidSceneKey = data?.raidSceneKey ?? 'RaidScene';
    this.remaining = Balance.cards.autoPickSec;
    this.picked = false;
  }

  create(): void {
    this.buildOverlay();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dismissOverlay?.();
      this.dismissOverlay = null;
    });
  }

  override update(_time: number, deltaMs: number): void {
    if (this.picked) return;
    const dt = deltaMs / 1000;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.timerLabel) {
      this.timerLabel.textContent = `${Strings.draftAutoPick} ${Math.ceil(this.remaining)}s`;
    }
    if (this.remaining <= 0) {
      const idx = this.cards.length >= 2 ? 1 : 0;
      const fallback = this.cards[idx];
      if (fallback) this.pick(fallback);
    }
  }

  private buildOverlay(): void {
    const panel = el('div', 'nfr-panel');
    panel.style.minWidth = '720px';
    panel.style.padding = '32px 36px 28px';

    const title = el('h1', 'nfr-panel__title');
    title.textContent = Strings.draftTitle;
    panel.appendChild(title);

    const subtitle = el('div', 'nfr-panel__subtitle');
    subtitle.textContent = `${Strings.draftAutoPick} ${Math.ceil(this.remaining)}s`;
    this.timerLabel = subtitle;
    panel.appendChild(subtitle);

    const grid = el('div', 'nfr-card-grid');
    for (const card of this.cards) {
      grid.appendChild(this.buildCard(card));
    }
    panel.appendChild(grid);

    // Modal — but with no backdrop dismiss (the draft must be answered).
    this.dismissOverlay = UIOverlay.mountModal(this, panel, { dismissOnBackdrop: false });
  }

  private buildCard(card: CardDef): HTMLElement {
    const wrap = el('div', `nfr-card ${RARITY_CLASS[card.tier]}`);
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');

    const rarity = el('div', 'nfr-card__rarity');
    rarity.textContent = RARITY_LABEL[card.tier];
    wrap.appendChild(rarity);

    const icon = el('div', 'nfr-card__icon');
    icon.innerHTML = cardIcon(card.id);
    wrap.appendChild(icon);

    const name = el('div', 'nfr-card__name');
    name.textContent = card.name;
    wrap.appendChild(name);

    const effect = el('div', 'nfr-card__effect');
    effect.textContent = card.effect;
    wrap.appendChild(effect);

    const onPick = (): void => this.pick(card);
    wrap.addEventListener('click', onPick);
    wrap.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onPick();
    });
    return wrap;
  }

  private pick(card: CardDef): void {
    if (this.picked) return;
    this.picked = true;
    sfxUpgradePurchased();

    // Hand the picked card to RaidScene through the bus event. RaidScene's
    // listener will mutate RunMods, refresh derived caches, and resume itself.
    bus.emit(Events.DRAFT_PICKED, card);

    this.dismissOverlay?.();
    this.dismissOverlay = null;
    this.scene.resume(this.raidSceneKey);
    this.scene.stop();
  }
}
