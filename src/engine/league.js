// A league: everyone plays everyone, home and away.
import { roundRobin, table as groupTable } from './competition.js';
import { rand, shuffle } from './util.js';

export function createLeague(teamIds, legs = 2) {
  const teams = shuffle(teamIds.slice());
  const lots = {}; teams.forEach(id => { lots[id] = rand(); });
  const matches = roundRobin(teams, legs);
  matches.forEach(m => { m.kind = 'league'; });
  const mdCount = matches.reduce((mx, m) => Math.max(mx, m.md + 1), 0);
  return { teams, matches, lots, mdCount };
}
export const leagueTable = (lg, pts = 3) => groupTable({ teams: lg.teams, matches: lg.matches, lots: lg.lots }, pts);
export const mdMatches = (lg, md) => lg.matches.filter(m => m.md === md);
export const position = (tb, id) => tb.findIndex(r => r.id === id) + 1;

// zones: [{ upTo: 2, name: 'promotion' }, ...] positions 1..upTo, and { from: 7, name: 'relegation' } positions from..end
export function zoneOf(pos, size, zones) {
  for (const z of zones) {
    if (z.upTo && pos <= z.upTo && (!z.from || pos >= z.from)) return z;
    if (z.from && !z.upTo && pos >= z.from) return z;
  }
  return null;
}
// Lines on the table someone can cross: after position k.
function lines(size, zones) {
  const set = new Set();
  zones.forEach(z => { if (z.upTo && z.upTo < size) set.add(z.upTo); if (z.from && z.from > 1) set.add(z.from - 1); });
  return [...set];
}
// Is a team close enough to a line, with games left, for this match to matter?
export function inContention(tb, id, gamesLeft, zones) {
  const pos = position(tb, id), me = tb[pos - 1], size = tb.length;
  return lines(size, zones).some(k => {
    const other = pos <= k ? tb[k] : tb[k - 1];        // the team just across the line
    return other && Math.abs(me.pts - other.pts) <= 3 * gamesLeft;
  });
}
export function leaguePivot(lg, m, zones, lastFew = 3) {
  const left = lg.mdCount - m.md;                      // including this one
  if (left > lastFew) return '';
  const tb = leagueTable(lg);
  const hot = [m.h, m.a].filter(id => inContention(tb, id, left, zones));
  if (!hot.length) return '';
  return left === 1 ? 'the final day' : 'the run-in';
}
