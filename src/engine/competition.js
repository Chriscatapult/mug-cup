// A cup-style competition built from stages: groups and knockouts, one game or two legs,
// replays, away goals, late entrants. Used for cup mode and for every cup inside a season.
import { tierOf, nameOf, groundOf } from './env.js';
import { newMatch, setScores } from './match.js';
import { sides } from './rules.js';
import { pow2floor, groupSizes, nameSeq, gName, clone, cap, plural, rand } from './util.js';

export const V = 4;

/* ---------- planning ---------- */
export function nextCount(c, target) { const P = pow2floor(c); return Math.max(c === P ? c / 2 : P, target); }
export function fitTarget(J, n) {
  if (!J) return pow2floor(n) === n ? n / 2 : pow2floor(n);
  let P = 1; while (P <= J) P *= 2;
  return Math.min(n, Math.max(1, P - J));
}
export const tiesFor = (c, target = 1) => c - nextCount(c, target);
export function entryStage(stages, tier) {
  let e = 0;
  stages.forEach((s, si) => { if (si > 0 && s.join && s.join.includes(tier)) e = si; });
  return e;
}
function simStage(cfg, n, isLast, Jnext, rn) {
  const res = { cols: [], matches: 0, errors: [], out: n, rn, desc: '' };
  if (cfg.type === 'groups') {
    const G = cfg.gsize ? Math.max(1, Math.round(n / cfg.gsize)) : 1;
    const sizes = groupSizes(n, G), mn = Math.min(...sizes), mx = Math.max(...sizes);
    if (mn < 2) res.errors.push('Every group needs at least two teams in it.');
    res.matches = sizes.reduce((s, k) => s + k * (k - 1) / 2 * cfg.legs, 0);
    if (isLast) { if (G > 1) res.errors.push('The last stage has to end with one team. Make it one big league, or finish with a knockout.'); res.out = 1; }
    else { if (cfg.adv >= mn) res.errors.push(`Top ${cfg.adv} go through from groups of ${mn}, so nobody goes out.`); res.out = G * Math.min(cfg.adv, mn); }
    res.cols.push({ kind: 'groups', title: G === 1 ? 'The league' : plural(G, 'group'), groups: [], ph: { G, size: mx } });
    res.desc = G === 1 ? `one league of ${n}, ${cfg.legs === 2 ? 'home and away' : 'everyone plays everyone once'}` :
      `${G} groups of ${mn === mx ? mx : mn + ' or ' + mx}, ${cfg.legs === 2 ? 'home and away' : 'played once'}${isLast ? '' : `, top ${cfg.adv} through`}`;
  } else {
    const target = cfg.until === 1 ? 1 : cfg.until === 'fit' ? fitTarget(Jnext, n) : Math.min(+cfg.until, n);
    if (isLast && cfg.until !== 1) res.errors.push('The last stage has to keep going until there is a winner.');
    if (!isLast && cfg.until === 1) res.errors.push('Only the last stage can play on until there is a winner.');
    let c = n;
    while (c > target && c >= 2) {
      const nx = nextCount(c, target), ties = c - nx, final = c === 2 && target === 1;
      const [name, rn2] = final ? ['The Final', rn] : nameSeq(c, rn); rn = rn2;
      res.matches += ties * (cfg.legs === 2 && !(cfg.final1 && final) ? 2 : 1);
      res.cols.push({ kind: 'ko', name, ties: [], planned: ties, byes: c - 2 * ties });
      c = nx;
    }
    res.out = c; res.rn = rn;
    const lvl = cfg.legs === 2 ? (cfg.level === 'away' ? ', away goals' : '') : (cfg.level === 'replay' ? ", replays if it's level" : '');
    res.desc = `knockout, ${cfg.legs === 2 ? 'home and away' : 'one game'}${lvl}, until ${target === 1 ? 'there is a winner' : target + ' are left'}`;
  }
  return res;
}
// What a design turns into for these teams. teams: [{ id, t: tier }]
export function planFor(stages, size, teams) {
  const errors = [], lines = [];
  if (!stages.length) return { errors: ['Add at least one stage.'], lines, matches: 0, J: [] };
  const J = stages.map(() => 0); let base = 0;
  teams.forEach(t => { const e = entryStage(stages, t.t); if (e) J[e]++; else base++; });
  const Jtot = J.reduce((a, b) => a + b, 0);
  if (size !== 'all' && size > teams.length) errors.push(`You asked for ${size} but only wrote ${teams.length} slips.`);
  let n = size === 'all' ? base : Math.min(base, size - Jtot);
  if (n < 2) errors.push('Not enough teams for the first stage once the late entrants are held back.');
  let total = 0, rn = 0, replays = false;
  stages.forEach((cfg, si) => {
    const inN = n + (si ? J[si] : 0), isLast = si === stages.length - 1;
    if (inN < 2) { if (!errors.length) errors.push(`Stage ${si + 1} only has ${inN} team${inN === 1 ? '' : 's'} in it.`); return; }
    const r = simStage(cfg, inN, isLast, J[si + 1] || 0, rn); rn = r.rn; total += r.matches;
    if (cfg.type === 'ko' && cfg.legs === 1 && cfg.level === 'replay') replays = true;
    r.errors.forEach(e => errors.push(`Stage ${si + 1}: ${e}`));
    const intro = si === 0 ? (size !== 'all' && n < base ? `${n} of ${base} slips come out of the mug` : `${inN} teams`) : `${inN} teams${J[si] ? `, ${J[si]} of them joining here` : ''}`;
    lines.push(`${stages.length > 1 ? `Stage ${si + 1}: ` : ''}${intro}. ${cap(r.desc)}. ${isLast ? 'Champions crowned.' : r.out + ' go through.'}`);
    n = r.out;
  });
  return { errors, lines, matches: total, replays, J, base };
}

