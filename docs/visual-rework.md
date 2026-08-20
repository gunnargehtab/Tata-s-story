# Visual Rework — 2.5D fields, low-poly cast, 3D battles

Issue #4 asked for a Final Fantasy VII (1997) look: **pre-rendered backgrounds,
low-poly characters, real-time 3D battles**, in a browser, on a phone, in the
sketchbook style. This is that pipeline, built as a small WebGL2 renderer inside
the existing project — no Babylon, no Vite, no npm, still `python3 -m
http.server` and still zero dependencies.

The 2D pixel renderer from Phases 1–2 is **not** gone: it is the fallback. If
WebGL2 is missing or a shader refuses to compile, `gfxEnabled()` stays false and
every drawing site takes the old path. `TATA_GFX.set(false)` in the console
switches back at any time.

---

## 1. Why not Babylon.js

The issue recommended Babylon. The repo's constraint is stronger than the
recommendation: this game has no build step, no package manager and no bundled
assets, and it must load off a static file server. Babylon means either a ~4 MB
CDN script (so the game stops working offline, and still without an asset
pipeline) or adopting npm + Vite wholesale.

What Babylon would actually have supplied here is a scene graph, a glTF loader
and a shader pipeline. The scene is a tile map, the models are generated in code
rather than loaded, and the shading is three uniforms and a hatch function — so
what is left is about 1,200 lines of renderer, which is what `src/gfx/` is. Every
FFVII-shaped feature from the issue is implemented; only the vendor is different.

---

## 2. The field pipeline (the FFVII part)

FFVII's field scenes are a pre-rendered image with a matching depth buffer;
characters are real 3D drawn on top, and the stored depth is what makes a
character disappear behind a pillar that is only a picture.

That is exactly what happens here, per map:

1. **Model** — `env.js` turns the tile grid into one world-space mesh: houses,
   roofs, trees, the well, fences, crates, shelves, rubble, stairs, rift-torn
   ground. One tile = one world unit.
2. **Bake** — `field.js` renders that mesh once into a render target that keeps
   **both** colour and depth as textures (`gl.js: renderTarget`). This is the
   "pre-rendered background", produced at load instead of in Blender.
3. **Paste** — each frame, the visible slice of the bake is blitted back with a
   full-screen triangle whose fragment shader writes `gl_FragDepth` from the
   baked depth texture. Colour *and* depth are restored.
4. **Characters** — only the cast is drawn live, into that restored depth. Tata
   walks behind the well and the well hides her, though the well is a flat image.

A field frame is therefore one blit plus two draw calls per visible body.

### The camera, and why it is orthographic

A fixed 40° three-quarter view. Orthographic rather than perspective, and that is
a deliberate trade: under an orthographic camera, panning is a pure translation,
so **one bake stays valid across a whole scrolling map** — the depth values do
not depend on where the camera is. A perspective field camera would need a
re-bake (or a per-screen bake) every time the view moved.

It also keeps the tile grid axis-aligned on screen, so `fieldProject` /
`fieldUnproject` are cheap and exact, and tap-to-move still lands on the tile the
player meant.

### Near-side walls are cut

The camera looks from the south, so the south wall of a room stands between the
lens and the floor behind it — Tata was invisible in her own bedroom. FFVII
simply did not model those walls. Here they are trimmed to knee height
(`CUTTABLE` in `env.js`): a wall tile whose north neighbour is walkable becomes a
low sawn wall. Roofs are exempt, so houses still look like houses.

---

## 3. The cast

`models.js` builds every character in code as a **rigid part hierarchy** — the
PlayStation field-model trick, where a character is a bag of boxes pinned to
joints rather than a skinned mesh. Tata is about 380 triangles; the issue asked
for 300–800.

| Part | Used for |
| --- | --- |
| `ROOT`, `TORSO` | whole-body lean, breath, lunge |
| `HEAD`, `HAT` | the hat tilt from `gameplan.md` §6 |
| `ARM_L/R`, `LEG_L/R` | gait, swings |
| `PROP` | SMG, notebook, ledger, pike, lantern pole |
| `EXTRA` | satchel, apron, tail, cloak drag |

Geometry is authored around each pivot; `anim.js` supplies rotations. Clips are
closed-form functions of time — `idle`, `walk`, `attack`, `cast`, `interrogate`,
`hurt`, `down` — layered over a per-rig gait (`human`, `quad`, `float`,
`scuttle`, `glide`). Nothing is baked, so a pose costs a dozen matrix composes.

