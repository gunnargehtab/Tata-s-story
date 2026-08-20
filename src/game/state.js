import { MAPS, prepareMap } from '../data/maps.js';

const SAVE_KEY = 'tata-prototype-v1';

export function newTata() {
  return {
    id: 'tata', name: 'Tata',
    level: 1, xp: 0,
    hp: 34, maxHp: 34,
    foc: 12, maxFoc: 12,   // Focus powers skills
    atk: 7,
    INT: 8,   // interrogation
    DEX: 7,   // accuracy / turn order
    PER: 6,   // perception, clue finding
    RES: 4,   // rift resistance
  };
}

export const G = {
  scene: 'title',
  mapId: null,
  map: null,
  player: { x: 4, y: 5, px: 4, py: 5, facing: 'down', moving: false, t: 0, path: [], anim: 0 },
  tata: newTata(),
  flags: {},
  clues: [],
  items: { bandage: 3, tonic: 2 },
  steps: 0,
  battle: null,
  actors: [],   // scripted, non-map actors (the Traveler, the dog)
  time: 0,
};

export function enterMap(id, x, y, facing = 'down') {
  G.mapId = id;
  G.map = prepareMap(MAPS[id]);
  G.player.x = G.player.px = x;
  G.player.y = G.player.py = y;
  G.player.facing = facing;
  G.player.moving = false;
  G.player.path.length = 0;
  G.actors = [];
  // NPC live positions are kept on the map object itself.
  for (const npc of G.map.npcs || []) {
    if (npc.cx === undefined) { npc.cx = npc.x; npc.cy = npc.y; npc.frame = 0; npc.dir = npc.facing || 'down'; }
  }
}

export function addClue(id, text) {
  if (G.clues.some((c) => c.id === id)) return false;
  G.clues.push({ id, text });
  return true;
}

const XP_TABLE = [0, 24, 60, 120, 210, 340];

export function grantXp(amount) {
  const t = G.tata;
  t.xp += amount;
  let levelled = false;
  while (t.level < XP_TABLE.length && t.xp >= XP_TABLE[t.level]) {
    t.level++;
    t.maxHp += 6; t.hp = t.maxHp;
    t.maxFoc += 3; t.foc = t.maxFoc;
    t.atk += 2; t.INT += 1; t.DEX += 1;
    if (t.level % 2 === 0) { t.PER += 1; t.RES += 1; }
    levelled = true;
  }
  return levelled;
}

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mapId: G.mapId, x: G.player.x, y: G.player.y, facing: G.player.facing,
      tata: G.tata, flags: G.flags, clues: G.clues, items: G.items,
    }));
  } catch { /* private mode: play on without saving */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !MAPS[d.mapId]) return false;
    G.tata = { ...newTata(), ...d.tata };
    G.flags = d.flags || {};
    G.clues = d.clues || [];
    G.items = { ...G.items, ...(d.items || {}) };
    enterMap(d.mapId, d.x, d.y, d.facing);
    return true;
  } catch { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