/* ---------- running it ---------- */
function roundRobin(ids, legs) {
  const t = ids.slice(); if (t.length % 2) t.push(null);
  const n = t.length, R = n - 1, out = []; let arr = t.slice();
  for (let r = 0; r < R; r++) {
    for (let i = 0; i < n / 2; i++) {
      let a = arr[i], b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      if ((i === 0 && r % 2 === 1) || (i > 0 && i % 2 === 1)) [a, b] = [b, a];
      const m = newMatch(a, b, 'group', 0); m.md = r; out.push(m);
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  if (legs === 2) out.slice().forEach(m => { const x = newMatch(m.a, m.h, 'group', 0); x.md = m.md + R; out.push(x); });
  return out;
}
export { roundRobin };

// opts: { name, stages, size ('all' or number), teamIds, neutralFinal: venue name or fn }
export function createCompetition(opts) {
  const teams = opts.teamIds.map(id => ({ id, t: tierOf(id) }));
  const plan = planFor(opts.stages, opts.size, teams);
  if (plan.errors.length) throw new Error(plan.errors[0]);
  const c = {
    v: V, name: opts.name, created: Date.now(), size: opts.size === 'all' ? teams.length : opts.size,
    cfg: { stages: clone(opts.stages) }, finalVenue: opts.finalVenue || null, entry: {}, J: plan.J,
    stageIdx: 0, stages: [], phase: 'draw', notes: [], champion: null, runner: null, leftIn: [], mug: [], draw: null, feat: {},
  };
  const base = [];
  teams.forEach(t => { const e = entryStage(c.cfg.stages, t.t); if (e) c.entry[t.id] = e; else base.push(t.id); });
  const Jtot = plan.J.reduce((a, b) => a + b, 0);
  const limit = opts.size === 'all' ? null : opts.size - Jtot;
  startStage(c, 0, base, limit && limit < base.length ? limit : null);
  return c;
}
export const curCfg = c => c.cfg.stages[c.stageIdx];
export const curStage = c => c.stages[c.stageIdx];
export const curRound = c => { const st = curStage(c); return st.rounds[st.rounds.length - 1]; };
export const isLastStage = c => c.stageIdx === c.cfg.stages.length - 1;

function startStage(c, si, pool, limit) {
  const cfg = c.cfg.stages[si]; c.stageIdx = si;
  if (si > 0) Object.keys(c.entry).forEach(id => { if (c.entry[id] === si) pool.push(id); });
  const count = limit || pool.length;
  if (cfg.type === 'groups') {
    const G = cfg.gsize ? Math.max(1, Math.round(count / cfg.gsize)) : 1, sizes = groupSizes(count, G);
    c.stages[si] = { type: 'groups', groups: sizes.map((k, i) => ({ name: G === 1 ? 'The League' : gName(i), size: k, teams: [], matches: [], lots: {} })), md: 0, mdCount: 0 };
    const slots = [], mx = Math.max(...sizes);
    for (let p = 0; p < mx; p++) for (let g = 0; g < G; g++) if (sizes[g] > p) slots.push(g);
    c.mug = pool.slice();
    c.draw = { kind: 'groups', need: count, done: 0, start: pool.length, limited: count < pool.length, slots };
    c.phase = 'draw';
  } else {
    const target = cfg.until === 1 ? 1 : cfg.until === 'fit' ? fitTarget(c.J[si + 1] || 0, count) : Math.min(+cfg.until, count);
    c.stages[si] = { type: 'ko', target, rounds: [] };
    if (count <= target) { advanceFrom(c, pool.slice(0, count)); return; }
    startKORound(c, pool, limit);
  }
}
function advanceFrom(c, survivors) {
  if (isLastStage(c) || survivors.length === 1) crown(c, survivors[0], survivors[1] || null, null);
  else startStage(c, c.stageIdx + 1, survivors.slice(), null);
}
const roundsNumbered = c => c.stages.reduce((s, st) => s + (st && st.type === 'ko' ? st.rounds.filter(r => /^Round /.test(r.name)).length : 0), 0);
function startKORound(c, pool, limit) {
  const st = curStage(c), cfg = curCfg(c);
  const count = limit || pool.length, nx = nextCount(count, st.target), ties = count - nx;
  const final = count === 2 && st.target === 1;
  const name = final ? 'The Final' : nameSeq(count, roundsNumbered(c))[0];
  const legs = cfg.legs === 2 && !(cfg.final1 && final) ? 2 : 1;
  const level = legs === 2 ? (cfg.level === 'away' ? 'away' : 'dice') : (cfg.legs === 2 ? 'dice' : (cfg.level === 'replay' ? 'replay' : 'dice'));
  st.rounds.push({ name, count, ties: [], byes: [], sit: 0, legs, level, neutral: final && legs === 1, final });
  c.mug = pool.slice();
  c.draw = { kind: 'ko', need: ties * 2, done: 0, start: pool.length, limited: !!limit && limit < pool.length };
  c.phase = 'draw';
}
// Pull one slip at random. Returns where it went: { id, dest: 'g-3' | 't-5' }
export function pullOne(c, chosen) {
  const i = chosen !== undefined ? c.mug.indexOf(chosen) : Math.floor(rand() * c.mug.length);
  const id = c.mug.splice(i < 0 ? 0 : i, 1)[0];
  const d = c.draw;
  if (d.kind === 'groups') {
    const gi = d.slots[d.done];
    curStage(c).groups[gi].teams.push(id); d.done++;
    return { id, dest: 'g-' + gi };
  }
  const r = curRound(c), k = Math.floor(d.done / 2);
  if (d.done % 2 === 0) r.ties.push({ h: id, a: null, matches: [], w: null, mark: '' });
  else r.ties[k].a = id;
  d.done++;
  return { id, dest: 't-' + k, second: d.done % 2 === 0 };
}
export const drawComplete = c => c.draw && c.draw.done >= c.draw.need;
export function tipOut(c) { while (!drawComplete(c)) pullOne(c); }
export function finishDraw(c) {
  const d = c.draw, st = curStage(c), cfg = curCfg(c);
  if (d.kind === 'groups') {
    c.leftIn = c.leftIn.concat(c.mug);
    st.groups.forEach(g => { g.matches = roundRobin(g.teams, cfg.legs); g.teams.forEach(id => { g.lots[id] = rand(); }); });
    st.mdCount = Math.max(...st.groups.map(g => g.matches.reduce((mx, m) => Math.max(mx, m.md + 1), 0)));
    st.md = 0;
  } else {
    const r = curRound(c);
    if (d.limited) c.leftIn = c.leftIn.concat(c.mug); else r.byes = c.mug.slice();
    r.ties.forEach(t => { t.matches = [newMatch(t.h, t.a, r.legs === 2 ? 'leg1' : 'single', 0)]; });
  }
  c.mug = []; c.phase = 'play';
}
export function table(g, pts = 3) {
  const rows = {};
  g.teams.forEach(id => { rows[id] = { id, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0 }; });
  g.matches.forEach(x => {
    if (!x.done) return;
    const A = rows[x.h], B = rows[x.a];
    A.p++; B.p++; A.f += x.hs; A.a += x.as; B.f += x.as; B.a += x.hs;
    if (x.hs > x.as) { A.w++; B.l++; A.pts += pts; } else if (x.hs < x.as) { B.w++; A.l++; B.pts += pts; } else { A.d++; B.d++; A.pts++; B.pts++; }
  });
  return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.f - b.a) - (a.f - a.a) || b.f - a.f || (g.lots[b.id] || 0) - (g.lots[a.id] || 0));
}

