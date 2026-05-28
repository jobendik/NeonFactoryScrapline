import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Pickup, type PickupType } from '../entities/Pickup';
import { Generator } from '../entities/Machine';
import { Drone } from '../entities/Drone';
import { OreDeposit } from '../entities/OreDeposit';
import { Conveyor, type ConveyorTint } from '../entities/Conveyor';
import { Smelter } from '../entities/Smelter';
import { InputSystem } from '../systems/InputSystem';
import { Economy } from '../systems/EconomySystem';
import { UpgradeEffects } from '../systems/UpgradeSystem';
import { saveSystem } from '../platform/SaveSystem';
import { Balance } from '../config/Balance';
import { Strings } from '../config/Strings';
import { bus, Events } from '../core/EventBus';
import { UpgradeCard } from '../ui/UpgradeCard';
import { UPGRADE_KEYS, type UpgradeKey } from '../config/UpgradeDefs';
import { MusicEngine } from '../audio/music';
import { sfxScrap, sfxCore, sfxUpgradePurchased, sfxGeneratorProduce } from '../audio/sfx';
import { OperatorDefs, OPERATOR_ORDER, type OperatorId } from '../config/OperatorDefs';
import { OperatorSystem } from '../systems/OperatorSystem';
import { InfestationSystem } from '../systems/InfestationSystem';
import { DailyQuestSystem } from '../systems/DailyQuestSystem';
import { StreakSystem } from '../systems/StreakSystem';
import { LeaderboardSystem } from '../systems/LeaderboardSystem';
import { todayUtcDate } from '../config/QuestDefs';
import { AdManager } from '../platform/AdManager';
import { CosmeticSystem } from '../systems/CosmeticSystem';
import { openRefineryPanel, openMissionBoard, openPrestigePanel, openZonePanel, openResearchPanel, openDroneBayPanel } from '../ui/FactoryPanels';
import { openWeeklyBossPanel } from '../ui/WeeklyBossPanel';
import { ensureCommonFX, applyGlow, FACTORY_BG_KEY, VIGNETTE_KEY } from '../systems/NeonFX';
import { RetentionSystem } from '../systems/RetentionSystem';
import { WelcomeBack } from '../ui/WelcomeBack';
import { UIOverlay as nfrUIOverlay, el as nfrEl, btn } from '../ui/overlay/UIOverlay';
import { ToastManager as NfrToastManager } from '../ui/overlay/ToastManager';
import { RaidZoneSystem } from '../systems/RaidZoneSystem';
import { ResearchSystem } from '../systems/ResearchSystem';
import { DroneMissionSystem } from '../systems/DroneMissionSystem';
import { EventSystem } from '../systems/EventSystem';
import { openFortuneWheelPanel } from '../ui/FortuneWheelPanel';
import { openDailyLoginPanel } from '../ui/DailyLoginPanel';
import { WorkerSystem } from '../systems/WorkerSystem';

