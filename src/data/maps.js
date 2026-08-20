/*
 * Maps are string grids. Legend lives in src/art/tiles.js:
 *   .  grass      ,  path       #  stone      T  tree      h  house wall
 *   ^  roof       D  door       w  water      O  the old well
 *   =  planks     -  dungeon floor            >  stairs down   <  stairs up
 *   *  rift-torn ground         r  rubble     f  fence      c  crate   B  shelf
 */

export const MAPS = {
  room: {
    name: "Tata's Room",
    rows: [
      'hhhhhhhhhh',
      'h========h',
      'h==B=====h',
      'h========h',
      'h===={===h',
      'h========h',
      'h========h',
      'hhhhDhhhhh',
    ],
    // '{' is the prised-up board; the capsule trigger sits on it.
    npcs: [],
    warps: [{ x: 4, y: 7, to: 'village', tx: 7, ty: 4, facing: 'down' }],
    triggers: [
      { x: 5, y: 4, id: 'capsule', once: true, script: 'capsule' },
    ],
    encounters: null,
  },

  village: {
    name: 'Tata’s Village',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT......................TT',
      'T....^^^^....^^^^.......TT',
      'T....hhDh....hhDh.....TTTT',
      'T.....,.......,........fTT',
      'T.....,,,,,,,,,........fTT',
      'T.....,.......,........fTT',
      'T..c..,...c...,.........TT',
      'T.....,,,,,,,,,,,,,,....TT',
      'T.....,.........,.......TT',
      'T..^^^,....O....,...cc..TT',
      'T..hhDh.........,.......TT',
      'T.....,.........,.......TT',
      'T.....,,,,,,,,,,,.......TT',
      'T.....,.................TT',
      'T.....,......ff.ff......TT',
      'TT....,.................TT',
      'TT....,........TTTT.....TT',
      'TTT...,......TTTTTTT....TT',
      'TTT...,.....TTTTTTTTT...TT',
      'TTTT..,....TTTTTTTTTTT..TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    npcs: [
      { id: 'sable', name: 'Sable, the Merchant', sprite: 'merchant', x: 10, y: 8, facing: 'down', wander: true,
        lines: {
          default: ['Half my lanterns went out at once last night.', 'Lanterns don’t agree on anything. Not unless something tells them to.'],
          post: ['That blue light took my whole stall’s shadow with it.', 'Whatever walked through here, it wasn’t walking to somewhere. It was walking away.'],
        },
        clue: { id: 'lanterns', text: 'Every lantern in the village dimmed at the same moment.' } },
      { id: 'orrin', name: 'Orrin, the Archivist', sprite: 'archivist', x: 17, y: 12, facing: 'left',
        lines: {
          default: ['Tapping under floorboards? Old pipes, child.', 'Though… three, two, one. That’s a countdown, not a plumbing fault.'],
          post: ['A shockwave with a direction is not weather. It’s a door opening.', 'The old well was sealed for a reason nobody wrote down. That worries me most.'],
        },
        clue: { id: 'countdown', text: 'Three taps, two taps, one tap — a countdown, not a code.' } },
      { id: 'brann', name: 'Brann, the Watch', sprite: 'guard', x: 6, y: 16, facing: 'down',
        lines: {
          default: ['Nobody in, nobody out after dark. Go home, Tata.', 'And no, I did not see a tall man in a cloak. Stop asking.'],
          post: ['I saw him. I did. And I couldn’t make my legs move.', 'He went for the well. Nothing goes to the well.'],
        },
        clue: { id: 'traveler-path', text: 'The Watch froze when the Traveler passed. He went for the well.' } },
      { id: 'nima', name: 'Nima, the Teacher', sprite: 'teacher', x: 19, y: 10, facing: 'left',
        lines: {
          default: ['Two children missed lessons this week. Nobody will say why.', 'Write it down, Tata. Things nobody says get lost.'],
          post: ['If the ground can shake like that, what else has been lying to us?'],
        },
        clue: { id: 'missing', text: 'Two children missing from lessons. No one will say why.' } },
      { id: 'dog', name: 'A whining dog', sprite: null, actor: 'dog', x: 12, y: 14, facing: 'right',
        lines: { default: ['The dog will not stop staring at the well.'], post: ['The dog growls at the well and refuses to move closer.'] } },
    ],
    warps: [
      { x: 7, y: 3, to: 'room', tx: 4, ty: 6, facing: 'up' },
      { x: 15, y: 3, locked: 'The door is bolted from the inside.' },
      { x: 5, y: 11, locked: 'Shutters down. Sable closed early tonight.' },
    ],
    triggers: [
      { x: 11, y: 9, id: 'traveler', once: true, script: 'traveler', radius: 1, requires: 'capsule' },
      { x: 11, y: 11, id: 'traveler2', once: true, script: 'traveler', radius: 1, requires: 'capsule' },
    ],
    interacts: [
      { x: 11, y: 10, id: 'well', script: 'well' },
    ],
    encounters: null,
  },

  well1: {
    name: 'The Old Well — Descent',
    dark: true,
    rows: [
      '##################',
      '#<--#-------#----#',
      '#---#---##--#--*-#',
      '#-#-----##-----*-#',
      '#-#-###----###---#',
      '#---#-#-**-#-#---#',
      '#####-#-**-#-#-###',
      '#-----#----#-#---#',
      '#-###------#-#-#-#',
      '#---#-####---#-#-#',
      '#*#-#----#---#---#',
      '#*#---##-#--###--#',
      '#-----#--#-------#',
      '#-###-#--####-##-#',
      '#---------#--->--#',
      '##################',
    ],
    npcs: [],
    warps: [
      { x: 1, y: 1, to: 'village', tx: 11, ty: 11, facing: 'down' },
      { x: 14, y: 14, to: 'well2', tx: 7, ty: 11, facing: 'up' },
    ],
    triggers: [
      { x: 8, y: 5, id: 'descent-note', once: true, script: 'descentNote', radius: 1 },
    ],
    encounters: { rate: 0.09, pool: ['wisp', 'crate', 'hound'] },
  },

  well2: {
    name: 'The Old Well — Keeper’s Chamber',
    dark: true,
    rows: [
      '###############',
      '#####-----#####',
      '###--*****--###',
      '##--*******--##',
      '#---*******---#',
      '#---*******---#',
      '#----*****----#',
      '#-------------#',
      '#--#-------#--#',
      '#--#-------#--#',
      '#-------------#',
      '######-<-######',
      '###############',
    ],
    npcs: [],
    warps: [{ x: 7, y: 11, to: 'well1', tx: 14, ty: 14, facing: 'down' }],
    triggers: [
      { x: 7, y: 7, id: 'keeper', once: true, script: 'keeper', radius: 1 },
    ],
    encounters: { rate: 0.05, pool: ['wisp', 'hound'] },
  },
};

/** Normalises a map once: pads rows, applies substitutions, caches dimensions. */
export function prepareMap(map) {
  if (map._ready) return map;
  const w = map.rows.reduce((m, r) => Math.max(m, r.length), 0);
  map.grid = map.rows.map((r) => {
    const padded = r.padEnd(w, r[r.length - 1] === '#' ? '#' : 'T');
    return [...padded].map((ch) => (map.substitutions && map.substitutions[ch]) || ch);
  });
  map.w = w;
  map.h = map.grid.length;
  map._ready = true;
  return map;
}
