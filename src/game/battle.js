import { ENEMIES } from '../data/enemies.js';
import { SKILLS, ITEMS, TONES } from '../data/skills.js';
import { G, addClue, grantXp } from './state.js';
import { SPRITES } from '../art/sprites.js';
import { PAL } from '../art/palette.js';
import { inkPanel, text, wrap, bar, drawControls, VIEW } from '../engine/ui.js';
import { Input } from '../engine/input.js';

const rand = (n) => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COMMANDS = ['Attack', 'Skill', 'Item', 'Interrogate', 'Run'];

/** @param {string[]} ids enemy ids @param {object} opts {boss, onEnd, intro} */
export function startBattle(ids, opts = {}) {
  const enemies = ids.map((id, i) => {
    const base = ENEMIES[id];
    return {
      ...base,
      slot: i,
      maxHp: base.hp, curHp: base.hp,
      maxMorale: base.morale, curMorale: base.morale,
      alive: true, stun: 0, mark: 0, revealed: false, shake: 0, flash: 0,
    };
  });
  G.battle = {
    enemies,
    phase: 'msg',
    after: 'menu',
    cursor: 0, subCursor: 0, target: 0,
    submenu: null,
    messages: [],
    msgTimer: 0,
    navTimer: 0,
    result: null,
    xp: 0,
    fleeing: false,
    canRun: !opts.boss,
    onEnd: opts.onEnd || null,
    hitRects: [],
    shakeScreen: 0,
  };
  const b = G.battle;
  say(b, opts.intro || `${enemies.length > 1 ? 'Something moves' : enemies[0].name + ' blocks the way'}.`);
  for (const e of enemies) if (e.barks) say(b, e.barks[rand(e.barks.length)]);
  G.scene = 'battle';
}

function say(b, line) { b.messages.push(line); }

const living = (b) => b.enemies.filter((e) => e.alive);

// ---------------------------------------------------------------- resolution

function damageEnemy(b, e, amount, tag) {
  let dmg = amount;
  let note = '';
  if (tag && e.weakness === tag) {
    dmg = Math.round(dmg * 1.75);
    e.revealed = true;
    note = ' Weak point!';
  }
  if (e.mark > 0) dmg = Math.round(dmg * 1.35);
  dmg = Math.max(1, dmg - Math.round(e.def * 0.6));
  e.curHp = Math.max(0, e.curHp - dmg);
  e.shake = 0.3; e.flash = 0.2;
  b.shakeScreen = 0.18;
  say(b, `${e.name} takes ${dmg}.${note}`);
  if (e.curHp === 0) {
    e.alive = false;
    b.xp += e.xp;
    if (e.clue && addClue(e.clue.id, e.clue.text)) say(b, `Notebook: ${e.clue.text}`);
    say(b, `${e.name} comes apart into ordinary things.`);
  }
}

function playerAttack(b, e) {
  const t = G.tata;
  const hitChance = clamp(0.72 + (t.DEX - e.DEX) * 0.04, 0.35, 0.95);
  if (Math.random() > hitChance) { say(b, 'The burst goes wide.'); return; }
  const crit = Math.random() < clamp(t.DEX * 0.012, 0.02, 0.2);
  let dmg = t.atk + rand(4) + (crit ? Math.round(t.atk * 0.8) : 0);
  if (crit) say(b, 'Clean line of sight —');
  damageEnemy(b, e, dmg, 'smg');
}

function useSkill(b, skill, e) {
  const t = G.tata;
  if (t.foc < skill.cost) { say(b, 'Not enough focus.'); return false; }
  t.foc -= skill.cost;
  say(b, skill.flavor);
  if (skill.reveal) {
    e.revealed = true;
    e.mark = skill.mark;
    say(b, `Drone reads ${e.name}: weak to ${labelForTag(e.weakness)}.`);
    return true;
  }
  for (let i = 0; i < skill.hits; i++) {
    if (!e.alive) break;
    const dmg = Math.round(t.atk * skill.power) + rand(3);
    damageEnemy(b, e, dmg, skill.tag);
  }
  if (skill.stun && e.alive) { e.stun += skill.stun; say(b, `${e.name} is blinded.`); }
  return true;
}

function labelForTag(tag) {
  const s = SKILLS.find((k) => k.tag === tag);
  return s ? s.name : 'gunfire';
}