// HTML factory for one button in the left-edge action column. The variant
// drives both color and (for hover) the glow tint. Caller wires the click
// handler.
function nfrActionBtn(label: string, variant: 'cyan' | 'gold' | 'violet' | 'red' | 'green', onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `nfr-action ${variant === 'cyan' ? '' : variant}`.trim();
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

// FactoryScene per blueprint §8. The factory is a "living place": the player
// physically walks around to pick up the scrap dropping out of generators, and
// stands on a deploy pad to launch a new raid.
//
// M8 implements:
//   - Player + InputSystem (same as raid)
//   - Generators that pulse and drop scrap on a cadence set by SPM (§8.7)
//   - Pickup pool + magnet (reused from raid)
//   - Deploy pad as a physical object - hold for `holdSec` to start a raid
//   - Walking on collected scrap banks it directly to saveSystem.get().scrap
//
// Future milestones layer on: M9 adds the upgrade panel and additional machine
// types, M10 adds offline production + persistence.

type DeployState = 'idle' | 'holding' | 'launching';

export class FactoryScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private pickups!: Phaser.GameObjects.Group;
  private generators: Generator[] = [];
  // Decorative ore veins feeding each generator pair. Visual only — pulse and
  // shimmer per frame. Rebuilt when the player upgrades Gen so the active
  // ore veins match the number of active generators.
  private oreDeposits: OreDeposit[] = [];
  // Animated conveyor belts: ore → generator (cosmetic feedstock) and
  // generator → smelter (visible feedback path when a generator produces).
  // Indexed by generator slot so we can trigger per-generator cargo bursts
  // from spawnScrapAt().
  private feedConveyors: Conveyor[] = [];        // ore → generator (parallel to generators[])
  private outboundConveyors: Conveyor[] = [];    // generator → smelter (parallel to generators[])
  // Cross-belt running along the right side of the smelter toward the
  // deploy pad — purely decorative "shipping line" so the deploy pad reads
  // as the factory's output.
  private shippingConveyor: Conveyor | null = null;
  private smelter: Smelter | null = null;

  private padX = Balance.factory.deployPad.x;
  private padY = Balance.factory.deployPad.y;
  private padRadius = Balance.factory.deployPad.radius;
  private padFillArc: SVGCircleElement | null = null;
  private padFillCircumference = 0;
  private deployHold = 0;
  private deployState: DeployState = 'idle';
  private drones: Drone[] = [];
  private upgradeCards: UpgradeCard[] = [];
  private milestoneVisuals: Phaser.GameObjects.GameObject[] = [];
  // Ambient decorative props — pipes, wall panels, idle chassis, cable
  // conduits, loading-bay stripes — drawn once on scene create so the
  // factory reads as a populated workshop even at Gen Lv. 1 (when only
  // one functional generator spawns). Cleaned up in shutdown().
  private ambientDecor: Phaser.GameObjects.GameObject[] = [];
  // Pulsing "DEPLOY" prompt that appears the first time a post-tutorial player
  // returns to the factory and has bought Gen Lv. 2. Cleared once they walk on
  // the pad or once raidsCompleted advances past 1. HTML element pinned to
  // the pad's world position via the worldPins projection.
  private deployPromptEl: HTMLElement | null = null;
  // Pad-anchored HTML widgets (deploy hint + zone label + DAILY SEED button).
  private padHintEl: HTMLElement | null = null;
  private zoneLabelEl: HTMLElement | null = null;
  // World-pinned HTML overlays: positions updated each frame from the camera
  // so they look glued to a world coordinate (deploy pad, machine labels).
  private worldPins: Array<{ el: HTMLElement; worldX: number; worldY: number }> = [];
  private toastMgr: NfrToastManager | null = null;
  // M16 operator picker — HTML overlay row docked along the bottom of the
  // canvas. Dismiss the previous mount before rebuilding on state change.
  private operatorPanelDismiss: (() => void) | null = null;
  // M18 — quest panel HTML overlay, rebuilt on claim or raid-return.
  private questPanelDismiss: (() => void) | null = null;
  // M19 — daily seed deploy button + leaderboard button + leaderboard modal.
  // dailySeedObjects holds disposable handles ({destroy}) so the existing
  // teardown helper keeps working; HTML overlays push a dismiss adapter.
  private dailySeedObjects: Array<{ destroy: () => void }> = [];
  private leaderboardObjects: Array<{ destroy: () => void }> = [];
  // M20 — rewarded-ad panel (FACTORY BOOST + CLEAR INFESTATION + DAILY CRATE).
  // Sits on the left edge below the FPS counter. Refreshed on any state
  // change (boost activated, infestation cleared, daily crate claimed) and
  // re-ticked each second so the FACTORY BOOST cooldown label updates.
  //
  // M-overhaul: the ad panel is now an HTML overlay column (CSS `.nfr-actioncol`).
  // `adPanelDismiss` tears it down on rebuild / scene shutdown.
  private adPanelDismiss: (() => void) | null = null;
  private adPanelLastSecond = -1;
  private factoryBoostBtn: HTMLButtonElement | null = null;
  private eventBannerDismiss: (() => void) | null = null;
  private backgroundCheckSecond = -1;
  // Pinned try-out toast (shown briefly after the player accepts the
  // OPERATOR TRY-OUT ad). HTML element + dismiss fn.
  private onUpgradePurchased = (..._args: unknown[]): void => this.handleUpgradePurchased();

  constructor() {
    super({ key: 'FactoryScene' });
  }

  create(): void {
    RaidZoneSystem.syncUnlocks();
    ResearchSystem.ensureSaveShape();
    DroneMissionSystem.ensureSaveShape();
    const wb = Balance.player.worldBounds;
    const width = wb.maxX - wb.minX;
    const height = wb.maxY - wb.minY;
    this.physics.world.setBounds(wb.minX, wb.minY, width, height);
    this.cameras.main.setBounds(wb.minX, wb.minY, width, height);
    this.cameras.main.setBackgroundColor(Balance.factory.backgroundColor);

    this.drawBackground();
    this.drawAmbientDecor();
    this.drawPad();

    this.player = new Player(this, 0, 0);
    this.cameras.main.startFollow(
      this.player,
      true,
      Balance.ui.cameraFollowLerp,
      Balance.ui.cameraFollowLerp,
    );

    this.inputSystem = new InputSystem(this);

    this.pickups = this.add.group({
      classType: Pickup,
      maxSize: Balance.performance.maxPickups,
      runChildUpdate: false,
    });
    this.physics.add.overlap(this.player, this.pickups, this.onPickupOverlap, undefined, this);

    this.spawnSmelter();
    this.spawnGenerators();
    this.spawnOreAndConveyors();
    this.spawnShippingConveyor();
    this.spawnFactoryLabels();
    this.spawnDeployPadFX();
    this.spawnMilestoneVisuals();
    this.spawnDrones();
    this.spawnWorkers();
    this.buildUpgradePanel();
    this.buildOperatorPanel();

    this.deployState = 'idle';
    this.deployHold = 0;

    bus.on(Events.UPGRADE_PURCHASED, this.onUpgradePurchased);

    this.maybeShowOfflineRewardModal();
    this.showOfflineToast();
    this.refreshDeployPrompt();
    this.maybeShowInfestationToast();
    this.maybeShowInfestationTutorialModal();
    this.buildQuestPanel();
    this.buildDailySeedAndLeaderboardButtons();
    this.buildAdPanel();
    this.buildEventBanner();
    this.tickBackgroundSystems();
    MusicEngine.startFactory();
  }

  // The §5.2 scripted moment: right after the player buys Gen Lv. 2 in their
  // first post-tutorial factory visit, light up the deploy pad. We key this off
  // (tutorialDone, gen>=2, raidsCompleted<=1) so it stops appearing once they're
  // past the FTUE.
  private refreshDeployPrompt(): void {
    const save = saveSystem.get();
    const want =
      save.tutorialDone === true &&
      save.upgrades.gen >= 2 &&
      save.raidsCompleted <= 1;

    if (want && !this.deployPromptEl) {
      this.deployPromptEl = nfrEl('div', 'nfr-pad-deploy-prompt');
      this.deployPromptEl.textContent = Strings.ftueDeployPrompt;
      this.pinHtmlToWorld(this.deployPromptEl, this.padX, this.padY - this.padRadius - 56);
    } else if (!want && this.deployPromptEl) {
      this.unpinHtmlFromWorld(this.deployPromptEl);
      this.deployPromptEl = null;
    }
  }

  // ---- world-pinned HTML overlay helpers ----
  // mountHud + a per-frame transform pin lets us position any HTML node at
  // a fixed world coordinate (so it scrolls with the camera the same way
  // a Phaser world-space text would, but using real CSS rendering).
  private pinHtmlToWorld(el: HTMLElement, worldX: number, worldY: number): void {
    el.classList.add('nfr-worldpin');
    nfrUIOverlay.mountHud(this, el);
    this.worldPins.push({ el, worldX, worldY });
    this.applyWorldPin(el, worldX, worldY);
  }

  private unpinHtmlFromWorld(el: HTMLElement): void {
    const idx = this.worldPins.findIndex(p => p.el === el);
    if (idx >= 0) this.worldPins.splice(idx, 1);
    el.remove();
  }

  private applyWorldPin(el: HTMLElement, worldX: number, worldY: number): void {
    const cam = this.cameras.main;
    const designW = this.scale.width;
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const cssScale = designW > 0 ? canvasRect.width / designW : 1;
    const sx = (worldX - cam.scrollX) * cam.zoom * cssScale;
    const sy = (worldY - cam.scrollY) * cam.zoom * cssScale;
    el.style.transform = `translate(calc(${sx.toFixed(1)}px - 50%), calc(${sy.toFixed(1)}px - 50%))`;
  }

  private tickWorldPins(): void {
    for (const pin of this.worldPins) {
      this.applyWorldPin(pin.el, pin.worldX, pin.worldY);
    }
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(Balance.performance.dtClamp, deltaMs / 1000);

    const frame = this.inputSystem.getInput();
    this.player.update(dt, frame);

    // Generators tick on the SPM cadence; output divides across active gens so
    // total factory throughput tracks SPM exactly.
    for (const gen of this.generators) {
      if (gen.tick(dt)) {
        this.spawnScrapAt(gen);
        sfxGeneratorProduce();
      }
    }

    for (const drone of this.drones) drone.update(dt, this.player.x, this.player.y);

    // Ore + conveyor + smelter ticks. Each is visual-only and very cheap
    // (sin/cos pulse + a handful of sprite positions). Conveyor instances
    // are deduped because multiple generators may reference the same belt.
    for (const ore of this.oreDeposits) ore.update(dt);
    const seenBelts = new Set<Conveyor>();
    for (const belt of this.feedConveyors) {
      if (seenBelts.has(belt)) continue;
      seenBelts.add(belt);
      belt.update(dt);
    }
    for (const belt of this.outboundConveyors) {
      if (seenBelts.has(belt)) continue;
      seenBelts.add(belt);
      belt.update(dt);
    }
    if (this.shippingConveyor) {
      this.shippingConveyor.update(dt);
      // Trickle of decorative shipping cargo every ~1.6s while there's any
      // active generation. Keeps the deploy line visibly moving.
      this.shippingCargoTimer -= dt;
      if (this.shippingCargoTimer <= 0 && this.generators.length > 0) {
        this.shippingConveyor.sendCargo(2.2);
        this.shippingCargoTimer = 1.6;
      }
    }
    this.smelter?.update(dt);

    WorkerSystem.update(dt, this.pickups);

    const baseRadius = UpgradeEffects.magnetRadius();
    for (const child of this.pickups.getChildren()) {
      const p = child as Pickup;
      if (!p.active) continue;
      // Drones extend the effective magnet by acting as secondary pull sources.
      // Whichever of (player, drone) is closest within its radius wins.
      let pullX = this.player.x;
      let pullY = this.player.y;
      let radius = baseRadius;
      const dxP = p.x - this.player.x;
      const dyP = p.y - this.player.y;
      let bestD = Math.hypot(dxP, dyP);
      for (const drone of this.drones) {
        const pos = drone.getPosition();
        const dx = p.x - pos.x;
        const dy = p.y - pos.y;
        const d = Math.hypot(dx, dy);
        if (d < bestD && d <= drone.getPickupRadius()) {
          bestD = d;
          pullX = pos.x;
          pullY = pos.y;
          radius = drone.getPickupRadius();
        }
      }
      if (ResearchSystem.hasMagnetPulse() && this.generators.length > 0) {
        let nearest = this.generators[0];
        let best = Number.POSITIVE_INFINITY;
        for (const gen of this.generators) {
          const gd = Phaser.Math.Distance.Between(p.x, p.y, gen.x, gen.y);
          if (gd < best) { best = gd; nearest = gen; }
        }
        p.updateMagnet(dt, nearest.x, nearest.y, 120);
      }
      p.updateMagnet(dt, pullX, pullY, radius);
    }

    this.tickDeployPad(dt);
    this.tickAdPanel();
    this.tickBackgroundSystems();
    this.tickWorldPins();
  }

  shutdown(): void {
    MusicEngine.stop();
    bus.off(Events.UPGRADE_PURCHASED, this.onUpgradePurchased);
    // Bracket the scene transition with a save so deploy-and-die can't lose
    // upgrades the player just bought.
    void saveSystem.persist();
    this.inputSystem.destroy();
    for (const gen of this.generators) gen.destroy();
    this.generators = [];
    for (const ore of this.oreDeposits) ore.destroy();
    this.oreDeposits = [];
    this.destroyConveyors();
    this.shippingConveyor?.destroy();
    this.shippingConveyor = null;
    this.smelter?.destroy();
    this.smelter = null;
    for (const drone of this.drones) drone.destroy();
    this.drones = [];
    WorkerSystem.destroy();
    for (const card of this.upgradeCards) card.destroy();
    this.upgradeCards = [];
    for (const v of this.milestoneVisuals) v.destroy();
    this.milestoneVisuals = [];
    for (const v of this.ambientDecor) v.destroy();
    this.ambientDecor = [];
    // Tear down all world-pinned HTML overlays (they're managed via mountHud
    // but we also remove them from the pin list so the next scene start is
    // clean).
    for (const pin of this.worldPins) pin.el.remove();
    this.worldPins = [];
    this.deployPromptEl = null;
    this.padHintEl = null;
    this.zoneLabelEl = null;
    this.destroyOperatorPanel();
    this.destroyQuestPanel();
    this.destroyDailySeedAndLeaderboard();
    this.destroyAdPanel();
    this.eventBannerDismiss?.();
    this.eventBannerDismiss = null;
  }

  // ---- accessors used by HUDScene ----

  getSpm(): number {
    return Economy.computeSpm();
  }

  getDeployHoldRatio(): number {
    if (this.deployState === 'idle') return 0;
    return Math.min(1, this.deployHold / Balance.factory.deployPad.holdSec);
  }

  // ---- internals ----

  private spawnGenerators(): void {
    // M8 ships gen_level=1 → one generator visible. Once Gen Lv. 2 unlocks in M9
    // the second slot from generatorPositions slides in (per §8.5).
    const genLevel = Math.max(1, saveSystem.get().upgrades.gen);
    const slots = Balance.factory.generatorPositions.slice(0, Math.min(genLevel, Balance.factory.generatorPositions.length));
    // M17 — Economy.computeSpm now reads infestation ratio automatically, so
    // generatorDropIntervalSec already reflects fewer working machines. We
    // multiply by the WORKING count (not slots.length) so each healthy
    // generator drops at the right cadence to land at the post-infestation
    // SPM. With 1 of 2 infested: working=1, perGenInterval = baseInterval.
    const infested = new Set(InfestationSystem.getInfestedIndices());
    const workingCount = Math.max(1, slots.length - infested.size);
    const totalIntervalSec = Economy.generatorDropIntervalSec();
    const perGenInterval = totalIntervalSec * workingCount;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const gen = new Generator(this, slot.x, slot.y, perGenInterval, i);
      if (infested.has(i)) gen.setInfested(true);
      this.generators.push(gen);
    }
  }

  private spawnSmelter(): void {
    const s = Balance.factory.smelter;
    this.smelter = new Smelter(this, s.x, s.y);
  }

  // Pin a few decorative labels along the floor so the spatial story reads
  // at a glance: ore enters from the west, refines at the centre, ships
  // from the deploy pad on the east. World-pinned HTML so they share the
  // glow palette of every other label in the game.
  private spawnFactoryLabels(): void {
    const wb = Balance.player.worldBounds;
    const sm = Balance.factory.smelter;

    const oreLabel = nfrEl('div', 'nfr-machine-label gold');
    oreLabel.textContent = '◆ RAW ORE ◆';
    this.pinHtmlToWorld(oreLabel, wb.minX + 170, wb.minY + 60);

    const smelterLabel = nfrEl('div', 'nfr-machine-label cyan');
    smelterLabel.textContent = '◆ SMELTER ◆';
    this.pinHtmlToWorld(smelterLabel, sm.x, sm.y - 90);

    const shipLabel = nfrEl('div', 'nfr-machine-label cyan');
    shipLabel.style.color = 'var(--nfr-green, #72ff9f)';
    shipLabel.style.textShadow = '0 0 8px rgba(114, 255, 159, 0.55), 0 1px 3px rgba(0, 0, 0, 0.95)';
    shipLabel.textContent = '◆ SHIPPING ◆';
    this.pinHtmlToWorld(shipLabel, this.padX, wb.minY + 60);
  }

  // Persistent ambient particles around the deploy pad so it reads as a
  // live launch portal rather than a static circle on the floor. Two
  // emitters: rising motes inside the ring and an outer halo that breathes.
  private spawnDeployPadFX(): void {
    // Rising motes inside the pad — sourced from a ring just inside the
    // pad edge so they look like the pad is venting energy upward.
    const motes = this.add.particles(this.padX, this.padY, 'fx-spark', {
      x: { min: -this.padRadius * 0.7, max: this.padRadius * 0.7 },
      y: { min: -10, max: 18 },
      speed: { min: 22, max: 60 },
      angle: { min: 255, max: 285 },
      lifespan: 1400,
      frequency: 110,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [Balance.colors.extraction, 0xffffff],
    });
    motes.setDepth(-1);

    // Outer ring decal — a thin circle stroke baked into a graphics object
    // centered at the origin, positioned at the pad. We tween its scale
    // and alpha to make it pulse outward.
    const ring = this.add.graphics();
    ring.lineStyle(2, Balance.colors.extraction, 0.85);
    ring.strokeCircle(0, 0, this.padRadius);
    ring.setPosition(this.padX, this.padY);
    ring.setDepth(-1);
    this.tweens.add({
      targets: ring,
      scaleX: { from: 1, to: 1.22 },
      scaleY: { from: 1, to: 1.22 },
      alpha: { from: 0.55, to: 0 },
      duration: 1500,
      repeat: -1,
      ease: 'Quad.easeOut',
    });

    // Stash for shutdown cleanup via ambientDecor pile (same lifecycle).
    this.ambientDecor.push(motes);
    this.ambientDecor.push(ring);
  }

  // Spawn one ore deposit per active generator row, plus a single feed belt
  // and outbound belt running through ALL generators sharing that row.
  // Generators visually "sit on" the belt so the chain reads as continuous
  // ore-in / scrap-out flow even when both columns are active.
  //
  // feedConveyors[i] / outboundConveyors[i] are parallel to generators[i] —
  // multiple generators in the same row reference the same Conveyor instance.
  // Destruction dedupes via a Set so we never double-free.
  private spawnOreAndConveyors(): void {
    if (!this.smelter) return;
    const oreSlots = Balance.factory.oreDepositPositions;
    const activeYs = new Set<number>(this.generators.map(g => g.y));
    const sm = this.smelter;

    // Per-row conveyor cache so generators in the same y-band share belts.
    const feedByRow = new Map<number, Conveyor>();
    const outboundByRow = new Map<number, Conveyor>();
    // Track distinct belt instances for the chain links so destroy() knows
    // about them too.
    const linkBelts: Conveyor[] = [];

    for (let i = 0; i < oreSlots.length; i++) {
      const ore = oreSlots[i];
      // Always render the ore deposit — gives the factory presence at low
      // gen levels. Conveyors and chains only attach to rows that have an
      // active generator.
      this.oreDeposits.push(new OreDeposit(this, ore.x, ore.y, ore.tint));
      if (!activeYs.has(ore.y)) continue;

      const rowGens = this.generators.filter(g => g.y === ore.y);
      if (rowGens.length === 0) continue;
      const eastmost = rowGens.reduce((a, b) => (a.x > b.x ? a : b));
      const westmost = rowGens.reduce((a, b) => (a.x < b.x ? a : b));

      // Feed belt: ore east-edge → eastmost generator's west-edge.
      const tint: ConveyorTint =
        ore.tint === 'gold' ? 'gold' :
        ore.tint === 'violet' ? 'violet' :
        'cyan';
      const feed = new Conveyor(
        this,
        ore.x + 36,
        ore.y,
        eastmost.x - Balance.factory.generatorSize / 2 - 4,
        ore.y,
        tint,
      );
      feedByRow.set(ore.y, feed);

      // Outbound belt: eastmost generator's east-edge → smelter intake.
      const beltStartX = eastmost.x + Balance.factory.generatorSize / 2 + 4;
      const outbound = new Conveyor(this, beltStartX, ore.y, sm.x - 100, sm.y + 8, 'cyan');
      outboundByRow.set(ore.y, outbound);

      // Inter-generator chain belt (only when both columns active in this
      // row). Short cyan belt linking westmost → eastmost.
      if (rowGens.length > 1) {
        const link = new Conveyor(
          this,
          westmost.x + Balance.factory.generatorSize / 2 + 4,
          ore.y,
          eastmost.x - Balance.factory.generatorSize / 2 - 4,
          ore.y,
          'cyan',
        );
        linkBelts.push(link);
      }
    }

    // Build parallel arrays aligned with this.generators. Multiple entries
    // may reference the same Conveyor; that's fine — sendCargo() runs an
    // independent cargo per call.
    for (const gen of this.generators) {
      const feed = feedByRow.get(gen.y);
      const outbound = outboundByRow.get(gen.y);
      if (feed) this.feedConveyors.push(feed);
      if (outbound) this.outboundConveyors.push(outbound);
    }
    // Stash link belts in feedConveyors too so they get tick()'d each frame
    // and destroyed via the dedup-aware shutdown path.
    for (const link of linkBelts) this.feedConveyors.push(link);
  }

  // Single "shipping" conveyor running from the smelter east toward the
  // deploy pad. Continuous decorative cargo gives the factory a sense of
  // material moving out for the next raid.
  private spawnShippingConveyor(): void {
    if (!this.smelter) return;
    const startX = this.smelter.x + 110;
    const startY = this.smelter.y + 8;
    const endX = this.padX - this.padRadius - 20;
    const endY = this.padY;
    this.shippingConveyor = new Conveyor(this, startX, startY, endX, endY, 'gold');
    // Kick off a slow trickle of decorative cargo packets.
    this.shippingCargoTimer = 0;
  }

  private shippingCargoTimer = 0;

  // Tear down all feed + outbound conveyors. Multiple generators in the same
  // row reference the same Conveyor, so we dedupe before destroying.
  private destroyConveyors(): void {
    const seen = new Set<Conveyor>();
    for (const belt of this.feedConveyors) {
      if (seen.has(belt)) continue;
      seen.add(belt);
      belt.destroy();
    }
    for (const belt of this.outboundConveyors) {
      if (seen.has(belt)) continue;
      seen.add(belt);
      belt.destroy();
    }
    this.feedConveyors = [];
    this.outboundConveyors = [];
  }

  private spawnScrapAt(gen: Generator): void {
    // Generator visual reaction: brightness flash + spark burst + gear kick.
    gen.triggerProductionBurst();
    const pos = gen.randomDropPosition();
    const p = this.pickups.get(pos.x, pos.y) as Pickup | null;
    if (!p) return;
    p.spawn(pos.x, pos.y, 'scrap', 1);

    // Send a decorative chunk along the outbound conveyor for this generator
    // so the player sees the scrap "shipping" toward the smelter. Pure visual
    // — the actual scrap pickup is what gets banked by the worker / player.
    const idx = this.generators.indexOf(gen);
    if (idx >= 0 && idx < this.outboundConveyors.length) {
      const belt = this.outboundConveyors[idx];
      belt.sendCargo(2.4);
    }
    // Also send an inbound "ore" chunk on the feed conveyor — the visual
    // implication is the generator just ate a chunk of ore to produce.
    if (idx >= 0 && idx < this.feedConveyors.length) {
      const feed = this.feedConveyors[idx];
      feed.sendCargo(1.4);
    }
  }

  private spawnWorkers(): void {
    WorkerSystem.init(this, (value, wx, wy) => this.onWorkerDelivered(value, wx, wy));
  }

  private onWorkerDelivered(value: number, wx: number, _wy: number): void {
    // Smelter visibly reacts to each delivery — funnel pulse + ember burst.
    this.smelter?.pulseDeposit();
    // Show a brief world-pinned "+N" popup near the deposit point.
    // Slight lateral offset so simultaneous deliveries from each side stay readable.
    const POPUP_LATERAL_OFFSET = 14;
    const POPUP_VERTICAL_OFFSET = 20;
    const dep = Balance.factory.workerDepositPoint;
    const popupX = dep.x + (wx > dep.x ? POPUP_LATERAL_OFFSET : -POPUP_LATERAL_OFFSET);
    const el = nfrEl('div', 'nfr-worldpin nfr-worker-deposit-pop');
    el.textContent = `+${value}`;
    this.pinHtmlToWorld(el, popupX, dep.y - POPUP_VERTICAL_OFFSET);
    // Auto-remove after 1.2 s (CSS animation handles fade-out).
    setTimeout(() => {
      this.unpinHtmlFromWorld(el);
    }, 1200);
    // Also fire FTUE toast the very first time a worker delivers.
    if (!this.workerFirstDeliveryToastShown) {
      this.workerFirstDeliveryToastShown = true;
      this.showHtmlToast('🤖 Hauler delivered scrap — automation is live!', 'cyan', 3500);
    }
  }

  private workerFirstDeliveryToastShown = false;

  private spawnDrones(): void {
    const count = UpgradeEffects.droneCount();
    const withTrail = count >= 3; // §8.5 "Drone Lv. 3: drones gain trails"
    const orbitRadius = 56;
    const orbitSpeed = 2.4;
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / Math.max(1, count)) * Math.PI * 2;
      this.drones.push(
        new Drone(this, {
          orbitRadius,
          orbitSpeed,
          baseAngle,
          pickupRadius: 110,
          withTrail,
        }),
      );
    }
  }

  private buildUpgradePanel(): void {
    // M-overhaul: the upgrade panel is now an HTML+CSS sidebar (UpgradeCard
    // mounts each row into a shared overlay container — see UpgradeCard.ts).
    // Phaser-side x/y coordinates are ignored; sidebar layout is CSS-driven.
    const visibleKeys = UPGRADE_KEYS.filter(k => this.isUpgradeUnlocked(k));
    for (let i = 0; i < visibleKeys.length; i++) {
      const key = visibleKeys[i];
      const card = new UpgradeCard(this, key, 0, 0);
      card.refresh();
      this.upgradeCards.push(card);
    }
  }

  // §5.3 reveal rules. Gen is always visible (first factory view shows only
  // GENERATOR per the M11 spec). The rest gate on the ftueUnlocks flags set
  // by RaidScene.finishRaid. Speed isn't called out in §5.3 - we piggyback
  // it on the first-real-raid magnet reveal so the first factory visit is
  // a single highlighted row, matching the tutorial brief.
  private isUpgradeUnlocked(key: UpgradeKey): boolean {
    const u = saveSystem.get().ftueUnlocks;
    switch (key) {
      case 'gen':
        return true;
      case 'speed':
        return u.magnetUpgrade;
      case 'magnet':
        return u.magnetUpgrade;
      case 'drone':
        return u.droneUpgrade;
      case 'worker':
        return true;
      case 'damage':
        return u.damageUpgrade;
      case 'luck':
        return u.luckUpgrade;
    }
  }

  private handleUpgradePurchased(): void {
    // Refresh affordability + level text on every card after any purchase.
    for (const card of this.upgradeCards) card.refresh();
    // Player numeric stats (HP, speed) refresh immediately for the in-factory feel.
    this.player.refreshFromUpgrades();
    // Some upgrades require live changes to the factory floor (more generators,
    // a new drone, new placeholder visuals).
    this.rebuildFactoryFloor();
    // After Gen Lv. 2 - the scripted §5.2 first-purchase - light up the deploy
    // pad so the player understands what to do next.
    this.refreshDeployPrompt();
    sfxUpgradePurchased();
  }

  private rebuildFactoryFloor(): void {
    for (const gen of this.generators) gen.destroy();
    this.generators = [];
    for (const ore of this.oreDeposits) ore.destroy();
    this.oreDeposits = [];
    this.destroyConveyors();
    for (const drone of this.drones) drone.destroy();
    this.drones = [];
    for (const v of this.milestoneVisuals.filter(v => v.getData('milestone') === true)) v.destroy();
    this.milestoneVisuals = this.milestoneVisuals.filter(v => v.getData('milestone') !== true);

    this.spawnGenerators();
    this.spawnOreAndConveyors();
    this.spawnMilestoneVisuals();
    this.spawnDrones();
    WorkerSystem.rebuild();
  }

  private showOfflineToast(): void {
    const banners = RetentionSystem.consumeBootBanners();
    if (banners.length === 0 && RetentionSystem.currentStreakDay() === 0) return;
    WelcomeBack.show(this, { offlineScrap: 0, banners });
  }

  private maybeShowOfflineRewardModal(): void {
    const amount = saveSystem.getPendingOfflineScrap();
    if (amount <= 0) return;
    const panel = nfrEl('div', 'nfr-panel gold nfr-ad-modal');
    panel.appendChild(nfrEl('h2', 'nfr-panel__title', Strings.offlineRewardTitle));
    panel.appendChild(nfrEl('div', 'nfr-panel__subtitle', `${Strings.offlineRewardAmountPrefix}${amount}${Strings.offlineRewardAmountSuffix}`));
    const body = nfrEl('div', 'nfr-panel__body');
    body.appendChild(nfrEl('div', 'nfr-row__effect', Strings.offlineRewardBody));
    panel.appendChild(body);
    const footer = nfrEl('div', 'nfr-panel__footer');
    let dismiss: (() => void) | null = null;
    const collect = () => {
      Economy.bankLoot(amount, 0);
      saveSystem.clearPendingOfflineScrap();
      void saveSystem.persist();
      dismiss?.();
    };
    footer.appendChild(btn(Strings.offlineRewardCollect, 'cyan', collect, { size: 'lg' }));
    footer.appendChild(btn(Strings.offlineRewardDouble, 'gold', async () => {
      this.scene.pause();
      const granted = await AdManager.offer(this, {
        title: Strings.offlineRewardAdTitle,
        description: Strings.offlineRewardAdDesc,
        placement: 'factoryBoost',
      });
      this.scene.resume();
      if (!granted) return;
      Economy.bankLoot(amount * 2, 0);
      saveSystem.clearPendingOfflineScrap();
      void saveSystem.persist();
      dismiss?.();
    }, { size: 'lg' }));
    panel.appendChild(footer);
    dismiss = nfrUIOverlay.mountModal(this, panel, { dismissOnBackdrop: false });
  }

  private buildEventBanner(): void {
    this.eventBannerDismiss?.();
    this.eventBannerDismiss = null;
    const active = EventSystem.getActiveEvent();
    if (!active) return;
    const banner = nfrEl('div', 'nfr-topright-btn');
    banner.style.left = '50%';
    banner.style.right = 'auto';
    banner.style.top = '12px';
    banner.style.transform = 'translateX(-50%)';
    banner.style.borderColor = active.color;
    banner.style.color = active.color;
    banner.textContent = `${active.name} · ${active.description}`;
    this.eventBannerDismiss = nfrUIOverlay.mountHud(this, banner);
  }

  private tickBackgroundSystems(): void {
    const sec = Math.floor(Date.now() / 1000);
    if (sec === this.backgroundCheckSecond) return;
    this.backgroundCheckSecond = sec;
    const completedResearch = ResearchSystem.checkCompletion();
    if (completedResearch) {
      void saveSystem.persist();
      this.showHtmlToast(`${ResearchSystem.getDefs().find(d => d.id === completedResearch)?.name ?? Strings.researchTitle} complete`, 'green', 3500);
      this.buildAdPanel();
    }
    const missions = DroneMissionSystem.checkCompletions();
    if (missions.length > 0) {
      void saveSystem.persist();
      this.showHtmlToast(`${missions.length} ${Strings.droneBayMissionComplete}`, 'cyan', 3500);
      this.buildAdPanel();
    }
  }

  private spawnMilestoneVisuals(): void {
    const save = saveSystem.get();
    const gen = save.upgrades.gen;
    const magnet = save.upgrades.magnet;
    const wb = Balance.player.worldBounds;
    const worldW = wb.maxX - wb.minX;
    const worldH = wb.maxY - wb.minY;

    // Helper: bake a Graphics into a world-size RT, tag as milestone.
    const bakeMilestone = (depth: number, draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.RenderTexture => {
      const rt = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0, 0).setDepth(depth);
      const g = this.add.graphics();
      draw(g);
      rt.draw(g, -wb.minX, -wb.minY);
      g.destroy();
      rt.setPosition(wb.minX, wb.minY);
      rt.setData('milestone', true);
      return rt;
    };

    // Gen Lv. 3: conveyor belts connect generators (placeholder line strip).
    if (gen >= 3 && this.generators.length >= 2) {
      const a = this.generators[0];
      const b = this.generators[1];
      this.milestoneVisuals.push(bakeMilestone(1, g => {
        g.lineStyle(8, 0x202a3a, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2, 0x22f6ff, 0.5);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }));
    }

    // Gen Lv. 5: factory expands - zoom camera out slightly.
    this.cameras.main.setZoom(gen >= 5 ? 0.88 : 1);

    // Gen Lv. 10: reactor core in center (labeled placeholder).
    if (gen >= 10) {
      this.milestoneVisuals.push(bakeMilestone(1, g => {
        g.fillStyle(0xffd75a, 0.35);
        g.fillRect(-40, -40, 80, 80);
        g.lineStyle(2, 0xffd75a, 0.85);
        g.strokeRect(-40, -40, 80, 80);
      }));
      const reactorLabel = nfrEl('div', 'nfr-machine-label gold');
      reactorLabel.textContent = 'REACTOR';
      this.pinHtmlToWorld(reactorLabel, 0, 0);
    }

    // Magnet Lv. 3+: visible coil pillar (placeholder).
    if (magnet >= 3) {
      this.milestoneVisuals.push(bakeMilestone(1, g => {
        g.fillStyle(0x22f6ff, 0.55);
        g.fillRect(-220, 190, 40, 60);
        g.lineStyle(2, 0x22f6ff, 0.9);
        g.strokeRect(-220, 190, 40, 60);
      }));
      const coilLabel = nfrEl('div', 'nfr-machine-label cyan');
      coilLabel.textContent = 'COIL';
      this.pinHtmlToWorld(coilLabel, -200, 260);
    }
  }

  private onPickupOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, pickupObj) => {
    const p = pickupObj as Pickup;
    if (!p.active) return;
    const type: PickupType = p.type;
    const value = p.value;
    if (type === 'scrap') Economy.bankLoot(value, 0);
    else Economy.bankLoot(0, value);
    if (type === 'core') sfxCore();
    else sfxScrap();
    p.kill();
    bus.emit(Events.PICKUP_COLLECTED, type, value);
  };

  private tickDeployPad(dt: number): void {
    if (this.deployState === 'launching') return;
    const dx = this.player.x - this.padX;
    const dy = this.player.y - this.padY;
    const onPad = Math.hypot(dx, dy) <= this.padRadius;
    if (onPad) {
      this.deployHold = Math.min(Balance.factory.deployPad.holdSec, this.deployHold + dt);
      this.deployState = 'holding';
      if (this.deployHold >= Balance.factory.deployPad.holdSec) {
        this.deployState = 'launching';
        this.scene.start('RaidScene', { zoneId: RaidZoneSystem.getSelectedZone().id });
        return;
      }
    } else {
      this.deployHold = Math.max(0, this.deployHold - dt * 2);
      if (this.deployHold <= 0) this.deployState = 'idle';
    }
    this.drawPadFill();
  }

  private drawBackground(): void {
    ensureCommonFX(this);
    const wb = Balance.player.worldBounds;
    const camW = this.scale.width;
    const camH = this.scale.height;
    const worldW = wb.maxX - wb.minX;
    const worldH = wb.maxY - wb.minY;

    // Camera-fixed factory floor tile — industrial hazard stripes + rivets.
    const floor = this.add
      .tileSprite(0, 0, camW + 32, camH + 32, FACTORY_BG_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100);
    void floor;

    // World-tiled factory floor (large) so the player sees the same surface
    // wherever they walk. Lower alpha than the camera-fixed layer so the
    // bloom shows through.
    const worldFloor = this.add
      .tileSprite(wb.minX, wb.minY, worldW, worldH, FACTORY_BG_KEY)
      .setOrigin(0, 0)
      .setAlpha(0.55)
      .setDepth(-90);
    void worldFloor;

    const themeColor = CosmeticSystem.getEquippedThemeColor() || Balance.colors.background;
    // Bake grid + bounds into RenderTextures — no persistent Graphics objects.
    const step = Balance.ui.gridStep;
    const rtGrid = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0, 0).setDepth(-10);
    const gGrid = this.add.graphics();
    gGrid.lineStyle(1, themeColor, 0.22);
    for (let x = wb.minX; x <= wb.maxX; x += step) {
      gGrid.moveTo(x, wb.minY);
      gGrid.lineTo(x, wb.maxY);
    }
    for (let y = wb.minY; y <= wb.maxY; y += step) {
      gGrid.moveTo(wb.minX, y);
      gGrid.lineTo(wb.maxX, y);
    }
    gGrid.strokePath();
    rtGrid.draw(gGrid, -wb.minX, -wb.minY);
    gGrid.destroy();
    rtGrid.setPosition(wb.minX, wb.minY);

    // Glowing arena frame — baked into RT so applyGlow works on the sprite.
    const rtBounds = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0, 0).setDepth(-8);
    const gBounds = this.add.graphics();
    gBounds.lineStyle(3, themeColor, 0.85);
    gBounds.strokeRect(wb.minX, wb.minY, worldW, worldH);
    rtBounds.draw(gBounds, -wb.minX, -wb.minY);
    gBounds.destroy();
    rtBounds.setPosition(wb.minX, wb.minY);
    applyGlow(rtBounds, themeColor, 5, 0);

    // Vignette overlay focuses attention on the player.
    const vignette = this.add
      .image(camW / 2, camH / 2, VIGNETTE_KEY)
      .setScrollFactor(0)
      .setDepth(1100)
      .setAlpha(0.45);
    void vignette;
  }

  // Ambient props that exist regardless of upgrade level so a Gen Lv. 1
  // factory still reads as a populated workshop. Depth budget:
  //   -7 → wall panels (sit on the bounds frame)
  //   -6 → cable conduits running into the deploy pad
  //   -5 → loading-bay hazard stripes (floor decals above grid)
  //    0 → upright props (pipes, idle chassis) — below generators (2)
  //
  // Each layer is baked into a RenderTexture (draw once, render as sprite)
  // so there are no persistent Graphics objects on the display list.
  private drawAmbientDecor(): void {
    const wb = Balance.player.worldBounds;
    const worldW = wb.maxX - wb.minX;
    const worldH = wb.maxY - wb.minY;
    const themeColor = Balance.colors.background; // cyan accent
    const slate = 0x101820;
    const dim = 0x182838;

    // Helper: bake a Graphics into a fixed-size RT covering world bounds.
    const bake = (depth: number, draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.RenderTexture => {
      const rt = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0, 0).setDepth(depth);
      const g = this.add.graphics();
      draw(g);
      rt.draw(g, -wb.minX, -wb.minY);
      g.destroy();
      rt.setPosition(wb.minX, wb.minY);
      return rt;
    };

    // --- Wall panels along the far left/right edges. Periodic rectangles
    //     with a cyan accent stripe at the bottom so they read as
    //     industrial cabinets rather than solid walls. ---
    const wallHeight = 110;
    const wallWidth = 24;
    const wallStep = 180;
    const wallStartY = wb.minY + 70;
    this.ambientDecor.push(bake(-7, g => {
      g.fillStyle(dim, 0.9);
      for (let y = wallStartY; y < wb.maxY - 80; y += wallStep) {
        g.fillRect(wb.minX + 12, y, wallWidth, wallHeight);
        g.fillRect(wb.maxX - 12 - wallWidth, y, wallWidth, wallHeight);
      }
      g.fillStyle(themeColor, 0.45);
      for (let y = wallStartY; y < wb.maxY - 80; y += wallStep) {
        g.fillRect(wb.minX + 12, y + wallHeight - 4, wallWidth, 3);
        g.fillRect(wb.maxX - 12 - wallWidth, y + wallHeight - 4, wallWidth, 3);
      }
    }));

    // --- Cable conduits: dim trunks routed from each generator slot down
    //     to the smelter's east side (where the shipping conveyor exits)
    //     then east to the deploy pad. A thinner cyan trace on top so
    //     power feels "live". ---
    const smelterEastX = Balance.factory.smelter.x + 110;
    const drawCableRun = (g: Phaser.GameObjects.Graphics, lineColor: number, lineAlpha: number, width: number): void => {
      g.lineStyle(width, lineColor, lineAlpha);
      // Trunk along the top + bottom edges connecting all generators back
      // toward the smelter rather than running through the play area.
      for (const gpos of Balance.factory.generatorPositions) {
        const trunkY = gpos.y > 0 ? wb.maxY - 80 : wb.minY + 80;
        g.beginPath();
        g.moveTo(gpos.x, gpos.y + (gpos.y > 0 ? 28 : -28));
        g.lineTo(gpos.x, trunkY);
        g.lineTo(smelterEastX, trunkY);
        g.lineTo(smelterEastX, 0);
        g.strokePath();
      }
      // East-bound trunk to the pad.
      g.beginPath();
      g.moveTo(smelterEastX, 0);
      g.lineTo(this.padX - this.padRadius - 6, 0);
      g.strokePath();
    };
    this.ambientDecor.push(bake(-6, g => {
      drawCableRun(g, slate, 1, 5);
      drawCableRun(g, themeColor, 0.55, 2);
      // Junction nodes at the smelter junction and pad.
      g.fillStyle(themeColor, 0.75);
      g.fillCircle(smelterEastX, 0, 5);
      g.fillCircle(this.padX - this.padRadius - 6, 0, 5);
    }));

    // --- Loading-bay hazard stripes around the deploy pad. A box of
    //     diagonal yellow trapezoids cropped to leave the pad circle
    //     unobstructed so the player's eye still locks onto the pad. ---
    const bayHalf = 150;
    const stripeW = 18;
    const stripeGap = 16;
    const bayLeft = this.padX - bayHalf;
    const bayTop = this.padY - bayHalf;
    const bayBottom = this.padY + bayHalf;
    this.ambientDecor.push(bake(-5, g => {
      g.fillStyle(0xffd75a, 0.10);
      for (let i = -6; i < 18; i++) {
        const x0 = bayLeft + i * (stripeW + stripeGap);
        g.beginPath();
        g.moveTo(x0, bayTop);
        g.lineTo(x0 + stripeW, bayTop);
        g.lineTo(x0 + stripeW + (bayBottom - bayTop), bayBottom);
        g.lineTo(x0 + (bayBottom - bayTop), bayBottom);
        g.closePath();
        g.fillPath();
      }
    }));

    // --- Top + bottom pipe runs spanning the full world width. Slate
    //     trunk with a cyan inner trace and periodic bracket dots so the
    //     pipe reads as fastened to the wall. ---
    const pipeTopY = wb.minY + 34;
    const pipeBotY = wb.maxY - 34;
    this.ambientDecor.push(bake(0, g => {
      g.lineStyle(10, slate, 1);
      g.lineBetween(wb.minX + 50, pipeTopY, wb.maxX - 50, pipeTopY);
      g.lineBetween(wb.minX + 50, pipeBotY, wb.maxX - 50, pipeBotY);
      g.lineStyle(2.5, themeColor, 0.55);
      g.lineBetween(wb.minX + 50, pipeTopY, wb.maxX - 50, pipeTopY);
      g.lineBetween(wb.minX + 50, pipeBotY, wb.maxX - 50, pipeBotY);
      g.fillStyle(themeColor, 0.7);
      for (let x = wb.minX + 90; x < wb.maxX - 70; x += 130) {
        g.fillCircle(x, pipeTopY, 4);
        g.fillCircle(x, pipeBotY, 4);
      }
    }));

    // --- Idle chassis: 6 non-functional placeholder machine boxes in the
    //     dead zones around the deploy pad so the east side of the workshop
    //     reads as a populated shipping area. Distinct from the real
    //     Generator entity (different color + size) so the player doesn't
    //     mistake them for upgradeable hardware. ---
    const chassisSpots: Array<{ x: number; y: number; w: number; h: number }> = [
      { x: 220, y: -400, w: 100, h: 50 },
      { x: 220, y:  400, w: 100, h: 50 },
      { x: 360, y: -440, w: 70, h: 44 },
      { x: 360, y:  440, w: 70, h: 44 },
      { x: 680, y: -420, w: 80, h: 56 },
      { x: 680, y:  420, w: 80, h: 56 },
      // Two crates flanking the smelter for variety.
      { x:  60, y: -90, w: 50, h: 38 },
      { x:  60, y:  110, w: 50, h: 38 },
    ];
    this.ambientDecor.push(bake(0, g => {
      for (const s of chassisSpots) {
        const hx = s.x - s.w / 2;
        const hy = s.y - s.h / 2;
        g.fillStyle(slate, 0.9);
        g.fillRoundedRect(hx, hy, s.w, s.h, 6);
        g.lineStyle(1.5, themeColor, 0.5);
        g.strokeRoundedRect(hx, hy, s.w, s.h, 6);
        // Status LED — desaturated so it reads as "standby" rather than active.
        g.fillStyle(themeColor, 0.4);
        g.fillCircle(s.x, s.y - s.h / 2 + 6, 2);
        // Inner panel inset for a bit of texture.
        g.lineStyle(1, themeColor, 0.22);
        g.strokeRect(hx + 6, hy + 12, s.w - 12, s.h - 18);
      }
    }));

    // --- Floor decals: "RAW ORE" label on the west side and "SHIPPING" on the
    //     east side, baked as faint floor markings so the player gets the
    //     spatial story (ore enters west, deploys east). ---
    this.ambientDecor.push(bake(-4, g => {
      // West-side "MINING" zone outline.
      g.lineStyle(2, 0xffd75a, 0.18);
      g.strokeRect(wb.minX + 30, wb.minY + 80, 280, wb.maxY - wb.minY - 160);
      // East-side "SHIPPING" zone outline.
      g.lineStyle(2, 0x72ff9f, 0.18);
      g.strokeRect(this.padX - 200, wb.minY + 80, 400, wb.maxY - wb.minY - 160);
      // Central refinery zone.
      const sm = Balance.factory.smelter;
      g.lineStyle(2, themeColor, 0.22);
      g.strokeRect(sm.x - 130, sm.y - 110, 260, 220);
    }));
  }

  private drawPad(): void {
    // Pad base: SVG circle pinned to world position via worldPins.
    const cx = '#' + Balance.colors.extraction.toString(16).padStart(6, '0');
    const r = this.padRadius;
    const d = (r + 6) * 2;
    const padBaseEl = nfrEl('div', 'nfr-worldpin nfr-pad-base');
    padBaseEl.innerHTML =
      `<svg width="${d}" height="${d}" viewBox="${-r - 6} ${-r - 6} ${d} ${d}" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="0" cy="0" r="${r}" fill="${cx}" fill-opacity="0.14" stroke="${cx}" stroke-width="3" stroke-opacity="0.85"/>` +
      `<circle cx="0" cy="0" r="${r * 0.55}" fill="none" stroke="${cx}" stroke-width="1" stroke-opacity="0.4"/>` +
      `</svg>`;
    this.pinHtmlToWorld(padBaseEl, this.padX, this.padY);

    // Pad fill arc: SVG stroke-dashoffset arc, updated each frame in drawPadFill.
    const r2 = r * 0.82;
    this.padFillCircumference = 2 * Math.PI * r2;
    const d2 = (r2 + 8) * 2;
    const padFillEl = nfrEl('div', 'nfr-worldpin nfr-pad-fill');
    padFillEl.innerHTML =
      `<svg width="${d2}" height="${d2}" viewBox="${-r2 - 8} ${-r2 - 8} ${d2} ${d2}" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="0" cy="0" r="${r2}" fill="none" stroke="${cx}" stroke-width="6"` +
      ` stroke-dasharray="${this.padFillCircumference} ${this.padFillCircumference}"` +
      ` stroke-dashoffset="${this.padFillCircumference}" transform="rotate(-90 0 0)"/>` +
      `</svg>`;
    this.padFillArc = padFillEl.querySelector('circle') as SVGCircleElement;
    this.pinHtmlToWorld(padFillEl, this.padX, this.padY);

    // Deploy hint + zone label are HTML overlays pinned to the pad's world
    // position. Updated each frame in tickWorldPins() so they track camera
    // scroll without leaning on Phaser text rendering.
    this.padHintEl = nfrEl('div', 'nfr-pad-hint');
    this.padHintEl.textContent = Strings.factoryDeployHint;
    this.pinHtmlToWorld(this.padHintEl, this.padX, this.padY + this.padRadius + 18);

    this.zoneLabelEl = nfrEl('div', 'nfr-pad-zone');
    this.pinHtmlToWorld(this.zoneLabelEl, this.padX, this.padY - this.padRadius - 30);
    this.refreshZoneLabel();
  }

  private refreshZoneLabel(): void {
    if (!this.zoneLabelEl) return;
    const zone = RaidZoneSystem.getSelectedZone();
    this.zoneLabelEl.textContent = `${Strings.zoneDeployPrefix}${zone.name.toUpperCase()}`;
    this.zoneLabelEl.style.color = zone.color;
    this.zoneLabelEl.style.textShadow = `0 0 8px ${zone.color}`;
  }

  private drawPadFill(): void {
    if (!this.padFillArc) return;
    if (this.deployHold <= 0) {
      this.padFillArc.setAttribute('stroke-dashoffset', String(this.padFillCircumference));
      return;
    }
    const ratio = this.deployHold / Balance.factory.deployPad.holdSec;
    this.padFillArc.setAttribute('stroke-dashoffset', String(this.padFillCircumference * (1 - ratio)));
  }

  // §11 operator picker. Pinned to the viewport (scroll-factor 0) along the
  // bottom-center of the screen so it's reachable regardless of the player's
  // position in the factory. One tile per operator in OPERATOR_ORDER. Tap
  // an unlocked operator to select; tap a locked one with sufficient Cores
  // to unlock + select. Surge / Lodestone are flagged `locked: true` (no
  // implementation) and show "COMING SOON".
  private buildOperatorPanel(): void {
    this.destroyOperatorPanel();

    const wrap = nfrEl('div', 'nfr-operator-panel');

    // Header
    const header = nfrEl('div', 'nfr-operator-panel__header');
    header.textContent = Strings.operatorPanelTitle;
    wrap.appendChild(header);

    // Retention teaser — "next operator chase" line.
    const almost = RetentionSystem.almostThere();
    if (almost.nextOperator) {
      const next = almost.nextOperator;
      const def = OperatorDefs[next.id];
      const teaser = nfrEl('div', 'nfr-operator-panel__teaser');
      if (next.ready) teaser.classList.add('is-ready');
      teaser.textContent =
        `${Strings.almostNextOperatorPrefix}${def.name}` +
        `${Strings.almostNextOperatorMid}${next.cores}/${next.cost}` +
        `${Strings.almostNextOperatorSuffix}`;
      wrap.appendChild(teaser);
    }

    const row = nfrEl('div', 'nfr-operator-panel__row');
    for (const id of OPERATOR_ORDER) {
      row.appendChild(this.buildOperatorTile(id));
    }
    wrap.appendChild(row);

    this.operatorPanelDismiss = nfrUIOverlay.mountHud(this, wrap);
  }

  private buildOperatorTile(id: OperatorId): HTMLElement {
    const def = OperatorDefs[id];
    const isUnlocked = OperatorSystem.isUnlocked(id);
    const isSelected = OperatorSystem.getSelected() === id;
    const isLocked = def.locked;
    const tryQueued = OperatorSystem.getTryOut() === id;

    const tile = nfrEl('div', 'nfr-operator-tile');
    if (isSelected) tile.classList.add('is-selected');
    if (isLocked) tile.classList.add('is-coming-soon');
    else if (!isUnlocked) tile.classList.add('is-locked');

    // Selected/locked color from def.color
    const colorHex = '#' + def.color.toString(16).padStart(6, '0');
    tile.style.setProperty('--nfr-op-color', colorHex);

    // Triangle silhouette (SVG, mirroring the player ship)
    const icon = nfrEl('div', 'nfr-operator-tile__icon');
    icon.innerHTML =
      `<svg viewBox="-16 -14 32 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<path d="M14 0 L-12 -10 L-6 0 L-12 10 Z" fill="currentColor" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    tile.appendChild(icon);

    const name = nfrEl('div', 'nfr-operator-tile__name');
    name.textContent = def.name;
    tile.appendChild(name);

    const statusText = isLocked
      ? Strings.operatorComingSoon
      : isSelected
        ? Strings.operatorSelected
        : isUnlocked
          ? Strings.operatorUnlock
          : `${Strings.operatorCostPrefix}${def.unlockCost}${Strings.operatorCostSuffix}`;
    const status = nfrEl('div', 'nfr-operator-tile__status');
    status.textContent = statusText;
    tile.appendChild(status);

    const desc = nfrEl('div', 'nfr-operator-tile__desc');
    desc.textContent = def.description;
    tile.appendChild(desc);

    if (!isLocked) {
      tile.classList.add('is-clickable');
      tile.addEventListener('click', () => this.handleOperatorTilePress(id));
    }

    // M20 OPERATOR TRY-OUT pill.
    const showTryOut =
      !isUnlocked && saveSystem.get().tutorialDone && !tryQueued && !isLocked;
    if (showTryOut) {
      const pill = nfrEl('button', 'nfr-operator-tile__try');
      pill.textContent = Strings.adOperatorTryButton;
      pill.addEventListener('click', (ev: MouseEvent) => {
        ev.stopPropagation();
        void this.handleOperatorTryOut(id);
      });
      tile.appendChild(pill);
    } else if (tryQueued) {
      const queued = nfrEl('div', 'nfr-operator-tile__queued');
      queued.textContent = 'TRY QUEUED';
      tile.appendChild(queued);
    }

    return tile;
  }

  private handleOperatorTilePress(id: OperatorId): void {
    const def = OperatorDefs[id];
    if (def.locked) return;
    if (!OperatorSystem.isUnlocked(id)) {
      // Tap to unlock if affordable.
      const ok = OperatorSystem.unlock(id);
      if (!ok) return; // not enough cores
      sfxUpgradePurchased();
      OperatorSystem.select(id);
    } else {
      const before = OperatorSystem.getSelected();
      const ok = OperatorSystem.select(id);
      if (ok && before !== id) sfxCore();
    }
    void saveSystem.persist();
    // Refresh wallet display if any text shows balance + the panel itself.
    this.buildOperatorPanel();
  }

  private destroyOperatorPanel(): void {
    this.operatorPanelDismiss?.();
    this.operatorPanelDismiss = null;
  }

  // Toast on FactoryScene entry when there's any standing infestation.
  // Decoupled from the first-time modal — appears every visit until cleared.
  private maybeShowInfestationToast(): void {
    if (!InfestationSystem.hasInfestation()) return;
    if (!saveSystem.get().infestationTutorialSeen) return;
    this.showHtmlToast(Strings.infestationToast, 'red', 4500);
  }

  // Generic HTML toast — top-center pill that fades in/out and auto-dismisses.
  // Used for offline rewards (handled separately by WelcomeBack), infestation
  // warnings, quest claims, and ad rewards. Replaces the Phaser this.add.text
  // toasts that looked like browser default fonts on a black bar.
  private showHtmlToast(text: string, variant: 'gold' | 'green' | 'red' | 'cyan' = 'gold', durationMs = 3000): void {
    if (!this.toastMgr) this.toastMgr = new NfrToastManager(this);
    // Map our intent palette to the existing ToastManager variant set.
    const toastVariant =
      variant === 'red' ? 'alert' :
      variant === 'gold' || variant === 'green' ? 'reward' :
      'info';
    this.toastMgr.show({ text, variant: toastVariant, duration: durationMs });
  }

  // First-time-only mechanic explainer. Per Run C clarification #3, this is
  // the only mid-game text modal in the build (outside the FTUE tutorial).
  // Gated by save.infestationTutorialSeen.
  private maybeShowInfestationTutorialModal(): void {
    const save = saveSystem.get();
    if (save.infestationTutorialSeen) return;
    if (!InfestationSystem.hasInfestation()) return;

    const panel = nfrEl('div', 'nfr-panel red nfr-panel--confirm');
    const title = nfrEl('h2', 'nfr-panel__title');
    title.textContent = Strings.infestationModalTitle;
    panel.appendChild(title);
    const body = nfrEl('p', 'nfr-panel__body');
    body.textContent = Strings.infestationModalBody;
    panel.appendChild(body);
    const footer = nfrEl('div', 'nfr-panel__footer');
    let dismiss: (() => void) | null = null;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nfr-btn red nfr-btn--lg';
    closeBtn.textContent = Strings.infestationModalDismiss;
    closeBtn.addEventListener('click', () => {
      InfestationSystem.markTutorialSeen();
      void saveSystem.persist();
      dismiss?.();
    });
    footer.appendChild(closeBtn);
    panel.appendChild(footer);

    dismiss = nfrUIOverlay.mountModal(this, panel, { dismissOnBackdrop: false });
  }

  // §16.1 daily quest + §16.2 streak panel. Pinned to the right side of
  // the viewport beneath the upgrade panel. Shows the current quest text +
  // progress + claim button + streak counter. Gated by ftueUnlocks.dailyClaim
  // (set by the FTUE on tutorial extract).
  private buildQuestPanel(): void {
    this.destroyQuestPanel();
    const save = saveSystem.get();
    if (!save.ftueUnlocks.dailyClaim) return;
    if (save.raidsCompleted < 2) return;

    DailyQuestSystem.ensureTodaysQuest();
    const cur = DailyQuestSystem.getCurrent();

    const panel = nfrEl('div', 'nfr-panel cyan nfr-quest-card');

    const header = nfrEl('div', 'nfr-quest-card__title');
    header.textContent = Strings.questPanelTitle;
    panel.appendChild(header);
    const modifier = DailyQuestSystem.getModifier();
    if (modifier) {
      const pill = nfrEl('div', 'nfr-quest-card__streak');
      pill.textContent = modifier.name;
      pill.style.color = modifier.color;
      pill.style.borderColor = modifier.color;
      panel.appendChild(pill);
    }

    if (!cur) {
      const claimed = nfrEl('div', 'nfr-quest-card__claimed');
      claimed.textContent = '— claimed today —';
      panel.appendChild(claimed);
    } else {
      const text = nfrEl('div', 'nfr-quest-card__text');
      text.textContent = cur.def.text;
      panel.appendChild(text);

      const progRow = nfrEl('div', 'nfr-quest-card__progress');
      if (cur.completed) progRow.classList.add('is-complete');
      progRow.textContent =
        `${cur.progress}${Strings.questProgressMid}${cur.def.threshold}`;
      panel.appendChild(progRow);

      if (cur.completed) {
        const claim = nfrEl('button', 'nfr-quest-card__claim');
        claim.textContent = Strings.questClaimReady;
        claim.addEventListener('click', () => this.handleQuestClaim());
        panel.appendChild(claim);
      }
    }

    const streak = nfrEl('div', 'nfr-quest-card__streak');
    streak.textContent = `${Strings.streakLabel}${StreakSystem.getDay()}`;
    panel.appendChild(streak);

    this.questPanelDismiss = nfrUIOverlay.mountHud(this, panel);
  }

  private handleQuestClaim(): void {
    const result = DailyQuestSystem.claim();
    if (!result.ok) return;
    sfxCore();
    void saveSystem.persist();
    this.showHtmlToast(Strings.questRewardToast, 'gold', 3000);

    // Retention Phase 3 — surface streak progress in a follow-up toast so the
    // player sees the day-tier reward they just earned. Only fires when the
    // streak actually advanced (skips same-day double-claim no-ops) and a
    // bonus is attached to today's tier; the bare DAY counter alone is shown
    // in the quest panel header so we don't double-toast on a no-bonus day.
    const s = result.streak;
    if (s && s.advanced) {
      const parts: string[] = [];
      if (s.rewardScrap > 0) parts.push(`+${s.rewardScrap} Scrap`);
      if (s.rewardCores > 0) parts.push(`+${s.rewardCores} Core${s.rewardCores === 1 ? '' : 's'}`);
      if (s.rewardCosmetic) parts.push('+1 Cosmetic Shard');
      if (parts.length > 0) {
        const msg = `${Strings.streakDayPrefix}${s.newStreakDay}${Strings.streakDaySuffix} · ${parts.join(', ')}`;
        this.showHtmlToast(msg, 'green', 3500);
      }
    }
    this.buildQuestPanel();
  }

  private destroyQuestPanel(): void {
    this.questPanelDismiss?.();
    this.questPanelDismiss = null;
  }

  // §16.3 daily seed UI: a secondary "DAILY SEED" deploy button next to the
  // normal pad, plus a "TODAY'S BOARD" button that opens the local leaderboard.
  // The daily-seed button greys + relabels itself once the player has used
  // their one attempt today.
  private buildDailySeedAndLeaderboardButtons(): void {
    this.destroyDailySeedAndLeaderboard();

    // Gate behind tutorial completion so FTUE players see only the normal
    // deploy pad and don't get distracted by a secondary launch.
    if (!saveSystem.get().tutorialDone) return;

    const today = todayUtcDate();
    const attempted = LeaderboardSystem.hasAttemptedToday(today);

    // Daily seed button — HTML pill pinned to the world position just below
    // the deploy pad. Replaces the prior Phaser rectangle+text combo so it
    // picks up the design-system chamfered button styling.
    const seedBtn = nfrEl('button', `nfr-pad-seed-btn ${attempted ? 'is-attempted' : ''}`);
    seedBtn.textContent = attempted ? Strings.factoryDailySeedAttempted : Strings.factoryDailySeed;
    if (!attempted) {
      seedBtn.addEventListener('click', () => this.launchDailySeedRaid());
    } else {
      seedBtn.disabled = true;
    }
    this.pinHtmlToWorld(seedBtn, this.padX, this.padY + this.padRadius + 56);
    this.dailySeedObjects.push({ destroy: () => this.unpinHtmlFromWorld(seedBtn) });

    if (!attempted) {
      const seedHint = nfrEl('div', 'nfr-pad-seed-hint');
      seedHint.textContent = Strings.factoryDailySeedHint;
      this.pinHtmlToWorld(seedHint, this.padX, this.padY + this.padRadius + 90);
      this.dailySeedObjects.push({ destroy: () => this.unpinHtmlFromWorld(seedHint) });
    }

    // Leaderboard button — top-right corner, viewport-pinned. HTML overlay
    // styled via .nfr-topright-btn (neon violet pill matching the leaderboard
    // panel theme).
    const lbBtn = document.createElement('button');
    lbBtn.type = 'button';
    lbBtn.className = 'nfr-topright-btn';
    lbBtn.textContent = Strings.leaderboardButton;
    lbBtn.addEventListener('click', () => this.openLeaderboard());
    const dismissLb = nfrUIOverlay.mountHud(this, lbBtn);
    this.dailySeedObjects.push({ destroy: dismissLb });
  }

  private launchDailySeedRaid(): void {
    LeaderboardSystem.markAttempted(todayUtcDate());
    void saveSystem.persist();
    this.scene.start('RaidScene', { tutorial: false, mode: 'dailySeed' });
  }

  private openLeaderboard(): void {
    // Toggle: if already open, close it.
    if (this.leaderboardObjects.length > 0) {
      this.closeLeaderboard();
      return;
    }

    const panel = nfrEl('div', 'nfr-panel violet');
    panel.style.minWidth = '520px';
    panel.style.padding = '28px 32px 24px';

    const title = nfrEl('h1', 'nfr-panel__title');
    title.textContent = Strings.leaderboardTitle;
    panel.appendChild(title);

    // Honest disclosure: until a real backend lands the panel shows the
    // local player's own historical scores.
    if (!LeaderboardSystem.hasBackend()) {
      const note = nfrEl('div', 'nfr-panel__subtitle');
      note.style.fontStyle = 'italic';
      note.textContent = Strings.leaderboardLocalNote;
      panel.appendChild(note);
    }

    const body = nfrEl('div', 'nfr-panel__body');
    panel.appendChild(body);

    const entries = LeaderboardSystem.getTopEntries();
    if (entries.length === 0) {
      const empty = nfrEl('div', 'nfr-row__effect');
      empty.style.textAlign = 'center';
      empty.style.padding = '24px';
      empty.textContent = Strings.leaderboardEmpty;
      body.appendChild(empty);
    } else {
      const today = todayUtcDate();
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const row = nfrEl('div', 'nfr-row');
        row.style.gridTemplateColumns = '46px 1fr auto auto';
        row.style.alignItems = 'center';
        row.style.gap = '12px';

        const rank = nfrEl('div');
        rank.style.fontFamily = 'var(--nfr-font-display)';
        rank.style.fontSize = '15px';
        rank.style.color = 'var(--nfr-gold)';
        rank.style.textShadow = '0 0 6px var(--nfr-gold-glow)';
        rank.textContent = `#${i + 1}`;
        row.appendChild(rank);

        const date = nfrEl('div');
        date.style.fontFamily = 'var(--nfr-font-mono)';
        date.style.fontSize = '13px';
        date.style.color = 'var(--nfr-ink)';
        date.textContent = e.date === today ? `${e.date} (TODAY)` : e.date;
        row.appendChild(date);

        const score = nfrEl('div');
        score.style.fontFamily = 'var(--nfr-font-mono)';
        score.style.fontWeight = '700';
        score.style.fontSize = '14px';
        score.style.color = 'var(--nfr-cyan)';
        score.style.textShadow = '0 0 6px var(--nfr-cyan-glow)';
        score.textContent = `${e.score} ${Strings.summaryScrap}`;
        row.appendChild(score);

        if (e.isYou) {
          const you = nfrEl('div');
          you.style.fontFamily = 'var(--nfr-font-display)';
          you.style.fontSize = '11px';
          you.style.letterSpacing = '0.18em';
          you.style.color = 'var(--nfr-green)';
          you.style.textShadow = '0 0 6px var(--nfr-green-glow)';
          you.textContent = Strings.leaderboardYou;
          row.appendChild(you);
        } else {
          row.appendChild(nfrEl('span'));
        }

        body.appendChild(row);
      }
    }

    const footer = nfrEl('div', 'nfr-panel__footer');
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nfr-btn violet nfr-btn--lg';
    closeBtn.textContent = Strings.leaderboardClose;
    closeBtn.addEventListener('click', () => this.closeLeaderboard());
    footer.appendChild(closeBtn);
    panel.appendChild(footer);

    const dismiss = nfrUIOverlay.mountModal(this, panel, {
      dismissOnBackdrop: true,
      onDismiss: () => { this.leaderboardObjects = []; },
    });
    this.leaderboardObjects.push({ destroy: dismiss });
  }

  private closeLeaderboard(): void {
    for (const o of this.leaderboardObjects) o.destroy();
    this.leaderboardObjects = [];
  }

  private destroyDailySeedAndLeaderboard(): void {
    for (const o of this.dailySeedObjects) o.destroy();
    this.dailySeedObjects = [];
    this.closeLeaderboard();
  }

  // M20 — left-edge rewarded-ad / actions panel. Buttons:
  //   FACTORY BOOST   (gated on ftueUnlocks.factoryBoost; shows cooldown live)
  //   CLEAR INFESTATION (visible only when any machines are infested)
  //   DAILY CRATE     (visible only when player has raided today + not claimed)
  //   REFINERY        (always after tutorial)
  //   CONTRACTS       (always after tutorial; shows badge when claimable)
  //   PRESTIGE        (visible once threshold met or already prestiged once)
  //
  // M-overhaul: rebuilt as HTML+CSS column. Each button is a <button> with
  // the .nfr-action class + a color variant; state styling (active / cooldown
  // / disabled) is class-toggled, no manual fill/stroke updates.
  private buildAdPanel(): void {
    this.destroyAdPanel();
    const save = saveSystem.get();
    const col = nfrEl('div', 'nfr-actioncol');

    // FACTORY BOOST.
    if (save.ftueUnlocks.factoryBoost) {
      this.factoryBoostBtn = nfrActionBtn(this.factoryBoostLabelText(), 'gold', () =>
        this.handleFactoryBoost(),
      );
      col.appendChild(this.factoryBoostBtn);
      this.applyFactoryBoostVisuals();
    } else {
      this.factoryBoostBtn = null;
    }

    // CLEAR INFESTATION.
    if (InfestationSystem.hasInfestation()) {
      col.appendChild(nfrActionBtn(Strings.infestationClearAd, 'red', () =>
        this.handleClearInfestation(),
      ));
    }

    // DAILY CRATE (eligible) / claimed label.
    if (save.tutorialDone && AdManager.isDailyCrateEligible()) {
      col.appendChild(nfrActionBtn(Strings.adDailyCrateButton, 'violet', () =>
        this.handleDailyCrate(),
      ));
    } else if (save.tutorialDone && AdManager.isDailyCrateClaimedToday()) {
      const claimed = nfrEl('div', 'nfr-action__sub');
      claimed.textContent = Strings.adDailyCrateClaimed;
      col.appendChild(claimed);
    }

    // REFINERY / CONTRACTS / PRESTIGE.
    if (save.tutorialDone) {
      col.appendChild(nfrActionBtn(Strings.zonePanelButton, 'cyan', () =>
        openZonePanel(this, () => {
          this.refreshZoneLabel();
          this.buildAdPanel();
        }),
      ));
      col.appendChild(nfrActionBtn(Strings.refineryButton, 'violet', () => openRefineryPanel(this)));
      col.appendChild(nfrActionBtn(Strings.researchButton, 'violet', () => openResearchPanel(this, () => this.buildAdPanel())));
      col.appendChild(nfrActionBtn(Strings.droneBayButton, 'cyan', () => openDroneBayPanel(this, () => this.buildAdPanel())));

      // Weekly Boss (Signal Hydra) per blueprint §16.4. HTML/CSS-only
      // raid mode — visible once tutorial is done so it doesn't crowd
      // the early FTUE flow.
      col.appendChild(nfrActionBtn(Strings.weeklyBossButton, 'red', () => openWeeklyBossPanel(this)));

      const contractsBtn = nfrActionBtn(Strings.missionBoardTitle, 'gold', () => openMissionBoard(this));
      const claimable = RetentionSystem.almostThere().missionsReadyToClaim;
      if (claimable > 0) {
        const badge = nfrEl('span', 'nfr-action__badge');
        badge.textContent = String(claimable);
        contractsBtn.appendChild(badge);
      }
      col.appendChild(contractsBtn);
      col.appendChild(nfrActionBtn(Strings.dailyRewardsButton, 'gold', () => openDailyLoginPanel(this)));
      const wheelReady = save.adState.lastWheelSpin !== todayUtcDate();
      const wheelBtn = nfrActionBtn(Strings.fortuneWheelButton, wheelReady ? 'gold' : 'cyan', () => openFortuneWheelPanel(this, () => this.buildAdPanel()));
      if (!wheelReady) { wheelBtn.disabled = true; wheelBtn.classList.add('is-disabled'); }
      col.appendChild(wheelBtn);

      const eligible =
        save.upgrades.gen >= Balance.prestige.minGenLevel && save.cores >= Balance.prestige.minCores;
      if (eligible || save.prestige.cyberCores > 0) {
        col.appendChild(nfrActionBtn(Strings.prestigeButton, 'red', () =>
          openPrestigePanel(this, () => this.buildAdPanel()),
        ));
      }
    }

    this.adPanelDismiss = nfrUIOverlay.mountHud(this, col);
  }

  private destroyAdPanel(): void {
    this.adPanelDismiss?.();
    this.adPanelDismiss = null;
    this.factoryBoostBtn = null;
  }

  // Per-frame: refresh the FACTORY BOOST label so the cooldown ticks live
  // (1-second granularity).
  private tickAdPanel(): void {
    if (!this.factoryBoostBtn) return;
    const sec = Math.floor(Date.now() / 1000);
    if (sec === this.adPanelLastSecond) return;
    this.adPanelLastSecond = sec;
    // Preserve the badge node if any was appended (CONTRACTS uses one; the
    // factory-boost button doesn't, but the lookup is defensive).
    const badge = this.factoryBoostBtn.querySelector('.nfr-action__badge');
    this.factoryBoostBtn.textContent = this.factoryBoostBoostLabelText();
    if (badge) this.factoryBoostBtn.appendChild(badge);
    this.applyFactoryBoostVisuals();
  }

  private factoryBoostLabelText(): string {
    return this.factoryBoostBoostLabelText();
  }

  private factoryBoostBoostLabelText(): string {
    if (AdManager.isFactoryBoostActive()) {
      const secs = AdManager.factoryBoostCooldownRemainingSec();
      return `${Strings.adFactoryBoostActive} ${secs}s`;
    }
    if (AdManager.isFactoryBoostOnCooldown()) {
      const secs = AdManager.factoryBoostCooldownRemainingSec();
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${Strings.adFactoryBoostCooldown} ${m}:${s.toString().padStart(2, '0')}`;
    }
    return Strings.adFactoryBoostButton;
  }

  private applyFactoryBoostVisuals(): void {
    const btn = this.factoryBoostBtn;
    if (!btn) return;
    const onCd = AdManager.isFactoryBoostOnCooldown();
    const active = AdManager.isFactoryBoostActive();
    btn.classList.remove('gold', 'green', 'is-active', 'is-disabled');
    if (active) {
      btn.classList.add('green', 'is-active');
      btn.disabled = true;
    } else if (onCd) {
      btn.classList.add('gold', 'is-disabled');
      btn.disabled = true;
    } else {
      btn.classList.add('gold');
      btn.disabled = false;
    }
  }

  private async handleFactoryBoost(): Promise<void> {
    if (AdManager.isFactoryBoostOnCooldown()) return;
    this.scene.pause();
    const granted = await AdManager.offer(this, {
      title: Strings.adFactoryBoostTitle,
      description: Strings.adFactoryBoostDesc,
      placement: 'factoryBoost',
    });
    this.scene.resume();
    if (!granted) return;
    AdManager.activateFactoryBoost();
    void saveSystem.persist();
    // Regenerator drop cadence depends on SPM which depends on the boost
    // active state. Rebuild generators so they tick at the boosted rate.
    this.rebuildFactoryFloor();
    this.buildAdPanel();
  }

  private async handleClearInfestation(): Promise<void> {
    if (!InfestationSystem.hasInfestation()) return;
    this.scene.pause();
    const granted = await AdManager.offer(this, {
      title: Strings.adClearInfestationTitle,
      description: Strings.adClearInfestationDesc,
      borderColor: 0xff416b,
      placement: 'clearInfestation',
    });
    this.scene.resume();
    if (!granted) return;
    InfestationSystem.clearAllInfestation();
    void saveSystem.persist();
    this.rebuildFactoryFloor();
    this.buildAdPanel();
  }

  private async handleDailyCrate(): Promise<void> {
    if (!AdManager.isDailyCrateEligible()) return;
    this.scene.pause();
    const granted = await AdManager.offer(this, {
      title: Strings.adDailyCrateTitle,
      description: Strings.adDailyCrateDesc,
      borderColor: 0xa76cff,
      placement: 'dailyCrate',
    });
    this.scene.resume();
    if (!granted) return;
    const reward = AdManager.claimDailyCrate();
    if (reward.kind === 'scrap') Economy.bankLoot(reward.amount, 0);
    else Economy.bankLoot(0, reward.amount);
    void saveSystem.persist();
    this.showAdRewardToast(AdManager.formatDailyCrateRewardText(reward));
    this.buildAdPanel();
  }

  private showAdRewardToast(text: string): void {
    this.showHtmlToast(text, 'gold', 3500);
  }

  // M20 OPERATOR TRY-OUT — handler called from the operator tile's "TRY IN
  // NEXT RAID" button. Sets save.tryOutOperator so the next raid swaps the
  // selected operator for one run (consumed in RaidScene.finishRaid).
  private async handleOperatorTryOut(id: OperatorId): Promise<void> {
    const def = OperatorDefs[id];
    if (def.locked) return; // unimplemented operators can't be tried
    if (OperatorSystem.isUnlocked(id)) return; // already owned, no need
    this.scene.pause();
    const granted = await AdManager.offer(this, {
      title: Strings.adOperatorTryOutTitle,
      description: Strings.adOperatorTryOutDesc,
      borderColor: def.color,
      placement: 'operatorTryOut',
    });
    this.scene.resume();
    if (!granted) return;
    OperatorSystem.setTryOut(id);
    void saveSystem.persist();
    this.showAdRewardToast(Strings.adTryOutToast);
    this.buildOperatorPanel();
  }
}