/* A tie's state: 'open', 'leg2', 'replay', 'extra' or 'done' (and sets t.w / t.mark). */
export function tieStatus(t, r) {
  const ms = t.matches, m0 = ms[0];
  if (!m0 || m0.hs === null) return 'open';
  const win = (id, mark) => { t.w = id; t.mark = mark; return 'done'; };
  const xres = m => {
    if (m.pk) return win(m.pk.w === 'h' ? m.h : m.a, 'p');
    const l = m.x[m.x.length - 1]; if (!l || l[0] === l[1]) return 'extra'; return win(l[0] > l[1] ? m.h : m.a, '*');
  };
  if (r.legs === 2) {
    const m1 = ms[1];
    if (!m1) return m0.done ? 'leg2' : 'open';
    if (m1.hs === null) return 'open';
    const hAgg = m0.hs + m1.as, aAgg = m0.as + m1.hs;
    if (hAgg !== aAgg) return win(hAgg > aAgg ? t.h : t.a, '');
    if (r.level === 'away' && m1.as !== m0.as) return win(m1.as > m0.as ? t.h : t.a, 'a');
    return xres(m1);
  }
  const last = ms[ms.length - 1];
  if (last.hs === null) return 'open';
  if (last.hs !== last.as) return win(last.hs > last.as ? last.h : last.a, ms.length > 1 ? 'r' : '');
  if (r.level === 'replay' && ms.length === 1) return last.done ? 'replay' : 'open';
  return xres(last);
}
// What happens to the tie for each face the away die might show (given the home die is thrown).
export function tieOutcomes(t, r, m) {
  const out = {};
  for (let f = 1; f <= sides(); f++) {
    const save = { fa: m.fa, hs: m.hs, as: m.as, w: t.w, mark: t.mark };
    m.fa = f; setScores(m);
    const s = tieStatus(t, r);
    if (s === 'done') out[f] = t.w === m.a ? 'win' : 'lose';
    else if (s === 'extra') out[f] = 'extra';
    else if (r.level === 'replay' && m.kind === 'single' && m.hs === m.as) out[f] = 'replay';
    else out[f] = m.as > m.hs ? 'ahead' : m.as < m.hs ? 'behind' : 'level';
    Object.assign(m, { fa: save.fa, hs: save.hs, as: save.as }); t.w = save.w; t.mark = save.mark;
  }
  return out;
}

