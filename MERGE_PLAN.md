# Merge Plan

Working project: workspace root

## Keep As Base

- Phaser + Vite + TypeScript application shell.
- Boot, preload, raid, factory, HUD, summary, modal flow.
- Existing top-down auto-shooter, extraction, greed, pickups, powerups, waves, factory hub, upgrades, save/migration, SDK bridge, ads fallback, dailies, missions, achievements, infestation, autosave, quality controls, and audio bus.

## Adapt From Scrapline

- Tiered material identity: alloy/circuits inspired by Scrapline's raw-product ladder.
- Zone progression: selectable raid zones with unlock gates, material yield, scrap multiplier, and threat scaling.
- Factory/idle ideas: material-funded refinery upgrades for processing efficiency, drone dispatching, offline relay, and infestation shielding.
- Contract clarity: keep Neon MissionBoard runtime, but add zone/material objectives and rewards.
- Safe storage idea: keep Neon SDK bridge, add a local in-memory fallback when localStorage is unavailable.

## Remove Or Postpone

- Remove 3D/FPS Scrapyard from launch path and build/typecheck scope.
- Remove unnecessary Three.js dependency after Scrapyard is disabled.
- Hide/postpone the season pass panel and XP awarding for the first merged launch.
- Keep cosmetics as low-priority settings-only scaffolding; do not expand shop/premium currency.

## Current Status

- Active launch path is a single Phaser top-down raid/factory loop.
- Scrapyard/FPS source files, Three.js dependency, and Scrapyard save/UI hooks are removed from the merged project.
- Season pass source/UI/reward hooks are removed from the first launch path.
- Premium-token store and wallet scaffolding are removed from the first launch path so early UI stays focused.
- TypeScript no longer needs build exclusions for postponed modes.

## Phases

1. Disable Scrapyard/FPS path and update dependencies/build config. Done.
2. Add merged zone/material save fields, migrations, and systems.
3. Wire zone selection into FactoryScene and zone tuning/material payout into RaidScene/SummaryScene.
4. Add Scrapline-inspired material-funded refinery upgrades and mission objectives.
5. Typecheck/build, then fix any regressions.
