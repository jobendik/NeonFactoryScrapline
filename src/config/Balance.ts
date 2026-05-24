// All tunable numbers live here. Sourced from blueprint.md §23.
// Never hardcode tuning values in game logic - reference Balance instead.

export const Balance = {
  raid: {
    normalDuration: 75,
    tutorialDuration: 45,
    extractionOpenTime: 20,
    tutorialExtractionOpenTime: 18,
    extractionHoldTime: 5,
    extractionDecayRate: 0.85,
    draftTimes: [20, 45] as const,
    greedSteps: [
      { afterSeconds: 0, mult: 1.0 },
      { afterSeconds: 10, mult: 1.25 },
      { afterSeconds: 20, mult: 1.5 },
      { afterSeconds: 30, mult: 2.0 },
      { afterSeconds: 45, mult: 3.0 },
    ] as const,
    extendAdSeconds: 30,
    comboPerKill: 0.08,
    comboMax: 3.5,
    comboDecayPerSec: 0.8,
    comboGraceSec: 2.2,
    draftTimeScale: 0.1,
    draftAutoPickSec: 8,
    // §7.3 greed-side escalation. Indexed by greed step (0..4) matching the
    // greedSteps table above. Spawn-rate mult goes through WaveDirector;
    // tankRushFactor and eliteCount drive WaveDirector behavior; the vignette
    // intensity drives the HUD red pulse.
    greedEscalation: [
      { spawnRateMult: 1.00, tankRushFactor: 0,    eliteCount: 0, vignette: 0.00 },
      { spawnRateMult: 1.20, tankRushFactor: 0,    eliteCount: 0, vignette: 0.18 },
      { spawnRateMult: 1.40, tankRushFactor: 0.20, eliteCount: 0, vignette: 0.35 },
      { spawnRateMult: 1.60, tankRushFactor: 0.45, eliteCount: 0, vignette: 0.55 },
      { spawnRateMult: 1.80, tankRushFactor: 0.55, eliteCount: 1, vignette: 0.78 },
    ] as const,
    // Knockback impulse applied to chasers on player-bullet hit. Decays over
    // knockbackDurSec so the enemy resumes pursuit smoothly.
    knockbackSpeed: 280,
    knockbackDurSec: 0.12,
    // Hit-stop on Tank / elite kills - whole RaidScene update pauses for this
    // many seconds, then resumes. ~1-2 frames at 60fps.
    hitStopTankSec: 0.05,
    hitStopEliteSec: 0.09,
    // Near-miss reward: enemy passes within Npx of player while player is
    // dashing → +N Scrap. Cleared on dash end.
    nearMissRadius: 30,
    nearMissReward: 2,
    // §7.3 "boss wave" - at greed x3 the deep-end tint deepens to signal it.
    deepEndTintAt: 4,
  },
  // FTUE / tutorial raid per blueprint §5. The tutorial raid uses these mods on
  // top of normal balance; scripted events fire at the listed timestamps. Captions
  // honor the §5.1 "no more than 4 words on screen" rule.
  tutorial: {
    playerHpMult: 2.0,
    playerDamageMult: 2.0,
    enemySpawnRateMult: 0.4,
    enemyHpMult: 0.5,
    safetyNetHpFloor: 1,
    captionHoldSec: 2.6,
    captionFadeMs: 320,
    initialScrapPileCount: 3,
    initialScrapPileOffset: 90,
    captionTimings: [
      { t: 0.0, key: 'move' as const },
      { t: 6.0, key: 'dash' as const },
      { t: 12.0, key: 'powerup' as const },
      { t: 18.0, key: 'extract' as const },
    ] as const,
    // Scripted §5.4 power-up spawn times - consumed by PowerupSystem when
    // running in tutorial mode. Effect durations / radii live in
    // Balance.powerups (those are real-power-up rules, shared with non-tutorial raids).
    droneSwarmAtSec: 10.0,
    magnetBurstAtSec: 25.0,
  },
  player: {
    baseSpeed: 260,
    speedPerLevel: 18,
    accel: 17,
    baseHP: 105,
    hpPerGenLevel: 3,
    dashCooldown: 1.15,
    dashForce: 760,
    dashDuration: 0.18,
    dashInvuln: 0.18,
    invulnAfterHit: 0.18,
    worldBounds: { minX: -800, maxX: 800, minY: -560, maxY: 560 },
  },
  weapon: {
    baseFireCooldown: 0.105,
    laserFireCooldown: 0.06,
    laserTargets: 2,
    baseRange: 365,
    rangePerDamage: 8,
    baseDamage: 11,
    damagePerLevel: 4,
  },
  enemies: {
    maxOnScreen: 32,
    spawnCooldownStart: 0.95,
    spawnCooldownEnd: 0.24,
    spawnDistance: 720,
    weights: {
      grunt: 0.48,
      swarmer: 0.20,
      shooter: 0.16,
      tank: 0.12,
      elite: 0.04,
    },
    scaling: { hpMult: 1.0, hpMultPerRaidSecond: 1 / 75 },
    // Bomber (§14.1): telegraphed-explosion enemy. Per blueprint §7.3 it
    // joins the spawn pool at greed x2 and becomes more common at higher
    // greed steps.
    bomber: {
      // Per-second chance to spawn an extra Bomber on top of the base wave,
      // indexed by greed step. Step 0 / 1 = none; step 2 onward = increasing.
      spawnChancePerSecByGreedStep: [0, 0, 0.18, 0.32, 0.55] as const,
      telegraphSec: 0.5,
      explosionRadius: 90,
      explosionDamage: 28,
      chargeSpeedMult: 1.15,
    },
    // Loot Goblin (§14.1): flees from player, drops fat reward if killed
    // before despawning. Spawns rarely on any raid.
    lootGoblin: {
      spawnIntervalMin: 25,
      spawnIntervalMax: 45,
      lifetimeSec: 12,
      fleeSpeedMult: 1.25,
      powerupDropChance: 0.05,
    },
    // Shield Carrier (§14.1): auras a damage-reduction buff to nearby
    // enemies. Players must take the carrier out first to power-spike.
    shieldCarrier: {
      auraRadius: 140,
      auraDamageReduction: 0.55,
      // Rolled per spawn cycle alongside the base table once unlocked.
      spawnWeight: 0.06,
      unlockAtGreedStep: 2,
    },
    // Splitter (§14.1): on death spawns N swarmers around the corpse.
    splitter: {
      spawnCount: 3,
      spawnSpread: 22,
      spawnWeight: 0.05,
      unlockAtGreedStep: 1,
    },
    // Extract Jammer (§14.1): targets the extraction pad, slows the fill
    // timer while within auraRadius of the pad center.
    extractJammer: {
      auraRadius: 160,
      timerSlowFactor: 0.35,
      spawnWeight: 0.10,
      // Only spawns once extraction has opened.
      onlyAfterExtractOpen: true,
    },
  },
  economy: {
    upgrades: {
      gen:    { base: 25, scale: 1.50 },
      drone:  { base: 60, scale: 1.62 },
      speed:  { base: 45, scale: 1.55 },
      magnet: { base: 50, scale: 1.55 },
      damage: { base: 55, scale: 1.60 },
      luck:   { base: 80, scale: 1.70 },
    },
    coreChanceBase: 0.11,
    coreChancePerLuck: 0.035,
    coreChanceTankBonus: 0.15,
    offlineCapHours: 8,
    spm: { base: 14, drone: 0.22 },
    dailyReward: 100,
    factoryBoostDuration: 120,
    factoryBoostMult: 2,
    startingScrap: 100,
  },
  infestation: {
    maxMachineRatio: 0.5,
    machinesLostPerFail: { min: 1, max: 3 },
    failsBeforeInfestation: 3,
    killsToRestoreMachine: 30,
    // M17 wave cadence: when the player has any infested machines, the
    // raid spawns one extra red-tinted swarmer every spawnIntervalSec,
    // beginning firstWaveDelaySec into the raid.
    firstWaveDelaySec: 5,
    spawnIntervalSec: 1.6,
    // Per-frame jitter applied to infested enemy rotation so the visual
    // reads "glitched" even though the body is stable.
    glitchAmplitudeRad: 0.18,
    glitchHz: 8,
  },
  prestige: {
    minGenLevel: 25,
    minCores: 1000,
    cyberCoreBonus: 0.10,
  },
  powerups: {
    firstSpawnSecNormal: 8,
    firstSpawnSecTutorial: 4,
    spawnIntervalMin: 9,
    spawnIntervalMax: 14,
    maxOnField: 10,
    spawnRadius: 280,
    // Magnet Burst: temporary magnet-radius multiplier.
    magnetBurstRadiusMult: 3.0,
    // Drone Swarm = "chain shots to extra enemies" per §13. After damaging
    // the primary target, the shot also damages up to N additional nearest
    // enemies within droneSwarmChainRadius.
    droneSwarmChainCount: 2,
    droneSwarmChainRadius: 220,
    // Signal Nuke radius around the player. Per blueprint copy "kills all
    // on-screen enemies"; we use a generous radius rather than literally
    // reading the camera so it still feels right at edge cases.
    signalNukeRadius: 900,
    timeBonusSeconds: 15,
    // The power-up's own pickup radius - larger than scrap so it feels easy.
    pickupCollectRadius: 26,
    // Freeze Pulse - flash to indicate freeze status on each enemy.
    freezeTint: 0xb3e0ff,
  },
  performance: {
    maxParticles: 360,
    maxPopups: 70,
    maxPickups: 220,
    dtClamp: 0.033,
    // M21 spatial-grid cell size for nearest-enemy + pickup-magnet queries.
    // 120px works well at world-bounds 1600x1120 — small enough to keep
    // bucket sizes low (≤4 enemies/cell typical) without producing too
    // many cells (≈ 14×10 = 140 buckets max).
    spatialGridCellPx: 120,
  },
  // §24 quality + auto-detect tuning. Default preset is medium; auto-detect
  // can drop to low on sustained <40fps. The dprCap is reserved for future
  // canvas-resolution work; the rest are live caps read each frame.
  quality: {
    defaultPreset: 'medium' as const,
    presets: {
      low: {
        dprCap: 1.0,
        maxParticles: 120,
        glow: false,
        parallaxLayers: 0,
        enemyCap: 20,
      },
      medium: {
        dprCap: 1.5,
        maxParticles: 240,
        glow: true,
        parallaxLayers: 2,
        enemyCap: 28,
      },
      high: {
        dprCap: 2.0,
        maxParticles: 360,
        glow: true,
        parallaxLayers: 3,
        enemyCap: 32,
      },
    },
    // Rolling-FPS auto-detect: drop to Low when avg < N for `downgradeWindow`
    // sustained; offer High (one-time) when avg > M for `upgradeWindow` sustained.
    autoDowngradeBelowFps: 40,
    autoUpgradeAboveFps: 58,
    autoDowngradeWindowSec: 5,
    autoUpgradeWindowSec: 30,
  },
  rendering: {
    width: 1280,
    height: 720,
    backgroundColor: '#03060b',
  },
  ui: {
    joystickMaxRadius: 90,
    joystickDeadZone: 0.15,
    dashButtonRadius: 60,
    dashButtonOffset: 110,
    cameraFollowLerp: 0.12,
    dashShakeDuration: 140,
    dashShakeIntensity: 0.006,
    hitShakeDuration: 100,
    hitShakeIntensity: 0.004,
    tracerFadeMs: 90,
    fpsUpdateMs: 250,
    gridStep: 80,
    gridAlpha: 0.08,
    boundsAlpha: 0.22,
    popupRiseDist: 36,
    popupDurationMs: 700,
  },
  colors: {
    player: 0x22f6ff,
    playerOutline: 0xffffff,
    playerDashAccent: 0xffd75a,
    scrap: 0x22f6ff,
    core: 0xffd75a,
    enemyGrunt: 0xff416b,
    enemySwarmer: 0xff7aa6,
    enemyTank: 0xff9c3d,
    enemyShooter: 0xa76cff,
    enemyTelegraph: 0xa76cff,
    elite: 0xff1644,
    extraction: 0x72ff9f,
    bulletTracer: 0x22f6ff,
    background: 0x22f6ff,
    danger: 0xff416b,
    reward: 0xffd75a,
  },
  particles: {
    enemyDeathCount: 10,
  },
  magnet: {
    baseRadius: 130,
    radiusPerLevel: 18,
    collectRadiusBoost: 4,
    popOutSpeedMin: 80,
    popOutSpeedMax: 180,
    popOutDrag: 240,
    minPullSpeed: 220,
    maxPullSpeed: 880,
    pickupLifespanSec: 14,
    // M22 §8.5 — Magnet Lv. 5 orbit-before-collection. orbitEntryRadius is
    // the distance at which the orbit phase engages; orbitRadius is the
    // ring the pickups trace around the player; orbitDurationSec is how
    // long the dance lasts before final beeline; orbitSpeedRad is the
    // angular velocity (full revolution per ~0.6s).
    orbitEntryRadius: 60,
    orbitRadius: 36,
    orbitDurationSec: 0.3,
    orbitSpeedRad: 10.0,
  },
  shooter: {
    desiredDistance: 280,
    minDistance: 220,
    maxDistance: 360,
    telegraphSec: 0.4,
    fireIntervalMinSec: 2.0,
    fireIntervalMaxSec: 3.0,
    fireRangeMax: 520,
    bulletSpeed: 300,
    bulletDamage: 10,
    bulletLifespanSec: 4.0,
    bulletMaxOnField: 32,
    telegraphAlpha: 0.75,
    telegraphWidth: 2,
  },
  extraction: {
    padX: 520,
    padY: 340,
    padRadius: 64,
    momentDurationSec: 1.5,
    momentFreezeSec: 0.15,
    momentFlashMaxScale: 24,
    momentFlashDurationMs: 700,
    momentRingMaxScale: 9,
    momentRingDurationMs: 800,
    flyInSpeed: 1600,
    waypointEdgeMargin: 50,
    // M22 HUD pass — waypoint arrow size bumped from 22 → 28 so it reads
    // clearly at mobile size; HUDScene also strokes it with a thicker outline.
    waypointSize: 28,
  },
  // §12 in-run drafting. Card numerics are sourced from the blueprint's card
  // list; tweaking here is a one-file pass for balance.
  cards: {
    // Time-slow during draft would be 0.1 per §7.6. We pause the scene instead
    // (see DraftScene comments) so this is unused, but kept for documentation.
    timeScale: 0.1,
    autoPickSec: 8,
    rarityWeights: {
      // Index matches Balance.raid.draftTimes order: [0]=20s draft, [1]=45s draft.
      first:  { common: 0.70, rare: 0.25, epic: 0.05 },
      second: { common: 0.40, rare: 0.45, epic: 0.15 },
    },
    chainBonusRadius: 200,        // §12 "Chain Lightning: shots bounce within 200px"
    magnetStormDurSec: 8,         // per pick
    orbitalShieldRegenSec: 12,    // per blueprint
    phoenixReviveHpRatio: 0.5,    // 50% HP
    greedSurgeMult: 1.5,
    sharperShotsAdd: 0.15,
    quickFeetAdd: 0.10,
    wideMagnetAdd: 0.20,
    hardyHpAdd: 20,
    burstFireAdd: 0.10,
    luckyAdd: 0.05,
    dashMasterMult: 0.70,         // ×0.7 cooldown
    // Suggestions audit tuning fix: original 1 HP/scrap felt slow. Bumped
    // to 2 so the card has a noticeable healing cadence.
    healOnPickupAdd: 2,
    critChanceAdd: 0.15,
    critMult: 3.0,
    vampiricChanceAdd: 0.10,
    vampiricHeal: 5,
    // Suggestions audit — previously-deferred cards. Tunings chosen
    // conservatively so picks feel meaningful without dominating builds.
    slowFieldRadius: 100,
    slowFieldFactor: 0.30,           // enemies in radius move at 70% speed
    frenzyHpFraction: 0.30,          // < 30% HP triggers
    frenzyFireMult: 0.50,            // 50% faster fire while in frenzy
    novaDashRadius: 110,
    novaDashDamage: 18,
    timeDilationFactor: 0.85,        // global enemy speed ×0.85
    pyroAoeRadius: 80,
    pyroAoeDamage: 12,
  },
  // §17 rewarded ad placements. All tuning lives here so the §17.3 frequency
  // rules are one-file changes if we revisit them. Real ads are post-launch;
  // M20 wires through SDKBridge.requestRewarded() which returns success in
  // dev so the reward flows are testable.
  ads: {
    // REVIVE — gated behind `raidsCompleted >= reviveAfterRaidsCompleted` at
    // time of death (tutorial counts). Probabilistic so revive doesn't feel
    // like a guaranteed crutch.
    reviveAfterRaidsCompleted: 3,
    reviveProbability: 0.75,
    reviveHpRatio: 0.6,
    reviveInvulnSec: 2.2,
    // EXTEND RUN — +Nsec to the raid timer. Single use per raid (RaidScene
    // tracks the per-raid flag).
    extendRunSeconds: 30,
    // FACTORY BOOST — 2x SPM for N ms, real-time cooldown of M ms.
    factoryBoostDurationMs: 120_000,   // 2 minutes
    factoryBoostCooldownMs: 600_000,   // 10 minutes
    // DAILY CRATE — once per UTC day after the day's first raid. Rolls
    // a small Scrap range or a single Core.
    dailyCrateScrapMin: 100,
    dailyCrateScrapMax: 500,
    dailyCrateScrapProbability: 0.6,
    dailyCrateCoreReward: 1,
  },
  factory: {
    backgroundColor: '#04080c',
    generatorPositions: [
      { x: -380, y: -120 },
      { x: -380, y: 140 },
    ] as const,
    deployPad: { x: 460, y: 0, radius: 70, holdSec: 0.4 },
    generatorSize: 64,
    generatorDropOffsetMin: 36,
    generatorDropOffsetMax: 80,
    generatorPulseHz: 0.9,
  },
} as const;

export type BalanceConfig = typeof Balance;
