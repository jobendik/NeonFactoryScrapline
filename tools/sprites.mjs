// Sprite-preview harness — companion to tools/shot.mjs for inspecting the
// procedurally-drawn entity textures (pickups, enemies) that are otherwise
// created lazily only once an instance spawns. It boots the game, imports the
// real entity modules via the vite dev server (so it draws with the exact
// shipping code), calls their static ensureTextures() on the live scene, then
// lays every matching texture out on a dark backdrop and screenshots it.
//
// Usage:
//   npx vite --port 5180 --strictPort
//   SHOT_URL=http://localhost:5180/ node tools/sprites.mjs out.png pickup-,enemy-
//
// Set PW_CHROME to a chromium executable if Playwright's bundled browser
// isn't installed.
import { chromium } from 'playwright';

const out = process.argv[2] || 'sprites.png';
const prefixes = (process.argv[3] || 'pickup-,enemy-').split(',');
const URL = process.env.SHOT_URL || 'http://localhost:5173/';

const launchOpts = {};
if (process.env.PW_CHROME) launchOpts.executablePath = process.env.PW_CHROME;
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__saveSystem, null, { timeout: 20000 });
await page.evaluate(async () => {
  const s = window.__saveSystem;
  s.get().tutorialDone = true;
  await s.persist();
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(
  () => !!window.__game && window.__game.scene.isActive('FactoryScene'),
  null,
  { timeout: 20000 },
).catch(() => {});
await page.waitForTimeout(800);

const info = await page.evaluate(async ({ prefixes }) => {
  const scene = window.__game.scene.getScene('FactoryScene');
  // Import the real entity modules (vite transpiles TS) and build their
  // textures with the shipping code.
  for (const path of ['/src/entities/Pickup.ts', '/src/entities/Enemy.ts']) {
    try {
      const mod = await import(path);
      for (const exp of Object.values(mod)) {
        if (exp && typeof exp.ensureTextures === 'function') exp.ensureTextures(scene);
      }
    } catch (e) { /* ignore */ }
  }
  // Dark backdrop so glows read clearly.
  const bg = scene.add.rectangle(640, 360, 1280, 720, 0x161427).setScrollFactor(0).setDepth(8000);
  bg.setOrigin(0.5);
  // Hide the HTML UI overlay (hub panels live in the DOM, above the canvas)
  // so previewed sprites aren't obscured.
  document.querySelectorAll('.nfr-overlay-root, #nfr-overlay, .nfr-hud-root').forEach(el => {
    el.style.display = 'none';
  });
  const keys = scene.textures.getTextureKeys().filter(k => prefixes.some(p => k.startsWith(p)));
  keys.sort();
  const cols = Math.min(5, keys.length);
  const cellW = 240;
  const cellH = 220;
  const startX = 640 - ((cols - 1) * cellW) / 2;
  const rows = Math.ceil(keys.length / cols);
  const startY = 360 - ((rows - 1) * cellH) / 2;
  keys.forEach((k, i) => {
    const x = startX + (i % cols) * cellW;
    const y = startY + Math.floor(i / cols) * cellH;
    scene.add.image(x, y, k).setScrollFactor(0).setDepth(9000).setScale(4);
    const t = scene.add.text(x, y + 80, k, { fontFamily: 'sans-serif', fontSize: '18px', color: '#fff' });
    t.setOrigin(0.5, 0).setScrollFactor(0).setDepth(9001);
  });
  return { keys };
}, { prefixes });

await page.waitForTimeout(400);
await page.screenshot({ path: out });
console.log('saved', out, '— textures:', info.keys.join(', '));
await browser.close();
