import { G, carried, takeItem, equipTool, equipWeapon, ownedWeapons, stat, heldWeapon } from './state.js';
import { sfx, soundOn, setSoundOn } from '../engine/audio.js';
import { gfxEnabled, setGfxEnabled } from '../gfx/index.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { PAL } from '../art/palette.js';
import { VIEW, inkPanel, text, wrap } from '../engine/ui.js';
import { Input } from '../engine/input.js';

/*
 * The Detective Notebook (gameplan §7) — and the bag, because in Tata's world
 * they are the same object. Five tabs, one scrolling column, tap to act.
 */
export const Notebook = {
  open: false,
  tab: 0,
  scroll: 0,
  maxScroll: 0,
  rects: [],
  toast: '',
  toastT: 0,
};

const TABS = ['CASE', 'JOBS', 'WHO', 'RIFTS', 'KIT', 'LORE'];

const TOP = 56, BOTTOM = 556;
const PAGE_X = 16, PAGE_W = VIEW.width - 32;
const LINE = 17;

export function openNotebook(tab = null) {
  Notebook.open = true;
  sfx('notebook');
  if (tab !== null) Notebook.tab = TABS.indexOf(tab) >= 0 ? TABS.indexOf(tab) : Notebook.tab;
  Notebook.scroll = 0;
}

export function closeNotebook() {
  Notebook.open = false;
  sfx('notebook');
}

function toast(msg) {
  Notebook.toast = msg;
  Notebook.toastT = 2.2;
}

// ------------------------------------------------------------------ update

export function updateNotebook(dt) {
  const nb = Notebook;
  nb.toastT = Math.max(0, nb.toastT - dt);

  if (Input.dir === 'down') nb.scroll = Math.min(nb.maxScroll, nb.scroll + 220 * dt);
  if (Input.dir === 'up') nb.scroll = Math.max(0, nb.scroll - 220 * dt);
  if (Input.dir === 'right') { nb.tab = (nb.tab + 1) % TABS.length; nb.scroll = 0; Input.dir = null; }
  if (Input.dir === 'left') { nb.tab = (nb.tab - 1 + TABS.length) % TABS.length; nb.scroll = 0; Input.dir = null; }
  if (Input.menuPressed || Input.actionPressed) { closeNotebook(); return; }

  for (const tap of Input.taps) {
    const hit = nb.rects.find((r) => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h);
    if (!hit) {
      if (tap.y > BOTTOM) closeNotebook();
      continue;
    }
    if (hit.kind === 'tab') { nb.tab = hit.index; nb.scroll = 0; }
    else if (hit.kind === 'item') useEntry(hit.id);
    else if (hit.kind === 'weapon') {
      equipWeapon(hit.id);
      toast(`In her hands: ${heldWeapon().name}.`);
    }
    else if (hit.kind === 'sound') { setSoundOn(!soundOn()); sfx('tap'); }
    else if (hit.kind === 'gfx') { setGfxEnabled(!gfxEnabled()); toast(gfxEnabled() ? '3D fields back on.' : 'Down to pen and paper.'); }
    else if (hit.kind === 'close') closeNotebook();
  }
}

/** Tapping a bag entry: consumables are used, tools are held, key items are read. */
function useEntry(id) {
  const item = ITEMS[id];
  if (!item) return;
  if (item.kind === 'key') { toast(item.desc); return; }
  if (item.kind === 'tool') {
    const now = equipTool(id);
    toast(now === id ? `In hand: ${item.name}.` : `${item.name} back in the satchel.`);
    return;
  }
  // consumable, used in the field
  const t = G.tata;
  if (item.heal && t.hp >= t.maxHp && !item.foc) { toast('Nothing to patch up yet.'); return; }
  if (item.foc && !item.heal && t.foc >= t.maxFoc) { toast('Focus is already steady.'); return; }
  if (!takeItem(id)) { toast('None left.'); return; }
  if (item.heal) t.hp = Math.min(t.maxHp, t.hp + item.heal);
  if (item.foc) t.foc = Math.min(t.maxFoc, t.foc + item.foc);
  if (item.battleBuff) toast('Saved for the next fight. It only works when something is trying to hurt her.');
  else toast(item.text);
}

// -------------------------------------------------------------------- draw

