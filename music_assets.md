# 🎵 Starfall Garden — Music Assets & Suno Prompts

Prompts for generating the game soundtrack with **Suno** (instrumental). These
replace the procedural Web-Audio music in `src/audio/music.ts`.

The current engine reacts to three states — `factory` (garden hub), `raid`
(night flight, with adaptive **base → tension → danger** intensity), and `idle`
— plus the Weekly Boss and the win/lose summary moments. Real generated tracks
can't be stacked as perfectly-aligned stems the way the synth layers are, so the
plan is **one loop per mood**, with the night-flight using **two intensity
versions (cruise + intense) at the same BPM/key** that the game cross-fades.

---

## Shared sonic identity (read first)

Keep every track in the **same magical-cozy world** so they feel like one score:

- **Palette:** celesta, glockenspiel, music box, harp, pizzicato strings, warm
  flute/clarinet, soft "oohs" choir, gentle marimba/bells, light hand
  percussion, plucked acoustic guitar, soft dreamy synth pads.
- **Reference vibe:** *Stardew Valley*, *Ori*, *Animal Crossing*, *Genshin*
  cozy zones, Studio-Ghibli-lite. Whimsical, twinkly, hopeful, gentle — never
  dark, harsh, or scary (kids-friendly).
- **Key family:** keep things around **D major** (boss in **D minor**) so
  tracks blend.
- **Always include:** `instrumental, no vocals, seamless loop, minimal intro,
  no big outro, steady and consistent`.

**Suno how-to:** Custom Mode → **Instrumental toggle ON**, paste the *Style* line
into the Style box, leave lyrics empty. Songs run 2–4 min — fine, the game loops
the file. For the short **stings**, ask for a "10–15 second musical sting."
Download **WAV/MP3**, then convert to **.ogg + .mp3** (~96–128 kbps) for the web.

---

## 1. Main Theme — *"Starfall Garden"* (title / loading / trailer)
**Plays:** loading screen + marketing. File: `music-theme`

```
whimsical magical fantasy theme, cozy storybook orchestral, celesta and
glockenspiel melody, warm harp and pizzicato strings, soft flute, gentle bells,
dreamy and hopeful, twinkly nighttime wonder, D major, 92 BPM, instrumental,
uplifting and inviting
```

**Direction:** A memorable, hummable melody that says "magical night-garden
adventure." Soft sparkle intro → warm hopeful theme. This is the brand tune.
**Avoid:** epic war drums, dubstep, dark/horror, heavy distortion, vocals.

---

## 2. Garden Hub — *"Moonlit Garden"* (home-base loop)
**Plays:** the garden hub (`factory` mode) — building / upgrading. File: `music-hub`

```
cozy relaxing fantasy garden music, slow gentle music box and celesta, soft harp,
warm acoustic guitar, mellow flute, light marimba, calm dreamy pads, soothing
nighttime ambience, D major, 84 BPM, instrumental, seamless loop, peaceful and
content, no drums or very soft brushed percussion
```

**Direction:** Low-key, "leave it on for an hour" tending-the-garden music.
Spacious, unhurried, soft — never demands attention.
**Avoid:** building tension, fast arpeggios, anything urgent or sad.

---

## 3. Night Flight — *"Moonlight Cruise"* (raid, low intensity)
**Plays:** night flight when calm (the **base** layer). File: `music-flight`

```
playful magical adventure, bouncy and twinkly, light pizzicato strings, celesta
and glockenspiel, soft claps and shaker, plucked harp ostinato, breezy flute
melody, soft synth bells, gentle driving groove, D major, 112 BPM, instrumental,
seamless loop, fun and adventurous but light
```

**Direction:** Friendly, skippy "flying through the stars" energy. Forward motion
without stress. **Same 112 BPM + D major as #4** so they blend.
**Avoid:** heaviness, dark tones, aggressive synths.

---

## 4. Night Flight — *"Starfall Rush"* (raid, high intensity)
**Plays:** cross-faded in as danger rises (the **tension/danger** layers). File: `music-flight-intense`

```
exciting magical action, energetic orchestral pop, driving taiko-lite and tom
percussion, fast pizzicato and staccato strings, bright brass stabs softened with
bells, urgent celesta arpeggios, soaring flute, heroic and thrilling but still
bright and kid-friendly, D major, 112 BPM, instrumental, seamless loop
```

**Direction:** Same tune-world as #3 but pumped up — more percussion, faster
runs, bigger melody. Thrilling, not threatening. **Must match #3's 112 BPM +
D major** for a clean cross-fade.
**Avoid:** scary/horror, screaming leads, harsh distortion.

