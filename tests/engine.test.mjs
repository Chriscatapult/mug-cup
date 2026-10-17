import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setEnv, seeded, env } from '../src/engine/env.js';
import { d6, goals, facePhrase } from '../src/engine/util.js';
import { setScores, completeMatch, pickScorer, newMatch } from '../src/engine/match.js';
import * as C from '../src/engine/competition.js';
import * as S from '../src/engine/season.js';
import { PRESETS, QUICK_CORE } from '../src/engine/presets.js';
import { needsLine } from '../src/engine/tension.js';
import { newAlmanac, recordMatch } from '../src/engine/almanac.js';
import { createLeague, leagueTable } from '../src/engine/league.js';
import * as RU from '../src/engine/rules.js';

const data = JSON.parse(readFileSync(new URL('../data/teams.json', import.meta.url)));
const squads = JSON.parse(readFileSync(new URL('../data/squads.json', import.meta.url)));
const teams = Object.fromEntries(data.teams.map(t => [t.id, t]));
setEnv({ teams, squads, rng: seeded('mug') });
const ids = data.teams.map(t => t.id);

// Play one match with whatever rules are in force, the way the screen does it.
function play(item, ctxFor) {
  const m = item.m;
  RU.prepare(m);
  if (RU.formDiePending(m)) RU.throwForm(m);
  RU.throwSide(m, 'h'); RU.throwSide(m, 'a'); setScores(m);
  if (item.t) while (C.tieStatus(item.t, item.r) === 'extra') { if (RU.expanded()) RU.throwPens(m); else RU.throwExtraPair(m); }
  completeMatch(m, ctxFor ? ctxFor(item) : { winner: null, knockout: !!item.t });
}
function runCup(c, H) {
  let guard = 0;
  while (c.phase !== 'done' && guard++ < 5000) {
    if (c.phase === 'draw') { C.tipOut(c); C.finishDraw(c); continue; }
    C.sitting(c).forEach(it => { play(it); if (H) recordMatch(H, it.m); });
    C.advance(c);
  }
  return c;
}

test('dice rules', () => {
  assert.equal(goals(6), 0); assert.equal(goals(4), 4);
  for (let i = 0; i < 200; i++) { const f = d6(); assert.ok(f >= 1 && f <= 6); }
  assert.equal(facePhrase([4, 5]), 'a 4 or 5');
  assert.equal(facePhrase([1, 2, 3, 4, 5]), 'anything but a 6');
});

test('data is sane', () => {
  assert.ok(ids.length > 700);
  assert.equal(new Set(ids).size, ids.length);
  QUICK_CORE.forEach(id => assert.ok(teams[id], `quick draw club missing: ${id}`));
});

for (const p of PRESETS) {
  test(`preset runs to a champion: ${p.name}`, () => {
    const c = C.createCompetition({ name: p.name, stages: p.stages, size: p.size === 'all' ? 'all' : p.size, teamIds: ids });
    runCup(c);
    assert.equal(c.phase, 'done');
    assert.ok(teams[c.champion], 'champion is a real club');
    assert.ok(c.finalText);
    assert.ok(C.snapshot(c).cols.length > 0);
  });
}

test('two legs, away goals and replays resolve', () => {
  for (let k = 0; k < 30; k++) {
    runCup(C.createCompetition({ name: 'x', stages: [{ type: 'ko', legs: 2, level: 'away', final1: false, until: 1 }], size: 16, teamIds: ids }));
    runCup(C.createCompetition({ name: 'y', stages: [{ type: 'ko', legs: 1, level: 'replay', until: 1 }], size: 13, teamIds: ids }));
  }
});

test('scorers come mostly from attackers', () => {
  const tally = { A: 0, M: 0, D: 0, G: 0 }, pos = Object.fromEntries(squads['arsenal'].s.map(([n, p]) => [n, p]));
  for (let i = 0; i < 3000; i++) { const n = pickScorer('arsenal'); if (pos[n]) tally[pos[n]]++; }
  assert.ok(tally.A > tally.D * 3, JSON.stringify(tally));
  assert.ok(tally.G < 40, JSON.stringify(tally));
  const sheet = pickScorer('albion-rovers');  // no real squad: made-up locals or a legend
  assert.ok(typeof sheet === 'string' && sheet.length > 1);
});

