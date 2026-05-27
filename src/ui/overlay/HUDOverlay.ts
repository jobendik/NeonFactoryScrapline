// HTML+CSS HUD readouts for the raid/factory scenes.
//
// HUDScene owns one HUDOverlay; it composes the readouts every frame by calling
// per-field setters. The overlay tracks its own DOM and tears itself down on
// scene shutdown (via UIOverlay's scene-scope tracking).
//
// Why HTML and not Phaser text:
//   - Real font kerning and letter-spacing (Orbitron / JetBrains Mono)
//   - GPU-composited text-shadows for the neon glow with no fillrate cost
//   - CSS transitions for the HP bar fill (visual smoothing for free)
//   - Backdrop-filter blur where readouts overlap the gameplay layer

import type Phaser from 'phaser';
import { UIOverlay, el } from './UIOverlay';
import { SCRAP_ICON, CORE_ICON } from './Icons';

export interface PipInfo {
  iconText: string;
  color: number;
  remaining: number;
  total: number;
}

export class HUDOverlay {
  private root: HTMLElement;
  private dismiss: () => void;

  private fps: HTMLElement;
  private hpBar: HTMLElement;
  private hpFill: HTMLElement;
  private hpLabel: HTMLElement;
  private pipStrip: HTMLElement;

  private timerEl: HTMLElement;
  private timerLabel: HTMLElement;
  private timerValue: HTMLElement;
  private spmEl: HTMLElement;
  private spmLabel: HTMLElement;
  private spmValue: HTMLElement;

  private comboEl: HTMLElement;
  private greedEl: HTMLElement;
  private extractEl: HTMLElement;

  private scrapEl: HTMLElement;
  private scrapValue: HTMLElement;
  private coresEl: HTMLElement;
  private coresValue: HTMLElement;
  private cleanseEl: HTMLElement;

  // Retention Phase 1 — slim XP bar pinned below the wallet.
  private xpBarFill: HTMLElement;
  private xpBarLabel: HTMLElement;
  private buffBar: HTMLElement;
  private buffs = new Map<string, { label: string; color: string; ttl?: number }>();

