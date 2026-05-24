# CrazyGamesTricks.md

## Purpose

This document is a practical growth, retention, polish, and monetization playbook for launching and improving a browser game on CrazyGames.

It is written for fast-moving HTML5/WebGL developers who need to improve real metrics: **CTR, conversion, average playtime, D1/D7 retention, returning users, rating, crash rate, and ad readiness**.

The philosophy is simple:

> On CrazyGames, the player owes you nothing. They clicked because the cover looked promising. You have seconds to prove the game is readable, fun, responsive, and worth one more try.

This is not about manipulation or dark patterns. The best “tricks” are clean product decisions that reduce friction, create satisfying loops, and give the player a reason to stay and return.

---

## 0. The CrazyGames reality

CrazyGames is not Steam. It is not a dedicated installed-game environment. It is an instant-play browser platform where players are often browsing, sampling, switching, and comparing games quickly.

That means:

- The cover must win attention before the game even loads.
- The game must load fast enough that curiosity does not expire.
- The first screen must make the next action obvious.
- The first 10 seconds must feel alive.
- The first 60 seconds must prove the core loop.
- The first 3 minutes must avoid heavy modal interruptions.
- The first match must feel fair, readable, and recoverable.
- Returning tomorrow must feel meaningful.

CrazyGames’ own Basic Launch guide frames the core launch KPIs as average playtime, Day 1 retention, and conversion. Their benchmark notes include: successful titles often reach **10+ minutes average playtime**, strong games often achieve **10–15% D1 retention**, and top-performing titles often convert **80%+**, load under **10 seconds**, and stay below **20 MB** build size.

For a game like **Signal Clash**, this means the priority is not “more features.” The priority is: **faster clarity, faster first conflict, better session rhythm, fewer modal interruptions, better reasons to return, and fewer technical dead ends.**

---

## 1. The KPI map: what each metric really means

### 1.1 CTR

CTR tells you whether the game looks clickable from the outside.

If CTR is weak, the player is not yet judging gameplay. They are judging:

- cover image
- preview video
- name
- genre promise
- visual clarity
- perceived quality
- novelty
- whether the thumbnail communicates “I instantly understand what this is”

CTR is primarily a **storefront problem**.

### 1.2 Conversion

Conversion tells you whether players who clicked actually reached meaningful play.

A conversion failure usually means:

- loading is too slow
- the first screen is confusing
- the player is blocked by menus, overlays, account prompts, settings, or text
- the player does not know what to click
- the game starts visually dead or unclear
- controls are not immediately understood
- the first minute has no satisfying action

Conversion is primarily a **first-minute problem**.

### 1.3 Average playtime

Average playtime tells you whether the game loop hooks the player.

A playtime failure usually means:

- too much waiting
- too little danger
- too little reward
- unclear objective
- too much early complexity
- bad difficulty curve
- no emotional peaks
- no “one more try” reason
- modal interruptions at the wrong time
- weak feedback when actions succeed

Average playtime is primarily a **core-loop pacing problem**.

### 1.4 D1 retention

D1 tells you whether players remember the game and want to continue tomorrow.

A D1 failure usually means:

- the game was enjoyable but not memorable
- progress was not saved clearly
- no visible progression path
- no daily challenge/reward
- no unlock close enough to chase
- no unfinished goal left in the player’s mind
- the game felt like a one-off toy

D1 is primarily a **progression and memory problem**.

### 1.5 D7 retention

D7 tells you whether the game has a real habit loop.

A D7 failure usually means:

- no long-term unlock ladder
- no meta-goals
- no rotating content
- no mastery depth
- no social/multiplayer reason to return
- no meaningful identity/customization
- no live update rhythm

D7 is primarily a **long-term motivation problem**.

### 1.6 Returning users

Returning users tells you whether the game is becoming part of a player’s rotation.

A returning-user failure usually means:

- the first session did not end with a hook
- the game did not save progress reliably
- the main menu does not acknowledge returning players
- the game lacks novelty after one session
- players do not feel ownership of their profile, rank, unlocks, or stats

Returning users are primarily a **continuity problem**.

### 1.7 Rating

Rating tells you whether players feel respected.

A rating failure usually means:

- bugs
- unfair difficulty
- misleading cover/video
- confusing UI
- bad controls
- too many ads
- progress lost
- no polish
- frustrating waiting
- broken multiplayer

Rating is primarily a **trust problem**.

### 1.8 Crash rate

Crash rate tells you whether the experience is stable enough for platform trust.

In browser games, a “crash” can be:

- real JS exception
- WebGL context loss
- frozen loading screen
- stuck lobby
- dead WebSocket state
- unhandled promise rejection
- scene cleanup race
- mobile memory kill
- iframe/resolution bug
- user forced to close tab because there is no clean exit

Crash rate is primarily a **technical reliability and dead-end problem**.

---

## 2. The master priority order

If everything feels important, use this order:

1. **No crashes, no stuck states, no broken loading.**
2. **Load fast.**
3. **Get to gameplay fast.**
4. **Make the next action obvious.**
5. **Make the first 10 seconds feel alive.**
6. **Make the first 60 seconds teach by doing.**
7. **Make the first 3 minutes contain at least one memorable win/loss moment.**
8. **Give the player a visible reason to play one more match.**
9. **Give the player a visible reason to return tomorrow.**
10. **Only then add more content.**

The common indie mistake is reversing this order: adding features, modes, cosmetics, and complexity before the first minute is clean.

---

## 3. CTR tricks: get the click

### 3.1 The cover must communicate the verb

A good cover does not just show the game. It shows what the player **does**.

