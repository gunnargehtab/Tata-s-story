import { G, addClue, addItem, enterMap, noteLore, save } from './state.js';
import { runScript } from './cutscene.js';
import { showDialogue } from './dialogue.js';

/*
 * Act I beats (gameplan §3): the whisper under the floorboards, the capsule,
 * the Traveler and the blue shockwave, the Old Well, the Lantern Keeper.
 */
export const SCRIPTS = {
  capsule() {
    runScript([
      { say: [
        { who: 'Tata', text: 'Tap. Tap-tap. Tap. Under the floor. Not pipes — pipes don’t keep time.' },
        { who: 'Tata', text: 'Three. Then two. Then one. Somebody is counting down to something.' },
        'She pries up the loose board. A metal capsule lies in the dust, warm, humming a soft blue.',
      ] },
      { fn: () => {
        addClue('note', 'Capsule note: "He’s here. The traveler. Don’t let him leave."');
        addItem('capsule');
        addItem('lens');
        noteLore('The capsule was warm before she touched it, and it has been humming since.');
      } },
      { say: [
        '"He’s here. The traveler. Don’t let him leave." No signature. No explanation.',
        { who: 'Tata', text: 'Fine. I have questions and a coat.' },
        'Satchel: notebook, flashlight, compact SMG, magnifying glass. Out into the not-quite-quiet night.',
        { who: 'Notebook', text: 'The capsule and the lens go in the satchel. Tap NOTE to read either one.' },
      ] },
      { flag: 'capsule' },
      { save: true },
    ]);
  },

  traveler() {
    runScript([
      { say: ['At the edge of the village, near the old well, a tall figure stands perfectly still.'] },
      { spawn: { id: 'traveler', sprite: 'traveler', x: 11, y: 8, dir: 'down' } },
      { wait: 0.4 },
      { say: [
        { who: 'Tata', text: 'Sir. I have questions.' },
        { who: 'The Traveler', text: 'Tata. You’re already late.' },
        { who: 'Tata', text: 'I never gave you my name.' },
        { who: 'The Traveler', text: 'No. You won’t, either. That’s the part that matters.' },
      ] },
      { flash: 'rift' },
      { wait: 0.8 },
      { say: [
        'A ripple of blue light runs through the village like a stone dropped into reality.',
        'Lanterns shatter. Birds go up all at once. The ground remembers it is only ground.',
      ] },
      { walk: { id: 'traveler', to: [11, 5], speed: 2.4 } },
      { walk: { id: 'traveler', to: [11, 1], speed: 3.2 } },
      { despawn: 'traveler' },
      { fn: () => { addClue('shockwave', 'The shockwave came from the well, not from him. He was standing in it.'); } },
      { say: [
        { who: 'Tata', text: 'He walked away from the well. Which means the well is the interesting one.' },
        'The boards over the old well have blown outward. Something came up. Recently.',
      ] },
      { flag: 'wellOpen' },
      { save: true },
    ]);
  },

  well() {
    if (!G.flags.wellOpen) {
      showDialogue(['The old well is boarded shut and nailed twice over. Someone wanted it that way.']);
      return;
    }
    if (!G.flags.enteredWell) {
      runScript([
        { say: [{ who: 'Tata', text: 'Rung, rung, rung. Down we go. Nobody nails a well shut over nothing.' }] },
        { flag: 'enteredWell' },
        { enterMap: { id: 'well1', x: 1, y: 1, facing: 'down' } },
        { save: true },
      ]);
      return;
    }
    runScript([{ enterMap: { id: 'well1', x: 1, y: 1, facing: 'down' } }]);
  },

  descentNote() {
    runScript([
      { say: [
        'A scrap of paper is pinned to the brick with a splinter of glass.',
        '"Keeper stays lit. Cargo moves at third bell. Nobody counts the children."',
      ] },
      { fn: () => { addClue('cargo', 'Cargo moves through the well at third bell. "Nobody counts the children."'); } },
      { say: [{ who: 'Tata', text: 'Somebody counts them. Starting tonight.' }] },
      { save: true },
    ]);
  },

  keeper() {
    runScript([
      { say: [
        'The chamber opens. A shape as tall as a doorway lifts a lantern that is not a lantern.',
        { who: 'The Lantern Keeper', text: 'You are early. He said you would be late.' },
      ] },
      { battle: {
        ids: ['keeper'], boss: true,
        intro: 'The Lantern Keeper turns its light on Tata.',
        onEnd: () => {
          G.tata.hp = Math.max(1, Math.round(G.tata.maxHp * 0.4));
          enterMap('village', 11, 11, 'down');
          save();
          showDialogue(['Tata wakes at the lip of the well, ears ringing, notebook still in her fist.',
            { who: 'Tata', text: 'Again. Better questions this time.' }]);
        },
      } },
      { say: [
        'The light goes out. The shape does not fall so much as stop holding itself up.',
        { who: 'Tata', text: 'Good. Now the part I am actually good at.' },
      ] },
      { flag: 'keeperDown' },
      { save: true },
      { say: [
        { who: 'Notebook', text: 'PRESS makes them talk. OBSERVE finds the lie. PRESENT puts proof against it.' },
      ] },
      { interro: { id: 'keeper' } },
      { fn: () => {
        addClue('phase1', 'The well was a door. The Traveler did not open it — he arrived through it.');
        noteLore('Doors have two sides. Someone on ours was told to stand at it and never told why.');
      } },
      { flag: 'phase1complete' },
      { save: true },
      { say: [
        'Tata climbs out of the well as the first grey comes up over the roofs.',
        'END OF SLICE — Act I, Scene One.',
        'Act II picks up here: the rifts spread, and the people who profit from them stop being polite.',
      ] },
    ]);
  },
};
