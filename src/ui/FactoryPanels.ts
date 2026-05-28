// Modal panels invoked from the FactoryScene "machines" row:
//   - Refinery: spend Cores on permanent multipliers (§10.2)
//   - Mission Board: 3 daily contracts (§16.6)
//   - Prestige: System Reboot gate + confirmation (§10.3)
//
// M-overhaul: these are now HTML+CSS overlays mounted via UIOverlay. The
// exported open<X>() signatures are preserved so FactoryScene call sites
// don't have to change — only the rendering moves from Phaser primitives
// (rectangles + monospace text) to styled DOM.

import type Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { Balance } from '../config/Balance';
import { Economy } from '../systems/EconomySystem';
import { saveSystem } from '../platform/SaveSystem';
import { RefinerySystem, RefineryDefs, REFINERY_ORDER } from '../systems/RefinerySystem';
import { MissionBoard, MISSION_DEFS, type MissionDef } from '../systems/MissionBoard';
import { todayUtcDate } from '../config/QuestDefs';
import { UIOverlay, el, btn } from './overlay/UIOverlay';
import { CORE_ICON } from './overlay/Icons';
import { DEFAULT_RAID_ZONE_ID, MaterialDefs, createEmptyMaterials } from '../config/ScraplineDefs';
import { RaidZoneSystem } from '../systems/RaidZoneSystem';
import { ResearchSystem, ResearchDefs, RESEARCH_ORDER } from '../systems/ResearchSystem';
import { DroneMissionSystem, DroneMissionDefs, DRONE_MISSION_ORDER } from '../systems/DroneMissionSystem';

type Teardown = () => void;

// ---- Refinery -----------------------------------------------------------

export function openRefineryPanel(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  RaidZoneSystem.ensureSaveShape();
  const panel = el('div', 'nfr-panel violet');
  panel.style.minWidth = '560px';
  panel.style.padding = '28px 32px 24px';

  const title = el('h1', 'nfr-panel__title');
  title.textContent = Strings.refineryTitle;
  panel.appendChild(title);

  const sub = el('div', 'nfr-panel__subtitle');
  const coreWrap = el('span');
  coreWrap.innerHTML = `<span style="display:inline-flex;vertical-align:middle;color:var(--nfr-gold);width:14px;height:14px;margin-right:4px;">${CORE_ICON}</span>`;
  const sw = scene; void sw;
  sub.appendChild(coreWrap);
  const materials = RaidZoneSystem.getMaterials();
  sub.appendChild(document.createTextNode(
    `${Strings.summaryCores}: ${Economy.getWallet().cores}  |  ` +
    `${MaterialDefs.alloy.shortLabel}: ${materials.alloy}  |  ` +
    `${MaterialDefs.circuits.shortLabel}: ${materials.circuits}`,
  ));
  panel.appendChild(sub);

  const body = el('div', 'nfr-panel__body');
  panel.appendChild(body);

  let dismiss: Teardown = () => undefined;

  const renderRow = (id: typeof REFINERY_ORDER[number]): HTMLElement => {
    const def = RefineryDefs[id];
    const owned = RefinerySystem.isOwned(id);
    const available = RefinerySystem.isAvailable(id);

    const row = el('div', 'nfr-row');
    if (owned) row.classList.add('is-owned');
    if (!available && !owned) row.classList.add('is-locked');

    const main = el('div', 'nfr-row__main');
    const titleEl = el('div', 'nfr-row__title');
    titleEl.textContent = def.name;
    main.appendChild(titleEl);
    const effectEl = el('div', 'nfr-row__effect');
    effectEl.textContent = def.effect;
    main.appendChild(effectEl);
    row.appendChild(main);

    if (owned) {
      const status = el('div', 'nfr-row__status');
      status.textContent = Strings.refineryOwned;
      row.appendChild(status);
    } else if (!available) {
      const req = def.requires ? RefineryDefs[def.requires].name : '?';
      const status = el('div', 'nfr-row__meta');
      status.textContent = `${Strings.refineryRequiresPrefix}${req}`;
      row.appendChild(status);
    } else {
      const canAfford = RefinerySystem.canAfford(id);
      const costs = [
        def.costCores > 0 ? `${def.costCores}${Strings.refineryCostSuffix}` : '',
        RaidZoneSystem.formatMaterialCost(def.costMaterials),
      ].filter(Boolean).join(' / ');
      const buy = btn(costs || 'FREE', 'violet', () => {
        if (RefinerySystem.purchase(id)) {
          void saveSystem.persist();
          dismiss();
          openRefineryPanel(scene, onClosed);
        }
      }, { disabled: !canAfford, size: 'sm' });
      row.appendChild(buy);
    }

    return row;
  };

  for (const id of REFINERY_ORDER) body.appendChild(renderRow(id));

  const footer = el('div', 'nfr-panel__footer');
  footer.appendChild(btn(Strings.refineryClose, 'violet', () => { dismiss(); }, { size: 'lg' }));
  panel.appendChild(footer);

  dismiss = UIOverlay.mountModal(scene, panel, {
    dismissOnBackdrop: true,
    onDismiss: () => onClosed?.(),
  });
  return dismiss;
}