For Signal Clash, the verb is not “sci-fi.” It is:

- connect
- defend
- attack
- destroy the core
- control the network
- blue versus red
- tactical push

The cover should show a clear gameplay-like conflict:

- blue network on one side
- red network on the other
- a relay or core under attack
- beams/projectiles moving in readable directions
- no visual ambiguity about who attacks whom

Bad cover promise:

> Generic sci-fi explosion.

Good cover promise:

> “I command blue squads and destroy the red core.”

### 3.2 One main idea per thumbnail

At CrazyGames thumbnail size, complexity dies.

Use:

- one focal conflict
- one readable enemy
- one readable player side
- one readable objective
- one logo/title treatment
- strong contrast

Avoid:

- tiny units everywhere
- too many beams
- too much UI text
- multiple objectives
- unclear ownership of units
- cinematic art that does not resemble gameplay

### 3.3 Update covers occasionally, not constantly

CrazyGames explicitly recommends updating covers occasionally, especially when new content is added, and notes that cover updates can create a session spike for older games. But updating too often can reduce familiarity.

Practical rule:

- launch cover: strongest general promise
- update cover after meaningful content/polish update
- seasonal/variant cover only if it still preserves recognizability
- never change the visual identity so much that returning players no longer recognize the game

### 3.4 Make three cover versions from the same visual identity

CrazyGames requires landscape, portrait, and square cover images. Treat these as three compositions from the same campaign, not three unrelated images.

Recommended:

- same logo treatment
- same blue/red identity
- same units/core language
- same lighting language
- different cropping/composition per ratio

Do not create a square cover that looks like a different game than the landscape cover.

### 3.5 Preview video must show real gameplay fast

The preview video should not behave like a cinema trailer. CrazyGames players want to understand what the game actually is.

Recommended 20-second structure:

1. 0–2s: instant readable gameplay scene
2. 2–5s: player builds/captures/commands
3. 5–9s: first combat impact
4. 9–13s: escalation / multiple squads / core damage
5. 13–17s: satisfying win/loss moment
6. 17–20s: title/logo over real gameplay background

Avoid:

- long cinematic intro
- black screens with vague taglines
- too much text
- fake gameplay
- slow pans before action
- showing menus more than gameplay

### 3.6 The name must be instantly genre-readable

“Signal Clash” is solid, but somewhat abstract. Abstract names need stronger visual support.

If the name stays, the cover/video must clarify:

- this is a tactical RTS
- blue vs red conflict
- network/core/relay mechanics
- fast browser battle

If the name ever changes, stronger patterns for browser games are often:

- iconic noun + action verb
- object + conflict
- clear fantasy + mechanic

Examples of naming logic, not direct recommendations:

- Core Siege
- Signal Siege
- Relay Wars
- Neon Network Clash
- Core Rush RTS

The risk with renaming late is losing identity. For Signal Clash, visual clarity is more urgent than renaming.

---

## 4. Conversion tricks: get them into real play

### 4.1 The Play button must be the obvious winner

The main menu should have one dominant primary action.

For first-time players:

- show one large “Play” action
- choose safe defaults automatically
- hide advanced customization
- avoid asking the player to make unfamiliar strategic choices before they have played

Bad first menu:

- Play Online
- Play vs Bot
- Customize
- Settings
- Profile
- Store
- Loadout
- Doctrine
- Map
- Difficulty

Good first menu:

- big Play
- small Settings
- small More Modes / Customize, unlocked or de-emphasized after first match

### 4.2 First session should use curated defaults

First-time players should not configure the game. They do not yet know what the settings mean.

Choose:

- easiest readable bot
- best first map
- default doctrine/loadout
- no advanced mode toggles
- no matchmaking complexity

For Signal Clash:

- first session should probably be **Play vs Bot**
- default bot should be **Recruit**, but with shorter warmup
- first map should be symmetric, readable, and small enough for early contact
- doctrine picker should not interrupt match 1

### 4.3 Never block the first match with too much text

Text is expensive in web games. It makes the player feel like they are not yet playing.

Use:

- 1–2 sentence objective
- big visual arrow/pulse
- contextual hints
- control overlay
- animated demonstration
- auto-dismiss

Avoid:

- long modal explanations
- three-option strategic choices before play
- lore dumps
- multi-step tutorials before input
- unskippable intros

### 4.4 Teach through a protected playable opening

The first minute should be gameplay, but slightly protected.

Good onboarding pattern:

1. Start the game immediately.
2. Show a simple objective marker.
3. Let the player click/build/capture safely.
4. Spawn the first threat quickly but gently.
5. Reward the first successful action loudly.
6. Remove hints gradually.

For Signal Clash:

- start with one obvious neutral relay
- pulse the relay
- show “Capture this relay” only until done
- spawn first red scout/assault early
- let the player see the squad fire
- show “Good — now defend the relay”

### 4.5 The first 10 seconds must not look dead

Even if the game is strategic, the screen must feel alive:

- ambient animation
- moving energy lines
- pulsing objective
- clear player base/core
- subtle enemy warning
- animated cursor hint
- unit idle motion
- immediate first command

A static strategic map reads as “nothing is happening.”

### 4.6 No scary modal at the 2–4 minute mark in match 1

The 2–4 minute range is dangerous. This is exactly when a new player is deciding whether the game is worth continuing.

Do not interrupt with:

- doctrine picker
- loadout picker
- shop modal
- long upgrade tree
- account/login prompt
- ad prompt
- social prompt

If a choice is necessary, use:

- auto-pick default for match 1
- tiny non-blocking card
- post-match choice
- unlock after first win/loss

### 4.7 First loss must feel fair and recoverable