function interrogate(b, tone, e) {
  const t = G.tata;
  const roll = Math.round(t.INT * tone.power) + rand(5) - (e.RES + tone.res);
  say(b, `Tata, ${tone.name.toLowerCase()}: "${questionFor(e, tone)}"`);
  if (roll <= 0) {
    e.curMorale = Math.min(e.maxMorale, e.curMorale + 1);
    say(b, `${e.name} gives her nothing. It steadies itself.`);
    return;
  }
  e.curMorale = Math.max(0, e.curMorale - roll);
  say(b, `${e.name} falters. (-${roll} morale)`);
  if (!e.revealed && roll >= 6) {
    e.revealed = true;
    say(b, `It guards one side — weak to ${labelForTag(e.weakness)}.`);
  }
  if (e.curMorale === 0) {
    e.alive = false;
    b.xp += Math.round(e.xp * 0.6);
    say(b, e.breaks);
    if (e.clue && addClue(e.clue.id, e.clue.text)) say(b, `Notebook: ${e.clue.text}`);
  }
}

function questionFor(e, tone) {
  const q = {
    calm: 'Who told you to stand here?',
    direct: 'Where did the traveler go?',
    aggro: 'You are in my village. Explain yourself.',
    silent: '…',
  };
  return q[tone.id] || q.direct;
}

function useItem(b, key) {
  const item = ITEMS[key];
  if (!G.items[key]) { say(b, `No ${item.name.toLowerCase()} left.`); return false; }
  G.items[key]--;
  if (item.heal) { G.tata.hp = Math.min(G.tata.maxHp, G.tata.hp + item.heal); }
  if (item.foc) { G.tata.foc = Math.min(G.tata.maxFoc, G.tata.foc + item.foc); }
  say(b, item.text);
  return true;
}

function tryRun(b) {
  const avgDex = living(b).reduce((s, e) => s + e.DEX, 0) / Math.max(1, living(b).length);
  if (Math.random() < clamp(0.45 + (G.tata.DEX - avgDex) * 0.05, 0.15, 0.9)) {
    say(b, 'Tata backs off into the dark. Questions keep.');
    b.fleeing = true;
    return true;
  }
  say(b, 'No angle to run. Not yet.');
  return false;
}

function enemyTurn(b) {
  for (const e of living(b)) {
    if (e.stun > 0) { e.stun--; say(b, `${e.name} is still seeing white.`); continue; }
    if (e.mark > 0) e.mark--;
    const t = G.tata;
    const hitChance = clamp(0.7 + (e.DEX - t.DEX) * 0.04, 0.3, 0.95);
    if (Math.random() > hitChance) { say(b, `${e.name} misses.`); continue; }
    const raw = e.atk + rand(4);
    const dmg = Math.max(1, raw - Math.round(t.RES * 0.5));
    t.hp = Math.max(0, t.hp - dmg);
    b.shakeScreen = 0.22;
    say(b, `${e.name} hits Tata for ${dmg}.`);
    if (t.hp === 0) { say(b, 'Tata goes down on one knee. The notebook lands open.'); return; }
  }
}

function endOfPlayerAction(b) {
  if (living(b).length === 0) { b.after = 'win'; return; }
  if (b.fleeing) { b.after = 'flee'; return; }
  b.after = 'enemy';
}

// ------------------------------------------------------------------- update

function moveCursor(b, dt) {
  b.navTimer -= dt;
  if (!Input.dir || b.navTimer > 0) return null;
  b.navTimer = 0.17;
  return Input.dir;
}

export function updateBattle(dt) {
  const b = G.battle;
  if (!b) return;
  b.shakeScreen = Math.max(0, b.shakeScreen - dt);
  for (const e of b.enemies) { e.shake = Math.max(0, e.shake - dt); e.flash = Math.max(0, e.flash - dt); }

  if (b.phase === 'msg') {
    b.msgTimer += dt;
    const advance = Input.actionPressed || Input.taps.length > 0 || b.msgTimer > 1.6;
    if (advance) {
      b.messages.shift();
      b.msgTimer = 0;
      if (b.messages.length === 0) resolveAfter(b);
    }
    return;
  }
  if (b.phase === 'over') {
    if (Input.actionPressed || Input.taps.length > 0) finish(b);
    return;
  }
  updateMenus(b, dt);
}