// ---- Raid Zones ---------------------------------------------------------

export function openZonePanel(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  const selected = RaidZoneSystem.getSelectedZone();
  const unlocked = new Set(RaidZoneSystem.getUnlockedZoneIds());

  const panel = el('div', 'nfr-panel gold');
  panel.style.minWidth = '620px';
  panel.style.padding = '28px 32px 24px';

  const title = el('h1', 'nfr-panel__title');
  title.textContent = Strings.zonePanelTitle;
  panel.appendChild(title);

  const body = el('div', 'nfr-panel__body');
  panel.appendChild(body);

  let dismiss: Teardown = () => undefined;

  for (const zone of RaidZoneSystem.getZones()) {
    const isUnlocked = unlocked.has(zone.id);
    const isSelected = selected.id === zone.id;
    const material = MaterialDefs[zone.material];

    const row = el('div', 'nfr-row');
    if (isSelected) row.classList.add('is-owned');
    if (!isUnlocked) row.classList.add('is-locked');

    const main = el('div', 'nfr-row__main');
    const titleEl = el('div', 'nfr-row__title');
    titleEl.textContent = zone.name;
    main.appendChild(titleEl);

    const effectEl = el('div', 'nfr-row__effect');
    effectEl.textContent = zone.description;
    main.appendChild(effectEl);

    const meta = el('div', 'nfr-row__meta');
    const lockText = isUnlocked
      ? `${Strings.zonePanelYieldPrefix}${zone.materialYieldPer100Scrap} ${material.label}/100 Scrap  |  ${Strings.zonePanelThreatPrefix}${zone.threatMult.toFixed(2)}`
      : `${Strings.zonePanelLockedPrefix}${zone.unlockExtracts}${Strings.zonePanelLockedSuffix}`;
    meta.textContent = lockText;
    main.appendChild(meta);
    row.appendChild(main);

    if (isSelected) {
      const status = el('div', 'nfr-row__status');
      status.textContent = Strings.zonePanelSelected;
      row.appendChild(status);
    } else {
      row.appendChild(btn(Strings.zonePanelSelect, 'gold', () => {
        if (RaidZoneSystem.selectZone(zone.id)) {
          void saveSystem.persist();
          dismiss();
          openZonePanel(scene, onClosed);
        }
      }, { disabled: !isUnlocked, size: 'sm' }));
    }

    body.appendChild(row);
  }

  const footer = el('div', 'nfr-panel__footer');
  footer.appendChild(btn(Strings.zonePanelClose, 'gold', () => { dismiss(); }, { size: 'lg' }));
  panel.appendChild(footer);

  dismiss = UIOverlay.mountModal(scene, panel, {
    dismissOnBackdrop: true,
    onDismiss: () => onClosed?.(),
  });
  return dismiss;
}

