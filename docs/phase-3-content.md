# Phase 3 — Content

`gameplan.md` §8 Phase 3: **regions, NPCs, weapons, main story, side quests.**
Built on the Phase 1 prototype and the Phase 2 systems, and drawn by whichever
renderer is live (the 2.5D field or the pixel fallback) without either one
needing to know about the new content.

---

## Regions

Three new maps continue the road out of the village.

| Region | What it is | Notable |
| --- | --- | --- |
| **The Rift Forest** | The road north. Trees that stand where they did not stand yesterday. | The cairn, the Rift Stag, rift events |
| **Market City — Low Quay** | Paved streets, stalls, warehouses and a dock the water is too cold for. | The quay stall (shop), four NPCs, an interrogation |
| **The Archives** | A dark stack room in the city. | Three surviving records of the sealed year |

The village's south road now leaves the map: village → forest → market → archives,
and back. Every new map is built from the existing tile alphabet, so both
renderers draw them with no new art code.

## The cast

| Who | Where | What they are for |
| --- | --- | --- |
| **Wren**, a forager | Rift Forest | The stag's route, and what it carries in its antlers |
| **Halloran**, harbourmaster | Low Quay | Signs for everything. Act II's interrogation |
| **Pell**, a fence | Low Quay | Buys rift-cold coin. Pays in a weapon |
| **Quill**, a stallholder | Low Quay | Points at the other two |
| **Odo**, a boy on the quay | Low Quay | One of the missing children, returned and changed |
| **Vess**, keeper of records | Archives | The sealed year, and what it cost to seal |

All six have branching trees in `src/data/talks.js`, and Nima's village tree
grew a job to hand out and a register to take back.

## Weapons

`src/data/weapons.js`. Tata's basic **Attack** takes its damage, accuracy and —
the part that matters — its **tag** from whatever she is holding, so the weapon
decides which enemy weaknesses a plain attack can exploit.

| Weapon | Damage | Aim | Tag | Where |
| --- | --- | --- | --- | --- |
| Compact SMG | +0 | +0 | smg | hers already |
| Folding Baton | +3 | +8 | baton | quay stall, 45 |
| Snub Revolver | +6 | −10 | smg | quay stall, 110 |
| Flare Pistol | +2 | +0 | flashbang | Pell's payment — and it blinds |
| Rivet Driver | +9 | −8 | baton | quay stall, 210 |

Swap weapons in the notebook's **KIT** tab under HANDS.

## Coin and the quay stall

Enemies drop coin; rift-charged ones also drop **rift-cold coin**, which is both
a fence's currency and evidence in an interrogation. The stall (`src/game/shop.js`)
buys and sells: BUY lists consumables and the weapons Tata does not own yet,
SELL takes anything in the satchel at half price.

## Side quests

`src/data/quests.js`, tracked in the notebook's new **JOBS** tab.

- **The Missing Register** (Nima) — the register went north in someone's coat.
  The stag carries it. Return it and a third, scratched-out name appears.
- **Cold Coin** (Pell) — three rift-cold coins buys the Flare Pistol, and the
  first real answer about who is paying.
- **Third Bell** (Sable / Pell) — find who meets the boat. Ends in Halloran.
- **The Sealed Year** (Vess) — three records that survived the year every
  archive is missing.

Quests are advanced declaratively: a talk effect (`startQuest`, `advanceQuest`,
`finishQuest`) or a script call. Rewards — coin, items, weapons, clues, lore —
are paid once, when the job closes.

## Main story — Act II, "The Rifts"

The road out of the village, in order:

1. **The forest road.** Cargo goes somewhere; roads are the somewhere written down.
2. **The cairn.** A toll older than the village, and its offerings turn to face
   the road overnight.
3. **The Rift Stag** — a boss that walks a fixed line (shrine, village, well)
   and carries what the cairn is owed, including a school register.
4. **Market City.** Odo is on the quay, alive, counted twice and returned wrong.
5. **Halloran** breaks: the crossing runs on his signature, paid in cold coin,
   checked each time by a man in a traveller's cloak.
6. **The Archives.** Three surviving records put the sealed year back together:
   something came up the well before, and the village agreed to stop writing.
7. **The road home** closes the act on three facts that only fit together if the
   Traveler has done this before — and a warning in Tata's own handwriting.

Act III (the Collapsing City, the final interrogation) picks up from there.

## New files and changes

```
src/data/weapons.js          the five weapons and their tags
src/data/quests.js           four side quests and their rewards
src/game/shop.js             the quay stall scene
src/data/maps.js             forest, market and archives; the village road out
src/data/talks.js            six new trees, plus Nima's job
src/data/interrogations.js   Halloran
src/data/enemies.js          Clockwork Rat, the Rift Stag, coin drops
src/data/items.js            rift-cold coin, the school register
src/art/sprites.js           2D art for the rat and the stag
src/gfx/models.js            3D models, rigs and heights for both
src/game/state.js            weapons, coin, quest state
src/game/notebook.js         JOBS tab, HANDS and SPOILS sections, coin
src/game/battle.js           weapon-driven attacks, coin and drops
src/game/talk.js             quest/coin/weapon effects and conditions
src/game/scripts.js          Act II beats
```

## Known gaps (Phase 4)

Act III and the Collapsing City, sound, animation polish, balancing, and the
browser-performance pass.
