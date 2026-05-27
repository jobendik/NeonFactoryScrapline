import type Phaser from 'phaser';
import { UIOverlay, el, btn } from './overlay/UIOverlay';
import { Strings } from '../config/Strings';
import { saveSystem } from '../platform/SaveSystem';
import { StreakSystem } from '../systems/StreakSystem';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function rewardLabel(day: number): string {
  const reward = StreakSystem.rewardForDay(day);
  if (reward.scrap > 0) return `+${reward.scrap} Scrap`;
  if (reward.cores > 0) return `+${reward.cores} Core${reward.cores === 1 ? '' : 's'}`;
  if (reward.cosmetic) return '+1 Shard';
  return Strings.dailyLoginEmpty;
}

export function openDailyLoginPanel(scene: Phaser.Scene, onClosed?: () => void): () => void {
  const panel = el('div', 'nfr-panel gold');
  panel.style.minWidth = '700px';
  const title = el('h1', 'nfr-panel__title', Strings.dailyLoginTitle);
  const sub = el('div', 'nfr-panel__subtitle', Strings.dailyLoginSubtitle);
  const body = el('div', 'nfr-panel__body');
  const grid = el('div', 'nfr-panel__row');
  grid.style.justifyContent = 'center';
  grid.style.gap = '12px';
  grid.style.flexWrap = 'nowrap';

  const save = saveSystem.get();
  const streakDay = Math.max(0, save.daily.streakDay);
  const claimedToday = save.daily.lastStreakDate === todayUtc();
  const currentWeekStart = Math.floor(Math.max(0, streakDay) / 7) * 7 + 1;
  const todayTargetDay = claimedToday ? streakDay : streakDay + 1;

  for (let i = 0; i < 7; i++) {
    const day = currentWeekStart + i;
    const box = el('div', 'nfr-row');
    box.style.width = '88px';
    box.style.minHeight = '118px';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.justifyContent = 'space-between';
    box.style.alignItems = 'center';
    box.style.padding = '14px 10px';
    if (day < todayTargetDay || (claimedToday && day === todayTargetDay)) box.classList.add('is-owned');
    else if (day > todayTargetDay) box.classList.add('is-locked');
    else box.style.borderColor = 'var(--nfr-gold-60)';

    box.appendChild(el('div', 'nfr-row__title', `${Strings.dailyLoginDay} ${day}`));
    const reward = el('div', 'nfr-row__effect', rewardLabel(day));
    reward.style.textAlign = 'center';
    box.appendChild(reward);
    const status = el('div', day < todayTargetDay || (claimedToday && day === todayTargetDay)
      ? 'nfr-row__status'
      : 'nfr-row__meta',
      day < todayTargetDay || (claimedToday && day === todayTargetDay)
        ? '✓'
        : day === todayTargetDay
          ? Strings.dailyLoginToday
          : Strings.dailyLoginFuture,
    );
    box.appendChild(status);
    grid.appendChild(box);
  }

  body.appendChild(grid);
  const footer = el('div', 'nfr-panel__footer');
  let dismiss: () => void = () => undefined;
  footer.appendChild(btn(Strings.dailyLoginClose, 'gold', () => dismiss(), { size: 'lg' }));
  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(body);
  panel.appendChild(footer);
  dismiss = UIOverlay.mountModal(scene, panel, { dismissOnBackdrop: true, onDismiss: () => onClosed?.() });
  return dismiss;
}
