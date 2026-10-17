// The line that appears after the first die lands: what the second die needs to do.
import { nameOf } from './env.js';
import { facePhrase } from './util.js';
import { scoreOf, sides, expanded, R, classicEdge } from './rules.js';
import { tieOutcomes } from './competition.js';
import { leagueTable, position, zoneOf } from './league.js';

function group(outcomes) {
  const g = {};
  Object.entries(outcomes).forEach(([f, o]) => { (g[o] = g[o] || []).push(+f); });
  return g;
}
// For a plain match: faces that win, draw or lose for the away side.
export function plainOutcomes(m) {
  const out = {};
  for (let f = 1; f <= sides(); f++) { const [h, a] = scoreOf(m, f); out[f] = a > h ? 'win' : a < h ? 'lose' : 'level'; }
  return out;
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
// item: { m, t?, r? } with m.fh thrown and m.fa not. ctx: { league, zones } for league games.
export function needsLine(item, ctx = {}) {
  const m = item.m;
  if (!m.fh || m.fa) return '';
  const away = nameOf(m.a);
  const outcomes = item.t ? tieOutcomes(item.t, item.r, m) : plainOutcomes(m);
  const g = group(outcomes);
  if (g.win && g.win.length === sides()) return `${away} can't lose now.`;
  if (g.lose && g.lose.length === sides()) return `It's over for ${away}. Nothing can save them.`;
  const knock = !!item.t && m.kind !== 'leg1';
  const VERB = {
    win: who => knock ? `${who} are through` : `${who} win it`,
    lose: who => knock ? `${who} are out` : `${who} lose`,
    level: () => m.kind === 'leg1' ? "it's level going into the second leg" : "it's a draw",
    extra: () => expanded() ? "it's penalties" : "it's extra dice", replay: () => "it's a replay",
    ahead: who => `${who} take a lead into the second leg`,
    behind: who => `${who} go into the second leg behind`,
  };
  const order = ['win', 'ahead', 'extra', 'replay', 'level', 'behind', 'lose'];
  let named = false;
  const bits = order.filter(o => g[o]).map(o => {
    const who = named ? 'they' : away;
    const v = VERB[o](who);
    if (v.includes(away)) named = true;
    return `${cap1(facePhrase(g[o], sides()))} and ${v}.`;
  });
  let line = bits.join(' ');
  const edge = classicEdge(m, 'a');
  if (edge) line = `${away} throw two dice and keep the ${edge > 0 ? 'better' : 'worse'} one. ` + line;
  if (ctx.league && ctx.zones) line += zoneHint(item, ctx, g);
  return line;
}
// "A win lifts them out of the drop zone." Uses results played so far this matchday.
function zoneHint(item, ctx, g) {
  const m = item.m, lg = ctx.league;
  const where = res => {
    const save = { hs: m.hs, as: m.as, done: m.done };
    m.hs = res === 'win' ? 0 : res === 'lose' ? 1 : 0; m.as = res === 'win' ? 1 : 0; m.done = true;
    const tb = leagueTable(lg);
    Object.assign(m, save);
    return position(tb, m.a);
  };
  const now = position(leagueTable(lg), m.a), size = lg.teams.length;
  const zNow = zoneOf(now, size, ctx.zones);
  const byMsg = new Map();
  for (const res of ['win', 'level', 'lose']) {
    if (!g[res]) continue;
    const pos = where(res), z = zoneOf(pos, size, ctx.zones);
    if ((z && z.name) === (zNow && zNow.name)) continue;
    const msg = z ? `puts them ${z.into}` : `takes them out of ${zNow.label}`;
    if (!byMsg.has(msg)) byMsg.set(msg, []);
    byMsg.get(msg).push(res === 'win' ? 'a win' : res === 'level' ? 'a draw' : 'defeat');
  }
  const hints = [...byMsg].map(([msg, rs]) => `${cap1(rs.join(' or '))} ${msg}, for now.`);
  return hints.length ? ' ' + hints.join(' ') : '';
}

// Before the penalty die: who wins on which numbers.
export function pensLine(m) {
  const pens = R().pens, H = [], A = [];
  pens.forEach((e, k) => (e[0] === 'h' ? H : A).push(k + 1));
  const bit = (faces, id) => faces.length ? `${cap1(facePhrase(faces, 10))} and ${nameOf(id)} win it.` : '';
  return `Penalties! One roll on the penalty card. ${[bit(H, m.h), bit(A, m.a)].filter(Boolean).join(' ')}`;
}