Cast: Tata (hat, hair, coat, satchel, compact SMG), the Traveler (a cloak with a
person rumoured inside it), five villager builds, the dog, and the bestiary —
Lantern Wisp, Crate Crawler, Rift Hound, the Lantern Keeper — plus the rift
itself as a standing tear.

---

## 4. Battles in full 3D

`battle3d.js` renders the arena live into the top 252 px of the frame; the ink UI
is drawn over it on the 2D canvas, so menus stay crisp at any scale.

- Perspective camera on a long lens (27°) with a slow drift, jolted on impact.
  The long lens is what keeps Tata and the enemies the same size on screen.
- Enemies hold the left of frame, Tata the right — the FFVII party split.
- Particles: impact sparks, expanding ground rings, muzzle flash on the burst,
  blue for rift damage and skills.
- Clips are driven from the battle's own resolution code: `fxAct` on Attack /
  Skill / Interrogate, `fxHit` on damage, `down` when something comes apart.
- The renderer returns projected screen rects for each enemy, so tap-targeting
  and the HP/morale bars stay attached to the models. Crowded fights fall back to
  evenly spaced label slots while the target arrow stays on the model.

---

## 5. The ink look

One shader does the work (`shaders.js`):

- **Flat toon banding.** Four hard bands off `N·L`, no smooth ramp.
- **Cross-hatch.** In the shadow bands, a screen-space hatch — one direction in
  mid-shadow, crossed in the darkest — mixed toward ink. This is the sketchbook.
- **Outlines.** A second pass over expanded backfaces in flat ink.
- **PS1 vertex snapping.** `uSnap` quantises clip-space XY to a coarse grid, so
  field characters wobble the way PlayStation models did. Battle models leave it
  off — those are the close-ups.
- **Fog to paper.** Distance fades scenery into the page; underground it fades to
  near-black instead, and Tata's flashlight punches the only hole in it.

Colours all come from `art/palette.js`, so the 3D and the 2D renderer agree.

---

## 6. Code map

| File | Does |
| --- | --- |
| `gfx/index.js` | public API, capability check, error guard, fallback switch |
| `gfx/gl.js` | WebGL2 context, programs, meshes, colour+depth render targets |
| `gfx/shaders.js` | the toon/ink program and the background blit |
| `gfx/math.js` | mat4 helpers |
| `gfx/mesh.js` | box / frustum / prism / cylinder / plane / card builder |
| `gfx/models.js` | the cast, rigs, pivots, heights |
| `gfx/anim.js` | animation clips and gaits |
| `gfx/env.js` | tile map → environment geometry, near-wall cutting |
| `gfx/field.js` | bake, camera, blit, character pass, projection helpers |
| `gfx/worldview.js` | one field frame: background + every body in the map |
| `gfx/battle3d.js` | the battle arena, particles, animation beats, hit rects |

Touched elsewhere: `main.js` (init), `game/world.js` (3D field branch,
body-aware tap targeting), `game/battle.js` (fx hooks, 3D enemy labels).

---

## 7. Swapping in real Blender assets

Nothing here assumes the art stays procedural — the runtime model is the same one
the issue describes, so hand-made assets drop into the same slots:

- **Backgrounds.** `bakeField()` produces `{ color, depth }` textures. A Blender
  render plus its depth pass can be uploaded into those two textures instead of
  rendered; everything downstream (blit, occlusion, camera) is unchanged, as long
  as the render uses the same 40° orthographic camera and the same near/far.
- **Characters.** `modelData(id)` returns interleaved `pos/normal/colour/part`
  vertices. A glTF loader that emits the same layout, with node indices mapped to
  the rig's part slots, would let `anim.js` drive imported models untouched.

---

## 8. Known gaps

- Baked backgrounds are capped at 2048 px; a map larger than ~60 tiles across
  would need tiling the bake.
- Tapping the *face* of tall scenery selects the ground tile behind it. Bodies
  and interactables are hit-tested properly, which is what tap-to-move needs.
- The interrogation mode is still fully 2D — it is a notebook scene, and the ink
  UI reads better than a 3D bust would.
- No shadows under characters yet; the toon banding carries the grounding.
