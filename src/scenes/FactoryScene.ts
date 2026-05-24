import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Pickup, type PickupType } from '../entities/Pickup';
import { Generator } from '../entities/Machine';
import { Drone } from '../entities/Drone';
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
import { openRefineryPanel, openMissionBoard, openPrestigePanel, openZonePanel } from '../ui/FactoryPanels';
import { ensureCommonFX, applyGlow, FACTORY_BG_KEY, VIGNETTE_KEY } from '../systems/NeonFX';
import { RetentionSystem } from '../systems/RetentionSystem';
import { WelcomeBack } from '../ui/WelcomeBack';
import { UIOverlay as nfrUIOverlay, el as nfrEl } from '../ui/overlay/UIOverlay';
import { RaidZoneSystem } from '../systems/RaidZoneSystem';

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

  private padX = Balance.factory.deployPad.x;
  private padY = Balance.factory.deployPad.y;
  private padRadius = Balance.factory.deployPad.radius;
  private padBase!: Phaser.GameObjects.Graphics;
  private padFill!: Phaser.GameObjects.Graphics;
  private zoneLabel: Phaser.GameObjects.Text | null = null;
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
  // the pad or once raidsCompleted advances past 1.
  private deployPrompt: Phaser.GameObjects.Text | null = null;
  private deployPromptTween: Phaser.Tweens.Tween | null = null;
  // M16 operator picker: rendered to the left of the deploy pad. Each entry
  // owns its own Phaser game objects so we can refresh state on click.
  private operatorPanelObjects: Phaser.GameObjects.GameObject[] = [];
  // M18 — quest panel handles, rebuilt on claim or raid-return.
  private questPanelObjects: Phaser.GameObjects.GameObject[] = [];
  // M19 — daily seed deploy button + leaderboard button + leaderboard modal.
  private dailySeedObjects: Phaser.GameObjects.GameObject[] = [];
  private leaderboardObjects: Phaser.GameObjects.GameObject[] = [];
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
  // Pinned try-out toast (shown briefly after the player accepts the
  // OPERATOR TRY-OUT ad). Destroyed automatically.
  private tryOutToast: Phaser.GameObjects.Text | null = null;
  private onUpgradePurchased = (..._args: unknown[]): void => this.handleUpgradePurchased();

  constructor() {
    super({ key: 'FactoryScene' });
  }

  create(): void {
    RaidZoneSystem.syncUnlocks();
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

    this.spawnGenerators();
    this.spawnMilestoneVisuals();
    this.spawnDrones();
    this.buildUpgradePanel();
    this.buildOperatorPanel();

    this.deployState = 'idle';
    this.deployHold = 0;

    bus.on(Events.UPGRADE_PURCHASED, this.onUpgradePurchased);

    this.showOfflineToast();
    this.refreshDeployPrompt();
    this.maybeShowInfestationToast();
    this.maybeShowInfestationTutorialModal();
    this.buildQuestPanel();
    this.buildDailySeedAndLeaderboardButtons();
    this.buildAdPanel();
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

    if (want && !this.deployPrompt) {
      this.deployPrompt = this.add
        .text(this.padX, this.padY - this.padRadius - 24, Strings.ftueDeployPrompt, {
          fontFamily: 'monospace',
          fontSize: '34px',
          color: '#72ff9f',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(3);
      this.deployPromptTween = this.tweens.add({
        targets: this.deployPrompt,
        scale: { from: 1, to: 1.18 },
        alpha: { from: 1, to: 0.7 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!want && this.deployPrompt) {
      this.deployPromptTween?.stop();
      this.deployPromptTween = null;
      this.deployPrompt.destroy();
      this.deployPrompt = null;
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
      p.updateMagnet(dt, pullX, pullY, radius);
    }

    this.tickDeployPad(dt);
    this.tickAdPanel();
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
    for (const drone of this.drones) drone.destroy();
    this.drones = [];
    for (const card of this.upgradeCards) card.destroy();
    this.upgradeCards = [];
    for (const v of this.milestoneVisuals) v.destroy();
    this.milestoneVisuals = [];
    for (const v of this.ambientDecor) v.destroy();
    this.ambientDecor = [];
    this.deployPromptTween?.stop();
    this.deployPromptTween = null;
    this.deployPrompt?.destroy();
    this.deployPrompt = null;
    this.zoneLabel?.destroy();
    this.zoneLabel = null;
    this.destroyOperatorPanel();
    this.destroyQuestPanel();
    this.destroyDailySeedAndLeaderboard();
    this.destroyAdPanel();
    this.tryOutToast?.destroy();
    this.tryOutToast = null;
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

  private spawnScrapAt(gen: Generator): void {
    const pos = gen.randomDropPosition();
    const p = this.pickups.get(pos.x, pos.y) as Pickup | null;
    if (!p) return;
    p.spawn(pos.x, pos.y, 'scrap', 1);
  }

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
    for (const drone of this.drones) drone.destroy();
    this.drones = [];
    for (const v of this.milestoneVisuals.filter(v => v.getData('milestone') === true)) v.destroy();
    this.milestoneVisuals = this.milestoneVisuals.filter(v => v.getData('milestone') !== true);

    this.spawnGenerators();
    this.spawnMilestoneVisuals();
    this.spawnDrones();
  }

  private showOfflineToast(): void {
    // Retention pass — the silent boot has been replaced with a sequenced
    // welcome-back ceremony. WelcomeBack pulls the pending offline scrap
    // (transient flag in saveSystem) plus the boot-banner queue
    // (comeback / payday / streak warnings) and stages them with a count-up
    // animation, a streak chip, and a payday badge. Idempotent across
    // FactoryScene visits — banners are consumed once per session.
    const amount = saveSystem.consumePendingOfflineScrap();
    const banners = RetentionSystem.consumeBootBanners();
    if (amount <= 0 && banners.length === 0 && RetentionSystem.currentStreakDay() === 0) return;
    WelcomeBack.show(this, { offlineScrap: amount, banners });
  }

  private spawnMilestoneVisuals(): void {
    const save = saveSystem.get();
    const gen = save.upgrades.gen;
    const magnet = save.upgrades.magnet;

    // Gen Lv. 3: conveyor belts connect generators (placeholder line strip).
    if (gen >= 3 && this.generators.length >= 2) {
      const a = this.generators[0];
      const b = this.generators[1];
      const belt = this.add.graphics();
      belt.setDepth(1);
      belt.lineStyle(8, 0x202a3a, 1);
      belt.lineBetween(a.x, a.y, b.x, b.y);
      belt.lineStyle(2, 0x22f6ff, 0.5);
      belt.lineBetween(a.x, a.y, b.x, b.y);
      belt.setData('milestone', true);
      this.milestoneVisuals.push(belt);
    }

    // Gen Lv. 5: factory expands - zoom camera out slightly.
    this.cameras.main.setZoom(gen >= 5 ? 0.88 : 1);

    // Gen Lv. 10: reactor core in center (labeled placeholder).
    if (gen >= 10) {
      const reactor = this.add.rectangle(0, 0, 80, 80, 0xffd75a, 0.35);
      reactor.setStrokeStyle(2, 0xffd75a, 0.85);
      reactor.setDepth(1);
      reactor.setData('milestone', true);
      this.milestoneVisuals.push(reactor);
      const label = this.add
        .text(0, 0, 'REACTOR', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffd75a',
        })
        .setOrigin(0.5)
        .setDepth(2);
      label.setData('milestone', true);
      this.milestoneVisuals.push(label);
    }

    // Magnet Lv. 3+: visible coil pillar (placeholder).
    if (magnet >= 3) {
      const coil = this.add.rectangle(-200, 220, 40, 60, 0x22f6ff, 0.55);
      coil.setStrokeStyle(2, 0x22f6ff, 0.9);
      coil.setDepth(1);
      coil.setData('milestone', true);
      this.milestoneVisuals.push(coil);
      const label = this.add
        .text(-200, 260, 'COIL', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#22f6ff',
        })
        .setOrigin(0.5)
        .setDepth(2);
      label.setData('milestone', true);
      this.milestoneVisuals.push(label);
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
    const grid = this.add.graphics();
    grid.lineStyle(1, themeColor, 0.22);
    const step = Balance.ui.gridStep;
    for (let x = wb.minX; x <= wb.maxX; x += step) {
      grid.moveTo(x, wb.minY);
      grid.lineTo(x, wb.maxY);
    }
    for (let y = wb.minY; y <= wb.maxY; y += step) {
      grid.moveTo(wb.minX, y);
      grid.lineTo(wb.maxX, y);
    }
    grid.strokePath();
    grid.setDepth(-10);

    // Glowing arena frame so the factory's bounds read clearly.
    const bounds = this.add.graphics();
    bounds.lineStyle(3, themeColor, 0.85);
    bounds.strokeRect(wb.minX, wb.minY, worldW, worldH);
    bounds.setDepth(-8);
    applyGlow(bounds, themeColor, 5, 0);

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
  // All graphics are single Phaser.Graphics nodes so the cost is one draw
  // per layer regardless of how many segments / brackets render.
  private drawAmbientDecor(): void {
    const wb = Balance.player.worldBounds;
    const themeColor = Balance.colors.background; // cyan accent
    const slate = 0x101820;
    const dim = 0x182838;

    // --- Wall panels along the far left/right edges. Periodic rectangles
    //     with a cyan accent stripe at the bottom so they read as
    //     industrial cabinets rather than solid walls. ---
    const walls = this.add.graphics().setDepth(-7);
    const wallHeight = 110;
    const wallWidth = 24;
    const wallStep = 180;
    const wallStartY = wb.minY + 70;
    walls.fillStyle(dim, 0.9);
    for (let y = wallStartY; y < wb.maxY - 80; y += wallStep) {
      walls.fillRect(wb.minX + 12, y, wallWidth, wallHeight);
      walls.fillRect(wb.maxX - 12 - wallWidth, y, wallWidth, wallHeight);
    }
    walls.fillStyle(themeColor, 0.45);
    for (let y = wallStartY; y < wb.maxY - 80; y += wallStep) {
      walls.fillRect(wb.minX + 12, y + wallHeight - 4, wallWidth, 3);
      walls.fillRect(wb.maxX - 12 - wallWidth, y + wallHeight - 4, wallWidth, 3);
    }
    this.ambientDecor.push(walls);

    // --- Cable conduits: dim trunks routed from each generator slot to the
    //     deploy pad, with a thinner cyan trace on top so power feels
    //     "live". Uses generatorPositions (not the spawned generators) so
    //     the cables exist even when later slots are still locked. ---
    const cables = this.add.graphics().setDepth(-6);
    const drawCableRun = (lineColor: number, lineAlpha: number, width: number): void => {
      cables.lineStyle(width, lineColor, lineAlpha);
      for (const gpos of Balance.factory.generatorPositions) {
        cables.beginPath();
        cables.moveTo(gpos.x + Balance.factory.generatorSize / 2, gpos.y);
        cables.lineTo(0, gpos.y);
        cables.lineTo(0, 0);
        cables.lineTo(this.padX - this.padRadius - 6, 0);
        cables.strokePath();
      }
    };
    drawCableRun(slate, 1, 5);
    drawCableRun(themeColor, 0.55, 2);
    // Junction nodes at the bends so the cable run reads as routed.
    cables.fillStyle(themeColor, 0.75);
    for (const gpos of Balance.factory.generatorPositions) {
      cables.fillCircle(0, gpos.y, 4);
    }
    cables.fillCircle(0, 0, 5);
    this.ambientDecor.push(cables);

    // --- Loading-bay hazard stripes around the deploy pad. A box of
    //     diagonal yellow trapezoids cropped to leave the pad circle
    //     unobstructed so the player's eye still locks onto the pad. ---
    const stripes = this.add.graphics().setDepth(-5);
    stripes.fillStyle(0xffd75a, 0.10);
    const bayHalf = 150;
    const stripeW = 18;
    const stripeGap = 16;
    const bayLeft = this.padX - bayHalf;
    const bayTop = this.padY - bayHalf;
    const bayBottom = this.padY + bayHalf;
    for (let i = -6; i < 18; i++) {
      const x0 = bayLeft + i * (stripeW + stripeGap);
      stripes.beginPath();
      stripes.moveTo(x0, bayTop);
      stripes.lineTo(x0 + stripeW, bayTop);
      stripes.lineTo(x0 + stripeW + (bayBottom - bayTop), bayBottom);
      stripes.lineTo(x0 + (bayBottom - bayTop), bayBottom);
      stripes.closePath();
      stripes.fillPath();
    }
    // Punch out the pad circle so the stripes don't fight the deploy ring.
    // We can't subtract from a Graphics path in Phaser easily, so we draw
    // a dark disc on top at the same depth — visually equivalent.
    stripes.fillStyle(parseInt(Balance.factory.backgroundColor.slice(1), 16), 1);
    stripes.fillCircle(this.padX, this.padY, this.padRadius + 6);
    this.ambientDecor.push(stripes);

    // --- Top + bottom pipe runs spanning the full world width. Slate
    //     trunk with a cyan inner trace and periodic bracket dots so the
    //     pipe reads as fastened to the wall. ---
    const pipes = this.add.graphics().setDepth(0);
    const pipeTopY = wb.minY + 34;
    const pipeBotY = wb.maxY - 34;
    pipes.lineStyle(10, slate, 1);
    pipes.lineBetween(wb.minX + 50, pipeTopY, wb.maxX - 50, pipeTopY);
    pipes.lineBetween(wb.minX + 50, pipeBotY, wb.maxX - 50, pipeBotY);
    pipes.lineStyle(2.5, themeColor, 0.55);
    pipes.lineBetween(wb.minX + 50, pipeTopY, wb.maxX - 50, pipeTopY);
    pipes.lineBetween(wb.minX + 50, pipeBotY, wb.maxX - 50, pipeBotY);
    pipes.fillStyle(themeColor, 0.7);
    for (let x = wb.minX + 90; x < wb.maxX - 70; x += 130) {
      pipes.fillCircle(x, pipeTopY, 4);
      pipes.fillCircle(x, pipeBotY, 4);
    }
    this.ambientDecor.push(pipes);

    // --- Idle chassis: 6 non-functional placeholder machine boxes in the
    //     dead zones so the workshop has neighbours. Distinct from the
    //     real Generator entity (different color + size) so the player
    //     doesn't mistake them for upgradeable hardware. ---
    const chassis = this.add.graphics().setDepth(0);
    const chassisSpots: Array<{ x: number; y: number; w: number; h: number }> = [
      { x: -650, y: -350, w: 80, h: 56 },
      { x: -650, y: 360, w: 80, h: 56 },
      { x: 130, y: -380, w: 110, h: 50 },
      { x: 130, y: 360, w: 110, h: 50 },
      { x: 660, y: -350, w: 80, h: 56 },
      { x: 660, y: 360, w: 80, h: 56 },
    ];
    for (const s of chassisSpots) {
      const hx = s.x - s.w / 2;
      const hy = s.y - s.h / 2;
      chassis.fillStyle(slate, 0.9);
      chassis.fillRoundedRect(hx, hy, s.w, s.h, 6);
      chassis.lineStyle(1.5, themeColor, 0.5);
      chassis.strokeRoundedRect(hx, hy, s.w, s.h, 6);
      // Status LED — desaturated so it reads as "standby" rather than active.
      chassis.fillStyle(themeColor, 0.4);
      chassis.fillCircle(s.x, s.y - s.h / 2 + 6, 2);
      // Inner panel inset for a bit of texture.
      chassis.lineStyle(1, themeColor, 0.22);
      chassis.strokeRect(hx + 6, hy + 12, s.w - 12, s.h - 18);
    }
    this.ambientDecor.push(chassis);
  }

  private drawPad(): void {
    this.padBase = this.add.graphics();
    this.padBase.setDepth(2);
    this.padBase.fillStyle(Balance.colors.extraction, 0.14);
    this.padBase.fillCircle(this.padX, this.padY, this.padRadius);
    this.padBase.lineStyle(3, Balance.colors.extraction, 0.85);
    this.padBase.strokeCircle(this.padX, this.padY, this.padRadius);
    this.padBase.lineStyle(1, Balance.colors.extraction, 0.4);
    this.padBase.strokeCircle(this.padX, this.padY, this.padRadius * 0.55);

    this.padFill = this.add.graphics();
    this.padFill.setDepth(3);

    this.add
      .text(this.padX, this.padY + this.padRadius + 18, Strings.factoryDeployHint, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#72ff9f',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(3);

    this.zoneLabel = this.add
      .text(this.padX, this.padY - this.padRadius - 42, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffd75a',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(3);
    this.refreshZoneLabel();
  }

  private refreshZoneLabel(): void {
    if (!this.zoneLabel) return;
    const zone = RaidZoneSystem.getSelectedZone();
    this.zoneLabel.setText(`${Strings.zoneDeployPrefix}${zone.name.toUpperCase()}`);
    this.zoneLabel.setColor(zone.color);
  }

  private drawPadFill(): void {
    this.padFill.clear();
    if (this.deployHold <= 0) return;
    const ratio = this.deployHold / Balance.factory.deployPad.holdSec;
    this.padFill.lineStyle(6, Balance.colors.extraction, 1);
    const start = -Math.PI / 2;
    const end = start + ratio * Math.PI * 2;
    this.padFill.beginPath();
    this.padFill.arc(this.padX, this.padY, this.padRadius * 0.82, start, end, false);
    this.padFill.strokePath();
  }

  // §11 operator picker. Pinned to the viewport (scroll-factor 0) along the
  // bottom-center of the screen so it's reachable regardless of the player's
  // position in the factory. One tile per operator in OPERATOR_ORDER. Tap
  // an unlocked operator to select; tap a locked one with sufficient Cores
  // to unlock + select. Surge / Lodestone are flagged `locked: true` (no
  // implementation) and show "COMING SOON".
  private buildOperatorPanel(): void {
    this.destroyOperatorPanel();

    const tileW = 100;
    const tileH = 110;
    const gap = 14;
    const totalW = OPERATOR_ORDER.length * tileW + (OPERATOR_ORDER.length - 1) * gap;
    const startX = (this.scale.width - totalW) / 2;
    const y = this.scale.height - tileH - 16;

    const header = this.add
      .text(this.scale.width / 2, y - 18, Strings.operatorPanelTitle, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#22f6ff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2050);
    this.operatorPanelObjects.push(header);

    // Retention pass — "next operator chase" line. Blueprint §11.2 calls this
    // out as the Day-2 retention driver. Show progress as "VANTA  48/50
    // Cores" so the player always has a visible meta-loop reward 1-2 raids
    // away. Affordable → green text + bright pulse to push the click.
    const almost = RetentionSystem.almostThere();
    if (almost.nextOperator) {
      const next = almost.nextOperator;
      const def = OperatorDefs[next.id];
      const text = `${Strings.almostNextOperatorPrefix}${def.name}${Strings.almostNextOperatorMid}${next.cores}/${next.cost}${Strings.almostNextOperatorSuffix}`;
      const color = next.ready ? '#72ff9f' : '#ffd75a';
      const teaser = this.add
        .text(this.scale.width / 2, y - 36, text, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color,
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(2050);
      this.operatorPanelObjects.push(teaser);
      if (next.ready) {
        this.tweens.add({
          targets: teaser,
          alpha: { from: 1, to: 0.5 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    for (let i = 0; i < OPERATOR_ORDER.length; i++) {
      const id = OPERATOR_ORDER[i];
      const x = startX + i * (tileW + gap);
      this.buildOperatorTile(id, x, y, tileW, tileH);
    }
  }

  private buildOperatorTile(id: OperatorId, x: number, y: number, w: number, h: number): void {
    const def = OperatorDefs[id];
    const isUnlocked = OperatorSystem.isUnlocked(id);
    const isSelected = OperatorSystem.getSelected() === id;
    const isLocked = def.locked;

    // Background tile. Selected gets a brighter border.
    const bg = this.add
      .rectangle(x + w / 2, y + h / 2, w, h, 0x0a1014, 0.92)
      .setStrokeStyle(isSelected ? 3 : 2, isSelected ? def.color : 0x4a5560, isSelected ? 1 : 0.7)
      .setScrollFactor(0)
      .setDepth(2050);
    this.operatorPanelObjects.push(bg);

    // Silhouette - dim when locked, full color when selectable.
    const silhouette = this.add.graphics().setScrollFactor(0).setDepth(2051);
    silhouette.setPosition(x + w / 2, y + 28);
    silhouette.fillStyle(def.color, isLocked || !isUnlocked ? 0.25 : 0.85);
    silhouette.lineStyle(2, def.color, isLocked || !isUnlocked ? 0.35 : 1);
    // Triangle silhouette pointing right - mirrors the player ship.
    silhouette.beginPath();
    silhouette.moveTo(14, 0);
    silhouette.lineTo(-12, -10);
    silhouette.lineTo(-6, 0);
    silhouette.lineTo(-12, 10);
    silhouette.closePath();
    silhouette.fillPath();
    silhouette.strokePath();
    this.operatorPanelObjects.push(silhouette);

    // Name
    const name = this.add
      .text(x + w / 2, y + 52, def.name, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: isLocked ? '#666666' : '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2051);
    this.operatorPanelObjects.push(name);

    // Status line (state-dependent)
    const statusText = isLocked
      ? Strings.operatorComingSoon
      : isSelected
        ? Strings.operatorSelected
        : isUnlocked
          ? Strings.operatorUnlock
          : `${Strings.operatorCostPrefix}${def.unlockCost}${Strings.operatorCostSuffix}`;
    const statusColor = isLocked
      ? '#666666'
      : isSelected
        ? '#72ff9f'
        : isUnlocked
          ? '#22f6ff'
          : '#ffd75a';
    const status = this.add
      .text(x + w / 2, y + 70, statusText, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: statusColor,
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2051);
    this.operatorPanelObjects.push(status);

    // Description
    const desc = this.add
      .text(x + w / 2, y + h - 18, def.description, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: isLocked ? '#444444' : '#88a0a8',
        wordWrap: { width: w - 8 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2051);
    this.operatorPanelObjects.push(desc);

    if (isLocked) return; // No interactive zone for unimplemented operators.

    const hit = this.add
      .zone(x, y, w, h)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2052)
      .setInteractive({ useHandCursor: true });
    this.operatorPanelObjects.push(hit);
    hit.on('pointerdown', () => this.handleOperatorTilePress(id));

    // M20 OPERATOR TRY-OUT — implemented but not yet unlocked tiles get a
    // small "TRY IN NEXT RAID" pill above the tile that routes through the
    // rewarded-ad path. Tutorial-gated: don't surface this until the player
    // is past the FTUE so the first impression isn't ad-cluttered.
    const showTryOut =
      !isUnlocked && saveSystem.get().tutorialDone && OperatorSystem.getTryOut() !== id;
    if (showTryOut) {
      const tryY = y - 22;
      const tryBg = this.add
        .rectangle(x + w / 2, tryY, w - 8, 18, 0xa76cff, 1)
        .setStrokeStyle(1, 0xffffff, 0.9)
        .setScrollFactor(0)
        .setDepth(2053)
        .setInteractive({ useHandCursor: true });
      const tryLabel = this.add
        .text(x + w / 2, tryY, Strings.adOperatorTryButton, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#000000',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2054);
      this.operatorPanelObjects.push(tryBg);
      this.operatorPanelObjects.push(tryLabel);
      tryBg.on('pointerdown', () => {
        void this.handleOperatorTryOut(id);
      });
    } else if (OperatorSystem.getTryOut() === id) {
      // Already queued — show a confirming label so the player knows the
      // next raid will use this operator.
      const tryY = y - 22;
      const queuedLabel = this.add
        .text(x + w / 2, tryY, 'TRY QUEUED', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#72ff9f',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2054);
      this.operatorPanelObjects.push(queuedLabel);
    }
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
    for (const o of this.operatorPanelObjects) o.destroy();
    this.operatorPanelObjects = [];
  }

  // Toast on FactoryScene entry when there's any standing infestation.
  // Decoupled from the first-time modal — appears every visit until cleared.
  private maybeShowInfestationToast(): void {
    if (!InfestationSystem.hasInfestation()) return;
    // Don't show alongside the explainer modal on the very first visit.
    if (!saveSystem.get().infestationTutorialSeen) return;
    const toast = this.add
      .text(this.scale.width / 2, 100, Strings.infestationToast, {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ff416b',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#1a0a14',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2200)
      .setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: 120,
      duration: 320,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(4500, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 500,
        onComplete: () => toast.destroy(),
      });
    });
  }

  // First-time-only mechanic explainer. Per Run C clarification #3, this is
  // the only mid-game text modal in the build (outside the FTUE tutorial).
  // Gated by save.infestationTutorialSeen.
  private maybeShowInfestationTutorialModal(): void {
    const save = saveSystem.get();
    if (save.infestationTutorialSeen) return;
    if (!InfestationSystem.hasInfestation()) return;

    const w = this.scale.width;
    const h = this.scale.height;
    const layer: Phaser.GameObjects.GameObject[] = [];
    const backdrop = this.add
      .rectangle(0, 0, w, h, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3000)
      .setInteractive();
    layer.push(backdrop);

    const panelW = 560;
    const panelH = 280;
    const panel = this.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x101820, 0.98)
      .setStrokeStyle(3, 0xff416b, 0.95)
      .setScrollFactor(0)
      .setDepth(3001);
    layer.push(panel);

    layer.push(
      this.add
        .text(w / 2, h / 2 - panelH / 2 + 28, Strings.infestationModalTitle, {
          fontFamily: 'monospace',
          fontSize: '26px',
          color: '#ff416b',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(3002),
    );
    layer.push(
      this.add
        .text(w / 2, h / 2 - 20, Strings.infestationModalBody, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: panelW - 60 },
          lineSpacing: 6,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(3002),
    );
    const buttonY = h / 2 + panelH / 2 - 40;
    const btn = this.add
      .rectangle(w / 2, buttonY, 200, 44, 0xff416b, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setScrollFactor(0)
      .setDepth(3002)
      .setInteractive({ useHandCursor: true });
    layer.push(btn);
    layer.push(
      this.add
        .text(w / 2, buttonY, Strings.infestationModalDismiss, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#000000',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3003),
    );
    const dismiss = (): void => {
      InfestationSystem.markTutorialSeen();
      void saveSystem.persist();
      for (const o of layer) o.destroy();
    };
    btn.on('pointerdown', dismiss);
  }

  // §16.1 daily quest + §16.2 streak panel. Pinned to the right side of
  // the viewport beneath the upgrade panel. Shows the current quest text +
  // progress + claim button + streak counter. Gated by ftueUnlocks.dailyClaim
  // (set by the FTUE on tutorial extract).
  private buildQuestPanel(): void {
    this.destroyQuestPanel();
    const save = saveSystem.get();
    if (!save.ftueUnlocks.dailyClaim) return;
    // Per spec: "panel only appears after tutorial done + first real raid".
    // raidsCompleted counts the tutorial as 1, so >=2 means at least one
    // real raid has finished.
    if (save.raidsCompleted < 2) return;

    DailyQuestSystem.ensureTodaysQuest();
    const cur = DailyQuestSystem.getCurrent();

    // Bottom-left placement avoids the right-side upgrade panel and the
    // bottom-center operator picker. The "right side panel beneath upgrades"
    // wording from spec didn't fit when six upgrade rows reach near the
    // bottom of the viewport, so we move to the symmetric corner.
    const panelW = 320;
    const panelH = 96;
    const x = 12;
    const startY = this.scale.height - panelH - 20;

    const header = this.add
      .text(x + 4, startY - 18, Strings.questPanelTitle, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#22f6ff',
      })
      .setScrollFactor(0)
      .setDepth(2000);
    this.questPanelObjects.push(header);

    const cardBg = this.add
      .rectangle(x, startY, panelW, panelH, 0x0a1014, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x22f6ff, 0.5)
      .setScrollFactor(0)
      .setDepth(2000);
    this.questPanelObjects.push(cardBg);

    if (!cur) {
      const txt = this.add
        .text(x + 12, startY + 14, '— claimed today —', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#88a0a8',
        })
        .setScrollFactor(0)
        .setDepth(2001);
      this.questPanelObjects.push(txt);
    } else {
      const questText = this.add
        .text(x + 12, startY + 10, cur.def.text, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffffff',
          wordWrap: { width: panelW - 24 },
        })
        .setScrollFactor(0)
        .setDepth(2001);
      this.questPanelObjects.push(questText);

      const progressText = this.add
        .text(x + 12, startY + 46, `${cur.progress}${Strings.questProgressMid}${cur.def.threshold}`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: cur.completed ? '#72ff9f' : '#22f6ff',
        })
        .setScrollFactor(0)
        .setDepth(2001);
      this.questPanelObjects.push(progressText);

      if (cur.completed) {
        const btn = this.add
          .rectangle(x + panelW - 78, startY + 52, 130, 28, 0x72ff9f, 1)
          .setStrokeStyle(2, 0xffffff, 0.9)
          .setScrollFactor(0)
          .setDepth(2002)
          .setInteractive({ useHandCursor: true });
        this.questPanelObjects.push(btn);
        const btnLabel = this.add
          .text(x + panelW - 78, startY + 52, Strings.questClaimReady, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#000000',
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2003);
        this.questPanelObjects.push(btnLabel);
        btn.on('pointerdown', () => this.handleQuestClaim());
      }
    }

    const streakDay = StreakSystem.getDay();
    const streakText = this.add
      .text(x + 12, startY + 70, `${Strings.streakLabel}${streakDay}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffd75a',
      })
      .setScrollFactor(0)
      .setDepth(2001);
    this.questPanelObjects.push(streakText);
  }

  private handleQuestClaim(): void {
    const result = DailyQuestSystem.claim();
    if (!result.ok) return;
    sfxCore();
    void saveSystem.persist();
    // Toast the headline reward; the streak's own day-tier bonus is paid
    // silently into the wallet (visible via the Scrap/Cores HUD).
    const toast = this.add
      .text(this.scale.width / 2, 60, Strings.questRewardToast, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffd75a',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#0a1014',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2200)
      .setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, y: 80, duration: 320, ease: 'Cubic.easeOut' });
    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: toast, alpha: 0, duration: 500, onComplete: () => toast.destroy() });
    });
    this.buildQuestPanel();
  }

  private destroyQuestPanel(): void {
    for (const o of this.questPanelObjects) o.destroy();
    this.questPanelObjects = [];
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

    // Daily seed button — placed under the deploy pad.
    const btnW = 160;
    const btnH = 40;
    const x = this.padX;
    const y = this.padY + this.padRadius + 56;

    const seedBg = this.add
      .rectangle(x, y, btnW, btnH, attempted ? 0x444444 : 0xa76cff, attempted ? 0.55 : 1)
      .setStrokeStyle(2, 0xffffff, attempted ? 0.25 : 0.85)
      .setDepth(3);
    this.dailySeedObjects.push(seedBg);
    const seedLabel = this.add
      .text(x, y, attempted ? Strings.factoryDailySeedAttempted : Strings.factoryDailySeed, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: attempted ? '#888888' : '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.dailySeedObjects.push(seedLabel);
    if (!attempted) {
      const hint = this.add
        .text(x, y + btnH / 2 + 8, Strings.factoryDailySeedHint, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#a76cff',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0)
        .setDepth(4);
      this.dailySeedObjects.push(hint);
      seedBg.setInteractive({ useHandCursor: true });
      seedBg.on('pointerdown', () => this.launchDailySeedRaid());
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
    // Stash a Phaser-style teardown adapter in dailySeedObjects so
    // destroyDailySeedAndLeaderboard() cleans it up uniformly.
    this.dailySeedObjects.push({ destroy: dismissLb } as unknown as Phaser.GameObjects.GameObject);
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
    this.leaderboardObjects.push({ destroy: dismiss } as unknown as Phaser.GameObjects.GameObject);
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

      const contractsBtn = nfrActionBtn(Strings.missionBoardTitle, 'gold', () => openMissionBoard(this));
      const claimable = RetentionSystem.almostThere().missionsReadyToClaim;
      if (claimable > 0) {
        const badge = nfrEl('span', 'nfr-action__badge');
        badge.textContent = String(claimable);
        contractsBtn.appendChild(badge);
      }
      col.appendChild(contractsBtn);

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
    const toast = this.add
      .text(this.scale.width / 2, 50, text, {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ffd75a',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#0a1014',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2200)
      .setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: 70,
      duration: 320,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(3500, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 500,
        onComplete: () => toast.destroy(),
      });
    });
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
