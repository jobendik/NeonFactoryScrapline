# 🌙 Starfall Garden — The Road Ahead

A handoff / status doc: what the game **was**, what's been **done** so far, the
**current state**, and a prioritized plan for **where to go next**.

---

## 1. Where we started

The project shipped as **"Neon Factory Scrap Raid"** — a top-down extraction
auto-shooter (raids) bolted onto an idle **scrap factory** base-builder, in a
cold cyberpunk/industrial neon style (dark blueprint floors, conveyor belts,
smelters, drones, a wedge spaceship, chamfered "combat HUD" UI).

The brief: keep the (genuinely good) game systems, but **completely transform**
it into **Starfall Garden** — a cozy, bright, kid-friendly *magical night-garden
/ potion-academy* game. Fly out on moonlit night flights, gather stardust & star
hearts, then grow and enchant a living garden back home.

---

## 2. What's been done

### A. Full thematic re-skin (player-facing)
- **Every player-facing string** rewritten (`src/config/Strings.ts` values only —
  keys kept stable for save/UI safety) plus all hardcoded text across scenes,
  UI panels, and config/system display names (upgrades, power-ups → charms,
  cosmetics, daily modifiers, zones, drone missions, achievements, XP ranks,
  research, refinery, retention nudges, weekly boss).
- **Vocabulary map:** factory→garden, scrap→**Stardust**, cores→**Star Hearts**,
  drones→**fireflies**, workers→**pixies**, ship→**moon glider**, raid→**night
  flight**, extraction→**Moongate**, greed→**Glimmer**, smelter→**Cauldron**,
  generator→**Moonwell**, refinery→**Moon Altar**, mission board→**Wish Board**,
  prestige→**New Moon**, operators→**Companions**, materials→**Petals/Essence**,
  Signal Hydra→**Eclipse Spirit**.
- **Localization** (no/es/pt/de/fr) updated for the high-visibility strings.
- Title, favicon (🌙), preloader copy, README, package name, blueprint headline.

### B. Palette & type
- Global shift from neon cyan/violet on near-black → **moon-blue `#7cc9ff`,
  lavender `#b98cff`, star-gold, bloom-green, rose**, over brighter backgrounds.
- Fonts: Orbitron/Rajdhani (sci-fi) → **Quicksand / Nunito** (soft, cozy).

### C. Art-direction overhaul (the big one)
Recoloring wasn't enough — the *procedurally-drawn shapes themselves* were the
problem. So the visuals were **redrawn**, verified with screenshots:

- **Garden hub** (`FactoryScene`): bright **moonlit-lawn** background (flat,
  seamless tile + dapples + grass tufts + flowers), the blueprint grid/hazard
  stripes/rivets removed; **hand-placed sprite decor** (trees with blossoms,
  bushes, flower clumps, a pond with lily pads, mushrooms, lanterns) via
  `FactoryScene.ensureDecorTextures()`; a bright **glossy purple cauldron**
  centerpiece; faint soft stardust trails (was glowing conveyor wires);
  **drifting fireflies**; and a **"Cozy Candy" CSS layer** (rounded pastel
  pills, soft shadows) appended to `neon-ui.css`.
- **Night-flight / raid** (`RaidScene`): dreamy **bright twilight sky** with a
  big **friendly moon** (`NeonFX.ensureMoon`), drifting cloud wisps + stars, no
  tech grid; brightened per-zone sky palettes; soft rounded border; light
  vignette. **Enemies got cute faces** (big eyes + rosy cheeks) while keeping
  per-kind shapes for gameplay readability.
- **Player** is a leaf-glider; **moonwell** = glowing well + spinning flower-rune.

### D. Tooling added (kept in repo)
- `tools/shot.mjs` + a dev-only **Playwright** dependency: headless screenshots
  of the running dev server so the look can be **verified instead of shipped
  blind**. Supports `SHOT_PREVIEW=enemy-` to lay out textures on screen.
- A **dev-only** hook in `main.ts` (`import.meta.env.DEV`, **stripped from prod
  builds**) exposes `window.__game` / `__saveSystem` so the harness can force
  `tutorialDone` and land on any scene.
- Run: `npx vite --port 5180 --strictPort`, then
  `SHOT_URL=http://localhost:5180/ node tools/shot.mjs out.png FactoryScene`.

