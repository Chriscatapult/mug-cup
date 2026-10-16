// A single match: the dice, the scorers, and the line in the notebook about it.
import { env, team, nameOf, groundOf, seeded } from './env.js';
import { goals, pick, shuffle, rand, ordinal } from './util.js';

export function newMatch(h, a, kind = 'single', sit = 0) {
  return { h, a, kind, sit, fh: 0, fa: 0, hs: null, as: null, x: [], xf: [], gh: [], ga: [], done: false };
}
export function setScores(m) { m.hs = goals(m.fh); m.as = goals(m.fa); }

/* ---------- team sheets ---------- */
const SURNAMES = {
  England: ['Walker', 'Hughes', 'Barker', 'Pickering', 'Dawson', 'Holt', 'Fletcher', 'Bamber', 'Crowther', 'Ogden', 'Hartley', 'Chapman', 'Whitehead', 'Pearson', 'Tate', 'Butterworth', 'Marsden', 'Kershaw', 'Sutcliffe', 'Fairclough', 'Ainsworth', 'Nuttall', 'Horrocks', 'Tomlinson', 'Parkin', 'Cottam', 'Sidebottom', 'Greenwood', 'Rimmer', 'Stubbs'],
  Scotland: ['McLeod', 'Fraser', 'Munro', 'Ross', 'Paterson', 'McGregor', 'Kerr', 'Baird', 'Dunlop', 'Galbraith', 'Lennox', 'Moffat', 'Rennie', 'Crombie', 'McAllister', 'Buchanan', 'Cairns', 'Drummond', 'Tennant', 'McLaren', 'Sneddon', 'Imrie', 'McKinlay', 'Gourlay'],
  Wales: ['Jones', 'Evans', 'Davies', 'Williams', 'Price', 'Pritchard', 'Powell', 'Bowen', 'Griffiths', 'Lloyd', 'Morgan', 'Rees', 'Vaughan', 'Howells', 'Parry', 'Jenkins', 'Prosser', 'Llewellyn'],
  Ireland: ["O'Neill", 'Byrne', 'Kavanagh', 'Doyle', 'Quinn', 'McCarthy', 'Brennan', 'Nolan', 'Gallagher', 'Hegarty', 'Devlin', 'Kearney', 'Moran', 'Lynch', 'Donnelly', 'Mulligan', 'Brady', 'Flanagan'],
  World: ['Silva', 'Costa', 'Moreno', 'Novak', 'Jensen', 'Rossi', 'Petrov', 'Kovač', 'Mensah', 'Okafor', 'Tanaka', 'Fernández', 'Lindqvist', 'Horvat', 'Dumitru', 'Almeida', 'Schmidt', 'Vargas'],
};
const WEIGHT = { A: 10, M: 4, D: 1.2, G: 0.08 };
const POSITIONS = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'A', 'A'];

// The sheet a team's goals come from: [{ n: name, p: position, w: weight }], plus legends.
export function sheetFor(id) {
  const own = env.custom[id];
  if (own && own.length) return { list: own.map((n, i) => ({ n, p: 'A', w: Math.max(1, 12 - i) })), legends: [] };
  const sq = env.squads[id] || { s: [], l: [] };
  let list = sq.s.map(([n, p], i) => ({ n, p, w: (WEIGHT[p] ?? 3) * (i < 5 ? 1.6 : 1) }));
  if (list.length < 11) {
    const t = team(id), pool = SURNAMES[t.c] || SURNAMES.World, r = seeded(t.n), have = new Set(list.map(x => x.n));
    let k = 0, guard = 0;
    while (list.length < 11 && guard++ < 100) {
      const n = pool[Math.floor(r() * pool.length)];
      if (have.has(n)) continue;
      have.add(n); const p = POSITIONS[k++ % POSITIONS.length];
      list.push({ n, p, w: WEIGHT[p] });
    }
  }
  return { list, legends: sq.l || [] };
}
export function pickScorer(id) {
  const { list, legends } = sheetFor(id);
  const legendRate = env.squads[id]?.s?.length ? 0.1 : 0.6;
  if (legends.length && rand() < legendRate) return pick(legends);
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = rand() * total;
  for (const x of list) { r -= x.w; if (r <= 0) return x.n; }
  return list[list.length - 1].n;
}
function minutes(n) {
  const set = new Set(); let guard = 0;
  while (set.size < n && guard++ < 500) set.add(1 + Math.floor(rand() * 90));
  return [...set].sort((a, b) => a - b).map(m =>
    m === 90 && rand() < 0.6 ? '90+' + (1 + Math.floor(rand() * 5)) :
    m === 45 && rand() < 0.5 ? '45+' + (1 + Math.floor(rand() * 3)) : String(m));
}
export function assignScorers(m) {
  const total = m.hs + m.as, mins = minutes(total);
  const home = new Set(shuffle([...Array(total).keys()]).slice(0, m.hs));
  m.gh = []; m.ga = [];
  mins.forEach((mn, k) => {
    const isHome = home.has(k), side = isHome ? m.h : m.a, opp = isHome ? m.a : m.h;
    const p = rand() < 0.04 ? pickScorer(opp) + ' (og)' : pickScorer(side);
    (isHome ? m.gh : m.ga).push({ p, m: mn });
  });
}
export const isOG = g => /\(og\)$/.test(g.p);

