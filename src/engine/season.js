// Season mode: regions of four divisions, a regional cup each, and three world tournaments in the summer.
import { nameOf, tierOf } from './env.js';
import { createLeague, leagueTable, mdMatches, leaguePivot } from './league.js';
import { createCompetition, finishDraw, tipOut, sitting, advance as advanceCup, curRound, venueOf, tieStatus, cupPivot, whereLabel, drawComplete } from './competition.js';
import { shuffle, rand } from './util.js';

export const SV = 1;
export const REGION_NAMES = [
  'Conker Valley', 'Puddle Lane', 'The Biscuit Coast', 'Treehouse Hills', 'Marble Bay', 'Bonfire Moor',
  'Dandelion Downs', 'The Lolly Isles', 'Kite Hill', 'Frogspawn Fens', 'Sherbet Sands', 'Den Woods',
  'Snowball Peaks', 'Rockpool Point', 'Stickleback Brook', 'Hopscotch Heath',
];
export const SHELVES = ['The Top Shelf', 'The Second Shelf', 'The Bottom Drawer', 'Under the Bed'];
export const WORLD = {
  champ: { name: 'The World Championship', short: 'World Championship' },
  shield: { name: 'The World Shield', short: 'World Shield' },
  cwc: { name: "The World Cup Winners' Cup", short: "Cup Winners' Cup" },
};
export const WORLD_VENUE = 'the Dreamland Stadium';
const DIV_SIZE = 8;

export function zonesFor(shelf, shelves = 4) {
  const z = [];
  if (shelf === 0) {
    z.push({ upTo: 2, name: 'champ', into: 'into the World Championship places', label: 'the World Championship places' });
    z.push({ upTo: 4, from: 3, name: 'shield', into: 'into the World Shield places', label: 'the World Shield places' });
  } else z.push({ upTo: 2, name: 'up', into: 'into the promotion places', label: 'the promotion places' });
  if (shelf < shelves - 1) z.push({ from: DIV_SIZE - 1, name: 'down', into: 'into the drop zone', label: 'the drop zone' });
  return z;
}
export const seasonLabel = no => { const y = 1991 + no; return `${y}–${String(y + 1).slice(-2)}`; };
export const teamsNeeded = regions => regions * 4 * DIV_SIZE;

/* ---------- the opening draw: every club into a region and a shelf ---------- */
export function createSeasonDraw({ teamIds, regions = 16, seeded = false, name }) {
  const need = teamsNeeded(regions);
  if (teamIds.length < need) throw new Error(`A season with ${regions} regions needs ${need} clubs. You've written ${teamIds.length} slips.`);
  const s = {
    v: SV, no: 1, name: name || 'The Mug League', regionCount: regions, created: Date.now(),
    regions: REGION_NAMES.slice(0, regions).map(n => ({ name: n, divs: SHELVES.map((_, d) => ({ shelf: d, teams: [], league: null })), cup: null })),
    phase: 'draw', my: null, step: 0, calendar: [], world: {}, notes: [], archive: [], feat: {}, sub: null,
  };
  const order = [];
  for (let d = 0; d < 4; d++) for (let k = 0; k < DIV_SIZE; k++) for (let r = 0; r < regions; r++) order.push([r, d]);
  let pots = null, pool = shuffle(teamIds.slice());
  if (pool.length > need) pool = pool.slice(0, need);
  if (seeded) {
    const sorted = pool.slice().sort((a, b) => tierOf(a) - tierOf(b) || rand() - 0.5);
    const per = regions * DIV_SIZE;
    pots = [0, 1, 2, 3].map(i => sorted.slice(i * per, (i + 1) * per));
  }
  s.draw = { need, done: 0, order, pots, unused: teamIds.length - need };
  s.mug = pots ? pots[0].slice() : pool;
  return s;
}
export function seasonPull(s, chosen) {
  const i = chosen !== undefined ? s.mug.indexOf(chosen) : Math.floor(rand() * s.mug.length);
  const id = s.mug.splice(i < 0 ? 0 : i, 1)[0];
  const [r, d] = s.draw.order[s.draw.done];
  s.regions[r].divs[d].teams.push(id);
  s.draw.done++;
  if (s.draw.pots && s.mug.length === 0 && s.draw.done < s.draw.need) s.mug = s.draw.pots[s.draw.done / (s.regionCount * DIV_SIZE)].slice();
  return { id, r, d };
}
export const seasonDrawDone = s => s.draw.done >= s.draw.need;
export function seasonTip(s) { while (!seasonDrawDone(s)) seasonPull(s); }
export const shelfBeingDrawn = s => s.draw.order[Math.min(s.draw.done, s.draw.need - 1)][1];

