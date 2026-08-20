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

  // --- Wren, a forager in the Rift Forest ---------------------------------
  wren: {
    start: {
      who: 'Wren',
      lines: ['She has a basket of nothing and a very good grip on a walking stick.'],
      text: '"You are the question child. Good. Ask them here, quietly, and then leave."',
      effects: { profile: { id: 'wren', name: 'Wren', role: 'Forager. Knows the forest well enough to be frightened of it.' } },
      choices: [
        { label: '"What moved the trees?"', to: 'trees' },
        { label: '"Have you seen a school register?"', to: 'register', if: { quest: 'register' } },
        { label: '"What is the pile of stones?"', to: 'cairn' },
        { label: 'Leave her to her basket.', to: null },
      ],
    },
    trees: {
      who: 'Wren',
      text: '"Not the wind. There is a stag. It walks the same line every night, and the line does not care what is standing on it."',
      effects: { clue: { id: 'stag-line', text: 'A stag walks the same line through the forest every night.' },
        anomaly: 'Trees in the Rift Forest stand where they did not stand yesterday.' },
      choices: [
        { label: '"Where does the line go?"', to: 'line' },
        { label: 'Back up.', to: 'start' },
      ],
    },
    line: {
      who: 'Wren',
      text: '"Shrine, village, well. Every night. You may draw your own map from that; I have drawn mine and I stay off it."',
      effects: { lore: 'The stag’s path: shrine, village, well — the same three points, every night.' },
      choices: [{ label: 'Nod.', to: 'start' }],
    },
    register: {
      who: 'Wren',
      text: '"A book? The stag carries things in its antlers. It does not read them. It just carries them."',
      effects: { clue: { id: 'stag-carries', text: 'The stag carries things in its antlers. Including, apparently, paper.' },
        advanceQuest: { id: 'register', step: 0 } },
      choices: [{ label: '"Then I will ask it for the book."', to: null }],
    },
    cairn: {
      who: 'Wren',
      text: '"Older than the village. People leave things on it so the forest takes those instead of them."',
      choices: [{ label: 'Go and look.', to: null }],
    },
  },

  // --- Quill, a stallholder in Market City --------------------------------
  quill: {
    start: {
      who: 'Quill',
      text: '"Rope, salt, nails. No questions in stock, but they come in on Thursdays."',
      effects: { profile: { id: 'quill', name: 'Quill', role: 'Stallholder, Low Quay. Sells everything except an opinion.' } },
      choices: [
        { label: '"Who meets the boat at third bell?"', to: 'boat', if: { quest: 'thirdBell' } },
        { label: '"Who buys strange coin here?"', to: 'coin' },
        { label: '"Where are the records kept?"', to: 'records' },
        { label: 'Move along.', to: null },
      ],
    },
    boat: {
      who: 'Quill',
      lines: ['He puts a nail down very precisely before he answers.'],
      text: '"Harbourmaster signs for everything that touches this quay. Halloran. Big man, small signature."',
      effects: { clue: { id: 'halloran-signs', text: 'Halloran the harbourmaster signs for every cargo on the Low Quay.' },
        advanceQuest: { id: 'thirdBell', step: 1 } },
      choices: [{ label: '"Thank you."', to: null }],
    },
    coin: {
      who: 'Quill',
      text: '"Pell. Down the row. Do not take his first price and do not take his second one either."',
      choices: [{ label: 'Note it.', to: null }],
    },
    records: {
      who: 'Quill',
      text: '"Archives, west door. Vess keeps them. She will like you, which is a warning."',
      choices: [{ label: 'Go west.', to: null }],
    },
  },

  // --- Pell, a fence ------------------------------------------------------
  pell: {
    start: {
      who: 'Pell',
      text: '"Buying, selling, forgetting. Which one?"',
      effects: { profile: { id: 'pell', name: 'Pell', role: 'Fence, Low Quay. Pays for what other people flinch from.' } },
      choices: [
        { label: '"What do you pay for?"', to: 'offer', if: { noQuest: 'coldCoin' } },
        { label: 'Hand over three cold coins.', to: 'payout', hint: 'job',
          if: { quest: 'coldCoin', items: { coldCoin: 3 } } },
        { label: '"Still counting."', to: 'waiting', if: { quest: 'coldCoin' } },
        { label: '"Who mints cold coin?"', to: 'mint', if: { quest: 'coldCoin', questState: 'done' } },
        { label: 'Nothing today.', to: null },
      ],
    },
    offer: {
      who: 'Pell',
      lines: ['He turns a coin over. It does not warm up in his fingers.'],
      text: '"Coins that come out of a rift and stay cold. Bring me three and I will pay you in something that shoots."',
      effects: { startQuest: 'coldCoin' },
      choices: [
        { label: '"Why cold coin?"', to: 'whyCold' },
        { label: '"Three. Fine."', to: null },
      ],
    },
    whyCold: {
      who: 'Pell',
      text: '"Because somebody is paying in it, and I would like to know who before he stops."',
      effects: { lore: 'Someone is paying market people in coin that never warms up.' },
      choices: [{ label: 'Go and get three.', to: null }],
    },
    waiting: {
      who: 'Pell',
      text: '"Three. Not two and an argument."',
      choices: [{ label: 'Fine.', to: null }],
    },
    payout: {
      who: 'Pell',
      lines: ['He lays the three coins in a row and does not touch them again.'],
      text: '"Harbour issue. It fires a flare that thinks it is a sun. Do not point it at anything you like."',
      effects: { finishQuest: 'coldCoin', takeItem: { coldCoin: 3 } },
      choices: [{ label: '"Now. Who mints them?"', to: 'mint' }],
    },
    mint: {
      who: 'Pell',
      text: '"Not who. Where. They come up the water from a place that is not on the water. Ask Halloran what he signs for."',
      effects: { clue: { id: 'pell-points', text: 'Pell says the cold coin comes up the water from a place that is not on the water.' },
        startQuest: 'thirdBell' },
      choices: [{ label: 'Go and ask Halloran.', to: null }],
    },
  },

  // --- Odo, a boy on the quay --------------------------------------------
  odo: {
    start: {
      who: 'Tata',
      lines: ['The boy is watching the water. He does not blink as often as a person should.'],
      text: '"You are Odo. You have been missing for eleven days."',
      effects: { profile: { id: 'odo', name: 'Odo', role: 'One of the missing children. Found, in the loosest sense.' } },
      choices: [
        { label: '"Where have you been?"', to: 'where' },
        { label: 'Say nothing. Sit down next to him.', to: 'sit' },
      ],
    },
    where: {
      who: 'Odo',
      text: '"On the other side of the water. It was not far. It just was not here."',
      effects: { clue: { id: 'odo-other-side', text: 'Odo says he was taken to the other side of the water — "not far, just not here".' },
        anomaly: 'A missing child came back through the water without a boat.' },
      choices: [
        { label: '"Who took you?"', to: 'who' },
        { label: '"Are the others there?"', to: 'others' },
      ],
    },
    sit: {
      who: 'Odo',
      lines: ['They sit. A gull argues with something. Eventually he talks, because she does not.'],
      text: '"They counted us twice. Once going and once coming back, and the numbers were different."',
      effects: { clue: { id: 'counted-twice', text: 'The children were counted twice — going and coming back — and the numbers differed.' },
        lore: 'Whoever runs the crossing counts the children, and does not always get the same answer.' },
      choices: [
        { label: '"Who counted?"', to: 'who' },
        { label: '"Are the others there?"', to: 'others' },
      ],
    },
    who: {
      who: 'Odo',
      text: '"A man with a book. He signs, and then the boat is allowed to be a boat again."',
      effects: { clue: { id: 'odo-signer', text: 'Odo: a man with a book signs, and only then is the boat allowed to leave.' } },
      choices: [{ label: '"Thank you, Odo."', to: null }],
    },
    others: {
      who: 'Odo',
      lines: ['He answers the water rather than her.'],
      text: '"Vance is still there. She is fine. She said not to come, and then she said to hurry."',
      effects: { clue: { id: 'vance-waiting', text: 'Vance is still on the other side. Told Odo not to come — and then to hurry.' },
        lore: 'Two instructions from the same child: do not come, and hurry.' },
      choices: [{ label: 'Write both halves down.', to: null }],
    },
  },

  // --- Halloran, the harbourmaster ---------------------------------------
  halloran: {
    start: {
      who: 'Halloran',
      lines: ['He is standing where the boat would be, if there were a boat.'],
      text: '"Quay is closed to children."',
      effects: { profile: { id: 'halloran', name: 'Halloran', role: 'Harbourmaster, Low Quay. Signs for everything.' } },
      choices: [
        { label: '"You sign for every cargo."', to: 'signs', if: { clue: 'halloran-signs' } },
        { label: '"What comes in at third bell?"', to: 'bell' },
        { label: 'Show him the manifest.', to: 'manifest', hint: 'evidence', if: { item: 'manifest' } },
        { label: 'Question him properly.', to: 'sitDown', hint: 'interrogate',
          if: { flag: 'halloranReady', notFlag: 'halloranBroken' } },
        { label: 'Step back off the quay.', to: null },
      ],
    },
    bell: {
      who: 'Halloran',
      text: '"Salt. Rope. The tide. Nothing that needs a detective."',
      effects: { profile: { id: 'halloran', note: 'Answers "third bell" with a list, not a sentence.' } },
      choices: [
        { label: '"I did not say which bell."', to: 'slip' },
        { label: 'Let it go for now.', to: null },
      ],
    },
    slip: {
      who: 'Halloran',
      lines: ['The pause is long enough to hear the water in it.'],
      text: '"…Everything on this quay runs to a bell, child."',
      effects: { flag: 'halloranReady',
        clue: { id: 'halloran-slip', text: 'Halloran answered "third bell" before anyone said which bell.' },
        profile: { id: 'halloran', pressure: 'He knew which bell.' } },
      choices: [
        { label: 'Sit him down now.', to: 'sitDown', hint: 'interrogate' },
        { label: 'Let him sweat first.', to: null },
      ],
    },
    signs: {
      who: 'Halloran',
      text: '"I sign for cargo. Cargo is a word for whatever is in the crate. That is the whole of my job."',
      effects: { flag: 'halloranReady', clue: { id: 'cargo-word', text: 'Halloran: "cargo is a word for whatever is in the crate."' } },
      choices: [
        { label: '"Then say what was in them."', to: 'sitDown', hint: 'interrogate' },
        { label: 'Not yet.', to: null },
      ],
    },
    manifest: {
      who: 'Tata',
      lines: ['She holds the torn manifest up at his eye level, which takes some doing.'],
      text: '"This has a column headed count. You signed under it."',
      effects: { flag: 'halloranReady', profile: { id: 'halloran', note: 'Went very still at the manifest.' } },
      choices: [
        { label: 'Question him properly.', to: 'sitDown', hint: 'interrogate' },
        { label: 'Put it away. For now.', to: null },
      ],
    },
    sitDown: {
      who: 'Tata',
      text: '"Sit down, Mr Halloran. This is the part where you talk."',
      effects: { flag: 'halloranInterro' },
      choices: [{ label: 'Open the notebook.', to: null }],
    },
  },

  // --- Vess, keeper of records -------------------------------------------
  vess: {
    start: {
      who: 'Vess',
      text: '"Quietly. The paper is older than your village, and twice as easily upset."',
      effects: { profile: { id: 'vess', name: 'Vess', role: 'Keeper of Records. Guards a year that is missing.' } },
      choices: [
        { label: '"A page was cut out of our village record."', to: 'cutPage', if: { clue: 'cut-page' } },
        { label: '"What is the sealed year?"', to: 'sealed', if: { noQuest: 'sealedYear' } },
        { label: 'Hand over the three records.', to: 'handOver', hint: 'job',
          if: { quest: 'sealedYear', flag: 'recordsAll' } },
        { label: 'Browse, and touch nothing.', to: null },
      ],
    },
    cutPage: {
      who: 'Vess',
      text: '"Cut, not lost. Somebody with a knife and a schedule. It has happened in three villages that I know of."',
      effects: { clue: { id: 'three-villages', text: 'The same page has been cut out of the record in three villages.' },
        lore: 'Someone has been removing the same year from every archive that holds it.' },
      choices: [{ label: '"Which year?"', to: 'sealed' }],
    },
    sealed: {
      who: 'Vess',
      lines: ['She does not look up from the ledger she is not writing in.'],
      text: '"One year. Gone from every copy. Find me three records that survived it and I will put the year back together."',
      effects: { startQuest: 'sealedYear' },
      choices: [
        { label: '"Where would they have survived?"', to: 'where' },
        { label: '"Three records. Right."', to: null },
      ],
    },
    where: {
      who: 'Vess',
      text: '"In the boring shelves. Nobody censors a tide table."',
      choices: [{ label: 'Start reading.', to: null }],
    },
    handOver: {
      who: 'Vess',
      lines: ['She lays the three of them edge to edge and reads across the gap between them.'],
      text: '"A tide, a ledger and a complaint about noise. Together they make one sentence: something came up the well that year, and the village agreed to stop writing."',
      effects: { finishQuest: 'sealedYear',
        clue: { id: 'sealed-year', text: 'The sealed year: something came up the well, and the record was closed on purpose.' } },
      choices: [
        { label: '"It has happened before."', to: 'before' },
        { label: 'Say nothing for a while.', to: 'before' },
      ],
    },
    before: {
      who: 'Vess',
      lines: ['For the first time she looks at Tata rather than at the paper.'],
      text: '"Yes. And the note in your pocket is in a hand that has not learned to write it yet."',
      effects: { lore: 'A traveler came up the well once before, and the year was erased rather than explained.',
        flag: 'actTwoDone' },
      choices: [{ label: 'Close the notebook. Go home.', to: null }],
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
        { label: '"Is there anything I can actually do?"', to: 'job', if: { noQuest: 'register' } },
        { label: 'Hand her the register.', to: 'returned', hint: 'job', if: { item: 'register', quest: 'register' } },
        { label: 'Promise to write it down.', to: null },
      ],
    },
    which: {
      who: 'Nima',
      text: '"Odo and the little Vance girl. Both families paid off something the same week. Nobody in this village pays off anything."',
      effects: { clue: { id: 'paid-off', text: 'Both families of the missing children settled debts the same week.' } },
      choices: [{ label: 'Write both names down.', to: null }],
    },
    job: {
      who: 'Nima',
      lines: ['She hesitates, which teachers are not supposed to do.'],
      text: '"My register is gone. Someone walked it north into the trees rather than let me read a name in it aloud."',
      effects: { startQuest: 'register' },
      choices: [
        { label: '"I will go north."', to: null, effects: { profile: { id: 'nima', note: 'Trusted Tata with the missing register.' } } },
        { label: '"North is where the blue is."', to: 'northBlue' },
      ],
    },
    northBlue: {
      who: 'Nima',
      text: '"Yes. And a register is only paper. Go carefully, and come back rude and alive."',
      choices: [{ label: 'Go.', to: null }],
    },
    returned: {
      who: 'Nima',
      lines: ['She turns the pages with two fingers, the way you hold something that bit you once.'],
      text: '"Odo. Vance. And… this one is scratched out so hard the paper gave up."',
      effects: { finishQuest: 'register', takeItem: { register: 1 },
        clue: { id: 'third-name', text: 'A third name in the register, scratched out hard enough to tear the page.' } },
      choices: [{ label: '"Whose name was it?"', to: 'whoseName' }],
    },
    whoseName: {
      who: 'Nima',
      text: '"I do not know. But whoever did the scratching had the register before the forest did."',
      effects: { lore: 'Someone removed a child from the record before removing the child.' },
      choices: [{ label: 'Write it down.', to: null }],
    },
    watch: {
      who: 'Nima',
      text: '"Brann took the report and his hand shook writing it. Make of that what you like."',
      effects: { profile: { id: 'brann', note: 'His hand shook while writing the missing-children report.' } },
      choices: [{ label: 'She will.', to: null }],
    },
  },
};
