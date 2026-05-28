import Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { sfxUiClick } from '../audio/sfx';
import { Analytics } from '../platform/Analytics';
import { UIOverlay, el, btn } from '../ui/overlay/UIOverlay';

// ModalScene — top-of-stack overlay for the §17 rewarded-ad confirmation
// prompts (per blueprint §21.3 "ad confirmation"). M-overhaul: now an HTML
// overlay mounted via UIOverlay, so the modal inherits the design system's
// chamfered frame, neon glow, blur backdrop, and CTA button styling.
//
// Usage (unchanged from prior Phaser-primitive impl):
//   scene.scene.launch('ModalScene', {
//     title: '…',
//     description: '…',
//     onResult: accepted => { ... },
//   });
//
// The launcher is responsible for pausing/resuming its own scene. ModalScene
// renders, gathers a boolean choice, fires analytics, and calls back.

// Stable placement IDs for analytics. Adding 'unknown' lets old callers
// that don't pass a placement still work without lying in the dashboard.
export type AdPlacementId =
  | 'revive'
  | 'extendRun'
  | 'doubleLoot'
  | 'factoryBoost'
  | 'clearInfestation'
  | 'dailyCrate'
  | 'operatorTryOut'
  | 'unknown';

export interface ModalAdInit {
  title: string;
  description: string;
  acceptLabel?: string;
  declineLabel?: string;
  // Border tint hint from the original API — mapped to a CSS variant.
  // Reward yellow → 'gold', revive green → 'green', danger red → 'red'.
  borderColor?: number;
  // Playbook §16.4 — stable placement tag for modal-exposure analytics.
  placement?: AdPlacementId;
  // Called with true on accept, false on decline.
  onResult: (accepted: boolean) => void;
}

const DEFAULT_BORDER = 0xffd75a;

function variantForBorder(border: number): 'gold' | 'green' | 'red' | 'cyan' | 'violet' {
  switch (border) {
    case 0x72ff9f:
    case 0x66ff99:
      return 'green';
    case 0xff416b:
    case 0xff4040:
      return 'red';
    case 0x7cc9ff:
      return 'cyan';
    case 0xb98cff:
      return 'violet';
    case 0xffd75a:
    default:
      return 'gold';
  }
}

export class ModalScene extends Phaser.Scene {
  private cfg!: ModalAdInit;
  private resolved = false;
  private shownAtMs = 0;
  private dismiss: (() => void) | null = null;

  constructor() {
    super({ key: 'ModalScene' });
  }

  init(data: ModalAdInit): void {
    this.cfg = data;
    this.resolved = false;
    this.shownAtMs = 0;
    this.dismiss = null;
  }

  create(): void {
    this.shownAtMs = Date.now();
    Analytics.track('ad_modal_shown', { placement: this.cfg.placement ?? 'unknown' });

    const border = this.cfg.borderColor ?? DEFAULT_BORDER;
    const variant = variantForBorder(border);

    const panel = el('div', `nfr-panel ${variant} nfr-ad-modal`);

    const title = el('h2', 'nfr-panel__title');
    title.textContent = this.cfg.title;
    panel.appendChild(title);

    const body = el('p', 'nfr-panel__body');
    body.textContent = this.cfg.description;
    panel.appendChild(body);

    const footer = el('div', 'nfr-panel__footer');
    const declineLabel = this.cfg.declineLabel ?? Strings.adDeclineButton;
    const acceptLabel = this.cfg.acceptLabel ?? Strings.adWatchButton;
    footer.appendChild(btn(declineLabel, 'cyan', () => {
      sfxUiClick();
      this.finish(false);
    }, { size: 'lg' }));
    footer.appendChild(btn(acceptLabel, variant, () => {
      sfxUiClick();
      this.finish(true);
    }, { size: 'lg' }));
    panel.appendChild(footer);

    this.dismiss = UIOverlay.mountModal(this, panel, {
      dismissOnBackdrop: false,
    });
  }

  private finish(accepted: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    Analytics.track(accepted ? 'ad_modal_accepted' : 'ad_modal_declined', {
      placement: this.cfg.placement ?? 'unknown',
      timeToDecideMs: this.shownAtMs > 0 ? Date.now() - this.shownAtMs : 0,
    });
    this.dismiss?.();
    this.dismiss = null;
    const cb = this.cfg.onResult;
    this.scene.stop();
    cb(accepted);
  }
}
