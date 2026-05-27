import type Phaser from 'phaser';
import { UIOverlay, el, btn } from './overlay/UIOverlay';
import { Strings } from '../config/Strings';
import { AdManager } from '../platform/AdManager';
import { saveSystem } from '../platform/SaveSystem';
import { Economy } from '../systems/EconomySystem';

export type FortuneReward =
  | { kind: 'scrap'; amount: number; label: string; color: string }
  | { kind: 'cores'; amount: number; label: string; color: string }
  | { kind: 'factoryBoost'; minutes: number; label: string; color: string };

const SEGMENTS: FortuneReward[] = [
  { kind: 'scrap', amount: 100, label: '100 SCRAP', color: '#22f6ff' },
  { kind: 'scrap', amount: 300, label: '300 SCRAP', color: '#72ff9f' },
  { kind: 'cores', amount: 1, label: '1 CORE', color: '#ffd75a' },
  { kind: 'scrap', amount: 100, label: '100 SCRAP', color: '#22f6ff' },
  { kind: 'factoryBoost', minutes: 30, label: '2× BOOST 30M', color: '#ffb24a' },
  { kind: 'scrap', amount: 300, label: '300 SCRAP', color: '#72ff9f' },
  { kind: 'cores', amount: 1, label: '1 CORE', color: '#ffd75a' },
  { kind: 'scrap', amount: 500, label: '500 SCRAP', color: '#a76cff' },
];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function grantReward(reward: FortuneReward): void {
  if (reward.kind === 'scrap') Economy.bankLoot(reward.amount, 0);
  else if (reward.kind === 'cores') Economy.bankLoot(0, reward.amount);
  else {
    const save = saveSystem.get();
    const now = Date.now();
    const base = Math.max(now, save.adState.factoryBoostActiveUntilMs);
    save.adState.factoryBoostLastMs = now;
    save.adState.factoryBoostActiveUntilMs = base + reward.minutes * 60 * 1000;
  }
  saveSystem.get().adState.lastWheelSpin = todayUtc();
}

function drawWheel(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, angle: number): void {
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.42;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const slice = (Math.PI * 2) / SEGMENTS.length;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i];
    const start = i * slice;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, end);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.strokeStyle = '#081019';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + slice / 2);
    ctx.fillStyle = '#081019';
    ctx.font = '700 13px Orbitron, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(seg.label, r - 12, 4);
    ctx.restore();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(cx, 14);
  ctx.lineTo(cx - 16, 46);
  ctx.lineTo(cx + 16, 46);
  ctx.closePath();
  ctx.fillStyle = '#ffd75a';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#081019';
  ctx.fill();
  ctx.strokeStyle = '#22f6ff';
  ctx.lineWidth = 4;
  ctx.stroke();
}

export function openFortuneWheelPanel(scene: Phaser.Scene, onClosed?: () => void): () => void {
  const panel = el('div', 'nfr-panel gold');
  panel.style.minWidth = '640px';
  const title = el('h1', 'nfr-panel__title', Strings.fortuneWheelTitle);
  const sub = el('div', 'nfr-panel__subtitle', Strings.fortuneWheelSubtitle);
  const body = el('div', 'nfr-panel__body');
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 320;
  canvas.style.width = '100%';
  canvas.style.maxWidth = '420px';
  canvas.style.alignSelf = 'center';
  canvas.style.border = '1px solid rgba(255,215,90,0.35)';
  canvas.style.background = 'radial-gradient(circle at center, rgba(21,37,64,0.96), rgba(6,10,22,0.98))';
  canvas.style.clipPath = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))';
  const result = el('div', 'nfr-row__effect', Strings.fortuneWheelReady);
  result.style.textAlign = 'center';
  result.style.fontSize = '14px';
  body.appendChild(canvas);
  body.appendChild(result);
  const footer = el('div', 'nfr-panel__footer');
  let dismiss: () => void = () => undefined;
  let spinning = false;
  let currentAngle = 0;
  const ctx = canvas.getContext('2d');
  if (ctx) drawWheel(ctx, canvas, currentAngle);

  const canSpin = saveSystem.get().adState.lastWheelSpin !== todayUtc();
  const spinBtn = btn(Strings.fortuneWheelSpin, 'gold', async () => {
    if (spinning || !canSpin) return;
    scene.scene.pause();
    const granted = await AdManager.offer(scene, {
      title: Strings.fortuneWheelAdTitle,
      description: Strings.fortuneWheelAdDesc,
      placement: 'dailyCrate',
    });
    scene.scene.resume();
    if (!granted) return;
    spinning = true;
    const targetIndex = Math.floor(Math.random() * SEGMENTS.length);
    const slice = (Math.PI * 2) / SEGMENTS.length;
    const targetAngle = Math.PI * 8 + (Math.PI * 2 - (targetIndex * slice + slice / 2));
    const start = performance.now();
    const startAngle = currentAngle;
    const duration = 4200;
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      currentAngle = startAngle + (targetAngle - startAngle) * eased;
      if (ctx) drawWheel(ctx, canvas, currentAngle);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      const reward = SEGMENTS[targetIndex];
      grantReward(reward);
      void saveSystem.persist();
      result.textContent = `${Strings.fortuneWheelWonPrefix}${reward.label}`;
      spinning = false;
      spinBtn.disabled = true;
      spinBtn.classList.add('is-disabled');
    };
    requestAnimationFrame(step);
  }, { disabled: !canSpin, size: 'lg' });
  footer.appendChild(spinBtn);
  footer.appendChild(btn(Strings.fortuneWheelClose, 'cyan', () => dismiss(), { size: 'lg' }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(body);
  panel.appendChild(footer);
  dismiss = UIOverlay.mountModal(scene, panel, { dismissOnBackdrop: true, onDismiss: () => onClosed?.() });
  return dismiss;
}