Players tolerate losing if they understand why and immediately want to retry.

After a first loss, show:

- what killed them
- one specific improvement tip
- quick retry button
- progress earned anyway
- no shame language

Bad:

> Defeat.

Good:

> Core breached. Tip: Capture relays earlier to extend your signal range. +35 XP earned. Retry?

### 4.8 First win must trigger a strong celebration

If the player wins their first match, over-celebrate.

Use:

- victory animation
- XP gain
- unlock progress
- “New record”
- “First win” badge
- next goal
- quick rematch button

The first win is when the player’s brain decides whether the game has value.

---

## 5. Average playtime tricks: keep the session going

### 5.1 Action must start before boredom wins

For an RTS, danger cannot wait too long.

Recommended first-session pacing:

- 0–10s: player can act
- 10–30s: first capture/build/command
- 30–60s: first enemy contact
- 60–120s: first meaningful fight
- 120–180s: first escalation or comeback opportunity

If the first real threat appears after 90 seconds, many browser players will leave before the game begins.

For Signal Clash:

- Recruit warmup should likely be around 30 seconds, not 90 seconds
- first enemy pressure should be visible by ~45 seconds
- first combat should happen before the player reaches the “maybe I’m bored” threshold

### 5.2 Use micro-goals every 20–40 seconds

A player should always know what they are trying to do next.

Examples:

- capture next relay
- defend current relay
- spawn one more squad
- destroy enemy squad
- upgrade core
- survive signal storm
- push into enemy territory
- break shield
- finish match

If the main goal is too far away, add stepping-stone goals.

### 5.3 Use “near completion” to create one more action

Humans chase almost-finished things.

Show:

- XP bar 80% full
- daily challenge 2/3
- unlock in 1 match
- win streak 1/2
- “one more relay to dominate network”
- “core at 18% integrity”

Use ethically: the progress must be real and meaningful.

### 5.4 Make every click feel productive

In browser games, dead clicks are poisonous.

Every important click should produce:

- sound
- animation
- visible confirmation
- small particle/energy feedback
- UI state change
- progress movement

Even if the action is queued or invalid, the player should understand why.

Bad:

- click does nothing
- command silently fails
- unit cannot move but no explanation

Good:

- “Signal range too low” pulse
- red invalid marker
- tooltip explaining requirement
- mini sound for rejected action

### 5.5 Add rhythmic escalation

A match should have a pulse:

- quiet setup
- first contact
- first reward
- pressure spike
- recovery
- big fight
- endgame tension

Avoid a flat match where the intensity is the same for 8 minutes.

For Signal Clash, possible escalation beats:

- first relay captured
- first enemy squad spotted
- first relay under attack
- first core damage
- signal storm begins
- overtime / final push
- enemy core vulnerable

### 5.6 Avoid “complexity cliffs”

Complexity should ramp, not fall on the player.

Do not introduce all of these at once:

- relays
- squads
- resources
- doctrines
- abilities
- storms
- multiplayer timing
- counters
- upgrades

Introduce one new concept when the previous concept has already been used successfully.

### 5.7 Make the map smaller for first matches

Large maps create dead time.

For early sessions:

- shorter distance to conflict
- fewer lanes
- fewer neutral nodes
- clearer front line
- faster feedback

Large maps are better after the player understands the loop.

### 5.8 Give losing players comeback mechanics

If a player feels the match is lost at minute 2, they leave.

Good comeback mechanics:

- defensive shield pulse
- temporary resource boost when behind
- cheap emergency unit
- comeback objective
- enemy overextension punish
- core armor threshold
- “last stand” ability

Do not make comebacks random. Make them strategic and readable.

### 5.9 Make the match ending quick once decided

Dragging out a lost game kills retention.

If one player is clearly winning:

- increase pressure
- expose core
- trigger final phase
- allow surrender/leave
- accelerate closing loop

A good RTS match should avoid both early boredom and late inevitability.

### 5.10 Put the rematch button in the emotional peak

The best time to ask for another match is immediately after:

- narrow win
- close loss
- unlock earned
- rank progress shown
- challenge progress shown

The post-match screen should have:

- big Play Again
- one clear next goal
- rewards summary
- optional details below

---

## 6. Retention tricks: make them come back tomorrow

### 6.1 Save progress visibly

Players return when they believe progress matters.

Show:

- profile level
- XP bar
- match count
- wins
- streaks
- unlock progress
- titles/cosmetics
- daily challenges

Also show “Saved” subtly when progress is stored.

### 6.2 Use CrazyGames Data Module correctly

CrazyGames’ Data Module can save and retrieve user data for logged-in users and sync it across devices. For guest users, it stores data in localStorage and can later sync/backup when the user logs in. If using it, the correct Progress Save option must be selected in submission, and the game should rely on the Data Module rather than separate local saves.

Practical checklist:

- initialize SDK during loading screen
- load data before starting profile-dependent UI
- never overwrite cloud data with empty defaults
- migrate old localStorage keys carefully
- log hydration success/failure
- keep save size below limit
- debounce/avoid excessive writes
- show fallback state if save unavailable

### 6.3 Add daily challenges that are visible from the main menu

Daily challenges are weak if hidden inside a profile modal.

They should appear on the main menu as a small, attractive widget:

- “Daily: Win 1 bot match — 0/1”
- “Daily: Capture 10 relays — 6/10”
- “Daily: Deal 500 core damage — 320/500”

Each should reward:

- XP
- cosmetic currency
- title progress
- badge progress
- small visual celebration

### 6.4 Use a “welcome back” banner

When a returning player opens the game:

- recognize them
- remind them what changed
- show daily reset
- show unfinished progress