/* ---------- the line in the notebook ---------- */
// ctx: { winner: id|null, knockout: bool, where: 'the Final', venue, prior: head-to-head, career: (player, club) => goals so far }
export function makeReport(m, ctx) {
  const H = team(m.h), A = team(m.a), hs = m.hs, as = m.as;
  const W = ctx.winner ? team(ctx.winner) : null, L = W ? (W.id === H.id ? A : H) : null;
  const ground = ctx.venue || groundOf(m.h);
  const tally = {};
  [...m.gh, ...m.ga].forEach(g => { if (!isOG(g)) tally[g.p] = (tally[g.p] || 0) + 1; });
  const hat = Object.entries(tally).sort((a, b) => b[1] - a[1]).find(([, v]) => v >= 3);
  const og = [...m.gh, ...m.ga].find(isOG);
  const lines = [];
  if (W && m.shock) lines.push(pick([
    `Shock of the round. ${W.n} will be dining out on this for years.`,
    `Nobody gave ${W.n} a prayer. Nobody.`,
    `${L.n} are stunned. ${W.n}'s fans are on the pitch.`,
    `Somewhere a ${W.n} fan is phoning everyone they've ever met.`,
    `They'll be painting a mural of this in ${W.n}'s town.`]));
  const pr = ctx.prior;
  if (W && pr && pr.n >= 2) {
    const wWins = W.id === H.id ? pr.aw : pr.bw, lWins = W.id === H.id ? pr.bw : pr.aw;
    if (wWins === 0 && lWins >= 2) lines.push(`At the ${ordinal(pr.n + 1)} time of asking, ${W.n} finally get one over on ${L.n}.`);
  }
  if (hat) lines.push(hat[1] >= 4 ? `${hat[0]} scores ${hat[1]} and nobody at ${ground} can quite believe it.` : pick([
    `A hat-trick for ${hat[0]}, who takes the match ball home under his arm.`,
    `${hat[0]} helps himself to three. He'll be telling the grandkids about this one.`]));
  if (lines.length < 2) {
    const extra = m.x && m.x.length;
    if (hs === 0 && as === 0 && !extra) lines.push(pick(['A proper nil-nil. Rain, mud and not much else.', 'Goalless. The dog would have enjoyed it more.', 'Both keepers could have brought a deckchair.']));
    else if (extra && W) lines.push(pick([`Nothing to split them, so it went to the extra dice. ${W.n} held their nerve.`, `Level at the end, and ${W.n} come through on the extra dice. Hearts in mouths all round.`]));
    else if (W && Math.abs(hs - as) >= 4) lines.push(pick([`${W.n} ran riot. ${L.n} will want to burn the video.`, `A hammering. ${L.n}'s keeper won't sleep tonight.`]));
    else if (hs + as >= 8) lines.push(pick([`${hs + as} goals. Absolute bedlam.`, `Defending was optional. ${hs + as} goals and everyone's hoarse.`]));
    else if (hs === as) lines.push(ctx.knockout ? pick([`All square at ${ground}.`, 'Nothing in it.']) : pick([`Honours even at ${ground}.`, 'Neither side could find a winner.', 'A point apiece, and both managers pretend to be happy.']));
    else if (hs + as === 1) { const s = (m.gh[0] || m.ga[0]).p; lines.push(pick([`Settled by a single goal from ${s}.`, `Tight, nervy, and won by ${s}.`])); }
    else if (hs > as) lines.push(pick([`${H.n} do the business in front of their own fans.`, `Home comforts for ${H.n}.`, `${ground.replace(/^the /, 'The ')} was rocking by the end.`]));
    else lines.push(pick([`${A.n} go to ${ground} and come away with the win.`, `A famous away day for ${A.n}.`, `The ${A.n} coach home is going to be loud.`]));
  }
  if (lines.length < 2 && ctx.career) {
    for (const [p, c] of [...m.gh.map(x => [x.p, m.h]), ...m.ga.map(x => [x.p, m.a])]) {
      if (/\(og\)$/.test(p)) continue;
      const n = ctx.career(p, c);
      if ([10, 25, 50, 100, 200].includes(n)) { lines.push(`That's ${n} goals for ${p} in the book now.`); break; }
    }
  }
  if (og && lines.length < 2 && rand() < 0.7) lines.push(`${og.p.replace(' (og)', '')} will want to forget that own goal.`);
  return lines.slice(0, 2).join(' ');
}

// Finishes a match once its dice are all thrown. Returns a shock note or null.
export function completeMatch(m, ctx) {
  m.done = true;
  let note = null;
  if (ctx.winner && ctx.decided !== false) {
    const W = team(ctx.winner), L = team(ctx.winner === m.h ? m.a : m.h);
    if (W.t - L.t >= 2) {
      m.shock = true;
      note = { where: ctx.where || '', text: `${W.n} ${ctx.knockout ? 'knock out' : 'beat'} ${L.n}`, score: `${m.hs}–${m.as}`, gap: W.t - L.t };
    }
  }
  assignScorers(m);
  m.rep = makeReport(m, ctx);
  return note;
}
export const matchLabel = m => `${nameOf(m.h)} ${m.hs}–${m.as} ${nameOf(m.a)}`;