  constructor(scene: Phaser.Scene) {
    this.root = el('div', 'nfr-hud-top');

    // ---- left cluster: FPS + HP + pips ---------------------------------
    const left = el('div', 'nfr-hud-left');

    this.fps = el('div', 'nfr-fps');
    left.appendChild(this.fps);

    this.hpBar = el('div', 'nfr-hpbar');
    const track = el('div', 'nfr-hpbar__track');
    this.hpFill = el('div', 'nfr-hpbar__fill');
    track.appendChild(this.hpFill);
    this.hpLabel = el('div', 'nfr-hpbar__label');
    this.hpBar.appendChild(track);
    this.hpBar.appendChild(this.hpLabel);
    left.appendChild(this.hpBar);

    this.pipStrip = el('div', 'nfr-pip-strip');
    left.appendChild(this.pipStrip);
    this.root.appendChild(left);

    // ---- center cluster: timer + combo + greed -------------------------
    const center = el('div', 'nfr-hud-center');

    this.timerEl = el('div', 'nfr-timer');
    this.timerLabel = el('span', 'nfr-timer__label');
    this.timerValue = el('span');
    this.timerEl.appendChild(this.timerLabel);
    this.timerEl.appendChild(this.timerValue);

    this.spmEl = el('div', 'nfr-spm');
    this.spmLabel = el('span', 'nfr-spm__label');
    this.spmValue = el('span');
    this.spmEl.appendChild(this.spmLabel);
    this.spmEl.appendChild(this.spmValue);
    this.spmEl.style.display = 'none';

    this.comboEl = el('div', 'nfr-combo');
    this.greedEl = el('div', 'nfr-greed');
    this.extractEl = el('div', 'nfr-extract-banner');

    center.appendChild(this.timerEl);
    center.appendChild(this.spmEl);
    center.appendChild(this.comboEl);
    center.appendChild(this.greedEl);
    center.appendChild(this.extractEl);
    this.root.appendChild(center);

    // ---- right cluster: wallet -----------------------------------------
    const right = el('div', 'nfr-hud-right');

    this.scrapEl = el('div', 'nfr-wallet-line scrap');
    const scrapIcon = el('span', 'nfr-wallet__icon');
    scrapIcon.innerHTML = SCRAP_ICON;
    const scrapLabel = el('span', 'nfr-wallet__label');
    scrapLabel.textContent = 'SCRAP';
    this.scrapValue = el('span');
    this.scrapEl.appendChild(scrapIcon);
    this.scrapEl.appendChild(scrapLabel);
    this.scrapEl.appendChild(this.scrapValue);

    this.coresEl = el('div', 'nfr-wallet-line cores');
    const coresIcon = el('span', 'nfr-wallet__icon');
    coresIcon.innerHTML = CORE_ICON;
    const coresLabel = el('span', 'nfr-wallet__label');
    coresLabel.textContent = 'CORES';
    this.coresValue = el('span');
    this.coresEl.appendChild(coresIcon);
    this.coresEl.appendChild(coresLabel);
    this.coresEl.appendChild(this.coresValue);

    this.cleanseEl = el('div', 'nfr-wallet-line');
    this.cleanseEl.style.color = 'var(--nfr-red)';
    this.cleanseEl.style.fontSize = '13px';
    this.cleanseEl.style.display = 'none';

    right.appendChild(this.scrapEl);
    right.appendChild(this.coresEl);
    right.appendChild(this.cleanseEl);

    // XP bar — compact pill below wallet, always visible during raid.
    const xpBar = el('div', 'nfr-xp-bar');
    const xpTrack = el('div', 'nfr-xp-bar__track');
    this.xpBarFill = el('div', 'nfr-xp-bar__fill');
    xpTrack.appendChild(this.xpBarFill);
    this.xpBarLabel = el('div', 'nfr-xp-bar__label');
    xpBar.appendChild(xpTrack);
    xpBar.appendChild(this.xpBarLabel);
    right.appendChild(xpBar);

    this.root.appendChild(right);

    this.buffBar = el('div', 'nfr-buffbar');
    this.root.appendChild(this.buffBar);

    this.dismiss = UIOverlay.mountHud(scene, this.root);
  }

  setFps(fps: number): void {
    this.fps.textContent = `FPS ${fps.toFixed(0)}`;
  }

  setHp(hp: number, max: number, opts: { lowFlash?: boolean; flashHeal?: boolean } = {}): void {
    if (!this.hpBar.classList.contains('is-visible')) this.hpBar.style.display = '';
    const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
    this.hpFill.style.width = `${ratio * 100}%`;
    this.hpLabel.textContent = `${Math.ceil(hp)} / ${max}`;
    this.hpBar.classList.toggle('is-low', ratio <= 0.3 && !opts.flashHeal);
    this.hpBar.classList.toggle('is-heal', !!opts.flashHeal);
    void opts.lowFlash;
  }

  hideHp(): void {
    this.hpBar.style.display = 'none';
  }