### E. Deliberately NOT changed (kept for safety)
Internal identifiers stay on the old names so saves and code keep working:
file/module names (`ScraplineDefs.ts`, `NeonFX.ts`, `FactoryScene`,
`FactoryWorker`, `Drone`, `Smelter`), string IDs/keys (`'scrap'`/`'core'`,
scene keys, save keys `nfr:*`, texture keys, event names, zone ids), and all
`Strings`/`Balance` keys. Internal dev docs (`blueprint.md`, `MERGE_PLAN.md`)
still describe the old theme by design.

---

## 3. Current state

- ✅ `tsc --noEmit` + `vite build` pass cleanly; no console errors on boot.
- ✅ Saves remain compatible (only values/visuals changed, not keys).
- ✅ Hub and raid both read as a cozy cartoon garden game (verified by screenshot).
- ✅ Music is now **file-based streamed tracks** (`src/audio/music.ts`): the
  Suno loops in `public/assets/audio/` (theme / hub / flight cruise⇄intense)
  play through `AudioBus` with cross-fades; the old synth is gone.
- ✅ SFX have had the **cozy/magical pass** (`src/audio/sfx.ts`): re-voiced on
  bell/chime + airy-lowpass + pentatonic primitives (no more harsh square/saw
  blips), and a new level-up "bloom" is wired. Still synthesized (no samples),
  so zero asset weight. Smoke-tested via `tools/audio-smoke.mjs`.
- ✅ The in-raid HUD, pickups, and entity silhouettes have had the candy/juice
  pass: cute pickup sprites, critter-styled enemies, banish blooms + collect
  pops + squash-stretch, cauldron bubbling + moonwell shimmer, a candy HUD, and
  a cozy preloader. (See Phase 2/3 below.)
- ✅ A rotate-to-landscape nudge covers portrait touch devices; the game scales
  cleanly via Phaser `Scale.FIT`.

---

## 4. The road ahead (prioritized)

### Phase 1 — Audio ✅ DONE
1. ✅ **Music.** The Suno loops landed in `public/assets/audio/` and
   `MusicEngine` is now a **file-based player** (loop + cross-fade through
   `AudioBus`): theme, garden hub, and the night-flight cruise⇄intense blend
   (driven by `setIntensity`) are all wired. Missing files fail silent rather
   than crashing. *(Boss/extra stings can reuse these layers for now.)*
2. ✅ **SFX pass.** Re-voiced the whole synth library to cozy/magical timbres
   in `src/audio/sfx.ts` — bell/chime partials, airy lowpass "poofs", smooth
   sine glides, and a C-pentatonic palette so rapid sounds (cast, pickups)
   harmonize. Stardust pickups climb a pentatonic ladder; critters banish with
   a friendly "boop"; the moongate hums; a new **level-up bloom** (`sfxLevelUp`)
   is wired to `ACCOUNT_LEVEL_UP`. Still 100% synthesized (no sample weight).
   Verify with `tools/audio-smoke.mjs`.

### Phase 2 — Finish the art polish ✅ DONE
3. ✅ **In-raid HUD → candy.** Extended the Cozy Candy CSS layer: HP bar is now
   a rounded "heart" bar (♥ glyph, mint-green→rose fill), charm pips are candy
   chips, the STARDUST/HEARTS wallet are rounded counter pills, timer + XP are
   soft pills — all on the shared candy-glass surface.
4. ✅ **Pickups.** `Pickup.ts` redrawn: stardust is a blue 4-point twinkle star,
   the Star Heart is a glossy gold/rose heart gem (collision circle re-centred
   per frame). Preview with `tools/sprites.mjs`.
5. ✅ **Enemy silhouettes.** Kept the per-kind shapes for readability but added
   soft fairy wings + antennae-with-bobbles behind every body, so they read as
   critters alongside the existing faces.
6. ✅ **Juice.** Critter idle squash-stretch + hit pop; banish bloom (petal poof
   + sparkle burst); pickup collect pop; cauldron bubble emitter; moonwell pool
   shimmer. All respect `QualityManager` reduced-motion + particle caps.
7. ✅ **Moonwells / cauldron** second look (bubbles + shimmer added). The leaf
   **glider** already reads well on the bright palette; left as-is.

