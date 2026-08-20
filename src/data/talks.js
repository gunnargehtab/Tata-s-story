/*
 * Branching conversations (gameplan §7). Nodes are walked by src/game/talk.js.
 * Choices carry `if` conditions, so the notebook and the satchel decide what
 * Tata is able to say — knowing a thing is the same as unlocking a line.
 */
export const TALKS = {
  // --- Sable, the merchant ------------------------------------------------
  sable: {
    start: {
      who: 'Sable',
      lines: ['She is packing a crate that was already packed.'],
      text: '"Evening, Tata. Whatever it is, I am closed."',
      choices: [
        { label: '"Your lanterns went out too."', to: 'lanterns', hint: 'calm' },
        { label: '"What is in the crates?"', to: 'crates', hint: 'direct' },
        { label: 'Show her the manifest.', to: 'manifest', hint: 'evidence', if: { item: 'manifest' } },
        { label: 'Sit her down and question her.', to: 'sitDown', hint: 'interrogate',
          if: { flag: 'sableReady', notFlag: 'sableBroken' } },
        { label: 'Leave her to it.', to: null },
      ],
    },
    lanterns: {
      who: 'Sable',
      text: '"Every lantern on the square, all at once. Lanterns do not agree on anything unless something tells them to."',
      effects: { clue: { id: 'lanterns', text: 'Every lantern in the village dimmed at the same moment.' },
        profile: { id: 'sable', name: 'Sable', role: 'Merchant, west stall', note: 'Talks freely about the lanterns. Not about the well.' } },
      choices: [
        { label: '"What told them?"', to: 'told' },
        { label: '"And the well?"', to: 'wellDodge' },
        { label: 'Let it go.', to: null },
      ],
    },
    told: {
      who: 'Sable',
      text: '"You are asking a woman who sells rope. Ask the archivist. He enjoys being asked."',
      choices: [{ label: 'Nod.', to: null }],
    },
    wellDodge: {
      who: 'Sable',
      lines: ['She looks at the road instead of the well, which is an answer.'],
      text: '"The well is boarded. It has been boarded since before you were born."',
      effects: { profile: { id: 'sable', note: 'Looks at the road whenever the well is mentioned.' } },
      choices: [
        { label: '"It is not boarded now."', to: 'notBoarded', if: { flag: 'wellOpen' } },
        { label: 'Say nothing and watch her.', to: 'watch' },
      ],
    },
    notBoarded: {
      who: 'Sable',
      text: '"Then somebody unboarded it. Not me. I sell rope."',
      effects: { clue: { id: 'sable-rope', text: 'Sable says she only sells rope. The well was opened with rope.' } },
      choices: [{ label: 'Write that down.', to: null }],
    },
    watch: {
      who: 'Sable',
      lines: ['The silence goes on. Sable fills it, because people always do.'],
      text: '"Third bell is a busy hour, that is all I meant."',
      effects: { clue: { id: 'third-bell', text: 'Sable volunteered "third bell" without being asked about it.' },
        profile: { id: 'sable', pressure: 'Third bell. She says it when she is nervous.' } },
      choices: [{ label: '"I did not ask about a bell."', to: 'pressed' }],
    },
    pressed: {
      who: 'Sable',
      text: '"…Ask me properly, then. Or go home."',
      choices: [
        { label: 'Ask her properly.', to: null, hint: 'interrogation', effects: { flag: 'sableReady' } },
        { label: 'Go home.', to: null },
      ],
    },
    crates: {
      who: 'Sable',
      text: '"Rope. Salt. Nothing that would interest a detective."',
      choices: [
        { label: '"Then open one."', to: 'openOne' },
        { label: 'Drop it.', to: null },
      ],
    },
    openOne: {
      who: 'Sable',
      lines: ['Her thumb finds a mark burned into the lid and stays there.'],
      text: '"No."',
      effects: { clue: { id: 'crate-mark', text: 'A mark burned into Sable’s crate lids. She covers it with her thumb.' },
        flag: 'sableReady', profile: { id: 'sable', pressure: 'The mark burned into the crate lid.' } },
      choices: [{ label: 'File it away.', to: null }],
    },
    manifest: {
      who: 'Tata',
      text: '"This came out of a crate that walked. It has your mark on the corner."',
      effects: { flag: 'sableReady', profile: { id: 'sable', note: 'Went pale at the manifest.' } },
      choices: [
        { label: 'Question her properly.', to: null, hint: 'interrogate', effects: { flag: 'sableInterro' } },
        { label: 'Not yet.', to: null },
      ],
    },
  },

  // --- Orrin, the archivist ----------------------------------------------
  orrin: {
    start: {
      who: 'Orrin',
      text: '"Tapping under floorboards. Old pipes, child. Though — three, two, one. That is a countdown, not a plumbing fault."',
      effects: { clue: { id: 'countdown', text: 'Three taps, two taps, one tap — a countdown, not a code.' },
        profile: { id: 'orrin', name: 'Orrin', role: 'Archivist. Enjoys being asked.' } },
      choices: [
        { label: '"A countdown to what?"', to: 'toWhat' },
        { label: '"What do you know about the well?"', to: 'well' },
        { label: 'Show him the capsule.', to: 'capsule', hint: 'evidence', if: { item: 'capsule' } },
        { label: 'Thank him and go.', to: null },
      ],
    },
    toWhat: {
      who: 'Orrin',
      text: '"To an arrival, usually. Nobody counts down to a departure. They just leave."',
      effects: { lore: 'Orrin: "Nobody counts down to a departure. They just leave."' },
      choices: [{ label: 'Hm.', to: 'start' }],
    },
    well: {
      who: 'Orrin',
      text: '"Sealed the year the records stop. Which is the part that worries me — not the sealing. The stopping."',
      effects: { clue: { id: 'records-stop', text: 'The village records stop in the same year the well was sealed.' },
        lore: 'The village archive has a hole in it exactly the shape of one year.' },
      choices: [
        { label: '"Who sealed it?"', to: 'whoSealed' },
        { label: 'Back up.', to: 'start' },
      ],
    },
    whoSealed: {
      who: 'Orrin',
      text: '"The page is gone. Cut out, not lost. Somebody was tidy about it."',
      effects: { clue: { id: 'cut-page', text: 'The page naming who sealed the well was cut out, not lost.' } },
      choices: [{ label: 'Write it down.', to: null }],
    },
    capsule: {
      who: 'Orrin',
      lines: ['He holds it up to the lamp for a long moment and does not blink.'],
      text: '"This is your handwriting, Tata. Older. Steadier. But yours."',
      effects: { clue: { id: 'own-hand', text: 'Orrin says the capsule note is in my own handwriting — older, steadier.' },
        lore: 'A message from a hand that is mine and has not happened yet.' },
      choices: [
        { label: '"That is not possible."', to: 'possible' },
        { label: 'Take it back and say nothing.', to: null },
      ],
    },
    possible: {
      who: 'Orrin',
      text: '"Neither is a well that breathes. Come back when you have both, and we will argue about which is worse."',
      choices: [{ label: 'Go.', to: null }],
    },
  },

  // --- Brann, the watch ---------------------------------------------------
  brann: {
    start: {
      who: 'Brann',
      text: '"Nobody in, nobody out after dark. Go home, Tata."',
      effects: { profile: { id: 'brann', name: 'Brann', role: 'The watch. Stands very still.' } },
      choices: [
        { label: '"Did you see a tall man in a cloak?"', to: 'cloak' },
        { label: '"You are shaking."', to: 'shaking', if: { flag: 'wellOpen' } },
        { label: 'Move along.', to: null },
      ],
    },
    cloak: {
      who: 'Brann',
      text: '"No. And stop asking. …No."',
      effects: { clue: { id: 'brann-denies', text: 'Brann says "no" twice about the traveler. Nobody says no twice.' } },
      choices: [{ label: 'Note the second no.', to: null }],
    },
    shaking: {
      who: 'Brann',
      lines: ['He looks at his hands as though they belong to someone he is angry with.'],
      text: '"I saw him. I could not make my legs move. He went for the well. Nothing goes to the well."',
      effects: { clue: { id: 'traveler-path', text: 'The watch froze when the Traveler passed. He went for the well.' },
        profile: { id: 'brann', note: 'Saw the Traveler. Could not move.' } },
      choices: [
        { label: '"Nothing goes to the well?"', to: 'nothing' },
        { label: 'Leave him be.', to: null },
      ],
    },
    nothing: {
      who: 'Brann',
      text: '"That is the rule my father gave me. He never said why. I never asked. That is the shameful part."',
      effects: { lore: 'The watch has one rule about the well, and no reason attached to it.' },
      choices: [{ label: 'Say nothing kind. Say nothing cruel.', to: null }],
    },
  },

  // --- Nima, the teacher --------------------------------------------------
  nima: {
    start: {
      who: 'Nima',
      text: '"Two children missed lessons this week. Nobody will say why. Write it down, Tata — things nobody says get lost."',
      effects: { clue: { id: 'missing', text: 'Two children missing from lessons. No one will say why.' },
        profile: { id: 'nima', name: 'Nima', role: 'Teacher. Keeps a register.' } },
      choices: [
        { label: '"Which two?"', to: 'which' },
        { label: '"Did anyone ask the watch?"', to: 'watch' },
        { label: 'Promise to write it down.', to: null },
      ],
    },
    which: {
      who: 'Nima',
      text: '"Odo and the little Vance girl. Both families paid off something the same week. Nobody in this village pays off anything."',
      effects: { clue: { id: 'paid-off', text: 'Both families of the missing children settled debts the same week.' } },
      choices: [{ label: 'Write both names down.', to: null }],
    },
    watch: {
      who: 'Nima',
      text: '"Brann took the report and his hand shook writing it. Make of that what you like."',
      effects: { profile: { id: 'brann', note: 'His hand shook while writing the missing-children report.' } },
      choices: [{ label: 'She will.', to: null }],
    },
  },
};