test('needs line reads sensibly', () => {
  const m = newMatch('celtic', 'albion-rovers'); m.fh = 3; m.hs = null;
  const line = needsLine({ m });
  assert.match(line, /A 4 or 5 and Albion Rovers win it/);
  const r = { legs: 1, level: 'dice' }, t = { h: 'celtic', a: 'albion-rovers', matches: [m], w: null };
  const l2 = needsLine({ m, t, r });
  assert.match(l2, /A 4 or 5 and Albion Rovers are through/);
  assert.match(l2, /A 3 and it's extra dice/);
  m.fh = 6;
  assert.match(needsLine({ m, t, r }), /Anything but a 6 and Albion Rovers are through/);
});

test('a whole season: leagues, cups, world tournaments, promotion and relegation', () => {
  const s = S.createSeasonDraw({ teamIds: ids, regions: 16, seeded: false });
  S.seasonTip(s);
  assert.ok(S.seasonDrawDone(s));
  s.regions.forEach(rg => rg.divs.forEach(dv => assert.equal(dv.teams.length, 8)));
  s.my = s.regions[3].divs[2].teams[0];
  S.beginSeason(s);
  const H = newAlmanac();
  let guard = 0, matches = 0;
  while (s.phase === 'run' && guard++ < 2000) {
    if (S.cupsToDraw(s).length) { S.tipOtherCups(s, -1); S.finishCupDraws(s); }
    const wc = S.worldComp(s);
    if (wc && wc.phase === 'draw') { C.tipOut(wc); C.finishDraw(wc); }
    const items = S.stepItems(s);
    items.forEach(it => { if (!it.m.done) { play(it, x => S.matchContext(s, x)); recordMatch(H, it.m); matches++; } });
    S.advanceSeason(s);
  }
  assert.equal(s.phase, 'end');
  assert.ok(matches > 4000 && matches < 4500, `matches ${matches}`);
  const sum = s.summary;
  assert.ok(sum.world.champ.champ && sum.world.shield.champ && sum.world.cwc.champ);
  assert.equal(sum.regions.length, 16);
  assert.ok(sum.my && sum.my.pos >= 1);
  // promotion and relegation keep every division at eight
  const r0 = sum.regions[0].shelves.map(sh => sh.map(x => x[0]));
  S.nextSeason(s);
  assert.equal(s.no, 2);
  s.regions.forEach(rg => rg.divs.forEach(dv => assert.equal(dv.teams.length, 8)));
  const top2ofSecond = r0[1].slice(0, 2), bottom2ofTop = r0[0].slice(-2);
  top2ofSecond.forEach(id => assert.ok(s.regions[0].divs[0].teams.includes(id), 'promoted'));
  bottom2ofTop.forEach(id => assert.ok(s.regions[0].divs[1].teams.includes(id), 'relegated'));
  assert.equal(new Set(s.regions.flatMap(rg => rg.divs.flatMap(dv => dv.teams))).size, 512);
});

test('seeded season puts the giants on the top shelf', () => {
  const s = S.createSeasonDraw({ teamIds: ids, regions: 4, seeded: true });
  S.seasonTip(s);
  const avg = d => { const t = s.regions.flatMap(rg => rg.divs[d].teams).map(id => teams[id].t); return t.reduce((a, b) => a + b, 0) / t.length; };
  assert.ok(avg(0) < avg(3));
});

test('league table and live tension', () => {
  const lg = createLeague(ids.slice(0, 8));
  assert.equal(lg.matches.length, 56);
  assert.equal(lg.mdCount, 14);
  assert.equal(leagueTable(lg).length, 8);
});

const withRules = (st, fn) => { setEnv({ rules: RU.makeRules(st) }); try { fn(); } finally { setEnv({ rules: RU.CLASSIC }); } };

test('the standard results card', () => {
  const t = RU.tally(RU.STANDARD_CARD);
  assert.equal(t.hw, 44); assert.equal(t.d, 27); assert.equal(t.aw, 29);
  assert.ok(t.goals > 2.4 && t.goals < 2.9, `goals ${t.goals}`);
  const wins = RU.STANDARD_CARD.map(r => r.filter(([h, a]) => h > a).length);
  for (let i = 1; i < 10; i++) assert.ok(wins[i] >= wins[i - 1], 'higher home die is never worse');
  assert.deepEqual(RU.STANDARD_CARD[0][0], [1, 0]);
  assert.deepEqual(RU.STANDARD_CARD[9][9], [4, 5]);
  assert.equal(RU.STANDARD_PENS.filter(e => e[0] === 'h').length, 5);
});

test('random and custom cards keep the same squares', () => {
  withRules({ dice: 'expanded', card: 'random' }, () => {
    const t = RU.tally(env.rules.card);
    assert.equal(t.hw, 44); assert.equal(t.d, 27);
  });
  const text = RU.cardToText(RU.STANDARD_CARD).flat();
  text[5] = 'nonsense';
  assert.throws(() => RU.makeRules({ dice: 'expanded', card: 'custom', customCard: text, customPens: RU.pensToText(RU.STANDARD_PENS) }));
  text[5] = '7-7';
  const r = RU.makeRules({ dice: 'expanded', card: 'custom', customCard: text, customPens: RU.pensToText(RU.STANDARD_PENS) });
  assert.deepEqual(r.card[0][5], [7, 7]);
});

for (const p of PRESETS) {
  test(`expanded rules with form: ${p.name}`, () => {
    setEnv({ formOf: id => RU.formFromLast((H0.clubs[id] || {}).last) });
    withRules({ dice: 'expanded', card: 'high', form: true }, () => {
      const c = C.createCompetition({ name: p.name, stages: p.stages, size: p.size === 'all' ? 'all' : p.size, teamIds: ids });
      runCup(c, H0);
      assert.equal(c.phase, 'done');
      const ms = C.allMatches(c).filter(m => m.done);
      assert.ok(ms.every(m => m.fh >= 1 && m.fh <= 10 && m.fa >= 1 && m.fa <= 10));
    });
  });
}
const H0 = newAlmanac();

test('expanded penalties decide level ties', () => {
  withRules({ dice: 'expanded', card: 'high' }, () => {
    let pens = 0;
    for (let k = 0; k < 20; k++) {
      const c = runCup(C.createCompetition({ name: 'x', stages: [{ type: 'ko', legs: 1, level: 'dice', until: 1 }], size: 32, teamIds: ids }));
      C.allMatches(c).forEach(m => { if (m.pk) { pens++; assert.equal(m.hs, m.as); assert.equal(m.x.length, 0); } });
    }
    assert.ok(pens > 20, `penalties ${pens}`);
  });
});

test('classic form: two dice, keep the better or worse', () => {
  setEnv({ formOf: id => (id === 'celtic' ? 1 : id === 'rangers' ? -1 : 0) });
  withRules({ dice: 'classic', form: true }, () => {
    for (let k = 0; k < 200; k++) {
      const m = newMatch('celtic', 'rangers');
      RU.throwSide(m, 'h'); RU.throwSide(m, 'a');
      const g = f => (f === 6 ? 0 : f);
      assert.equal(g(m.fh), Math.max(g(m.fhx[0]), g(m.fhx[1])));
      assert.equal(g(m.fa), Math.min(g(m.fax[0]), g(m.fax[1])));
    }
  });
});

test('expanded form die goes to the right side', () => {
  const cases = [[1, 0, 'h', false], [0, -1, 'h', false], [1, -1, 'h', true], [-1, 1, 'a', true], [1, 1, null], [-1, -1, null], [0, 1, 'a', false]];
  for (const [fh, fa, side, big] of cases) {
    setEnv({ formOf: id => (id === 'celtic' ? fh : fa) });
    withRules({ dice: 'expanded', card: 'high', form: true }, () => {
      const m = RU.prepare(newMatch('celtic', 'rangers'));
      if (!side) assert.equal(m.fp, null);
      else { assert.equal(m.fp.s, side); assert.equal(m.fp.big, big); }
    });
  }
});

test('expanded needs lines read the card', () => {
  withRules({ dice: 'expanded', card: 'high' }, () => {
    const m = newMatch('celtic', 'albion-rovers'); RU.prepare(m); m.fh = 1;
    const line = needsLine({ m });
    assert.match(line, /A 5 or higher and Albion Rovers win it/);
    assert.match(line, /A 1 and they lose/);
    m.fh = 10;
    assert.match(needsLine({ m }), /A 10 and Albion Rovers win it/);
  });
});

test('a whole season under expanded rules', () => {
  withRules({ dice: 'expanded', card: 'random', form: true }, () => {
    const s = S.createSeasonDraw({ teamIds: ids, regions: 4, seeded: false });
    S.seasonTip(s); s.my = s.regions[0].divs[0].teams[0]; S.beginSeason(s);
    let guard = 0;
    while (s.phase === 'run' && guard++ < 1000) {
      if (S.cupsToDraw(s).length) { S.tipOtherCups(s, -1); S.finishCupDraws(s); }
      const wc = S.worldComp(s);
      if (wc && wc.phase === 'draw') { C.tipOut(wc); C.finishDraw(wc); }
      S.stepItems(s).forEach(it => { if (!it.m.done) { play(it, x => S.matchContext(s, x)); recordMatch(H0, it.m); } });
      S.advanceSeason(s);
    }
    assert.equal(s.phase, 'end');
    assert.ok(H0.dice10.reduce((a, b) => a + b, 0) > 1000);
  });
});