// ---- Mission Board ------------------------------------------------------

export function openMissionBoard(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  MissionBoard.refreshIfNeeded();

  const panel = el('div', 'nfr-panel gold');
  panel.style.minWidth = '560px';
  panel.style.padding = '28px 32px 24px';

  const title = el('h1', 'nfr-panel__title');
  title.textContent = Strings.missionBoardTitle;
  panel.appendChild(title);

  const body = el('div', 'nfr-panel__body');
  panel.appendChild(body);

  let dismiss: Teardown = () => undefined;

  const board = MissionBoard.getActive();
  if (board.length === 0) {
    const empty = el('div', 'nfr-row__effect');
    empty.style.textAlign = 'center';
    empty.style.padding = '24px';
    empty.textContent = Strings.missionBoardEmpty;
    body.appendChild(empty);
  } else {
    for (const slot of board) {
      const def: MissionDef | undefined = MISSION_DEFS[slot.id];
      if (!def) continue;

      const row = el('div', 'nfr-row');
      const main = el('div', 'nfr-row__main');
      const titleEl = el('div', 'nfr-row__title');
      titleEl.textContent = def.label;
      main.appendChild(titleEl);

      const progress = el('div', 'nfr-row__progress');
      progress.textContent = `${Math.min(slot.progress, def.target)} / ${def.target}`;
      main.appendChild(progress);

      const reward = el('div', 'nfr-row__reward');
      const materialReward = RaidZoneSystem.formatMaterialWallet(def.rewardMaterials ?? {});
      reward.textContent =
        `Reward: +${def.rewardScrap} Scrap${def.rewardCores ? `, +${def.rewardCores} Core` : ''}` +
        `${materialReward ? `, ${materialReward}` : ''}`;
      main.appendChild(reward);
      row.appendChild(main);

      const canClaim = slot.progress >= def.target && !slot.claimed;
      const claimLabel = slot.claimed ? Strings.missionBoardClaimed : Strings.missionBoardClaim;
      row.appendChild(btn(claimLabel, 'gold', () => {
        if (MissionBoard.claim(slot.id)) {
          void saveSystem.persist();
          dismiss();
          openMissionBoard(scene, onClosed);
        }
      }, { disabled: !canClaim, size: 'sm' }));
      body.appendChild(row);
    }
  }

  const footer = el('div', 'nfr-panel__footer');
  footer.appendChild(btn(Strings.missionBoardClose, 'gold', () => { dismiss(); }, { size: 'lg' }));
  panel.appendChild(footer);

  dismiss = UIOverlay.mountModal(scene, panel, {
    dismissOnBackdrop: true,
    onDismiss: () => onClosed?.(),
  });
  return dismiss;
}

// ---- Prestige -----------------------------------------------------------

