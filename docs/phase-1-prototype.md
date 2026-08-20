# Phase 1 — Prototype

The playable slice described in `gameplan.md` §8: **movement, basic combat, the first
village, Tata & Traveler sprites, one dungeon.** No build step, no dependencies —
open it in a mobile browser and play.

## Running it

The game is plain ES modules, so it needs to be served over HTTP (not `file://`):

```sh
python3 -m http.server 8000     # or: npx serve .
```

Then open `http://localhost:8000` — on a phone, or in a desktop browser with a
narrow window. The field is a fixed 360×640 logical canvas scaled to fit.

## Controls

| Touch | Keyboard | Does |
| --- | --- | --- |
| tap a tile | arrows / WASD | walk (tap paths around obstacles) |
| tap a person or object | — | walk over and interact |
| **LOOK** button | Space / Enter | talk, open, read the tile in front |
| **NOTE** button | N / Tab | detective notebook (clue log) |
| tap a menu row | arrows + Space | choose a battle command |
| tap anywhere | Space | advance dialogue |

## What's in the slice

**Act I, scene one.** The tapping under the floorboards → the capsule → the
Traveler at the old well → the blue shockwave → the Old Well dungeon → the
Lantern Keeper.

- **Tata's room** — the loose board, the capsule note.
- **Tata's Village** — five NPCs (merchant, archivist, watch, teacher, a dog),
  each with pre- and post-shockwave dialogue and a clue for the notebook; bolted
  doors; the boarded well.
- **The Old Well** — two floors, random encounters, a rift-lit maze, a flashlight
  vignette, and the Keeper's chamber.
- **Combat** — FF1-style menu: Attack, Skill, Item, Interrogate, Run.
- **Bestiary** — Lantern Wisp, Crate Crawler, Rift Hound, and the Lantern Keeper.

## Systems

### Stats (gameplan §4)

`INT` interrogation · `DEX` accuracy and evasion · `PER` perception ·
`RES` rift resistance, plus HP and **FOC** (focus, the cost pool for skills).
Levelling is a small fixed table in `src/game/state.js`.

### Combat loop

Tata commands first, then every living enemy acts. Hit chance is a DEX
differential; damage is `atk × power` against the enemy's defence.

| Command | Notes |
| --- | --- |
| Attack | Compact SMG. Tagged `smg` for weakness matching. |
| Skill | Suppressing Burst (`smg`), Folding Baton (`baton`), Flashbang (`flashbang`, stuns), Drone Sweep (`drone`, reveals the weakness and marks the target). Costs FOC. |
| Item | Bandage (HP), Cold Tonic (FOC). |
| Interrogate | Pick a tone — Calm, Direct, Aggressive, Silent. Rolls `INT × tone` against the enemy's `RES`; drains **morale**. |
| Run | DEX check. Disabled in the boss chamber. |

Every enemy hides a **weakness** until a drone sweep or a strong interrogation
reveals it; hitting it multiplies damage by 1.75.

**Interrogation is the alternate win condition.** Empty an enemy's morale and it
breaks off instead of dying: you get its clue and 60% of the XP, and it says
something on the way out. That's the Phase 1 seed of the full system in Phase 2.

### Notebook

Clues from scripted beats, NPCs and broken enemies are written into
`G.clues`; the NOTE button shows the log. Phase 2 grew this into the full
notebook — dossiers, anomalies and the satchel. See
[`phase-2-systems.md`](phase-2-systems.md).

### Saving

Progress is written to `localStorage` on every map change, script beat and battle
end. **CONTINUE** on the title screen restores it; **NEW CASE** clears it.

## Code map

```
index.html            canvas shell
src/style.css         the page around the canvas (everything else is drawn)
src/main.js           boot, title screen, the frame loop
src/art/palette.js    the ink palette — near-black, paper, one rift blue
src/art/pixel.js      string-grid → canvas compiler, walk/tilt/flip/trim helpers
src/art/sprites.js    Tata, the Traveler, NPC variants, the dog, the bestiary
src/art/tiles.js      procedural 16px tiles (4 hatching variants each)
src/engine/input.js   pointer + keyboard, the ink D-pad hit rects
src/engine/ui.js      panels, text, wrapping, bars, on-screen controls
src/data/maps.js      the four maps, their NPCs, warps and triggers
src/data/enemies.js   bestiary stats, weaknesses, morale, break lines
src/data/skills.js    skills, items, interrogation tones
src/game/state.js     the live game state, levelling, save/load
src/game/world.js     movement, pathfinding, triggers, encounters, rendering
src/game/battle.js    the turn loop and the battle screen
src/game/dialogue.js  the typewriter dialogue box
src/game/cutscene.js  the scripted-beat runner
src/game/scripts.js   the Act I beats
```

### Art pipeline

Sprites are string grids compiled to canvases at boot (`src/art/pixel.js`), so
there are no image assets to load. From one grid per facing the compiler derives
the walk shuffle (bottom rows shifted a pixel), the idle hat tilt (top rows
shifted a pixel) and the mirrored side view — the animation set in gameplan §6
from three hand-drawn poses.

Tiles are drawn procedurally with seeded hatching, four variants per tile picked
by position so ground never visibly tiles.

## Adding content

- **A map**: add a grid to `src/data/maps.js` with its `npcs`, `warps`,
  `triggers`, `interacts` and `encounters`. Legend is at the top of the file.
- **A story beat**: add a step array to `src/game/scripts.js` and point a
  trigger or interact at it. Steps: `say`, `wait`, `flash`, `spawn`, `walk`,
  `despawn`, `flag`, `battle`, `enterMap`, `fn`, `save`.
- **An enemy**: add an entry to `src/data/enemies.js` and a sprite grid to
  `src/art/sprites.js`, then drop its id into a map's encounter pool.

## Known gaps at the end of Phase 1

Full interrogation flow, inventory screen, rift events and branching dialogue —
all delivered in [Phase 2](phase-2-systems.md). Still open: sound, the remaining
regions, and party members beyond Tata.

## Debugging

`window.TATA` is the live state object and `window.TATA_DEBUG` exposes the
dialogue, cutscene and world modules — handy from a phone's remote inspector.