export function drawNotebook(ctx) {
  const nb = Notebook;
  nb.rects = [];

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = PAL.K;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.globalAlpha = 1;

  inkPanel(ctx, 8, 8, VIEW.width - 16, BOTTOM + 8);

  // tabs
  const tabW = (VIEW.width - 40) / TABS.length;
  TABS.forEach((label, i) => {
    const x = 20 + i * tabW;
    const on = i === nb.tab;
    ctx.fillStyle = on ? PAL.K : PAL.w;
    ctx.fillRect(x, 20, tabW - 4, 26);
    text(ctx, label, x + (tabW - 4) / 2, 27, { size: 10, align: 'center', bold: true, color: on ? PAL.W : PAL.k });
    nb.rects.push({ kind: 'tab', index: i, x, y: 18, w: tabW - 4, h: 30 });
  });

  // clipped scrolling column
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAGE_X, TOP, PAGE_W, BOTTOM - TOP);
  ctx.clip();
  const cursor = { y: TOP + 8 - nb.scroll };
  const painter = [drawCase, drawJobs, drawPeople, drawRifts, drawKit, drawLore][nb.tab];
  painter(ctx, cursor);
  ctx.restore();

  const contentH = cursor.y + nb.scroll - TOP;
  nb.maxScroll = Math.max(0, contentH - (BOTTOM - TOP) + 20);
  if (nb.maxScroll > 0) {
    const trackH = BOTTOM - TOP - 20;
    const thumbH = Math.max(24, trackH * ((BOTTOM - TOP) / contentH));
    const ty = TOP + 10 + (trackH - thumbH) * (nb.scroll / nb.maxScroll);
    ctx.fillStyle = PAL.w; ctx.fillRect(VIEW.width - 26, TOP + 10, 4, trackH);
    ctx.fillStyle = PAL.K; ctx.fillRect(VIEW.width - 27, ty, 6, thumbH);
  }

  text(ctx, 'pad up/down scrolls · left/right changes tab · NOTE closes', VIEW.width / 2, BOTTOM + 22,
    { size: 9, align: 'center', color: PAL.g });
  nb.rects.push({ kind: 'close', x: 0, y: BOTTOM + 16, w: VIEW.width, h: 40 });

  if (nb.toastT > 0) {
    const lines = wrap(ctx, nb.toast, PAGE_W - 40, 12);
    const h = 22 + lines.length * 16;
    inkPanel(ctx, 24, BOTTOM - h - 8, VIEW.width - 48, h);
    lines.forEach((l, i) => text(ctx, l, 40, BOTTOM - h + 2 + i * 16, { size: 12 }));
  }
}

// --- tab painters --------------------------------------------------------

function heading(ctx, cur, label, sub) {
  text(ctx, label, PAGE_X + 8, cur.y, { size: 13, bold: true });
  if (sub) text(ctx, sub, VIEW.width - 34, cur.y + 2, { size: 10, align: 'right', color: PAL.g });
  cur.y += 20;
  ctx.fillStyle = PAL.K;
  ctx.fillRect(PAGE_X + 8, cur.y, PAGE_W - 40, 1);
  cur.y += 10;
}

function para(ctx, cur, str, opts = {}) {
  const lines = wrap(ctx, str, PAGE_W - 48, opts.size || 12);
  for (const line of lines) {
    text(ctx, line, PAGE_X + (opts.indent || 8), cur.y, { size: opts.size || 12, color: opts.color || PAL.K });
    cur.y += LINE;
  }
}

function empty(ctx, cur, str) {
  para(ctx, cur, str, { color: PAL.g });
  cur.y += 6;
}

function drawCase(ctx, cur) {
  const t = G.tata;
  heading(ctx, cur, 'THE CASE', `Lv${t.level}`);
  para(ctx, cur, `HP ${t.hp}/${t.maxHp}   FOC ${t.foc}/${t.maxFoc}`, { size: 12 });
  para(ctx, cur, `INT ${stat('INT')}  DEX ${stat('DEX')}  PER ${stat('PER')}  RES ${stat('RES')}`,
    { size: 11, color: PAL.g });
  para(ctx, cur, `Holding ${heldWeapon().name}${G.tool ? ` · ${ITEMS[G.tool].name} in hand` : ''}`,
    { size: 11, color: PAL.b });
  para(ctx, cur, `${G.coin} coin`, { size: 11, color: PAL.g });
  cur.y += 8;

  heading(ctx, cur, 'CLUES', `${G.clues.length}`);
  if (!G.clues.length) empty(ctx, cur, 'Nothing written down yet. Ask someone something.');
  else for (const clue of G.clues) {
    para(ctx, cur, `— ${clue.text}`);
    cur.y += 6;
  }
  cur.y += 8;

  heading(ctx, cur, 'THE MARGINS', 'settings');
  const nb = Notebook;
  para(ctx, cur, `[ sound: ${soundOn() ? 'on' : 'off'} ]`, { size: 12, color: PAL.b });
  nb.rects.push({ kind: 'sound', x: PAGE_X, y: cur.y - LINE, w: 140, h: LINE });
  para(ctx, cur, `[ renderer: ${gfxEnabled() ? '2.5D' : 'pixel'} ]`, { size: 12, color: PAL.b });
  nb.rects.push({ kind: 'gfx', x: PAGE_X, y: cur.y - LINE, w: 160, h: LINE });
}