Examples:

- “Welcome back — new daily challenges are ready.”
- “You are 1 win away from unlocking Veteran.”
- “Your last match: Victory on Hexline.”
- “Daily streak: 2 days.”

### 6.5 Leave an unfinished goal at session end

The post-match screen should always reveal one near-future target.

Examples:

- “1 more match to unlock Veteran title”
- “Capture 4 more relays to complete daily challenge”
- “Win once with Shield Squad to unlock blue variant”
- “Reach Level 3 to unlock Storm Mode”

The player should close the game with a mental bookmark.

### 6.6 Celebrate cosmetics and titles properly

Invisible unlocks do not create retention.

When a cosmetic/title unlocks:

- show card
- show before/after
- play sound
- allow equip now
- show it in profile
- mention next unlock

Even simple cosmetics matter if presented as status.

### 6.7 Use low-cost identity systems

Identity is retention.

Easy browser-game identity systems:

- player title
- core skin
- squad color accent
- banner frame
- profile badge
- win pose/card
- favorite squad stat
- match history

Avoid heavy cosmetics before core gameplay works. But lightweight identity rewards are high ROI.

### 6.8 Use streaks carefully

Streaks can help retention, but should not punish too harshly.

Good:

- “Play 2 days in a row: bonus XP”
- “Streak protected for one missed day”
- “Come back tomorrow for a new challenge”

Bad:

- harsh loss of progress
- guilt language
- manipulative pressure

### 6.9 Add rotating modifiers

A game feels more alive if something changes.

Low-cost rotations:

- daily map
- daily doctrine
- daily bot personality
- daily challenge set
- weekend double XP
- “storm day” modifier
- “relay rush” modifier

For Signal Clash:

- Daily Tactical Directive: “Shield squads cost less today.”
- Daily Objective: “Win a match after losing a relay.”
- Daily Map Focus: “Today’s featured battlefield: Crosslink.”

### 6.10 Create mastery ladders

Players return when they feel they are improving.

Add progression not only through numbers, but through skill:

- bronze/silver/gold medals for match performance
- “win under 6 minutes” badge
- “no core damage” badge
- “capture all relays” badge
- “comeback victory” badge
- per-squad mastery

For an RTS, mastery hooks are powerful because the game naturally rewards improvement.

---

## 7. Rating tricks: make players feel respected

### 7.1 Do not mislead with the cover

If the cover looks like a cinematic space shooter but the game is a minimalist RTS, players feel tricked.

Stylize the cover, but keep it truthful:

- top-down tactical perspective
- real unit logic
- recognizable core/relay/squad elements
- no fake giant boss if no giant boss exists
- no fake 3D characters if gameplay is abstract units

### 7.2 Make controls impossible to miss

Good control teaching:

- visual overlay
- mouse gesture animation
- keyboard icons
- first-action hint
- contextual reminders

Avoid:

- burying controls in settings
- relying on text only
- expecting players to infer RTS controls

### 7.3 Make failure explain itself

Every loss should have a reason:

- “Your relay chain was broken.”
- “Enemy assault squads reached your core.”
- “You had no shield squad defending the front.”
- “You floated resources instead of spawning units.”

The game should act like a coach, not a judge.

### 7.4 Do not punish experimentation too early

First-time players click randomly. That is normal.

Early game should tolerate:

- suboptimal build order
- slow reaction
- wrong unit choice
- late defense
- missed tooltip

If the first mistake causes irreversible loss, ratings suffer.

### 7.5 Add a “clean exit” button

If players must close the tab to leave a match, analytics can interpret it as early session end or crash-like behavior.

Add:

- visible Leave Match button
- confirmation if online match
- clean scene teardown
- return to menu
- gameplayStop call

A clean exit is good UX and good data hygiene.

### 7.6 Never trap the player in a dead state

Every waiting state must have:

- status text
- timeout
- retry
- cancel/back
- fallback

Examples:

- matchmaking timeout → bot fallback or return to menu
- expired invite → quick play prompt
- WebSocket error → reconnect banner
- server cold start → “server warming up” message
- ad unavailable → continue normally

A stuck state is often perceived as a crash.

---

## 8. Ads and monetization tricks

### 8.1 Ads must never damage the core loop

Ads are disabled during Basic Launch because CrazyGames wants organic engagement metrics to be clean. For Full Launch, ads become relevant — but only after the game proves itself.

Bad ad strategy:

- interrupt early onboarding
- show ad before the player understands the game
- show ad after every death
- make reward ads necessary to win
- make “continue without ad” visually worse

Good ad strategy:

- request midgame ad only at natural breaks
- offer rewarded ads as optional bonuses
- never put rewarded ad button on active gameplay screen
- mute game audio only when an ad actually starts
- resume cleanly after ad

### 8.2 Use midgame ads at true breaks

Good moments:

- after match ends
- after level ends
- before returning to menu
- after player voluntarily pauses
- between rounds

Bad moments:

- during active combat
- right after first tutorial step
- during countdown
- while a player is under attack
- right after a frustrating loss

### 8.3 Rewarded ads should feel like opportunities

CrazyGames’ guidance is clear: rewarded ads should be special opportunities, not required expectations.

Good rewarded ad offers:

- cosmetic reroll
- double XP after match
- bonus cosmetic currency
- one optional revive, not every death
- funny visual effect
- temporary non-pay-to-win boost in casual mode

For Signal Clash:

- double post-match XP
- bonus cosmetic currency
- unlock a temporary core skin preview
- extra daily challenge reroll

Avoid:

- “watch ad or lose progress”
- “watch ad to be competitive online”
- ad reward that breaks multiplayer fairness

