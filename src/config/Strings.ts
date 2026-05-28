// All player-facing strings. English is the source of truth; secondary
// languages live in `translations` below and override any matching keys when
// the user picks them via the settings menu.
//
// Theme: STARFALL GARDEN — a cozy magical garden / potion academy where the
// player flies out on moonlit raids to gather stardust, star hearts and
// ingredients, then grows and enchants a living night garden back home.
//
// NOTE: the *keys* below are intentionally stable (some still read like the
// old build internally, e.g. `summaryScrap`, `factoryDeploy`). Renaming them
// would touch dozens of call sites and risk save/UI regressions, so only the
// player-facing *values* changed during the Starfall Garden re-theme.

const StringsEn = {
  bootOk: 'Boot OK',
  gameTitle: 'STARFALL GARDEN',
  fps: 'FPS',
  comboLabel: 'COMBO',
  timerLabel: 'TIME',
  extractionOpened: 'MOONGATE OPEN',
  extractionHold: 'HOLD',
  summaryExtracted: 'FLIGHT COMPLETE',
  summaryFailed: 'FLIGHT LOST',
  summaryCollapsed: 'DAWN BROKE',
  summaryScrap: 'STARDUST',
  summaryCores: 'STAR HEARTS',
  summaryMaterials: 'INGREDIENTS',
  summaryFactory: 'GARDEN',
  summaryRedeploy: 'ONE MORE FLIGHT',
  summaryDoubleLoot: 'DOUBLE HARVEST',
  summaryPenalty: '+50% STARDUST SAVED',
  greedLabel: 'GLIMMER',
  hpLabel: 'HP',
  factoryStubTitle: 'GARDEN',
  factoryStubSub: 'Garden hub — Milestone 8',
  factoryDeploy: 'TAKE FLIGHT',
  factorySpm: 'SPM',
  factoryDeployHint: 'STEP ON THE GATE TO FLY',
  // FTUE captions per blueprint §5.2 - max 4 words each.
  ftueMove: 'MOVE',
  ftueDash: 'DASH',
  // Playbook §7.3 — pair with the post-flight "faded" tip. Plain-English
  // ("safe") instead of jargon ("i-frames") so the same word that appears on
  // defeat is the one the tutorial taught.
  ftueDashImmune: 'DASH = SAFE',
  ftuePowerup: 'POWER UP!',
  ftueExtract: 'FLY HOME',
  ftueTutorialBanner: 'TUTORIAL',
  ftueDeployPrompt: 'FLY',
  // Tutorial summary single-button label per §5.2 ("Single button: GROW").
  summaryUpgrade: 'GROW',

  // M15 — in-flight charm drafting modal.
  draftTitle: 'CHOOSE A CHARM',
  draftRarityCommon: 'COMMON',
  draftRarityRare: 'RARE',
  draftRarityEpic: 'EPIC',

  // M15 — charm names + one-line effects per §12.2.
  // Implemented:
  cardSharperShotsName: 'Sharper Sparks',
  cardSharperShotsEffect: '+15% spell power',
  cardQuickFeetName: 'Swift Wings',
  cardQuickFeetEffect: '+10% movement speed',
  cardWideMagnetName: 'Stardust Pull',
  cardWideMagnetEffect: '+20% pickup range',
  cardHardyName: 'Hardy Bloom',
  cardHardyEffect: '+20 max HP',
  cardBurstFireName: 'Spark Flurry',
  cardBurstFireEffect: '+10% cast rate',
  cardLuckyName: 'Lucky Clover',
  cardLuckyEffect: '+5% star heart drop chance',
  cardPierceName: 'Piercing Light',
  cardPierceEffect: 'Shots pierce 1 enemy',
  cardChainLightningName: 'Firefly Chain',
  cardChainLightningEffect: 'Shots chain to nearest foe',
  cardMagnetStormName: 'Stardust Storm',
  cardMagnetStormEffect: 'Pickups rush to you for 8s',
  cardDashMasterName: 'Glide Master',
  cardDashMasterEffect: '-30% dash cooldown',
  cardHealOnPickupName: 'Healing Bloom',
  cardHealOnPickupEffect: 'Stardust restores 1 HP',
  cardCritShotName: 'Starburst',
  cardCritShotEffect: '15% chance for 3x damage',
  cardOrbitalShieldName: 'Petal Barrier',
  cardOrbitalShieldEffect: 'Shield bubble, regens every 12s',
  cardSplitShotName: 'Split Spark',
  cardSplitShotEffect: 'Shots fork into 2',
  cardDroneMultiplierName: 'Firefly Swarm',
  cardDroneMultiplierEffect: 'Firefly count doubled',
  cardVampiricName: 'Lifebloom',
  cardVampiricEffect: '10% banishes heal 5 HP',
  cardGreedSurgeName: 'Glimmer Surge',
  cardGreedSurgeEffect: '+50% loot multiplier',
  cardPhoenixName: 'Phoenix Blossom',
  cardPhoenixEffect: 'Revive once at 50% HP',

  // M15 — deferred charms (still listed so the pool count is honest, but
  // filtered out at draw time). See CardDefs.ts.
  cardRicochetName: 'Bouncing Bloom',
  cardRicochetEffect: 'Shots bounce off walls',
  cardSlowFieldName: 'Frost Petals',
  cardSlowFieldEffect: 'Enemies near you slow 30%',
  cardFrenzyModeName: 'Frenzy Bloom',
  cardFrenzyModeEffect: '-50% cast rate at low HP',
  cardNovaDashName: 'Nova Glide',
  cardNovaDashEffect: 'Dash creates damaging ring',
  cardTimeDilationName: 'Moon Time',
  cardTimeDilationEffect: 'Enemies move 15% slower',
  cardPyrokineticName: 'Stardust Burst',
  cardPyrokineticEffect: 'Banish blasts harm nearby',

  draftAutoPick: 'Auto-pick in',
  draftPicked: 'PICKED',

  // M16 — companion metadata + picker UI.
  operatorPanelTitle: 'COMPANIONS',
  operatorPulseName: 'LUNA',
  operatorPulseDesc: 'Balanced kit',
  operatorVantaName: 'NOX',
  operatorVantaDesc: '+2 fireflies, -10% damage',
  operatorSurgeName: 'EMBER',
  operatorSurgeDesc: '+50% damage, -25% HP',
  operatorLodestoneName: 'COMET',
  operatorLodestoneDesc: '+100% stardust pull, slow',
  operatorLocked: 'LOCKED',
  operatorComingSoon: 'COMING SOON',
  operatorCostPrefix: 'Costs ',
  operatorCostSuffix: ' Star Hearts',
  operatorSelected: 'SELECTED',
  operatorUnlock: 'UNLOCK',

  // M17 — garden blight system. Per Run C clarification #3, the first-time
  // mechanic modal copy is short (3 sentences max).
  infestationSummaryPrefix: 'GARDEN BLIGHTED — ',
  infestationSummarySuffix: ' plots wilted. Clear them on your next flight.',
  infestationToast: 'Shadow weeds crept into your garden. Fly out to cleanse it.',
  infestationModalTitle: 'GARDEN BLIGHTED',
  infestationModalBody:
    'When you fail to fly home, shadow weeds creep into your garden and stop it growing. ' +
    'Clearing the glowing weeds on your next flight restores it. ' +
    'Reach the moongate — your garden is at stake.',
  infestationModalDismiss: 'GOT IT',
  infestationCleansingPrefix: 'Cleansing: ',
  infestationCleansingMid: ' / ',
  infestationCleansingSuffix: ' plots',
  infestationClearAd: 'CLEAR WEEDS',

  // M18 — daily quest + streak.
  questPanelTitle: 'DAILY QUEST',
  questClaimReady: 'CLAIM',
  questClaimed: 'CLAIMED',
  questProgressMid: ' / ',
  questExtractsText: 'Fly home 2 times today',
  questCoresText: 'Collect 3 Star Hearts',
  questKillsText: 'Banish 50 shadows in flights',
  questPowerupsText: 'Use 3 charms in one flight',
  questGreedX2Text: 'Reach Glimmer x2',
  questDamagelessText: 'Survive 60s without harm',
  streakLabel: 'Streak: Day ',
  questRewardToast: 'Quest reward: +100 Stardust, +1 Star Heart, +1 Shard',

  // M19 — daily seed leaderboard (personal-bests until backend lands).
  factoryDailySeed: 'DAILY SEED',
  factoryDailySeedAttempted: 'DAILY DONE',
  leaderboardButton: 'PERSONAL BESTS',
  leaderboardTitle: 'PERSONAL BESTS',
  leaderboardEmpty: 'No daily flights yet. Try one!',
  leaderboardYou: 'TODAY',
  leaderboardClose: 'CLOSE',
  leaderboardLocalNote: 'Global rankings coming soon',
  factoryDailySeedHint: 'Same seed, all players',

  // M20 — rewarded ad copy. Modal title + description per placement plus
  // common accept/decline button labels.
  adWatchButton: 'WATCH AD',
  adDeclineButton: 'NO THANKS',
  adReviveTitle: 'REVIVE?',
  adReviveDesc: 'Watch a short ad to revive at 60% HP and keep this flight going.',
  adDoubleLootTitle: 'DOUBLE HARVEST?',
  adDoubleLootDesc: 'Watch a short ad to double your flight harvest.',
  adExtendRunTitle: 'EXTEND FLIGHT?',
  adExtendRunDesc: 'Watch a short ad for +30 seconds of moonlight.',
  adFactoryBoostTitle: 'GARDEN BOOST?',
  adFactoryBoostDesc: 'Watch a short ad for 2x Stardust Per Minute for 2 minutes.',
  adClearInfestationTitle: 'CLEAR WEEDS?',
  adClearInfestationDesc: 'Watch a short ad to instantly clear every weed from your garden.',
  adDailyCrateTitle: 'DAILY GIFT',
  adDailyCrateDesc: 'Watch a short ad for a random daily gift.',
  adOperatorTryOutTitle: 'TRY COMPANION',
  adOperatorTryOutDesc: 'Watch a short ad to fly one night with this companion.',
  // Garden-side button labels for ad placements.
  adFactoryBoostButton: 'GARDEN BOOST',
  adFactoryBoostActive: 'BOOSTING',
  adFactoryBoostCooldown: 'COOLDOWN',
  adDailyCrateButton: 'DAILY GIFT',
  adDailyCrateClaimed: 'GIFT CLAIMED',
  adOperatorTryButton: 'TRY NEXT FLIGHT',
  adRewardScrapPrefix: '+',
  adRewardScrapSuffix: ' Stardust from gift',
  adRewardCore: '+1 Star Heart from gift',
  adRewardFailed: 'Ad failed — try again later',
  adTryOutToast: 'Try-out queued — fly to play one night',

  // M23 — cosmetics + achievements.
  cosmeticsMenuButton: 'STYLES',
  cosmeticsMenuTitle: 'STYLES',
  cosmeticsTabTrail: 'TRAILS',
  cosmeticsTabSkin: 'GLIDERS',
  cosmeticsTabTheme: 'THEMES',
  cosmeticsEquipped: 'EQUIPPED',
  cosmeticsEquip: 'EQUIP',
  cosmeticsLockedPrefix: 'Locked — ',
  achievementsMenuButton: 'ACHIEVEMENTS',
  achievementsMenuTitle: 'ACHIEVEMENTS',
  achievementUnlockedPrefix: 'ACHIEVEMENT: ',
  achievementLockedLabel: '— Locked —',
  achievementDeferredLabel: 'Coming soon',

  // Moon Altar (Star Hearts → permanent blessings) per blueprint §10.2.
  refineryButton: 'MOON ALTAR',
  refineryTitle: 'MOON ALTAR',
  refineryClose: 'CLOSE',
  refineryOwned: 'OWNED',
  refineryLocked: 'LOCKED',
  refineryRequiresPrefix: 'Requires: ',
  refineryCostSuffix: ' Star Hearts',
  refineryCatalyst1Name: 'Stardust Charm I',
  refineryCatalyst1Effect: '+5% Stardust earned',
  refineryCatalyst2Name: 'Stardust Charm II',
  refineryCatalyst2Effect: '+10% Stardust earned',
  refineryCatalyst3Name: 'Stardust Charm III',
  refineryCatalyst3Effect: '+20% Stardust earned',
  refineryDroneOverclockName: 'Firefly Blessing',
  refineryDroneOverclockEffect: '+1 starting firefly in flights',
  refineryMagnetSurgeName: 'Stardust Pull',
  refineryMagnetSurgeEffect: '+25% pull range',
  refineryIronPlatingName: 'Petal Plating',
  refineryIronPlatingEffect: '+25 max HP',
  refineryQuickBootsName: 'Swift Wings',
  refineryQuickBootsEffect: '-10% dash cooldown',
  refineryLuckyStrikeName: 'Lucky Star',
  refineryLuckyStrikeEffect: '+15% star heart drop rate',
  refineryAlloyPressName: 'Moonbloom Press',
  refineryAlloyPressEffect: '+10% garden Stardust/min',
  refineryCircuitLoomName: 'Mana Loom',
  refineryCircuitLoomEffect: '+15% garden Stardust/min, +4h offline cap',
  refineryDroneDispatcherName: 'Firefly Dispatcher',
  refineryDroneDispatcherEffect: '+1 starting firefly in flights and garden',
  refineryFactoryShieldName: 'Garden Ward',
  refineryFactoryShieldEffect: 'Failed flights wilt 1 fewer plot',

  // Night glades: selectable flight zones and ingredient wallet.
  zonePanelButton: 'GLADES',
  zonePanelTitle: 'NIGHT GLADES',
  zonePanelClose: 'CLOSE',
  zonePanelSelected: 'SELECTED',
  zonePanelSelect: 'SELECT',
  zonePanelLockedPrefix: 'Unlocks after ',
  zonePanelLockedSuffix: ' flights',
  zonePanelYieldPrefix: 'Yield: ',
  zonePanelThreatPrefix: 'Threat: x',
  zoneDeployPrefix: 'GLADE: ',
  materialAlloy: 'Petals',
  materialCircuits: 'Essence',

  // Wish Board (§16.6).
  missionBoardTitle: 'WISH BOARD',
  missionBoardClose: 'CLOSE',
  missionBoardEmpty: 'All wishes granted. Refresh in 24h.',
  missionBoardRefresh: 'REFRESH',
  missionBoardClaim: 'CLAIM',
  missionBoardClaimed: 'CLAIMED',
  missionExtract: 'Fly home with 2 Star Hearts',
  missionKillSwarmers: 'Banish 30 Wisps',
  missionUseMagnet: 'Use Stardust Pull twice',
  missionKillBomber: 'Banish 5 Bloom Bombs',
  missionUseFreeze: 'Use Frost Petals',
  missionExtractGreedX2: 'Fly home at Glimmer x2+',

  // Prestige (New Moon) per §10.3.
  prestigeButton: 'NEW MOON',
  prestigeTitle: 'NEW MOON',
  prestigeBodyEligible:
    'Wipe your Stardust and upgrades. Keep Moon Altar blessings, styles, companions, and achievements. ' +
    'Gain +1 Eternal Star (permanent +10% global bonus). Are you sure?',
  prestigeBodyLocked: 'Reach Moonwell Lv. 25 and bank 1000 Star Hearts to unlock the New Moon.',
  prestigeConfirm: 'RENEW',
  prestigeCancel: 'CANCEL',
  prestigeCyberCoreLabel: 'Eternal Stars',

  // Retention pass — welcome-back hook, streak FOMO, comeback bonus, DOUBLE
  // BLOOM rare event, almost-there nudges. Copy is intentionally short
  // and warm: every line should feel like the garden noticed you.
  welcomeBackTitle: 'WELCOME BACK',
  welcomeBackOfflinePrefix: '+',
  welcomeBackOfflineSuffix: ' Stardust while you were away',
  welcomeBackEmpty: 'Garden ready. Time to fly.',
  streakFire: '✨',
  streakDayPrefix: 'DAY ',
  streakDaySuffix: ' STREAK',
  streakWarnLastChance: 'Daily Gift available — finish your quest today!',
  streakWarnSkipUsed: 'Skip-day used. Daily Gift ready tomorrow.',
  streakBrokenTitle: 'DAILY GIFT RESET',
  streakBrokenSub: 'Your gift refills today. No progress lost.',
  comebackTitle: 'GOOD TO SEE YOU',
  comebackSub: '2× STARDUST active for 24 hours — fly back in.',
  paydayTitle: 'DOUBLE BLOOM',
  paydaySub: '2× loot — next 3 flights only',
  paydayBadgePrefix: 'BLOOM ×',
  paydayBadgeMid: ' (',
  paydayBadgeSuffix: ' flights left)',
  almostNextOperatorPrefix: 'Next companion: ',
  almostNextOperatorMid: '   ',
  almostNextOperatorSuffix: ' Star Hearts',
  almostMissionPrefix: 'WISHES · ',
  almostMissionSuffix: ' ready to claim',
  notifyDot: '●',
  redeployTeaserPrefix: 'NEXT FLIGHT: ',

  // Playbook §7.5 — clean mid-flight exit. The confirm text reads as the
  // consequence ("forfeit unbanked stardust") not as guilt, so a player who
  // genuinely wants to leave isn't pressured to stay.
  leaveRaidButton: 'END FLIGHT',
  leaveRaidConfirmTitle: 'END FLIGHT?',
  leaveRaidConfirmBody: 'Half of your gathered stardust will be lost.',
  leaveRaidConfirmYes: 'FLY HOME',
  leaveRaidConfirmNo: 'KEEP FLYING',

  // Playbook §7.3 — "make failure explain itself". One short line per
  // end-reason that names what happened and points at a concrete next
  // action. Keep these terse: this is coaching, not commentary.
  endReasonExtracted: 'Moongate reached — stardust secured.',
  endReasonDied: 'Your bloom faded. Tip: dash through danger — you’re safe while dashing.',
  endReasonTimer: 'Dawn broke. Tip: reach the moongate before sunrise.',
  endReasonVoluntary: 'Flight ended early. Half your gathered stardust was saved.',

  // Weekly Boss (Eclipse Spirit) — blueprint §16.4. All copy is short and
  // intelligible without context so the mode reads as a discrete event.
  weeklyBossButton: 'WEEKLY BOSS',
  weeklyBossTitle: 'ECLIPSE SPIRIT',
  weeklyBossSubtitle: 'Weekly Flight · Fastest Banish',
  weeklyBossBriefingBody:
    'A multi-phase shadow has bloomed over the night garden. Strike each glowing weak point as it surfaces. ' +
    'You have 5 minutes. Your best time this week is recorded to the leaderboard.',
  weeklyBossEnter: 'CONFRONT',
  weeklyBossClose: 'CLOSE',
  weeklyBossLeaderboardTitle: 'FASTEST BANISHES',
  weeklyBossLeaderboardEmpty: 'No clears yet. First banish makes the board.',
  weeklyBossResetPrefix: 'Weekly reset in ',
  weeklyBossBestThisWeekPrefix: 'Best this week: ',
  weeklyBossBestNone: '—',
  weeklyBossTotalKillsPrefix: 'Lifetime clears: ',
  weeklyBossPhase1: 'PHASE 1 · DORMANT',
  weeklyBossPhase2: 'PHASE 2 · STIRRING',
  weeklyBossPhase3: 'PHASE 3 · ECLIPSE',
  weeklyBossVictoryTitle: 'SPIRIT BANISHED',
  weeklyBossDefeatTitle: 'OVERWHELMED',
  weeklyBossTimeUpTitle: 'DAWN BROKE',
  weeklyBossTimeLabel: 'TIME',
  weeklyBossHpLabel: 'SPIRIT',
  weeklyBossPlayerHpLabel: 'BLOOM',
  weeklyBossKillTimePrefix: 'CLEAR TIME · ',
  weeklyBossNewBest: 'NEW PERSONAL BEST',
  weeklyBossRewardCoresSuffix: ' Star Hearts',
  weeklyBossRewardShardsSuffix: ' Shards',
  weeklyBossReturn: 'RETURN TO GARDEN',
  weeklyBossRetry: 'RETRY',
  weeklyBossTutorialHint:
    'WASD / Arrows to fly · Click / Space to cast · Strike pulsing weak points.',

  researchTitle: 'POTION LAB',
  researchButton: 'POTION LAB',
  researchCompleted: 'COMPLETE',
  researchInProgress: 'BREWING',
  researchStart: 'BREW',
  researchClose: 'CLOSE',

  droneBayTitle: 'FIREFLY ROOST',
  droneBayButton: 'FIREFLY ROOST',
  droneBaySlots: 'Nests: ',
  droneBaySlot: 'NEST',
  droneBayIdle: 'IDLE',
  droneBayReady: 'Ready to send',
  droneBayLaunch: 'SEND',
  droneBayClose: 'CLOSE',
  droneBayMissionComplete: 'fireflies returned',

  fortuneWheelTitle: 'WISHING WHEEL',
  fortuneWheelButton: 'WISHING WHEEL',
  fortuneWheelSubtitle: 'Watch an ad to spin once per day.',
  fortuneWheelSpin: 'SPIN',
  fortuneWheelReady: 'Wheel ready — claim your daily spin.',
  fortuneWheelWonPrefix: 'WON · ',
  fortuneWheelClose: 'CLOSE',
  fortuneWheelAdTitle: 'SPIN THE WHEEL?',
  fortuneWheelAdDesc: 'Watch a short ad to take your daily spin.',

  dailyLoginTitle: 'DAILY GIFTS',
  dailyLoginSubtitle: 'Claim your streak gifts one day at a time.',
  dailyRewardsButton: 'DAILY GIFTS',
  dailyLoginDay: 'DAY',
  dailyLoginToday: 'TODAY',
  dailyLoginFuture: 'LOCKED',
  dailyLoginClose: 'CLOSE',
  dailyLoginEmpty: 'No bonus',

  offlineRewardTitle: 'OFFLINE BLOOM',
  offlineRewardAmountPrefix: '+',
  offlineRewardAmountSuffix: ' Stardust gathered while you were away',
  offlineRewardBody: 'Collect now or watch an ad for 2× payout.',
  offlineRewardCollect: 'COLLECT',
  offlineRewardDouble: 'WATCH AD → 2×',
  offlineRewardAdTitle: 'DOUBLE OFFLINE BLOOM?',
  offlineRewardAdDesc: 'Watch a short ad to double your offline Stardust.',

  buffFactoryBoost: 'GARDEN BOOST',
  buffDoublePayday: 'DOUBLE BLOOM',
  buffComebackBonus: 'COMEBACK BONUS',

  settingsExportButton: 'EXPORT SAVE',
  settingsImportButton: 'IMPORT SAVE',
  settingsExportSuccess: 'Save exported',
  settingsImportSuccess: 'Save imported — reloading',
  settingsImportError: 'Import failed',
};