/* ---------- starting a season ---------- */
function buildCalendar(mdCount, cupRounds) {
  const cal = [], cupAfter = new Set();
  for (let k = 1; k <= cupRounds - 1; k++) cupAfter.add(Math.round(k * mdCount / cupRounds));
  let cup = 1;
  for (let md = 0; md < mdCount; md++) {
    cal.push({ k: 'league', md });
    if (cupAfter.has(md + 1) && cup < cupRounds) cal.push({ k: 'cup', round: cup++ });
  }
  cal.push({ k: 'cup', round: cupRounds });
  cal.push({ k: 'world', which: 'champ' }, { k: 'world', which: 'shield' }, { k: 'world', which: 'cwc' }, { k: 'end' });
  return cal;
}
export function beginSeason(s) {
  s.regions.forEach(rg => {
    rg.divs.forEach(dv => { dv.league = createLeague(dv.teams, 2); });
    const all = rg.divs.flatMap(dv => dv.teams);
    rg.cup = createCompetition({ name: `The ${rg.name.replace(/^The /, '')} Cup`, stages: [{ type: 'ko', legs: 1, level: 'dice', until: 1 }], size: 'all', teamIds: all, finalVenue: `the ${rg.name.replace(/^The /, '')} Bowl` });
  });
  const mdCount = s.regions[0].divs[0].league.mdCount;
  const cupRounds = Math.ceil(Math.log2(teamsNeeded(1)));
  s.calendar = buildCalendar(mdCount, cupRounds);
  s.step = 0; s.phase = 'run'; s.world = {}; s.notes = []; s.feat = {};
  enterStep(s);
}
export const myRegionIndex = s => s.my ? s.regions.findIndex(rg => rg.divs.some(dv => dv.teams.includes(s.my))) : 0;
export function whereIs(s, id) {
  for (let r = 0; r < s.regions.length; r++) for (let d = 0; d < 4; d++) if (s.regions[r].divs[d].teams.includes(id)) return { r, d };
  return null;
}
export const curStep = s => s.calendar[s.step];

