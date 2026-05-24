# Neon Factory Raid — Master Blueprint

> **Single source of truth** for design, implementation, content, balance, monetization, and launch. Written so an AI or developer can read this document end-to-end and build the production version of the game without further clarification.

**Version**: 1.0 (Blueprint)
**Target platform**: CrazyGames (primary), other HTML5 portals (secondary)
**Document audience**: AI coding agents, game developers, designers, content creators
**Source of truth precedence**: This document overrides any earlier prototype assumptions.

---

## Table of Contents

1. [Vision and Pitch](#1-vision-and-pitch)
2. [Strategic Positioning](#2-strategic-positioning)
3. [Core Loop](#3-core-loop)
4. [The Differentiator: Factory At Stake](#4-the-differentiator-factory-at-stake)
5. [First-Time User Experience](#5-first-time-user-experience)
6. [Player Character and Controls](#6-player-character-and-controls)
7. [Raid Mode — Full Specification](#7-raid-mode--full-specification)
8. [Factory Mode — Full Specification](#8-factory-mode--full-specification)
9. [Economy and Currencies](#9-economy-and-currencies)
10. [Meta Progression](#10-meta-progression)
11. [Operator Roster](#11-operator-roster)
12. [In-Run Upgrade Drafting](#12-in-run-upgrade-drafting)
13. [Power-Ups Reference](#13-power-ups-reference)
14. [Enemy Reference](#14-enemy-reference)
15. [Maps and Arenas](#15-maps-and-arenas)
16. [Retention Systems](#16-retention-systems)
17. [Monetization](#17-monetization)
18. [CrazyGames SDK Integration](#18-crazygames-sdk-integration)
19. [Visual Design System](#19-visual-design-system)
20. [Audio Design](#20-audio-design)
21. [UI and HUD](#21-ui-and-hud)
22. [Technical Architecture](#22-technical-architecture)
23. [Balance Configuration](#23-balance-configuration)
24. [Performance and Quality Settings](#24-performance-and-quality-settings)
25. [Analytics](#25-analytics)
26. [Content Roadmap](#26-content-roadmap)
27. [Risks and Anti-Patterns](#27-risks-and-anti-patterns)
28. [Glossary](#28-glossary)

---

## 1. Vision and Pitch

### 1.1 One-sentence pitch

> **Build a neon factory, raid the grid for cores, extract before collapse — or lose what you built.**

### 1.2 Genre

Hybrid: **Top-down auto-shooter (Survivors-like) + idle factory + extraction risk**.

### 1.3 Why this hybrid wins

- Survivors-likes are CrazyGames' single most successful arcade genre in 2024–2026, but they are saturated. A pure survivors clone gets buried.
- Idle/incremental games have the highest day-7 retention of any genre on the platform but suffer from low session intensity.
- Extraction (Tarkov-style risk/reward) is rare in casual browser games and creates a memorable, shareable decision point.
- Combining all three: high-intensity short sessions, sticky meta-loop, and a differentiating tension that no direct competitor on CrazyGames currently owns.

### 1.4 Target player

- **Primary**: Mobile/desktop casual player, age 14–35, plays 5–20 minute sessions, 1–3 times per day.
- **Secondary**: Idle-game enthusiasts who check in for offline production.
- **Tertiary**: Daily-leaderboard chasers who want competitive surface.

### 1.5 Success metrics

- Day-1 retention ≥ 38%
- Day-7 retention ≥ 14%
- Average session length ≥ 4 minutes
- Sessions per DAU ≥ 1.8
- Rewarded ad views per session ≥ 0.7
- CTR on CrazyGames thumbnail ≥ 4%

---

## 2. Strategic Positioning

### 2.1 Differentiation hook (non-negotiable)

Every other survivors-like on CrazyGames has the same loop: run → upgrade → run. Our differentiator is:

> **The factory is at stake.** When the player fails to extract, enemies infest the factory and damage permanent production until the player clears them in their next raid. This makes the "extract now or push for more loot" decision carry weight that no competitor offers.

This single mechanic is the marketing line, the thumbnail concept, and the design north star. Every feature must either reinforce this hook or be cut.

### 2.2 What we deliberately are NOT

- Not a 3D shooter. Not Tarkov. Not even FPS-adjacent.
- Not a deep RPG. No equipment slots, no inventory grid.
- Not multiplayer. Async leaderboards only.
- Not a builder/sandbox. Factory growth is on rails, not freeform placement.
- Not a long-session game. 90-second raid is the maximum default.

### 2.3 Competitive context

| Competitor type | Examples on CrazyGames | Our advantage |
|---|---|---|
| Pure survivors clones | Survivor.io clones, Brotato-likes | Extraction tension, idle meta |
| Idle factory games | Idle Miner, factory clickers | Real action gameplay |
| Tower defense | TD games | Player-driven not placement-driven |
| .io shooters | Top-down arena shooters | Persistent progression |

---

## 3. Core Loop

### 3.1 The five-second loop (during raid)

```
move → auto-shoot → collect → power-up → repeat
```

### 3.2 The 75-second loop (one raid)

```
deploy → survive waves → collect loot → grab power-ups
→ choose mid-run upgrade → extract OR push for greed
→ summary screen → optional double-loot ad
```

### 3.3 The 5-minute loop (one session)

```
return to factory → claim offline production → buy upgrade(s)
→ check daily quest → deploy raid → extract → buy more upgrades
→ deploy again → quit when satisfied
```

### 3.4 The 7-day loop

```
day 1: tutorial → first extracts → first character unlock visible
day 2: daily streak begins, second character unlocked
day 3-5: drafting builds, unlock factory rooms, climb leaderboard
day 6: weekly boss appears
day 7: prestige threshold visible, season cosmetic preview
```

### 3.5 Golden rule

**Everything in the factory must make raids more fun. Everything in raids must make the factory grow.** If a feature does not reinforce this bidirectional pull, cut it.

---

## 4. The Differentiator: Factory At Stake

### 4.1 Rule

When the player fails to extract from a raid:
- They lose **50% of unbanked run loot** (already in prototype, keep this).
- **NEW**: Enemies "infest" the factory. A red overlay appears on 1–3 factory machines. Those machines produce **0 Scrap/min** until cleared.
- Infested machines persist across sessions. They are visible on the factory floor with red glitch effects.

### 4.2 Clearing infestation

On the next raid, an **Infestation Wave** spawns: a special wave of enemies that, when defeated, restore one machine. The player can clear all infestation by killing 30–50 infestation enemies (tuned per machine count).

### 4.3 Why this works

- Extraction now carries real consequence beyond losing a single run's loot.
- Returning players are reminded what's at stake the moment they open the factory.
- Creates a narrative tension: "I have to go back in to fix what I lost."
- Offline production is dampened by infestation, encouraging a raid to "fix things" before AFKing.

### 4.4 Anti-frustration safeguards

- Maximum infestation cap: 50% of machines. Players never lose their whole economy.
- First 3 failed raids ignore infestation (player is still learning).
- Tutorial raid cannot infest.
- A rewarded ad can clear all infestation instantly (monetization opportunity, see §17).

---

## 5. First-Time User Experience

### 5.1 Hard rules

- No tutorial modal at start. The game opens directly inside a playable tutorial raid.
- No more than 4 words on screen at any instructional moment.
- Player must take their first action within 2 seconds of load complete.
- First raid cannot fail. A safety net auto-shields if HP hits 1.

### 5.2 Beat-by-beat FTUE (first 90 seconds)

| Time | Event |
|---:|---|
| 0.0s | Loading screen finishes. Player ship visible at center. |
| 0.0s | Big arrow points to nearby scrap pile. Caption: `MOVE` (with joystick hint icon). |
| 0.5–2.0s | Player tries movement. Camera nudges to encourage them. |
| 2.0s | First scrap is collected with strong magnet pull, satisfying sound, big number popup. |
| 4.0s | Three weak grunts spawn. Auto-fire engages. They die in one shot each. |
| 6.0s | Caption: `DASH` appears next to dash button. A faster enemy approaches. |
| 8.0s | Player dashes (or game auto-suggests it). Caption fades. |
| 10.0s | Guaranteed power-up appears: **Drone Swarm**. Player walks into it. Drones spawn. |
| 12.0s | Caption: `POWER UP!` Toast: "DRONE SWARM ACTIVE". |
| 18.0s | Extraction pad pulses green. Caption: `EXTRACT` with arrow waypoint. |
| 25–35s | Player reaches pad. Hold timer begins. |
| 30–40s | Extraction completes. Big radial blast. Loot flies in. |
| 45s | Summary screen. Single button: **UPGRADE**. |
| 50s | Factory loads. ONE upgrade button is highlighted: Generator Lv. 2. |
| 55s | Player buys. Visual: machine glows brighter, second machine slides in. |
| 60s | New button revealed: **DEPLOY** (pulsing). |
| 70s | Player deploys. Real raid begins. |

### 5.3 Progressive UI reveal

Hidden until earned:

| UI element | Unlocks at |
|---|---|
| Daily reward button | After tutorial completes |
| Core Luck upgrade | After first Core collected |
| Drone upgrade | After Generator Lv. 2 purchased |
| Magnet upgrade | After 2 raids completed |
| Damage upgrade | After 3 raids completed |
| Factory Boost ad | After 5 raids completed |
| Mission board | After first daily streak day |
| Prestige | After first character maxed |
| Premium shop | After 10 raids completed |

### 5.4 Tutorial difficulty

Tutorial raid (45s):
- Player HP: 200% normal
- Player damage: 200% normal
- Enemy count: 40% normal
- Enemy HP: 50% normal
- Guaranteed power-ups: Drone Swarm at 10s, Magnet at 25s
- Extraction opens at 18s (faster than normal)
- Cannot infest factory if failed (cannot really fail anyway)

---

## 6. Player Character and Controls

### 6.1 Movement

- Top-down 8-directional movement.
- Base speed: 260 px/sec. Each Speed upgrade adds 18 px/sec.
- Acceleration: 17 (lerp coefficient). Lower during dash for momentum feel.
- World bounds: -800 to +800 horizontally, -560 to +560 vertically.

### 6.2 Dash

- Cooldown: 1.15 seconds.
- Distance: ~140 px (force-based, not teleport).
- Invulnerability: 0.18s during dash.
- Visual: yellow trail particles.
- Cooldown UI: radial fill on dash button + numeric countdown when < 1s.

### 6.3 Auto-fire

- Player does not aim or shoot manually.
- Targeting: nearest enemy within (365 + damage_level × 8) pixels.
- Fire rate: every 0.105s default. Reduced to 0.06s during Laser Overdrive.
- Visual: hitscan line tracer (cyan), not a projectile, for performance.

### 6.4 Mobile controls

- **Floating joystick** on left half of screen (not fixed). Appears under thumb on touch-down.
- Joystick fades when released.
- Dash button: bottom-right, 104px diameter, radial cooldown indicator.
- Pause button: top-right (small).

### 6.5 Desktop controls

- Movement: WASD or arrow keys.
- Dash: Space.
- Mouse aim is ignored (auto-aim only).
- ESC: pause menu.

### 6.6 Why no manual aim

Manual aim raises the skill floor and excludes mobile-only players. Auto-aim lets the player focus on movement, positioning, and the extract/greed decision — which is where our differentiation lives.

---

## 7. Raid Mode — Full Specification

### 7.1 Structure

- Duration: 75 seconds normal, 45 seconds tutorial.
- Extraction opens at: 20 seconds elapsed (normal), 18 seconds (tutorial).
- Hold time on pad: 5 seconds.
- Player can leave pad to retrieve a missed pickup; timer pauses but doesn't reset.

### 7.2 Spawn director

- Spawn cooldown: starts at 0.95s, ramps to 0.24s by raid end (linear with intensity).
- Max simultaneous enemies: 7 + (intensity × 25), capped at 32.
- Spawn position: 720 px from player, random edge of screen.
- Spawn weights (normal raid):

| Roll | Enemy |
|---:|---|
| 0–48% | Grunt |
| 48–68% | Swarmer |
| 68–84% | Shooter |
| 84–96% | Tank |
| 96–100% | Reserved for elites (Bomber, Loot Goblin, etc.) |

### 7.3 Greed multiplier (NEW)

After extraction opens, a `GREED` multiplier ticks up the longer the player stays:

| Seconds past extraction open | Greed | Enemy difficulty |
|---:|---:|---|
| 0 | x1.0 | Normal |
| 10 | x1.25 | +20% spawn rate |
| 20 | x1.5 | +40% spawn rate, +1 elite chance |
| 30 | x2.0 | Tank rush + bombers |
| 45 | x3.0 | Boss wave, all loot is gold |

If player extracts: all run loot multiplied by current Greed value.
If player dies: still loses 50% of unbanked loot (Greed not applied).

This is the central tension. It must feel like a real decision every time.

### 7.4 Combo multiplier

- Each enemy kill increases combo by 0.08 (capped at 3.5x).
- Combo decays at 0.8 per second after 2.2s of no kills.
- Combo multiplies loot drops per enemy.

### 7.5 Power-up spawn cadence

- First power-up: 4 seconds in (tutorial) or 8 seconds in (normal).
- Subsequent power-ups: every 9–14 seconds (random).
- Max 10 power-ups in arena at once.

### 7.6 In-run drafting (NEW, critical)

At 20 seconds in and 45 seconds in, time slows to 10% speed and three upgrade cards appear:

```
CHOOSE SIGNAL MOD
[Chain Lightning] [Magnet Storm] [Pierce]
```

- Player taps one. Game resumes.
- 8 seconds to choose, auto-picks middle option if no choice.
- See §12 for full upgrade card list.

### 7.7 Extraction

- Visual: green circular pad at fixed position per map (varies by arena).
- Closed state: dim yellow glow.
- Open state: bright green, pulsing ring, animated chevrons.
- On-pad: arc fill animates over 5 seconds. Camera shakes mildly. Loud ticking sound.
- Leaving pad: arc decays at 0.85× the fill rate (some forgiveness).
- Successful extraction: 0.15s frame freeze, radial light blast, all nearby enemies disintegrate, loot flies to player, rising chord audio.

### 7.8 Off-screen waypoint

When extraction is open and player is far from pad, a green arrow indicator appears at the edge of the screen pointing toward the pad. Critical for orientation.

### 7.9 Failure conditions

- HP reaches 0 → optional revive prompt (rewarded ad, see §17) → death summary.
- Timer reaches 0 → optional "+30 seconds" rewarded ad → if declined, run ends with whatever loot.

### 7.10 Run-end summary

Shows:
- Title: "EXTRACTION COMPLETE" or "RAID FAILED" or "TIME COLLAPSED"
- Loot earned (Scrap + Cores), with Greed multiplier shown if applied
- Best run indicator if beaten
- Three buttons:
  - **Double Loot** (rewarded ad) — only on success
  - **Factory** (return to hub)
  - **One More Raid** (instant redeploy)

---

## 8. Factory Mode — Full Specification

### 8.1 Visual identity

The factory is a **living place**, not a menu. It is the player's home base. They must feel ownership.

### 8.2 Factory floor

- Top-down view, same camera system as raids.
- World bounds: same as raid arena.
- Background: dim cyan grid, slow rotating ambient effects.
- Music: calm synth-ambient.

### 8.3 Machine system

Machines are visible objects on the floor. Each machine type has a distinct silhouette and animation.

| Machine | Unlocks at | Function | Visual |
|---|---|---|---|
| Generator | Day 1 | Produces Scrap pickups periodically | Pulsing rectangle with sine-wave inside |
| Drone Bay | Gen Lv. 3 | Houses drones; each drone collects automatically | Hexagonal pad with rotating drones |
| Magnet Coil | Gen Lv. 5 | Increases pickup radius in factory AND raid | Tall coil with sparking rings |
| Blaster Lab | Gen Lv. 7 | Adds damage in raids; visible weapon testing | Rectangle with periodic muzzle flash |
| Core Refinery | First Core collected + Gen Lv. 10 | Converts Cores → permanent multipliers | Glowing hexagonal furnace |
| Signal Tower | 10 raids completed | Enables daily quests & leaderboard | Tall antenna with pulsing wave |
| Portal Gate | 20 raids completed | Unlocks new arenas | Circular portal with shifting hue |
| Cosmetic Printer | Premium shop unlocked | Crafts cosmetics from Cores | Boxy machine with spinning gears |

### 8.4 Active factory mechanics

The factory is not purely idle. The player can:

- Walk around to physically collect Scrap drops from machines (magnetized).
- Tap machines to briefly boost production by 1.5x for 4 seconds (small interaction).
- Walk over infested machines to inspect them (warning popup).
- Walk to the Deploy pad to start a raid.

### 8.5 Factory growth visual milestones

The factory must **visibly grow** every few upgrades. The player sees their progress without reading numbers.

| Milestone | Visual change |
|---|---|
| Gen Lv. 2 | Second generator slides in from edge |
| Gen Lv. 3 | Conveyor belts connect generators |
| Gen Lv. 5 | Factory floor expands (camera zoom out slightly) |
| Gen Lv. 10 | Reactor core appears in center, glows brighter |
| Drone Lv. 1 | First drone takes off from bay |
| Drone Lv. 3 | Drones gain trails |
| Drone Lv. 5 | Drones gain miniature lasers in raids |
| Magnet Lv. 3 | Coil grows taller, sparks visible |
| Magnet Lv. 5 | Pickups orbit player before final collection |
| Damage Lv. 5 | Bullets pierce one enemy |
| Damage Lv. 10 | Shots split into two |
| Luck Lv. 5 | Cores leave golden trails |

### 8.6 Offline production

- Player earns Scrap based on SPM (Scrap Per Minute) while away.
- Cap: 8 hours of offline production.
- On return: "Offline factory produced +X Scrap" toast.
- Infested machines do not contribute to offline production.

### 8.7 SPM formula

```
SPM = 14 × generator_level × (1 + drone_level × 0.22) × factoryBoostMult × (1 - infestation_ratio)
```

---

## 9. Economy and Currencies

### 9.1 Three currencies (no more)

| Currency | Symbol | Earn rate | Use |
|---|---|---|---|
| **Scrap** | Cyan square | Common, every raid + factory | Most upgrades |
| **Neon Cores** | Yellow hex | Rare, mostly in raids | Major unlocks, refinery boosts |
| **Neon Tokens** | Purple shard | Real money IAP only | Cosmetics, premium upgrades |

### 9.2 Upgrade costs (base + scaling)

| Upgrade | Base cost | Scale |
|---|---:|---:|
| Generator | 25 Scrap | × 1.50 per level |
| Drone | 60 Scrap | × 1.62 per level |
| Speed | 45 Scrap | × 1.55 per level |
| Magnet | 50 Scrap | × 1.55 per level |
| Damage | 55 Scrap | × 1.60 per level |
| Luck | 80 Scrap | × 1.70 per level |

Cores are used for:
- Refinery permanent multipliers (10 Cores = +5% global Scrap, stacks)
- Character unlocks (50–500 Cores)
- Prestige cost (1000 Cores minimum)

### 9.3 Scripted first 10 minutes

The first 10 minutes of play must feel hand-authored. Players should never get stuck.

| Time | Player has | Affordability |
|---:|---|---|
| 0:00 | 100 Scrap starting | — |
| 0:45 | +30–50 Scrap from tutorial | Can afford Gen Lv. 2 (25 Scrap) |
| 1:30 | Deployed real raid | — |
| 2:30 | +40–80 Scrap from raid | Can afford Magnet Lv. 1 (50 Scrap) |
| 4:00 | Second raid done | Drone Lv. 1 (60 Scrap) |
| 6:00 | Third raid | Damage Lv. 1 (55 Scrap) |
| 8:00 | First Core collected | Reveal Luck upgrade |
| 10:00 | Steady cadence | Next unlock: Core Refinery teased |

### 9.4 Soft caps and milestone effects

Avoid pure number inflation. Every 5 levels, an upgrade gains a qualitative effect:

```
Magnet Lv. 5: pickups orbit player before collection (visual + gameplay)
Damage Lv. 5: shots pierce one enemy
Damage Lv. 10: shots split into two
Drone Lv. 5: drones fire lasers in raids
Generator Lv. 10: unlock second factory wing
Speed Lv. 5: dash gains second charge
Luck Lv. 10: cores can spawn in pairs
```

---

## 10. Meta Progression

### 10.1 Progression layers (in increasing time horizon)

1. **In-run** (seconds): combo, greed, power-ups, draft upgrades.
2. **Per-session** (minutes): Scrap accumulation, upgrade purchases.
3. **Daily** (hours): daily quest, streak, offline production.
4. **Weekly**: weekly boss, season pass.
5. **Lifetime**: character unlocks, prestige, achievements, cosmetics.

### 10.2 Core Refinery (permanent multipliers)

Spend Cores at the Refinery for permanent global boosts:

| Refinery upgrade | Cost | Effect |
|---|---:|---|
| Scrap Catalyst I | 10 Cores | +5% all Scrap earned |
| Scrap Catalyst II | 25 Cores | +10% all Scrap earned |
| Scrap Catalyst III | 60 Cores | +20% all Scrap earned |
| Drone Overclock I | 15 Cores | +1 starting drone in raids |
| Magnet Surge I | 20 Cores | +25% magnet range |
| Iron Plating I | 30 Cores | +25 max HP |
| Quick Boots | 40 Cores | -10% dash cooldown |
| Lucky Strike | 50 Cores | +15% core drop rate |

### 10.3 Prestige (System Reboot)

Triggered when:
- Generator Lv. 25+ AND
- 1000+ Cores stored

Prestige effect:
- Wipes all Scrap and most upgrades back to 0.
- Keeps: Refinery, cosmetics, characters, achievements.
- Grants: 1 **Cyber-Core** (permanent +10% global multiplier, stacks).
- Unlocks a new cosmetic visible to other players via username display.

### 10.4 Achievements

20–30 achievements, each grants a small Scrap/Core reward. Examples:

- First Extraction (50 Scrap)
- First Core Collected (75 Scrap)
- 100 Raids Completed (5 Cores)
- No-Damage Extract (3 Cores)
- Greed x3 Extract (10 Cores)
- Prestige Once (cosmetic)
- 7-day streak (cosmetic trail)
- Kill 1000 Swarmers (cosmetic skin)

---

## 11. Operator Roster

Characters with different starting kits. Initial release: 4 operators. Add more in seasons.

### 11.1 Operators

| Operator | Unlock | Starting kit | Playstyle |
|---|---|---|---|
| **Pulse** (default) | Free | Balanced stats | Beginner |
| **Vanta** | 50 Cores or rewarded ad chain | +2 starting drones, -10% damage | Drone build |
| **Surge** | 100 Cores | +50% blaster damage, -25% HP | Glass cannon |
| **Lodestone** | 200 Cores | +100% magnet range, slower movement | Loot vacuum |
| **Reverb** | 500 Cores (season unlock) | Starts with 1 Shield, no dash | Defensive |

### 11.2 Why this matters

- Day-2 retention is largely driven by "I want to unlock the next character."
- Each operator changes how the run feels with zero new content created.
- Cosmetics tie to operators (skins, trails).
- Future expansion path: 8–12 operators within first year.

### 11.3 Operator selection

- Selection appears on the Deploy screen, not in the factory hub.
- Locked operators show as silhouettes with unlock cost.
- "Try in next raid" rewarded ad option to test a locked operator.

---

## 12. In-Run Upgrade Drafting

### 12.1 When

At 20s and 45s into a normal raid (not tutorial). Time slows to 10%, three cards appear.

### 12.2 Card pool (24 cards, 3 rarity tiers)

#### Common (white)

- **Sharper Shots**: +15% damage
- **Quick Feet**: +10% movement speed
- **Wide Magnet**: +20% pickup range
- **Hardy**: +20 max HP
- **Burst Fire**: +10% fire rate
- **Lucky**: +5% core drop chance

#### Rare (cyan)

- **Pierce**: shots pierce 1 enemy
- **Chain Lightning**: shots bounce to nearest enemy
- **Ricochet**: shots bounce off walls
- **Magnet Storm**: pickups orbit you for 8s
- **Dash Master**: -30% dash cooldown
- **Heal on Pickup**: scrap pickups restore 1 HP
- **Slow Field**: enemies within 100px slowed 30%
- **Orbital Shield**: shield bubble that blocks one hit, regens every 12s
- **Crit Shot**: 15% chance to deal 3x damage

#### Epic (purple)

- **Split Shot**: shots split into 2 forks
- **Frenzy Mode**: -50% fire rate when HP < 30%
- **Drone Multiplier**: existing drone count doubled
- **Vampiric**: 10% chance for kills to heal 5 HP
- **Nova Dash**: dash creates damaging ring
- **Time Dilation**: enemies move 15% slower
- **Greed Surge**: +50% loot multiplier this run
- **Phoenix**: revive once with 50% HP
- **Pyrokinetic**: enemies on death deal damage to nearby enemies

### 12.3 Rarity weights

- 20s draft: 70% common, 25% rare, 5% epic
- 45s draft: 40% common, 45% rare, 15% epic
- No duplicate offers in same run.

### 12.4 Stacking

Most upgrades stack additively. Pierce stacks (each level = +1 pierce). Some upgrades have a max stack (Phoenix: 1 only).

### 12.5 Why drafting is essential

Without drafting, every raid plays identically. With drafting, players will replay specifically to chase "god builds." This is the single highest-impact retention feature after the differentiator.

---

## 13. Power-Ups Reference

Power-ups spawn on the battlefield as collectible items, distinct from drafted upgrades.

| Power-up | Color | Effect | Duration |
|---|---|---|---|
| Magnet Burst | Cyan | All loot rushes to player | 5.5s |
| Signal Nuke | Red | Kills all on-screen enemies | Instant |
| Drone Swarm | Purple | Chain shots to extra enemies | 9s |
| Laser Overdrive | Green | Rapid 2-target lasers | 6s |
| +15 Seconds | Yellow | Adds 15s to raid timer | Instant |
| **NEW**: Shield Bubble | White | Absorbs one hit | Until used |
| **NEW**: Freeze Pulse | Light blue | All enemies frozen | 4s |
| **NEW**: Golden Fever | Gold | All enemies drop 2x scrap | 8s |
| **NEW**: Turret Drop | Orange | Drops a turret that auto-fires | 12s |

### 13.1 Spawn rules

- Random selection from above list.
- Spawn location: 280px ± from player.
- One spawns every 9–14 seconds (random).
- Max 10 on field at once.

---

## 14. Enemy Reference

### 14.1 Full roster

| Enemy | Role | Shape | Color | HP | Speed | Behavior |
|---|---|---|---|---:|---:|---|
| Grunt | Basic chaser | Triangle | Red | 22 | 90 | Walks toward player |
| Swarmer | Fast weak | Small triangle | Pink | 12 | 145 | Walks toward, groups |
| Tank | HP wall | Square | Orange | 60 | 58 | Slow, high HP |
| Shooter | Ranged | Pentagon | Purple | 28 | 72 | Keeps distance, fires projectiles |
| **NEW**: Bomber | Explodes | Pulsing circle | Red/orange | 18 | 100 | Charges player, telegraphed explosion |
| **NEW**: Loot Goblin | Reward chase | Diamond | Yellow | 30 | 180 | Flees, drops bonus loot if killed |
| **NEW**: Shield Carrier | Buffer | Hexagon | Blue+red | 45 | 50 | Buffs nearby enemies, must kill first |
| **NEW**: Splitter | Multiplier | Larger triangle | Magenta | 35 | 80 | On death splits into 3 Swarmers |
| **NEW**: Extract Jammer | Anti-extract | Spiked black | Black/red | 40 | 90 | Targets extraction pad, slows timer |
| **NEW**: Boss: Signal Hydra | Weekly boss | Multi-shape | Multi | 800 | 40 | Rotating weak points, multi-phase |

### 14.2 Telegraphs (mandatory)

All damage-dealing actions must be telegraphed:

- Shooter: 0.4s purple line before firing.
- Bomber: 0.5s expanding red ring before explosion.
- Extract Jammer: red tether visible to pad.
- Boss attacks: 0.8s charge indicators on each weak point.

Without telegraphs, damage feels random. Telegraphs make the game feel skillful even with auto-fire.

### 14.3 Drops

- Grunt: 4 Scrap pickups, 11% Core chance.
- Swarmer: 3 Scrap pickups.
- Tank: 8 Scrap pickups, 26% Core chance (1 base + 15% from type).
- Shooter: 5 Scrap pickups, 14% Core chance.
- Bomber: 5 Scrap.
- Loot Goblin: 30 Scrap, 80% Core chance, 5% chance for a Power-up drop.
- Shield Carrier: 7 Scrap.
- Splitter: 6 Scrap.
- Extract Jammer: 8 Scrap, 20% Core chance.
- Boss: 100+ Scrap, 5–10 Cores, guaranteed cosmetic shard.

---

## 15. Maps and Arenas

### 15.1 Launch maps (3)

| Map | Theme | Layout | Extraction pad |
|---|---|---|---|
| **Factory Yard** | Neon industrial | Open with cover blocks | NE corner |
| **Corrupted Grid** | Glitch / data | Maze-like cover | Center |
| **Core Mine** | Underground reactor | Narrow lanes | SW corner |

### 15.2 Future maps (post-launch)

Frozen Signal, Lava Reactor, Glitch Forest, Abandoned Server Farm, Neon Subway.

### 15.3 Arena cover

Static destructible blocks (visual only, no physics interaction with player). Used for:
- Breaking enemy line of sight from Shooters.
- Aesthetic variation.
- Forcing pathing for Tanks.

### 15.4 Map rotation

- First 5 raids: Factory Yard only.
- Then unlock Corrupted Grid.
- After 15 raids: Core Mine unlocks.
- Player chooses map on Deploy screen.

---

## 16. Retention Systems

### 16.1 Daily quest

One quest per day, refreshed at midnight UTC. Examples:

- "Extract 2 times today"
- "Collect 3 Neon Cores"
- "Kill 50 enemies in raids"
- "Use 3 power-ups in one raid"
- "Reach Greed x2"
- "Survive 60 seconds without taking damage"

Reward: 100 Scrap + 1 Core + cosmetic shard.

### 16.2 Daily streak

| Day | Reward |
|---:|---|
| 1 | 100 Scrap |
| 2 | 150 Scrap |
| 3 | 1 Core |
| 4 | 250 Scrap |
| 5 | Cosmetic trail |
| 6 | 3 Cores |
| 7 | Golden Crate (random epic upgrade or cosmetic) |
| 14 | 10 Cores + cosmetic |
| 30 | Exclusive operator skin |

Streaks forgive one missed day (skip day, continue from where left).

### 16.3 Leaderboards

**Daily seed leaderboard**: every day, all players play the same procedurally-seeded raid with identical enemy spawns, power-up locations, and map. Top score wins. Resets at midnight UTC.

This is the single most powerful retention feature for daily return visits. It must be implemented.

**All-time leaderboard**: highest single-raid loot score, ever.

**Weekly leaderboard**: highest cumulative scrap earned in the current week.

### 16.4 Weekly boss

Every Monday, a Signal Hydra appears as a special raid mode (5-minute extended raid, single boss with phases). Defeating it grants:
- Big Core payout
- Cosmetic shards
- Place on weekly boss leaderboard (fastest kill)

### 16.5 Season pass (free + premium)

Each season (4 weeks) has a track of 40 tiers. Each tier unlocked by playing raids (1 raid = 1 XP).

- **Free track**: Scrap, Cores, occasional cosmetic.
- **Premium track** (purchased with Neon Tokens): operator skins, exclusive trails, unique cosmetic on factory.

### 16.6 Contracts / mission board

A small board in the factory shows 3 contracts at a time:

- "Extract with 2 Cores" → 100 Scrap
- "Kill 30 Swarmers" → 1 Core
- "Use Magnet Burst twice" → 75 Scrap

Refreshes when all 3 completed or every 24h.

---

## 17. Monetization

### 17.1 Revenue model

CrazyGames revenue mix for this game (projected):

- 60% display ads (CrazyGames-served, no implementation needed beyond SDK init)
- 30% rewarded video ads (player-initiated)
- 10% IAP (Neon Tokens)

### 17.2 Rewarded ad placements (final list)

All ads MUST go through CrazyGames SDK. **No external ad providers allowed.**

| Placement | Trigger | Reward |
|---|---|---|
| **Revive** | Player death in raid (only after raid 3+) | Restore HP to 60%, 2.2s invuln, continue run |
| **Double Loot** | Successful extraction summary | 2x Scrap + Cores from run |
| **Extend Run** | Timer hits 0 before extract | +30 seconds to run |
| **Factory Boost** | In factory hub (cooldown: 10 min) | 2x SPM for 2 minutes |
| **Clear Infestation** | When factory is infested | Removes all infestation instantly |
| **Daily Crate** | Once per day after first raid of the day | Random Scrap (100–500) or 1 Core |
| **Operator Try-Out** | On Deploy screen for locked operator | Play one raid with locked operator |

### 17.3 Frequency rules

- **Never** during active raid gameplay (paused-state offers only).
- **Never** in the first tutorial raid.
- Max 1 rewarded ad prompt per raid (revive OR double loot, not both).
- Revive offer only with 75% probability per death (don't manipulate).
- Factory Boost cooldown: 10 minutes real time.

### 17.4 IAP (Neon Tokens)

| Pack | Tokens | Real $ |
|---|---:|---:|
| Starter | 100 | $1.99 |
| Standard | 550 | $9.99 |
| Premium | 1200 | $19.99 |
| Whale | 3500 | $49.99 |

Tokens spend on:
- Operator skins (50–200 tokens)
- Premium upgrades: **Permanent +1 Drone** (300 tokens), **Permanent Shield Start** (250 tokens)
- Cosmetic ship trails (50–100 tokens)
- Factory color themes (75 tokens)
- Season Pass premium track (400 tokens)

### 17.5 Anti-pay-to-win

Premium currency must NEVER buy raw power that ad-watchers and free players can't earn. Premium upgrades duplicate things that already exist in free progression but accelerate them. Cosmetics are unique to premium.

### 17.6 Interstitial / midgame ads

CrazyGames SDK supports `requestAd('midgame')`. Use when:
- Player returns from raid to factory (only every 3rd raid).
- After failure summary if no rewarded ad was watched.

Never during gameplay. Never within 60 seconds of session start.

---

## 18. CrazyGames SDK Integration

### 18.1 Setup

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

```javascript
await window.CrazyGames.SDK.init();
```

### 18.2 SDK bridge module

Wrap all SDK calls in a single `SDKBridge.js` module so the game works locally without SDK present and with SDK in production. Stub returns default values when SDK is missing.

```javascript
// /src/platform/SDKBridge.js
const hasSDK = typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK;
const SDK = hasSDK ? window.CrazyGames.SDK : null;

export const SDKBridge = {
  async init() {
    if (SDK) await SDK.init();
  },
  loadingStart() {
    if (SDK) SDK.game.loadingStart();
  },
  loadingStop() {
    if (SDK) SDK.game.loadingStop();
  },
  gameplayStart() {
    if (SDK) SDK.game.gameplayStart();
  },
  gameplayStop() {
    if (SDK) SDK.game.gameplayStop();
  },
  async requestRewarded() {
    if (!SDK) return { success: true }; // dev mode: assume reward granted
    try {
      await SDK.ad.requestAd('rewarded');
      return { success: true };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  },
  async requestMidgame() {
    if (!SDK) return;
    try {
      await SDK.ad.requestAd('midgame');
    } catch (e) {}
  },
  happytime() {
    if (SDK) SDK.game.happytime();
  },
  async saveData(key, data) {
    if (!SDK) {
      localStorage.setItem(key, JSON.stringify(data));
      return;
    }
    await SDK.data.setItem(key, JSON.stringify(data));
  },
  async loadData(key) {
    if (!SDK) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
    const raw = await SDK.data.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },
  getUser() {
    if (!SDK) return { username: 'Player' };
    return SDK.user.getUser();
  }
};
```

### 18.3 Required event placement

| SDK call | When |
|---|---|
| `loadingStart()` | Before any asset loading |
| `loadingStop()` | When tutorial raid is ready to start |
| `gameplayStart()` | When player enters tutorial or any raid |
| `gameplayStop()` | When raid ends, modal opens, or player returns to factory |
| `happytime()` | After successful extraction (this signals "good moment" to platform) |
| `requestRewarded()` | On rewarded ad placements per §17.2 |
| `requestMidgame()` | Per §17.6 |

### 18.4 Save system priority

```
1. CrazyGames Data SDK (cloud save)
2. localStorage fallback
3. In-memory default for fresh session
```

Conflict resolution: choose save with higher `lastSave` timestamp.

### 18.5 Compliance checklist

- [ ] No external ad providers
- [ ] PEGI-12 content (no excessive violence, no gambling mechanics)
- [ ] Works on Chrome, Firefox, Edge, Safari latest
- [ ] Works on Chromebook with 4GB RAM
- [ ] Mobile responsive (landscape primary, portrait optional)
- [ ] Loads in under 5 seconds on 4G
- [ ] No console errors in production build
- [ ] Mute and pause controls present
- [ ] Settings menu accessible

---

## 19. Visual Design System

### 19.1 Color hierarchy

| Color | Use | Hex |
|---|---|---|
| Cyan `#22f6ff` | Player, friendly, neutral pickups | Primary |
| Yellow `#ffd75a` | Cores, rewards, premium | Reward |
| Green `#72ff9f` | Extraction, healing, safety | Safety |
| Red `#ff416b` | Enemies, danger, low HP | Danger |
| Purple `#a76cff` | Special abilities, projectiles, rare | Special |
| Orange `#ff9c3d` | Tanks, warnings | Tank/warning |

Do not introduce new major colors. Hierarchy must be readable at thumbnail scale.

### 19.2 Shape language

| Shape | Meaning |
|---|---|
| Triangle | Enemy chaser / player ship |
| Square | Pickup (scrap) / tank enemy |
| Hexagon | Core / drone bay |
| Pentagon | Ranged enemy |
| Circle | Power-up / extraction pad / bomb |
| Diamond | Loot Goblin / cosmetic |

### 19.3 Player ship silhouette

The player must be **immediately readable** at small sizes (this is the thumbnail). Recommended:

- Wedge/arrow ship pointing in facing direction.
- Cyan body with bright cyan outline.
- Yellow accent during dash.
- Distinctive enough to be the game's logo mark.

### 19.4 Effect budget

| Effect | Use |
|---|---|
| Screen shake | Damage, big hits, extraction, dash |
| Camera zoom pulse | Power-up grab, kill streak |
| Damage vignette | Player takes damage (red radial fade) |
| Hit-stop / freeze frames | Extraction success (0.15s), boss kill (0.3s) |
| Particle bursts | Death, pickup, dash, power-up |
| Floating text | Damage numbers, "+N Scrap", "KO" |

### 19.5 Background art

Layered parallax with subtle motion:
- Far layer: animated nebula gradient
- Mid layer: grid pattern, slow scroll
- Near layer: floating particles, glitch lines

Background must NEVER compete with foreground for attention. Saturation < 30% on background colors.

### 19.6 Thumbnail composition

The CrazyGames thumbnail is the single most important visual asset. Composition:

- Center-left: Cyan player ship collecting glowing scrap
- Center-right: Red enemy swarm in motion
- Background: Neon factory machines
- Upper-right: Green extraction beam
- Lower-center: Yellow loot burst
- Title text: "NEON FACTORY RAID" — bold sans-serif, cyan glow

Must be readable at 200×120 px (CrazyGames grid view).

---

## 20. Audio Design

### 20.1 Audio philosophy

- Web Audio synthesized sounds for SFX (already proven in prototype).
- Loop-friendly background music (one track per mode initially).
- Layered intensity during raids.

### 20.2 Required SFX (minimum list)

- UI: button click, button hover, upgrade purchased, modal open/close
- Player: shoot, hit, dash, damage taken, death
- Pickups: scrap collect, core collect, power-up collect, daily reward
- Enemies: spawn, hit, death, projectile fire, explosion (bomber)
- Raid: timer ticking (last 10s), extraction open, extraction tick, extraction success, raid failed
- Factory: machine production, machine upgrade, infestation warning
- Power-ups: nuke, laser overdrive, magnet burst, freeze, golden fever
- Boss: roar, phase transition, defeat

### 20.3 Layered audio for big moments

Extraction success is NOT one sound. It's layered:

1. Low boom (the radial blast)
2. Rising synth sweep (the lift-off)
3. Sparkle cluster (loot streaming in)
4. Resolution chord (success)

### 20.4 Adaptive music

Raid music has 3 layers that mix dynamically:

- **Base layer**: always playing, calm pulse.
- **Tension layer**: activates at 50% HP or Greed ≥ x1.5.
- **Danger layer**: activates at 20% HP or 10 enemies on screen.

Factory music: single calm ambient loop.

### 20.5 Mute and volume

- Master volume slider in settings.
- Music and SFX separate sliders.
- Mute toggle in HUD (top-right).
- Honor CrazyGames SDK mute events.

---

## 21. UI and HUD

### 21.1 HUD during raid (minimal)

Top:
- HP bar (cyan, turns red when low)
- Run loot counter (Scrap / Cores)
- Raid timer (countdown)
- Greed multiplier (when active, prominent yellow)
- Combo (small, fades when not active)

Bottom (mobile):
- Joystick (floating, left)
- Dash button (right)

Right edge:
- Off-screen waypoint to extraction (when open)

Hidden during raid:
- Factory SPM
- Upgrades menu
- Daily quest
- Stats panel

### 21.2 Factory HUD

Top:
- Scrap and Core counters
- SPM display
- Streak indicator

Right panel:
- Upgrade grid (only unlocked rows shown)
- Daily claim button
- Factory Boost button
- Deploy button (prominent, pulsing)

Center:
- Quest card (current daily quest)
- Mission board (3 contracts)

### 21.3 Modal stack

Modals appear over everything but pause gameplay:
- Tutorial (no more after first time)
- Summary (after raid end)
- Ad confirmation (rewarded ad opt-in)
- Operator selection
- Achievement unlocked toast
- Settings

Only one modal at a time. ESC closes any modal (where appropriate).

### 21.4 Upgrade card readability

Each upgrade card must show:

```
[Icon] MAGNET
Lv. 3 → Lv. 4
Pickups orbit at Lv. 5
Cost: 120 Scrap
[Buy button]
```

Not just "Magnet Lv. 3 / 120".

### 21.5 Responsive design

- Landscape primary (1280×720 reference).
- Portrait optional, supported but not optimized.
- Mobile breakpoint: width < 900px (joystick visible, fixed UI elements relocated).
- Desktop breakpoint: width ≥ 900px (joystick semi-transparent, keyboard hints visible).
- Safe areas respected (`env(safe-area-inset-*)`) for notched devices.

### 21.6 Settings menu

- Master / Music / SFX volume
- Graphics quality (Low / Medium / High / Auto)
- Mute toggle
- Reset save (with confirmation modal)
- Controls help
- Credits
- Language (start with English; Norwegian secondary, see §22.8)

---

## 22. Technical Architecture

### 22.1 Engine choice

**Phase 1 (MVP)**: HTML5 Canvas 2D, vanilla TypeScript.
**Phase 2 (scale)**: Migrate rendering to **PixiJS** for GPU-accelerated batching when enemy/particle counts exceed Canvas 2D's mobile performance.

Do not start in Three.js. The 3D approach was already evaluated and rejected for this concept.

### 22.2 Build setup

- **Bundler**: Vite
- **Language**: TypeScript (strict mode)
- **Output**: Single `index.html` + bundled JS + minimal asset folder
- **Target**: ES2020, modern browsers only

### 22.3 File structure

```
/index.html
/vite.config.ts
/tsconfig.json
/public/
  /assets/
    /audio/
    /images/
    /fonts/
/src/
  main.ts
  /core/
    Game.ts
    Time.ts
    Camera.ts
    EventBus.ts
    State.ts
  /render/
    Renderer.ts            (Canvas 2D abstraction)
    Effects.ts
    ScreenShake.ts
    ParticleSystem.ts
    DamagePopups.ts
  /input/
    InputManager.ts
    VirtualJoystick.ts
    KeyboardController.ts
  /player/
    Player.ts
    PlayerController.ts
    DashSystem.ts
  /raid/
    RaidSystem.ts
    WaveDirector.ts
    ExtractionSystem.ts
    PowerupSystem.ts
    DraftSystem.ts
    GreedSystem.ts
    InfestationSystem.ts
  /enemies/
    EnemySystem.ts
    EnemyFactory.ts
    EnemyTypes.ts
    EnemyBehaviors.ts
  /factory/
    FactorySystem.ts
    MachineSystem.ts
    DroneSystem.ts
    FactoryGrowth.ts
  /meta/
    Economy.ts
    UpgradeSystem.ts
    OperatorSystem.ts
    AchievementSystem.ts
    DailyQuestSystem.ts
    StreakSystem.ts
    PrestigeSystem.ts
    LeaderboardSystem.ts
  /platform/
    SDKBridge.ts
    SaveSystem.ts
    Analytics.ts
  /ui/
    UIManager.ts
    HUDController.ts
    ModalSystem.ts
    UpgradeCard.ts
    SummaryScreen.ts
    SettingsMenu.ts
  /audio/
    AudioBus.ts
    SFX.ts
    AdaptiveMusic.ts
  /config/
    Balance.ts
    Content.ts
    PowerupDefs.ts
    EnemyDefs.ts
    UpgradeDefs.ts
    OperatorDefs.ts
    CardDefs.ts
```

### 22.4 Core patterns

#### Seeded PRNG (for daily leaderboard)

```typescript
// /src/core/Rng.ts
export class Rng {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  range(a: number, b: number) { return a + this.next() * (b - a); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}

// Daily seed = YYYYMMDD as integer
export function dailySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
```

#### Object pooling (for particles, enemies, bullets)

```typescript
export class Pool<T> {
  private free: T[] = [];
  private active: T[] = [];
  constructor(private factory: () => T, private reset: (t: T) => void, initialSize = 50) {
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }
  acquire(): T {
    const t = this.free.pop() ?? this.factory();
    this.active.push(t);
    return t;
  }
  release(t: T) {
    const i = this.active.indexOf(t);
    if (i >= 0) { this.active.splice(i, 1); this.reset(t); this.free.push(t); }
  }
  forEach(fn: (t: T) => void) { for (const t of this.active) fn(t); }
}
```

#### Swap-remove for hot arrays

```typescript
function swapRemove<T>(arr: T[], i: number) {
  arr[i] = arr[arr.length - 1];
  arr.pop();
}
```

Use this in particle/enemy/bullet update loops instead of `splice`.

#### Event bus

```typescript
type Listener = (...args: any[]) => void;
export class EventBus {
  private map = new Map<string, Set<Listener>>();
  on(event: string, fn: Listener) { (this.map.get(event) ?? this.map.set(event, new Set()).get(event)!).add(fn); }
  off(event: string, fn: Listener) { this.map.get(event)?.delete(fn); }
  emit(event: string, ...args: any[]) { this.map.get(event)?.forEach(fn => fn(...args)); }
}
```

Decouple systems via events (e.g., `enemy:killed`, `pickup:collected`, `extraction:complete`).

### 22.5 State shape

```typescript
interface GameState {
  mode: 'factory' | 'raid';
  paused: boolean;
  player: PlayerState;
  raid: RaidState;
  factory: FactoryState;
  save: SaveData;
  pools: { particles, enemies, bullets, pickups, powerups };
  ui: UIState;
}
```

### 22.6 Save data shape

```typescript
interface SaveData {
  version: number;          // for migration
  scrap: number;
  cores: number;
  tokens: number;           // premium
  upgrades: { gen, drone, speed, magnet, damage, luck };
  refinery: { [key: string]: number };
  operator: string;         // currently selected
  unlockedOperators: string[];
  achievements: string[];
  prestige: { count: number; cyberCores: number };
  daily: { lastClaim: string; streak: number; questId: string; questProgress: number };
  seasonPass: { tier: number; xp: number; premium: boolean };
  cosmetics: { equipped: { trail, skin, theme }; owned: string[] };
  infestation: { machineIds: number[] };
  stats: { runs, extracts, totalScrap, bestRaid, killCount };
  lastSave: number;
}
```

### 22.7 Migration strategy

Save version number lets old saves be migrated forward:

```typescript
function migrate(save: any): SaveData {
  if (!save.version) save = migrateV0toV1(save);
  if (save.version === 1) save = migrateV1toV2(save);
  // ...
  return save as SaveData;
}
```

### 22.8 Localization

- All player-facing strings in `/src/config/Strings.ts`.
- Default: English.
- Phase 2: add Norwegian, Spanish, Portuguese, German, French (CrazyGames top markets).
- `<html lang="en">` (fix the `lang="no"` from prototype which is incorrect for the actual English content).

---

## 23. Balance Configuration

All tunable numbers live in `/src/config/Balance.ts`. Never hardcode tuning in logic.

```typescript
export const Balance = {
  raid: {
    normalDuration: 75,
    tutorialDuration: 45,
    extractionOpenTime: 20,
    tutorialExtractionOpenTime: 18,
    extractionHoldTime: 5,
    extractionDecayRate: 0.85,
    draftTimes: [20, 45],
    greedSteps: [
      { afterSeconds: 0, mult: 1.0 },
      { afterSeconds: 10, mult: 1.25 },
      { afterSeconds: 20, mult: 1.5 },
      { afterSeconds: 30, mult: 2.0 },
      { afterSeconds: 45, mult: 3.0 },
    ],
    extendAdSeconds: 30,
  },
  player: {
    baseSpeed: 260,
    speedPerLevel: 18,
    accel: 17,
    baseHP: 105,
    hpPerGenLevel: 3,
    dashCooldown: 1.15,
    dashForce: 760,
    dashDuration: 0.18,
    dashInvuln: 0.18,
    invulnAfterHit: 0.18,
  },
  weapon: {
    baseFireCooldown: 0.105,
    laserFireCooldown: 0.06,
    laserTargets: 2,
    baseRange: 365,
    rangePerDamage: 8,
    baseDamage: 11,
    damagePerLevel: 4,
  },
  enemies: {
    maxOnScreen: 32,
    spawnCooldownStart: 0.95,
    spawnCooldownEnd: 0.24,
    spawnDistance: 720,
    weights: {
      grunt: 0.48,
      swarmer: 0.20,
      shooter: 0.16,
      tank: 0.12,
      elite: 0.04,
    },
    scaling: { hpMult: 1.0, hpMultPerRaidSecond: 1 / 75 },
  },
  economy: {
    upgrades: {
      gen:    { base: 25, scale: 1.50 },
      drone:  { base: 60, scale: 1.62 },
      speed:  { base: 45, scale: 1.55 },
      magnet: { base: 50, scale: 1.55 },
      damage: { base: 55, scale: 1.60 },
      luck:   { base: 80, scale: 1.70 },
    },
    coreChanceBase: 0.11,
    coreChancePerLuck: 0.035,
    coreChanceTankBonus: 0.15,
    offlineCapHours: 8,
    spm: { base: 14, drone: 0.22 },
    dailyReward: 100,
    factoryBoostDuration: 120,
    factoryBoostMult: 2,
  },
  infestation: {
    maxMachineRatio: 0.5,
    machinesLostPerFail: { min: 1, max: 3 },
    failsBeforeInfestation: 3,
    killsToRestoreMachine: 30,
  },
  prestige: {
    minGenLevel: 25,
    minCores: 1000,
    cyberCoreBonus: 0.10,
  },
};
```

---

## 24. Performance and Quality Settings

### 24.1 Performance targets

- 60 FPS on mid-tier mobile (iPhone X, Samsung A52).
- 30 FPS minimum on Chromebook 4GB RAM.
- Frame budget: 16ms (60fps) / 33ms (30fps).

### 24.2 Optimization tactics

- Object pooling for all transient entities (particles, bullets, pickups, popups, enemies).
- Swap-remove instead of splice in hot update loops.
- Spatial grid for collision queries (for nearest-enemy and pickup checks).
- AABB pre-check before expensive distance calculations.
- Cap particle count at 360 (already in prototype).
- Cap popup count at 70.
- Cap pickup count at 220.
- Skip drawing entities entirely off-screen.
- Use `requestAnimationFrame` with dt clamping at 0.033 (~30fps minimum).

### 24.3 Quality presets

| Setting | Low | Medium | High |
|---|---|---|---|
| DPR cap | 1.0 | 1.5 | 2.0 |
| Max particles | 120 | 240 | 360 |
| Glow effects | Off | Basic | Full |
| Background parallax | Static | 2 layers | 3 layers |
| Backdrop blur | None | None | Yes |
| Enemy max | 20 | 28 | 32 |

### 24.4 Auto-detect

- Default: Medium.
- If FPS averages < 40 over 5 seconds: drop to Low and notify.
- If FPS averages > 58 over 30 seconds and on Medium: offer High.
- Setting overrides auto-detect.

### 24.5 Performance overlay (dev mode)

Hidden debug overlay (toggle with backtick `):

```
FPS: 60
Frame: 14.2ms
Entities: 38 enemies / 124 particles / 18 pickups
Bullets: 6
Memory: ~24 MB
DPR: 1.5  Quality: Medium
```

---

## 25. Analytics

### 25.1 Events to track

All events go through `Analytics.track(event, props)`. In production, ship to a privacy-respecting analytics endpoint (CrazyGames Analytics if available, else self-hosted).

#### Onboarding

- `tutorial_started`
- `tutorial_first_move` (with `timeMs`)
- `tutorial_first_pickup`
- `tutorial_first_powerup`
- `tutorial_extracted`
- `tutorial_completed` (with `durationMs`)
- `tutorial_failed`
- `first_upgrade_purchased` (with `kind`)

#### Raid

- `raid_started` (with `mapId`, `operatorId`, `raidNumber`)
- `raid_extracted` (with `loot`, `cores`, `greedMult`, `durationSec`)
- `raid_failed` (with `reason`, `survivedSec`)
- `raid_time_collapsed`
- `power_up_collected` (with `type`)
- `draft_picked` (with `cardId`, `draftIndex`)
- `greed_reached` (with `mult`)
- `revive_offered`, `revive_accepted`, `revive_declined`
- `double_loot_offered`, `double_loot_accepted`
- `extend_run_offered`, `extend_run_accepted`

#### Factory & meta

- `upgrade_purchased` (with `kind`, `newLevel`, `cost`)
- `offline_claimed` (with `scrap`, `hours`)
- `daily_claimed`
- `daily_quest_completed` (with `questId`)
- `streak_advanced` (with `day`)
- `factory_boost_used`
- `infestation_occurred` (with `machinesAffected`)
- `infestation_cleared` (with `via`: 'kills' | 'ad')
- `operator_unlocked` (with `id`)
- `operator_selected` (with `id`)
- `achievement_unlocked` (with `id`)
- `prestige_completed` (with `cyberCores`)
- `iap_purchased` (with `packId`, `amount`)

#### Sessions

- `session_start`
- `session_end` (with `durationSec`, `raidsCompleted`, `scrapEarned`)

#### Performance

- `fps_warning` (with `avgFps`, `quality`)
- `quality_changed` (with `from`, `to`, `auto`)

### 25.2 Funnels to monitor

1. **Tutorial funnel**: load → first move → first pickup → first extract → first upgrade
2. **Day-1 funnel**: install → tutorial complete → first real raid → second session
3. **Monetization funnel**: rewarded ad shown → accepted → reward delivered
4. **Retention funnel**: D1 → D3 → D7 → D14 → D30

---

## 26. Content Roadmap

### Phase 0 — Foundation cleanup (1 week)

Convert prototype to modular TypeScript + Vite project per §22.3. Add `Balance.ts`. Add SDK bridge stub. Add basic analytics module. Add dev FPS overlay. No new features.

### Phase 1 — FTUE and core loop polish (2 weeks)

- Replace tutorial modal with playable onboarding per §5.2.
- Add floating joystick.
- Implement greed multiplier.
- Implement extraction "big moment" (frame freeze + radial blast).
- Implement progressive UI reveal.
- Add scripted first-10-minute pacing.
- Build out 1 polished arena (Factory Yard) with proper cover.
- Add basic settings menu (volume, quality, reset).

**Exit criteria**: A new player can play 3 raids in under 5 minutes and feels like they understand the game.

### Phase 2 — Depth and retention (3 weeks)

- Implement in-run drafting (§12).
- Add 4 new enemy types (Bomber, Loot Goblin, Splitter, Extract Jammer).
- Add 4 new power-ups.
- Implement infestation system (the differentiator).
- Implement 2 additional arenas.
- Add daily quest system.
- Add streak system.
- Add achievement system.
- Add operator roster (4 operators).
- Implement adaptive audio.
- Build SDKBridge fully and integrate real rewarded ads.

**Exit criteria**: Game has enough depth for 2+ hours of varied play. Day-1 retention measured > 30% in soft launch.

### Phase 3 — Launch candidate (2 weeks)

- Daily seed leaderboard.
- Weekly boss (Signal Hydra).
- All-time leaderboard.
- Cosmetic system (trails, skins, themes).
- IAP integration.
- Season pass framework (one season ready).
- Polish pass: thumbnail, store-page assets, video trailer.
- Performance pass: low-end device QA.
- Full mobile QA: iOS Safari, Android Chrome.
- Localization: 5 languages.

**Exit criteria**: Ready for CrazyGames submission.

### Phase 4 — Post-launch (ongoing)

- New operators every 2–4 weeks.
- New seasons every 4 weeks with theme + cosmetic track.
- New arena every 1–2 months.
- Boss rotation every 2 weeks.
- Live ops: limited-time events, seasonal cosmetics.

---

## 27. Risks and Anti-Patterns

### 27.1 Things that will kill the game

- **Adding 3D before retention is proven**. 2D is the right shipping target.
- **Building factory as a menu**. Factory must be a place, not a UI. If players skip from raid summary directly to deploy, factory has failed.
- **Saturated genre without differentiation**. The infestation/factory-at-stake hook is the differentiator. Don't water it down.
- **Aggressive monetization too early**. No ad prompts in tutorial. No paywalls.
- **Manual aim**. Mobile players will bounce. Keep auto-aim.
- **Generic neon visuals**. Without a distinctive player silhouette and thumbnail composition, CTR will be < 2%.
- **Linear stat-only progression**. Milestones at Lv. 5/10 with qualitative effects are essential.

### 27.2 Designs to reject

- More than 3 currencies.
- Energy / wait timers (CrazyGames audience hates them).
- Forced ads (only player-initiated rewarded ads).
- PvP / sync multiplayer (out of scope).
- Loot boxes with randomized stat-affecting items (PEGI risk, audience trust risk).
- Persistent global chat (moderation cost too high).
- Deep skill tree before basic loop is great.

### 27.3 Scope discipline

The fastest way to fail is to build everything in this blueprint before shipping. Ship Phase 1 + Phase 2 + Phase 3 minimum. Cut anything that doesn't reinforce: *factory at stake → raid for cores → push your luck → upgrade → repeat*.

---

## 28. Glossary

| Term | Meaning |
|---|---|
| **Raid** | A 75-second action mode where the player fights enemies and extracts |
| **Extraction** | The action of holding the green pad for 5s to bank loot |
| **Greed** | Multiplier that grows the longer player stays past extraction-open |
| **Drafting** | Mid-raid choice of one of three upgrade cards |
| **Infestation** | State where some factory machines are disabled due to failed extraction |
| **Operator** | Playable character with unique starting kit |
| **Scrap** | Common currency, used for most upgrades |
| **Cores** | Rare currency, used for major unlocks and refinery |
| **Tokens** | Premium currency (IAP only), used for cosmetics and convenience |
| **Refinery** | Factory machine that converts Cores into permanent global multipliers |
| **Prestige (System Reboot)** | Voluntary save wipe granting Cyber-Cores (permanent multipliers) |
| **Cyber-Core** | Permanent +10% global multiplier earned from prestige |
| **SPM** | Scrap Per Minute (factory passive income rate) |
| **FTUE** | First-time user experience |
| **SDK** | CrazyGames JavaScript SDK |
| **Daily Seed** | Deterministic raid configuration shared by all players each day |

---

## Appendix A: Implementation Order Cheat Sheet

For an AI agent implementing this from scratch, build in this order:

1. **Scaffold**: Vite + TypeScript, file structure per §22.3, empty modules.
2. **Renderer**: Canvas 2D, camera, screen shake. Render a single moving rectangle.
3. **Input**: Keyboard + virtual joystick + dash button.
4. **Player**: Movement, dash, auto-aim, auto-fire (against dummy targets).
5. **Enemies**: One enemy type, spawn director, basic AI.
6. **Pickups**: Scrap drops, magnet, collection.
7. **Raid loop**: Timer, extraction pad, success/fail summary.
8. **Factory mode**: Machines, SPM, mode switching.
9. **Upgrades**: 6 upgrade buttons, cost scaling, persistence.
10. **Save system**: localStorage + SDKBridge.
11. **FTUE**: Tutorial raid, progressive UI reveal.
12. **Power-ups**: 5 base power-ups.
13. **Audio**: Basic Web Audio SFX bus.
14. **Greed multiplier**: Implement and tune.
15. **Drafting**: Implement card selection.
16. **Operators**: 2 to start, then 2 more.
17. **Infestation**: Failed-extract consequence loop.
18. **Daily quest + streak**.
19. **Leaderboard (daily seed)**.
20. **Rewarded ads**: All placements per §17.
21. **Visual polish**: Effects, particles, transitions.
22. **Cosmetics + IAP**.
23. **Performance pass**.
24. **CrazyGames submission**.

---

## Appendix B: Concrete Code Patterns

### B.1 Main game loop

```typescript
// /src/main.ts
import { Game } from './core/Game';
import { SDKBridge } from './platform/SDKBridge';

async function boot() {
  SDKBridge.loadingStart();
  await SDKBridge.init();
  const game = new Game();
  await game.preload();
  SDKBridge.loadingStop();
  game.start();
}

boot();
```

### B.2 Game class skeleton

```typescript
// /src/core/Game.ts
export class Game {
  private last = performance.now();
  private bus = new EventBus();
  private state: GameState;

  async preload() {
    // load audio, fonts, save data
  }

  start() {
    this.state = createInitialState();
    if (!this.state.save.tutorialDone) {
      this.startTutorialRaid();
    } else {
      this.enterFactory();
    }
    requestAnimationFrame(this.loop);
  }

  loop = (now: number) => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.state.paused) this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    // delegate to systems based on mode
  }

  render() {
    // single render pass
  }
}
```

### B.3 System pattern

```typescript
// /src/raid/GreedSystem.ts
import { Balance } from '../config/Balance';
import type { RaidState } from '../core/State';

export class GreedSystem {
  update(raid: RaidState, dt: number) {
    if (!raid.extractOpen) return;
    raid.timeSinceExtractionOpen += dt;
    const steps = Balance.raid.greedSteps;
    let mult = 1;
    for (const s of steps) {
      if (raid.timeSinceExtractionOpen >= s.afterSeconds) mult = s.mult;
    }
    raid.greedMult = mult;
  }
}
```

### B.4 Drafting system pattern

```typescript
// /src/raid/DraftSystem.ts
export class DraftSystem {
  private picked: number[] = [];
  private rng: Rng;

  constructor(rng: Rng) { this.rng = rng; }

  shouldOffer(raid: RaidState): boolean {
    const t = raid.maxTime - raid.time;
    return Balance.raid.draftTimes.includes(Math.floor(t)) && !this.picked.includes(Math.floor(t));
  }

  offer(raid: RaidState, draftIndex: number) {
    const weights = draftIndex === 0
      ? { common: 0.70, rare: 0.25, epic: 0.05 }
      : { common: 0.40, rare: 0.45, epic: 0.15 };
    return [this.draw(weights), this.draw(weights), this.draw(weights)];
  }

  private draw(weights: Record<string, number>): CardDef { /* ... */ }
}
```

---

## Appendix C: CrazyGames Submission Checklist

- [ ] Single `index.html` entry point
- [ ] All assets self-contained (no external CDN requirements at runtime)
- [ ] CrazyGames SDK v3 integrated and tested
- [ ] `loadingStart` / `loadingStop` called correctly
- [ ] `gameplayStart` / `gameplayStop` placed around all raids
- [ ] `happytime()` called on extraction success
- [ ] Rewarded ads tested via SDK
- [ ] No external ad providers
- [ ] PEGI-12 content rating verified (no excessive violence, gambling, suggestive content)
- [ ] Plays on Chrome desktop
- [ ] Plays on Firefox desktop
- [ ] Plays on Edge desktop
- [ ] Plays on Safari iOS (mobile)
- [ ] Plays on Chrome Android (mobile)
- [ ] Plays on Chromebook with 4GB RAM at minimum 30fps
- [ ] Total load size under 10 MB compressed
- [ ] First playable frame within 5s on 4G
- [ ] No console errors in production build
- [ ] Mute button accessible at all times
- [ ] Pause works without breaking state
- [ ] Settings menu present
- [ ] `<html lang="en">` set correctly
- [ ] Title, description, screenshots, thumbnail, trailer ready
- [ ] Save migration plan documented for future versions

---

**END OF BLUEPRINT**

> This document is the operational spec. Any disagreement with prior prototype code or earlier design notes is resolved in favor of this document. Update the version number when making structural changes.
