// SVG icon library used by HTML overlay panels.
//
// All icons are drawn at 24×24 with `stroke="currentColor"` + `fill="none"`
// (or `fill="currentColor"` where solid is desired). The container's CSS color
// drives the rendered hue, so swapping rarity/upgrade color happens by class.
//
// The icons are picked to match the gameplay vocabulary:
//   - cards (Hardy, Quick Feet, Wide Magnet, Vampiric, Pierce, Shield, ...)
//   - upgrades (Generator, Drone, Speed, Magnet, Damage, Luck)
//   - currency (Scrap, Cores)

// Common SVG attributes — kept consistent so the icons feel like a set.
const SVG = (body: string): string =>
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// Map keyed by card slug — falls back to a generic mod icon when a card has no
// dedicated art. The IDs are matched lowercase, with non-alphanumerics stripped.
const CARD_ICONS: Record<string, string> = {
  // Common
  hardy:     SVG(`<path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>`),
  quickfeet: SVG(`<path d="M13 4 5 14h6l-1 6 8-10h-6l1-6z" fill="currentColor" stroke="none"/>`),
  widemagnet:SVG(`<path d="M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4z"/><path d="M5 4h4M15 4h4"/>`),
  brawler:   SVG(`<circle cx="12" cy="6" r="2.5"/><path d="M8 12c0-2 1.8-3 4-3s4 1 4 3v3H8z"/><path d="m8 15-2 5h12l-2-5"/>`),
  scavenger: SVG(`<path d="M4 10h16M6 10v9h12v-9M9 10V6l3-2 3 2v4"/><circle cx="12" cy="14" r="1.5"/>`),

  // Rare
  pierce:    SVG(`<path d="M3 12h18M14 6l6 6-6 6"/><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/>`),
  vampiric:  SVG(`<path d="M12 3s7 5 7 11a7 7 0 0 1-14 0c0-6 7-11 7-11z"/><path d="M9 13c.8 1.4 2 2 3 2"/>`),
  dashmaster:SVG(`<path d="m4 18 5-12h2l-1 5h4l-5 9h-2l1-2z" fill="currentColor" stroke="none"/>`),
  multishot: SVG(`<path d="M3 12h6M12 8l4 4-4 4M14 5h6M14 19h6"/>`),
  orbitalshield:SVG(`<circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="9" ry="3.2" transform="rotate(-20 12 12)"/>`),
  ricochet:  SVG(`<path d="M4 20 12 8l8 12M8 14l4 6 4-6"/>`),

  // Epic
  greedrush: SVG(`<path d="M12 3v18M5 8h11l3 3v3l-3 3H8l-3-3v-3z"/>`),
  phoenix:   SVG(`<path d="M12 3c-2 4-2 6 0 8s4 4 2 8c-1 2-3 2-4 0s0-3 1-4M12 11c2 2 4 4 4 7"/>`),
  apex:      SVG(`<path d="M4 20 12 4l8 16M8 16h8"/><circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none"/>`),
  overdrive: SVG(`<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 8v5l3 2"/><path d="M21 3v6h-6"/>`),
  freezepulse:SVG(`<path d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19"/>`),
  shieldbubble:SVG(`<path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z"/>`),
};

const GENERIC_CARD_ICON = SVG(
  `<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>`,
);

export function cardIcon(cardId: string): string {
  const slug = cardId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return CARD_ICONS[slug] ?? GENERIC_CARD_ICON;
}

// Upgrade sidebar icons (Generator, Drone, Speed, Magnet, Damage, Luck).
const UPGRADE_ICONS: Record<string, string> = {
  gen:    SVG(`<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>`),
  drone:  SVG(`<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="12" r="2.5"/><path d="M8 6h8M6 8v8M18 8v8M8 18h8"/>`),
  speed:  SVG(`<path d="M13 4 5 14h6l-1 6 8-10h-6l1-6z" fill="currentColor" stroke="none"/>`),
  magnet: SVG(`<path d="M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4z"/><path d="M5 4h4M15 4h4"/>`),
  damage: SVG(`<path d="M14.5 3 21 9.5 8.5 22 2 15.5z"/><path d="m13 7 4 4M5 17l2 2"/>`),
  luck:   SVG(`<path d="M12 4c-1.5 2-3 3-3 5 0 1.7 1.3 3 3 3s3-1.3 3-3c0-2-1.5-3-3-5z"/><path d="M5 14c-1 1.5-2 2.5-2 4 0 1.5 1.2 2 2 2s2-.5 2-2c0-1.5-1-2.5-2-4zM19 14c-1 1.5-2 2.5-2 4 0 1.5 1.2 2 2 2s2-.5 2-2c0-1.5-1-2.5-2-4z"/>`),
};

export function upgradeIcon(key: string): string {
  return UPGRADE_ICONS[key] ?? GENERIC_CARD_ICON;
}

// Currency icons used by the HUD wallet lines.
export const SCRAP_ICON = SVG(
  `<path d="M12 3 21 8v8l-9 5-9-5V8z"/><path d="m12 8 5 3-5 3-5-3z"/>`,
);
export const CORE_ICON = SVG(
  `<polygon points="12,3 21,8 21,16 12,21 3,16 3,8" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>`,
);
// Generic helpers exposed for ad-hoc icon usage.
export const ICON_LOCK    = SVG(`<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`);
export const ICON_CHECK   = SVG(`<path d="M5 12l5 5 9-11"/>`);
export const ICON_CLOSE   = SVG(`<path d="M6 6l12 12M18 6 6 18"/>`);
export const ICON_CHEVRON = SVG(`<path d="m9 6 6 6-6 6"/>`);