function resolveAfter(b) {
  if (G.tata.hp === 0) { b.result = 'lose'; b.phase = 'over'; return; }
  switch (b.after) {
    case 'enemy':
      enemyTurn(b);
      b.after = G.tata.hp === 0 ? 'lose' : 'menu';
      if (b.messages.length) { b.phase = 'msg'; b.msgTimer = 0; }
      else resolveAfter(b);
      break;
    case 'win': {
      b.result = 'win';
      const levelled = grantXp(b.xp);
      b.messages.push(`The way is clear. +${b.xp} XP.`);
      if (levelled) b.messages.push(`Tata reaches level ${G.tata.level}. She writes that down too.`);
      b.phase = 'msg';
      b.after = 'done';
      break;
    }
    case 'flee':
      b.result = 'flee';
      b.phase = 'over';
      break;
    case 'lose':
      b.result = 'lose';
      b.phase = 'over';
      break;
    case 'done':
      b.phase = 'over';
      break;
    default:
      b.phase = 'menu';
      b.submenu = null;
      if (b.target >= b.enemies.length || !b.enemies[b.target].alive) {
        const first = b.enemies.findIndex((e) => e.alive);
        b.target = first < 0 ? 0 : first;
      }
  }
}

function finish(b) {
  const cb = b.onEnd;
  const result = b.result;
  G.battle = null;
  G.scene = 'world';
  if (cb) cb(result);
}

function commitAction(b, run) {
  const before = b.messages.length;
  const ok = run();
  if (ok === false && b.messages.length === before) return;   // nothing happened
  endOfPlayerAction(b);
  b.phase = 'msg';
  b.msgTimer = 0;
  if (b.messages.length === 0) resolveAfter(b);
}

function updateMenus(b, dt) {
  const dir = moveCursor(b, dt);
  const tap = Input.taps[0];
  let picked = null;

  if (tap) {
    for (const r of b.hitRects) {
      if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) { picked = r; break; }
    }
  }

  // target selection ------------------------------------------------------
  if (b.phase === 'target') {
    const alive = living(b);
    if (picked && picked.kind === 'enemy') { b.target = picked.index; confirmTarget(b); return; }
    if (dir === 'left' || dir === 'up') b.target = prevAlive(b, -1);
    if (dir === 'right' || dir === 'down') b.target = prevAlive(b, 1);
    if (Input.actionPressed) confirmTarget(b);
    if (alive.length === 0) resolveAfter(b);
    return;
  }

  // command / submenus ----------------------------------------------------
  const list = currentList(b);
  if (picked && picked.kind === 'menu') { b.cursor = picked.index; b.subCursor = picked.index; select(b); return; }
  if (dir === 'down') moveIndex(b, 1, list.length);
  if (dir === 'up') moveIndex(b, -1, list.length);
  if (Input.menuPressed && b.submenu) { b.submenu = null; b.phase = 'menu'; }
  if (Input.actionPressed) select(b);
}

function prevAlive(b, step) {
  let i = b.target;
  for (let n = 0; n < b.enemies.length; n++) {
    i = (i + step + b.enemies.length) % b.enemies.length;
    if (b.enemies[i].alive) return i;
  }
  return b.target;
}

function moveIndex(b, delta, len) {
  if (b.submenu) b.subCursor = (b.subCursor + delta + len) % len;
  else b.cursor = (b.cursor + delta + len) % len;
}

function currentList(b) {
  if (b.submenu === 'skill') return SKILLS;
  if (b.submenu === 'item') return Object.values(ITEMS);
  if (b.submenu === 'tone') return TONES;
  return COMMANDS;
}