export function venueOf(c, m, r) {
  if (r && r.neutral) return typeof c.finalVenue === 'function' ? c.finalVenue(m) : (c.finalVenue || 'Wembley');
  return groundOf(m.h);
}
// Everything being played right now: [{ m, t?, r?, label }]
export function sitting(c) {
  const st = curStage(c);
  if (!st || c.phase !== 'play') return [];
  if (st.type === 'groups') {
    const out = [];
    st.groups.forEach(g => g.matches.forEach(m => { if (m.md === st.md) out.push({ m, g, label: st.groups.length > 1 ? 'Group ' + g.name : null }); }));
    return out;
  }
  const r = curRound(c), out = [];
  r.ties.forEach(t => { const m = t.matches.find(x => x.sit === r.sit); if (m) out.push({ m, t, r, label: null }); });
  return out;
}
export const sittingDone = c => sitting(c).every(it => it.m.done);
export function whereLabel(c, it) {
  if (it.label) return it.label;
  if (curStage(c).type === 'groups') return 'The league';
  return curRound(c).name.replace(/^The /, '');
}
export function sittingKey(c) {
  const st = curStage(c);
  return st.type === 'groups' ? `${c.stageIdx}-g${st.md}` : `${c.stageIdx}-r${st.rounds.length}-s${curRound(c).sit}`;
}
export function stageName(c, si) {
  const cfg = c.cfg.stages[si];
  return c.cfg.stages.length > 1 ? `Stage ${si + 1}` : (cfg.type === 'groups' ? 'Groups' : 'Knockout');
}
export function nextLabel(c) {
  const st = curStage(c);
  if (st.type === 'groups') return st.md < st.mdCount - 1 ? `On to matchday ${st.md + 2}` : isLastStage(c) ? 'Crown the champions' : 'Final tables, then back to the mug';
  const r = curRound(c), states = r.ties.map(t => tieStatus(t, r));
  if (states.includes('leg2')) return 'On to the second legs';
  if (states.includes('replay')) return 'On to the replays';
  const surv = r.ties.length + r.byes.length;
  if (surv <= st.target || surv === 1) return isLastStage(c) ? 'Crown the champions' : 'On to the next stage';
  return 'Back to the mug for the next draw';
}
// Move on once the current sitting is done.
export function advance(c) {
  const st = curStage(c), cfg = curCfg(c);
  if (st.type === 'groups') {
    if (st.md < st.mdCount - 1) { st.md++; return; }
    if (isLastStage(c)) { const tb = table(st.groups[0], cfg.pts); crown(c, tb[0].id, tb[1] ? tb[1].id : null, tb); return; }
    const q = [];
    st.groups.forEach(g => table(g, cfg.pts).slice(0, cfg.adv).forEach(row => q.push(row.id)));
    startStage(c, c.stageIdx + 1, q, null); return;
  }
  const r = curRound(c);
  let made = false;
  r.ties.forEach(t => {
    const s = tieStatus(t, r);
    if (s === 'leg2') { t.matches.push(newMatch(t.a, t.h, 'leg2', r.sit + 1)); made = true; }
    else if (s === 'replay') { t.matches.push(newMatch(t.a, t.h, 'replay', r.sit + 1)); made = true; }
  });
  if (made) { r.sit++; return; }
  const surv = r.ties.map(t => t.w).concat(r.byes);
  if (surv.length <= st.target || surv.length === 1) advanceFrom(c, surv);
  else startKORound(c, surv, null);
}
function crown(c, id, runner, tb) {
  c.phase = 'done'; c.champion = id; c.runner = runner;
  if (tb) {
    c.finalText = `${nameOf(id)} top the league with ${tb[0].pts} points${runner ? `, ${tb[1].pts === tb[0].pts ? 'level with' : 'ahead of'} ${nameOf(runner)}` : ''}`;
    c.finalVenue_ = '';
    return;
  }
  const st = curStage(c), r = st.rounds && st.rounds[st.rounds.length - 1];
  const t = r && r.ties.find(x => x.w === id);
  if (t) {
    c.finalVenue_ = venueOf(c, t.matches[0], r);
    const last = t.matches[t.matches.length - 1];
    c.finalText = t.matches.map(m => `${nameOf(m.h)} ${m.hs}–${m.as} ${nameOf(m.a)}`).join(', then ') + (t.mark === '*' ? ' (extra dice)' : t.mark === 'a' ? ' (away goals)' : t.mark === 'p' && last.pk ? ` (${nameOf(t.w)} win ${last.pk.s} on penalties)` : '');
  } else c.finalText = `${nameOf(id)} were the last team standing`;
}
export function allMatches(c) {
  const out = [];
  c.stages.forEach(st => {
    if (!st) return;
    if (st.type === 'groups') st.groups.forEach(g => g.matches.forEach(m => out.push(m)));
    else st.rounds.forEach(r => r.ties.forEach(t => t.matches.forEach(m => out.push(m))));
  });
  return out;
}
// Is this match one that matters? Finals, semis, deciding legs, replays, extra dice.
export function cupPivot(c, it) {
  if (!it.r) {
    const st = curStage(c);
    return st.type === 'groups' && st.md === st.mdCount - 1 && st.groups.length > 1 ? 'group decider' : '';
  }
  if (it.r.final || (it.r.count === 2 && curStage(c).target === 1)) return 'the final';
  if (it.m.kind === 'leg2') return 'the second leg';
  if (it.m.kind === 'replay') return 'a replay';
  if (it.r.count === 4 && curStage(c).target === 1) return 'a semi-final';
  return '';
}

