/*
 * Maps are string grids. Legend lives in src/art/tiles.js:
 *   .  grass      ,  path       #  stone      T  tree      h  house wall
 *   ^  roof       D  door       w  water      O  the old well
 *   =  planks     -  dungeon floor            >  stairs down   <  stairs up
 *   *  rift-torn ground         r  rubble     f  fence      c  crate   B  shelf
 *
 * `space` names the kind of place a map is — room, hall, cavern, town, wild —
 * and picks its camera distance and framing (see SPACES in src/gfx/field.js).
 */

export const MAPS = {
  room: {
    name: "Tata's Room",
    space: 'room',
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
    space: 'town',
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
      { id: 'sable', name: 'Sable, the Merchant', sprite: 'merchant', x: 10, y: 8, facing: 'down', talk: 'sable', interro: 'sable',
        lines: {
          default: ['Half my lanterns went out at once last night.', 'Lanterns don’t agree on anything. Not unless something tells them to.'],
          post: ['That blue light took my whole stall’s shadow with it.', 'Whatever walked through here, it wasn’t walking to somewhere. It was walking away.'],
        },
        clue: { id: 'lanterns', text: 'Every lantern in the village dimmed at the same moment.' } },
      { id: 'orrin', name: 'Orrin, the Archivist', sprite: 'archivist', x: 17, y: 12, facing: 'left', talk: 'orrin',
        lines: {
          default: ['Tapping under floorboards? Old pipes, child.', 'Though… three, two, one. That’s a countdown, not a plumbing fault.'],
          post: ['A shockwave with a direction is not weather. It’s a door opening.', 'The old well was sealed for a reason nobody wrote down. That worries me most.'],
        },
        clue: { id: 'countdown', text: 'Three taps, two taps, one tap — a countdown, not a code.' } },
      { id: 'brann', name: 'Brann, the Watch', sprite: 'guard', x: 6, y: 16, facing: 'down', talk: 'brann',
        lines: {
          default: ['Nobody in, nobody out after dark. Go home, Tata.', 'And no, I did not see a tall man in a cloak. Stop asking.'],
          post: ['I saw him. I did. And I couldn’t make my legs move.', 'He went for the well. Nothing goes to the well.'],
        },
        clue: { id: 'traveler-path', text: 'The Watch froze when the Traveler passed. He went for the well.' } },
      { id: 'nima', name: 'Nima, the Teacher', sprite: 'teacher', x: 19, y: 10, facing: 'left', talk: 'nima',
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
      { x: 6, y: 20, to: 'forest', tx: 6, ty: 17, facing: 'up' },
      { x: 15, y: 3, locked: 'The door is bolted from the inside.' },
      { x: 5, y: 11, locked: 'Shutters down. Sable closed early tonight.' },
    ],
    triggers: [
      { x: 11, y: 9, id: 'traveler', once: true, script: 'traveler', radius: 1, requires: 'capsule' },
      { x: 11, y: 11, id: 'traveler2', once: true, script: 'traveler', radius: 1, requires: 'capsule' },
      // the walk home from the city, once the archive has given up its year
      { x: 6, y: 19, id: 'actTwoEnd', once: true, script: 'actTwoEnd', requires: 'actTwoDone' },
    ],
    interacts: [
      { x: 11, y: 10, id: 'well', script: 'well' },
    ],
    encounters: null,
  },

  forest: {
    name: 'The Rift Forest',
    space: 'wild',
    rifts: true,
    rows: [
      'TTTTTTTTTTTTTTTTTT,TTT',
      'TT................,..T',
      'TT.TT...TTT.......,..T',
      'TT.TT...TTT..**...,..T',
      'TT.......TT..**...,..T',
      'TT..rr...............T',
      'TT..rr.....TTT.......T',
      'TT...r.....TTT.......T',
      'TT.........TT........T',
      'TTwwww...............T',
      'TTwwww.....**........T',
      'TT.........**........T',
      'TT...TTT.............T',
      'TT...TTT......TTT....T',
      'TT............TTT....T',
      'TT...................T',
      'TT.....TT......TT....T',
      'TT.....TT......TT....T',
      'TTTTTT,TTTTTTTTTTTTTTT',
    ],
    npcs: [
      { id: 'wren', name: 'Wren, a Forager', sprite: 'villager', x: 16, y: 11, facing: 'left', talk: 'wren',
        lines: { default: ['The trees moved. I am not being poetic.'] } },
    ],
    warps: [
      { x: 6, y: 18, to: 'village', tx: 6, ty: 19, facing: 'up' },
      { x: 18, y: 0, to: 'market', tx: 11, ty: 20, facing: 'up' },
    ],
    interacts: [
      { x: 5, y: 6, id: 'cairn', script: 'cairn' },
    ],
    triggers: [
      { x: 12, y: 10, id: 'stag', once: true, script: 'stag', radius: 1 },
      { x: 18, y: 2, id: 'forestRoad', once: true, script: 'forestRoad', radius: 1 },
    ],
    encounters: { rate: 0.08, pool: ['hound', 'wisp'] },
  },

  market: {
    name: 'Market City — Low Quay',
    space: 'town',
    rows: [
      'wwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwww',
      '========================',
      '========================',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      ',,cc,,,,,,,cc,,,,,,,cc,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      ',^^^,,,^^^^,,,,^^^,,,^^,',
      ',hDh,,,hhDh,,,,hDh,,,hh,',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      ',,,,,^^^^^^^^,,,,,,,,,,,',
      ',,cc,hhhhhhDh,,,,,,,cc,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      ',^^^,,,,,,,,,,,,,,,^^^,,',
      ',hDh,,,cc,,,cc,,,,,hDh,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      ',,,ff,,,,,,,,,,,,,ff,,,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      'TT,,,,,,,,,,,,,,,,,,,,TT',
      'TTTT,,,,,,,,,,,,,,,,TTTT',
      'TTTTTTTT,,,,,,,,TTTTTTTT',
      'TTTTTTTTTTT,TTTTTTTTTTTT',
    ],
    npcs: [
      { id: 'halloran', name: 'Halloran, the Harbourmaster', sprite: 'guard', x: 9, y: 3, facing: 'down',
        talk: 'halloran', interro: 'halloran',
        lines: { default: ['"Quay is closed to children."'] } },
      { id: 'pell', name: 'Pell, a Fence', sprite: 'smuggler', x: 4, y: 12, facing: 'up', talk: 'pell',
        lines: { default: ['"Buying, selling, forgetting. Which one?"'] } },
      { id: 'quill', name: 'Quill, a Stallholder', sprite: 'merchant', x: 2, y: 6, facing: 'up', talk: 'quill',
        lines: { default: ['"Rope, salt, nails. No questions in stock."'] } },
      { id: 'odo', name: 'A boy on the quay', sprite: 'villager', x: 15, y: 17, facing: 'left', talk: 'odo',
        lines: { default: ['He watches the water and does not blink much.'] } },
    ],
    warps: [
      { x: 11, y: 21, to: 'forest', tx: 18, ty: 1, facing: 'down' },
      { x: 2, y: 8, to: 'archives', tx: 8, ty: 11, facing: 'up' },
      { x: 9, y: 8, locked: 'Shuttered. A bell hangs by the door with its clapper tied.' },
      { x: 16, y: 8, locked: 'Someone has nailed this one shut from the outside.' },
      { x: 2, y: 14, locked: 'A customs office. Empty, and dusty for an office this busy.' },
      { x: 11, y: 11, locked: 'The bonded warehouse. Two locks, and only one of them is the harbour’s.' },
      { x: 21, y: 14, locked: 'Locked. Through the window: crates, stacked to the ceiling.' },
    ],
    interacts: [
      { x: 2, y: 5, id: 'shopStall', script: 'shop' },
    ],
    triggers: [
      { x: 11, y: 19, id: 'marketArrive', once: true, script: 'marketArrive', radius: 1 },
    ],
    encounters: { rate: 0.06, pool: ['rat'] },
  },

  archives: {
    name: 'The Archives',
    space: 'hall',
    dark: true,
    rows: [
      '##################',
      '#-BBB--------BBB-#',
      '#-B------------B-#',
      '#-B--BBBB--BB--B-#',
      '#----B------B----#',
      '#-BB-B------B-BB-#',
      '#-BB----------BB-#',
      '#----BBB--BBB----#',
      '#-B------------B-#',
      '#-B--BB----BB--B-#',
      '#-B------------B-#',
      '#----------------#',
      '########-#########',
    ],
    npcs: [
      { id: 'vess', name: 'Vess, Keeper of Records', sprite: 'archivist', x: 8, y: 10, facing: 'down', talk: 'vess',
        lines: { default: ['"Quietly. The paper is older than your village."'] } },
    ],
    warps: [{ x: 8, y: 12, to: 'market', tx: 2, ty: 9, facing: 'down' }],
    interacts: [
      { x: 2, y: 3, id: 'recordA', script: 'recordA' },
      { x: 12, y: 7, id: 'recordB', script: 'recordB' },
      { x: 15, y: 9, id: 'recordC', script: 'recordC' },
    ],
    encounters: null,
  },

  well1: {
    name: 'The Old Well — Descent',
    space: 'cavern',
    dark: true,
    rifts: true,
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
    space: 'cavern',
    dark: true,
    rifts: true,
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
