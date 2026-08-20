# Phase 2 — Core Systems

The five systems named in `gameplan.md` §8 Phase 2: **interrogation, notebook,
inventory, rift events, dialogue branching.** They build on the Phase 1
prototype ([`phase-1-prototype.md`](phase-1-prototype.md)) — same
dependency-free ES modules, same 360×640 canvas, same `python3 -m http.server`.

The through-line: *what Tata knows is what Tata can do.* A clue in the notebook
unlocks a line of dialogue. An object in the satchel becomes evidence. Evidence
is the only thing that breaks a liar.

---

## 1. Interrogation

A mode of its own (`src/game/interrogation.js`), not a combat verb. Subjects
live in `src/data/interrogations.js` and hold three tracks:

| Track | Meaning | Empty means |
| --- | --- | --- |
| **Composure** | how well they are holding the story together | they break — you get everything |
| **Trust** | whether they are still talking to *you* | they clam up — nothing more tonight |
| **Patience** | exchanges left before they walk | they leave; you keep what you got |

Four actions:

- **Press** — pick a tone (Calm, Direct, Aggressive, Silent). Rolls `INT × tone`
  against their resistance. Tone moves trust: calm `+1`, direct `0`, silent `−1`,
  aggressive `−2`. Pressing also makes them *say* things, which is the point.
- **Present** — put a piece of evidence against a claim they have already made.
  This is the real weapon: a matching contradiction takes ~40% of composure and
  yields a truth straight into the notebook. Wrong evidence hands them
  composure back and costs trust.
- **Observe** — a PER check against their guard. Marks a stated claim as a lie
  (so you know what to prove) and burns a tell.
- **Back off** — leave with what you have.

Two rules give the mode its shape: a claim can only be broken *after* they make
it, and proving every lie a subject told drops composure to zero outright.

Subjects in the slice: **Sable** the merchant (village, once you have rattled
her) and **the Lantern Keeper** (after the boss fight — Act I's "first
interrogation" from §3).

## 2. Notebook

`src/game/notebook.js`, five tabs, opened with **NOTE**:

- **CASE** — Tata's stats and every clue, in the order she wrote them.
- **PEOPLE** — dossiers built automatically from talking and questioning:
  role, observations, the pressure point that worked, whether they broke.
- **RIFTS** — anomalies witnessed.
- **KIT** — the satchel (below).
- **LORE** — fragments worth keeping.

Pad up/down scrolls, left/right changes tab, tapping outside closes it.

## 3. Inventory

The satchel lives in the notebook's KIT tab, because in Tata's world they are
the same object. Items are declared in `src/data/items.js` in three kinds:

- **consumable** — bandage, cold tonic, smelling salts, rift ward. Usable in the
  field (tap it) or from the battle menu.
- **tool** — one carried at a time, shifting stats: Magnifying Lens (`PER +3`),
  Wax Recorder (`INT +3`), Lined Vest (`RES +3, DEX −1`). Tap to hold, tap
  again to put away.
- **key** — story objects that double as **evidence**: the Blue Capsule, the
  Torn Manifest (dropped by a Crate Crawler), the Keeper's Glass.

Everything that reads a stat goes through `stat('PER')` in `src/game/state.js`,
so a tool in hand changes combat, interrogation and rift-sealing alike.

## 4. Rift events

`src/game/rift.js`. On rift-prone maps (the two well floors), a tear opens a few
paces from Tata and starts a **42-second countdown** shown under the HUD.

- Things come through it — a wisp, a crate, a hound — and shuffle one tile
  toward her every other step she takes. Contact is a fight, and rift-charged
  enemies hit harder.
- **Standing in the tear seals it**: a RES check. Success closes it and leaves a
  Rift Ward behind; failure throws her out for 6 damage. Either way the notebook
  gets an anomaly entry.
- Ignore it and it **collapses on its own**, dropping everything it was holding
  in front of her at once — two charged enemies.

Rifts wait until level 2 and end when she leaves the map.

## 5. Dialogue branching

`src/game/talk.js` walks node trees from `src/data/talks.js`:

```js
node = {
  who, lines, text,                      // narration first, then the spoken line
  effects: { flag, clue, item, lore, profile },
  choices: [{ label, hint, if, effects, to }],
  to,
}
```

`if` filters a choice against the world — `{ item: 'manifest' }`,
`{ clue: 'shockwave' }`, `{ flag: 'wellOpen' }`, `{ notFlag: 'sableBroken' }` —
so the reply list *is* the progress display. Showing Orrin the capsule is only
possible while carrying it; sitting Sable down is only possible once she has
slipped.

All four village NPCs have trees. Two of them lead into interrogations.

---

## How it fits together

```
talk to Nima          → clue: two children missing
fight a Crate Crawler → key item: the torn manifest
talk to Sable         → she says "third bell" unprompted → she can be sat down
interrogate Sable     → present manifest → "closed at dusk" collapses
                      → present the crate clue, then the missing-children clue
                      → every lie proved → she breaks → Wax Recorder (+3 INT)
```

That recorder then makes the Keeper — a harder subject — tractable.

## New and changed files

```
src/data/items.js            consumables, tools, key items/evidence
src/data/talks.js            branching conversation trees
src/data/interrogations.js   subjects, claims, contradictions, outcomes
src/game/notebook.js         the five-tab notebook and the satchel
src/game/talk.js             the talk-tree runner
src/game/interrogation.js    interrogation mode and its screen
src/game/rift.js             rift events
src/game/state.js            inventory, tools, dossiers, anomalies, lore, stat()
src/game/dialogue.js         choice forks on top of the typewriter box
src/game/battle.js           satchel-driven items, rift-charged enemies, stat()
src/game/cutscene.js         new `interro` step
src/game/scripts.js          Act I now ends with the Keeper interrogation
```

Saves moved to `tata-prototype-v2`; a Phase 1 save is ignored rather than
half-loaded.

## Known gaps (Phase 3+)

Regions beyond the village and the well, the rest of the weapons, side quests,
party members, sound.