function select(b) {
  if (!b.submenu) {
    const cmd = COMMANDS[b.cursor];
    if (cmd === 'Attack') { b.pending = { kind: 'attack' }; beginTarget(b); }
    else if (cmd === 'Skill') { b.submenu = 'skill'; b.subCursor = 0; }
    else if (cmd === 'Item') { b.submenu = 'item'; b.subCursor = 0; }
    else if (cmd === 'Interrogate') { b.submenu = 'tone'; b.subCursor = 0; }
    else if (cmd === 'Run') {
      if (!b.canRun) { b.messages.push('The chamber has no exit that it will allow.'); b.phase = 'msg'; b.after = 'menu'; return; }
      commitAction(b, () => tryRun(b));
    }
    return;
  }
  if (b.submenu === 'skill') {
    const skill = SKILLS[b.subCursor];
    if (G.tata.foc < skill.cost) { b.messages.push('Not enough focus for that.'); b.phase = 'msg'; b.after = 'menu'; return; }
    b.pending = { kind: 'skill', skill };
    beginTarget(b);
  } else if (b.submenu === 'item') {
    const key = Object.keys(ITEMS)[b.subCursor];
    commitAction(b, () => useItem(b, key));
  } else if (b.submenu === 'tone') {
    b.pending = { kind: 'tone', tone: TONES[b.subCursor] };
    beginTarget(b);
  }
}

function beginTarget(b) {
  const alive = living(b);
  if (alive.length === 1) { b.target = b.enemies.indexOf(alive[0]); confirmTarget(b); return; }
  if (!b.enemies[b.target] || !b.enemies[b.target].alive) b.target = b.enemies.indexOf(alive[0]);
  b.phase = 'target';
}

function confirmTarget(b) {
  const e = b.enemies[b.target];
  const p = b.pending;
  b.submenu = null;
  if (p.kind === 'attack') commitAction(b, () => playerAttack(b, e));
  else if (p.kind === 'skill') commitAction(b, () => useSkill(b, p.skill, e));
  else if (p.kind === 'tone') commitAction(b, () => interrogate(b, p.tone, e));
}

// -------------------------------------------------------------------- draw

const PANEL_Y = 384;
const PANEL_H = 124;
const GROUND_Y = 246;

export function drawBattle(ctx) {
  const b = G.battle;
  if (!b) return;
  const shake = b.shakeScreen > 0 ? (Math.random() * 4 - 2) : 0;
  ctx.save();
  ctx.translate(shake, 0);
  b.hitRects = [];

  drawField(ctx, b);
  drawEnemies(ctx, b);
  drawStatus(ctx);
  drawPanel(ctx, b);

  ctx.restore();
  const confirming = b.phase === 'msg' || b.phase === 'over';
  drawControls(ctx, { pad: !confirming, actionLabel: confirming ? 'OK' : 'A', menu: !!b.submenu, menuLabel: 'BACK' });
}

function drawField(ctx, b) {
  ctx.fillStyle = PAL.W;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);      // whole page, no world bleed-through
  // hatched backdrop above the ground line, sketchbook style
  ctx.fillStyle = PAL.k;
  for (let i = 0; i < 60; i++) {
    const y = 60 + (i % 15) * 12;
    const x = (i * 53) % VIEW.width;
    ctx.fillRect(x, y, 8 + (i % 5) * 4, 1);
  }
  ctx.fillStyle = PAL.K;
  ctx.fillRect(0, GROUND_Y, VIEW.width, 3);
}

function drawEnemies(ctx, b) {
  const alive = b.enemies;
  const n = alive.length;
  alive.forEach((e, i) => {
    if (!e.alive) return;
    const sprite = SPRITES.enemy[e.sprite];
    const scale = e.boss ? 5 : 4;
    const w = sprite.width * scale, h = sprite.height * scale;
    const cx = VIEW.width * ((i + 1) / (n + 1));
    const x = Math.round(cx - w / 2) + (e.shake > 0 ? rand(5) - 2 : 0);
    const y = Math.round(GROUND_Y - 6 - h);
    ctx.drawImage(sprite, x, y, w, h);
    if (e.flash > 0) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.B; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    }
    b.hitRects.push({ kind: 'enemy', index: i, x, y, w, h });

    // hp + morale under each enemy
    const bw = 84;
    const bx = Math.round(cx - bw / 2);
    text(ctx, e.name, cx, 256, { size: 11, align: 'center', bold: true });
    text(ctx, 'HP', bx - 26, 271, { size: 9, color: PAL.g });
    bar(ctx, bx, 272, bw, 7, e.curHp / e.maxHp, PAL.R);
    text(ctx, 'MOR', bx - 26, 281, { size: 9, color: PAL.g });
    bar(ctx, bx, 281, bw, 5, e.curMorale / e.maxMorale, PAL.B);
    if (e.revealed) text(ctx, `weak: ${labelForTag(e.weakness)}`, cx, 289, { size: 9, align: 'center', color: PAL.b });
    if (G.battle.phase === 'target' && G.battle.target === i) {
      ctx.fillStyle = PAL.K;
      ctx.fillRect(cx - 6, y - 14, 12, 4);
      ctx.fillRect(cx - 3, y - 10, 6, 4);
    }
  });
}

