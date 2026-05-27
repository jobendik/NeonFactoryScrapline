// In-raid card pick at 20s and 45s. See blueprint.md §12.
//
// Owns:
//   - which draft indices have already fired this run (so 20s draft only fires once)
//   - which card ids have been shown this run (so the same card never appears twice)
//   - rarity-weighted draws over the 24-card pool from CardDefs.ts
//
// Time-slow / scene pause / UI rendering are all handled by the host scene
// (RaidScene) and DraftScene - this system is pure state.

import { DRAWABLE_CARDS, type CardDef, type CardRarity } from '../config/CardDefs';
import { Balance } from '../config/Balance';
import { ResearchSystem } from './ResearchSystem';

export interface RarityWeights {
  common: number;
  rare: number;
  epic: number;
}

interface RngLike {
  next(): number;
  pick<T>(arr: readonly T[]): T;
}

export class DraftSystem {
  private rng: RngLike;
  private firedDrafts = new Set<number>();
  private shownCards = new Set<string>();

  constructor(rng: RngLike) {
    this.rng = rng;
  }

  reset(): void {
    this.firedDrafts.clear();
    this.shownCards.clear();
  }

  // Returns the index of the next eligible draft window (0 = first/20s,
  // 1 = second/45s) or null if none should fire right now. Tutorial gate
  // lives at the call site - this method is mode-agnostic.
  shouldOffer(elapsed: number): number | null {
    const times = Balance.raid.draftTimes;
    for (let i = 0; i < times.length; i++) {
      if (elapsed >= times[i] && !this.firedDrafts.has(i)) return i;
    }
    return null;
  }

  // Marks a draft window as fired so shouldOffer skips it next frame.
  markFired(index: number): void {
    this.firedDrafts.add(index);
  }

  // Draws rarity-weighted cards from the drawable pool. Cards already shown
  // this run are excluded. Augment Array research increases the offer count.
  drawCards(draftIndex: number): CardDef[] {
    const weights =
      draftIndex === 0
        ? Balance.cards.rarityWeights.first
        : Balance.cards.rarityWeights.second;
    const cards: CardDef[] = [];
    for (let i = 0; i < ResearchSystem.draftOfferCount(); i++) {
      const c = this.drawOne(weights, cards.map(x => x.id));
      if (!c) break;
      cards.push(c);
    }
    return cards;
  }

  // Marks all three offered cards as shown for this run, regardless of which
  // one the player picks. Per §12.3 "no duplicate offers in same run".
  markShown(cards: readonly CardDef[]): void {
    for (const c of cards) this.shownCards.add(c.id);
  }

  // ---- internals ----

  private drawOne(weights: RarityWeights, alreadyDrawnInThisOffer: string[]): CardDef | null {
    const roll = this.rng.next();
    let tier: CardRarity = 'common';
    if (roll < weights.common) tier = 'common';
    else if (roll < weights.common + weights.rare) tier = 'rare';
    else tier = 'epic';

    // Try the rolled tier first; on empty, walk down the rarity ladder so a
    // late-game offer with most epics already shown still fills three slots.
    const order: CardRarity[] =
      tier === 'epic'
        ? ['epic', 'rare', 'common']
        : tier === 'rare'
          ? ['rare', 'common', 'epic']
          : ['common', 'rare', 'epic'];

    for (const t of order) {
      const pool = DRAWABLE_CARDS.filter(
        c => c.tier === t && !this.shownCards.has(c.id) && !alreadyDrawnInThisOffer.includes(c.id),
      );
      if (pool.length > 0) return this.rng.pick(pool);
    }
    return null;
  }
}
