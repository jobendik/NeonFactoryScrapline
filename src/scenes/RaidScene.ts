import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Pickup, type PickupType } from '../entities/Pickup';
import { Bullet } from '../entities/Bullet';
import { Powerup } from '../entities/Powerup';
import { InputSystem } from '../systems/InputSystem';
import { WaveDirector } from '../systems/WaveDirector';
import { WeaponSystem } from '../systems/WeaponSystem';
import { ParticleEffects } from '../systems/ParticleEffects';
import { ExtractionSystem } from '../systems/ExtractionSystem';
import { GreedSystem } from '../systems/GreedSystem';
import { PowerupSystem } from '../systems/PowerupSystem';
import { Economy } from '../systems/EconomySystem';
import { UpgradeEffects } from '../systems/UpgradeSystem';
import { Balance } from '../config/Balance';
import { Strings } from '../config/Strings';
import { EnemyDefs } from '../config/EnemyDefs';
import { PowerupDefs, type PowerupKind } from '../config/PowerupDefs';
import { bus, Events } from '../core/EventBus';
import { saveSystem } from '../platform/SaveSystem';
import { MusicEngine } from '../audio/music';
import { DraftSystem } from '../systems/DraftSystem';
import { createDefaultRunMods, type RunMods } from '../systems/RunMods';
import { OperatorSystem } from '../systems/OperatorSystem';
import { InfestationSystem } from '../systems/InfestationSystem';
import { DailyQuestSystem } from '../systems/DailyQuestSystem';
import { LeaderboardSystem } from '../systems/LeaderboardSystem';
import { todayUtcDate as todayUtcDateForLeaderboard } from '../config/QuestDefs';
import type { CardDef } from '../config/CardDefs';
import type { DraftSceneInit } from './DraftScene';
import { Rng, dailySeed } from '../core/Rng';
import { SDKBridge } from '../platform/SDKBridge';
import { AdManager } from '../platform/AdManager';
import { Analytics } from '../platform/Analytics';
import { FunnelTracker } from '../platform/FunnelTracker';
import { SpatialGrid } from '../systems/SpatialGrid';
import { QualityManager } from '../systems/QualityManager';
import {
  ensureCommonFX,
  ensureRaidBackgroundFor,
  applyGlow,
  raidBgKeyForZone,
  STARFIELD_FAR_KEY,
  STARFIELD_NEAR_KEY,
  VIGNETTE_KEY,
} from '../systems/NeonFX';
import { AchievementSystem } from '../systems/AchievementSystem';
import { RetentionSystem } from '../systems/RetentionSystem';
import { RefinerySystem } from '../systems/RefinerySystem';
import { RaidZoneSystem } from '../systems/RaidZoneSystem';
import {
  DEFAULT_RAID_ZONE_ID,
  getRaidZoneDef,
  getZoneVisualTheme,
  type RaidZoneDef,
  type RaidZoneId,
} from '../config/ScraplineDefs';
import {
  sfxCore,
  sfxScrap,
  sfxPowerup,
  sfxEnemyHit,
  sfxEnemyDeath,
  sfxEnemyShoot,
  sfxExtractionOpen,
  sfxExtractionTick,
  sfxExtractionSuccess,
  sfxRaidFailed,
  sfxTimerTick,
  sfxNuke,
  sfxMagnetBurst,
  sfxLaserOverdrive,
  sfxFreezePulse,
  sfxTimeBonus,
} from '../audio/sfx';
import type {
  RaidEndState,
  RaidEndReason,
  RaidEndPayload,
  RaidInitData,
  RaidMode,
  WaypointTarget,
} from '../core/types';

type RaidPhase = 'active' | 'extracting' | 'ended';

type TutorialCaptionKey = 'move' | 'dash' | 'dashImmune' | 'powerup' | 'extract';

// RaidScene drives the raid lifecycle. Through M6 it owns:
//   - the player, enemies, pickups, bullets pools
//   - WaveDirector / WeaponSystem / ParticleEffects / ExtractionSystem
//   - the combo + run-loot accumulator
//   - the active->extracting->ended state machine and transition to SummaryScene
//
// Combo scales the VALUE of each drop (not the count) per the M5 gate decision:
// count-scaling explodes pickup population at high combo and hits the maxPickups cap.
// Greed multiplier (M7) will further scale banked loot on successful extract.