function drawStatus(ctx) {
  const t = G.tata;
  inkPanel(ctx, 8, 300, 344, 76);
  text(ctx, `TATA  Lv${t.level}`, 20, 310, { size: 13, bold: true });
  text(ctx, `HP ${t.hp}/${t.maxHp}`, 20, 330, { size: 11 });
  bar(ctx, 110, 330, 100, 9, t.hp / t.maxHp, PAL.R);
  text(ctx, `FOC ${t.foc}/${t.maxFoc}`, 20, 346, { size: 11 });
  bar(ctx, 110, 346, 100, 9, t.foc / t.maxFoc, PAL.B);
  text(ctx, `INT ${t.INT}  DEX ${t.DEX}`, 224, 330, { size: 10 });
  text(ctx, `PER ${t.PER}  RES ${t.RES}`, 224, 346, { size: 10 });
  text(ctx, `${G.items.bandage} bandage · ${G.items.tonic} tonic`, 20, 362, { size: 10, color: PAL.g });
}

function drawPanel(ctx, b) {
  inkPanel(ctx, 8, PANEL_Y, 344, PANEL_H);
  const x = 24, y = PANEL_Y + 16;

  if (b.phase === 'msg' || b.phase === 'over') {
    const line = b.phase === 'over' ? overLine(b) : b.messages[0] || '';
    wrap(ctx, line, 300, 13).slice(0, 4).forEach((l, i) => text(ctx, l, x, y + i * 17, { size: 13 }));
    text(ctx, 'tap to continue', 330, PANEL_Y + PANEL_H - 20, { size: 10, align: 'right', color: PAL.g });
    return;
  }

  if (b.phase === 'target') {
    text(ctx, 'Choose a target', x, y, { size: 13, bold: true });
    text(ctx, 'tap a shape, or step with the pad', x, y + 22, { size: 11, color: PAL.g });
    text(ctx, 'then A to commit', x, y + 38, { size: 11, color: PAL.g });
    return;
  }

  const list = currentList(b);
  const idx = b.submenu ? b.subCursor : b.cursor;
  const cols = b.submenu ? 1 : 2;
  const rowH = 24;
  list.forEach((entry, i) => {
    const col = cols === 2 ? i % 2 : 0;
    const row = cols === 2 ? Math.floor(i / 2) : i;
    const ex = x + col * 160;
    const ey = y + row * rowH;
    const label = typeof entry === 'string' ? entry : entry.name;
    const cost = entry.cost ? ` ${entry.cost}f` : '';
    const count = b.submenu === 'item' ? ` x${G.items[entry.id] ?? 0}` : '';
    if (i === idx) {
      ctx.fillStyle = PAL.K;
      ctx.fillRect(ex - 12, ey + 3, 8, 8);
    }
    text(ctx, label + cost + count, ex, ey, { size: 13 });
    b.hitRects.push({ kind: 'menu', index: i, x: ex - 16, y: ey - 4, w: 150, h: rowH - 2 });
  });

  const hint = b.submenu ? (list[idx].desc || list[idx].note || '') : hintFor(COMMANDS[b.cursor]);
  wrap(ctx, hint, 300, 11).slice(0, 1).forEach((l, i) => text(ctx, l, x, PANEL_Y + PANEL_H - 20 + i * 14, { size: 11, color: PAL.g }));
}

function overLine(b) {
  if (b.result === 'win') return 'Tata writes the time in the margin and moves on.';
  if (b.result === 'flee') return 'She keeps the questions for later.';
  return 'The dark takes the notebook page. Tata wakes up somewhere safer.';
}

function hintFor(cmd) {
  return {
    Attack: 'Compact SMG. Short, controlled.',
    Skill: 'Baton, flashbang, drone — spend focus.',
    Item: 'Bandages and cold tonic.',
    Interrogate: 'Break its morale. Take a clue instead of a corpse.',
    Run: 'Live to ask again.',
  }[cmd] || '';
}
