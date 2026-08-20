import { MAPS, prepareMap } from '../data/maps.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS, weaponOf } from '../data/weapons.js';

const SAVE_KEY = 'tata-prototype-v2';

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
  tool: null,          // the one tool in hand; shifts stats
  weapon: 'smg',       // what Attack swings or fires
  weapons: { smg: true },
  coin: 0,
  quests: {},          // id -> { state: 'active'|'done', step }
  profiles: {},        // dossiers on people Tata has talked to or broken
  anomalies: [],       // rift events witnessed
  lore: [],            // fragments worth keeping
  steps: 0,
  rift: null,          // the live rift event, if one is open
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
  G.rift = null;        // rifts belong to the map they tore open in
  G.battleBuff = null;
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

export const hasClue = (id) => G.clues.some((c) => c.id === id);

// --- inventory -----------------------------------------------------------

export function addItem(id, n = 1) {
  if (!ITEMS[id]) return false;
  G.items[id] = (G.items[id] || 0) + n;
  return true;
}

export function takeItem(id, n = 1) {
  if (!G.items[id] || G.items[id] < n) return false;
  G.items[id] -= n;
  if (G.items[id] <= 0) delete G.items[id];
  return true;
}

export const hasItem = (id) => (G.items[id] || 0) > 0;

export function carried(kind) {
  return Object.keys(G.items)
    .filter((id) => ITEMS[id] && (!kind || ITEMS[id].kind === kind) && G.items[id] > 0)
    .map((id) => ITEMS[id]);
}

/** Equips a tool, or unequips when the same one is chosen again. */
export function equipTool(id) {
  G.tool = G.tool === id ? null : id;
  return G.tool;
}

// --- weapons -------------------------------------------------------------

export const heldWeapon = () => weaponOf(G.weapon);

export function ownWeapon(id) {
  if (!WEAPONS[id]) return false;
  G.weapons[id] = true;
  return true;
}

export function equipWeapon(id) {
  if (!G.weapons[id]) return false;
  G.weapon = id;
  return true;
}

export const ownedWeapons = () => Object.keys(G.weapons).filter((id) => WEAPONS[id]).map((id) => WEAPONS[id]);

// --- coin ----------------------------------------------------------------

export function addCoin(n) { G.coin = Math.max(0, G.coin + n); return G.coin; }
export function spendCoin(n) {
  if (G.coin < n) return false;
  G.coin -= n;
  return true;
}

/** A stat with the carried tool folded in — always use this, never tata.PER directly. */
export function stat(key) {
  const base = G.tata[key] || 0;
  const tool = G.tool && ITEMS[G.tool];
  const bonus = tool && tool.bonus ? (tool.bonus[key] || 0) : 0;
  const battle = G.battleBuff ? (G.battleBuff[key] || 0) : 0;
  return Math.max(0, base + bonus + battle);
}

// --- quests --------------------------------------------------------------

export function startQuest(id) {
  if (G.quests[id]) return false;
  G.quests[id] = { state: 'active', step: 0 };
  return true;
}

/** Moves a quest to a step, or finishes it when the step runs past the last one. */
export function advanceQuest(id, step = null) {
  const q = G.quests[id] || (G.quests[id] = { state: 'active', step: 0 });
  q.step = step === null ? q.step + 1 : step;
  return q;
}

export function finishQuest(id) {
  const q = G.quests[id] || (G.quests[id] = { state: 'active', step: 0 });
  q.state = 'done';
  return q;
}

export const questState = (id) => (G.quests[id] ? G.quests[id].state : null);
export const questStep = (id) => (G.quests[id] ? G.quests[id].step : -1);
export const questActive = (id) => questState(id) === 'active';
export const questDone = (id) => questState(id) === 'done';

// --- dossiers, anomalies, lore ------------------------------------------

/** Notes what Tata knows about a person. Repeated calls merge. */
export function noteProfile(id, patch) {
  const p = G.profiles[id] || (G.profiles[id] = { id, notes: [] });
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'note') { if (v && !p.notes.includes(v)) p.notes.push(v); }
    else p[k] = v;
  }
  return p;
}

export function noteAnomaly(text) {
  if (!G.anomalies.includes(text)) G.anomalies.push(text);
}

export function noteLore(text) {
  if (!G.lore.includes(text)) G.lore.push(text);
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
      tool: G.tool, profiles: G.profiles, anomalies: G.anomalies, lore: G.lore,
      weapon: G.weapon, weapons: G.weapons, coin: G.coin, quests: G.quests,
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
    G.items = d.items || { bandage: 3, tonic: 2 };
    G.tool = d.tool || null;
    G.profiles = d.profiles || {};
    G.anomalies = d.anomalies || [];
    G.lore = d.lore || [];
    G.weapon = d.weapon || 'smg';
    G.weapons = d.weapons || { smg: true };
    G.coin = d.coin || 0;
    G.quests = d.quests || {};
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
