import { G, addClue, addItem, noteProfile, noteLore, grantXp, stat, save } from './state.js';
import { SUBJECTS } from '../data/interrogations.js';
import { ITEMS } from '../data/items.js';
import { TONES } from '../data/skills.js';
import { SPRITES } from '../art/sprites.js';
import { PAL } from '../art/palette.js';
import { VIEW, inkPanel, text, wrap, bar, drawControls } from '../engine/ui.js';
import { Input } from '../engine/input.js';

/*
 * Interrogation mode. Not a fight with different words: composure is broken by
 * PROOF, not by volume. Press to make them talk, observe to spot the lie,
 * present the evidence that makes the lie impossible.
 */

const rand = (n) => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COMMANDS = ['Press', 'Present', 'Observe', 'Back off'];
const PANEL_Y = 384, PANEL_H = 124;
const MAX_TRUST = 10;

export const Interro = {
  active: false, subject: null, phase: 'msg', after: 'menu',
  messages: [], msgTimer: 0, navTimer: 0,
  cursor: 0, subCursor: 0, submenu: null,
  hitRects: [], result: null, onEnd: null,
};

export function startInterrogation(id, opts = {}) {
  const base = SUBJECTS[id];
  if (!base) return false;
  const s = {
    ...base,
    maxComposure: base.composure, composure: base.composure,
    trust: base.trust, patience: base.patience,
    statements: base.statements.map((st) => ({ ...st, stated: false, marked: false, broken: false })),
    tellsLeft: base.tells.slice(),
  };
  Object.assign(Interro, {
    active: true, subject: s, phase: 'msg', after: 'menu',
    messages: [], msgTimer: 0, navTimer: 0,
    cursor: 0, subCursor: 0, submenu: null,
    hitRects: [], result: null, onEnd: opts.onEnd || null,
  });
  say(base.open);
  // they always open with their first claim, so there is something to work on
  stateNext(true);
  noteProfile(s.id, { name: s.name, role: s.role, note: 'Questioned by Tata.' });
  G.scene = 'interrogation';
  return true;
}

const say = (line) => Interro.messages.push(line);

function stateNext(force = false) {
  const s = Interro.subject;
  const next = s.statements.find((st) => !st.stated);
  if (!next) return false;
  if (!force && Math.random() < 0.35) return false;
  next.stated = true;
  say(`${s.name}: ${next.text}`);
  return true;
}

// ---------------------------------------------------------------- actions

function press(tone) {
  const s = Interro.subject;
  const roll = Math.round(stat('INT') * tone.power) + rand(5) - (s.resist + tone.res);
  say(`Tata, ${tone.name.toLowerCase()}: "${questionFor(tone)}"`);
  say(s.replies[tone.id][rand(s.replies[tone.id].length)]);

  if (roll > 0) {
    s.composure = Math.max(0, s.composure - roll);
    say(`Composure gives a little. (-${roll})`);
  } else {
    s.composure = Math.min(s.maxComposure, s.composure + 1);
    say('That one bounced off.');
  }
  s.trust = clamp(s.trust + toneTrust(tone), 0, MAX_TRUST);
  stateNext();
}

const toneTrust = (tone) => ({ calm: 1, direct: 0, aggro: -2, silent: -1 })[tone.id] ?? 0;

function questionFor(tone) {
  return {
    calm: 'Take your time. Who told you to stand here?',
    direct: 'Where did the traveler go?',
    aggro: 'You are lying to a child. Try being worse at it.',
    silent: '…',
  }[tone.id];
}

/** The heart of it: proof against a claim they have already made. */
function present(evidence) {
  const s = Interro.subject;
  say(`Tata puts it on the table: ${evidence.label}`);

  const target = s.statements.find((st) => st.stated && !st.broken && st.contradicts === evidence.id);
  if (target) {
    const hit = Math.round(s.maxComposure * 0.4) + rand(4);
    s.composure = Math.max(0, s.composure - hit);
    target.broken = true;
    target.marked = true;
    say(`"${target.text}" cannot stand next to that. (-${hit})`);
    if (target.truth && addClue(target.truth.id, target.truth.text)) say(`Notebook: ${target.truth.text}`);
    s.trust = clamp(s.trust - 1, 0, MAX_TRUST);
    stateNext(true);
    // prove every lie they told and there is nothing left to hold on to
    const lies = s.statements.filter((st) => st.contradicts);
    if (lies.every((st) => st.broken)) {
      say('Every claim she made is on the floor. She stops trying to pick them up.');
      s.composure = 0;
    }
    return;
  }

  const unstated = s.statements.find((st) => !st.stated && st.contradicts === evidence.id);
  if (unstated) {
    say('They have not said anything yet that this touches. Make them say it first.');
    return;
  }

  s.trust = clamp(s.trust - 1, 0, MAX_TRUST);
  s.composure = Math.min(s.maxComposure, s.composure + 2);
  say('It means nothing to them, and they enjoy that it means nothing.');
}

