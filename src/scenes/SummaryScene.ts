import Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { Economy } from '../systems/EconomySystem';
import { AdManager } from '../platform/AdManager';
import { saveSystem } from '../platform/SaveSystem';
import type { RaidEndPayload, RaidEndReason, RaidEndState } from '../core/types';
import { RetentionSystem } from '../systems/RetentionSystem';
import { OperatorDefs } from '../config/OperatorDefs';
import { createEmptyMaterials, type MaterialWallet } from '../config/ScraplineDefs';
import { RaidZoneSystem } from '../systems/RaidZoneSystem';

// Run-end summary per blueprint §7.10. Launched by RaidScene as a top-stack overlay
// over a stopped raid. Three buttons:
//   - Factory: stop the raid and start FactoryScene (M8 stub for now).
//   - One More Raid: stop+restart RaidScene for immediate redeploy.
//   - Double Loot: rewarded-ad path, intentionally disabled until M20.
//
// Loot values arrive already-multiplied: greed applied on successful extract,
// 50% penalty applied on failed/collapsed. The badge surfaces which of those
// transforms ran so the player can read the math at a glance.

const TITLE_FOR: Record<RaidEndState, string> = {
  extracted: Strings.summaryExtracted,
  failed: Strings.summaryFailed,
  collapsed: Strings.summaryCollapsed,
};

const TITLE_COLOR: Record<RaidEndState, string> = {
  extracted: '#72ff9f',
  failed: '#ff416b',
  collapsed: '#ffd75a',
};

