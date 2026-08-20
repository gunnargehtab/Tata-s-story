/*
 * Phase 1 bestiary: "monsters spawn from everyday objects" (gameplan §7).
 * `weakness` is hidden until Perception, the drone, or an interrogation reveals it.
 * `morale` is the interrogation track — empty it and the enemy breaks off.
 */
export const ENEMIES = {
  wisp: {
    id: 'wisp', name: 'Lantern Wisp', sprite: 'wisp',
    hp: 18, atk: 5, def: 1, DEX: 8, morale: 6, RES: 2,
    weakness: 'baton', xp: 9,
    clue: { id: 'wisp-light', text: 'Rift-lit wisps burn cold. They flinch from anything solid.' },
    barks: ['The lantern hums a word that isn’t a word.', 'It bobs closer, patient as a question.'],
    breaks: 'The flame gutters. "The keeper... keeps the door," it whines, and blinks out.',
  },
  crate: {
    id: 'crate', name: 'Crate Crawler', sprite: 'crate',
    hp: 26, atk: 6, def: 3, DEX: 4, morale: 9, RES: 3,
    weakness: 'flashbang', xp: 12,
    clue: { id: 'crate-cargo', text: 'Smugglers’ crates. Someone has been moving cargo through the well.' },
    barks: ['The crate walks on splinters it grew tonight.', 'Something inside it shifts and settles.'],
    breaks: 'The lid flaps open. It spills a manifest stamped with no port name and scuttles off.',
  },
  hound: {
    id: 'hound', name: 'Rift Hound', sprite: 'hound',
    hp: 22, atk: 8, def: 2, DEX: 10, morale: 4, RES: 4,
    weakness: 'smg', xp: 14,
    clue: { id: 'hound-scent', text: 'The hounds track one scent only: the Traveler’s.' },
    barks: ['It has too many legs and all of them agree.', 'The hound circles, watching your hands, not your eyes.'],
    breaks: 'The hound whines, flattens, and slinks toward the deeper dark — the way it came.',
  },
  keeper: {
    id: 'keeper', name: 'The Lantern Keeper', sprite: 'keeper', boss: true,
    hp: 66, atk: 8, def: 4, DEX: 6, morale: 14, RES: 8,
    weakness: 'drone', xp: 60,
    clue: { id: 'keeper-door', text: 'The Keeper was posted at the well to stop something coming UP.' },
    barks: [
      'The Keeper raises its lantern. The light asks you a question.',
      '"You are early," it says. "He said you would be late."',
      'Glass grinds on glass somewhere inside the flame.',
    ],
    breaks: '"I was posted here," it says at last. "Not to keep you out. To keep it in." The light goes out.',
  },
};
