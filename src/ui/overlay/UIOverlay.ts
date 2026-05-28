// HTML overlay system layered on top of the Phaser canvas.
//
// Phaser draws gameplay (canvas-based for performance), but every menu, panel,
// card grid, and HUD readout is HTML+CSS — drop shadows, gradients, real fonts,
// backdrop blur, and CSS animations are essentially free in the DOM and look
// dramatically better than primitives drawn into a 2D canvas at small sizes.
//
// Lifecycle:
//   1. main.ts calls UIOverlay.install(game) after the Phaser.Game boots. That
//      mounts a single fixed-position <div id="nfr-overlay"> as a sibling of
//      the canvas and starts listening to scale events so the overlay tracks
//      the canvas's letterboxed bounds.
//   2. Scenes call UIOverlay.mountPanel(...) etc. to attach HTML elements.
//   3. When a modal mounts, Phaser pointer input is paused on the active
//      scene so HUD clicks under the overlay don't fall through.
//
// All overlay coordinates are CSS pixels relative to the canvas's screen
// position — the .nfr-stage element is sized + positioned to match the canvas,
// so a child at left: 50%, top: 50% sits at the canvas center even when the
// browser is letterboxing.

import Phaser from 'phaser';
import '../styles/neon-ui.css';

export type DismissFn = () => void;

interface ScopedScene {
  scene: Phaser.Scene;
  // The set of root elements (panels/HUD widgets) owned by this scope so we
  // can tear them down when the scene shuts down.
  nodes: Set<HTMLElement>;
}

class UIOverlayImpl {
  private root: HTMLElement | null = null;
  private stage: HTMLElement | null = null;
  private game: Phaser.Game | null = null;
  private modalCount = 0;
  // Map scene-key → ScopedScene so a scene's UI is dismissed on shutdown.
  private scopes = new Map<string, ScopedScene>();

  install(game: Phaser.Game): void {
    if (this.root) return;
    this.game = game;

    const root = document.createElement('div');
    root.className = 'nfr-overlay';
    root.id = 'nfr-overlay';
    const stage = document.createElement('div');
    stage.className = 'nfr-stage';
    root.appendChild(stage);
    document.body.appendChild(root);
    this.root = root;
    this.stage = stage;

    // Track canvas bounds — Phaser.Scale.FIT may letterbox, so our overlay
    // needs to match the canvas's actual screen rect, not the viewport.
    const sync = (): void => this.syncBounds();
    game.scale.on(Phaser.Scale.Events.RESIZE, sync);
    window.addEventListener('resize', sync);
    // First sync runs synchronously so the first mounted overlay already
    // has correct coordinates.
    sync();
    // Sync again on the next frame in case the canvas hasn't been styled yet.
    requestAnimationFrame(sync);
  }

  private syncBounds(): void {
    if (!this.stage || !this.game) return;
    const canvas = this.game.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.stage.style.setProperty('--nfr-canvas-x', `${rect.left}px`);
    this.stage.style.setProperty('--nfr-canvas-y', `${rect.top}px`);
    this.stage.style.setProperty('--nfr-canvas-w', `${rect.width}px`);
    this.stage.style.setProperty('--nfr-canvas-h', `${rect.height}px`);
    // Scale factor relative to the design resolution. Children that want
    // to scale fluidly can read --nfr-scale via CSS calc().
    const designW = this.game.scale.width;
    if (designW > 0) {
      this.stage.style.setProperty('--nfr-scale', `${rect.width / designW}`);
    }
  }

