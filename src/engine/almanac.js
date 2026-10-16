// The record books, carried across every cup and every season. Keyed by club id.
import { nameOf } from './env.js';
import { isOG } from './match.js';

export const newAlmanac = () => ({ v: 2, tours: 0, seasons: 0, matches: 0, goals: 0, dice: [0, 0, 0, 0, 0, 0], scores: {}, clubs: {}, players: {}, h2h: {} });

export function club(H, id) {
  return H.clubs[id] || (H.clubs[id] = { p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, t: 0, fin: 0, tours: 0, rolls: 0, faces: 0, last: [], big: null, titles: [], up: 0, down: 0 });
}
const key2 = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export function h2h(H, a, b) {
  const r = H.h2h[key2(a, b)]; if (!r) return null;
  const aFirst = a < b;
  return { aw: aFirst ? r[0] : r[2], d: r[1], bw: aFirst ? r[2] : r[0], last: r[3] || '', n: r[0] + r[1] + r[2] };
}
export const careerGoals = (H, player, clubId) => H.players[player + '|' + clubId] || 0;

export function recordMatch(H, m) {
  const hn = nameOf(m.h), an = nameOf(m.a), hc = club(H, m.h), ac = club(H, m.a);
  H.matches++; H.goals += m.hs + m.as;
  H.dice[m.fh - 1]++; H.dice[m.fa - 1]++;
  hc.rolls++; hc.faces += m.fh; ac.rolls++; ac.faces += m.fa;
  (m.xf || []).forEach(([a, b]) => { H.dice[a - 1]++; H.dice[b - 1]++; hc.rolls++; hc.faces += a; ac.rolls++; ac.faces += b; });
  const sk = Math.max(m.hs, m.as) + '–' + Math.min(m.hs, m.as);
  H.scores[sk] = (H.scores[sk] || 0) + 1;
  [[hc, m.hs, m.as, an], [ac, m.as, m.hs, hn]].forEach(([c, f, a, opp]) => {
    c.p++; c.f += f; c.a += a;
    const res = f > a ? 'W' : f < a ? 'L' : 'D';
    if (res === 'W') c.w++; else if (res === 'L') c.l++; else c.d++;
    c.last.push(`${res} ${f}–${a} v ${opp}`); if (c.last.length > 5) c.last.shift();
    if (f - a > 0 && (!c.big || f - a > c.big[0] || (f - a === c.big[0] && f > c.big[2]))) c.big = [f - a, `${f}–${a} v ${opp}`, f];
  });
  const k = key2(m.h, m.a), r = H.h2h[k] || [0, 0, 0, ''];
  const firstIsHome = m.h < m.a;
  if (m.hs === m.as) r[1]++; else if ((m.hs > m.as) === firstIsHome) r[0]++; else r[2]++;
  r[3] = `${hn} ${m.hs}–${m.as} ${an}`;
  H.h2h[k] = r;
  [...m.gh.map(g => [g, m.h]), ...m.ga.map(g => [g, m.a])].forEach(([g, c]) => {
    if (isOG(g)) return;
    const pk = g.p + '|' + c; H.players[pk] = (H.players[pk] || 0) + 1;
  });
}
export function recordTrophy(H, id, title, runner) {
  const c = club(H, id); c.t++; c.titles.push(title); if (c.titles.length > 20) c.titles.shift();
  if (runner) club(H, runner).fin++;
}
export function recordTour(H, ids) { H.tours++; ids.forEach(id => club(H, id).tours++); }
export function recordMove(H, id, dir) { const c = club(H, id); if (dir > 0) c.up++; else c.down++; }

// Keeps the record books small enough to save comfortably.
export function trim(H, maxH2H = 40000) {
  const keys = Object.keys(H.h2h);
  if (keys.length > maxH2H) keys.forEach(k => { const r = H.h2h[k]; if (r[0] + r[1] + r[2] <= 1) delete H.h2h[k]; });
  const pk = Object.keys(H.players);
  if (pk.length > 60000) pk.forEach(k => { if (H.players[k] <= 1) delete H.players[k]; });
}
export function goldenBoot(matches, n = 5) {
  const tally = {};
  matches.forEach(m => {
    if (!m.done) return;
    [...m.gh.map(g => [g, m.h]), ...m.ga.map(g => [g, m.a])].forEach(([g, c]) => { if (!isOG(g)) { const k = g.p + '|' + c; tally[k] = (tally[k] || 0) + 1; } });
  });
  return Object.entries(tally).map(([k, v]) => { const i = k.lastIndexOf('|'); return { p: k.slice(0, i), t: k.slice(i + 1), n: v }; }).sort((a, b) => b.n - a.n).slice(0, n);
}
