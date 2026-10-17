// Dice rules. Classic: one six-sided die each, 1-5 is goals, a 6 is nil.
// Expanded: two ten-sided dice and a results card. The home die picks the row,
// the away die picks the square. Level cup ties go to one roll on the penalty card.
import { env } from './env.js';
import { shuffle, rand } from './util.js';

export const CLASSIC = { dice: 'classic', form: false };

/* ---------- the standard results card ----------
   Each row lists what's in it; the code sorts every row from best-for-home (left,
   low away die) to best-for-away (right, high away die). Higher dice are better.
   Tallies: 44 home wins, 27 draws, 29 away wins. Every square is 1%. */
const ROWS = [
  '1-0 0-0 0-0 1-1 0-1 1-2 0-2 1-3 0-3 0-4',
  '1-0 2-1 0-0 1-1 2-2 0-1 1-2 0-2 1-3 0-3',
  '2-0 1-0 2-1 0-0 1-1 1-1 0-1 1-2 0-2 2-3',
  '3-1 2-0 2-1 1-0 0-0 1-1 2-2 0-1 1-2 1-3',
  '2-0 2-1 1-0 1-0 0-0 1-1 1-1 0-1 0-2 2-3',
  '3-0 2-0 3-2 2-1 1-0 0-0 1-1 3-3 0-1 1-2',
  '3-1 2-0 2-1 2-1 1-0 1-1 1-1 2-2 0-1 0-2',
  '4-1 3-0 3-1 2-0 2-1 1-0 0-0 1-1 1-2 0-1',
  '4-0 3-1 3-0 2-0 4-2 2-1 1-0 1-1 2-2 1-2',
  '5-1 4-0 4-1 3-0 3-2 2-1 2-1 1-1 3-3 4-5',
];
const parse = s => s.split(' ').map(x => x.split('-').map(Number));
// Within a row: home wins (biggest first), then draws (lowest first), then away wins (narrowest first).
function sortRow(row) {
  const res = ([h, a]) => (h > a ? 0 : h === a ? 1 : 2);
  return row.slice().sort((x, y) => res(x) - res(y) || (y[0] - y[1]) - (x[0] - x[1]) ||
    (res(x) === 0 ? y[0] - x[0] : (x[0] + x[1]) - (y[0] + y[1])));
}
export const STANDARD_CARD = ROWS.map(r => sortRow(parse(r)));
// Penalty card, from 1 (best for away) to 10 (best for home): [winner, their pens, the loser's pens]
export const STANDARD_PENS = [['a', 4, 2], ['a', 5, 3], ['a', 4, 3], ['a', 5, 4], ['a', 7, 6], ['h', 8, 7], ['h', 5, 4], ['h', 4, 3], ['h', 5, 3], ['h', 4, 2]];

export function tally(card) {
  let hw = 0, d = 0, aw = 0, g = 0;
  card.forEach(row => row.forEach(([h, a]) => { if (h > a) hw++; else if (h === a) d++; else aw++; g += h + a; }));
  const n = card.length * card[0].length;
  return { hw, d, aw, n, goals: g / n };
}
export function parseScore(s) {
  const m = String(s ?? '').match(/^\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\s*$/);
  return m ? [+m[1], +m[2]] : null;
}
export const cardToText = card => card.map(row => row.map(([h, a]) => `${h}-${a}`));
export const pensToText = pens => pens.map(([w, a, b]) => [w, `${a}-${b}`]);
// Your own card: 100 strings and 10 [winner, 'a-b']. Returns { card, pens, bad: [k...] }.
export function readCustom(cells, pens) {
  const bad = [], card = [];
  for (let r = 0; r < 10; r++) {
    const row = [];
    for (let c = 0; c < 10; c++) { const p = parseScore(cells && cells[r * 10 + c]); if (!p) bad.push(r * 10 + c); row.push(p || [0, 0]); }
    card.push(row);
  }
  const pk = [], badPens = [];
  for (let k = 0; k < 10; k++) {
    const e = pens && pens[k], p = e ? parseScore(e[1]) : null;
    if (!e || !p || (e[0] !== 'h' && e[0] !== 'a') || p[0] <= p[1]) { badPens.push(k); pk.push(STANDARD_PENS[k]); }
    else pk.push([e[0], p[0], p[1]]);
  }
  return { card, pens: pk, bad, badPens };
}

