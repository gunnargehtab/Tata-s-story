import {
  G, addClue, addItem, hasClue, hasItem, noteProfile, noteLore, noteAnomaly, save,
  addCoin, spendCoin, ownWeapon, equipWeapon, startQuest, advanceQuest, finishQuest,
  questState, questStep,
} from './state.js';
import { QUESTS } from '../data/quests.js';
import { WEAPONS } from '../data/weapons.js';
import { showDialogue, showChoices } from './dialogue.js';
import { TALKS } from '../data/talks.js';

/*
 * Branching dialogue (gameplan §7). A talk is a map of nodes:
 *
 *   node = {
 *     who, text | lines,          who is speaking and what they say
 *     effects,                    applied when the node is entered
 *     choices: [{ label, hint, if, effects, to }],
 *     to,                         next node when there are no choices
 *   }
 *
 * Choices are filtered by `if`, so what Tata can say depends on what she knows —
 * a clue in the notebook or an object in the satchel opens new lines.
 */

export const Talk = { active: false, tree: null, node: null, onDone: null };

export function startTalk(treeId, start = 'start', onDone = null) {
  const tree = TALKS[treeId];
  if (!tree) return false;
  Talk.active = true;
  Talk.tree = tree;
  Talk.onDone = onDone;
  Talk.id = treeId;
  goto(start);
  return true;
}

export const talkActive = () => Talk.active;

function finish() {
  Talk.active = false;
  Talk.tree = null;
  const cb = Talk.onDone;
  Talk.onDone = null;
  save();
  if (cb) cb();
}

/** `if` clauses: every named condition must hold. */
export function conditionMet(cond) {
  if (!cond) return true;
  if (cond.flag && !G.flags[cond.flag]) return false;
  if (cond.notFlag && G.flags[cond.notFlag]) return false;
  if (cond.clue && !hasClue(cond.clue)) return false;
  if (cond.notClue && hasClue(cond.notClue)) return false;
  if (cond.item && !hasItem(cond.item)) return false;
  if (cond.profile && !G.profiles[cond.profile]) return false;
  if (cond.minINT && G.tata.INT < cond.minINT) return false;
  if (cond.quest && questState(cond.quest) !== (cond.questState || 'active')) return false;
  if (cond.noQuest && questState(cond.noQuest)) return false;
  if (cond.questStep !== undefined && questStep(cond.quest) !== cond.questStep) return false;
  if (cond.coin && G.coin < cond.coin) return false;
  if (cond.items) for (const [id, n] of Object.entries(cond.items)) if ((G.items[id] || 0) < n) return false;
  return true;
}

/** Effects are the only way a talk changes the world — keeps trees declarative. */
export function applyEffects(fx) {
  if (!fx) return [];
  const gained = [];
  if (fx.flag) for (const f of [].concat(fx.flag)) G.flags[f] = true;
  if (fx.clearFlag) for (const f of [].concat(fx.clearFlag)) delete G.flags[f];
  if (fx.clue) for (const c of [].concat(fx.clue)) if (addClue(c.id, c.text)) gained.push(`Notebook: ${c.text}`);
  if (fx.item) for (const i of [].concat(fx.item)) { addItem(i); gained.push(`Satchel: ${i}.`); }
  if (fx.lore) for (const l of [].concat(fx.lore)) noteLore(l);
  if (fx.anomaly) for (const a of [].concat(fx.anomaly)) noteAnomaly(a);
  if (fx.profile) noteProfile(fx.profile.id, fx.profile);
  if (fx.coin) { addCoin(fx.coin); gained.push(`${fx.coin > 0 ? '+' : ''}${fx.coin} coin.`); }
  if (fx.spend) spendCoin(fx.spend);
  if (fx.takeItem) for (const [id, n] of Object.entries(fx.takeItem)) {
    G.items[id] = Math.max(0, (G.items[id] || 0) - n);
    if (!G.items[id]) delete G.items[id];
  }
  if (fx.weapon) { ownWeapon(fx.weapon); equipWeapon(fx.weapon); gained.push(`In hand: ${WEAPONS[fx.weapon].name}.`); }
  if (fx.startQuest) for (const id of [].concat(fx.startQuest)) {
    if (startQuest(id)) gained.push(`Job taken: ${QUESTS[id].title}.`);
  }
  if (fx.advanceQuest) {
    const { id, step } = typeof fx.advanceQuest === 'string' ? { id: fx.advanceQuest, step: null } : fx.advanceQuest;
    advanceQuest(id, step);
  }
  if (fx.finishQuest) for (const id of [].concat(fx.finishQuest)) {
    finishQuest(id);
    gained.push(`Job closed: ${QUESTS[id].title}.`);
    for (const line of payReward(id)) gained.push(line);
  }
  return gained;
}

/** Pays a quest's reward once, when it closes. */
function payReward(id) {
  const q = QUESTS[id];
  const out = [];
  if (!q || !q.reward) return out;
  const r = q.reward;
  if (r.coin) { addCoin(r.coin); out.push(`+${r.coin} coin.`); }
  if (r.item) { addItem(r.item); out.push(`Satchel: ${r.item}.`); }
  if (r.weapon) { ownWeapon(r.weapon); out.push(`New weapon: ${WEAPONS[r.weapon].name}.`); }
  if (r.clue && addClue(r.clue.id, r.clue.text)) out.push(r.clue.text);
  if (r.lore) noteLore(r.lore);
  return out;
}

function goto(id) {
  if (!id) return finish();
  const node = Talk.tree[id];
  if (!node) return finish();
  Talk.node = node;

  const gained = applyEffects(node.effects);
  const who = node.who || '';
  // `lines` is narration that plays first; `text` is the speaker's line and
  // carries the fork when the node has choices
  const lines = (node.lines || []).concat(node.text ? [node.text] : []);
  const queue = lines.map((l) => (typeof l === 'string' ? { who, text: l } : l));
  const asNotes = (list) => list.map((t) => ({ who: 'Notebook', text: t.replace(/^Notebook: /, '') }));

  const choices = (node.choices || []).filter((c) => conditionMet(c.if));

  if (!choices.length) {
    // a plain node: say the lines, note anything gained, then walk on
    const all = queue.concat(asNotes(gained));
    if (!all.length) return goto(node.to);
    showDialogue(all, () => goto(node.to));
    return;
  }

  // the node's last spoken line carries the fork; notebook writes wait until
  // after the player has answered, so the question is never buried
  const fork = queue.pop() || { who, text: '' };
  const ask = () => showChoices(fork.who, fork.text, choices.map((c) => ({ label: c.label, hint: c.hint })), (i) => {
    const choice = choices[i];
    const notes = asNotes(gained.concat(applyEffects(choice.effects)));
    if (notes.length) showDialogue(notes, () => goto(choice.to));
    else goto(choice.to);
  });
  if (queue.length) showDialogue(queue, ask);
  else ask();
}
