/*
 * Phase 2 inventory. Three kinds:
 *   consumable — used from the bag or in battle
 *   tool       — one may be carried in hand; it shifts Tata's stats
 *   key        — story objects. Key items double as EVIDENCE in interrogations,
 *                which is why they carry `evidence` text.
 */
export const ITEMS = {
  bandage: {
    id: 'bandage', name: 'Bandage', kind: 'consumable',
    desc: 'Field dressing. Not clean, but quick.',
    heal: 14, text: 'Patched up. Mostly.',
  },
  tonic: {
    id: 'tonic', name: 'Cold Tonic', kind: 'consumable',
    desc: 'Restores focus. Tastes like a cellar.',
    foc: 7, text: 'The buzzing in her ears settles.',
  },
  salts: {
    id: 'salts', name: 'Smelling Salts', kind: 'consumable',
    desc: 'Clears a blinded head — hers or someone else’s.',
    heal: 4, foc: 3, cure: true, text: 'The white edges of the world go back where they belong.',
  },
  ward: {
    id: 'ward', name: 'Rift Ward', kind: 'consumable',
    desc: 'A cold iron nail wrapped in copper. Blunts rift damage for a fight.',
    battleBuff: { RES: 4, turns: 99 }, text: 'The nail goes warm and stays warm.',
  },

  lens: {
    id: 'lens', name: 'Magnifying Lens', kind: 'tool',
    desc: 'Her father’s. Everything is evidence if you get close enough.',
    bonus: { PER: 3 },
  },
  recorder: {
    id: 'recorder', name: 'Wax Recorder', kind: 'tool',
    desc: 'It remembers exactly what was said. People hate that.',
    bonus: { INT: 3 },
  },
  vest: {
    id: 'vest', name: 'Lined Vest', kind: 'tool',
    desc: 'Heavy. Quiet. Takes the edge off a rift.',
    bonus: { RES: 3, DEX: -1 },
  },

  capsule: {
    id: 'capsule', name: 'Blue Capsule', kind: 'key',
    desc: 'Warm to the touch, humming. The note inside is in her own handwriting.',
    evidence: 'The capsule note: "He’s here. The traveler. Don’t let him leave." — written in my hand.',
  },
  manifest: {
    id: 'manifest', name: 'Torn Manifest', kind: 'key',
    desc: 'A cargo list with no port name and a column headed only "count".',
    evidence: 'A manifest for cargo that moves at third bell, with a column headed "count".',
  },
  keeperGlass: {
    id: 'keeperGlass', name: 'Keeper’s Glass', kind: 'key',
    desc: 'A shard of the Keeper’s lantern. Still cold. Still faintly blue.',
    evidence: 'A shard of the Keeper’s lantern — rift-blue, and cold instead of hot.',
  },
};

export const listItems = (kind) => Object.values(ITEMS).filter((i) => i.kind === kind);
