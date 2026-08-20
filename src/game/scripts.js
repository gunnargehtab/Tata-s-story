import {
  G, addClue, addItem, enterMap, noteLore, noteAnomaly, save,
  hasItem, questActive, advanceQuest, startQuest,
} from './state.js';
import { runScript } from './cutscene.js';
import { showDialogue } from './dialogue.js';
import { openShop } from './shop.js';

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

  // ---------------------------------------------------------------- Act II

  /** The road out of the village, taken for the first time. */
  forestRoad() {
    runScript([
      { say: [
        'The path north stops pretending to be a village path and becomes a road.',
        { who: 'Tata', text: 'Cargo goes somewhere. Roads are just the somewhere, written down.' },
      ] },
      { fn: () => { noteLore('The road north runs shrine, forest, city — the same line the cargo takes.'); } },
      { save: true },
    ]);
  },

  cairn() {
    const first = !G.flags.cairnRead;
    runScript([
      { say: first
        ? ['Stones stacked shoulder-high, older than the village and better maintained.',
           'Things are left on it: a shoe, a spoon, a child’s wooden horse with the paint worn off the nose.',
           { who: 'Tata', text: 'You leave a thing so the forest takes the thing instead of you.' }]
        : ['The cairn. The wooden horse has been turned to face the road.'] },
      { fn: () => {
        G.flags.cairnRead = true;
        noteAnomaly('Offerings on the forest cairn are turned to face the road overnight.');
        addClue('cairn-toll', 'The cairn is a toll. Something walks past it and expects payment.');
        if (questActive('register')) advanceQuest('register', 0);
      } },
      { say: [{ who: 'Notebook', text: 'The cairn is a toll, and the stag is the collector.' }] },
      { save: true },
    ]);
  },

  stag() {
    runScript([
      { say: [
        'Three trees away, a shape resolves that was not standing there and has not moved.',
        { who: 'Tata', text: 'Antlers still growing. That is not how antlers work.' },
      ] },
      { battle: {
        ids: ['stag'], boss: true,
        intro: 'The Rift Stag steps onto its line, and the line runs through Tata.',
        onEnd: () => {
          G.tata.hp = Math.max(1, Math.round(G.tata.maxHp * 0.4));
          enterMap('forest', 6, 17, 'up');
          save();
          showDialogue(['The forest puts her back on the road facing the way she came.',
            { who: 'Tata', text: 'Fine. It keeps its line. I will bring something louder.' }]);
        },
      } },
      { fn: () => {
        addClue('stag-toll', 'The stag collects what the cairn is owed and carries it in its antlers.');
        noteLore('The stag is not a guard. It is a collector, and it works to a schedule.');
        G.flags.stagDown = true;
        if (questActive('register') && hasItem('register')) advanceQuest('register', 1);
      } },
      { say: [
        'It walks back into the blue and takes the shape of the trees with it.',
        { who: 'Tata', text: 'Two names in a register, and a road that goes to a city. Onwards.' },
      ] },
      { save: true },
    ]);
  },

  marketArrive() {
    runScript([
      { say: [
        'Market City comes up out of the fog in pieces: a crane, a bell tower, then all of it at once.',
        'The Low Quay smells of salt and rope and something colder underneath.',
        { who: 'Tata', text: 'Somewhere on this quay there is a man with a book. Books have names in them.' },
      ] },
      { fn: () => {
        noteLore('Market City: cranes, bells, and a quay where the water is colder than the season.');
        if (!G.quests.thirdBell) startQuest('thirdBell');
      } },
      { save: true },
    ]);
  },

  shop() { openShop('quay'); },

  /** The walk back into the village, with Act II's answer in her pocket. */
  actTwoEnd() {
    runScript([
      { say: [
        'The village looks smaller from the road than it does from inside it.',
        { who: 'Tata', text: 'A door in a well. A quay that signs for children. A year cut out of the paper.' },
        { who: 'Tata', text: 'And a note in my handwriting telling me not to let him leave.' },
      ] },
      { fn: () => {
        addClue('act-two', 'The crossing is a business, the record was erased on purpose, and the warning came from me.');
        noteLore('Act II closes with three facts that only fit together if the Traveler has done this before.');
      } },
      { say: [
        'END OF SLICE — Act II, "The Rifts".',
        'Act III picks up here: the Collapsing City, and the last interrogation.',
      ] },
      { flag: 'actTwoComplete' },
      { save: true },
    ]);
  },

  recordA() { readRecord('A', 'A tide table for the sealed year. The tides are ordinary. The margin note is not: "he came up on the slack."'); },
  recordB() { readRecord('B', 'A ledger of village debts, all settled in one week, all in the same unfamiliar coin.'); },
  recordC() { readRecord('C', 'A complaint about noise: tapping under the floorboards of a house that no longer exists.'); },
};

/** The three surviving records of the sealed year, for Vess. */
function readRecord(which, text) {
  const key = `record${which}`;
  if (G.flags[key]) {
    showDialogue(['She has already read this one. The shelf smells of dust and old salt.']);
    return;
  }
  runScript([
    { say: [text] },
    { fn: () => {
      G.flags[key] = true;
      noteLore(text);
      if (G.flags.recordA && G.flags.recordB && G.flags.recordC) {
        G.flags.recordsAll = true;
        addClue('records-three', 'Three records survived the sealed year: a tide, a ledger, and a complaint about tapping.');
      }
    } },
    // read after the flag is set, not while the script is being built
    { fn: () => showDialogue([{ who: 'Tata',
      text: G.flags.recordsAll ? 'Three. Vess can read across them now.' : 'One down. There will be more.' }]) },
    { save: true },
  ]);
}
