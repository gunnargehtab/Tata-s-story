#!/usr/bin/env node
/*
 * Balance harness for the Phase 4 tuning pass.
 *
 *   node tools/balance-sim.mjs
 *
 * Imports the live data tables (enemies, skills, weapons) and mirrors the
 * combat formulas from src/game/battle.js and the growth curve from
 * src/game/state.js, then plays thousands of fights per matchup. If a formula
 * changes in the game, change it here too — the point of this file is to make
 * a claimed balance change checkable, not to be a second source of truth.
 */
import { ENEMIES } from '../src/data/enemies.js';
import { SKILLS, TONES } from '../src/data/skills.js';
import { WEAPONS } from '../src/data/weapons.js';

const rand = (n) => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// --- growth curve, mirroring newTata()/grantXp() in state.js -------------
const XP_TABLE = [0, 24, 60, 120, 210, 340, 520, 760];

function tataAt(level) {
  const t = { level: 1, hp: 34, maxHp: 34, foc: 12, maxFoc: 12, atk: 7, INT: 8, DEX: 7, PER: 6, RES: 4 };
  while (t.level < level) {
    t.level++;
    t.maxHp += 6; t.hp = t.maxHp;
    t.maxFoc += 3; t.foc = t.maxFoc;
    t.atk += 2; t.INT += 1; t.DEX += 1;
    if (t.level % 2 === 0) { t.PER += 1; t.RES += 1; }
  }
  return t;
}

// --- combat formulas, mirroring battle.js --------------------------------

function freshEnemy(id, boost = 1) {
  const base = ENEMIES[id];
  const hp = Math.round(base.hp * boost);
  return { ...base, atk: Math.round(base.atk * boost), maxHp: hp, curHp: hp, curMorale: base.morale, alive: true, stun: 0, mark: 0, revealed: false };
}

function damageEnemy(e, amount, tag) {
  let dmg = amount;
  if (tag && e.weakness === tag) { dmg = Math.round(dmg * 1.75); e.revealed = true; }
  if (e.mark > 0) dmg = Math.round(dmg * 1.35);
  dmg = Math.max(1, dmg - Math.round(e.def * 0.6));
  e.curHp = Math.max(0, e.curHp - dmg);
  if (e.curHp === 0) e.alive = false;
}

function playerAttack(t, e, w) {
  const hitChance = clamp(0.72 + (t.DEX - e.DEX) * 0.04 + (w.hit || 0) / 100, 0.35, 0.95);
  if (Math.random() > hitChance) return;
  const crit = Math.random() < clamp(t.DEX * 0.012, 0.02, 0.2);
  const dmg = t.atk + (w.atk || 0) + rand(4) + (crit ? Math.round(t.atk * 0.8) : 0);
  damageEnemy(e, dmg, w.tag);
  if (w.blind && e.alive && Math.random() < w.blind) e.stun += 1;
}

function useSkill(t, e, skill) {
  if (t.foc < skill.cost) return false;
  t.foc -= skill.cost;
  if (skill.reveal) { e.revealed = true; e.mark = skill.mark; return true; }
  for (let i = 0; i < skill.hits && e.alive; i++) damageEnemy(e, Math.round(t.atk * skill.power) + rand(3), skill.tag);
  if (skill.stun && e.alive) e.stun += skill.stun;
  return true;
}

function interrogate(t, e, tone) {
  const roll = Math.round(t.INT * tone.power) + rand(5) - (e.RES + tone.res);
  if (roll <= 0) { e.curMorale = Math.min(e.morale, e.curMorale + 1); return; }
  e.curMorale = Math.max(0, e.curMorale - roll);
  if (e.curMorale === 0) e.alive = false;
}

function enemyTurn(t, enemies) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.stun > 0) { e.stun--; continue; }
    if (e.mark > 0) e.mark--;
    const hitChance = clamp(0.7 + (e.DEX - t.DEX) * 0.04, 0.3, 0.95);
    if (Math.random() > hitChance) continue;
    const dmg = Math.max(1, e.atk + rand(4) - Math.round(t.RES * 0.5));
    t.hp = Math.max(0, t.hp - dmg);
    if (t.hp === 0) return;
  }
}

// --- policies ------------------------------------------------------------

/** Attack every turn with the given weapon. The floor of play. */
function policyAttack(t, e, w) { playerAttack(t, e, w); }

/** Drone once, then the matching skill while focus lasts, else attack. */
function policySkills(t, e, w) {
  if (!e.revealed && t.foc >= 5) { useSkill(t, e, SKILLS.find((s) => s.reveal)); return; }
  const match = SKILLS.find((s) => s.tag === e.weakness && !s.reveal);
  if (e.revealed && match && t.foc >= match.cost) { useSkill(t, e, match); return; }
  playerAttack(t, e, w);
}