/* ---------- wallchart ---------- */
function tieSnap(t, r) {
  const ms = t.matches || [];
  let hs = '', as = '';
  if (r.legs === 2) {
    const m0 = ms[0], m1 = ms[1];
    if (m0 && m0.done) { hs = m0.hs; as = m0.as; if (m1 && m1.done) { hs += m1.as; as += m1.hs; } }
  } else {
    const last = [...ms].reverse().find(m => m.done);
    if (last) { hs = last.h === t.h ? last.hs : last.as; as = last.h === t.h ? last.as : last.hs; }
  }
  return [nameOf(t.h), nameOf(t.a), hs, as, t.w ? (t.w === t.h ? 0 : 1) : -1, t.w ? t.mark || '' : ''];
}
function futureCols(c) {
  if (c.phase === 'done') return [];
  const si = c.stageIdx, cfg = curCfg(c), st = curStage(c), cols = [];
  let out, rn = roundsNumbered(c);
  if (st.type === 'groups') out = isLastStage(c) ? 1 : st.groups.length * cfg.adv;
  else {
    const r = curRound(c); let n = nextCount(r.count, st.target);
    while (n > st.target && n >= 2) {
      const nx = nextCount(n, st.target), final = n === 2 && st.target === 1;
      const [name, rn2] = final ? ['The Final', rn] : nameSeq(n, rn); rn = rn2;
      cols.push({ kind: 'ko', name, ties: [], planned: n - nx, byes: 0 }); n = nx;
    }
    out = n;
  }
  for (let s = si + 1; s < c.cfg.stages.length; s++) {
    const inN = out + (c.J[s] || 0);
    const r = simStage(c.cfg.stages[s], inN, s === c.cfg.stages.length - 1, c.J[s + 1] || 0, rn);
    rn = r.rn; r.cols.forEach(x => cols.push(x)); out = r.out;
  }
  return cols;
}
export function snapshot(c) {
  const cols = [];
  c.cfg.stages.forEach((cfg, si) => {
    const st = c.stages[si]; if (!st) return;
    if (st.type === 'groups') cols.push({ kind: 'groups', title: st.groups.length === 1 ? 'The league' : `${stageName(c, si)}: groups`,
      groups: st.groups.map(g => ({ n: g.name, done: g.matches.length > 0 && g.matches.every(m => m.done), q: cfg.adv,
        rows: g.matches.length ? table(g, cfg.pts).map(row => [nameOf(row.id), row.pts]) : g.teams.map(id => [nameOf(id), '']) })) });
    else st.rounds.forEach(r => cols.push({ kind: 'ko', name: r.name, planned: r.count - nextCount(r.count, st.target), byes: r.byes.length, ties: r.ties.filter(t => t.a).map(t => tieSnap(t, r)) }));
  });
  futureCols(c).forEach(x => cols.push(x));
  return { v: 4, name: c.name, champ: c.champion ? nameOf(c.champion) : null, cols };
}