### 8.4 Make “no ad available” graceful

If no ad is available:

- do not punish player
- do not freeze UI
- do not silently fail
- show “No ad available right now”
- let player continue

### 8.5 Track ad impact separately

After Full Launch, watch:

- playtime before/after ads
- ad request locations
- ad completion rate
- return to gameplay after ad
- negative rating feedback mentioning ads
- crash/stuck states around ad callbacks

If ads reduce retention too much, revenue can fall despite more ad requests.

---

## 9. Multiplayer tricks

### 9.1 Always provide a good bot fallback

Browser players are impatient. If online matching is slow, they leave.

Use:

- quick timeout
- visible matchmaking status
- “Play vs Bot while waiting”
- bot-fill fallback
- cancel button
- reconnect handling

### 9.2 Expired invite links must not create empty lobbies

If invite links create new empty rooms when expired, friends bounce.

Better flow:

- detect no opponent after 20–30s
- show “Room expired or opponent left”
- offer Quick Play
- offer Play vs Bot
- offer copy new invite

### 9.3 First online match should not be the first learning match

If possible, first-time users should learn against a bot before online PvP.

PvP is exciting but can be brutal. If the player loses before understanding the loop, they may never return.

### 9.4 Use human-like bots

Bots should:

- create pressure early
- make readable mistakes
- avoid perfect timing
- sometimes retreat
- sometimes overextend
- produce dramatic recoverable moments

Bad bots:

- do nothing for too long
- play perfectly
- rush brutally
- ignore player actions
- feel random

### 9.5 Communicate network problems like gameplay events

Do not hide errors in console.

Show:

- reconnecting
- connection lost
- retry
- return to menu
- switch to bot
- match ended because opponent left

Never let the player wonder if the game is broken.

---

## 10. Technical performance tricks

### 10.1 Build size is a conversion feature

CrazyGames says top-performing titles typically load under 10 seconds and keep build size below 20 MB.

Even if your build is already below that, smaller is still better.

Optimize:

- code splitting
- lazy-load non-first-match assets
- compress audio
- use modern formats when safe
- avoid unused assets
- delay heavy menus/profile panels
- preload only the first playable experience

### 10.2 First playable before full loaded

Load order should be:

1. shell
2. logo/loading
3. first match essentials
4. main menu essentials
5. first gameplay
6. background load cosmetics/audio/extra maps/profile panels

Do not block first play on content the player may never use.

### 10.3 Avoid long JS main-thread stalls

Browser players interpret stutter as low quality.

Watch for:

- huge JSON parse
- synchronous asset decoding
- DOM thrash
- expensive layout recalculation
- too many particles
- unnecessary canvas resizes
- large texture upload mid-match
- unbounded arrays/event listeners

### 10.4 Test common CrazyGames iframe sizes

CrazyGames gameplay requirements list important desktop iframe sizes such as 907×510, 1216×684, 1077×606, 821×462, and 1366×768 fullscreen.

Test at these sizes specifically.

For each size, verify:

- text readable
- main button visible
- no black bars unless intended
- core/objective visible
- HUD does not cover action
- tooltips fit
- tutorial hints fit
- no clipped modals

### 10.5 Scene teardown must be boringly reliable

Most browser game “random crashes” are cleanup bugs.

Audit:

- timers
- intervals
- requestAnimationFrame loops
- event listeners
- DOM nodes
- audio nodes
- socket listeners
- scene references
- singleton state
- tooltip overlays
- resize observers

Every system should have:

- attach/init
- detach/dispose
- idempotent cleanup
- guards against destroyed scene

### 10.6 Treat stuck loading as a crash

Add watchdogs:

- loading timeout
- matchmaking timeout
- server health timeout
- asset load timeout
- ad callback timeout
- save hydration timeout

Every timeout should have a visible fallback.

### 10.7 Add client error analytics

Track:

- uncaught error
- unhandled rejection
- WebGL context lost
- WebSocket error
- asset load fail
- stuck loading watchdog
- scene transition failure
- save hydration failure
- ad callback error

Each event should include:

- game version
- scene
- browser
- device class
- match mode
- time since boot
- time since gameplay start

Without this, crash rate is guesswork.

---

## 11. Onboarding tricks for strategy games

### 11.1 “Show, then ask”

Do not ask the player to understand systems before seeing them.

Bad:

> Choose your doctrine: Overload, Fortify, Disrupt.

Good:

> First match uses Auto Doctrine. After the match, unlock doctrine choice with a short explanation.

### 11.2 Use one mechanic per hint

A hint should teach exactly one thing.

Bad:

> Capture relays to extend signal range, spawn squads, defend your core, and destroy the enemy core before the timer ends.

Good sequence:

1. “Capture this relay.”
2. “Your signal now reaches farther.”
3. “Spawn a squad here.”
4. “Enemy incoming — defend the relay.”
5. “Push toward the enemy core.”

### 11.3 Make the first objective visually unavoidable

Use:

- glow
- arrow
- pulse
- camera framing
- line animation
- short tooltip

The player should not have to scan the whole map.

### 11.4 Give immediate success feedback

When the first relay is captured:

- sound
- color shift
- line connection animation
- XP tick
- “Relay secured” toast
- next objective pulse

The player must feel that they did something right.

### 11.5 Delay strategic vocabulary

Words like doctrine, relay chain, signal storm, capture radius, overclock, and tactical rotation may be cool — but early on they can overwhelm.

Start with simpler language:

- capture
- defend
- attack
- protect core
- enemy incoming
- build squad

Add terminology after action.

---

## 12. UI/HUD tricks

