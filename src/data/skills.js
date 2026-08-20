/* Tata's kit (gameplan §4). `tag` is matched against an enemy weakness. */
export const SKILLS = [
  { id: 'burst', name: 'Supp. Burst', cost: 3, tag: 'smg', hits: 3, power: 0.5,
    desc: 'Three snap shots. Sloppy, loud, effective.',
    flavor: 'Tata empties a short burst — three coughs of noise.' },
  { id: 'baton', name: 'Folding Baton', cost: 2, tag: 'baton', hits: 1, power: 1.6,
    desc: 'Close work. Nothing about it is subtle.',
    flavor: 'The baton snaps open on the way down.' },
  { id: 'flashbang', name: 'Flashbang', cost: 4, tag: 'flashbang', hits: 1, power: 0.6, stun: 1,
    desc: 'Blind it. It loses a turn.',
    flavor: 'A white bang. The dark comes back wrong.' },
  { id: 'drone', name: 'Drone Sweep', cost: 5, tag: 'drone', hits: 0, power: 0, reveal: true, mark: 3,
    desc: 'Reveals a weakness and marks the target.',
    flavor: 'The little drone lifts off Tata’s shoulder and starts reading the room.' },
];

export const ITEMS = {
  bandage: { id: 'bandage', name: 'Bandage', heal: 14, text: 'Patched up. Mostly.' },
  tonic: { id: 'tonic', name: 'Cold Tonic', foc: 7, text: 'The buzzing in her ears settles.' },
};

/* Interrogation tones (gameplan §7). Phase 1 uses them as combat modifiers;
   Phase 2 grows them into the branching dialogue system. */
export const TONES = [
  { id: 'calm', name: 'Calm', power: 0.9, res: -1, note: 'Steady. Hard to argue with.' },
  { id: 'direct', name: 'Direct', power: 1.1, res: 0, note: 'Name the thing out loud.' },
  { id: 'aggro', name: 'Aggressive', power: 1.5, res: 3, note: 'Push. It may push back.' },
  { id: 'silent', name: 'Silent', power: 0.6, res: -4, note: 'Say nothing. Let it fill the gap.' },
];