export type Locale = 'en' | 'no' | 'es' | 'pt' | 'de' | 'fr';

// Type alias for the resolved string table. Plain string values so locale
// overrides can swap in without violating literal-type constraints.
type StringsTable = { [K in keyof typeof StringsEn]: string };

// Per-locale partial overrides. Any key omitted falls back to English. The
// scaffold ships with a handful of high-visibility strings translated so the
// language switch is observable without blocking on a full translation pass.
const translations: Record<Locale, Partial<StringsTable>> = {
  en: {},
  no: {
    summaryExtracted: 'FLUKT FULLFØRT',
    summaryFailed: 'FLUKT TAPT',
    summaryFactory: 'HAGE',
    summaryRedeploy: 'EN GANG TIL',
    summaryDoubleLoot: 'DOBBEL HØST',
    factoryDeploy: 'FLY UT',
    greedLabel: 'GLIMMER',
    hpLabel: 'HP',
    refineryTitle: 'MÅNEALTER',
    missionBoardTitle: 'ØNSKETAVLE',
    prestigeTitle: 'NYMÅNE',
  },
  es: {
    summaryExtracted: 'VUELO COMPLETO',
    summaryFailed: 'VUELO PERDIDO',
    summaryFactory: 'JARDÍN',
    summaryRedeploy: 'OTRO VUELO',
    summaryDoubleLoot: 'COSECHA DOBLE',
    factoryDeploy: 'VOLAR',
    greedLabel: 'BRILLO',
    refineryTitle: 'ALTAR LUNAR',
    missionBoardTitle: 'DESEOS',
    prestigeTitle: 'LUNA NUEVA',
  },
  pt: {
    summaryExtracted: 'VOO COMPLETO',
    summaryFailed: 'VOO PERDIDO',
    summaryFactory: 'JARDIM',
    summaryRedeploy: 'OUTRO VOO',
    summaryDoubleLoot: 'COLHEITA DUPLA',
    factoryDeploy: 'VOAR',
    greedLabel: 'BRILHO',
    refineryTitle: 'ALTAR LUNAR',
    missionBoardTitle: 'DESEJOS',
    prestigeTitle: 'LUA NOVA',
  },
  de: {
    summaryExtracted: 'FLUG ABGESCHLOSSEN',
    summaryFailed: 'FLUG VERLOREN',
    summaryFactory: 'GARTEN',
    summaryRedeploy: 'NOCH EIN FLUG',
    summaryDoubleLoot: 'DOPPELTE ERNTE',
    factoryDeploy: 'LOSFLIEGEN',
    greedLabel: 'GLITZERN',
    refineryTitle: 'MONDALTAR',
    missionBoardTitle: 'WÜNSCHE',
    prestigeTitle: 'NEUMOND',
  },
  fr: {
    summaryExtracted: 'VOL TERMINÉ',
    summaryFailed: 'VOL PERDU',
    summaryFactory: 'JARDIN',
    summaryRedeploy: 'UN AUTRE VOL',
    summaryDoubleLoot: 'DOUBLE RÉCOLTE',
    factoryDeploy: 'S’ENVOLER',
    greedLabel: 'ÉCLAT',
    refineryTitle: 'AUTEL LUNAIRE',
    missionBoardTitle: 'SOUHAITS',
    prestigeTitle: 'NOUVELLE LUNE',
  },
};