### 12.1 The HUD should answer four questions

At all times, the player should know:

1. What am I trying to do?
2. Am I winning or losing?
3. What can I click now?
4. What danger needs attention?

If the HUD does not answer these, it is decoration.

### 12.2 Use hierarchy, not quantity

A cluttered HUD often means everything has equal importance.

Use:

- big for urgent
- small for persistent
- bright for actionable
- muted for passive info
- motion only for time-sensitive info

### 12.3 Avoid modal stacking

Only one major layer should own attention.

Bad:

- tutorial modal over doctrine modal over pause overlay over tooltip

Good:

- one overlay at a time
- modal queue
- auto-dismiss low-priority hints
- gameplay hints stay non-blocking

### 12.4 Make all buttons literal

Browser players skim.

Use:

- Play
- Retry
- Leave Match
- Continue
- Settings
- Copy Invite Link
- Play vs Bot
- Online 1v1

Avoid ambiguous words for primary actions:

- Deploy
- Engage
- Enter Signal
- Initiate Protocol

Stylish language can be used in secondary flavor, not core navigation.

### 12.5 Never hide exit/settings

Players trust games more when they can leave, mute, pause, or adjust settings easily.

Essential:

- mute
- pause/settings
- leave match
- fullscreen optional
- visible status in online modes

---

## 13. Audio tricks

### 13.1 Sound sells impact

Small browser games can feel premium with good audio.

High ROI sounds:

- button hover/click
- relay captured
- squad spawn
- squad hit
- shield impact
- core hit
- enemy destroyed
- victory
- defeat
- warning
- countdown

### 13.2 Use audio hierarchy

Not every sound should be loud.

Prioritize:

- danger
- success
- core damage
- match phase changes
- player commands

Reduce:

- constant ambient UI ticks
- repetitive unit fire
- overlapping explosions

### 13.3 Add cooldowns and categories

Prevent audio spam:

- per-sound cooldown
- category cooldown
- distance/importance scaling
- max simultaneous sounds
- priority interrupts

### 13.4 Voice lines can create identity

A small voice pack can make the game feel more expensive.

Start with few high-impact lines:

- “Signal live.”
- “Relay secured.”
- “Core under attack.”
- “Enemy core exposed.”
- “Signal storm incoming.”
- “Victory — signal secured.”
- “Defeat — core breached.”

Do not add 50 lines before the core mix is clean.

---

## 14. Progression tricks

### 14.1 Use three progression layers

Best retention comes from layered goals:

1. **Session goal**: win this match
2. **Short-term goal**: finish daily challenge / unlock title
3. **Long-term goal**: level, rank, cosmetic collection, mastery

### 14.2 Reward effort, not only victory

If new players lose and earn nothing, they leave.

Reward:

- match completion
- relays captured
- damage dealt
- defense events
- close loss
- first time using a squad
- daily progress

Victory should reward more, but defeat should still move something forward.

### 14.3 Use visible unlock ladders

Example:

- 1 match: Recruit title
- 3 matches: Blue core skin
- 5 matches: Veteran title
- 10 wins: Commander banner
- 15 matches: Red alert skin
- 40 matches: Signal Master title

The exact rewards can be simple. Visibility matters more than complexity.

### 14.4 Avoid pay-to-win or ad-to-win in multiplayer

For online 1v1, cosmetics and profile rewards are safe. Competitive stat boosts are dangerous.

Keep rewards:

- visual
- profile-based
- non-ranked bonuses
- PvE-only modifiers

---

## 15. LiveOps tricks

### 15.1 Updates should target metrics, not ego

Every update should answer:

- Which KPI is this meant to improve?
- How will we measure it?
- What player problem does it solve?
- What could it accidentally hurt?

Examples:

- lower warmup → average playtime/conversion
- daily widget → D1/D7
- crash cleanup → crash rate/rating
- new cover → CTR
- better first tutorial → conversion/playtime

### 15.2 Use small frequent polish updates

Browser platforms reward iteration.

Good update rhythm:

- fix onboarding
- improve first fight
- reduce crashes
- add daily widget
- update cover
- add one cosmetic/unlock set
- add one map/modifier

Avoid giant risky rewrites right before launch.

### 15.3 Change only one major variable when possible

If you change warmup, doctrine timing, cover, UI, difficulty, and ads all at once, you cannot know what worked.

For urgent launch windows, bundled fixes are sometimes necessary, but track them carefully.

---

## 16. Analytics tricks

### 16.1 Track the first-session funnel

Events:

- boot_start
- sdk_init_start
- sdk_init_success/fail
- loading_start
- loading_complete
- menu_shown
- play_clicked
- intro_shown
- intro_dismissed/auto_dismissed
- gameplay_start
- first_command
- first_relay_capture
- first_enemy_seen
- first_combat
- first_unit_lost
- first_enemy_killed
- doctrine_picker_shown
- doctrine_selected/timeout
- match_end
- rematch_clicked

### 16.2 Track time-to-key-moments

Measure:

- time to menu
- time to click play
- time to gameplayStart
- time to first input
- time to first capture
- time to first combat
- time to first damage
- time to match end

For Signal Clash, these are more useful than broad opinions like “the game is confusing.”

### 16.3 Track exits around friction points

If exits cluster around:

- intro overlay
- doctrine picker
- matchmaking
- first enemy attack
- first loss
- post-match screen

then the answer is in that moment.

### 16.4 Track modal exposure

Every modal should be measured:

- shown
- dismissed
- ignored
- auto-dismissed
- time open
- exit after modal
- conversion after modal

Modal timing can make or break browser games.

### 16.5 Track versioned metrics