function observe() {
  const s = Interro.subject;
  const roll = stat('PER') + rand(6);
  if (roll <= s.guard) { say('Tata watches. Whatever it was, she was a half-second late.'); return; }

  const lie = s.statements.find((st) => st.stated && st.contradicts && !st.marked && !st.broken);
  if (lie) {
    lie.marked = true;
    say(`That one is a lie. "${lie.text}" — find the thing that proves it.`);
    noteProfile(s.id, { pressure: lie.text });
  }
  if (s.tellsLeft.length) say(s.tellsLeft.shift());
  else if (!lie) say('Nothing new in the way they hold themselves.');
}

// --------------------------------------------------------------- outcomes

function endOfAction() {
  const s = Interro.subject;
  s.patience--;

  if (s.composure <= 0) { Interro.after = 'break'; return; }
  if (s.trust <= 0) { Interro.after = 'clam'; return; }
  if (s.patience <= 0) { Interro.after = 'walk'; return; }

  // a subject who trusts her starts filling silences on their own
  if (s.trust >= 8) {
    const lie = s.statements.find((st) => st.stated && !st.broken && st.contradicts && !st.marked);
    if (lie && Math.random() < 0.5) {
      lie.marked = true;
      say(`${s.name} keeps talking, and talks past the edge of it. That was a lie.`);
      s.composure = Math.max(0, s.composure - 3);
    }
  }
  Interro.after = 'menu';
}

function resolveAfter() {
  const s = Interro.subject;
  switch (Interro.after) {
    case 'break': {
      Interro.result = 'break';
      for (const line of s.breakLines) say(line);
      const fx = s.onBreak || {};
      if (fx.clue && addClue(fx.clue.id, fx.clue.text)) say(`Notebook: ${fx.clue.text}`);
      if (fx.lore) { noteLore(fx.lore); say(`Fragment kept: ${fx.lore}`); }
      if (fx.item) { addItem(fx.item); say(`Satchel: ${ITEMS[fx.item].name}.`); }
      if (fx.flag) G.flags[fx.flag] = true;
      if (fx.profile) noteProfile(fx.profile.id, fx.profile);
      if (fx.xp) { const up = grantXp(fx.xp); say(`+${fx.xp} XP.`); if (up) say(`Tata reaches level ${G.tata.level}.`); }
      Interro.phase = 'msg';
      Interro.after = 'done';
      save();
      break;
    }
    case 'clam':
      Interro.result = 'clam';
      for (const line of s.clamLines) say(line);
      noteProfile(s.id, { note: 'Stopped talking. Pushed too hard, too early.' });
      Interro.phase = 'msg';
      Interro.after = 'done';
      save();
      break;
    case 'walk':
      Interro.result = 'walk';
      for (const line of s.walkLines) say(line);
      Interro.phase = 'msg';
      Interro.after = 'done';
      save();
      break;
    case 'left':
      Interro.result = 'left';
      Interro.phase = 'over';
      break;
    case 'done':
      Interro.phase = 'over';
      break;
    default:
      Interro.phase = 'menu';
      Interro.submenu = null;
  }
}

function finish() {
  const cb = Interro.onEnd;
  const result = Interro.result;
  Interro.active = false;
  G.scene = 'world';
  save();
  if (cb) cb(result);
}

// ----------------------------------------------------------------- update

export function updateInterrogation(dt) {
  const it = Interro;
  if (!it.active) return;

  if (it.phase === 'msg') {
    it.msgTimer += dt;
    if (Input.actionPressed || Input.taps.length > 0 || it.msgTimer > 1.9) {
      it.messages.shift();
      it.msgTimer = 0;
      if (!it.messages.length) resolveAfter();
    }
    return;
  }
  if (it.phase === 'over') {
    if (Input.actionPressed || Input.taps.length > 0) finish();
    return;
  }
  updateMenus(dt);
}

function commit(run) {
  run();
  endOfAction();
  Interro.phase = 'msg';
  Interro.msgTimer = 0;
  if (!Interro.messages.length) resolveAfter();
}