### Phase 3 — Onboarding & feel
8. ☑️ **Tutorial / first 30 seconds** — already implemented and verified to boot
   clean: an initial stardust pile spawns beside the player, timed captions
   walk MOVE → DASH → DASH = SAFE → POWER UP → FLY HOME, there's a safety-net HP
   floor + reduced spawns, and a single-button "GROW" summary. Copy is terse by
   design; reword only if playtests show confusion.
9. ✅ **First-5-seconds appeal.** Reskinned the loading screen (`index.html`) to
   a cozy preloader: 🌙 Starfall Garden + tagline, ✦ sparkle bullets, a rounded
   candy progress bar, drifting twinkles. A full title/menu beat was
   deliberately skipped — instant-play boot is better for CrazyGames.

### Phase 4 — Balance & retention  *(needs playtesting — left intentionally)*
10. ⏳ Re-tune the economy for the cozy audience. **Not changed blind:** the
    levers (`Balance.ts`, `Balance.tutorial`) are subjective and easy to break
    without play sessions. Do this with real playtest data, not guesswork.
11. ⏳ Sanity-check the retention loop. Same caveat — a review/tuning task best
    done against live session metrics.

### Phase 5 — Ship readiness (CrazyGames)
12. ✅ **Mobile pass.** `Scale.FIT` scales the stage to any screen + the HTML HUD
    anchors to the canvas; added a portrait rotate-to-landscape nudge for touch.
    Touch controls (`VirtualJoystick`) already exist. Verified readable at
    landscape phone sizes.
13. ⏳ **Performance.** Juice goes through `QualityManager` caps and pooled
    emitters; bundle is ~1.5 MB (gzip ~340 KB). A real 60-FPS profile needs a
    GPU device (the headless harness reports unrepresentative FPS), so left for
    on-device profiling.
14. ☑️ **CrazyGames checklist.** SDK lifecycle (`SDKBridge`), themed rewarded
    ads, and the loading watchdog were already in place; **fixed a boot-time
    console crash** in `Analytics.trackError` (undefined error → no longer
    throws). Fullscreen + a strong thumbnail remain platform-side tasks.
15. ☑️ **QA.** Smoke-verified: fresh-player tutorial boot, returning-player hub,
    and an 8s combat run all render with **no JS console errors**; audio graph
    smoke passes. A full human playthrough + old-save migration check still
    wanted before launch.

### Phase 6 — Optional / longer-term
16. **Real illustrated assets**: the biggest remaining quality ceiling. Swap the
    code-drawn (canvas/SVG) art for hand-illustrated PNG/SVG sprites + backgrounds
    if budget allows — the rendering layer is already isolated, so this is a
    drop-in upgrade, not a rewrite.
17. **Code hygiene**: optionally rename the legacy internal modules
    (`ScraplineDefs`, `NeonFX`, `FactoryScene`, etc.) to themed names in one
    careful PR with a save-key audit.
18. **Content**: more glades, companions, charms, seasonal events, a cosmetic
    shop — the systems already support expansion.

---

## 5. Notes & risks

- **Hard-reload to see art changes** — Phaser caches textures per page session;
  plain HMR keeps stale art. Use `Ctrl+Shift+R` or restart the dev server.
- **Headless screenshots** don't render `RenderTexture`-baked content (the
  framebuffer is unsupported in the harness's GPU), which is why all decor was
  moved to plain **sprites**. Keep new world art as sprites/images, not RTs, so
  it's both verifiable and universally rendered.
- **Don't rename internal keys casually** — save data, scene routing, event bus,
  and texture lookups depend on the legacy string IDs. Player-facing text is the
  layer that's safe to change.
- The **mechanics are solid and working** — there is no reason to start the
  codebase from scratch; the remaining work is presentation (art/audio/feel),
  tuning, and ship-readiness.
- **Verification tooling** (all honor `PW_CHROME` for a system chromium when
  Playwright can't download one):
  - `tools/shot.mjs out.png <Scene>` — scene screenshots (`SHOT_PREVIEW=` to lay
    textures out; `VIEWPORT_W/H` for responsive shots).
  - `tools/sprites.mjs out.png pickup-,enemy-` — previews lazily-created entity
    textures by importing the real modules via the vite dev server.
  - `tools/audio-smoke.mjs` — calls every `sfx*` function against a live Web
    Audio graph in headless chromium to catch synthesis regressions.