/* ---------- stepping through the calendar ---------- */
function worldTeams(s, which) {
  const ids = [];
  s.regions.forEach(rg => {
    if (which === 'cwc') { if (rg.cup.champion) ids.push(rg.cup.champion); return; }
    const tb = leagueTable(rg.divs[0].league);
    (which === 'champ' ? tb.slice(0, 2) : tb.slice(2, 4)).forEach(row => ids.push(row.id));
  });
  return ids;
}
function enterStep(s) {
  const st = curStep(s);
  s.sub = null;
  if (st.k === 'cup') s.sub = 'draw';
  if (st.k === 'world' && !s.world[st.which]) {
    const ids = worldTeams(s, st.which);
    const stages = st.which === 'champ' && ids.length >= 8
      ? [{ type: 'groups', gsize: 4, legs: 1, adv: 2, pts: 3 }, { type: 'ko', legs: 1, level: 'dice', until: 1 }]
      : [{ type: 'ko', legs: 1, level: 'dice', until: 1 }];
    s.world[st.which] = createCompetition({ name: WORLD[st.which].name, stages, size: 'all', teamIds: ids, finalVenue: WORLD_VENUE });
  }
  if (st.k === 'end') finishSeason(s);
}
// The draws that need doing now (regional cups). The player's region is drawn by hand; the rest tip out.
export const cupsToDraw = s => curStep(s).k === 'cup' && s.sub === 'draw' ? s.regions.map(rg => rg.cup) : [];
export function tipOtherCups(s, keepIndex) {
  s.regions.forEach((rg, i) => { if (i !== keepIndex && rg.cup.phase === 'draw') tipOut(rg.cup); });
}
export function finishCupDraws(s) {
  s.regions.forEach(rg => { if (rg.cup.phase === 'draw') { tipOut(rg.cup); finishDraw(rg.cup); } });
  s.sub = 'play';
}
// Everything to be played right now, as items the play screen understands.
export function stepItems(s) {
  const st = curStep(s);
  if (!st) return [];
  if (st.k === 'league') {
    const out = [];
    s.regions.forEach((rg, r) => rg.divs.forEach((dv, d) => mdMatches(dv.league, st.md).forEach(m => out.push({ m, league: dv.league, r, d, zones: zonesFor(d), label: `${rg.name}, ${SHELVES[d]}` }))));
    return out;
  }
  if (st.k === 'cup' && s.sub === 'play') {
    const out = [];
    s.regions.forEach((rg, r) => sitting(rg.cup).forEach(it => out.push({ ...it, c: rg.cup, r, label: rg.cup.name })));
    return out;
  }
  if (st.k === 'world') {
    const c = s.world[st.which];
    return c.phase === 'play' ? sitting(c).map(it => ({ ...it, c, label: it.label || whereLabel(c, it) })) : [];
  }
  return [];
}
export const worldComp = s => { const st = curStep(s); return st && st.k === 'world' ? s.world[st.which] : null; };
export function stepTitle(s) {
  const st = curStep(s);
  if (!st) return '';
  if (st.k === 'league') return `Matchday ${st.md + 1} of ${s.regions[0].divs[0].league.mdCount}`;
  if (st.k === 'cup') { const r = curRound(s.regions[0].cup); return `The regional cups: ${r ? r.name.replace(/^The /, 'the ') : ''}`; }
  if (st.k === 'world') return WORLD[st.which].name;
  return 'The end of the season';
}
// For finishing a match: who won, was it a knockout, where was it played.
export function matchContext(s, it) {
  const m = it.m;
  if (it.league) return { winner: m.hs > m.as ? m.h : m.as > m.hs ? m.a : null, knockout: false, where: it.label, venue: null };
  const c = it.c;
  if (it.t) {
    const st = tieStatus(it.t, it.r), last = it.t.matches[it.t.matches.length - 1] === m;
    const decided = st === 'done' && last;
    return { winner: decided ? it.t.w : (m.hs !== m.as ? (m.hs > m.as ? m.h : m.a) : null), decided, knockout: true, where: `${c.name.replace(/^The /, '')}, ${whereLabel(c, it)}`, venue: venueOf(c, m, it.r) };
  }
  return { winner: m.hs > m.as ? m.h : m.as > m.hs ? m.a : null, knockout: false, where: `${c.name.replace(/^The /, '')}, ${whereLabel(c, it)}`, venue: venueOf(c, m, it.r) };
}
export function pivotFor(s, it) {
  if (it.league) return leaguePivot(it.league, it.m, it.zones);
  return cupPivot(it.c, it);
}
export const stepDone = s => {
  const st = curStep(s);
  if (st.k === 'cup' && s.sub === 'draw') return false;
  if (st.k === 'world') return s.world[st.which].phase === 'done';
  return stepItems(s).every(it => it.m.done);
};
// After a sitting is finished. Returns true when the calendar moved to a new step.
export function advanceSeason(s) {
  const st = curStep(s);
  if (st.k === 'world') {
    const c = s.world[st.which];
    if (c.phase === 'play' && sitting(c).every(it => it.m.done)) advanceCup(c);
    if (c.phase !== 'done') return false;
  }
  if (st.k === 'cup') s.regions.forEach(rg => { if (rg.cup.phase === 'play') advanceCup(rg.cup); });
  if (st.k === 'cup' && s.regions.some(rg => rg.cup.phase === 'play')) return false;  // (never: single-leg extra dice)
  s.step++;
  enterStep(s);
  return true;
}
export function nextStepLabel(s) {
  const st = curStep(s), nx = s.calendar[s.step + 1];
  if (st.k === 'world') { const c = s.world[st.which]; if (c.phase !== 'done') return null; }
  if (!nx) return 'On to next season';
  if (nx.k === 'league') return `On to matchday ${nx.md + 1}`;
  if (nx.k === 'cup') return 'To the mug for the regional cup draw';
  if (nx.k === 'world') return `On to ${WORLD[nx.which].name.replace(/^The /, 'the ')}`;
  return 'See how the season finished';
}

