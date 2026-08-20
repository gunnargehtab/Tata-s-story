# Tata-s-story
Tata’s story starts with a sound she shouldn’t have heard.

---

🌒 The Beginning — “The Whisper Under the Floorboards”

Tata is twelve, but she carries herself like someone who has already lived three lifetimes. Long, straight black hair tucked under her oversized Borsalino hat, notebook always in her pocket, and a habit of narrating her own life like a noir detective. In her village, she’s known for two things:  
1. Asking questions adults don’t want to answer  
2. Carrying strange, modern gadgets no one understands  

The world around her is pure fantasy — moonlit forests, rune-lit taverns, wandering bards — but Tata’s world is also threaded with contemporary weapons, surveillance toys, and social tensions that feel too modern for the setting. She doesn’t know why these things exist. She only knows she’s good at using them.

One late-autumn evening, while reading The Silent Man’s Ledger (her favorite detective novel), she hears a faint tap… tap… tap beneath the floorboards of her room. Not footsteps. Not pipes. A pattern. A code.

She drops to her knees, presses her ear to the wood, and hears it again — three taps, pause, two taps, pause, one tap.

A message.

She pries up the loose board she discovered months ago and finds something new inside:  
A small metal capsule, warm to the touch, humming with a soft blue light. Inside it is a folded scrap of paper, written in a hurried hand:

> “He’s here. The traveler. Don’t let him leave.”

No signature. No explanation.

Tata’s pulse spikes. She grabs her satchel — notebook, flashlight, compact SMG, magnifying glass — and slips out into the night. The village is quiet, but not normal quiet. Lanterns flicker. Dogs whine. The air feels charged, like the world is holding its breath.

At the edge of the village, near the old well, she sees him.

A tall figure wrapped in a traveler’s cloak, face hidden, posture still. He stands as if waiting for someone — or as if he already knows she’s coming.

Tata steps forward, hat brim low, voice steady.

“Sir,” she says, “I have questions.”

The traveler lifts his head slightly. She can’t see his face, but she feels his gaze like a weight.

“Tata,” he says — speaking her name before she ever gave it — “you’re already late.”

And then the ground trembles.

A ripple of blue light spreads across the village, like a shockwave passing through reality itself. Lanterns shatter. Birds scatter. The traveler turns and begins to walk away.

Tata runs after him.

Because she’s twelve.  
Because she’s a detective.  
Because someone warned her not to let him leave.  
And because the world just changed — and she intends to find out why.

---
## ▶ Play the prototype

Phases 1–3 of the roadmap in [`gameplan.md`](gameplan.md) are playable — Acts I
and II end to end: the village, the Old Well, the Rift Forest, Market City and
the Archives, with turn-based combat, interrogations, the detective notebook,
weapons, a shop, side quests, rift events and branching dialogue.
No dependencies, no build step:

```sh
python3 -m http.server 8000
```

…then open `http://localhost:8000` (best on a phone, or a narrow browser window).
Details, controls and the code map are in
[`docs/phase-1-prototype.md`](docs/phase-1-prototype.md); the Phase 2 systems are
written up in [`docs/phase-2-systems.md`](docs/phase-2-systems.md) and the Phase 3
regions, weapons and quests in [`docs/phase-3-content.md`](docs/phase-3-content.md).

### The look

The game now renders in **2.5D**, the way Final Fantasy VII did it: each map is
modelled in 3D and baked once into a background image *and its depth buffer*,
then low-poly characters are drawn live on top — so Tata is correctly hidden when
she walks behind a house that is only a picture. Battles are full real-time 3D.
Everything is toon-shaded with cross-hatch ink and PS1-style vertex wobble, and
it is all still one static folder with no dependencies and no build step.

If WebGL2 is unavailable the game falls back to the original pixel renderer on
its own; `TATA_GFX.set(false)` in the console switches back by hand. The pipeline
is written up in [`docs/visual-rework.md`](docs/visual-rework.md).