// Playbook §7.3 coaching line per end-reason. Falls back to the
// endState-derived default when the payload omits endReason (e.g.
// old in-flight payloads, or future raid-end paths that forget to set
// it — extracted/died/timer are obvious enough to coach on the bucket
// alone).
function reasonCopy(state: RaidEndState, reason: RaidEndReason | undefined): string {
  const r: RaidEndReason =
    reason ??
    (state === 'extracted' ? 'extracted' : state === 'failed' ? 'died' : 'timer');
  switch (r) {
    case 'extracted':
      return Strings.endReasonExtracted;
    case 'died':
      return Strings.endReasonDied;
    case 'timer':
      return Strings.endReasonTimer;
    case 'voluntary':
      return Strings.endReasonVoluntary;
  }
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
  // M20 — DOUBLE LOOT availability: false if REVIVE was already shown this
  // raid (§17.3 max-1-rewarded-prompt rule) OR if the raid wasn't a
  // successful extract.
  private allowDoubleLoot = true;
  private doubleLootClaimed = false;
  private doubleLootBg: Phaser.GameObjects.Rectangle | null = null;
  private doubleLootLabel: Phaser.GameObjects.Text | null = null;
  private scrapValueText: Phaser.GameObjects.Text | null = null;
  private coresValueText: Phaser.GameObjects.Text | null = null;
  private materialsValueText: Phaser.GameObjects.Text | null = null;

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
    }
    this.doubleLootClaimed = false;
    this.doubleLootBg = null;
    this.doubleLootLabel = null;
    this.scrapValueText = null;
    this.coresValueText = null;
    this.materialsValueText = null;
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Dim backdrop
    const backdrop = this.add.rectangle(0, 0, w, h, 0x000000, 0.78);
    backdrop.setOrigin(0, 0);
    backdrop.setDepth(0);

    // Title
    this.add
      .text(w / 2, h * 0.18, TITLE_FOR[this.endState], {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: TITLE_COLOR[this.endState],
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    // Playbook §7.3 — one-line coaching beneath the title. The colour
    // tracks the outcome (green for extract, soft red for death, gold
    // for timer/voluntary) so the eye picks it up without reading first.
    // Skipped for tutorial summaries — the FTUE already does its own
    // teaching and the single UPGRADE button doesn't need a tip line.
    if (!this.tutorial) {
      this.add
        .text(w / 2, h * 0.255, reasonCopy(this.endState, this.endReason), {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: this.endState === 'extracted' ? '#72ff9f' : this.endState === 'failed' ? '#ff8aa6' : '#ffd75a',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: w * 0.72 },
        })
        .setOrigin(0.5, 0.5);
    }

    // Modifier badge: greed mult on extract, penalty notice on fail/collapse.
    if (this.endState === 'extracted' && this.greedMult > 1.0) {
      this.add
        .text(w / 2, h * 0.30, `${Strings.greedLabel}  x${this.greedMult.toFixed(2)}`, {
          fontFamily: 'monospace',
          fontSize: '24px',
          color: '#ffd75a',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    } else if (this.penaltyApplied) {
      this.add
        .text(w / 2, h * 0.30, Strings.summaryPenalty, {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ff416b',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    }

    // M17 — prominent infestation line on a fail with new infestation. Sits
    // above the loot card so the player can't miss it.
    if (this.newlyInfested > 0) {
      const text = `${Strings.infestationSummaryPrefix}${this.newlyInfested}${Strings.infestationSummarySuffix}`;
      this.add
        .text(w / 2, h * 0.355, text, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#ff416b',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: w * 0.7 },
        })
        .setOrigin(0.5);
    }

    // Loot card
    const cardY = h * 0.40;
    const cardW = 360;
    const materialText = RaidZoneSystem.formatMaterialWallet(this.materials);
    const hasMaterials = materialText.length > 0;
    const cardH = hasMaterials || this.zoneName ? 190 : 150;
    this.add
      .rectangle(w / 2, cardY, cardW, cardH, 0x101820, 0.95)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, 0x22f6ff, 0.7);

    this.add
      .text(w / 2 - cardW / 2 + 30, cardY - 36, Strings.summaryScrap, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#22f6ff',
      })
      .setOrigin(0, 0.5);
    this.scrapValueText = this.add
      .text(w / 2 + cardW / 2 - 30, cardY - 36, `+${this.loot.scrap}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5);

    this.add
      .text(w / 2 - cardW / 2 + 30, cardY + 16, Strings.summaryCores, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffd75a',
      })
      .setOrigin(0, 0.5);
    this.coresValueText = this.add
      .text(w / 2 + cardW / 2 - 30, cardY + 16, `+${this.loot.cores}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5);

    if (hasMaterials) {
      this.add
        .text(w / 2 - cardW / 2 + 30, cardY + 60, Strings.summaryMaterials, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#b5ff7a',
        })
        .setOrigin(0, 0.5);
      this.materialsValueText = this.add
        .text(w / 2 + cardW / 2 - 30, cardY + 60, materialText, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#ffffff',
        })
        .setOrigin(1, 0.5);
    }

    if (this.zoneName) {
      this.add
        .text(w / 2, cardY + cardH / 2 - 18, `${Strings.zoneDeployPrefix}${this.zoneName.toUpperCase()}`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffd75a',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0.5);
    }

    // M17 — small "restored" line on extract or fail that cleansed machines.
    if (this.machinesRestored > 0) {
      this.add
        .text(w / 2, cardY + cardH / 2 + 14, `+${this.machinesRestored} machine${this.machinesRestored === 1 ? '' : 's'} cleansed`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#72ff9f',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);
    }

    if (this.unlockedZones.length > 0) {
      this.add
        .text(w / 2, cardY + cardH / 2 + (this.machinesRestored > 0 ? 34 : 14), `NEW ZONE: ${this.unlockedZones.join(', ')}`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffd75a',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);
    }

    // Buttons row. The FTUE tutorial summary collapses to the single "UPGRADE"
    // button per §5.2: the player goes straight back to the factory, no
    // redeploy/double-loot options surfaced until the real first raid.
    const buttonY = h * 0.72;
    if (this.tutorial) {
      this.makeButton(w / 2, buttonY, Strings.summaryUpgrade, 0x22f6ff, '#000000', true, () =>
        this.gotoFactory(),
      );
      return;
    }

    // §17.2 DOUBLE LOOT — only offered on successful extraction. Suppressed
    // when REVIVE was already prompted this raid (§17.3 mutex). Disabled
    // once claimed so the player can't double-dip.
    const doubleLootEnabled =
      this.endState === 'extracted' && this.allowDoubleLoot && !this.doubleLootClaimed;

    const dlBtn = this.makeButton(
      w / 2 - 280,
      buttonY,
      Strings.summaryDoubleLoot,
      doubleLootEnabled ? 0xffd75a : 0x444444,
      doubleLootEnabled ? '#000000' : '#888888',
      doubleLootEnabled,
      () => {
        void this.handleDoubleLoot();
      },
    );
    this.doubleLootBg = dlBtn.bg;
    this.doubleLootLabel = dlBtn.label;

    this.makeButton(w / 2, buttonY, Strings.summaryFactory, 0x22f6ff, '#000000', true, () =>
      this.gotoFactory(),
    );

    this.makeButton(
      w / 2 + 280,
      buttonY,
      Strings.summaryRedeploy,
      0x72ff9f,
      '#000000',
      true,
      () => this.redeploy(),
    );

    // Retention pass — "what's next" teaser pinned just below the button
    // row. Three signals composed in priority order so the redeploy
    // button reads like a slot-machine pull rather than "back to menu":
    //   1. Active DOUBLE PAYDAY banner — biggest hook, rarest event.
    //   2. Next operator unlock progress — chase ladder.
    //   3. Mission Board claimables — instant-gratification nudge.
    // Tutorial summaries skip this entirely (we already collapse to
    // one button there).
    this.renderRedeployTeaser(w, buttonY);
  }

  private renderRedeployTeaser(w: number, buttonY: number): void {
    const lines: { text: string; color: string }[] = [];

    if (RetentionSystem.isPaydayActive()) {
      const left = RetentionSystem.paydayRaidsRemaining();
      lines.push({
        text: `${Strings.paydayBadgePrefix}2  · ${left} raid${left === 1 ? '' : 's'} left`,
        color: '#72ff9f',
      });
    }

    const almost = RetentionSystem.almostThere();
    if (almost.nextOperator) {
      const def = OperatorDefs[almost.nextOperator.id];
      lines.push({
        text: `${Strings.almostNextOperatorPrefix}${def.name}${Strings.almostNextOperatorMid}${almost.nextOperator.cores}/${almost.nextOperator.cost}${Strings.almostNextOperatorSuffix}`,
        color: almost.nextOperator.ready ? '#72ff9f' : '#ffd75a',
      });
    }

    if (almost.missionsReadyToClaim > 0) {
      lines.push({
        text: `${Strings.almostMissionPrefix}${almost.missionsReadyToClaim}${Strings.almostMissionSuffix}`,
        color: '#ff416b',
      });
    }

    if (lines.length === 0) return;

    const baseY = buttonY + 56;
    for (let i = 0; i < Math.min(2, lines.length); i++) {
      const line = lines[i];
      this.add
        .text(w / 2, baseY + i * 18, line.text, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: line.color,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);
    }
  }

  // M20 DOUBLE LOOT — rewarded-ad path. On grant, doubles BOTH the displayed
  // numbers and the banked wallet (additional Δ on top of the already-banked
  // values). Greed/penalty multipliers already ran in RaidScene, so we just
  // add another `loot.scrap` and `loot.cores` to bank.
  private async handleDoubleLoot(): Promise<void> {
    if (this.doubleLootClaimed) return;
    const granted = await AdManager.offer(this, {
      title: Strings.adDoubleLootTitle,
      description: Strings.adDoubleLootDesc,
      placement: 'doubleLoot',
    });
    if (!granted) return;
    this.doubleLootClaimed = true;
    // Compose on top of already-multiplied loot (greed-amplified DOUBLE LOOT
    // intentional per spec: "composes with greed multiplier").
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
    if (this.scrapValueText) this.scrapValueText.setText(`+${this.loot.scrap}`);
    if (this.coresValueText) this.coresValueText.setText(`+${this.loot.cores}`);
    if (this.materialsValueText) {
      this.materialsValueText.setText(RaidZoneSystem.formatMaterialWallet(this.materials));
    }
    // Visually disable the button.
    if (this.doubleLootBg) {
      this.doubleLootBg.setFillStyle(0x444444, 0.55);
      this.doubleLootBg.disableInteractive();
    }
    if (this.doubleLootLabel) {
      this.doubleLootLabel.setColor('#888888');
    }
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    bgColor: number,
    textColor: string,
    enabled: boolean,
    onClick: () => void,
  ): { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const bw = 230;
    const bh = 56;
    const bg = this.add.rectangle(x, y, bw, bh, bgColor, enabled ? 1 : 0.55);
    bg.setStrokeStyle(2, 0xffffff, enabled ? 0.85 : 0.25);
    if (enabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(bgColor, 0.85));
      bg.on('pointerout', () => bg.setFillStyle(bgColor, 1));
      bg.on('pointerdown', onClick);
    }
    const labelText = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: textColor,
      })
      .setOrigin(0.5);
    return { bg, label: labelText };
  }

  private gotoFactory(): void {
    // §17.6 midgame ad opportunity before returning to factory. Awaited so the
    // ad gets a chance to render before the factory scene boots; the SDK call
    // is best-effort and never blocks navigation on failure.
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
