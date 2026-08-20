/*
 * Side quests (gameplan §8 Phase 3). A quest is a short chain of steps; the
 * world advances it by calling `advanceQuest(id, step)` from a talk effect, an
 * interact, or an enemy drop. The notebook's JOBS tab renders whatever state
 * the quest is in, so nothing else needs to know the shape of a quest.
 */
export const QUESTS = {
  register: {
    id: 'register', title: 'The Missing Register', giver: 'Nima',
    blurb: 'The school register went out of the village in someone’s coat pocket.',
    steps: [
      'Find the register. Nima says it went north, into the trees.',
      'Take it back to Nima before she has to explain the gap herself.',
    ],
    done: 'Returned. Two names in it that the village had already agreed to forget.',
    reward: { coin: 40, clue: { id: 'register-names', text: 'The register lists Odo and Vance — and a third name, scratched out.' } },
  },

  thirdBell: {
    id: 'thirdBell', title: 'Third Bell', giver: 'Sable',
    blurb: 'Cargo moves at third bell. Sable opens the gate; someone else owns the boat.',
    steps: [
      'Get to Market City and find whoever meets the boat.',
      'Question the harbourmaster. He signs for the cargo nobody counts.',
    ],
    done: 'Halloran signed for it. He also knew what "it" was.',
    reward: { coin: 90, item: 'ward' },
  },

  coldCoin: {
    id: 'coldCoin', title: 'Cold Coin', giver: 'Pell',
    blurb: 'A fence in the market pays for coins that come out of a rift still cold.',
    steps: [
      'Bring Pell three rift-cold coins. Rift-charged things carry them.',
      'Collect from Pell, and get a straight answer about who mints them.',
    ],
    done: 'Paid in a weapon, and in the name of the man who pays in cold coin.',
    reward: { weapon: 'flare', clue: { id: 'cold-mint', text: 'Cold coin is minted on the far side of a rift. Somebody over there is paying.' } },
  },

  sealedYear: {
    id: 'sealedYear', title: 'The Sealed Year', giver: 'Vess',
    blurb: 'One year is missing from the archive, and the page naming who sealed the well was cut out.',
    steps: [
      'Find three records from the sealed year in the Archives.',
      'Take them to Vess and watch her put the year back together.',
    ],
    done: 'The year is legible again. Nobody is happier for it.',
    reward: { coin: 60, lore: 'The archive year that was cut out is the year a traveler came up the well the first time.' },
  },
};

export const questList = () => Object.values(QUESTS);