Every analytics event should include game version/build hash.

Otherwise you cannot compare before/after updates.

---

## 17. Signal Clash-specific recommendations

Based on the current analysis, Signal Clash’s most dangerous pattern is likely:

> first-time player sees intro, then relatively empty early map, then gets interrupted by a doctrine picker around the time they are already close to leaving.

The highest-ROI Signal Clash fixes are:

### 17.1 Day 1 fixes

1. Cut Recruit warmup from 90s to around 30s.
2. Auto-dismiss IntroOverlay after 3 seconds.
3. First session default = Recruit, curated map, no customization required.
4. Show first objective visually, not with long text.
5. Ensure first enemy contact by ~45 seconds.

### 17.2 Day 2 fixes

1. Defer Doctrine Picker to match 2 or later.
2. Or auto-pick default doctrine in match 1.
3. Move doctrine explanation to post-match unlock moment.
4. Add visible “Leave Match” button in local and online mode.
5. Make first loss screen explain exactly what happened.

### 17.3 Day 3 fixes

1. Add Daily Challenges widget to main menu.
2. Add cosmetic/title unlock celebration in EndOfMatch.
3. Add “Welcome back” banner using lastSessionDate.
4. Add cloud save hydration logging.
5. Add “1 more match to unlock X” post-match hook.

### 17.4 Stability fixes

1. Audit all audio timers during rematch.
2. Audit RelayTooltip DOM cleanup.
3. Add WebSocket onError visible reconnect banner.
4. Add matchmaking/bot-fill timeout fallbacks.
5. Add stale invite room fallback.
6. Treat stuck lobby as crash-level severity.

### 17.5 Multiplayer feel fixes

1. Increase server snapshots from 10Hz to 20Hz before attempting interpolation.
2. Add client-side interpolation later only when launch-critical bugs are gone.
3. Keep PvP behind clearer onboarding if first-time players are struggling.

---

## 18. The “first 5 minutes” ideal script for Signal Clash

### 0:00–0:05

- Game loads quickly.
- Main menu appears.
- Big Play button pulses.
- Background shows real Signal Clash battle identity.

### 0:05–0:10

- Player clicks Play.
- No difficulty/map/doctrine choice.
- Match starts.
- Camera frames player core and first relay.

### 0:10–0:25

- Pulse on first relay.
- Hint: “Capture this relay.”
- Player clicks/commands.
- Relay connects with satisfying animation.

### 0:25–0:45

- Hint: “Build a squad to defend it.”
- Player builds first squad.
- First enemy warning appears at edge.

### 0:45–1:15

- First enemy arrives.
- Squad fires.
- Player sees hit feedback.
- First enemy dies or player barely survives.
- Toast: “Relay defended.”

### 1:15–2:00

- New objective: “Push toward enemy signal.”
- Player captures next relay.
- Enemy pressure increases.

### 2:00–3:00

- Bigger fight.
- First core damage or first strong defensive moment.
- No doctrine modal.
- No big interruption.

### 3:00–5:00

- Match escalates.
- Player either wins, loses clearly, or reaches dramatic tension.
- Post-match screen shows reward and next goal.

### After match 1

- Unlock doctrine choice.
- Show first daily challenge progress.
- Show “Play again” as dominant button.

---

## 19. The “do not do this” list

Do not:

- block first gameplay with long text
- ask first-time players to configure advanced settings
- delay first enemy contact too long
- show a strategic modal at the average quit time
- hide daily challenges inside profile only
- unlock cosmetics invisibly
- make players close the tab to exit
- trap players in empty multiplayer rooms
- silently fail WebSocket errors
- request ads during active gameplay
- make rewarded ads necessary
- mislead with fake cover art
- redesign HUD right before launch unless the first-minute problem is actually HUD clarity
- add complex interpolation right before launch if 20Hz snapshot rate solves most visible stutter
- add mobile support under pressure if desktop launch is the actual review target

---

## 20. 100 practical CrazyGames tricks checklist

### Storefront / CTR

1. Make the cover readable at tiny size.
2. Use one focal conflict.
3. Show the player fantasy, not generic scenery.
4. Keep cover truthful to gameplay.
5. Use strong foreground/background separation.
6. Use logo/title only, no extra cover text.
7. Avoid borders on covers.
8. Avoid blurry/pixelated visuals.
9. Use matching landscape/square/portrait identity.
10. Update cover after meaningful updates.
11. Make preview video start with gameplay instantly.
12. Avoid cinematic trailer pacing.
13. Show the core loop in the first 5 seconds of the video.
14. Show a win/loss/impact moment in the preview.
15. Keep the game name visually readable.

### Loading / conversion

16. Keep build size lean.
17. Load first playable content first.
18. Lazy-load non-essential assets.
19. Show progress during loading.
20. Avoid blank screens.
21. Call SDK loading start/stop correctly.
22. Initialize SDK during loading.
23. Avoid heavy profile/save UI before first play.
24. Show menu quickly.
25. Make Play the obvious primary button.
26. Hide advanced choices from first-time users.
27. Use curated first-session defaults.
28. Avoid account/login prompts before first play.
29. Avoid long intro text.
30. Auto-dismiss intro overlays.

### First minute

31. Give control within seconds.
32. Show one obvious first objective.
33. Teach with visuals.
34. Use contextual hints.
35. Make first action succeed easily.
36. Celebrate first success.
37. Spawn first threat quickly.
38. Make first threat readable.
39. Avoid irreversible early mistakes.
40. Do not interrupt with modals.
41. Keep controls visible until used.
42. Use animation to show what to click.
43. Make invalid actions explain themselves.
44. Keep screen alive with ambient motion.
45. Keep camera framed on relevant action.

