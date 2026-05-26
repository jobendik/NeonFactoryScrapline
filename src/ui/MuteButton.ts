import type Phaser from 'phaser';
import { AudioBus } from '../audio/AudioBus';
import { UIOverlay, el } from './overlay/UIOverlay';

// Small circular mute toggle that lives in the top-right of the HUD. Click /
// tap flips AudioBus.muted; the icon redraws to match. HTML+SVG so it
// matches the rest of the chrome instead of relying on Phaser graphics.

const SVG_NS = 'http://www.w3.org/2000/svg';

export class MuteButton {
  private btn: HTMLButtonElement;
  private waves: SVGGElement;
  private slash: SVGLineElement;

  constructor(scene: Phaser.Scene) {
    this.btn = el('button', 'nfr-hud-iconbtn nfr-hud-mute') as HTMLButtonElement;
    this.btn.type = 'button';
    this.btn.setAttribute('aria-label', 'Mute');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-11 -11 22 22');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', '0');
    ring.setAttribute('cy', '0');
    ring.setAttribute('r', '9');
    ring.setAttribute('fill', '#101820');
    ring.setAttribute('fill-opacity', '0.85');
    ring.setAttribute('stroke', '#ffffff');
    ring.setAttribute('stroke-width', '1.5');
    ring.setAttribute('stroke-opacity', '0.85');
    svg.appendChild(ring);

    // Speaker glyph: body rect + cone polygon. Mirrors the prior canvas
    // triangles so the silhouette doesn't shift between releases.
    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', '-7');
    body.setAttribute('y', '-3');
    body.setAttribute('width', '4');
    body.setAttribute('height', '6');
    body.setAttribute('fill', '#ffffff');
    svg.appendChild(body);
    const cone = document.createElementNS(SVG_NS, 'polygon');
    cone.setAttribute('points', '-3,-5 -3,5 3,7 3,-7');
    cone.setAttribute('fill', '#ffffff');
    svg.appendChild(cone);

    // Sound waves shown when audio is on.
    this.waves = document.createElementNS(SVG_NS, 'g');
    const arc1 = document.createElementNS(SVG_NS, 'path');
    arc1.setAttribute('d', 'M 4.5 -2.6 A 3 3 0 0 1 4.5 2.6');
    arc1.setAttribute('fill', 'none');
    arc1.setAttribute('stroke', '#ffffff');
    arc1.setAttribute('stroke-width', '1.5');
    arc1.setAttribute('stroke-opacity', '0.85');
    arc1.setAttribute('stroke-linecap', 'round');
    this.waves.appendChild(arc1);
    const arc2 = document.createElementNS(SVG_NS, 'path');
    arc2.setAttribute('d', 'M 6 -5.2 A 6 6 0 0 1 6 5.2');
    arc2.setAttribute('fill', 'none');
    arc2.setAttribute('stroke', '#ffffff');
    arc2.setAttribute('stroke-width', '1.5');
    arc2.setAttribute('stroke-opacity', '0.85');
    arc2.setAttribute('stroke-linecap', 'round');
    this.waves.appendChild(arc2);
    svg.appendChild(this.waves);

    // Diagonal slash overlay shown only when muted.
    this.slash = document.createElementNS(SVG_NS, 'line');
    this.slash.setAttribute('x1', '-9');
    this.slash.setAttribute('y1', '-9');
    this.slash.setAttribute('x2', '9');
    this.slash.setAttribute('y2', '9');
    this.slash.setAttribute('stroke', '#ff416b');
    this.slash.setAttribute('stroke-width', '2');
    this.slash.setAttribute('stroke-linecap', 'round');
    svg.appendChild(this.slash);

    this.btn.appendChild(svg);
    this.btn.addEventListener('click', () => {
      AudioBus.toggleMute();
      this.redraw();
    });

    UIOverlay.mountHud(scene, this.btn);
    this.redraw();
  }

  redraw(): void {
    const muted = AudioBus.isMuted();
    this.waves.style.display = muted ? 'none' : '';
    this.slash.style.display = muted ? '' : 'none';
  }

  destroy(): void {
    this.btn.remove();
  }
}
