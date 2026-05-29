// Audio smoke test — companion to tools/shot.mjs for the (otherwise
// invisible) audio layer. Boots the dev server in headless chromium,
// instruments the Web Audio node graph, imports the live (vite-transpiled)
// sfx module, and calls every exported sfx* function to confirm the synthesis
// builds a valid graph without throwing. Catches regressions like a bad
// envelope ramp (exponentialRamp to 0) or a broken connect() chain that a
// type-check can't see.
//
// Usage:
//   npx vite --port 5180 --strictPort      # in one terminal
//   SHOT_URL=http://localhost:5180/ node tools/audio-smoke.mjs
//
// Set PW_CHROME to a chromium executable if Playwright's bundled browser
// isn't installed (e.g. a sandbox without browser download access).
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:5173/';
const launchOpts = { args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.PW_CHROME) launchOpts.executablePath = process.env.PW_CHROME;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'load' });
// A real user gesture so the AudioContext can leave "suspended".
await page.mouse.click(10, 10).catch(() => {});

const result = await page.evaluate(async () => {
  // Count node creation on every AudioContext so we can prove the synthesis
  // code actually ran (rather than short-circuiting on a null bus).
  const counters = { osc: 0, gain: 0, buf: 0, filter: 0 };
  for (const C of [window.AudioContext, window.webkitAudioContext]) {
    if (!C) continue;
    const p = C.prototype;
    const wrap = (name, key) => {
      const orig = p[name];
      if (!orig) return;
      p[name] = function (...a) { counters[key]++; return orig.apply(this, a); };
    };
    wrap('createOscillator', 'osc');
    wrap('createGain', 'gain');
    wrap('createBufferSource', 'buf');
    wrap('createBiquadFilter', 'filter');
  }

  const sfx = await import('/src/audio/sfx.ts');
  const names = Object.keys(sfx).filter(k => typeof sfx[k] === 'function' && k.startsWith('sfx'));
  const errors = {};
  for (const name of names) {
    try {
      sfx[name]();
    } catch (e) {
      errors[name] = String(e);
    }
  }
  // Fire the rapid-fire ones repeatedly to exercise the pentatonic ladder and
  // random-pitch branches that a single call wouldn't reach.
  try {
    for (let i = 0; i < 12; i++) { sfx.sfxShoot(); sfx.sfxScrap(); sfx.sfxEnemyHit(); }
  } catch (e) {
    errors['__rapid'] = String(e);
  }
  return { names, errors, counters };
});

await browser.close();

console.log('exported sfx functions tested:', result.names.length);
console.log('audio nodes created:', JSON.stringify(result.counters));
const errKeys = Object.keys(result.errors);
if (errKeys.length) {
  console.log('SFX ERRORS:');
  for (const k of errKeys) console.log('  ' + k + ': ' + result.errors[k]);
}
// ERR_CERT/network noise from blocked external resources isn't an audio
// failure; report page errors for visibility but don't fail on them.
if (pageErrors.length) {
  console.log('page errors (' + pageErrors.length + ', informational):');
  for (const e of pageErrors.slice(0, 20)) console.log('  ' + e);
}
const ok = errKeys.length === 0 && result.counters.osc > 0 && result.counters.gain > 0;
console.log(ok ? 'SMOKE: PASS' : 'SMOKE: FAIL');
process.exit(ok ? 0 : 1);