/** Evidence = key items she is carrying, plus clues already written down. */
export function evidenceList() {
  const out = [];
  for (const id of Object.keys(G.items)) {
    const item = ITEMS[id];
    if (item && item.kind === 'key') out.push({ id, label: item.name, hint: 'object', body: item.evidence });
  }
  for (const clue of G.clues) out.push({ id: clue.id, label: clue.text, hint: 'note', body: clue.text });
  return out;
}

function currentList() {
  if (Interro.submenu === 'tone') return TONES.map((t) => ({ label: t.name, hint: t.note, tone: t }));
  if (Interro.submenu === 'evidence') return evidenceList();
  return COMMANDS.map((c) => ({ label: c }));
}

function updateMenus(dt) {
  const it = Interro;
  it.navTimer -= dt;
  const list = currentList();

  if (Input.dir && it.navTimer <= 0) {
    it.navTimer = 0.17;
    const delta = Input.dir === 'down' ? 1 : Input.dir === 'up' ? -1 : 0;
    if (delta) {
      if (it.submenu) it.subCursor = (it.subCursor + delta + list.length) % list.length;
      else it.cursor = (it.cursor + delta + list.length) % list.length;
    }
  }
  if (Input.menuPressed && it.submenu) { it.submenu = null; return; }

  let picked = -1;
  for (const tap of Input.taps) {
    const hit = it.hitRects.find((r) => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h);
    if (hit) picked = hit.index;
  }
  if (Input.actionPressed) picked = it.submenu ? it.subCursor : it.cursor;
  if (picked < 0) return;

  if (it.submenu) { it.subCursor = picked; select(list[picked]); }
  else { it.cursor = picked; select(list[picked]); }
}

function select(entry) {
  const it = Interro;
  if (!it.submenu) {
    const cmd = entry.label;
    if (cmd === 'Press') { it.submenu = 'tone'; it.subCursor = 0; }
    else if (cmd === 'Present') {
      if (!evidenceList().length) { say('Nothing in the satchel worth putting on a table.'); it.phase = 'msg'; it.after = 'menu'; return; }
      it.submenu = 'evidence'; it.subCursor = 0;
    } else if (cmd === 'Observe') commit(() => observe());
    else if (cmd === 'Back off') { it.after = 'left'; it.phase = 'msg'; say('Tata closes the notebook. For now.'); }
    return;
  }
  if (it.submenu === 'tone') { it.submenu = null; commit(() => press(entry.tone)); }
  else if (it.submenu === 'evidence') { it.submenu = null; commit(() => present(entry)); }
}

// ------------------------------------------------------------------- draw

export function drawInterrogation(ctx) {
  const it = Interro;
  if (!it.active) return;
  const s = it.subject;
  it.hitRects = [];

  ctx.fillStyle = PAL.W;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PAL.k;
  for (let i = 0; i < 50; i++) ctx.fillRect((i * 61) % VIEW.width, 40 + (i % 12) * 13, 6 + (i % 4) * 5, 1);

  drawSubject(ctx, s);
  drawTracks(ctx, s);
  drawStatements(ctx, s);
  drawPanel(ctx, it, s);

  const confirming = it.phase === 'msg' || it.phase === 'over';
  drawControls(ctx, { pad: !confirming, actionLabel: confirming ? 'OK' : 'A', menu: !!it.submenu, menuLabel: 'BACK' });
}

function drawSubject(ctx, s) {
  const img = s.sprite.set === 'enemy' ? SPRITES.enemy[s.sprite.key] : SPRITES.npc[s.sprite.key].down[0];
  const scale = s.sprite.set === 'enemy' ? 4 : 5;
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, Math.round(VIEW.width / 2 - w / 2), Math.round(196 - h), w, h);
  ctx.fillStyle = PAL.K;
  ctx.fillRect(0, 198, VIEW.width, 3);
  text(ctx, s.name, VIEW.width / 2, 206, { size: 14, align: 'center', bold: true });
  text(ctx, s.role, VIEW.width / 2, 224, { size: 10, align: 'center', color: PAL.g });
}

