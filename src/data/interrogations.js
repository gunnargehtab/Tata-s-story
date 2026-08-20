/*
 * Interrogation subjects (gameplan §2 "Unique mechanic: Interrogation").
 *
 * A subject holds three tracks:
 *   composure — empty it and they break
 *   trust     — empty it and they stop talking to you at all
 *   patience  — how many exchanges you get before they walk
 *
 * `statements` are what they claim. A statement with `contradicts` is a lie:
 * present the named evidence (a key item or a clue already in the notebook)
 * while it is on the table and it collapses, taking a chunk of composure with
 * it and yielding a truth. That is the loop — listen, catch, prove.
 */
export const SUBJECTS = {
  sable: {
    id: 'sable', name: 'Sable', role: 'Merchant, west stall',
    sprite: { set: 'npc', key: 'merchant' },
    composure: 26, trust: 5, patience: 15, guard: 6, resist: 3,
    open: 'Sable keeps her hands busy with a crate that is already packed.',
    statements: [
      { id: 'dusk', text: 'I closed the stall at dusk, same as always.',
        contradicts: 'manifest',
        truth: { id: 'sable-bell', text: 'Sable was at the well at third bell, not at home.' } },
      { id: 'never', text: 'I have never been down that well. Nobody has.',
        contradicts: 'crate-cargo',
        truth: { id: 'sable-crates', text: 'Sable’s crates carry the same mark as the well manifest.' } },
      { id: 'children', text: 'The children are fine. They are at their lessons.',
        contradicts: 'missing',
        truth: { id: 'sable-count', text: 'The manifest column headed "count" was counting children.' } },
      { id: 'lantern', text: 'My lantern went out with everyone else’s. That is all I know.' },
    ],
    tells: [
      'She answers the question you did not ask, and quickly.',
      'Her thumb keeps finding a mark burned into the crate lid.',
      'Every time you say "well", she looks at the road instead.',
    ],
    replies: {
      calm: ['"You are a polite child," she says. "That is worse."', '"Ask your questions. I have stock to move."'],
      direct: ['"That is a hard way to put it."', '"You are not the watch. You are twelve."'],
      aggro: ['"Mind your mouth in my square."', 'Her jaw sets. The crate lid slams.'],
      silent: ['The silence goes on. She fills it, badly: "It was only cargo."', 'She looks at the well. She does not mean to.'],
    },
    breakLines: [
      '"It was only cargo," Sable says. "That is what he called it. I never looked in the crates."',
      '"Third bell. Every third night. I open the gate and I look at my shoes."',
    ],
    onBreak: {
      clue: { id: 'sable-broken', text: 'Sable opens the gate at third bell for a man she will not name.' },
      lore: 'Someone in the village has been paid in coin that goes cold in your hand.',
      item: 'recorder',
      flag: 'sableBroken',
      profile: { id: 'sable', name: 'Sable', role: 'Merchant, west stall', pressure: 'The crate lid. The mark burned into it.', broken: true },
      xp: 22,
    },
    clamLines: ['"We are done." She turns her back and does not turn around again.'],
    walkLines: ['"I have a stall to close." She is already walking.'],
  },

  keeper: {
    id: 'keeper', name: 'The Lantern Keeper', role: 'Posted at the well. By whom, it will not say.',
    sprite: { set: 'enemy', key: 'keeper' },
    composure: 34, trust: 3, patience: 16, guard: 9, resist: 5,
    open: 'The lantern is dark now. The shape behind it has not moved since it fell.',
    statements: [
      { id: 'posted', text: '"I was posted here. That is the whole of it."' },
      { id: 'nothing', text: '"Nothing came up the well tonight."',
        contradicts: 'shockwave',
        truth: { id: 'keeper-arrival', text: 'The Traveler did not walk into the village. He came up out of the well.' } },
      { id: 'capsule', text: '"The capsule is not yours. You were not meant to hold it."',
        contradicts: 'capsule',
        truth: { id: 'keeper-hand', text: 'The capsule note is in my own handwriting. Older. Steadier.' } },
      { id: 'door', text: '"A door is not a crime. Someone has to stand at it."',
        contradicts: 'cargo',
        truth: { id: 'keeper-freight', text: 'The Keeper counted what went down as well as what came up.' } },
    ],
    tells: [
      'The dead flame ducks, once, when it says the word "posted".',
      'Glass grinds somewhere inside it whenever you mention the traveler.',
      'It answers in the past tense about a job it is still doing.',
    ],
    replies: {
      calm: ['"You do not shout. He did not shout either."', '"Ask it again. Slower. I am old."'],
      direct: ['"That is the question, yes. It is not the one you want answered."', '"You are early. I have said so."'],
      aggro: ['The chamber goes cold. "Careful, small detective."', '"Shouting at a door does not open it."'],
      silent: ['It waits. Then, because nothing else will: "It was not to keep you out."', 'The dark does the talking. It does not like that.'],
    },
    breakLines: [
      '"I was posted here to keep it IN," it says. "Not you. Never you."',
      '"He came up. He was not supposed to be able to. That is the whole of my failure."',
    ],
    onBreak: {
      clue: { id: 'keeper-in', text: 'The Keeper was posted to keep something IN. The Traveler came up anyway.' },
      lore: 'The well is a door. Doors have two sides, and someone drew the short straw on ours.',
      item: 'keeperGlass',
      flag: 'keeperBroken',
      profile: { id: 'keeper', name: 'The Lantern Keeper', role: 'Doorkeeper of the Old Well', pressure: 'The word "posted".', broken: true },
      xp: 40,
    },
    clamLines: ['The lantern relights, dull and stubborn. It will not speak again tonight.'],
    walkLines: ['The shape settles into the brick and becomes, convincingly, a wall.'],
  },
};