/** Lean on a tone until morale breaks. */
function policyInterro(t, e, tone) { interrogate(t, e, tone); }

// --- runner --------------------------------------------------------------

function fight(level, ids, weaponId, policy, arg) {
  const t = tataAt(level);
  const enemies = ids.map((id) => freshEnemy(id));
  const w = WEAPONS[weaponId];
  let turns = 0;
  while (t.hp > 0 && enemies.some((e) => e.alive) && turns < 60) {
    turns++;
    const target = enemies.find((e) => e.alive);
    policy(t, target, arg === undefined ? w : arg);
    if (enemies.some((e) => e.alive)) enemyTurn(t, enemies);
  }
  return { win: enemies.every((e) => !e.alive), turns, hpLost: t.maxHp - t.hp };
}

function table(label, rows) {
  console.log(`\n== ${label}`);
  const keys = Object.keys(rows[0]);
  console.log(keys.map((k) => String(k).padEnd(14)).join(''));
  for (const r of rows) console.log(keys.map((k) => String(r[k]).padEnd(14)).join(''));
}

function pct(x) { return `${Math.round(x * 100)}%`; }

const N = 4000;

function run(level, ids, weaponId, policy, arg) {
  let wins = 0, turns = 0, hp = 0;
  for (let i = 0; i < N; i++) {
    const r = fight(level, ids, weaponId, policy, arg);
    wins += r.win; turns += r.turns; hp += r.hpLost;
  }
  return { win: pct(wins / N), turns: (turns / N).toFixed(1), hpLost: (hp / N).toFixed(1) };
}

// 1. every regular enemy at the level the player plausibly meets it, attack-only
table('Regulars, attack only (SMG)', [
  { fight: 'wisp @L1', ...run(1, ['wisp'], 'smg', policyAttack) },
  { fight: 'crate @L1', ...run(1, ['crate'], 'smg', policyAttack) },
  { fight: 'hound @L2', ...run(2, ['hound'], 'smg', policyAttack) },
  { fight: 'rat @L3', ...run(3, ['rat'], 'smg', policyAttack) },
  { fight: 'wisp+crate @L2', ...run(2, ['wisp', 'crate'], 'smg', policyAttack) },
  { fight: 'hound+rat @L4', ...run(4, ['hound', 'rat'], 'smg', policyAttack) },
]);

// 2. bosses, with and without craft
table('Bosses', [
  { fight: 'keeper @L2 attack', ...run(2, ['keeper'], 'smg', policyAttack) },
  { fight: 'keeper @L2 skills', ...run(2, ['keeper'], 'smg', policySkills) },
  { fight: 'keeper @L3 skills', ...run(3, ['keeper'], 'smg', policySkills) },
  { fight: 'stag @L4 attack', ...run(4, ['stag'], 'smg', policyAttack) },
  { fight: 'stag @L4 skills', ...run(4, ['stag'], 'smg', policySkills) },
  { fight: 'stag @L5 skills', ...run(5, ['stag'], 'smg', policySkills) },
]);

// 3. do the shop weapons buy anything
table('Weapons vs crate @L3, attack only', Object.keys(WEAPONS).map((id) => (
  { weapon: id, ...run(3, ['crate'], id, policyAttack) }
)));

// 4. interrogation tones vs the hound (morale 4) and the crate (morale 9) @L2
table('Tones (win = broke it before it broke her)', TONES.flatMap((tone) => [
  { tone: `${tone.id} vs hound`, ...run(2, ['hound'], 'smg', policyInterro, tone) },
  { tone: `${tone.id} vs crate`, ...run(2, ['crate'], 'smg', policyInterro, tone) },
]));

// 5. pacing: fights to reach each level on regular XP (~12 a fight)
const perFight = 12;
console.log('\n== XP pacing (regular fight ≈ 12 XP)');
for (let l = 1; l < XP_TABLE.length; l++) {
  console.log(`  to L${l + 1}: ${XP_TABLE[l]} XP ≈ ${Math.ceil(XP_TABLE[l] / perFight)} fights total`);
}

// 6. economy: expected coin per fight vs shop prices
const avgCoin = (id) => { const [a, b] = ENEMIES[id].coin; return (a + b) / 2; };
console.log('\n== Economy');
console.log(`  regular fight pays ~${((avgCoin('wisp') + avgCoin('crate') + avgCoin('hound') + avgCoin('rat')) / 4).toFixed(1)} coin`);
for (const w of Object.values(WEAPONS)) if (w.price) console.log(`  ${w.name}: ${w.price} coin`);