/* ---------- making the rules for a cup or season ---------- */
// settings: { dice, card: 'high'|'random'|'custom', form, customCard, customPens }
export function makeRules(st) {
  if (st.dice !== 'expanded') return { dice: 'classic', form: !!st.form };
  let card = STANDARD_CARD.map(r => r.map(x => x.slice())), pens = STANDARD_PENS.map(x => x.slice());
  if (st.card === 'random') {
    const cells = shuffle(card.flat());
    card = Array.from({ length: 10 }, (_, r) => cells.slice(r * 10, r * 10 + 10));
    pens = shuffle(pens);
  } else if (st.card === 'custom') {
    const c = readCustom(st.customCard, st.customPens);
    if (c.bad.length || c.badPens.length) throw new Error('Your own results card has squares that need fixing. Have a look in the drawer.');
    card = c.card; pens = c.pens;
  }
  return { dice: 'expanded', mode: st.card || 'high', form: !!st.form, card, pens };
}
export const R = () => env.rules || CLASSIC;
export const expanded = () => R().dice === 'expanded';
export const sides = () => (expanded() ? 10 : 6);
export const roll = () => 1 + Math.floor(rand() * sides());
export const d6 = () => 1 + Math.floor(rand() * 6);
export const MODE_NAME = { high: 'Higher dice is better', random: 'Fully random', custom: 'Your own card' };
export const rulesName = rules => !rules || rules.dice !== 'expanded' ? `Classic dice${rules && rules.form ? ', with form' : ''}` : `Expanded dice rules: ${MODE_NAME[rules.mode] || ''}${rules.form ? ', with form' : ''}`;

/* ---------- form ---------- */
// +1 in form (last three all wins), -1 out of form (last three all defeats), 0 otherwise.
export function formFromLast(last) {
  if (!last || last.length < 3) return 0;
  const l3 = last.slice(-3).map(s => s[0]);
  return l3.every(x => x === 'W') ? 1 : l3.every(x => x === 'L') ? -1 : 0;
}
export const FORM_DIE = [0, 0, 0, 0, 1, 2];        // one team in or out of form
export const FORM_DIE_BIG = [0, 0, 1, 1, 1, 2];    // in form against out of form
// Works out form once, when the match is first touched.
export function prepare(m) {
  if (m.fm !== undefined) return m;
  const rules = R();
  m.fm = rules.form && env.formOf ? [env.formOf(m.h), env.formOf(m.a)] : [0, 0];
  m.fp = null;
  if (rules.dice === 'expanded') {
    const net = m.fm[0] - m.fm[1];
    if (net) m.fp = { s: net > 0 ? 'h' : 'a', big: Math.abs(net) === 2 };
  }
  return m;
}
// Classic: +1 rolls two dice and keeps the better, -1 keeps the worse.
export const classicEdge = (m, side) => (R().dice === 'classic' && m.fm ? m.fm[side === 'h' ? 0 : 1] : 0);
export const formDieFaces = m => (m.fp && m.fp.big ? FORM_DIE_BIG : FORM_DIE);
export const formDiePending = m => !!(expanded() && m.fp && !m.ff);

/* ---------- throwing (the engine picks the faces, the screen animates them) ---------- */
const classicGoals = f => (f === 6 ? 0 : f);
export function throwForm(m) {
  prepare(m);
  const f = d6(); m.ff = f; m.fb = formDieFaces(m)[f - 1];
  return f;
}
// Returns { face, pair }: pair is the two dice when form made a team throw two.
export function throwSide(m, side) {
  prepare(m);
  const key = 'f' + side;
  if (expanded()) { m[key] = roll(); m.d10 = true; return { face: m[key], pair: null }; }
  const edge = classicEdge(m, side);
  if (!edge) { m[key] = d6(); return { face: m[key], pair: null }; }
  const a = d6(), b = d6(), ga = classicGoals(a), gb = classicGoals(b);
  const keepA = edge > 0 ? ga >= gb : ga <= gb;
  m[key] = keepA ? a : b; m[key + 'x'] = [a, b, keepA ? 0 : 1];
  return { face: m[key], pair: [a, b], kept: keepA ? 0 : 1 };
}
export function throwPens(m) {
  const f = roll(), e = R().pens[f - 1];
  m.pk = { f, w: e[0], s: `${e[1]}–${e[2]}` };
  return f;
}
export function throwExtraPair(m) {
  const a = d6(), b = d6();
  m.x.push([classicGoals(a), classicGoals(b)]); m.xf.push([a, b]);
  return [a, b];
}
// Scores from the faces thrown so far (needs both main dice).
export function scoreOf(m, fa = m.fa) {
  if (!m.fh || !fa) return null;
  let h, a;
  if (expanded()) [h, a] = R().card[m.fh - 1][fa - 1];
  else { h = classicGoals(m.fh); a = classicGoals(fa); }
  if (m.fb) { if (m.fp.s === 'h') h += m.fb; else a += m.fb; }
  return [h, a];
}
// What the home die alone shows: classic shows its goals; expanded shows nothing until the square.
export const homeShows = m => (expanded() ? '' : m.fh ? classicGoals(m.fh) : '');
