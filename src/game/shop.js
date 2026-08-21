import { G, carried, addItem, takeItem, addCoin, spendCoin, ownWeapon, equipWeapon, ownedWeapons, save } from './state.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { PAL } from '../art/palette.js';
import { VIEW, inkPanel, text, wrap, drawControls } from '../engine/ui.js';
import { Input } from '../engine/input.js';
import { sfx } from '../engine/audio.js';

/*
 * The quay stall. Buy consumables and weapons, sell what the well coughed up.
 * Prices are flat: sell for half, no haggling — Tata is twelve and in a hurry.
 */
export const Shop = {
  open: false, tab: 0, cursor: 0, rects: [], toast: '', toastT: 0, name: '',
};

const TABS = ['BUY', 'SELL'];
const STOCK = ['bandage', 'tonic', 'salts', 'ward'];
const STOCK_WEAPONS = ['baton', 'revolver', 'driver'];
const PRICE = { bandage: 12, tonic: 16, salts: 22, ward: 34 };

const TOP = 118, ROW = 30;

export function openShop(name = 'quay') {
  Shop.open = true;
  Shop.name = name;
  Shop.tab = 0;
  Shop.cursor = 0;
  G.scene = 'shop';
}

function closeShop() {
  Shop.open = false;
  G.scene = 'world';
  save();
}

const toast = (msg) => { Shop.toast = msg; Shop.toastT = 2.4; };

/** What each tab lists: buyable stock, or the sellable contents of the satchel. */
function listing() {
  if (Shop.tab === 0) {
    const goods = STOCK.map((id) => ({ kind: 'item', id, name: ITEMS[id].name, price: PRICE[id], note: ITEMS[id].desc }));
    const arms = STOCK_WEAPONS
      .filter((id) => !G.weapons[id])
      .map((id) => ({ kind: 'weapon', id, name: WEAPONS[id].name, price: WEAPONS[id].price, note: WEAPONS[id].note }));
    return goods.concat(arms);
  }
  return carried('consumable').concat(carried('loot')).map((item) => ({
    kind: 'sell', id: item.id, name: item.name,
    price: Math.max(2, Math.round((PRICE[item.id] || (item.kind === 'loot' ? 30 : 10)) / 2)),
    note: `${G.items[item.id]} in the satchel`,
  }));
}

function choose(entry) {
  if (!entry) return;
  if (entry.kind === 'sell') {
    if (!takeItem(entry.id)) { sfx('denied'); return toast('None left to sell.'); }
    addCoin(entry.price);
    sfx('coin');
    return toast(`Sold ${entry.name} for ${entry.price}.`);
  }
  if (!spendCoin(entry.price)) { sfx('denied'); return toast('Not enough coin. He has heard every version of "later".'); }
  sfx('buy');
  if (entry.kind === 'weapon') {
    ownWeapon(entry.id);
    equipWeapon(entry.id);
    return toast(`${entry.name} — and she is holding it before he finishes wrapping it.`);
  }
  addItem(entry.id);
  toast(`Bought ${entry.name}.`);
}

// ------------------------------------------------------------------ update

export function updateShop(dt) {
  Shop.toastT = Math.max(0, Shop.toastT - dt);
  const list = listing();

  if (Input.menuPressed) return closeShop();
  if (Input.dir === 'left') { Shop.tab = 0; Shop.cursor = 0; Input.dir = null; }
  if (Input.dir === 'right') { Shop.tab = 1; Shop.cursor = 0; Input.dir = null; }
  if (Input.dir === 'down' && list.length) Shop.cursor = Math.min(list.length - 1, Shop.cursor + 1);
  if (Input.dir === 'up') Shop.cursor = Math.max(0, Shop.cursor - 1);
  if (Input.actionPressed) choose(list[Shop.cursor]);

  for (const tap of Input.taps) {
    const hit = Shop.rects.find((r) => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h);
    if (!hit) continue;
    if (hit.kind === 'tab') { Shop.tab = hit.index; Shop.cursor = 0; }
    else if (hit.kind === 'close') closeShop();
    else { Shop.cursor = hit.index; choose(list[hit.index]); }
  }
}

// -------------------------------------------------------------------- draw

export function drawShop(ctx) {
  const list = listing();
  Shop.rects = [];

  ctx.fillStyle = PAL.W;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PAL.k;
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 67) % VIEW.width, 30 + (i % 10) * 11, 7 + (i % 4) * 4, 1);

  inkPanel(ctx, 8, 8, VIEW.width - 16, 96);
  text(ctx, 'THE QUAY STALL', 24, 20, { size: 14, bold: true });
  text(ctx, 'Rope, salt, nails — and a shelf under the counter.', 24, 42, { size: 10, color: PAL.g });
  text(ctx, `${G.coin} coin`, VIEW.width - 26, 20, { size: 13, align: 'right', bold: true });
  text(ctx, `holding: ${WEAPONS[G.weapon].name}`, VIEW.width - 26, 42, { size: 10, align: 'right', color: PAL.g });

  const tabW = 150;
  TABS.forEach((label, i) => {
    const x = 24 + i * (tabW + 12);
    const on = i === Shop.tab;
    ctx.fillStyle = on ? PAL.K : PAL.w;
    ctx.fillRect(x, 68, tabW, 26);
    text(ctx, label, x + tabW / 2, 75, { size: 11, align: 'center', bold: true, color: on ? PAL.W : PAL.k });
    Shop.rects.push({ kind: 'tab', index: i, x, y: 66, w: tabW, h: 30 });
  });

  inkPanel(ctx, 8, TOP, VIEW.width - 16, 372);
  if (!list.length) {
    text(ctx, Shop.tab ? 'Nothing in the satchel he wants.' : 'Shelves bare.', 30, TOP + 22, { size: 12, color: PAL.g });
  }
  list.slice(0, 11).forEach((entry, i) => {
    const y = TOP + 18 + i * ROW;
    const on = i === Shop.cursor;
    if (on) { ctx.fillStyle = PAL.K; ctx.fillRect(20, y + 4, 8, 8); }
    text(ctx, entry.name, 36, y, { size: 12, bold: on });
    text(ctx, `${entry.price}`, VIEW.width - 30, y, { size: 12, align: 'right' });
    text(ctx, wrap(ctx, entry.note, VIEW.width - 90, 9)[0], 36, y + 14, { size: 9, color: PAL.g });
    Shop.rects.push({ kind: 'row', index: i, x: 16, y: y - 6, w: VIEW.width - 40, h: ROW - 4 });
  });

  if (Shop.toastT > 0) {
    const lines = wrap(ctx, Shop.toast, VIEW.width - 90, 12);
    const h = 20 + lines.length * 16;
    inkPanel(ctx, 24, 490 - h, VIEW.width - 48, h);
    lines.forEach((l, i) => text(ctx, l, 40, 498 - h + i * 16, { size: 12 }));
  }

  text(ctx, 'tap a line to trade · pad left/right swaps tab · NOTE leaves', VIEW.width / 2, 500,
    { size: 9, align: 'center', color: PAL.g });
  Shop.rects.push({ kind: 'close', x: 0, y: 494, w: VIEW.width, h: 30 });
  drawControls(ctx, { pad: true, actionLabel: 'TAKE', menu: true, menuLabel: 'LEAVE' });
}