  setTimer(seconds: number, label = 'TIME'): void {
    this.timerEl.style.display = '';
    this.timerLabel.textContent = label;
    const total = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    this.timerValue.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  hideTimer(): void { this.timerEl.style.display = 'none'; }

  setSpm(spm: number): void {
    this.spmEl.style.display = '';
    this.spmLabel.textContent = 'SPM';
    this.spmValue.textContent = spm.toFixed(0);
  }

  hideSpm(): void { this.spmEl.style.display = 'none'; }

  setCombo(mult: number): void {
    if (mult > 1.01) {
      this.comboEl.textContent = `COMBO  x${mult.toFixed(2)}`;
      this.comboEl.classList.add('is-active');
    } else {
      this.comboEl.classList.remove('is-active');
      this.comboEl.textContent = '';
    }
  }

  setGreed(mult: number, active: boolean): void {
    if (active && mult > 1.0) {
      this.greedEl.textContent = `GREED  x${mult.toFixed(2)}`;
      this.greedEl.classList.add('is-active');
    } else {
      this.greedEl.classList.remove('is-active');
      this.greedEl.textContent = '';
    }
  }

  setExtract(open: boolean, label = 'EXTRACTION OPEN'): void {
    this.extractEl.textContent = open ? label : '';
    this.extractEl.classList.toggle('is-active', open);
  }

  setScrap(n: number): void {
    this.scrapEl.style.display = '';
    this.scrapValue.textContent = `${n}`;
  }
  setCores(n: number): void {
    this.coresEl.style.display = '';
    this.coresValue.textContent = `${n}`;
  }
  hideWallet(): void {
    this.scrapEl.style.display = 'none';
    this.coresEl.style.display = 'none';
  }

  setCleanse(text: string | null): void {
    if (text) {
      this.cleanseEl.textContent = text;
      this.cleanseEl.style.display = '';
    } else {
      this.cleanseEl.style.display = 'none';
    }
  }

  // Update the XP progress bar. Called each frame from HUDScene.
  updateXp(xpIntoLevel: number, xpForLevel: number, level: number): void {
    const pct = xpForLevel > 0 ? Math.max(0, Math.min(1, xpIntoLevel / xpForLevel)) : 0;
    this.xpBarFill.style.transform = `scaleX(${pct})`;
    this.xpBarLabel.textContent = `LVL ${level}`;
  }

  setPips(pips: PipInfo[], shieldCharges: number): void {
    // Reuse / append / remove children to keep DOM churn low at 60fps.
    const total = pips.length + (shieldCharges > 0 ? 1 : 0);
    while (this.pipStrip.children.length < total) {
      const pip = el('div', 'nfr-pip');
      const bar = el('div', 'nfr-pip__bar');
      pip.appendChild(bar);
      const label = el('div');
      label.className = 'nfr-pip__label';
      pip.appendChild(label);
      this.pipStrip.appendChild(pip);
    }
    while (this.pipStrip.children.length > total) {
      this.pipStrip.removeChild(this.pipStrip.lastChild!);
    }
    pips.forEach((p, i) => {
      const node = this.pipStrip.children[i] as HTMLElement;
      const bar = node.firstChild as HTMLElement;
      const label = node.lastChild as HTMLElement;
      const color = `#${p.color.toString(16).padStart(6, '0')}`;
      node.style.color = color;
      const ratio = Math.max(0, Math.min(1, p.remaining / Math.max(0.001, p.total)));
      bar.style.width = `${ratio * 100}%`;
      bar.style.color = color;
      label.textContent = `${p.iconText}  ${p.remaining.toFixed(1)}s`;
    });
    if (shieldCharges > 0) {
      const node = this.pipStrip.children[pips.length] as HTMLElement;
      const bar = node.firstChild as HTMLElement;
      const label = node.lastChild as HTMLElement;
      node.style.color = '#ffffff';
      bar.style.width = '100%';
      bar.style.color = '#ffffff';
      label.textContent = `SHLD x${shieldCharges}`;
    }
  }

  setActiveBuff(key: string, label: string, color: string, ttl?: number): void {
    this.buffs.set(key, { label, color, ttl });
    this.renderBuffs();
  }

  clearBuff(key: string): void {
    this.buffs.delete(key);
    this.renderBuffs();
  }

  private renderBuffs(): void {
    this.buffBar.replaceChildren();
    if (this.buffs.size === 0) {
      this.buffBar.style.display = 'none';
      return;
    }
    this.buffBar.style.display = 'flex';
    for (const [key, buff] of this.buffs) {
      const chip = el('div', 'nfr-buffbar__chip');
      chip.dataset.key = key;
      chip.style.borderColor = buff.color;
      chip.style.color = buff.color;
      chip.style.boxShadow = `0 0 10px ${buff.color}33`;
      const ttl = buff.ttl && buff.ttl > 0 ? ` · ${Math.ceil(buff.ttl / 1000)}s` : '';
      chip.textContent = `${buff.label}${ttl}`;
      this.buffBar.appendChild(chip);
    }
  }

  hideAllRaidElements(): void {
    this.hideHp();
    this.hideTimer();
    this.hideWallet();
    this.setCombo(0);
    this.setGreed(0, false);
    this.setExtract(false);
    this.setCleanse(null);
    this.setPips([], 0);
  }

  destroy(): void { this.dismiss(); }
}