### Session length

46. Add micro-goals every 20–40 seconds.
47. Add intensity waves.
48. Add comeback moments.
49. Avoid dead travel time.
50. Shorten first-session maps.
51. Reduce early waiting.
52. Reward both wins and losses.
53. Make match endings decisive.
54. Put rematch at the emotional peak.
55. Show near-complete progress after matches.

### Retention

56. Save progress visibly.
57. Use Data Module correctly.
58. Log save hydration success/failure.
59. Add daily challenges.
60. Show daily challenges on main menu.
61. Add welcome-back banner.
62. Add lastSessionDate.
63. Add XP/profile level.
64. Add cosmetic/title unlocks.
65. Celebrate unlocks loudly.
66. Show next unlock.
67. Add streaks carefully.
68. Add rotating daily modifiers.
69. Add mastery badges.
70. Add match history.

### Multiplayer

71. Add bot fallback.
72. Add matchmaking timeout.
73. Add cancel matchmaking button.
74. Detect expired invite rooms.
75. Show reconnect banner.
76. Handle opponent left gracefully.
77. Do not make first online match the tutorial.
78. Make bots human-like.
79. Avoid empty lobbies.
80. Track network errors.

### Ads

81. Use ads only after organic metrics are solid.
82. Request midgame ads at natural breaks.
83. Never request ads during active combat.
84. Rewarded ads must be optional.
85. Do not chain rewarded ads.
86. Make skip/continue equal and clear.
87. Mute game audio only when ad starts.
88. Handle no-ad gracefully.
89. Reward visibly after completed rewarded ad.
90. Never reward on ad error.

### Stability / polish

91. Add global error analytics.
92. Add unhandled rejection analytics.
93. Add WebGL context loss handling.
94. Clean up timers on scene shutdown.
95. Clean up DOM overlays.
96. Clean up socket listeners.
97. Add stuck-state watchdogs.
98. Test CrazyGames iframe sizes.
99. Test 20 rematches in a row.
100. Treat every freeze as a crash until proven otherwise.

---

## 21. Release-candidate checklist for Signal Clash

Before pushing the next build, verify:

- [ ] First session reaches gameplay without customization.
- [ ] First player command possible within 10 seconds after Play.
- [ ] First relay capture possible within 30 seconds.
- [ ] First enemy contact happens within ~45 seconds.
- [ ] Doctrine Picker does not interrupt match 1 at 3:00.
- [ ] IntroOverlay auto-dismisses.
- [ ] Recruit bot is active but not boring.
- [ ] Local match has visible Leave Match.
- [ ] Online match has visible Leave/Forfeit behavior.
- [ ] Matchmaking has timeout/fallback.
- [ ] Expired invite links do not trap users.
- [ ] WebSocket errors show UI, not only console warnings.
- [ ] Daily challenge widget appears on main menu.
- [ ] End-of-match shows XP/progress/unlocks.
- [ ] Returning player gets welcome-back/daily reset message.
- [ ] Save hydration status is logged.
- [ ] Sfx timers are cleaned up on rematch.
- [ ] RelayTooltip DOM is cleaned up on scene shutdown.
- [ ] 20 rematches in a row produce no uncaught errors.
- [ ] Game works at 907×510, 1216×684, 1077×606, 821×462, and 1366×768.
- [ ] Cover is readable at 150–250 px.
- [ ] Preview video shows real gameplay in first 2 seconds.

---

## 22. Recommended immediate roadmap

### Patch A — first-minute rescue

Goal: improve conversion and playtime.

- shorten Recruit warmup
- auto-dismiss intro
- hide Customize on first session
- curated first map/defaults
- first enemy contact before 60s
- no doctrine modal in match 1

### Patch B — stuck/crash cleanup

Goal: reduce crash rate and negative ratings.

- audit timers/listeners/DOM cleanup
- reconnect banner
- bot-fill fallback
- stale room fallback
- leave match button
- stuck-state watchdogs

### Patch C — return tomorrow

Goal: improve D1/D7.

- daily challenges main menu widget
- welcome-back banner
- lastSessionDate
- cosmetic unlock celebration
- next-goal post-match card
- save hydration logging

### Patch D — storefront boost

Goal: improve CTR.

- final readable cover set
- preview video based on real gameplay
- title/logo contrast polish
- no misleading visuals
- update cover after gameplay patch

---

## 23. The most important principle

The winning CrazyGames game is not necessarily the deepest game. It is the game that:

1. looks worth clicking,
2. starts fast,
3. makes sense immediately,
4. feels good in the first action,
5. creates a memorable moment quickly,
6. rewards the player even when they lose,
7. saves progress reliably,
8. gives them a reason to return tomorrow,
9. never traps them in broken states,
10. and keeps improving based on data.

For Signal Clash, the path is clear:

> Do not chase more complexity right now. Make the first 5 minutes undeniable.

---

## Source notes

This document is informed by current CrazyGames documentation and platform guidance, especially:

- CrazyGames Basic Launch metrics guide
- CrazyGames Gameplay requirements
- CrazyGames Quality guidelines
- CrazyGames Game covers guide
- CrazyGames Advertisement requirements
- CrazyGames HTML5 SDK Game module documentation
- CrazyGames Data Module documentation
- CrazyGames FAQ / publishing process

It also incorporates Signal Clash-specific observations from the current code/statistics analysis: early-session boredom, 90-second Recruit warmup, blocking IntroOverlay, doctrine picker timing, possible stuck/crash states, cloud-save hydration concerns, hidden daily challenges, and invisible cosmetic unlocks.
