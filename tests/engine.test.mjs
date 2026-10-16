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

const data = JSON.parse(readFileSync(new URL('../data/teams.json', import.meta.url)));
const squads = JSON.parse(readFileSync(new URL('../data/squads.json', import.meta.url)));
const teams = Object.fromEntries(data.teams.map(t => [t.id, t]));
setEnv({ teams, squads, rng: seeded('mug') });
const ids = data.teams.map(t => t.id);

// Play one match with the rules: 1-5 goals, 6 nil, extra dice until somebody blinks.
function play(item, ctxFor) {
  const m = item.m;
  m.fh = d6(); m.fa = d6(); setScores(m);
  if (item.t) while (C.tieStatus(item.t, item.r) === 'extra') { const a = d6(), b = d6(); m.x.push([goals(a), goals(b)]); m.xf.push([a, b]); }
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
