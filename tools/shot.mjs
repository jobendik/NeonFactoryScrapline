// Art-iteration screenshot harness. Boots the game in headless chromium,
// forces the garden hub (FactoryScene), and saves a PNG so I can actually
// look at the art while redesigning. Usage: node tools/shot.mjs <out.png> [scene]
import { chromium } from 'playwright';

const out = process.argv[2] || 'shot.png';
const wantScene = process.argv[3] || 'FactoryScene';
const URL = process.env.SHOT_URL || 'http://localhost:5173/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'load' });

// Wait for the save layer, mark the tutorial done so we boot into the hub.
await page.waitForFunction(() => !!window.__saveSystem, null, { timeout: 20000 });
await page.evaluate(async () => {
  const s = window.__saveSystem;
  s.get().tutorialDone = true;
  await s.persist();
});
await page.reload({ waitUntil: 'load' });

// Land on the hub first.
await page.waitForFunction(
  () => !!window.__game && window.__game.scene.isActive('FactoryScene'),
  null,
  { timeout: 20000 },
).catch(() => {});

// If a different scene was requested, drive into it via the dev hook.
if (wantScene !== 'FactoryScene') {
  await page.waitForTimeout(600);
  await page.evaluate((scene) => {
    const g = window.__game;
    g.scene.stop('FactoryScene');
    g.scene.start(scene, { tutorial: false, mode: 'normal' });
  }, wantScene);
  await page.waitForFunction(
    (scene) => !!window.__game && window.__game.scene.isActive(scene),
    wantScene,
    { timeout: 20000 },
  ).catch(() => {});
  // Let a few enemies spawn so the combat scene is representative.
  await page.waitForTimeout(8000);
} else {
  await page.waitForTimeout(2500);
}

// Art-preview: lay out all textures matching a prefix as fixed on-screen
// images so entity art can be inspected even when instances are off-camera.
if (process.env.SHOT_PREVIEW) {
  const prefix = process.env.SHOT_PREVIEW;
  await page.evaluate(({ scene, prefix }) => {
    const s = window.__game.scene.getScene(scene);
    const keys = s.textures.getTextureKeys().filter(k => k.startsWith(prefix));
    keys.forEach((k, i) => {
      const x = 160 + (i % 5) * 280;
      const y = 220 + Math.floor(i / 5) * 240;
      s.add.image(x, y, k).setScrollFactor(0).setDepth(9000).setScale(2.2);
      const t = s.add.text(x, y + 80, k, { fontFamily: 'sans-serif', fontSize: '20px', color: '#fff' });
      t.setOrigin(0.5, 0).setScrollFactor(0).setDepth(9001);
    });
  }, { scene: wantScene, prefix });
  await page.waitForTimeout(500);
}

if (wantScene === 'RaidScene') {
  const info = await page.evaluate(() => {
    const s = window.__game.scene.getScene('RaidScene');
    const grp = s && s.enemies;
    const kids = grp ? grp.getChildren().filter(e => e.active) : [];
    return {
      count: kids.length,
      sample: kids.slice(0, 6).map(e => ({ k: e.kind, x: Math.round(e.x), y: Math.round(e.y), tex: e.texture && e.texture.key })),
    };
  }).catch(e => ({ err: String(e) }));
  console.log('enemies:', JSON.stringify(info));
}

await page.screenshot({ path: out });
console.log('saved', out);
if (errors.length) {
  console.log('--- console errors (' + errors.length + ') ---');
  for (const e of errors.slice(0, 15)) console.log(e);
}
await browser.close();
