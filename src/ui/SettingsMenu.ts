// SettingsMenu — fully HTML/CSS panel (post-M overhaul). Previously this
// was a Phaser-primitive overlay; now every pixel of the settings UI is
// real DOM, mounted via UIOverlay.mountModal so it inherits chamfered
// frames, blur backdrops, and the design-token color system.
//
// Usage from any scene:
//   new SettingsMenu(scene).open();
// Multiple opens are no-ops while one is up.

import type Phaser from 'phaser';
import { AudioBus, type AudioVolumes } from '../audio/AudioBus';
import { QualityManager } from '../systems/QualityManager';
import { saveSystem, type QualityPreset } from '../platform/SaveSystem';
import { Strings } from '../config/Strings';
import { cosmeticsOfKind, type CosmeticKind, type CosmeticDef } from '../config/CosmeticDefs';
import { CosmeticSystem } from '../systems/CosmeticSystem';
import { AchievementSystem, AchievementDefs, ACHIEVEMENT_ORDER } from '../systems/AchievementSystem';
import { UIOverlay, el, btn } from './overlay/UIOverlay';
import { ToastManager } from './overlay/ToastManager';

type Channel = keyof AudioVolumes;

export class SettingsMenu {
  private scene: Phaser.Scene;
  private open_ = false;
  // Active dismiss handles in z-order. Each push corresponds to a modal
  // mounted via UIOverlay; closeTop pops the most recent one. The root
  // settings panel is always at index 0.
  private dismissStack: Array<() => void> = [];
  // Pause/resume tracking — only resume scenes WE paused so a draft
  // modal's lifecycle isn't trampled.
  private pausedSceneKeys: string[] = [];
  private toastMgr: ToastManager | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  isOpen(): boolean {
    return this.open_;
  }

  open(): void {
    if (this.open_) return;
    this.open_ = true;
    this.pauseUnderlyingGameplay();
    const panel = this.buildSettingsPanel();
    const dismiss = UIOverlay.mountModal(this.scene, panel, {
      dismissOnBackdrop: true,
      onDismiss: () => this.handleRootDismiss(),
    });
    this.dismissStack.push(dismiss);
  }

  close(): void {
    if (!this.open_) return;
    // Tear down from top of stack so any open sub-modals close cleanly.
    while (this.dismissStack.length > 1) {
      const d = this.dismissStack.pop();
      d?.();
    }
    const root = this.dismissStack.pop();
    root?.();
    // handleRootDismiss runs in the dismiss callback and resets state.
  }

  private handleRootDismiss(): void {
    this.open_ = false;
    this.dismissStack = [];
    this.resumeUnderlyingGameplay();
  }

  // ---- Pause / resume gameplay scenes -----------------------------------

  private pauseUnderlyingGameplay(): void {
    const mgr = this.scene.scene;
    for (const key of ['RaidScene', 'FactoryScene']) {
      const target = mgr.get(key);
      if (target && target.scene.isActive()) {
        target.scene.pause();
        this.pausedSceneKeys.push(key);
      }
    }
  }

  private resumeUnderlyingGameplay(): void {
    if (this.pausedSceneKeys.length === 0) return;
    const mgr = this.scene.scene;
    for (const key of this.pausedSceneKeys) {
      const target = mgr.get(key);
      if (target && target.scene.isPaused()) target.scene.resume();
    }
    this.pausedSceneKeys = [];
  }

  private isRaidActive(): boolean {
    const raid = this.scene.scene.get('RaidScene');
    if (!raid) return false;
    if (raid.scene.isActive()) return true;
    return this.pausedSceneKeys.includes('RaidScene');
  }

  // ---- Root settings panel ----------------------------------------------

  private buildSettingsPanel(): HTMLElement {
    const panel = el('div', 'nfr-panel nfr-settings');

    const title = el('h2', 'nfr-panel__title');
    title.textContent = 'SETTINGS';
    panel.appendChild(title);

    panel.appendChild(this.buildAudioSection());
    panel.appendChild(this.buildQualitySection());
    panel.appendChild(this.buildAccessibilitySection());
    panel.appendChild(this.buildExtrasSection());

    if (this.isRaidActive()) {
      const danger = el('div', 'nfr-settings__section');
      const leaveBtn = btn(Strings.leaveRaidButton, 'red', () => this.openLeaveRaidConfirm());
      danger.appendChild(leaveBtn);
      panel.appendChild(danger);
    }

    const footer = el('div', 'nfr-panel__footer');
    const closeBtn = btn('CLOSE', 'cyan', () => this.close());
    footer.appendChild(closeBtn);
    panel.appendChild(footer);

    return panel;
  }