// Active locale derived from the URL hash, localStorage, or browser default.
function detectLocale(): Locale {
  const valid: Locale[] = ['en', 'no', 'es', 'pt', 'de', 'fr'];
  try {
    const fromStorage = localStorage.getItem('nfr:locale');
    if (fromStorage && valid.includes(fromStorage as Locale)) return fromStorage as Locale;
  } catch {
    // localStorage may be disabled.
  }
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (valid.includes(nav as Locale)) return nav as Locale;
  }
  return 'en';
}

let currentLocale: Locale = detectLocale();

// Resolved string table — re-built whenever the active locale changes.
// Direct accesses like `Strings.summaryExtracted` continue to work; setLocale
// mutates the same object so existing imports stay live.
export const Strings: StringsTable = { ...StringsEn };
applyLocaleOverrides();

function applyLocaleOverrides(): void {
  // Reset to English first so swapping back doesn't keep stale entries.
  Object.assign(Strings, StringsEn);
  const overrides = translations[currentLocale] ?? {};
  Object.assign(Strings, overrides);
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  try {
    localStorage.setItem('nfr:locale', locale);
  } catch {
    // Persist failure is non-fatal; selection lives in-memory only.
  }
  applyLocaleOverrides();
}

export function getLocale(): Locale {
  return currentLocale;
}

export const SUPPORTED_LOCALES: Locale[] = ['en', 'no', 'es', 'pt', 'de', 'fr'];

export type StringKey = keyof typeof StringsEn;