> Tip: generate #3 first, then make #4 with Suno **"Cover/Remix"** on the #3
> result (or reuse the exact BPM/key) so the two share DNA and blend smoothly.

---

## 5. Eclipse Spirit — *"The Eclipse Awakens"* (Weekly Boss)
**Plays:** the weekly boss fight. File: `music-boss`

```
magical boss battle, dramatic and epic but whimsical, big orchestral with choir
oohs, pounding taiko drums, soaring strings, bright brass and bells, mysterious
celesta motif, fantasy adventure climax, D minor turning hopeful, 140 BPM,
instrumental, seamless loop, grand and exciting not scary
```

**Direction:** The big set-piece. Mysterious eclipse opening → driving heroic
battle groove. Dark-ish color (D minor) but still sparkly and triumphant — a
cute monster, not a nightmare.
**Avoid:** true horror, demonic tones, gore-metal.

---

## 6. Victory Sting — *"Flight Complete!"* (success summary)
**Plays:** one-shot when you fly home with loot. File: `sting-victory`

```
short triumphant fanfare, bright celesta and glockenspiel, harp glissando,
sparkly bells, warm rising flute, cheerful and rewarding, D major, instrumental,
10-15 second musical sting with a satisfying final chord, no loop
```

**Direction:** Quick, joyful "ta-daa!" reward cue. Ends cleanly on a bright chord.

---

## 7. Defeat Sting — *"Aw, Dawn Broke"* (failure summary)
**Plays:** one-shot when a flight is lost / dawn breaks. File: `sting-defeat`

```
short gentle bittersweet cue, soft music box and harp, mellow descending flute,
tender and a little sleepy, comforting not punishing, D major to soft minor and
back, instrumental, 8-12 second musical sting, no loop
```

**Direction:** Cozy "aww, try again" — encouraging, never a harsh "you lose"
buzzer. This is a kids' game; failure should feel soft.

---

## 8. (Optional) Reward Fanfare — *"Bloom!"* (level-up / daily gift / big reward)
**Plays:** level-ups, daily gift, rare rewards. File: `sting-bloom`

```
very short magical reward sparkle, ascending celesta and glockenspiel run, harp
glissando, twinkle bells, bright and delightful, D major, instrumental, 4-7
second sting, ends on a happy chime
```

**Direction:** Tiny dopamine sparkle. *(These moments are often better as short
SFX; generate a musical version only if you want one.)*

---

## Track summary & usage

| # | Track | Game state | File (suggested) | Loop? |
|---|-------|-----------|------------------|-------|
| 1 | Main Theme | Loading / branding | `music-theme` | loop |
| 2 | Moonlit Garden | Hub (`factory`) | `music-hub` | loop |
| 3 | Moonlight Cruise | Night flight – calm | `music-flight` | loop |
| 4 | Starfall Rush | Night flight – intense | `music-flight-intense` | loop |
| 5 | The Eclipse Awakens | Weekly Boss | `music-boss` | loop |
| 6 | Flight Complete! | Win summary | `sting-victory` | one-shot |
| 7 | Aw, Dawn Broke | Lose summary | `sting-defeat` | one-shot |
| 8 | Bloom! (optional) | Level-up / rewards | `sting-bloom` | one-shot |

**Minimum viable set:** #2 (hub), #3 (one flight track), #5 (boss). The rest is polish.

---

## Delivery & integration

1. Export each from Suno as WAV/MP3.
2. Convert to **`.ogg` (+ `.mp3` fallback)**, ~96–128 kbps, and place in
   `public/assets/audio/` using the filenames above (e.g. `music-hub.ogg`).
3. Keep loop files reasonably short (~1–2 min) to keep download size low for
   CrazyGames; trim to a clean loopable region if Suno added a long intro/outro.

Integration work (code, to be done once files exist):
- Replace the synth `MusicEngine` with a small **file-based player** (preload,
  loop, gain cross-fade) routed through the existing `AudioBus` so the mute /
  volume sliders keep working.
- `startFactory()` → hub loop; `startRaid()` → cross-fade **Moonlight Cruise ⇄
  Starfall Rush** driven by the existing `setIntensity(tension, danger)`.
- Add a `startBoss()` hook for the Eclipse Spirit (currently reuses raid music).
- Fire the victory/defeat stings from `SummaryScene`.
- Keep the procedural synth as a **fallback** until the files are present, so the
  game never ships silent.