  // ---- Audio section ----------------------------------------------------

  private buildAudioSection(): HTMLElement {
    const section = el('section', 'nfr-settings__section');
    const heading = el('h3', 'nfr-settings__section-title');
    heading.textContent = 'AUDIO';
    section.appendChild(heading);

    const volumes = AudioBus.getVolumes();
    const channels: Array<{ label: string; key: Channel }> = [
      { label: 'MASTER', key: 'master' },
      { label: 'MUSIC', key: 'music' },
      { label: 'SFX', key: 'sfx' },
    ];
    for (const ch of channels) {
      section.appendChild(this.buildSliderRow(ch.label, ch.key, volumes[ch.key]));
    }
    return section;
  }

  private buildSliderRow(label: string, channel: Channel, initial: number): HTMLElement {
    const row = el('div', 'nfr-settings__row');

    const labelEl = el('div', 'nfr-settings__label');
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const slider = el('div', 'nfr-slider');
    const track = el('div', 'nfr-slider__track');
    const fill = el('div', 'nfr-slider__fill');
    const thumb = el('div', 'nfr-slider__thumb');
    track.appendChild(fill);
    track.appendChild(thumb);
    slider.appendChild(track);
    row.appendChild(slider);

    const valueEl = el('div', 'nfr-settings__value');
    row.appendChild(valueEl);

    const apply = (v: number): void => {
      const clamped = Math.max(0, Math.min(1, v));
      AudioBus.setVolume(channel, clamped);
      fill.style.width = `${clamped * 100}%`;
      thumb.style.left = `${clamped * 100}%`;
      valueEl.textContent = `${Math.round(clamped * 100)}%`;
    };
    apply(initial);

    // Pointer drag on the track. We re-measure on each pointerdown so a
    // resize between opens reflects the new track width.
    let dragging = false;
    const computeFromEvent = (clientX: number): number => {
      const rect = track.getBoundingClientRect();
      return (clientX - rect.left) / rect.width;
    };
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      apply(computeFromEvent(e.clientX));
    };
    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      void saveSystem.persist();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    slider.addEventListener('pointerdown', (e: PointerEvent) => {
      dragging = true;
      apply(computeFromEvent(e.clientX));
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    return row;
  }

  // ---- Quality section --------------------------------------------------

  private buildQualitySection(): HTMLElement {
    const section = el('section', 'nfr-settings__section');
    const heading = el('h3', 'nfr-settings__section-title');
    heading.textContent = 'PERFORMANCE';
    section.appendChild(heading);

    const presetRow = el('div', 'nfr-settings__row');
    const presetLabel = el('div', 'nfr-settings__label');
    presetLabel.textContent = 'QUALITY';
    presetRow.appendChild(presetLabel);

    const group = el('div', 'nfr-pill-group');
    const presets: Array<{ id: QualityPreset; label: string }> = [
      { id: 'low', label: 'LOW' },
      { id: 'medium', label: 'MED' },
      { id: 'high', label: 'HIGH' },
    ];
    const refresh = (): void => {
      const active = QualityManager.getPreset();
      const pills = group.querySelectorAll<HTMLElement>('.nfr-pill');
      pills.forEach(p => {
        if (p.dataset.id === active) p.classList.add('is-active');
        else p.classList.remove('is-active');
      });
    };
    for (const p of presets) {
      const pill = el('div', 'nfr-pill');
      pill.dataset.id = p.id;
      pill.textContent = p.label;
      pill.addEventListener('click', () => {
        QualityManager.setPreset(p.id, 'user');
        void saveSystem.persist();
        refresh();
      });
      group.appendChild(pill);
    }
    refresh();
    presetRow.appendChild(group);
    presetRow.appendChild(el('div'));
    section.appendChild(presetRow);

    section.appendChild(this.buildCheckboxRow(
      'AUTO-DETECT',
      QualityManager.isAutoDetectEnabled(),
      next => {
        QualityManager.setAutoDetectEnabled(next);
        void saveSystem.persist();
      },
    ));

    return section;
  }

  // ---- Accessibility section --------------------------------------------

  private buildAccessibilitySection(): HTMLElement {
    const section = el('section', 'nfr-settings__section');
    const heading = el('h3', 'nfr-settings__section-title');
    heading.textContent = 'ACCESSIBILITY';
    section.appendChild(heading);

    const save = saveSystem.get();
    section.appendChild(this.buildCheckboxRow(
      'REDUCED MOTION',
      save.settings.reducedMotion === true,
      next => {
        QualityManager.setReducedMotion(next);
        void saveSystem.persist();
      },
    ));

    return section;
  }

  private buildCheckboxRow(
    label: string,
    initial: boolean,
    onChange: (next: boolean) => void,
  ): HTMLElement {
    const row = el('div', 'nfr-settings__row');
    const labelEl = el('div', 'nfr-settings__label');
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const check = el('label', 'nfr-checkbox' + (initial ? ' is-checked' : ''));
    const box = el('span', 'nfr-checkbox__box');
    check.appendChild(box);
    let state = initial;
    check.addEventListener('click', () => {
      state = !state;
      if (state) check.classList.add('is-checked');
      else check.classList.remove('is-checked');
      onChange(state);
    });
    row.appendChild(check);
    row.appendChild(el('div'));
    return row;
  }

  // ---- Extras (Cosmetics / Achievements / Controls / Credits / Reset) ----

  private buildExtrasSection(): HTMLElement {
    const section = el('section', 'nfr-settings__section');
    const heading = el('h3', 'nfr-settings__section-title');
    heading.textContent = 'EXTRAS';
    section.appendChild(heading);

    const row1 = el('div', 'nfr-panel__row');
    row1.appendChild(btn(Strings.cosmeticsMenuButton, 'violet', () => this.openCosmeticsModal(), { size: 'sm' }));
    row1.appendChild(btn(Strings.achievementsMenuButton, 'gold', () => this.openAchievementsModal(), { size: 'sm' }));
    section.appendChild(row1);

    const row2 = el('div', 'nfr-panel__row');
    row2.appendChild(btn('CONTROLS', 'cyan', () => this.openControlsModal(), { size: 'sm' }));
    row2.appendChild(btn('CREDITS', 'cyan', () => this.openCreditsModal(), { size: 'sm' }));
    row2.appendChild(btn(Strings.settingsExportButton, 'gold', () => this.exportSave(), { size: 'sm' }));
    row2.appendChild(btn(Strings.settingsImportButton, 'violet', () => this.importSave(), { size: 'sm' }));
    row2.appendChild(btn('RESET SAVE', 'red', () => this.openResetSaveConfirm(), { size: 'sm' }));
    section.appendChild(row2);

    return section;
  }

  // ---- Sub-modals -------------------------------------------------------

  private openCosmeticsModal(): void {
    const panel = el('div', 'nfr-panel');
    const title = el('h2', 'nfr-panel__title');
    title.textContent = Strings.cosmeticsMenuTitle;
    panel.appendChild(title);

    const sections: Array<{ kind: CosmeticKind; label: string }> = [
      { kind: 'trail', label: Strings.cosmeticsTabTrail },
      { kind: 'skin', label: Strings.cosmeticsTabSkin },
      { kind: 'theme', label: Strings.cosmeticsTabTheme },
    ];
    for (const s of sections) {
      panel.appendChild(this.buildCosmeticSection(s.kind, s.label));
    }

    const footer = el('div', 'nfr-panel__footer');
    let dismissSelf: (() => void) | null = null;
    footer.appendChild(btn('CLOSE', 'cyan', () => dismissSelf?.()));
    panel.appendChild(footer);

    const wrappedDismiss = UIOverlay.mountModal(this.scene, panel, {
      dismissOnBackdrop: true,
      onDismiss: () => {
        const idx = this.dismissStack.indexOf(wrappedDismiss);
        if (idx >= 0) this.dismissStack.splice(idx, 1);
      },
    });
    dismissSelf = wrappedDismiss;
    this.dismissStack.push(wrappedDismiss);
  }

  private buildCosmeticSection(kind: CosmeticKind, label: string): HTMLElement {
    const section = el('section', 'nfr-settings__section');
    const heading = el('h3', 'nfr-settings__section-title');
    heading.textContent = label;
    section.appendChild(heading);

    const items = cosmeticsOfKind(kind);
    const equipped = CosmeticSystem.getEquipped(kind);
    const grid = el('div', 'nfr-cosmetic-grid');
    for (const it of items) {
      grid.appendChild(this.buildCosmeticTile(it, equipped === it.id));
    }
    section.appendChild(grid);
    return section;
  }

  private buildCosmeticTile(def: CosmeticDef, isEquipped: boolean): HTMLElement {
    const owned = CosmeticSystem.isOwned(def.id);
    const tile = el('div', 'nfr-cosmetic-tile');
    if (isEquipped) tile.classList.add('is-equipped');
    if (!owned) tile.classList.add('is-locked');

    const swatch = el('div', 'nfr-cosmetic-tile__swatch');
    swatch.style.background = '#' + def.color.toString(16).padStart(6, '0');
    tile.appendChild(swatch);

    const name = el('div', 'nfr-cosmetic-tile__name');
    name.textContent = def.name;
    tile.appendChild(name);

    const desc = el('div', 'nfr-cosmetic-tile__desc');
    desc.textContent = def.description;
    tile.appendChild(desc);

    const status = el('div', 'nfr-cosmetic-tile__status');
    if (!owned) {
      status.textContent = `${Strings.cosmeticsLockedPrefix}${def.unlockCondition}`;
    } else if (isEquipped) {
      status.textContent = Strings.cosmeticsEquipped;
    } else {
      status.textContent = Strings.cosmeticsEquip;
    }
    tile.appendChild(status);

    if (owned && !isEquipped) {
      tile.classList.add('is-actionable');
      tile.addEventListener('click', () => {
        CosmeticSystem.equip(def.id);
        void saveSystem.persist();
        // Re-render cosmetics modal: close current and reopen.
        const top = this.dismissStack.pop();
        top?.();
        this.openCosmeticsModal();
      });
    }
    return tile;
  }

  private openAchievementsModal(): void {
    const panel = el('div', 'nfr-panel');
    const title = el('h2', 'nfr-panel__title');
    title.textContent = Strings.achievementsMenuTitle;
    panel.appendChild(title);

    const list = el('div', 'nfr-achievement-list');
    for (const id of ACHIEVEMENT_ORDER) {
      const def = AchievementDefs[id];
      const unlocked = AchievementSystem.isUnlocked(id);
      const row = el('div', 'nfr-achievement-row');
      if (unlocked) row.classList.add('is-unlocked');
      if (def.deferred) row.classList.add('is-deferred');

      const main = el('div', 'nfr-achievement-row__main');
      const name = el('div', 'nfr-achievement-row__name');
      name.textContent = def.name;
      main.appendChild(name);
      const desc = el('div', 'nfr-achievement-row__desc');
      desc.textContent = def.description;
      main.appendChild(desc);
      row.appendChild(main);

      const status = el('div', 'nfr-achievement-row__status');
      status.textContent = def.deferred
        ? Strings.achievementDeferredLabel
        : unlocked
          ? '✓'
          : Strings.achievementLockedLabel;
      row.appendChild(status);

      list.appendChild(row);
    }
    panel.appendChild(list);

    const footer = el('div', 'nfr-panel__footer');
    let dismissSelf: (() => void) | null = null;
    footer.appendChild(btn('CLOSE', 'gold', () => dismissSelf?.()));
    panel.appendChild(footer);

    const d = UIOverlay.mountModal(this.scene, panel, {
      dismissOnBackdrop: true,
      onDismiss: () => {
        const idx = this.dismissStack.indexOf(d);
        if (idx >= 0) this.dismissStack.splice(idx, 1);
      },
    });
    dismissSelf = d;
    this.dismissStack.push(d);
  }

  private openControlsModal(): void {
    this.openTextModal(
      'CONTROLS',
      [
        'Move      — WASD or arrow keys / floating joystick (mobile)',
        'Dash      — Space / dash button (bottom-right)',
        'Pause     — ESC / settings cog',
        'Mute      — speaker icon (top-right)',
        'Auto-aim and auto-fire — no manual aiming.',
        '',
        'Pickups magnetize within range; Star Hearts drop rarely.',
        'Hold the green moongate to fly home; linger for Glimmer.',
      ],
      'cyan',
    );
  }

  private openCreditsModal(): void {
    this.openTextModal(
      'CREDITS',
      [
        'STARFALL GARDEN',
        '',
        'Design  — Per blueprint v1.0',
        'Code    — Claude (Runs A / B / C / D)',
        'Audio   — Web Audio synthesis, in-game',
        'Engine  — Phaser 3',
        '',
        'Built for CrazyGames.',
      ],
      'gold',
    );
  }

  private openTextModal(title: string, lines: string[], variant: 'cyan' | 'gold' | 'violet'): void {
    const panel = el('div', 'nfr-panel');
    const h = el('h2', 'nfr-panel__title');
    h.textContent = title;
    panel.appendChild(h);

    const body = el('pre', 'nfr-panel__body-text');
    body.textContent = lines.join('\n');
    panel.appendChild(body);

    const footer = el('div', 'nfr-panel__footer');
    let dismissSelf: (() => void) | null = null;
    footer.appendChild(btn('CLOSE', variant, () => dismissSelf?.()));
    panel.appendChild(footer);

    const d = UIOverlay.mountModal(this.scene, panel, {
      dismissOnBackdrop: true,
      onDismiss: () => {
        const idx = this.dismissStack.indexOf(d);
        if (idx >= 0) this.dismissStack.splice(idx, 1);
      },
    });
    dismissSelf = d;
    this.dismissStack.push(d);
  }



  private toast(text: string, variant: 'info' | 'alert' | 'reward' = 'info'): void {
    this.toastMgr ??= new ToastManager(this.scene);
    this.toastMgr.show({ text, variant, duration: 2800 });
  }

  private exportSave(): void {
    const blob = new Blob([JSON.stringify(saveSystem.get(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'starfall-garden-save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.toast(Strings.settingsExportSuccess, 'reward');
  }

  private importSave(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const ok = await saveSystem.importData(parsed);
        if (!ok) throw new Error('invalid');
        this.toast(Strings.settingsImportSuccess, 'reward');
        setTimeout(() => window.location.reload(), 700);
      } catch {
        this.toast(Strings.settingsImportError, 'alert');
      }
    });
    input.click();
  }

  private openResetSaveConfirm(): void {
    this.openConfirm({
      title: 'RESET SAVE?',
      body:
        'This wipes all upgrades, unlocks, cosmetics,\n' +
        'streaks, and the leaderboard locally. Are you sure?',
      confirmLabel: 'WIPE',
      confirmVariant: 'red',
      cancelLabel: 'CANCEL',
      onConfirm: () => {
        try {
          localStorage.removeItem('nfr:save');
        } catch {
          // ignore quota / disabled-storage errors
        }
        window.location.reload();
      },
    });
  }

  private openLeaveRaidConfirm(): void {
    this.openConfirm({
      title: Strings.leaveRaidConfirmTitle,
      body: Strings.leaveRaidConfirmBody,
      confirmLabel: Strings.leaveRaidConfirmYes,
      confirmVariant: 'red',
      cancelLabel: Strings.leaveRaidConfirmNo,
      onConfirm: () => {
        // Resolve the raid scene at click time — paused state is fine,
        // requestLeaveRaid handles its own resume.
        const raid = this.scene.scene.get('RaidScene') as
          | (Phaser.Scene & { requestLeaveRaid?: () => void })
          | undefined;
        this.close();
        raid?.requestLeaveRaid?.();
      },
    });
  }

  private openConfirm(opts: {
    title: string;
    body: string;
    confirmLabel: string;
    confirmVariant: 'cyan' | 'gold' | 'red' | 'green' | 'violet';
    cancelLabel: string;
    onConfirm: () => void;
  }): void {
    const panel = el('div', 'nfr-panel nfr-panel--confirm');
    const h = el('h2', 'nfr-panel__title');
    h.textContent = opts.title;
    panel.appendChild(h);

    const body = el('p', 'nfr-panel__body');
    body.textContent = opts.body;
    panel.appendChild(body);

    const footer = el('div', 'nfr-panel__footer');
    let dismissSelf: (() => void) | null = null;
    footer.appendChild(btn(opts.cancelLabel, 'cyan', () => dismissSelf?.()));
    footer.appendChild(btn(opts.confirmLabel, opts.confirmVariant, () => {
      dismissSelf?.();
      opts.onConfirm();
    }));
    panel.appendChild(footer);

    const d = UIOverlay.mountModal(this.scene, panel, {
      dismissOnBackdrop: true,
      onDismiss: () => {
        const idx = this.dismissStack.indexOf(d);
        if (idx >= 0) this.dismissStack.splice(idx, 1);
      },
    });
    dismissSelf = d;
    this.dismissStack.push(d);
  }
}
