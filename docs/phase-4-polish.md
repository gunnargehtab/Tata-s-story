# Phase 4 — Polish

The last roadmap phase from `gameplan.md` §8: **animations, sound, UI,
balancing, browser optimization**. Nothing here adds story — this pass makes
what Phases 1–3 built feel finished, and it keeps the project's founding
constraint: no dependencies, no build step, no binary assets beyond two
generated app icons.

## Sound — `src/engine/audio.js`

Everything is synthesized in WebAudio at runtime, the same way the art is drawn
procedurally at boot: short envelope oscillators and filtered noise for
effects, a sixteen-step sequencer for music. There are no audio files.

- **Effects** — one table (`FX`) is the whole vocabulary: interface taps,
  the dialogue tick, footsteps, doors, coins, gunfire per weapon, hits, the
  morale-break chime, level-up and win/lose jingles, and the rift family
  (open, seal, collapse, and the Act I shockwave). Game code says *what
  happened* (`sfx('breakMorale')`); how that sounds is decided in one place.
- **Music** — eight tracks (`title`, `village`, `forest`, `market`, `dark`,
  `interro`, `battle`, `boss`), each a few string-pattern lanes over a dorian
  scale, deliberately sparse. The scheduler keeps ~250 ms ahead of the audio
  clock from the frame loop; tracks crossfade on scene change. Which track
  plays is a single decision in `sceneMusic()` in `main.js`.
- **A generated reverb** (decaying-noise impulse into a convolver) gives the
  plucks and chimes air without shipping an impulse response.
- **Mobile rules** — the context arms itself on the first pointer/key event
  (autoplay policy), suspends when the tab hides, resumes on return. The
  mute preference persists in `localStorage` (`tata-settings-v1`) and lives
  on the master gain, so the sequencer keeps its place while silent.

## Animations & transitions — `src/engine/fx.js`

- **Ink wipe** between maps: a ragged brush stroke crosses the page, and the
  actual `enterMap` happens at the midpoint under full ink — the new map
  never pops in half-drawn.
- **Iris** in and out of battles, FF-style: a circle of paper closing to
  nothing, then opening on the fight.
- **Floating damage numbers** in battle, hung off whichever renderer drew the
  bodies (the 3D scene's projected rects, or the sprite positions), blue for
  weakness hits, red for hits on Tata, deep blue for morale damage.
- **Low-HP vignette**: the page bleeds red at the edges below 28% HP,
  pulsing like a held breath. Drawn in both the field and battle.
- **The title breathes**: drifting hatch band, Tata's idle bob, the Traveler
  flickering slightly out of phase, and NEW CASE pulsing on a fresh save.

## UI

- **Settings where they belong**: a SOUND toggle on the title screen (placed
  clear of the invisible D-pad hit zones — found by the headless test), and a
  "THE MARGINS" block at the foot of the notebook's CASE tab with sound and
  renderer (2.5D/pixel) toggles.
- **Coin in the HUD**, next to the level — it previously existed only inside
  the notebook and shop.
- Battle menus click: cursor blips, confirm taps, a distinct back sound.

## Balancing — `tools/balance-sim.mjs`

A Node harness that imports the live data tables (enemies, skills, weapons)
and mirrors the combat formulas from `battle.js`, then plays four thousand
fights per matchup. Run it with `node tools/balance-sim.mjs`. What it found,
and what changed:

- **Attack ignored the equipped weapon** — `playerAttack` hardcoded the SMG's
  tag and no weapon bonus, so every shop purchase was cosmetic. Fixed: damage,
  accuracy, the weakness tag, and the flare's blind chance all come from what
  Tata holds.
- **In-battle interrogation one-shotted everything** (morale 3–6 against
  rolls of 6–10). Regular enemies' morale/RES raised so a break takes two or
  three questions and the tone choice matters.
- **The Rift Stag was a 98% attack-only walkover** for an act boss. Now
  96 HP / atk 12 / def 4: 87% attack-only at L4, 100% with skills — craft is
  rewarded, mashing is survivable but costly. The Keeper's curve
  (~67% at L2, 97% at L3) was already right and is untouched.
- **The weapon price ladder bought nothing** — the snub revolver's −10
  accuracy cancelled its damage, the rivet driver tied the 45-coin baton.
  Revolver hit −10→−6, driver atk 9→11.
- **XP table extended** to level 8 (`…340, 520, 760`) so late Act II play
  keeps paying out.

## Browser optimization

- **Offline and installable**: `sw.js` precaches the whole game (it is a
  fixed list of small files) and serves network-first, so a deploy always
  wins while online and the cache only answers when the network can't.
  `manifest.webmanifest` plus two generated ink-style icons make it
  installable to a home screen. When a file is added to `src/`, add it to
  the `CORE` list in `sw.js`.
- **Lifecycle**: on `visibilitychange` the audio context suspends and the
  frame clock resets, so returning to the tab neither bursts queued notes
  nor lurches the simulation.

## Verification

Driven headless in Chromium (SwiftShader WebGL2) with zero page or console
errors: title → sound toggle (persisted) → new case → the intro → walking
through the room door under the wipe → the village → a two-enemy battle
through the iris with damage pops → the win path back to the field →
notebook settings row → the pixel-fallback toggle → the dark well with the
low-HP vignette. The service worker registers and the icons render.

Two real bugs were caught by that run and fixed: the title sound button was
originally placed inside the D-pad's invisible hit zone (`classify()` claims
those first, so the button was untappable), and Tata's damage pops rose over
the enemy morale bars where they read as enemy damage.
