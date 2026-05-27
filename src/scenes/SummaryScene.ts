import Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { Economy } from '../systems/EconomySystem';
import { AdManager } from '../platform/AdManager';
import { saveSystem } from '../platform/SaveSystem';
import type { RaidEndPayload, RaidEndReason, RaidEndState, RaidRunStats, ComebackMedal } from '../core/types';
import { RetentionSystem } from '../systems/RetentionSystem';
import { OperatorDefs } from '../config/OperatorDefs';
import { PlayerXpSystem } from '../systems/PlayerXpSystem';
import { createEmptyMaterials, type MaterialWallet } from '../config/ScraplineDefs';
import { RaidZoneSystem } from '../systems/RaidZoneSystem';
import { UIOverlay, el, btn } from '../ui/overlay/UIOverlay';
import { SCRAP_ICON, CORE_ICON } from '../ui/overlay/Icons';

// Run-end summary per blueprint §7.10. Launched by RaidScene as a top-stack overlay
// over a stopped raid. Three buttons:
//   - Factory: stop the raid and start FactoryScene (M8 stub for now).
//   - One More Raid: stop+restart RaidScene for immediate redeploy.
//   - Double Loot: rewarded-ad path, intentionally disabled until M20.
//
// Retention Phase 1 additions: stats card, XP progression row, comeback medal chip,
// next-best-action line — all staggered-animate in to feel rewarding.

const TITLE_FOR: Record<RaidEndState, string> = {
  extracted: Strings.summaryExtracted,
  failed: Strings.summaryFailed,
  collapsed: Strings.summaryCollapsed,
};

const MEDAL_COPY: Record<ComebackMedal, { label: string; color: string }> = {
  personalBest:   { label: '★ PERSONAL BEST',       color: 'var(--nfr-gold)'  },
  lastSecond:     { label: '⚡ LAST-SECOND ESCAPE',  color: 'var(--nfr-cyan)'  },
  longRun:        { label: '↑ SURVIVED LONGER',      color: 'var(--nfr-violet)'},
  fullCargo:      { label: '✓ FULL CARGO',            color: 'var(--nfr-green)' },
  greedyExtract:  { label: '◆ GREEDY EXTRACT',        color: 'var(--nfr-gold)'  },
  taskComplete:   { label: '✓ DAILY TASK DONE',       color: 'var(--nfr-cyan)'  },
  firstExtract:   { label: '★ FIRST EXTRACTION',      color: 'var(--nfr-green)' },
};