  /**
   * Mounts a modal panel that overlays the canvas. Returns a dismiss fn.
   *
   * The panel is appended to a backdrop element that intercepts pointer
   * events and (per `dismissOnBackdrop`) dismisses the panel on background
   * click. Phaser pointer input is paused on the scene while any modal is
   * open so the player can't click through to gameplay.
   */
  mountModal(
    scene: Phaser.Scene,
    panel: HTMLElement,
    opts: { dismissOnBackdrop?: boolean; onDismiss?: DismissFn } = {},
  ): DismissFn {
    if (!this.stage) return () => undefined;
    const backdrop = document.createElement('div');
    backdrop.className = 'nfr-backdrop';
    backdrop.appendChild(panel);
    this.stage.appendChild(backdrop);

    let dismissed = false;
    const dismiss: DismissFn = () => {
      if (dismissed) return;
      dismissed = true;
      backdrop.style.animation = 'nfr-fade-out 180ms ease-out forwards';
      window.setTimeout(() => {
        backdrop.remove();
        this.scopes.get(scene.scene.key)?.nodes.delete(backdrop);
        this.modalCount = Math.max(0, this.modalCount - 1);
        if (this.modalCount === 0) this.restoreSceneInput(scene);
        // Guard against stale callbacks: if the scene has already shut down
        // and transitioned away, skip onDismiss to prevent it from mounting
        // new DOM elements on a dead scene.
        if (scene.scene.isActive()) opts.onDismiss?.();
      }, 180);
    };

    if (opts.dismissOnBackdrop !== false) {
      backdrop.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.target === backdrop) dismiss();
      });
    }
    // Stop event propagation INSIDE the panel — without this, a click on a
    // panel button would also trigger the backdrop dismiss.
    panel.addEventListener('pointerdown', e => e.stopPropagation());

    this.modalCount += 1;
    this.pauseSceneInput(scene);
    this.track(scene, backdrop);
    return dismiss;
  }

  /**
   * Mounts a non-modal HUD element (HP bar, sidebar, etc.). It is appended
   * directly to the stage and does NOT pause Phaser input. The caller is
   * responsible for calling the returned dismiss fn — or letting scene
   * shutdown tear it down automatically.
   */
  mountHud(scene: Phaser.Scene, el: HTMLElement): DismissFn {
    if (!this.stage) return () => undefined;
    this.stage.appendChild(el);
    this.track(scene, el);
    return () => {
      el.remove();
      this.scopes.get(scene.scene.key)?.nodes.delete(el);
    };
  }

  /**
   * Per-scope cleanup — call from scene `shutdown` to tear down any leftover
   * overlay nodes from that scene. Idempotent.
   */
  clearScene(scene: Phaser.Scene): void {
    const key = scene.scene.key;
    const scope = this.scopes.get(key);
    if (!scope) return;
    for (const node of scope.nodes) node.remove();
    scope.nodes.clear();
    // Delete the scope entry so that when the scene boots again, track()
    // creates a fresh scope and re-registers the SHUTDOWN listener. Without
    // this, the second+ boot never gets a listener and leaked nodes persist.
    this.scopes.delete(key);
    // If this scene had modals open, restore input on it so the next time it
    // boots, gameplay input is alive.
    this.restoreSceneInput(scene);
  }

  private track(scene: Phaser.Scene, node: HTMLElement): void {
    const key = scene.scene.key;
    let scope = this.scopes.get(key);
    if (!scope) {
      scope = { scene, nodes: new Set() };
      this.scopes.set(key, scope);
      // Wire shutdown once per scope. Phaser fires SHUTDOWN both on
      // explicit scene.stop() and when scene.start() replaces this scene.
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clearScene(scene));
      scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearScene(scene));
    }
    scope.nodes.add(node);
  }

  private pauseSceneInput(scene: Phaser.Scene): void {
    // Disable Phaser pointer routing while modals are up. Without this, a
    // click on a panel button still propagates a pointerdown to Phaser game
    // objects under the modal (since the canvas is a sibling, not a child).
    if (scene.input) scene.input.enabled = false;
  }

  private restoreSceneInput(scene: Phaser.Scene): void {
    if (scene.input) scene.input.enabled = true;
  }
}

export const UIOverlay = new UIOverlayImpl();

// ----- Small DOM helpers used by panel builders --------------------------

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function svgIcon(svgMarkup: string): HTMLElement {
  // Wrap raw SVG string in a span so we can apply CSS color/filter via
  // currentColor on the svg's stroke/fill. The markup MUST use stroke or
  // fill = "currentColor" for theming to work.
  const wrap = document.createElement('span');
  wrap.innerHTML = svgMarkup;
  return wrap;
}

export function btn(
  label: string,
  variant: 'cyan' | 'violet' | 'gold' | 'green' | 'red' = 'cyan',
  onClick?: () => void,
  opts: { disabled?: boolean; size?: 'sm' | 'md' | 'lg' } = {},
): HTMLButtonElement {
  const b = document.createElement('button');
  let cls = 'nfr-btn';
  if (variant !== 'cyan') cls += ` ${variant}`;
  if (opts.size === 'sm') cls += ' nfr-btn--sm';
  if (opts.size === 'lg') cls += ' nfr-btn--lg';
  if (opts.disabled) cls += ' is-disabled';
  b.className = cls;
  b.textContent = label;
  b.type = 'button';
  if (opts.disabled) {
    b.setAttribute('aria-disabled', 'true');
    b.disabled = true;
  } else if (onClick) {
    b.addEventListener('click', onClick);
  }
  return b;
}