export function openPrestigePanel(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  const save = saveSystem.get();
  const eligible =
    save.upgrades.gen >= Balance.prestige.minGenLevel && save.cores >= Balance.prestige.minCores;

  const panel = el('div', 'nfr-panel red');
  panel.style.minWidth = '460px';
  panel.style.padding = '28px 32px 24px';

  const title = el('h1', 'nfr-panel__title');
  title.textContent = Strings.prestigeTitle;
  panel.appendChild(title);

  const sub = el('div', 'nfr-panel__subtitle');
  sub.textContent = `${Strings.prestigeCyberCoreLabel}: ${save.prestige.cyberCores}`;
  sub.style.color = 'var(--nfr-gold)';
  panel.appendChild(sub);

  const body = el('div');
  body.style.textAlign = 'center';
  body.style.padding = '6px 4px 14px';
  body.style.color = 'var(--nfr-ink)';
  body.style.fontSize = '14px';
  body.style.lineHeight = '1.5';
  body.style.letterSpacing = '0.02em';
  body.textContent = eligible ? Strings.prestigeBodyEligible : Strings.prestigeBodyLocked;
  panel.appendChild(body);

  let dismiss: Teardown = () => undefined;

  const footer = el('div', 'nfr-panel__footer');
  if (eligible) {
    footer.appendChild(btn(Strings.prestigeCancel, 'cyan', () => { dismiss(); }, { size: 'lg' }));
    footer.appendChild(btn(Strings.prestigeConfirm, 'red', () => {
      performPrestige();
      void saveSystem.persist();
      dismiss();
    }, { size: 'lg' }));
  } else {
    footer.appendChild(btn('CLOSE', 'red', () => { dismiss(); }, { size: 'lg' }));
  }
  panel.appendChild(footer);

  dismiss = UIOverlay.mountModal(scene, panel, {
    dismissOnBackdrop: true,
    onDismiss: () => onClosed?.(),
  });
  return dismiss;
}

// Prestige (§10.3) — wipes Scrap and most upgrades, keeps Refinery, cosmetics,
// operators, achievements; grants +1 Cyber-Core for a stacking global mult.
function performPrestige(): void {
  const save = saveSystem.get();
  save.prestige.cyberCores += 1;
  save.prestige.count += 1;
  save.scrap = Balance.economy.startingScrap;
  save.cores = 0;
  save.materials = createEmptyMaterials();
  save.selectedZoneId = DEFAULT_RAID_ZONE_ID;
  save.unlockedZoneIds = [DEFAULT_RAID_ZONE_ID];
  save.upgrades = { gen: 1, drone: 0, speed: 0, magnet: 0, damage: 0, luck: 0, worker: 0 };
  save.infestation = { machineIds: [], failsBeforeFirst: Balance.infestation.failsBeforeInfestation };
  save.firstCoreCollected = false;
  save.lastSave = Date.now();
  save.dailySeedAttempted = '';
  void todayUtcDate;
}


function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function openResearchPanel(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  ResearchSystem.ensureSaveShape();
  const completed = ResearchSystem.checkCompletion();
  if (completed) void saveSystem.persist();
  const panel = el('div', 'nfr-panel violet');
  panel.style.minWidth = '640px';
  const title = el('h1', 'nfr-panel__title', Strings.researchTitle);
  const sub = el('div', 'nfr-panel__subtitle');
  sub.textContent = `${Strings.summaryScrap}: ${Economy.getWallet().scrap}  |  ${Strings.summaryCores}: ${Economy.getWallet().cores}`;
  panel.appendChild(title);
  panel.appendChild(sub);
  const active = ResearchSystem.getActive();
  if (active) {
    const activeEl = el('div', 'nfr-panel__subtitle');
    activeEl.style.color = 'var(--nfr-green)';
    activeEl.textContent = `${ResearchDefs[active.id].name} · ${fmtRemain(ResearchSystem.getRemainingMs())}`;
    panel.appendChild(activeEl);
  }
  const body = el('div', 'nfr-panel__body');
  let dismiss: Teardown = () => undefined;
  for (const id of RESEARCH_ORDER) {
    const def = ResearchDefs[id];
    const row = el('div', 'nfr-row');
    const main = el('div', 'nfr-row__main');
    main.appendChild(el('div', 'nfr-row__title', def.name));
    main.appendChild(el('div', 'nfr-row__effect', def.desc));
    const cost = el('div', 'nfr-row__meta', `${fmtDuration(def.durationMs)} · ${def.costScrap} Scrap${def.costCores > 0 ? ` · ${def.costCores} Cores` : ''}`);
    main.appendChild(cost);
    row.appendChild(main);
    if (ResearchSystem.isCompleted(id)) {
      row.classList.add('is-owned');
      row.appendChild(el('div', 'nfr-row__status', Strings.researchCompleted));
    } else if (active?.id === id) {
      row.classList.add('is-owned');
      row.appendChild(el('div', 'nfr-row__status', Strings.researchInProgress));
    } else {
      const available = ResearchSystem.isAvailable(id);
      if (!available) row.classList.add('is-locked');
      row.appendChild(btn(Strings.researchStart, 'violet', () => {
        if (ResearchSystem.startResearch(id)) {
          void saveSystem.persist();
          dismiss();
          openResearchPanel(scene, onClosed);
        }
      }, { disabled: !available, size: 'sm' }));
    }
    body.appendChild(row);
  }
  panel.appendChild(body);
  const footer = el('div', 'nfr-panel__footer');
  footer.appendChild(btn(Strings.researchClose, 'violet', () => dismiss(), { size: 'lg' }));
  panel.appendChild(footer);
  dismiss = UIOverlay.mountModal(scene, panel, { dismissOnBackdrop: true, onDismiss: () => onClosed?.() });
  return dismiss;
}