function drawTracks(ctx, s) {
  inkPanel(ctx, 8, 240, VIEW.width - 16, 64);
  text(ctx, 'COMPOSURE', 22, 250, { size: 9, color: PAL.g });
  bar(ctx, 100, 250, 150, 8, s.composure / s.maxComposure, PAL.R);
  text(ctx, `${s.composure}`, 262, 249, { size: 10 });
  text(ctx, 'TRUST', 22, 268, { size: 9, color: PAL.g });
  bar(ctx, 100, 268, 150, 8, s.trust / MAX_TRUST, PAL.B);
  text(ctx, `${s.trust}`, 262, 267, { size: 10 });
  text(ctx, `exchanges left: ${Math.max(0, s.patience)}`, 22, 286, { size: 10, color: PAL.g });
  text(ctx, `INT ${stat('INT')}  PER ${stat('PER')}`, VIEW.width - 26, 286, { size: 10, align: 'right', color: PAL.g });
}

function drawStatements(ctx, s) {
  const stated = s.statements.filter((st) => st.stated);
  inkPanel(ctx, 8, 310, VIEW.width - 16, 68);
  text(ctx, 'ON THE TABLE', 22, 318, { size: 9, bold: true, color: PAL.g });
  let y = 332;
  if (!stated.length) {
    text(ctx, 'They have not claimed anything yet.', 26, y, { size: 10, color: PAL.g });
    return;
  }
  // the two most recent claims, struck through once proved false
  for (const st of stated.slice(-2)) {
    const mark = st.broken ? 'x' : st.marked ? '!' : '·';
    const color = st.broken ? PAL.g : st.marked ? PAL.b : PAL.K;
    const lines = wrap(ctx, `${mark} ${st.text}`, VIEW.width - 60, 10).slice(0, 2);
    for (const line of lines) {
      if (y > 366) break;
      text(ctx, line, 26, y, { size: 10, color });
      y += 13;
    }
    y += 2;
  }
}

function drawPanel(ctx, it, s) {
  inkPanel(ctx, 8, PANEL_Y, VIEW.width - 16, PANEL_H);
  const x = 24, y = PANEL_Y + 16;

  if (it.phase === 'msg' || it.phase === 'over') {
    const line = it.phase === 'over' ? overLine(it) : it.messages[0] || '';
    wrap(ctx, line, VIEW.width - 70, 12).slice(0, 5).forEach((l, i) => text(ctx, l, x, y + i * 17, { size: 12 }));
    text(ctx, 'tap to continue', VIEW.width - 30, PANEL_Y + PANEL_H - 20, { size: 10, align: 'right', color: PAL.g });
    return;
  }

  const list = currentList();
  const idx = it.submenu ? it.subCursor : it.cursor;

  if (!it.submenu) {
    list.forEach((entry, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const ex = x + col * 160, ey = y + row * 24;
      if (i === idx) { ctx.fillStyle = PAL.K; ctx.fillRect(ex - 12, ey + 3, 8, 8); }
      text(ctx, entry.label, ex, ey, { size: 13 });
      it.hitRects.push({ index: i, x: ex - 16, y: ey - 4, w: 150, h: 22 });
    });
    const hint = ['Make them talk. Pick a tone.', 'Put proof against a claim they made.',
      'Watch them. Spot the lie without saying anything.', 'Walk away with what you have.'][it.cursor] || '';
    text(ctx, hint, x, PANEL_Y + PANEL_H - 20, { size: 10, color: PAL.g });
    return;
  }

  // windowed list for tones and evidence
  const rows = 4;
  const start = clamp(idx - 1, 0, Math.max(0, list.length - rows));
  list.slice(start, start + rows).forEach((entry, i) => {
    const n = start + i;
    const ey = y + i * 22;
    if (n === idx) { ctx.fillStyle = PAL.K; ctx.fillRect(x - 12, ey + 3, 8, 8); }
    const label = wrap(ctx, entry.label, 250, 12)[0];
    text(ctx, label, x, ey, { size: 12 });
    if (entry.hint) text(ctx, entry.hint, VIEW.width - 30, ey + 1, { size: 9, align: 'right', color: PAL.g });
    it.hitRects.push({ index: n, x: x - 16, y: ey - 4, w: VIEW.width - 50, h: 20 });
  });
  if (list.length > rows) {
    text(ctx, `${idx + 1}/${list.length}`, VIEW.width - 30, PANEL_Y + PANEL_H - 20, { size: 9, align: 'right', color: PAL.g });
  }
}

function overLine(it) {
  return {
    break: 'Tata writes it all down before the shaking in her hands catches up.',
    clam: 'Nothing more tonight. She notes the shape of the silence.',
    walk: 'Out of time. She keeps what she got.',
    left: 'She keeps the rest of the questions in her pocket.',
  }[it.result] || '';
}