/* ---------- the end of the season ---------- */
function finishSeason(s) {
  const sum = { no: s.no, label: seasonLabel(s.no), regions: [], world: {}, my: null };
  const moves = s.regions.map(() => [[], [], [], []]);
  s.regions.forEach((rg, r) => {
    const reg = { name: rg.name, cup: rg.cup.champion, cupRunner: rg.cup.runner, shelves: [] };
    rg.divs.forEach((dv, d) => {
      const tb = leagueTable(dv.league);
      reg.shelves.push(tb.map(row => [row.id, row.pts, row.w, row.d, row.l, row.f, row.a]));
      const ids = tb.map(row => row.id);
      if (d > 0) ids.slice(0, 2).forEach(id => moves[r][d - 1].push(id));
      if (d < 3) ids.slice(-2).forEach(id => moves[r][d + 1].push(id));
      const stay = ids.filter((id, i) => !((d > 0 && i < 2) || (d < 3 && i >= ids.length - 2)));
      stay.forEach(id => moves[r][d].push(id));
    });
    sum.regions.push(reg);
  });
  Object.keys(WORLD).forEach(k => { const c = s.world[k]; if (c) sum.world[k] = { champ: c.champion, runner: c.runner, text: c.finalText }; });
  if (s.my) sum.my = myStory(s);
  s.pendingMoves = moves;
  s.summary = sum;
  s.archive.push(sum);
  if (s.archive.length > 30) s.archive.shift();
  s.phase = 'end';
}
// Everything about the player's club this season, for the end-of-season page and the share card.
export function myStory(s) {
  const id = s.my, w = whereIs(s, id);
  if (!w) return null;
  const rg = s.regions[w.r], dv = rg.divs[w.d], tb = leagueTable(dv.league);
  const pos = tb.findIndex(row => row.id === id) + 1, row = tb[pos - 1];
  let cupRun = 'went out early';
  const cupRounds = rg.cup.stages[0].rounds;
  if (rg.cup.champion === id) cupRun = 'won the cup';
  else {
    const lost = cupRounds.find(r => r.ties.some(t => (t.h === id || t.a === id) && t.w && t.w !== id));
    if (lost) cupRun = `out in ${lost.name.replace(/^The /, 'the ')}`;
  }
  const world = [];
  Object.keys(WORLD).forEach(k => {
    const c = s.world[k]; if (!c) return;
    const inIt = Object.values(c.stages).some(st => st && (st.type === 'groups' ? st.groups.some(g => g.teams.includes(id)) : st.rounds.some(r => r.ties.some(t => t.h === id || t.a === id) || r.byes.includes(id))));
    if (!inIt) return;
    world.push({ k, won: c.champion === id, runner: c.runner === id });
  });
  const moved = w.d > 0 && pos <= 2 ? 'promoted' : w.d < 3 && pos >= tb.length - 1 ? 'relegated' : 'stayed';
  return { id, r: w.r, d: w.d, region: rg.name, shelf: SHELVES[w.d], pos, pts: row.pts, w: row.w, dr: row.d, l: row.l, f: row.f, a: row.a, champions: pos === 1, cupRun, world, moved };
}
export function nextSeason(s) {
  const moves = s.pendingMoves;
  s.regions.forEach((rg, r) => rg.divs.forEach((dv, d) => { dv.teams = moves[r][d].slice(); dv.league = null; }));
  s.no++; s.pendingMoves = null; s.summary = null;
  beginSeason(s);
}

/* ---------- views ---------- */
export function divisionTable(s, r, d) { return leagueTable(s.regions[r].divs[d].league); }
export const shelfName = d => SHELVES[d];
export const teamLabel = id => nameOf(id);
