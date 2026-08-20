/*
 * Weapons (gameplan §4). Tata's basic Attack takes its damage, accuracy and —
 * crucially — its **tag** from whatever she is holding, so the weapon decides
 * which enemy weaknesses her plain attack can exploit.
 */
export const WEAPONS = {
  smg: {
    id: 'smg', name: 'Compact SMG', tag: 'smg', atk: 0, hit: 0, price: 0,
    note: 'Hers since before she can explain. Short, controlled bursts.',
  },
  baton: {
    id: 'baton', name: 'Folding Baton', tag: 'baton', atk: 3, hit: 8, price: 45,
    note: 'Close work. Snaps open on the way down.',
  },
  revolver: {
    id: 'revolver', name: 'Snub Revolver', tag: 'smg', atk: 6, hit: -10, price: 110,
    note: 'Loud, heavy, and honest about what it is for.',
  },
  flare: {
    id: 'flare', name: 'Flare Pistol', tag: 'flashbang', atk: 2, hit: 0, blind: 0.4, price: 150,
    note: 'Harbour issue. Every shot is a small unwelcome sunrise.',
  },
  driver: {
    id: 'driver', name: 'Rivet Driver', tag: 'baton', atk: 9, hit: -8, price: 210,
    note: 'Dock tool. Goes through a crate, a hull, or an argument.',
  },
};

export const weaponOf = (id) => WEAPONS[id] || WEAPONS.smg;
