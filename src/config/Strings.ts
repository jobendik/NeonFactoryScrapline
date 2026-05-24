// All player-facing strings. English is the source of truth; secondary
// languages live in `translations` below and override any matching keys when
// the user picks them via the settings menu.
//
// Suggestions audit — scaffolded the localization system per blueprint §22.8.
// Five CrazyGames-relevant locales are wired (no, es, pt, de, fr); each
// starts with stubs (or auto-pick from English) and will fill in over
// post-launch content drops.

const StringsEn = {
  bootOk: 'Boot OK',
  gameTitle: 'NEON SCRAPLINE: FACTORY RAID',
  fps: 'FPS',
  comboLabel: 'COMBO',
  timerLabel: 'TIME',
  extractionOpened: 'EXTRACTION OPEN',
  extractionHold: 'HOLD',
  summaryExtracted: 'EXTRACTION COMPLETE',
  summaryFailed: 'RAID FAILED',
  summaryCollapsed: 'TIME COLLAPSED',
  summaryScrap: 'SCRAP',
  summaryCores: 'CORES',
  summaryMaterials: 'MATERIALS',
  summaryFactory: 'FACTORY',
  summaryRedeploy: 'ONE MORE RAID',
  summaryDoubleLoot: 'DOUBLE LOOT',
  summaryPenalty: '-50% UNBANKED LOOT',
  greedLabel: 'GREED',
  hpLabel: 'HP',
  factoryStubTitle: 'FACTORY',
  factoryStubSub: 'Factory hub — Milestone 8',
  factoryDeploy: 'DEPLOY',
  factorySpm: 'SPM',
  factoryDeployHint: 'STAND ON PAD TO DEPLOY',
  // FTUE captions per blueprint §5.2 - max 4 words each.
  ftueMove: 'MOVE',
  ftueDash: 'DASH',
  // Playbook §7.3 — pair with the post-raid "died" tip. Plain-English
  // ("immune") instead of jargon ("i-frames") so the same word that
  // appears on defeat is the one the tutorial taught.
  ftueDashImmune: 'DASH = IMMUNE',
  ftuePowerup: 'POWER UP!',
  ftueExtract: 'EXTRACT',
  ftueTutorialBanner: 'TUTORIAL',
  ftueDeployPrompt: 'DEPLOY',
  // Tutorial summary single-button label per §5.2 ("Single button: UPGRADE").
  summaryUpgrade: 'UPGRADE',

  // M15 — in-run drafting modal.
  draftTitle: 'CHOOSE SIGNAL MOD',
  draftRarityCommon: 'COMMON',
  draftRarityRare: 'RARE',
  draftRarityEpic: 'EPIC',

  // M15 — card names + one-line effects per §12.2.
  // Implemented:
  cardSharperShotsName: 'Sharper Shots',
  cardSharperShotsEffect: '+15% damage',
  cardQuickFeetName: 'Quick Feet',
  cardQuickFeetEffect: '+10% movement speed',
  cardWideMagnetName: 'Wide Magnet',
  cardWideMagnetEffect: '+20% pickup range',
  cardHardyName: 'Hardy',
  cardHardyEffect: '+20 max HP',
  cardBurstFireName: 'Burst Fire',
  cardBurstFireEffect: '+10% fire rate',
  cardLuckyName: 'Lucky',
  cardLuckyEffect: '+5% core drop chance',
  cardPierceName: 'Pierce',
  cardPierceEffect: 'Shots pierce 1 enemy',
  cardChainLightningName: 'Chain Lightning',
  cardChainLightningEffect: 'Shots chain to nearest enemy',
  cardMagnetStormName: 'Magnet Storm',
  cardMagnetStormEffect: 'Pickups rush to you for 8s',
  cardDashMasterName: 'Dash Master',
  cardDashMasterEffect: '-30% dash cooldown',
  cardHealOnPickupName: 'Heal on Pickup',
  cardHealOnPickupEffect: 'Scrap restores 1 HP',
  cardCritShotName: 'Crit Shot',
  cardCritShotEffect: '15% chance for 3x damage',
  cardOrbitalShieldName: 'Orbital Shield',
  cardOrbitalShieldEffect: 'Shield bubble, regens every 12s',
  cardSplitShotName: 'Split Shot',
  cardSplitShotEffect: 'Shots fork into 2',
  cardDroneMultiplierName: 'Drone Multiplier',
  cardDroneMultiplierEffect: 'Drone count doubled',
  cardVampiricName: 'Vampiric',
  cardVampiricEffect: '10% kills heal 5 HP',
  cardGreedSurgeName: 'Greed Surge',
  cardGreedSurgeEffect: '+50% loot multiplier',
  cardPhoenixName: 'Phoenix',
  cardPhoenixEffect: 'Revive once at 50% HP',

  // M15 — deferred cards (still listed so the pool count is honest, but
  // filtered out at draw time). See CardDefs.ts.
  cardRicochetName: 'Ricochet',
  cardRicochetEffect: 'Shots bounce off walls',
  cardSlowFieldName: 'Slow Field',
  cardSlowFieldEffect: 'Enemies near you slow 30%',
  cardFrenzyModeName: 'Frenzy Mode',
  cardFrenzyModeEffect: '-50% fire rate at low HP',
  cardNovaDashName: 'Nova Dash',
  cardNovaDashEffect: 'Dash creates damaging ring',
  cardTimeDilationName: 'Time Dilation',
  cardTimeDilationEffect: 'Enemies move 15% slower',
  cardPyrokineticName: 'Pyrokinetic',
  cardPyrokineticEffect: 'Death blasts harm nearby',

  draftAutoPick: 'Auto-pick in',
  draftPicked: 'PICKED',

  // M16 — operator metadata + picker UI.
  operatorPanelTitle: 'OPERATORS',
  operatorPulseName: 'PULSE',
  operatorPulseDesc: 'Balanced kit',
  operatorVantaName: 'VANTA',
  operatorVantaDesc: '+2 drones, -10% damage',
  operatorSurgeName: 'SURGE',
  operatorSurgeDesc: '+50% damage, -25% HP',
  operatorLodestoneName: 'LODESTONE',
  operatorLodestoneDesc: '+100% magnet, slow',
  operatorLocked: 'LOCKED',
  operatorComingSoon: 'COMING SOON',
  operatorCostPrefix: 'Costs ',
  operatorCostSuffix: ' Cores',
  operatorSelected: 'SELECTED',
  operatorUnlock: 'UNLOCK',

  // M17 — infestation system. Per Run C clarification #3, the first-time
  // mechanic modal copy is short (3 sentences max).
  infestationSummaryPrefix: 'FACTORY INFESTED — ',
  infestationSummarySuffix: ' machines disabled. Clear them in your next raid.',
  infestationToast: 'Your factory is infested. Deploy to cleanse.',
  infestationModalTitle: 'FACTORY INFESTED',
  infestationModalBody:
    'When you fail to extract, enemies infest your machines and stop their production. ' +
    'Killing red infestation enemies on your next raid restores them. ' +
    'Push to extract — your factory is at stake.',
  infestationModalDismiss: 'GOT IT',
  infestationCleansingPrefix: 'Cleansing: ',
  infestationCleansingMid: ' / ',
  infestationCleansingSuffix: ' machines',
  infestationClearAd: 'CLEAR INFESTATION',

  // M18 — daily quest + streak.
  questPanelTitle: 'DAILY QUEST',
  questClaimReady: 'CLAIM',
  questClaimed: 'CLAIMED',
  questProgressMid: ' / ',
  questExtractsText: 'Extract 2 times today',
  questCoresText: 'Collect 3 Neon Cores',
  questKillsText: 'Kill 50 enemies in raids',
  questPowerupsText: 'Use 3 power-ups in one raid',
  questGreedX2Text: 'Reach Greed x2',
  questDamagelessText: 'Survive 60s without damage',
  streakLabel: 'Streak: Day ',
  questRewardToast: 'Quest reward: +100 Scrap, +1 Core, +1 Shard',

  // M19 — daily seed leaderboard (personal-bests until backend lands).
  factoryDailySeed: 'DAILY SEED',
  factoryDailySeedAttempted: 'DAILY DONE',
  leaderboardButton: 'PERSONAL BESTS',
  leaderboardTitle: 'PERSONAL BESTS',
  leaderboardEmpty: 'No daily attempts yet. Try one!',
  leaderboardYou: 'TODAY',
  leaderboardClose: 'CLOSE',
  leaderboardLocalNote: 'Global rankings coming soon',
  factoryDailySeedHint: 'Same seed, all players',

  // M20 — rewarded ad copy. Modal title + description per placement plus
  // common accept/decline button labels.
  adWatchButton: 'WATCH AD',
  adDeclineButton: 'NO THANKS',
  adReviveTitle: 'REVIVE?',
  adReviveDesc: 'Watch a short ad to revive at 60% HP and keep this raid going.',
  adDoubleLootTitle: 'DOUBLE LOOT?',
  adDoubleLootDesc: 'Watch a short ad to double your run loot.',
  adExtendRunTitle: 'EXTEND RUN?',
  adExtendRunDesc: 'Watch a short ad for +30 seconds on the raid timer.',
  adFactoryBoostTitle: 'FACTORY BOOST?',
  adFactoryBoostDesc: 'Watch a short ad for 2x Scrap Per Minute for 2 minutes.',
  adClearInfestationTitle: 'CLEAR INFESTATION?',
  adClearInfestationDesc: 'Watch a short ad to instantly restore every infested machine.',
  adDailyCrateTitle: 'DAILY CRATE',
  adDailyCrateDesc: 'Watch a short ad for a random daily reward.',
  adOperatorTryOutTitle: 'TRY OPERATOR',
  adOperatorTryOutDesc: 'Watch a short ad to play one raid with this operator.',
  // Factory-side button labels for ad placements.
  adFactoryBoostButton: 'FACTORY BOOST',
  adFactoryBoostActive: 'BOOSTING',
  adFactoryBoostCooldown: 'COOLDOWN',
  adDailyCrateButton: 'DAILY CRATE',
  adDailyCrateClaimed: 'CRATE CLAIMED',
  adOperatorTryButton: 'TRY IN NEXT RAID',
  adRewardScrapPrefix: '+',
  adRewardScrapSuffix: ' Scrap from crate',
  adRewardCore: '+1 Core from crate',
  adRewardFailed: 'Ad failed — try again later',
  adTryOutToast: 'Try-out queued — deploy to play one raid',

  // M23 — cosmetics + achievements.
  cosmeticsMenuButton: 'COSMETICS',
  cosmeticsMenuTitle: 'COSMETICS',
  cosmeticsTabTrail: 'TRAILS',
  cosmeticsTabSkin: 'SHIPS',
  cosmeticsTabTheme: 'THEMES',
  cosmeticsEquipped: 'EQUIPPED',
  cosmeticsEquip: 'EQUIP',
  cosmeticsLockedPrefix: 'Locked — ',
  achievementsMenuButton: 'ACHIEVEMENTS',
  achievementsMenuTitle: 'ACHIEVEMENTS',
  achievementUnlockedPrefix: 'ACHIEVEMENT: ',
  achievementLockedLabel: '— Locked —',
  achievementDeferredLabel: 'Coming soon',

  // Refinery (Cores → permanent multipliers) per blueprint §10.2.
  refineryButton: 'REFINERY',
  refineryTitle: 'CORE REFINERY',
  refineryClose: 'CLOSE',
  refineryOwned: 'OWNED',
  refineryLocked: 'LOCKED',
  refineryRequiresPrefix: 'Requires: ',
  refineryCostSuffix: ' Cores',
  refineryCatalyst1Name: 'Scrap Catalyst I',
  refineryCatalyst1Effect: '+5% Scrap earned',
  refineryCatalyst2Name: 'Scrap Catalyst II',
  refineryCatalyst2Effect: '+10% Scrap earned',
  refineryCatalyst3Name: 'Scrap Catalyst III',
  refineryCatalyst3Effect: '+20% Scrap earned',
  refineryDroneOverclockName: 'Drone Overclock',
  refineryDroneOverclockEffect: '+1 starting drone in raids',
  refineryMagnetSurgeName: 'Magnet Surge',
  refineryMagnetSurgeEffect: '+25% magnet range',
  refineryIronPlatingName: 'Iron Plating',
  refineryIronPlatingEffect: '+25 max HP',
  refineryQuickBootsName: 'Quick Boots',
  refineryQuickBootsEffect: '-10% dash cooldown',
  refineryLuckyStrikeName: 'Lucky Strike',
  refineryLuckyStrikeEffect: '+15% core drop rate',
  refineryAlloyPressName: 'Alloy Press',
  refineryAlloyPressEffect: '+10% factory Scrap/min',
  refineryCircuitLoomName: 'Circuit Loom',
  refineryCircuitLoomEffect: '+15% factory Scrap/min, +4h offline cap',
  refineryDroneDispatcherName: 'Drone Dispatcher',
  refineryDroneDispatcherEffect: '+1 starting drone in raids and factory',
  refineryFactoryShieldName: 'Factory Shield',
  refineryFactoryShieldEffect: 'Failed raids infest 1 fewer machine',

  // Scrapline merge: selectable raid zones and material wallet.
  zonePanelButton: 'ZONES',
  zonePanelTitle: 'RAID ZONES',
  zonePanelClose: 'CLOSE',
  zonePanelSelected: 'SELECTED',
  zonePanelSelect: 'SELECT',
  zonePanelLockedPrefix: 'Unlocks after ',
  zonePanelLockedSuffix: ' extracts',
  zonePanelYieldPrefix: 'Yield: ',
  zonePanelThreatPrefix: 'Threat: x',
  zoneDeployPrefix: 'ZONE: ',
  materialAlloy: 'Alloy',
  materialCircuits: 'Circuits',

  // Mission Board (§16.6).
  missionBoardTitle: 'CONTRACTS',
  missionBoardClose: 'CLOSE',
  missionBoardEmpty: 'All contracts completed. Refresh in 24h.',
  missionBoardRefresh: 'REFRESH',
  missionBoardClaim: 'CLAIM',
  missionBoardClaimed: 'CLAIMED',
  missionExtract: 'Extract with 2 Cores',
  missionKillSwarmers: 'Kill 30 Swarmers',
  missionUseMagnet: 'Use Magnet Burst twice',
  missionKillBomber: 'Kill 5 Bombers',
  missionUseFreeze: 'Use Freeze Pulse',
  missionExtractGreedX2: 'Extract at Greed x2+',

  // Prestige (System Reboot) per §10.3.
  prestigeButton: 'PRESTIGE',
  prestigeTitle: 'SYSTEM REBOOT',
  prestigeBodyEligible:
    'Wipe your Scrap and upgrades. Keep Refinery, cosmetics, operators, and achievements. ' +
    'Gain +1 Cyber-Core (permanent +10% global multiplier). Are you sure?',
  prestigeBodyLocked: 'Reach Generator Lv. 25 and bank 1000 Cores to unlock System Reboot.',
  prestigeConfirm: 'REBOOT',
  prestigeCancel: 'CANCEL',
  prestigeCyberCoreLabel: 'Cyber-Cores',

  // Retention pass — welcome-back hook, streak FOMO, comeback bonus, DOUBLE
  // PAYDAY rare event, almost-there nudges. Copy is intentionally short
  // and dopamine-shaped: every line should feel like the game noticed you.
  welcomeBackTitle: 'WELCOME BACK',
  welcomeBackOfflinePrefix: '+',
  welcomeBackOfflineSuffix: ' Scrap while you were gone',
  welcomeBackEmpty: 'Factory ready. Time to raid.',
  streakFire: '🔥',
  streakDayPrefix: 'DAY ',
  streakDaySuffix: ' STREAK',
  streakWarnLastChance: 'STREAK ENDS TONIGHT — claim daily quest!',
  streakWarnSkipUsed: 'STREAK SAVED — skip-day used. Don\'t miss tomorrow.',
  streakBrokenTitle: 'STREAK LOST',
  streakBrokenSub: 'Rebuild from Day 1. Start now.',
  comebackTitle: 'WE MISSED YOU',
  comebackSub: '2× SCRAP for 24 hours — go get rich.',
  paydayTitle: 'DOUBLE PAYDAY',
  paydaySub: '2× loot — next 3 raids only',
  paydayBadgePrefix: 'PAYDAY ×',
  paydayBadgeMid: ' (',
  paydayBadgeSuffix: ' raids left)',
  almostNextOperatorPrefix: 'Next operator: ',
  almostNextOperatorMid: '   ',
  almostNextOperatorSuffix: ' Cores',
  almostMissionPrefix: 'CONTRACTS · ',
  almostMissionSuffix: ' ready to claim',
  notifyDot: '●',
  redeployTeaserPrefix: 'NEXT RAID: ',

  // Playbook §7.5 — clean mid-raid exit. The confirm text reads as the
  // consequence ("forfeit unbanked loot") not as guilt, so a player who
  // genuinely wants to leave isn't pressured to stay.
  leaveRaidButton: 'LEAVE RAID',
  leaveRaidConfirmTitle: 'LEAVE RAID?',
  leaveRaidConfirmBody: 'Half of your unbanked loot will be forfeit.',
  leaveRaidConfirmYes: 'LEAVE',
  leaveRaidConfirmNo: 'KEEP PLAYING',

  // Playbook §7.3 — "make failure explain itself". One short line per
  // end-reason that names what happened and points at a concrete next
  // action. Keep these terse: this is coaching, not commentary.
  endReasonExtracted: 'Signal locked — loot secured.',
  endReasonDied: 'Core breached. Tip: dash through bullets — you’re immune while dashing.',
  endReasonTimer: 'Time collapsed. Tip: hold the extraction pad before the timer runs out.',
  endReasonVoluntary: 'Signal aborted. Half your unbanked loot was salvaged.',
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
    summaryExtracted: 'EVAKUERING FULLFØRT',
    summaryFailed: 'RAID MISLYKTES',
    summaryFactory: 'FABRIKK',
    summaryRedeploy: 'EN GANG TIL',
    summaryDoubleLoot: 'DOBBEL GEVINST',
    factoryDeploy: 'START RAID',
    greedLabel: 'GRÅDIGHET',
    hpLabel: 'HP',
    refineryTitle: 'KJERNERAFFINERI',
    missionBoardTitle: 'OPPDRAG',
    prestigeTitle: 'SYSTEMOMSTART',
  },
  es: {
    summaryExtracted: 'EXTRACCIÓN COMPLETA',
    summaryFailed: 'RAID FALLIDO',
    summaryFactory: 'FÁBRICA',
    summaryRedeploy: 'OTRA INCURSIÓN',
    summaryDoubleLoot: 'BOTÍN DOBLE',
    factoryDeploy: 'DESPLEGAR',
    greedLabel: 'AVARICIA',
    refineryTitle: 'REFINERÍA',
    missionBoardTitle: 'CONTRATOS',
    prestigeTitle: 'REINICIO',
  },
  pt: {
    summaryExtracted: 'EXTRAÇÃO COMPLETA',
    summaryFailed: 'RAID FALHOU',
    summaryFactory: 'FÁBRICA',
    summaryRedeploy: 'OUTRA INVASÃO',
    summaryDoubleLoot: 'SAQUE DUPLO',
    factoryDeploy: 'IMPLANTAR',
    greedLabel: 'GANÂNCIA',
    refineryTitle: 'REFINARIA',
    missionBoardTitle: 'CONTRATOS',
    prestigeTitle: 'REINICIAR',
  },
  de: {
    summaryExtracted: 'EXTRAKTION ERFOLGREICH',
    summaryFailed: 'RAID GESCHEITERT',
    summaryFactory: 'FABRIK',
    summaryRedeploy: 'NOCH EIN RAID',
    summaryDoubleLoot: 'DOPPELTE BEUTE',
    factoryDeploy: 'EINSATZ',
    greedLabel: 'GIER',
    refineryTitle: 'RAFFINERIE',
    missionBoardTitle: 'AUFTRÄGE',
    prestigeTitle: 'NEUSTART',
  },
  fr: {
    summaryExtracted: 'EXTRACTION RÉUSSIE',
    summaryFailed: 'RAID ÉCHOUÉ',
    summaryFactory: 'USINE',
    summaryRedeploy: 'UN AUTRE RAID',
    summaryDoubleLoot: 'BUTIN DOUBLÉ',
    factoryDeploy: 'DÉPLOYER',
    greedLabel: 'AVIDITÉ',
    refineryTitle: 'RAFFINERIE',
    missionBoardTitle: 'CONTRATS',
    prestigeTitle: 'REDÉMARRAGE',
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