export class RaidScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private enemies!: Phaser.GameObjects.Group;
  private pickups!: Phaser.GameObjects.Group;
  private bullets!: Phaser.GameObjects.Group;
  private waveDirector!: WaveDirector;
  private weapons!: WeaponSystem;
  private particles!: ParticleEffects;
  private extraction!: ExtractionSystem;
  private greed!: GreedSystem;
  private runLoot = { scrap: 0, cores: 0 };
  private zone: RaidZoneDef = getRaidZoneDef(DEFAULT_RAID_ZONE_ID);
  private combo = 1.0;
  private comboGrace = 0;
  private timeRemaining: number = Balance.raid.normalDuration;
  private activePopups = 0;
  private phase: RaidPhase = 'active';
  private extractTimer = 0;
  private isTutorial = false;
  // M19 — explicit raid mode. Drives Rng seeding + post-extract score
  // recording for the daily-seed leaderboard.
  private mode: RaidMode = 'normal';
  private elapsed = 0;
  private captionDoneIdx = -1;
  private tutorialBanner: Phaser.GameObjects.Text | null = null;
  private powerups!: Phaser.GameObjects.Group;
  private powerupSystem!: PowerupSystem;
  // §7.3 visual escalation: a red vignette overlay (HUD-relative) whose
  // alpha matches the current greed step's vignette factor; an extra cool
  // tint that fades in at the deep-end (x3) step.
  private greedVignette: Phaser.GameObjects.Graphics | null = null;
  private deepEndTint: Phaser.GameObjects.Rectangle | null = null;
  // Hit-stop: when > 0 we skip update() side effects for a few frames so
  // the kill of a Tank / elite has weight.
  private hitStopTimer = 0;
  // Near-miss tracking (M14). We remember which enemies were close-and-active
  // during the most recent dash so each near-miss is awarded once per dash.
  private nearMissAwarded = new Set<Enemy>();
  // Tracks the integer second of the previous frame so the timer-tick SFX
  // fires exactly once per second during the final 10s rather than every
  // frame. Set to -1 on raid start to skip the boot frame.
  private lastTickSecond = -1;
  // Tracks whether we already played extraction-tick this filling window.
  private extractionTickElapsed = 0;
  // M15 — drafted card mods + the system that picks/tracks them. RunMods
  // starts at defaults each raid; M16 will seed operator-specific values
  // before the first draft window opens.
  private runMods: RunMods = createDefaultRunMods();
  private draftSystem!: DraftSystem;
  private draftActive = false;
  // Magnet Storm card grants a temporary radius boost; this counts down
  // each frame while > 0. Stacks additively on pick (8s per copy).
  private magnetStormRemaining = 0;
  // Per-raid Rng. M19 will switch tutorial/normal/daily-seed seeding modes;
  // for M15 it's just `Date.now()` so DraftSystem has a non-Math.random source.
  private rng!: Rng;
  // Orbiting drone visuals (cosmetic - the actual gameplay effect is the
  // bonusWeaponTargets count read by WeaponSystem). Refreshed on raid start
  // and after a Drone Multiplier card pick.
  private operatorOrbs: Phaser.GameObjects.Graphics[] = [];
  private orbAngle = 0;
  // M17 — kills against 'infested' enemies this raid. Counts toward
  // restoring infested machines at raid end.
  private cleanseProgress = 0;
  // M20 — per-raid single-use flag for the EXTEND RUN ad. REVIVE / DOUBLE
  // LOOT competition lives in AdManager (cross-scene flag).
  private extendRunUsed = false;
  // M20 — RaidScene sets this when REVIVE is shown so SummaryScene knows
  // not to also offer DOUBLE LOOT (§17.3: max 1 rewarded prompt per raid).
  private revivePromptShown = false;
  // M20 — async ad flow gate. While a modal is being shown for REVIVE /
  // EXTEND RUN, the raid is paused; update() guards against re-entry.
  private adInFlight = false;
  // M21 — spatial grids rebuilt once per frame so WeaponSystem and the
  // pickup-magnet loop run in O(cells visited) instead of O(group size).
  private enemyGrid = new SpatialGrid<Enemy>();
  private pickupGrid = new SpatialGrid<Pickup>();
  private pickupScratch: Pickup[] = [];
  private powerupScratch: Powerup[] = [];
  private powerupGrid = new SpatialGrid<Powerup>();
  // Turret Drop power-up — when active, a friendly turret sits at the player's
  // position at activation time and auto-fires on the nearest enemy. We
  // anchor at activation so dropping it as you move feels like placing a
  // sentry rather than a follower.
  private turret: { x: number; y: number; cooldown: number; gfx: Phaser.GameObjects.Graphics } | null = null;
  private onPlayerDied = (): void => {
    void this.handlePlayerDied();
  };
  // Nova Dash card — fire a damaging ring at the dash origin if the
  // novaDashRadius mod is non-zero.
  private onPlayerDashed = (...args: unknown[]): void => {
    if (this.runMods.novaDashRadius <= 0 || this.runMods.novaDashDamage <= 0) return;
    const x = args[0] as number;
    const y = args[1] as number;
    const r = this.runMods.novaDashRadius;
    const r2 = r * r;
    const dmg = this.runMods.novaDashDamage;
    // Draw a short-lived visual ring.
    const gfx = this.add.graphics();
    gfx.setDepth(12);
    gfx.lineStyle(4, 0xffd75a, 1);
    gfx.strokeCircle(x, y, r);
    this.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 240,
      onComplete: () => gfx.destroy(),
    });
    // Damage all enemies in radius via spatial grid.
    const nearby = this.enemyGrid.queryNearby(x, y, r, []);
    for (const e of nearby) {
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r2) {
        this.processHit(e, dmg, x, y, false);
      }
    }
  };
  private onExtractionComplete = (): void => this.beginExtractionMoment();
  private onExtractionOpened = (): void => {
    this.greed.start();
    // Tells WaveDirector that Extract Jammers may now spawn.
    this.waveDirector.setExtractionOpen(true);
    sfxExtractionOpen();
  };

  constructor() {
    super({ key: 'RaidScene' });
  }

  init(data?: RaidInitData): void {
    this.isTutorial = !!data?.tutorial;
    this.mode = data?.mode ?? (this.isTutorial ? 'tutorial' : 'normal');
    const zoneId: RaidZoneId = this.isTutorial
      ? DEFAULT_RAID_ZONE_ID
      : (data?.zoneId ?? RaidZoneSystem.getSelectedZone().id);
    this.zone = getRaidZoneDef(zoneId);
  }

  create(): void {
    const wb = Balance.player.worldBounds;
    const width = wb.maxX - wb.minX;
    const height = wb.maxY - wb.minY;
    this.physics.world.setBounds(wb.minX, wb.minY, width, height);
    this.cameras.main.setBounds(wb.minX, wb.minY, width, height);
    this.cameras.main.setBackgroundColor(Balance.rendering.backgroundColor);

    // M19 — seed the per-raid Rng based on mode. Daily-seed mode pulls the
    // dailySeed() so all players today get the same enemy spawns / power-up
    // locations / drops. Tutorial + normal modes seed from Date.now() (still
    // not deterministic across players, but threaded so the same Rng drives
    // every stochastic call in this raid).
    const seed = this.mode === 'dailySeed' ? dailySeed() : Date.now();
    this.rng = new Rng(seed);

    this.drawBackground();

    this.player = new Player(this, 0, 0);
    this.cameras.main.startFollow(
      this.player,
      true,
      Balance.ui.cameraFollowLerp,
      Balance.ui.cameraFollowLerp,
    );

    this.inputSystem = new InputSystem(this);

    this.enemies = this.add.group({
      classType: Enemy,
      maxSize: Balance.enemies.maxOnScreen,
      runChildUpdate: false,
    });
    this.pickups = this.add.group({
      classType: Pickup,
      maxSize: Balance.performance.maxPickups,
      runChildUpdate: false,
    });
    this.bullets = this.add.group({
      classType: Bullet,
      maxSize: Balance.shooter.bulletMaxOnField,
      runChildUpdate: false,
    });
    this.powerups = this.add.group({
      classType: Powerup,
      maxSize: Balance.powerups.maxOnField,
      runChildUpdate: false,
    });
    this.physics.add.overlap(this.player, this.pickups, this.onPickupOverlap, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerEnemyOverlap, undefined, this);
    this.physics.add.overlap(this.player, this.bullets, this.onPlayerBulletOverlap, undefined, this);
    this.physics.add.overlap(this.player, this.powerups, this.onPowerupOverlap, undefined, this);

    this.waveDirector = new WaveDirector(
      this.enemies,
      () => ({ x: this.player.x, y: this.player.y }),
      this.rng,
    );
    const raidDuration = this.isTutorial
      ? Balance.raid.tutorialDuration
      : Balance.raid.normalDuration;
    if (this.isTutorial) {
      this.waveDirector.start({
        spawnRateMult: Balance.tutorial.enemySpawnRateMult,
        enemyHpMult: Balance.tutorial.enemyHpMult,
        raidDuration,
      });
    } else {
      // M17 — when the player has any infested machines, the director
      // periodically spawns red-tinted swarmers. Tutorial bypassed.
      this.waveDirector.start({
        raidDuration,
        spawnRateMult: this.zone.threatMult,
        enemyHpMult: this.zone.enemyHpMult,
        infestationWave: InfestationSystem.hasInfestation(),
      });
    }
    this.cleanseProgress = 0;

    this.particles = new ParticleEffects(this);
    this.weapons = new WeaponSystem(
      this,
      () => ({ x: this.player.x, y: this.player.y }),
      () => this.enemies.getChildren(),
      this.rng,
      () => this.enemyGrid,
    );
    this.weapons.setDamageLevel(UpgradeEffects.weaponDamageLevel());
    if (this.isTutorial) this.weapons.setDamageMult(Balance.tutorial.playerDamageMult);

    this.extraction = new ExtractionSystem(
      this,
      Balance.extraction.padX,
      Balance.extraction.padY,
      Balance.extraction.padRadius,
      this.isTutorial ? Balance.raid.tutorialExtractionOpenTime : Balance.raid.extractionOpenTime,
    );

    this.greed = new GreedSystem();

    this.powerupSystem = new PowerupSystem(
      this,
      this.powerups,
      () => ({ x: this.player.x, y: this.player.y }),
      { tutorial: this.isTutorial },
      {
        signalNuke: () => this.activateSignalNuke(),
        timeBonus: () => this.activateTimeBonus(),
        shieldGrant: () => this.player.addShieldCharge(),
      },
      this.rng,
    );
    this.powerupSystem.start();

    this.runLoot.scrap = 0;
    this.runLoot.cores = 0;
    this.combo = 1.0;
    this.comboGrace = 0;
    this.timeRemaining = raidDuration;
    this.phase = 'active';
    this.extractTimer = 0;
    this.elapsed = 0;
    this.captionDoneIdx = -1;

    if (this.isTutorial) {
      this.player.applyHpMult(Balance.tutorial.playerHpMult);
      this.player.setHpFloor(Balance.tutorial.safetyNetHpFloor);
      this.spawnInitialScrapPile();
      this.spawnTutorialBanner();
    } else {
      this.spawnZoneBanner();
    }

    this.hitStopTimer = 0;
    this.nearMissAwarded.clear();
    this.buildGreedOverlays();

    // RunMods + drafting + operator. Reset to defaults, seed operator passive,
    // then push current mods into Player + WeaponSystem so the very first
    // frame reads consistent state. Order matters: operator before draft so
    // card picks layer cleanly on top of operator base values.
    this.runMods = createDefaultRunMods();
    OperatorSystem.applyOperatorMods(this.runMods);
    // Refinery — Drone Overclock adds +1 starting drone permanently.
    this.runMods.bonusWeaponTargets += RefinerySystem.bonusStartingDrones();
    this.magnetStormRemaining = 0;
    // rng was seeded above (mode-dependent); DraftSystem and all subsystems
    // share the same instance.
    this.draftSystem = new DraftSystem(this.rng);
    this.player.applyRunMods(this.runMods);
    this.weapons.applyRunMods(this.runMods);
    this.draftActive = false;
    this.refreshOperatorOrbs();

    bus.on(Events.PLAYER_DIED, this.onPlayerDied);
    bus.on(Events.EXTRACTION_COMPLETE, this.onExtractionComplete);
    bus.on(Events.EXTRACTION_OPENED, this.onExtractionOpened);
    bus.on(Events.DRAFT_PICKED, this.onDraftPicked);
    bus.on(Events.PLAYER_DASHED, this.onPlayerDashed);

    MusicEngine.startRaid();
    // M20 — bracket the raid with SDK lifecycle calls (§18.3). Tutorial is
    // still considered "gameplay" per the spec, so we call it on all raids.
    SDKBridge.gameplayStart();
    AdManager.resetForRaid();
    this.extendRunUsed = false;
    this.revivePromptShown = false;
    this.adInFlight = false;
    bus.emit(Events.RAID_STARTED, this.mode);
    Analytics.track(this.isTutorial ? 'tutorial_started' : 'raid_started', {
      mode: this.mode,
      operatorId: saveSystem.get().selectedOperator,
      raidNumber: saveSystem.get().raidsCompleted,
    });
  }

  // Bus handler bound once in create() so we can off() it on shutdown without
  // capturing the wrong `this`.
  private onDraftPicked = (...args: unknown[]): void => {
    const card = args[0] as CardDef | undefined;
    if (!card) return;
    card.apply(this.runMods);
    this.player.applyRunMods(this.runMods);
    this.weapons.applyRunMods(this.runMods);
    // Magnet Storm grants a temporary high-radius window; pick adds 8s.
    if (this.runMods.magnetStormDurAdd > 0) {
      this.magnetStormRemaining += Balance.cards.magnetStormDurSec;
      // Subtract back so successive picks of the same card type would re-add
      // (cards can only be picked once per run today, but operator passives
      // could grant magnet storm later).
      this.runMods.magnetStormDurAdd -= Balance.cards.magnetStormDurSec;
    }
    this.refreshOperatorOrbs();
    this.draftActive = false;
  };

  // Spawns one tiny orbit dot per bonusWeaponTargets so the player visually
  // sees their drone count. Called on raid start and after card picks (Drone
  // Multiplier). The orbs are graphics-only — they don't fire themselves;
  // bonusWeaponTargets is what actually feeds WeaponSystem.
  private refreshOperatorOrbs(): void {
    for (const o of this.operatorOrbs) o.destroy();
    this.operatorOrbs = [];
    const count = Math.max(0, Math.floor(this.runMods.bonusWeaponTargets));
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics().setDepth(this.player.depth + 1);
      g.fillStyle(0xa76cff, 0.9);
      g.lineStyle(1.5, 0xffffff, 0.95);
      g.fillCircle(0, 0, 5);
      g.strokeCircle(0, 0, 5);
      this.operatorOrbs.push(g);
    }
  }

  private tickOperatorOrbs(dt: number): void {
    if (this.operatorOrbs.length === 0) return;
    this.orbAngle += dt * 2.0;
    const r = 36;
    for (let i = 0; i < this.operatorOrbs.length; i++) {
      const angle = this.orbAngle + (i / this.operatorOrbs.length) * Math.PI * 2;
      const x = this.player.x + Math.cos(angle) * r;
      const y = this.player.y + Math.sin(angle) * r;
      this.operatorOrbs[i].setPosition(x, y);
    }
  }

  // Pauses the raid and launches DraftScene with three rng-drawn cards.
  // Resume happens in onDraftPicked (or in DraftScene's auto-pick path,
  // which also emits DRAFT_PICKED with a fallback card).
  private beginDraft(draftIndex: number): void {
    const cards = this.draftSystem.drawCards(draftIndex);
    if (cards.length === 0) return; // pool exhausted - skip
    this.draftSystem.markFired(draftIndex);
    this.draftSystem.markShown(cards);
    this.draftActive = true;
    bus.emit(Events.DRAFT_OFFERED, draftIndex, cards);
    const init: DraftSceneInit = {
      cards,
      draftIndex,
      raidSceneKey: 'RaidScene',
    };
    this.scene.launch('DraftScene', init);
    this.scene.pause();
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(Balance.performance.dtClamp, deltaMs / 1000);

    if (this.phase === 'ended') return;

    if (this.phase === 'extracting') {
      this.updateExtractionMoment(dt);
      return;
    }

    if (this.hitStopTimer > 0) {
      // Hit-stop "weight pause": the scene stays awake (HUD still ticks via
      // its own update) but raid simulation halts for a frame or two. We
      // still tick the timer so timeRemaining stays honest.
      this.hitStopTimer -= dt;
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.elapsed += dt;
    if (this.magnetStormRemaining > 0) this.magnetStormRemaining = Math.max(0, this.magnetStormRemaining - dt);

    // §12 in-run drafting. Tutorial bypassed per spec ("the 45s tutorial is
    // shorter than the 45s draft anyway, but explicitly gate it").
    if (!this.isTutorial && !this.draftActive) {
      const draftIdx = this.draftSystem.shouldOffer(this.elapsed);
      if (draftIdx !== null) {
        this.beginDraft(draftIdx);
        return;
      }
    }

    const greedStep = this.greed.getStep();
    this.waveDirector.setGreedStep(greedStep);
    this.updateGreedVisuals(greedStep);

    const frame = this.inputSystem.getInput();
    // Playbook §16.1 first-session funnel: note any non-zero input. The
    // tracker short-circuits once first_input has fired, so this is cheap.
    FunnelTracker.noteInput(frame.x !== 0 || frame.y !== 0, frame.dash);
    this.player.update(dt, frame);
    this.player.syncShieldAura();
    this.waveDirector.update(dt);
    this.extraction.update(dt, this.player.x, this.player.y);
    this.greed.update(dt);
    this.powerupSystem.update(dt);

    // M21 — rebuild spatial grids once per frame against the live group
    // contents. Cheap enough to do unconditionally (the grids re-use bucket
    // arrays). WeaponSystem reads enemyGrid; the magnet loop below reads
    // pickupGrid + powerupGrid.
    this.enemyGrid.rebuild(this.enemies.getChildren() as unknown as Iterable<Enemy>);
    this.pickupGrid.rebuild(this.pickups.getChildren() as unknown as Iterable<Pickup>);
    this.powerupGrid.rebuild(this.powerups.getChildren() as unknown as Iterable<Powerup>);

    if (this.isTutorial) this.tickTutorial(dt);

    // Push current power-up state into the weapon. Cheap to do every frame -
    // the setters are just field writes.
    // Frenzy Mode card composes a fire-rate boost when player HP drops below
    // frenzyHpFraction.
    const playerHpFrac = this.player.hp / Math.max(1, this.player.maxHp);
    const frenzyActive =
      this.runMods.frenzyHpFraction > 0 && playerHpFrac < this.runMods.frenzyHpFraction;
    const frenzyMult = frenzyActive ? 1 / Math.max(0.01, this.runMods.frenzyFireMult) : 1;
    this.weapons.setFireRateMult(this.powerupSystem.getFireRateMult() * frenzyMult);
    this.weapons.setTargetsPerShot(this.powerupSystem.getTargetsPerShot());

    const frozen = this.powerupSystem.isFreezeActive();
    // Reset per-frame buff state — Shield Carrier aura is recomputed below.
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy;
      if (!e.active) continue;
      e.buffedDamageReduction = 0;
    }
    // Pre-pass: apply Shield Carrier auras + tally Extract Jammer slow.
    let jammerSlow = 1;
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy;
      if (!e.active) continue;
      if (e.kind === 'shieldCarrier') {
        const r = Balance.enemies.shieldCarrier.auraRadius;
        const r2 = r * r;
        const nearby = this.enemyGrid.queryNearby(e.x, e.y, r, []);
        for (const other of nearby) {
          if (!other.active || other === e) continue;
          const dx = other.x - e.x;
          const dy = other.y - e.y;
          if (dx * dx + dy * dy <= r2) {
            other.buffedDamageReduction = Math.max(
              other.buffedDamageReduction,
              Balance.enemies.shieldCarrier.auraDamageReduction,
            );
          }
        }
      }
      if (e.kind === 'extractJammer' && this.extraction.isOpen()) {
        const pad = this.extraction.getPadPosition();
        const dx = e.x - pad.x;
        const dy = e.y - pad.y;
        const r = Balance.enemies.extractJammer.auraRadius;
        if (dx * dx + dy * dy <= r * r) {
          jammerSlow = Math.min(jammerSlow, Balance.enemies.extractJammer.timerSlowFactor);
        }
      }
    }
    this.extraction.setExternalFillMult(jammerSlow);

    // Slow Field card — radius around player drags enemies inside to a
    // fraction of normal step. We scale dt for those enemies. Cheaper than
    // mutating their speed each frame.
    const slowFactor = this.runMods.slowFieldFactor;
    const slowRad2 = slowFactor > 0 ? Balance.cards.slowFieldRadius * Balance.cards.slowFieldRadius : 0;
    // Time Dilation card — global enemy-speed multiplier (1.0 = no effect).
    const globalEnemyMult = this.runMods.enemySpeedMult;

    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy;
      if (!e.active) continue;
      // Visual cue while Freeze Pulse is up; restored to white on thaw.
      if (frozen) e.setTint(Balance.powerups.freezeTint);
      else e.clearTint();
      // Per-enemy dt scaling: time-dilation always applies; slow-field also
      // applies if inside the radius. Frozen short-circuits inside tick().
      let mult = globalEnemyMult;
      if (slowFactor > 0) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        if (dx * dx + dy * dy <= slowRad2) mult *= 1 - slowFactor;
      }
      const r = e.tick(dt * mult, this.player.x, this.player.y, frozen);
      if (r.fired) this.spawnEnemyBullet(r.fired.fromX, r.fired.fromY, r.fired.dirX, r.fired.dirY);
      // Bomber detonation: damage player if in radius, kill the bomber.
      if (r.exploded) {
        const ex = r.exploded;
        const pdx = this.player.x - ex.x;
        const pdy = this.player.y - ex.y;
        if (pdx * pdx + pdy * pdy <= ex.radius * ex.radius) {
          this.player.takeDamage(ex.damage);
        }
        this.particles.enemyDeath(e.kind, e.x, e.y);
        e.kill();
      }
      // Loot Goblin lifetime expired without being caught — silently despawn,
      // no rewards. Player missed the chase.
      if (r.expired) {
        e.kill();
      }
    }

    const hits = this.weapons.update(dt);
    for (const hit of hits) this.processHit(hit.target, hit.damage, this.player.x, this.player.y, hit.crit);

    // Magnet radius: base × upgrade × Magnet Burst (power-up) × RunMods.magnetMult
    // × Magnet Storm (drafted, temporary). Magnet Storm uses the same multiplier
    // as Magnet Burst since the visible behaviour is identical (everything in
    // the arena rushes you).
    const magnetStormMult = this.magnetStormRemaining > 0 ? Balance.powerups.magnetBurstRadiusMult : 1;
    const magnetRadius =
      UpgradeEffects.magnetRadius() *
      this.powerupSystem.getMagnetMult() *
      this.runMods.magnetMult *
      magnetStormMult;
    // M21 — spatial-grid query instead of full-group scan. Anything past
    // magnetRadius cannot be pulled this frame; the grid skips those cells.
    const nearPickups = this.pickupGrid.queryNearby(
      this.player.x,
      this.player.y,
      magnetRadius,
      this.pickupScratch,
    );
    for (const p of nearPickups) {
      if (p.active) p.updateMagnet(dt, this.player.x, this.player.y, magnetRadius);
    }

    // Powerups magnetize on the same radius but with a separate, more
    // forgiving pull profile (Powerup.updateMagnet's internal speeds).
    const nearPowerups = this.powerupGrid.queryNearby(
      this.player.x,
      this.player.y,
      magnetRadius,
      this.powerupScratch,
    );
    for (const p of nearPowerups) {
      if (p.active) p.updateMagnet(dt, this.player.x, this.player.y, magnetRadius);
    }

    this.tickBullets(dt);
    this.tickCombo(dt);
    this.tickTimerSfx();
    this.tickExtractionSfx(dt);
    this.tickAdaptiveMusic();
    this.tickNearMiss();
    this.tickOperatorOrbs(dt);
    this.tickTurret(dt);
    DailyQuestSystem.tickRaidElapsed(this.elapsed);

    if (this.timeRemaining <= 0 && !this.adInFlight) {
      void this.handleTimerExpired();
    }
  }

  // M20 EXTEND RUN — when the timer hits 0, optionally offer +30s before
  // finalizing 'collapsed'. Single use per raid; not offered in tutorial;
  // not offered if the player already declined / already accepted (the
  // extendRunUsed flag blocks repeat offers within the same raid).
  private async handleTimerExpired(): Promise<void> {
    if (this.phase !== 'active') return;
    if (this.adInFlight) return;
    if (this.isTutorial || this.extendRunUsed) {
      this.requestEnd('collapsed');
      return;
    }
    this.extendRunUsed = true;
    this.adInFlight = true;
    this.scene.pause();
    const granted = await AdManager.offer(this, {
      title: Strings.adExtendRunTitle,
      description: Strings.adExtendRunDesc,
      placement: 'extendRun',
    });
    this.adInFlight = false;
    this.scene.resume();
    SDKBridge.gameplayStart();
    if (granted) {
      this.timeRemaining = Balance.ads.extendRunSeconds;
      this.lastTickSecond = -1;
    } else {
      this.requestEnd('collapsed');
    }
  }

  // M20 REVIVE — replaces the immediate 'failed' transition when REVIVE
  // is eligible (§17.2 + §17.3). Eligibility: not tutorial, post-raid-3+,
  // probabilistic, and no other rewarded prompt already shown this raid.
  // On accept, restore HP to 60%, grant brief invuln, resume the run.
  private async handlePlayerDied(): Promise<void> {
    if (this.phase !== 'active') return;
    if (this.adInFlight) return;
    const eligible =
      !this.isTutorial &&
      AdManager.canOfferRaidPrompt() &&
      saveSystem.get().raidsCompleted >= Balance.ads.reviveAfterRaidsCompleted &&
      Math.random() < Balance.ads.reviveProbability;
    if (!eligible) {
      this.requestEnd('failed');
      return;
    }
    this.revivePromptShown = true;
    AdManager.markRaidPromptShown();
    this.adInFlight = true;
    this.scene.pause();
    const granted = await AdManager.offer(this, {
      title: Strings.adReviveTitle,
      description: Strings.adReviveDesc,
      borderColor: 0x72ff9f,
      placement: 'revive',
    });
    this.adInFlight = false;
    if (granted) {
      // Restore HP, brief invuln, resume the raid.
      this.player.reviveToRatio(Balance.ads.reviveHpRatio, Balance.ads.reviveInvulnSec);
      this.scene.resume();
      SDKBridge.gameplayStart();
    } else {
      // Decline OR SDK failure → run ends as failed. Resume long enough to
      // let finishRaid drive the transition into SummaryScene.
      this.scene.resume();
      SDKBridge.gameplayStart();
      this.requestEnd('failed');
    }
  }

  // Metronome click during the final 10s of a raid. Fires once per integer
  // second so we don't carpet-bomb the SFX bus at frame rate.
  private tickTimerSfx(): void {
    if (this.timeRemaining > 10) {
      this.lastTickSecond = -1;
      return;
    }
    const sec = Math.ceil(this.timeRemaining);
    if (sec !== this.lastTickSecond && sec >= 0) {
      this.lastTickSecond = sec;
      sfxTimerTick();
    }
  }

  // Quiet pulse while the player holds the extraction pad (fill > 0).
  // Fires every 0.5s and stops when they step off or extract.
  private tickExtractionSfx(dt: number): void {
    const ext = this.extraction.getFill();
    if (ext <= 0 || !this.extraction.isOpen()) {
      this.extractionTickElapsed = 0;
      return;
    }
    this.extractionTickElapsed += dt;
    if (this.extractionTickElapsed >= 0.5) {
      this.extractionTickElapsed = 0;
      sfxExtractionTick();
    }
  }

  // Push tension / danger intensity into the music engine per §20.4 rules:
  //   tension: HP <= 50% OR Greed >= 1.5
  //   danger:  HP <= 20% OR active enemies >= 10 OR Greed >= 2.0
  private tickAdaptiveMusic(): void {
    const hpRatio = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
    const greedMult = this.greed.getMultiplier();
    let enemyCount = 0;
    for (const c of this.enemies.getChildren()) if (c.active) enemyCount++;
    const tension = hpRatio <= 0.5 || greedMult >= 1.5 ? 1 : 0;
    const danger = hpRatio <= 0.2 || enemyCount >= 10 || greedMult >= 2.0 ? 1 : 0;
    MusicEngine.setIntensity(tension, danger);
  }

  // Near-miss (M14): any enemy passes within nearMissRadius during a dash
  // earns +N Scrap and a small popup. Each enemy can only score once per
  // dash; the set clears every frame the player isn't dashing so a brushing
  // pass-through during sustained chase doesn't endlessly fire.
  private tickNearMiss(): void {
    if (!this.player.isDashing()) {
      this.nearMissAwarded.clear();
      return;
    }
    const r2 = Balance.raid.nearMissRadius * Balance.raid.nearMissRadius;
    const px = this.player.x;
    const py = this.player.y;
    for (const c of this.enemies.getChildren()) {
      const e = c as Enemy;
      if (!e.active || this.nearMissAwarded.has(e)) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      if (dx * dx + dy * dy <= r2) {
        this.nearMissAwarded.add(e);
        this.runLoot.scrap += Balance.raid.nearMissReward;
        this.showPopup(px, py - 38, 'NEAR MISS', '#ffd75a');
      }
    }
  }

  // Build the M14 greed-step visuals (HUD-relative). Both overlays render at
  // depth above gameplay but below HUDScene's UI strip.
  private buildGreedOverlays(): void {
    this.greedVignette?.destroy();
    this.deepEndTint?.destroy();
    this.greedVignette = this.add.graphics().setScrollFactor(0).setDepth(1800);
    this.greedVignette.setAlpha(0);
    this.deepEndTint = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0a1428, 0.22)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1801)
      .setAlpha(0);
    this.drawGreedVignette();
  }

  private drawGreedVignette(): void {
    const g = this.greedVignette;
    if (!g) return;
    g.clear();
    const w = this.scale.width;
    const h = this.scale.height;
    // Layer a series of inset rectangles in increasing alpha to fake a
    // radial vignette. Cheap, and enough for the "danger frame" feel.
    const color = Balance.colors.danger;
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const inset = (i / bands) * Math.min(w, h) * 0.45;
      g.lineStyle(Math.max(2, (1 - i / bands) * 22), color, 0.18);
      g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    }
  }

  // Update the §7.3 visual escalation overlays for the current greed step.
  // Reduced-motion players see a flat (non-pulsing) low-intensity vignette
  // and no deep-end tint sweep, per accessibility expectations.
  private updateGreedVisuals(step: number): void {
    const esc = Balance.raid.greedEscalation[Math.max(0, Math.min(Balance.raid.greedEscalation.length - 1, step))];
    const reducedMotion = QualityManager.isReducedMotion();
    const g = this.greedVignette;
    if (g) {
      if (reducedMotion) {
        // Flat half-intensity overlay — communicates danger without pulsing.
        g.setAlpha(Math.min(0.35, esc.vignette * 0.5));
      } else {
        // Mild sine pulse on top of the step-base intensity so the danger
        // frame breathes rather than sits flat.
        const breathe = (Math.sin(this.elapsed * 3.4) + 1) / 2;
        const alpha = Math.max(0, Math.min(1, esc.vignette * (0.85 + breathe * 0.3)));
        g.setAlpha(alpha);
      }
    }
    if (this.deepEndTint) {
      const want = !reducedMotion && step >= Balance.raid.deepEndTintAt ? 0.42 : 0;
      const cur = this.deepEndTint.alpha;
      this.deepEndTint.setAlpha(cur + (want - cur) * 0.05);
    }
  }

  shutdown(): void {
    bus.off(Events.PLAYER_DIED, this.onPlayerDied);
    bus.off(Events.EXTRACTION_COMPLETE, this.onExtractionComplete);
    bus.off(Events.EXTRACTION_OPENED, this.onExtractionOpened);
    bus.off(Events.DRAFT_PICKED, this.onDraftPicked);
    bus.off(Events.PLAYER_DASHED, this.onPlayerDashed);
    this.waveDirector.stop();
    this.inputSystem.destroy();
    this.particles.destroy();
    this.extraction.destroy();
    this.greed.stop();
    this.powerupSystem.stop();
    MusicEngine.stop();
    if (this.tutorialBanner) {
      this.tutorialBanner.destroy();
      this.tutorialBanner = null;
    }
    this.greedVignette?.destroy();
    this.greedVignette = null;
    this.deepEndTint?.destroy();
    this.deepEndTint = null;
    this.nearMissAwarded.clear();
    for (const o of this.operatorOrbs) o.destroy();
    this.operatorOrbs = [];
    if (this.turret) {
      this.turret.gfx.destroy();
      this.turret = null;
    }
    this.weapons.destroy?.();
    bus.emit(Events.RAID_ENDED);
  }

  // ---- accessors used by HUDScene ----

  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  getCombo(): number {
    return this.combo;
  }

  getRunLoot(): { scrap: number; cores: number } {
    return { scrap: this.runLoot.scrap, cores: this.runLoot.cores };
  }

  getPlayerHP(): { hp: number; max: number } {
    return { hp: this.player.hp, max: this.player.maxHp };
  }

  getExtractionInfo(): { open: boolean; padX: number; padY: number; fill: number } {
    const pos = this.extraction.getPadPosition();
    return {
      open: this.extraction.isOpen(),
      padX: pos.x,
      padY: pos.y,
      fill: this.extraction.getFill(),
    };
  }

  getGreedInfo(): { active: boolean; mult: number; elapsed: number } {
    return {
      active: this.greed.isRunning(),
      mult: this.greed.getMultiplier(),
      elapsed: this.greed.getElapsed(),
    };
  }

  // M17 cleanse status read by HUDScene for the top-right counter. Active
  // only when the player has standing infestation. progressInWindow is the
  // partial-machine kill count toward the next restore; machinesCleared is
  // already applied THIS raid (not yet persisted).
  getCleanseInfo(): { active: boolean; progressInWindow: number; perMachine: number; infestedRemaining: number } {
    const total = InfestationSystem.totalSlots();
    const infested = InfestationSystem.getInfestedIndices().length;
    if (infested === 0 && this.cleanseProgress === 0) {
      return { active: false, progressInWindow: 0, perMachine: Balance.infestation.killsToRestoreMachine, infestedRemaining: 0 };
    }
    void total;
    const per = Balance.infestation.killsToRestoreMachine;
    const machinesAlreadyCleared = Math.floor(this.cleanseProgress / per);
    const remainingKills = this.cleanseProgress - machinesAlreadyCleared * per;
    const infestedRemaining = Math.max(0, infested - machinesAlreadyCleared);
    return {
      active: infestedRemaining > 0 || this.cleanseProgress > 0,
      progressInWindow: remainingKills,
      perMachine: per,
      infestedRemaining,
    };
  }

  // ---- overlap callbacks ----

  private onPickupOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, pickupObj) => {
    const p = pickupObj as Pickup;
    if (!p.active) return;
    const type: PickupType = p.type;
    const value = p.value;
    if (type === 'scrap') this.runLoot.scrap += value;
    else this.runLoot.cores += value;
    if (value > 1) {
      this.showPopup(
        p.x,
        p.y - 10,
        `+${value}`,
        type === 'scrap' ? '#22f6ff' : '#ffd75a',
      );
    }
    if (type === 'core') {
      sfxCore();
      const save = saveSystem.get();
      if (!save.firstCoreCollected) {
        save.firstCoreCollected = true;
        save.ftueUnlocks.luckUpgrade = true;
      }
    } else {
      sfxScrap();
      // Heal on Pickup card: scrap pickups restore N HP (additive across stacks).
      if (this.runMods.healOnPickup > 0) this.player.heal(this.runMods.healOnPickup);
    }
    p.kill();
    bus.emit(Events.PICKUP_COLLECTED, type, value);
  };

  private onPlayerEnemyOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, enemyObj) => {
    if (this.phase !== 'active') return;
    const e = enemyObj as Enemy;
    if (!e.active) return;
    const def = EnemyDefs[e.kind];
    const applied = this.player.takeDamage(def.contactDamage);
    if (applied > 0) {
      this.showPopup(this.player.x, this.player.y - 22, `-${applied}`, '#ff416b');
    }
  };

  private onPlayerBulletOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, bulletObj) => {
    if (this.phase !== 'active') return;
    const b = bulletObj as Bullet;
    if (!b.active) return;
    const applied = this.player.takeDamage(b.damage);
    if (applied > 0) {
      this.showPopup(this.player.x, this.player.y - 22, `-${applied}`, '#ff416b');
    }
    b.kill();
  };

  // ---- internals ----

  private onEnemyKilled(x?: number, y?: number, victim?: Enemy): void {
    this.combo = Math.min(Balance.raid.comboMax, this.combo + Balance.raid.comboPerKill);
    this.comboGrace = Balance.raid.comboGraceSec;
    bus.emit(Events.COMBO_CHANGED, this.combo);
    bus.emit(Events.ENEMY_KILLED, { kind: victim?.kind });
    // Pyrokinetic card — death emits an AoE pulse damaging nearby enemies.
    // Skip if no position info was supplied (chain-shot callers historically
    // didn't pass it) or if the mod isn't active.
    if (
      x !== undefined &&
      y !== undefined &&
      this.runMods.pyroAoeRadius > 0 &&
      this.runMods.pyroAoeDamage > 0
    ) {
      const r = this.runMods.pyroAoeRadius;
      const r2 = r * r;
      const dmg = this.runMods.pyroAoeDamage;
      const nearby = this.enemyGrid.queryNearby(x, y, r, []);
      for (const e of nearby) {
        if (!e.active || e === victim) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy <= r2) {
          this.processHit(e, dmg, x, y, false);
        }
      }
    }
  }

  private tickCombo(dt: number): void {
    if (this.comboGrace > 0) {
      this.comboGrace -= dt;
      return;
    }
    if (this.combo > 1.0) {
      this.combo = Math.max(1.0, this.combo - Balance.raid.comboDecayPerSec * dt);
    }
  }

  private spawnDrops(enemy: Enemy): void {
    const def = EnemyDefs[enemy.kind];
    const ex = enemy.x;
    const ey = enemy.y;
    // Combo scales the VALUE of each pickup (per M5 gate decision); count stays
    // fixed at the §14.3 base so we never blow past Balance.performance.maxPickups.
    // Golden Fever (§13) doubles the per-drop value while active.
    const valuePerDrop = Math.max(
      1,
      Math.round(
        this.combo *
        this.powerupSystem.getScrapDropMult() *
        (this.isTutorial ? 1 : this.zone.scrapMult),
      ),
    );
    for (let i = 0; i < def.scrapDrop; i++) {
      const p = this.pickups.get(ex, ey) as Pickup | null;
      if (!p) break;
      p.spawn(ex, ey, 'scrap', valuePerDrop, this.rng);
    }
    // Lucky card bonus stacks additively on top of the upgrade-modified base.
    const coreChance = Math.min(
      1,
      UpgradeEffects.coreDropChance(def.coreChance) + this.runMods.coreChanceBonus,
    );
    if (this.rng.next() < coreChance) {
      const p = this.pickups.get(ex, ey) as Pickup | null;
      if (p) {
        p.spawn(ex, ey, 'core', valuePerDrop, this.rng);
        // Tuning fix (suggestions audit): when the Lucky card is in play,
        // tint cores brighter gold so the player can SEE that the card is
        // doing something. Subtle but solves the "invisible buff" feedback gap.
        if (this.runMods.coreChanceBonus > 0) {
          p.setTint(0xfff200);
        }
      }
    }

    // §14.1 Splitter: on death, spawn 3 swarmers around the corpse so the
    // player gets immediate pressure for clearing the parent.
    if (enemy.kind === 'splitter') {
      const cfg = Balance.enemies.splitter;
      for (let i = 0; i < cfg.spawnCount; i++) {
        const a = (i / cfg.spawnCount) * Math.PI * 2;
        const sx = ex + Math.cos(a) * cfg.spawnSpread;
        const sy = ey + Math.sin(a) * cfg.spawnSpread;
        const child = this.enemies.get(sx, sy) as Enemy | null;
        if (child) child.spawn(sx, sy, 'swarmer', 1, this.rng);
      }
    }
    // §14.1 Loot Goblin bonus: 5% chance to also drop a power-up.
    if (
      enemy.kind === 'lootGoblin' &&
      this.rng.next() < Balance.enemies.lootGoblin.powerupDropChance
    ) {
      const pu = this.powerups.get(ex, ey) as Powerup | null;
      if (pu) {
        const kinds = Object.keys(PowerupDefs);
        const pick = kinds[Math.floor(this.rng.next() * kinds.length)];
        pu.spawn(ex, ey, pick as PowerupKind);
      }
    }
  }

  private spawnEnemyBullet(fromX: number, fromY: number, dirX: number, dirY: number): void {
    const b = this.bullets.get(fromX, fromY) as Bullet | null;
    if (!b) return;
    b.fire(fromX, fromY, dirX, dirY, Balance.shooter.bulletSpeed, Balance.shooter.bulletDamage);
    sfxEnemyShoot();
  }

  private tickBullets(dt: number): void {
    const wb = Balance.player.worldBounds;
    for (const child of this.bullets.getChildren()) {
      const b = child as Bullet;
      if (!b.active) continue;
      b.tick(dt);
      if (b.x < wb.minX || b.x > wb.maxX || b.y < wb.minY || b.y > wb.maxY) b.kill();
    }
  }

  private showPopup(x: number, y: number, text: string, color: string): void {
    if (this.activePopups >= Balance.performance.maxPopups) return;
    this.activePopups++;
    const t = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    });
    t.setOrigin(0.5).setDepth(100);
    this.tweens.add({
      targets: t,
      y: y - Balance.ui.popupRiseDist,
      alpha: 0,
      duration: Balance.ui.popupDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.destroy();
        this.activePopups--;
      },
    });
  }

  private drawBackground(): void {
    const wb = Balance.player.worldBounds;
    ensureCommonFX(this);

    // §15 zones now carry a visual theme — each zone caches its own background
    // tile and shares its accent color with the foreground grid + boundary so
    // raiding Plasma Grave actually LOOKS different from Scrap Fields.
    const theme = getZoneVisualTheme(this.zone.id);
    const bgKey = raidBgKeyForZone(this.zone.id);
    ensureRaidBackgroundFor(this, bgKey, theme);

    const camW = this.scale.width;
    const camH = this.scale.height;
    const worldW = wb.maxX - wb.minX;
    const worldH = wb.maxY - wb.minY;
    const layers = QualityManager.parallaxLayers();

    // Camera-fixed deepest backdrop — covers the viewport even when the world
    // is panned to a corner. The raid background tile carries the gradient,
    // soft bloom, and ambient star field.
    const sky = this.add
      .tileSprite(0, 0, camW + 32, camH + 32, bgKey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100);
    // Slow drift so the static tile reads as alive.
    this.tweens.add({
      targets: sky,
      tilePositionX: { from: 0, to: 512 },
      tilePositionY: { from: 0, to: 256 },
      duration: 60_000,
      repeat: -1,
      ease: 'Linear',
    });

    // Parallax starfield — two layers at scrollFactors 0.25 / 0.55. Tiled
    // across the world bounds with a generous overscan so panning never
    // reveals an edge.
    if (layers >= 1) {
      const farStars = this.add
        .tileSprite(wb.minX - 200, wb.minY - 200, worldW + 400, worldH + 400, STARFIELD_FAR_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0.25)
        .setDepth(-50)
        .setAlpha(0.85);
      void farStars;
    }
    if (layers >= 2) {
      const nearStars = this.add
        .tileSprite(wb.minX - 200, wb.minY - 200, worldW + 400, worldH + 400, STARFIELD_NEAR_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0.55)
        .setDepth(-40)
        .setAlpha(0.9);
      void nearStars;
    }
    if (layers >= 3) {
      // High-quality bonus: a third drifting dust plane for extra depth. The
      // dust hue is themed per zone so Plasma Grave drifts crimson dust while
      // Scrap Fields keeps the original purple.
      const dust = this.add
        .tileSprite(wb.minX - 200, wb.minY - 200, worldW + 400, worldH + 400, STARFIELD_FAR_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0.75)
        .setDepth(-30)
        .setAlpha(0.4)
        .setTint(theme.dustColor);
      this.tweens.add({
        targets: dust,
        tilePositionX: { from: 0, to: 512 },
        duration: 90_000,
        repeat: -1,
        ease: 'Linear',
      });
    }

    // Foreground neon grid lines tinted by the zone's accent color so the
    // arena's "place identity" extends past the backdrop tile.
    const grid = this.add.graphics();
    grid.lineStyle(1, theme.accentColor, 0.18);
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
    // Bright accent every 4 cells so the arena has anchor lines.
    const accent = this.add.graphics();
    accent.lineStyle(1.5, theme.accentColor, 0.35);
    const big = step * 4;
    for (let x = wb.minX; x <= wb.maxX; x += big) {
      accent.moveTo(x, wb.minY);
      accent.lineTo(x, wb.maxY);
    }
    for (let y = wb.minY; y <= wb.maxY; y += big) {
      accent.moveTo(wb.minX, y);
      accent.lineTo(wb.maxX, y);
    }
    accent.strokePath();
    accent.setDepth(-9);

    // Glowing arena boundary frame — uses canvas shadowBlur via preFX glow on
    // a regular Graphics. The boundary inherits the zone accent so the very
    // edge of the arena signals what zone you're in.
    const bounds = this.add.graphics();
    bounds.lineStyle(3, theme.accentColor, 0.9);
    bounds.strokeRect(wb.minX, wb.minY, worldW, worldH);
    bounds.lineStyle(1, 0xffffff, 0.45);
    bounds.strokeRect(wb.minX + 4, wb.minY + 4, worldW - 8, worldH - 8);
    bounds.setDepth(-8);
    applyGlow(bounds, theme.accentColor, 6, 0);

    // Screen-fixed vignette overlay so the player's eye is drawn to center.
    // The greedVignette built later layers ON TOP of this.
    const vignette = this.add
      .image(camW / 2, camH / 2, VIGNETTE_KEY)
      .setScrollFactor(0)
      .setDepth(1200)
      .setAlpha(0.55);
    void vignette;
  }

  // ---- end-state machine ----

  private beginExtractionMoment(): void {
    if (this.phase !== 'active') return;
    this.phase = 'extracting';
    this.extractTimer = Balance.extraction.momentDurationSec;

    // Stop incoming threats.
    this.waveDirector.stop();
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy;
      if (!e.active) continue;
      this.particles.enemyDeath(e.kind, e.x, e.y);
      e.kill();
    }
    for (const child of this.bullets.getChildren()) {
      const b = child as Bullet;
      if (b.active) b.kill();
    }

    // Brief frame freeze + radial light blast at the player.
    this.spawnRadialFlash();
    // §20.3 layered extraction success - boom + sweep + sparkle + chord.
    sfxExtractionSuccess();
  }

  private updateExtractionMoment(dt: number): void {
    this.extractTimer -= dt;
    const elapsed = Balance.extraction.momentDurationSec - this.extractTimer;
    const stillFrozen = elapsed < Balance.extraction.momentFreezeSec;

    if (!stillFrozen) {
      // After the freeze: pickups beeline to the player and any newly-magnetized
      // values are banked through the existing overlap callback.
      for (const child of this.pickups.getChildren()) {
        const p = child as Pickup;
        if (p.active) p.flyIn(this.player.x, this.player.y, Balance.extraction.flyInSpeed);
      }
    }

    if (this.extractTimer <= 0) {
      this.finishRaid('extracted');
    }
  }

  private requestEnd(state: RaidEndState, reason?: RaidEndReason): void {
    if (this.phase !== 'active') return;
    this.finishRaid(state, reason);
  }

  // Playbook §7.5 — visible LEAVE RAID button surfaced through the
  // SettingsMenu. Voluntary exit collapses the run (50% unbanked loot, same
  // as timer expiry) and skips the EXTEND RUN ad offer — the player asked
  // to leave, don't bait them with a continue prompt. Tutorial raids are
  // not exempted: a quitting tutorial player still gets the tutorial-end
  // path so progress flags fire correctly.
  public requestLeaveRaid(): void {
    if (this.phase !== 'active') return;
    if (this.adInFlight) return;
    Analytics.track('raid_left_voluntary', {
      mode: this.mode,
      tutorial: this.isTutorial,
      elapsedSec: Math.round(this.elapsed),
    });
    this.finishRaid('collapsed', 'voluntary');
  }

  private finishRaid(state: RaidEndState, reason?: RaidEndReason): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    // Derive a sensible reason when the caller didn't supply one. Maps the
    // outcome bucket to its dominant cause: extracted → 'extracted',
    // failed → 'died', collapsed → 'timer'. The voluntary LEAVE RAID path
    // overrides 'timer' → 'voluntary' by passing reason explicitly.
    const resolvedReason: RaidEndReason =
      reason ??
      (state === 'extracted' ? 'extracted' : state === 'failed' ? 'died' : 'timer');
    this.extraction.finish();
    this.waveDirector.stop();
    this.greed.stop();
    MusicEngine.stop();
    if (state === 'failed' || state === 'collapsed') sfxRaidFailed();
    // M20 — §18.3 SDK lifecycle: signal good moment on successful extract,
    // then stop gameplay. Bracket per raid regardless of outcome.
    if (state === 'extracted') SDKBridge.happytime();
    SDKBridge.gameplayStop();
    Analytics.track(
      this.isTutorial
        ? state === 'extracted'
          ? 'tutorial_extracted'
          : 'tutorial_failed'
        : state === 'extracted'
        ? 'raid_extracted'
        : state === 'failed'
        ? 'raid_failed'
        : 'raid_time_collapsed',
      {
        mode: this.mode,
        durationSec: Math.round(this.elapsed),
        greedMult: this.greed.getMultiplier(),
        // Playbook §7.3 — finer-grained "why" so the dashboard can split
        // collapsed-by-timer from collapsed-by-leave-raid without a join.
        reason: resolvedReason,
      },
    );

    // Greed multiplies banked loot on successful extract. Death and collapse
    // both forfeit 50% of unbanked loot per the prototype rule. Combo is already
    // baked into pickup values at drop time.
    let scrap = this.runLoot.scrap;
    let cores = this.runLoot.cores;
    let greedMult = 1.0;
    let penaltyApplied = false;
    if (state === 'extracted') {
      // Greed Surge card composes multiplicatively with the greed step.
      greedMult = this.greed.getMultiplier() * this.runMods.greedSurgeMult;
      scrap = Math.round(scrap * greedMult);
      cores = Math.round(cores * greedMult);
    } else {
      scrap = Math.floor(scrap * 0.5);
      cores = Math.floor(cores * 0.5);
      penaltyApplied = true;
    }

    Economy.bankLoot(scrap, cores);
    const materials = RaidZoneSystem.computeMaterialPayout(this.zone.id, scrap, this.isTutorial);
    RaidZoneSystem.bankMaterials(materials);
    if (cores > 0) {
      const save = saveSystem.get();
      if (!save.firstCoreCollected) {
        save.firstCoreCollected = true;
        save.ftueUnlocks.luckUpgrade = true;
      }
    }
    this.updateFtueProgress(state);
    const newlyUnlockedZones = RaidZoneSystem.syncUnlocks();

    // M19 — daily seed leaderboard. Only successful extracts on a daily-seed
    // raid count; tutorial and normal raids are filtered out. Score is the
    // banked Scrap (post-greed multiplier).
    if (this.mode === 'dailySeed' && state === 'extracted') {
      const todayIso = todayUtcDateForLeaderboard();
      void LeaderboardSystem.submitScore(todayIso, scrap);
    }
    // Mission Board events — extracted-with-cores, extracted-at-greed.
    if (state === 'extracted') {
      bus.emit('mission:extractedWithCores', { cores });
      bus.emit('mission:extractedAtGreed', { greed: greedMult });
      bus.emit('mission:zoneExtract', { zoneId: this.zone.id });
    }
    if (RaidZoneSystem.totalMaterials(materials) > 0) {
      bus.emit('mission:materialsBanked', materials);
    }

    // M17 — apply cleanse + maybe-infest. handleRaidEnd mutates the save in
    // place; the persist() below captures everything in one shot.
    const infOutcome = InfestationSystem.handleRaidEnd({
      isTutorial: this.isTutorial,
      state,
      cleanseProgress: this.cleanseProgress,
      rng: this.rng,
    });

    // M20 — consume one-raid OPERATOR TRY-OUT (any outcome). Stamp lastRaidDate
    // so DAILY CRATE knows the player has raided today.
    const save = saveSystem.get();
    save.tryOutOperator = null;
    save.lastRaidDate = todayUtcDateForLeaderboard();

    // M23 — achievements + season XP per blueprint §10.4 / §16.5. Both run
    // AFTER FtueProgress so raidsCompleted is current; both are no-ops on
    // tutorial raids.
    if (!this.isTutorial) {
      AchievementSystem.handleRaidEnd({ state, greedMult, tutorial: this.isTutorial });
      // Retention pass — DOUBLE PAYDAY consumes one raid regardless of
      // outcome so the rare 2x window can't be camped by aborting raids.
      // Tutorial raids never count so the FTUE doesn't burn the event.
      RetentionSystem.consumePaydayRaid();
    }

    // Persist immediately on raid-end so the player can't lose loot to a tab
    // close on the summary screen. The 10s autosave and the RAID_ENDED handler
    // both still fire later; this is the belt-and-suspenders save.
    void saveSystem.persist();

    const payload: RaidEndPayload = {
      endState: state,
      endReason: resolvedReason,
      loot: { scrap, cores, materials },
      greedMult,
      penaltyApplied,
      tutorial: this.isTutorial,
      newlyInfested: infOutcome.newlyInfested,
      machinesRestored: infOutcome.restored,
      // M20 — DOUBLE LOOT vs REVIVE mutex (§17.3). Suppress DOUBLE LOOT
      // on the summary if REVIVE was already prompted this raid.
      allowDoubleLoot: !this.revivePromptShown,
      zoneId: this.zone.id,
      zoneName: this.zone.name,
      unlockedZones: newlyUnlockedZones.map(z => z.name),
    };

    // Small delay so the moment's tail visuals finish before the summary appears.
    this.time.delayedCall(120, () => {
      this.scene.launch('SummaryScene', payload);
      this.scene.pause();
    });
  }

  // Centralizes the §5.3 progressive-reveal rules. Called once per raid-end,
  // before the SummaryScene reads the save. The §5.3 table puts a few unlocks
  // on the "X raids completed" axis; raidsCompleted counts the tutorial as
  // raid #1, so the magnet/drone/damage gates compare against >=2/>=3/>=4.
  private updateFtueProgress(state: RaidEndState): void {
    const save = saveSystem.get();
    save.raidsCompleted += 1;
    if (state === 'extracted') save.successfulExtracts += 1;

    if (this.isTutorial && state === 'extracted') {
      save.tutorialDone = true;
      save.ftueUnlocks.dailyClaim = true;
    }

    // Real-raid count (post-tutorial). Reveal milestones key off this number,
    // not raidsCompleted, so a player who never finished the tutorial doesn't
    // accidentally unlock real-raid gates by failing it.
    const realRaids = save.tutorialDone ? Math.max(0, save.raidsCompleted - 1) : 0;
    if (realRaids >= 1) save.ftueUnlocks.magnetUpgrade = true;
    if (realRaids >= 2) save.ftueUnlocks.droneUpgrade = true;
    if (realRaids >= 3) save.ftueUnlocks.damageUpgrade = true;
    if (realRaids >= 5) save.ftueUnlocks.factoryBoost = true;
  }

  // ---- tutorial-only helpers ----

  // Tutorial loop just drives caption timings now - power-up spawns and
  // effects are handled by PowerupSystem in tutorial mode (scripted at
  // §5.4 timestamps).
  private tickTutorial(_dt: number): void {
    const timings = Balance.tutorial.captionTimings;
    for (let i = this.captionDoneIdx + 1; i < timings.length; i++) {
      if (this.elapsed >= timings[i].t) {
        this.captionDoneIdx = i;
        this.showTutorialCaption(timings[i].key);
      } else break;
    }
  }

  private showTutorialCaption(key: TutorialCaptionKey): void {
    const text =
      key === 'move'
        ? Strings.ftueMove
        : key === 'dash'
          ? Strings.ftueDash
          : key === 'dashImmune'
            ? Strings.ftueDashImmune
            : key === 'powerup'
              ? Strings.ftuePowerup
              : Strings.ftueExtract;
    // The dashImmune follow-up renders smaller than the headline captions
    // so it reads as a clarification of the prior 'DASH' caption rather
    // than introducing a fresh mechanic.
    const fontSize = key === 'dashImmune' ? '40px' : '64px';
    const t = this.add.text(this.scale.width / 2, 220, text, {
      fontFamily: 'monospace',
      fontSize,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    });
    t.setOrigin(0.5).setScrollFactor(0).setDepth(2200).setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: Balance.tutorial.captionFadeMs,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(Balance.tutorial.captionHoldSec * 1000, () => {
      this.tweens.add({
        targets: t,
        alpha: 0,
        duration: Balance.tutorial.captionFadeMs,
        onComplete: () => t.destroy(),
      });
    });
  }

  private spawnTutorialBanner(): void {
    const banner = this.add.text(this.scale.width / 2, 6, Strings.ftueTutorialBanner, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
      stroke: '#000000',
      strokeThickness: 2,
    });
    banner.setOrigin(0.5, 0).setScrollFactor(0).setDepth(2050);
    this.tutorialBanner = banner;
  }

  private spawnZoneBanner(): void {
    const label = `${this.zone.name.toUpperCase()}  |  THREAT x${this.zone.threatMult.toFixed(2)}`;
    const banner = this.add.text(this.scale.width / 2, 6, label, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: this.zone.color,
      stroke: '#000000',
      strokeThickness: 2,
    });
    banner.setOrigin(0.5, 0).setScrollFactor(0).setDepth(2050);
  }

  private spawnInitialScrapPile(): void {
    // §5.2 0.0s: "Big arrow points to nearby scrap pile" - we spawn a small
    // visible cluster right next to the player so the player picks it up within
    // the first 2 seconds without needing to chase.
    const offset = Balance.tutorial.initialScrapPileOffset;
    for (let i = 0; i < Balance.tutorial.initialScrapPileCount; i++) {
      const angle = (i / Balance.tutorial.initialScrapPileCount) * Math.PI * 2;
      const x = this.player.x + Math.cos(angle) * offset;
      const y = this.player.y + Math.sin(angle) * offset;
      const p = this.pickups.get(x, y) as Pickup | null;
      if (p) p.spawn(x, y, 'scrap', 1, this.rng);
    }
  }

  // ---- power-up overlap + chain + instant handlers ----

  private onPowerupOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, powerupObj) => {
    const pup = powerupObj as Powerup;
    if (!pup.active) return;
    const kind = pup.kind;
    const def = PowerupDefs[kind];
    pup.kill();
    this.powerupSystem.activate(kind);
    // §13: every power-up surfaces its label as a popup so the player learns
    // the names without a tooltip.
    this.showPopup(this.player.x, this.player.y - 24, def.label, '#ffd75a');
    sfxPowerup();
    // Distinctive per-kind cue plays on top of the generic chirp. Shield uses
    // its own SFX inside Player.addShieldCharge; nuke/timeBonus are routed via
    // their activation handlers.
    if (kind === 'magnetBurst') sfxMagnetBurst();
    else if (kind === 'laserOverdrive') sfxLaserOverdrive();
    else if (kind === 'freezePulse') sfxFreezePulse();
    else if (kind === 'turretDrop') this.placeTurret(this.player.x, this.player.y);
    bus.emit(Events.POWERUP_COLLECTED, kind);
  };

  // Drops a friendly auto-fire turret at (x, y). Active while the
  // turretDrop power-up is. Disposed in tickTurret when the buff ends.
  private placeTurret(x: number, y: number): void {
    if (this.turret) this.turret.gfx.destroy();
    const gfx = this.add.graphics();
    gfx.setDepth(8);
    gfx.fillStyle(0xff9c3d, 1);
    gfx.fillCircle(0, 0, 11);
    gfx.lineStyle(2, 0xffffff, 0.85);
    gfx.strokeCircle(0, 0, 11);
    gfx.lineBetween(0, 0, 14, 0);
    gfx.setPosition(x, y);
    this.turret = { x, y, cooldown: 0, gfx };
  }

  // Per-frame: fire at the nearest enemy in range, dispose when buff ends.
  private tickTurret(dt: number): void {
    if (!this.turret) return;
    if (!this.powerupSystem.isTurretActive()) {
      this.turret.gfx.destroy();
      this.turret = null;
      return;
    }
    const t = this.turret;
    t.cooldown -= dt;
    if (t.cooldown > 0) return;
    // Reuse the WeaponSystem's tracer rendering for visual consistency, but
    // pick a target from the spatial grid centered on the turret rather than
    // the player.
    const range = 320;
    const nearby = this.enemyGrid.queryNearby(t.x, t.y, range, []);
    let best: Enemy | null = null;
    let bestD2 = range * range;
    for (const e of nearby) {
      if (!e.active) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    if (!best) return;
    this.weapons.drawTracer(t.x, t.y, best.x, best.y, 0xff9c3d);
    const dmg = (Balance.weapon.baseDamage + UpgradeEffects.weaponDamageLevel() * Balance.weapon.damagePerLevel) * 0.6;
    this.processHit(best, dmg, t.x, t.y, false);
    t.cooldown = 0.18;
  }

  // processHit centralizes the per-hit damage path: render -damage popup, run
  // hit() / kill paths, then if Drone Swarm is up, chain to N more enemies
  // within the chain radius. M14 layers in knockback (push enemies away
  // from the hit source) and hit-stop on Tank / elite kills. M15 adds the
  // crit popup styling and Vampiric chance on kill, and folds Chain Lightning
  // (drafted) into the chain hop budget.
  private processHit(target: Enemy, damage: number, sourceX: number, sourceY: number, crit: boolean = false): void {
    if (!target.active) return;
    const tx = target.x;
    const ty = target.y;
    target.applyKnockback(sourceX, sourceY);
    const killed = target.hit(damage);
    this.showDamagePopup(tx, ty - 16, damage, crit ? '#ff416b' : '#ffffff', crit);
    if (killed) {
      this.particles.enemyDeath(target.kind, tx, ty);
      this.spawnDrops(target);
      const wasTank = target.kind === 'tank';
      const wasElite = target.kind === 'elite';
      const wasInfested = target.kind === 'infested';
      target.kill();
      this.onEnemyKilled(tx, ty, target);
      sfxEnemyDeath();
      if (wasElite) this.hitStopTimer = Math.max(this.hitStopTimer, Balance.raid.hitStopEliteSec);
      else if (wasTank) this.hitStopTimer = Math.max(this.hitStopTimer, Balance.raid.hitStopTankSec);
      // M17 cleanse credit. Each infestation kill counts 1 against the
      // killsToRestoreMachine threshold.
      if (wasInfested) this.cleanseProgress += 1;
      // Vampiric (drafted): on kill, chance to heal a small amount.
      if (this.runMods.vampiricChance > 0 && this.rng.next() < this.runMods.vampiricChance) {
        const healed = this.player.heal(this.runMods.vampiricHeal);
        if (healed > 0) this.showPopup(this.player.x, this.player.y - 36, `+${healed}`, '#72ff9f');
      }
    } else {
      sfxEnemyHit();
    }

    // Chain (Drone Swarm power-up + Chain Lightning drafted card). Each hop
    // deals the same damage; total hops = power-up chain + drafted chainBonus.
    const chains = this.powerupSystem.getChainCount() + this.runMods.chainBonus;
    if (chains <= 0) return;
    let fromX = tx;
    let fromY = ty;
    const visited = new Set<Enemy>([target]);
    for (let i = 0; i < chains; i++) {
      const next = this.findChainTarget(fromX, fromY, visited);
      if (!next) break;
      visited.add(next);
      this.weapons.drawTracer(fromX, fromY, next.x, next.y, PowerupDefs.droneSwarm.color);
      const nextX = next.x;
      const nextY = next.y;
      next.applyKnockback(fromX, fromY);
      const nextKilled = next.hit(damage);
      this.showDamagePopup(nextX, nextY - 16, damage, '#a76cff');
      if (nextKilled) {
        this.particles.enemyDeath(next.kind, nextX, nextY);
        this.spawnDrops(next);
        const wasInfestedChain = next.kind === 'infested';
        next.kill();
        this.onEnemyKilled(nextX, nextY, next);
        if (wasInfestedChain) this.cleanseProgress += 1;
      }
      fromX = nextX;
      fromY = nextY;
    }
  }

  // §19.4 damage popups: combo >= 2 reads bigger + brighter so high-combo
  // kills feel punchy. Shared with normal and chain hits. M15 adds a crit
  // path that always renders big/red regardless of combo.
  private showDamagePopup(x: number, y: number, damage: number, baseColor: string = '#ffffff', crit: boolean = false): void {
    const big = this.combo >= 2.0 || crit;
    const fontSize = big ? '20px' : '14px';
    const color = crit ? '#ff416b' : (big ? '#ffd75a' : baseColor);
    if (this.activePopups >= Balance.performance.maxPopups) return;
    this.activePopups++;
    const t = this.add.text(x, y, `-${Math.round(damage)}`, {
      fontFamily: 'monospace',
      fontSize,
      color,
      stroke: '#000000',
      strokeThickness: big ? 4 : 3,
    });
    t.setOrigin(0.5).setDepth(100);
    this.tweens.add({
      targets: t,
      y: y - Balance.ui.popupRiseDist * (big ? 1.4 : 1),
      alpha: 0,
      duration: Balance.ui.popupDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.destroy();
        this.activePopups--;
      },
    });
  }

  private findChainTarget(fromX: number, fromY: number, visited: Set<Enemy>): Enemy | null {
    const radius2 = Balance.powerups.droneSwarmChainRadius * Balance.powerups.droneSwarmChainRadius;
    let best: Enemy | null = null;
    let bestD2 = radius2;
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy;
      if (!e.active || visited.has(e)) continue;
      const dx = e.x - fromX;
      const dy = e.y - fromY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  // Signal Nuke (§13 "kills all on-screen enemies"). We use a generous radius
  // around the player rather than reading the camera so a player at the edge
  // of the arena still clears the wave they can see.
  private activateSignalNuke(): void {
    const r2 = Balance.powerups.signalNukeRadius * Balance.powerups.signalNukeRadius;
    if (!QualityManager.isReducedMotion()) this.cameras.main.shake(180, 0.012);
    sfxNuke();
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy;
      if (!e.active) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy > r2) continue;
      const ex = e.x;
      const ey = e.y;
      this.particles.enemyDeath(e.kind, ex, ey);
      this.spawnDrops(e);
      const wasInfestedNuke = e.kind === 'infested';
      e.kill();
      this.onEnemyKilled(ex, ey, e);
      if (wasInfestedNuke) this.cleanseProgress += 1;
    }
    // Also clear in-flight enemy bullets so the nuke feels totally clean.
    for (const child of this.bullets.getChildren()) {
      const b = child as Bullet;
      if (b.active) b.kill();
    }
  }

  // +15 Seconds: just extends the raid timer. The HUD timer rounds up so the
  // bump is visible immediately.
  private activateTimeBonus(): void {
    this.timeRemaining += Balance.powerups.timeBonusSeconds;
    sfxTimeBonus();
  }

  // ---- waypoint target (consumed by HUDScene) ----

  // Priority order: an open extraction pad always wins. Before extraction
  // opens, the tutorial directs the off-screen arrow at the live power-up
  // (if any). Non-tutorial raids return null until extraction opens.
  getWaypointTarget(): WaypointTarget | null {
    if (this.extraction.isOpen()) {
      const pos = this.extraction.getPadPosition();
      return { x: pos.x, y: pos.y, kind: 'extract' };
    }
    if (this.isTutorial) {
      for (const child of this.powerups.getChildren()) {
        const p = child as Powerup;
        if (p.active) return { x: p.x, y: p.y, kind: 'powerup' };
      }
    }
    return null;
  }

  isTutorialRaid(): boolean {
    return this.isTutorial;
  }

  // Read by HUDScene to render the active-power-up strip (timer-bar pips).
  getActivePowerups(): ReturnType<PowerupSystem['getActiveEffectsView']> {
    return this.powerupSystem.getActiveEffectsView();
  }

  // Shield Bubble (§13): HUD renders a small pip when the player holds at
  // least one charge. The charge isn't timed - it lives on the Player.
  getShieldCharges(): number {
    return this.player.shieldCharges;
  }

  // M21 — entity counts read by the performance overlay (§24.5). Live
  // counts of active group members; no allocation.
  getEntityCounts(): { enemies: number; pickups: number; bullets: number; powerups: number } {
    let e = 0;
    let p = 0;
    let b = 0;
    let pw = 0;
    for (const c of this.enemies.getChildren()) if (c.active) e++;
    for (const c of this.pickups.getChildren()) if (c.active) p++;
    for (const c of this.bullets.getChildren()) if (c.active) b++;
    for (const c of this.powerups.getChildren()) if (c.active) pw++;
    return { enemies: e, pickups: p, bullets: b, powerups: pw };
  }

  private spawnRadialFlash(): void {
    const px = this.player.x;
    const py = this.player.y;

    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 0.85);
    flash.fillCircle(0, 0, 60);
    flash.setPosition(px, py);
    flash.setDepth(900);
    this.tweens.add({
      targets: flash,
      scaleX: Balance.extraction.momentFlashMaxScale,
      scaleY: Balance.extraction.momentFlashMaxScale,
      alpha: 0,
      duration: Balance.extraction.momentFlashDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });

    const ring = this.add.graphics();
    ring.lineStyle(8, Balance.colors.extraction, 1);
    ring.strokeCircle(0, 0, 90);
    ring.setPosition(px, py);
    ring.setDepth(901);
    this.tweens.add({
      targets: ring,
      scaleX: Balance.extraction.momentRingMaxScale,
      scaleY: Balance.extraction.momentRingMaxScale,
      alpha: 0,
      duration: Balance.extraction.momentRingDurationMs,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
