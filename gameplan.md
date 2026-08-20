Game Plan — "Tata & The Traveler"

A mobile browser RPG inspired by stylized sketchbook art, classic Final Fantasy I mechanics, and a detective‑fantasy narrative.

1. Core Identity

Genre: Fantasy Detective RPGPlatform: Mobile Browser (touch‑friendly, lightweight assets)Visual Style: 2.5D in the FFVII mould — pre‑rendered backgrounds, low‑poly characters, 3D battles — shaded like ink sketches: long silhouettes, wide hats, minimal faces, cross‑hatch shading.Narrative Tone: Noir detective energy through a 12‑year‑old protagonist in a fantasy world with modern weapons and social issues.

2. Main Characters

Tata

12 years old, detective mindset

Long straight black hair, Borsalino hat

Carries modern weapons

Combat role: Tactical Ranger / Investigator

Unique mechanic: Interrogation

The Traveler

Cloaked, mysterious figure

Appears at the beginning, triggers main quest

Connected to reality‑distorting rifts

NPCs

Stylized silhouettes inspired by sketches

Roles: merchant, archivist, guard, smuggler, teacher, etc.

3. Story Structure

Act I — The Whisper Under the Floorboards

Tata discovers coded tapping beneath her room

Finds capsule: "He’s here. The traveler. Don’t let him leave."

Traveler appears → blue shockwave → village destabilizes

First dungeon: The Old Well

First interrogation: The Lantern Keeper

Act II — The Rifts

Rifts distort creatures and environments

Social issues emerge: corruption, missing children, exploitation

Tata gains allies: Archivist, Runic Engineer, Dog

Act III — The Traveler’s Truth

Traveler is a messenger warning of collapse

Capsule sent by Tata’s future self

Final dungeon: The Collapsing City

Final interrogation: Traveler

Endings: Seal rifts / Let world evolve / Become next Traveler

4. Game Mechanics

Exploration

Tile‑based movement

Tap to move/interact

Overworld + small dungeons

Detective mode for hidden clues

Combat (FF1‑style)

Turn‑based menu: Attack, Skill, Item, Interrogate, Run

Interrogate: extract clues, lower morale, reveal weaknesses

Weapons

Compact SMG

Folding baton

Flashbangs

Surveillance drone (summon ability)

Stats

INT (Interrogation)

DEX (Accuracy)

PER (Perception)

RES (Rift resistance)

5. World Design

Regions

Tata’s Village — rustic fantasy + modern tech hints

Rift Forest — distorted creatures, blue shockwaves

Market City — skyline inspired by sketches

Collapsing City — glitchy tiles, final dungeon

Archives — lore hub, puzzle area

Environmental Art

Heavy black lines

Minimal shading

Blocky shapes

Hats, dogs, odd silhouettes

6. Visual Direction — 2.5D (see docs/visual-rework.md)

Reworked toward Final Fantasy VII (1997): pre-rendered backgrounds, low-poly
characters, real-time 3D battles. Built as a small WebGL2 renderer in-repo, so
the project keeps its no-dependency, no-build-step shape. The pixel renderer
remains as the fallback.

Character Proportions

300–800 triangles, rigid part hierarchies (PS1 field models)

Large hats, long hair

Minimal facial detail — two ink ticks, no mouth

Rectangular torsos, strong silhouettes

Animation

Idle: hat tilt

Walk: leg/arm swing

Attack: lunge

Interrogate: notebook flick

(also: cast, hurt, down — closed-form clips per rig)

Shading

Flat toon bands, screen‑space cross‑hatch, ink outlines, PS1 vertex snapping

Fog to paper above ground, to near‑black underground

UI

Ink‑style borders, drawn in 2D over the 3D frame

Notebook as menu

Blue rift glow for special events

7. Systems & Features

Detective Notebook

Auto‑record clues

NPC profiles

Rift anomalies

Weapon notes

Lore fragments

Dialogue System

Branching interrogations

Tone choices: Calm, Direct, Aggressive, Silent

Rift Events

Random distortions

Time‑limited puzzles

Monsters spawn from everyday objects

8. Development Roadmap

Phase 1 — Prototype (4–6 weeks) — ✅ built, see docs/phase-1-prototype.md

Movement

Basic combat

First village

Tata & Traveler sprites

One dungeon

Phase 2 — Core Systems (6–10 weeks) — ✅ built, see docs/phase-2-systems.md

Interrogation

Notebook

Inventory

Rift events

Dialogue branching

Phase 3 — Content (10–14 weeks) — ✅ built, see docs/phase-3-content.md

Regions

NPCs

Weapons

Main story

Side quests

Visual rework (issue #4) — ✅ built, see docs/visual-rework.md

2.5D fields with baked backgrounds + depth

Low‑poly cast and animation clips

Full 3D battle scenes

Ink/toon shader stack

Phase 4 — Polish (4–6 weeks)

Animations

Sound

UI

Balancing

Browser optimization

9. Next Steps

Expand combat system

Build world factions

Create Tata’s character sheet

Outline story chapters