function reasonCopy(state: RaidEndState, reason: RaidEndReason | undefined): string {
  const r: RaidEndReason =
    reason ??
    (state === 'extracted' ? 'extracted' : state === 'failed' ? 'died' : 'timer');
  switch (r) {
    case 'extracted': return Strings.endReasonExtracted;
    case 'died':      return Strings.endReasonDied;
    case 'timer':     return Strings.endReasonTimer;
    case 'voluntary': return Strings.endReasonVoluntary;
  }
}

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class SummaryScene extends Phaser.Scene {
  private endState: RaidEndState = 'collapsed';
  private endReason: RaidEndReason | undefined = undefined;
  private loot = { scrap: 0, cores: 0 };
  private materials: MaterialWallet = createEmptyMaterials();
  private zoneName = '';
  private unlockedZones: string[] = [];
  private greedMult = 1.0;
  private penaltyApplied = false;
  private tutorial = false;
  private newlyInfested = 0;
  private machinesRestored = 0;
  private allowDoubleLoot = true;
  private doubleLootClaimed = false;
  private runStats: RaidRunStats | undefined = undefined;
  private xpEarned = 0;
  private accountLevelBefore = 1;
  private accountLevelAfter = 1;
  private comebackMedal: ComebackMedal | undefined = undefined;
  private nextBestAction = '';

  // Live DOM handles for the post-claim loot bump.
  private scrapValueEl: HTMLElement | null = null;
  private coresValueEl: HTMLElement | null = null;
  private materialsValueEl: HTMLElement | null = null;
  private doubleLootBtn: HTMLButtonElement | null = null;
  private dismiss: (() => void) | null = null;

  constructor() {
    super({ key: 'SummaryScene' });
  }

  init(data: RaidEndPayload): void {
    if (data) {
      this.endState = data.endState;
      this.endReason = data.endReason;
      this.loot = { scrap: data.loot.scrap, cores: data.loot.cores };
      this.materials = data.loot.materials ?? createEmptyMaterials();
      this.zoneName = data.zoneName ?? '';
      this.unlockedZones = data.unlockedZones ?? [];
      this.greedMult = data.greedMult ?? 1.0;
      this.penaltyApplied = !!data.penaltyApplied;
      this.tutorial = !!data.tutorial;
      this.newlyInfested = data.newlyInfested ?? 0;
      this.machinesRestored = data.machinesRestored ?? 0;
      this.allowDoubleLoot = data.allowDoubleLoot !== false;
      this.runStats = data.runStats;
      this.xpEarned = data.xpEarned ?? 0;
      this.accountLevelBefore = data.accountLevelBefore ?? PlayerXpSystem.getLevel();
      this.accountLevelAfter = data.accountLevelAfter ?? PlayerXpSystem.getLevel();
      this.comebackMedal = data.comebackMedal;
      this.nextBestAction = data.nextBestAction ?? '';
    }
    this.doubleLootClaimed = false;
    this.scrapValueEl = null;
    this.coresValueEl = null;
    this.materialsValueEl = null;
    this.doubleLootBtn = null;
  }

  create(): void {
    const root = el('div', 'nfr-summary');
    root.setAttribute('data-outcome', this.endState);

    // Outcome title — huge stamp.
    const title = el('h1', 'nfr-summary__title');
    title.textContent = TITLE_FOR[this.endState];
    root.appendChild(title);

    // Coaching line (skipped in tutorial summary).
    if (!this.tutorial) {
      const reason = el('p', 'nfr-summary__reason');
      reason.textContent = reasonCopy(this.endState, this.endReason);
      root.appendChild(reason);
    }

    // Modifier badge — greed (extracted) / penalty (failed) / infestation warn.
    if (this.endState === 'extracted' && this.greedMult > 1.0) {
      const badge = el('div', 'nfr-summary__badge');
      badge.textContent = `${Strings.greedLabel}  ×${this.greedMult.toFixed(2)}`;
      root.appendChild(badge);
    } else if (this.penaltyApplied) {
      const badge = el('div', 'nfr-summary__badge is-penalty');
      badge.textContent = Strings.summaryPenalty;
      root.appendChild(badge);
    }
    if (this.newlyInfested > 0) {
      const warn = el('div', 'nfr-summary__badge is-warn');
      warn.textContent = `${Strings.infestationSummaryPrefix}${this.newlyInfested}${Strings.infestationSummarySuffix}`;
      root.appendChild(warn);
    }

    // Run stats card — quick glance numbers.
    if (!this.tutorial && this.runStats) {
      root.appendChild(this.buildStatsCard(this.runStats));
    }

    // Loot card with number tick-up animations.
    const lootCard = el('div', 'nfr-summary__loot-card');

    const scrapRow = this.buildLootRow('scrap', Strings.summaryScrap, SCRAP_ICON);
    lootCard.appendChild(scrapRow.row);
    this.scrapValueEl = scrapRow.valueEl;
    this.tickUp(scrapRow.valueEl, this.loot.scrap);

    const coresRow = this.buildLootRow('cores', Strings.summaryCores, CORE_ICON);
    lootCard.appendChild(coresRow.row);
    this.coresValueEl = coresRow.valueEl;
    this.tickUp(coresRow.valueEl, this.loot.cores);

    const materialText = RaidZoneSystem.formatMaterialWallet(this.materials);
    if (materialText.length > 0) {
      const matRow = this.buildLootRow('materials', Strings.summaryMaterials, '◆', materialText);
      lootCard.appendChild(matRow.row);
      this.materialsValueEl = matRow.valueEl;
    }

    if (this.zoneName) {
      const z = el('div', 'nfr-summary__sub-line is-zone');
      z.textContent = `${Strings.zoneDeployPrefix}${this.zoneName.toUpperCase()}`;
      lootCard.appendChild(z);
    }
    if (this.machinesRestored > 0) {
      const r = el('div', 'nfr-summary__sub-line is-cleansed');
      r.textContent = `+${this.machinesRestored} machine${this.machinesRestored === 1 ? '' : 's'} cleansed`;
      lootCard.appendChild(r);
    }
    if (this.unlockedZones.length > 0) {
      const u = el('div', 'nfr-summary__sub-line is-new-zone');
      u.textContent = `NEW ZONE: ${this.unlockedZones.join(', ')}`;
      lootCard.appendChild(u);
    }
    root.appendChild(lootCard);

    // XP / progression stack — only for non-tutorial.
    if (!this.tutorial && this.xpEarned > 0) {
      root.appendChild(this.buildProgressionStack());
    }

    // Comeback medal chip.
    if (!this.tutorial && this.comebackMedal) {
      const chip = this.buildMedalChip(this.comebackMedal);
      root.appendChild(chip);
    }

    // Buttons.
    const buttons = el('div', 'nfr-summary__buttons');
    if (this.tutorial) {
      const upgrade = btn(Strings.summaryUpgrade, 'cyan', () => this.gotoFactory(), { size: 'lg' });
      buttons.appendChild(upgrade);
    } else {
      const doubleEnabled =
        this.endState === 'extracted' && this.allowDoubleLoot && !this.doubleLootClaimed;
      const dl = btn(Strings.summaryDoubleLoot, 'gold', () => { void this.handleDoubleLoot(); }, {
        disabled: !doubleEnabled,
        size: 'lg',
      });
      this.doubleLootBtn = dl;
      buttons.appendChild(dl);

      const fac = btn(Strings.summaryFactory, 'cyan', () => this.gotoFactory(), { size: 'lg' });
      buttons.appendChild(fac);

      const redep = btn(Strings.summaryRedeploy, 'green', () => this.redeploy(), { size: 'lg' });
      redep.classList.add('is-active-loop');
      buttons.appendChild(redep);
    }
    root.appendChild(buttons);

    // Next best action line replaces old teaser.
    if (!this.tutorial) {
      const nba = this.buildNextBestAction();
      if (nba) root.appendChild(nba);
    }

    // Mount as a non-dismissible modal — backdrop is the summary surface itself.
    this.dismiss = UIOverlay.mountModal(this, root, { dismissOnBackdrop: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dismiss?.();
      this.dismiss = null;
    });
  }

  private buildStatsCard(stats: RaidRunStats): HTMLElement {
    const card = el('div', 'nfr-summary__stats-card');
    const rows: Array<{ label: string; value: string }> = [
      { label: 'TIME',        value: fmtSec(stats.elapsedSec) },
      { label: 'KILLS',       value: `${stats.killCount}` },
      { label: 'DAMAGE',      value: `${Math.round(stats.damageDealt).toLocaleString()}` },
      { label: 'BEST COMBO',  value: `×${stats.bestCombo.toFixed(1)}` },
    ];
    for (const r of rows) {
      const row = el('div', 'nfr-summary__stats-row');
      const labelEl = el('span', 'nfr-summary__stats-label');
      labelEl.textContent = r.label;
      const valueEl = el('span', 'nfr-summary__stats-value');
      valueEl.textContent = r.value;
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      card.appendChild(row);
    }
    return card;
  }

  private buildProgressionStack(): HTMLElement {
    const stack = el('div', 'nfr-summary__progression');
    const prog = PlayerXpSystem.getProgress();
    const leveledUp = this.accountLevelAfter > this.accountLevelBefore;

    const xpRow = el('div', 'nfr-summary__xp-row');
    const xpLabel = el('span', 'nfr-summary__xp-label');
    xpLabel.textContent = leveledUp
      ? `LEVEL UP → ${this.accountLevelAfter}  ${prog.title}`
      : `LVL ${prog.level}  ${prog.title}`;
    xpLabel.style.color = leveledUp ? 'var(--nfr-gold)' : 'var(--nfr-cyan)';

    const xpValue = el('span', 'nfr-summary__xp-value');
    xpValue.textContent = `+${this.xpEarned} XP`;

    const xpBarWrap = el('div', 'nfr-summary__xp-track');
    const xpBarFill = el('div', 'nfr-summary__xp-fill');
    const pct = prog.xpForCurrentLevel > 0
      ? Math.max(0, Math.min(1, prog.xpIntoCurrentLevel / prog.xpForCurrentLevel))
      : 1;
    // Animate fill after a short delay.
    xpBarFill.style.transform = 'scaleX(0)';
    setTimeout(() => {
      xpBarFill.style.transition = 'transform 600ms cubic-bezier(0.22,1,0.36,1)';
      xpBarFill.style.transform = `scaleX(${pct})`;
    }, 300);
    xpBarWrap.appendChild(xpBarFill);

    xpRow.appendChild(xpLabel);
    xpRow.appendChild(xpValue);
    stack.appendChild(xpRow);
    stack.appendChild(xpBarWrap);
    return stack;
  }

  private buildMedalChip(medal: ComebackMedal): HTMLElement {
    const m = MEDAL_COPY[medal];
    const chip = el('div', 'nfr-summary__medal-chip');
    chip.textContent = m.label;
    chip.style.color = m.color;
    chip.style.borderColor = m.color;
    return chip;
  }

  private buildNextBestAction(): HTMLElement | null {
    // Try the passed-in action first, then fall back to the teaser-style retention lines.
    const lines: { text: string; color: string }[] = [];
    if (this.nextBestAction) {
      lines.push({ text: this.nextBestAction, color: 'var(--nfr-cyan)' });
    }
    if (RetentionSystem.isPaydayActive()) {
      const left = RetentionSystem.paydayRaidsRemaining();
      lines.push({
        text: `${Strings.paydayBadgePrefix}2  · ${left} raid${left === 1 ? '' : 's'} left`,
        color: 'var(--nfr-green)',
      });
    }
    const almost = RetentionSystem.almostThere();
    if (almost.nextOperator) {
      const def = OperatorDefs[almost.nextOperator.id];
      lines.push({
        text: `${Strings.almostNextOperatorPrefix}${def.name}${Strings.almostNextOperatorMid}${almost.nextOperator.cores}/${almost.nextOperator.cost}${Strings.almostNextOperatorSuffix}`,
        color: almost.nextOperator.ready ? 'var(--nfr-green)' : 'var(--nfr-gold)',
      });
    }
    if (almost.missionsReadyToClaim > 0) {
      lines.push({
        text: `${Strings.almostMissionPrefix}${almost.missionsReadyToClaim}${Strings.almostMissionSuffix}`,
        color: 'var(--nfr-red)',
      });
    }
    if (lines.length === 0) return null;
    const wrap = el('div', 'nfr-summary__teaser');
    for (let i = 0; i < Math.min(2, lines.length); i++) {
      const l = el('div', 'nfr-summary__teaser-line');
      l.textContent = lines[i].text;
      l.style.color = lines[i].color;
      wrap.appendChild(l);
    }
    return wrap;
  }

  private buildLootRow(
    cls: 'scrap' | 'cores' | 'materials',
    label: string,
    iconMarkup: string,
    textOverride?: string,
  ): { row: HTMLElement; valueEl: HTMLElement } {
    const row = el('div', `nfr-summary__loot-row ${cls}`);
    const iconWrap = el('span');
    iconWrap.innerHTML = iconMarkup;
    row.appendChild(iconWrap);
    const labelEl = el('span', 'nfr-loot-label');
    labelEl.textContent = label;
    row.appendChild(labelEl);
    const valueEl = el('span', 'nfr-loot-value');
    valueEl.textContent = textOverride ?? '+0';
    row.appendChild(valueEl);
    return { row, valueEl };
  }

  // 0 → final ease-out tick over 600ms using rAF.
  private tickUp(target: HTMLElement, finalValue: number): void {
    if (finalValue <= 0) {
      target.textContent = `+${finalValue}`;
      return;
    }
    const start = performance.now();
    const dur = 600;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.floor(finalValue * eased);
      target.textContent = `+${v}`;
      if (t < 1) requestAnimationFrame(tick);
      else target.textContent = `+${finalValue}`;
    };
    requestAnimationFrame(tick);
  }

  private async handleDoubleLoot(): Promise<void> {
    if (this.doubleLootClaimed) return;
    const granted = await AdManager.offer(this, {
      title: Strings.adDoubleLootTitle,
      description: Strings.adDoubleLootDesc,
      placement: 'doubleLoot',
    });
    if (!granted) return;
    this.doubleLootClaimed = true;
    const bonusScrap = this.loot.scrap;
    const bonusCores = this.loot.cores;
    const bonusMaterials = { ...this.materials };
    this.loot.scrap += bonusScrap;
    this.loot.cores += bonusCores;
    this.materials.alloy += bonusMaterials.alloy;
    this.materials.circuits += bonusMaterials.circuits;
    Economy.bankLoot(bonusScrap, bonusCores);
    RaidZoneSystem.bankMaterials(bonusMaterials);
    void saveSystem.persist();
    if (this.scrapValueEl) this.scrapValueEl.textContent = `+${this.loot.scrap}`;
    if (this.coresValueEl) this.coresValueEl.textContent = `+${this.loot.cores}`;
    if (this.materialsValueEl) {
      this.materialsValueEl.textContent = RaidZoneSystem.formatMaterialWallet(this.materials);
    }
    if (this.doubleLootBtn) {
      this.doubleLootBtn.disabled = true;
      this.doubleLootBtn.classList.add('is-disabled');
      this.doubleLootBtn.setAttribute('aria-disabled', 'true');
    }
  }

  private gotoFactory(): void {
    void AdManager.maybeRequestMidgame({
      raidEndState: this.endState,
      doubleLootClaimed: this.doubleLootClaimed,
      tutorial: this.tutorial,
    }).finally(() => {
      this.scene.stop('RaidScene');
      this.scene.start('FactoryScene');
      this.scene.stop();
    });
  }

  private redeploy(): void {
    this.scene.stop('RaidScene');
    this.scene.start('RaidScene');
    this.scene.stop();
  }
}