export function openDroneBayPanel(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  DroneMissionSystem.ensureSaveShape();
  const completed = DroneMissionSystem.checkCompletions();
  if (completed.length > 0) void saveSystem.persist();
  const panel = el('div', 'nfr-panel cyan');
  panel.style.minWidth = '700px';
  panel.appendChild(el('h1', 'nfr-panel__title', Strings.droneBayTitle));
  panel.appendChild(el('div', 'nfr-panel__subtitle', `${Strings.droneBaySlots}${DroneMissionSystem.getSlotCount()}`));
  const body = el('div', 'nfr-panel__body');
  let dismiss: Teardown = () => undefined;
  const active = DroneMissionSystem.getActive();
  const emptySlot = [...Array(DroneMissionSystem.getSlotCount()).keys()].find(i => !active.some(m => m.slotIdx === i)) ?? -1;
  for (let slotIdx = 0; slotIdx < DroneMissionSystem.getSlotCount(); slotIdx++) {
    const slot = active.find(m => m.slotIdx === slotIdx);
    const row = el('div', 'nfr-row');
    const main = el('div', 'nfr-row__main');
    main.appendChild(el('div', 'nfr-row__title', `${Strings.droneBaySlot} ${slotIdx + 1}`));
    main.appendChild(el('div', 'nfr-row__effect', slot ? DroneMissionDefs[slot.missionId].name : Strings.droneBayIdle));
    main.appendChild(el('div', 'nfr-row__meta', slot ? fmtRemain(DroneMissionSystem.getTimeRemainingMs(slotIdx)) : Strings.droneBayReady));
    row.appendChild(main);
    body.appendChild(row);
  }
  for (const id of DRONE_MISSION_ORDER) {
    const def = DroneMissionDefs[id];
    const row = el('div', 'nfr-row');
    const main = el('div', 'nfr-row__main');
    main.appendChild(el('div', 'nfr-row__title', def.name));
    main.appendChild(el('div', 'nfr-row__effect', def.desc));
    main.appendChild(el('div', 'nfr-row__meta', fmtDuration(DroneMissionSystem.getMissionDurationMs(id))));
    row.appendChild(main);
    row.appendChild(btn(Strings.droneBayLaunch, 'cyan', () => {
      if (DroneMissionSystem.launch(id, emptySlot)) {
        void saveSystem.persist();
        dismiss();
        openDroneBayPanel(scene, onClosed);
      }
    }, { disabled: emptySlot < 0, size: 'sm' }));
    body.appendChild(row);
  }
  panel.appendChild(body);
  const footer = el('div', 'nfr-panel__footer');
  footer.appendChild(btn(Strings.droneBayClose, 'cyan', () => dismiss(), { size: 'lg' }));
  panel.appendChild(footer);
  dismiss = UIOverlay.mountModal(scene, panel, { dismissOnBackdrop: true, onDismiss: () => onClosed?.() });
  return dismiss;
}