function drawJobs(ctx, cur) {
  const taken = Object.keys(G.quests).map((id) => QUESTS[id]).filter(Boolean);
  const active = taken.filter((q) => G.quests[q.id].state === 'active');
  heading(ctx, cur, 'JOBS', `${active.length} open`);
  if (!taken.length) return empty(ctx, cur, 'Nobody has asked her for anything yet. They will.');

  for (const q of taken) {
    const st = G.quests[q.id];
    const done = st.state === 'done';
    text(ctx, q.title, PAGE_X + 8, cur.y, { size: 12, bold: true, color: done ? PAL.g : PAL.K });
    text(ctx, done ? 'closed' : 'open', VIEW.width - 34, cur.y + 2, { size: 9, align: 'right', color: done ? PAL.g : PAL.b });
    cur.y += LINE;
    para(ctx, cur, q.blurb, { size: 10, color: PAL.g });
    if (done) para(ctx, cur, q.done, { size: 11 });
    else para(ctx, cur, `→ ${q.steps[Math.min(st.step, q.steps.length - 1)]}`, { size: 11 });
    para(ctx, cur, `from ${q.giver}`, { size: 9, color: PAL.g });
    cur.y += 10;
  }
}

function drawPeople(ctx, cur) {
  const people = Object.values(G.profiles);
  heading(ctx, cur, 'PEOPLE', `${people.length}`);
  if (!people.length) return empty(ctx, cur, 'No one worth a page yet.');
  for (const p of people) {
    text(ctx, p.name || p.id, PAGE_X + 8, cur.y, { size: 12, bold: true });
    cur.y += LINE;
    if (p.role) para(ctx, cur, p.role, { size: 11, color: PAL.g });
    for (const note of p.notes) para(ctx, cur, `· ${note}`, { size: 11 });
    if (p.pressure) para(ctx, cur, `Pressure point: ${p.pressure}`, { size: 11, color: PAL.b });
    if (p.broken) para(ctx, cur, 'Broke under questioning.', { size: 11, color: PAL.R });
    cur.y += 10;
  }
}

function drawRifts(ctx, cur) {
  heading(ctx, cur, 'RIFT ANOMALIES', `${G.anomalies.length}`);
  if (!G.anomalies.length) return empty(ctx, cur, 'The blue has not held still long enough to describe.');
  for (const a of G.anomalies) { para(ctx, cur, `— ${a}`); cur.y += 6; }
}

function drawKit(ctx, cur) {
  heading(ctx, cur, 'SATCHEL', `${G.coin} coin`);

  const section = (label, kind, hint) => {
    text(ctx, label, PAGE_X + 8, cur.y, { size: 11, bold: true, color: PAL.g });
    cur.y += LINE;
    const list = carried(kind);
    if (!list.length) { empty(ctx, cur, hint); return; }
    for (const item of list) {
      const rowY = cur.y - 3;
      const held = G.tool === item.id;
      if (held) { ctx.fillStyle = PAL.K; ctx.fillRect(PAGE_X + 2, rowY + 4, 4, 12); }
      const count = (kind === 'consumable' || kind === 'loot') ? ` ×${G.items[item.id]}` : '';
      text(ctx, `${item.name}${count}`, PAGE_X + 12, cur.y, { size: 12, bold: held });
      cur.y += LINE;
      para(ctx, cur, item.desc, { size: 10, color: PAL.g, indent: 20 });
      Notebook.rects.push({ kind: 'item', id: item.id, x: PAGE_X, y: rowY, w: PAGE_W - 30, h: cur.y - rowY });
      cur.y += 8;
    }
  };

  text(ctx, 'HANDS', PAGE_X + 8, cur.y, { size: 11, bold: true, color: PAL.g });
  cur.y += LINE;
  for (const w of ownedWeapons()) {
    const rowY = cur.y - 3;
    const held = G.weapon === w.id;
    if (held) { ctx.fillStyle = PAL.K; ctx.fillRect(PAGE_X + 2, rowY + 4, 4, 12); }
    const stats = `${w.atk >= 0 ? '+' : ''}${w.atk} dmg · ${w.hit >= 0 ? '+' : ''}${w.hit} aim · ${w.tag}`;
    text(ctx, w.name, PAGE_X + 12, cur.y, { size: 12, bold: held });
    text(ctx, stats, VIEW.width - 34, cur.y + 1, { size: 9, align: 'right', color: PAL.g });
    cur.y += LINE;
    para(ctx, cur, w.note, { size: 10, color: PAL.g, indent: 20 });
    Notebook.rects.push({ kind: 'weapon', id: w.id, x: PAGE_X, y: rowY, w: PAGE_W - 30, h: cur.y - rowY });
    cur.y += 8;
  }
  cur.y += 4;

  section('USE', 'consumable', 'The satchel is out of anything helpful.');
  cur.y += 4;
  section('CARRY', 'tool', 'No tools yet. Tap one to hold it.');
  cur.y += 4;
  section('EVIDENCE', 'key', 'Nothing solid enough to put in front of someone.');
  cur.y += 4;
  section('SPOILS', 'loot', 'Nothing worth selling.');
}

function drawLore(ctx, cur) {
  heading(ctx, cur, 'FRAGMENTS', `${G.lore.length}`);
  if (!G.lore.length) return empty(ctx, cur, 'The world has not explained itself yet.');
  for (const l of G.lore) { para(ctx, cur, l); cur.y += 10; }
}
