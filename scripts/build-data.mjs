// Builds data/teams.json and data/squads.json from:
//   data-raw/clubs.csv and data-raw/players.csv  (Transfermarkt dataset, CC0 1.0)
//   scripts/hand-clubs.txt                        (lower leagues and extras, written by hand)
//   scripts/hand-legends.txt                      (famous names, past and present)
// Run with:  npm run data
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { readCSV } from './csv.mjs';
import { cleanName, key } from './names.mjs';

const CURRENT = '2025';
const COUNTRY = {
  GB1: 'England', SC1: 'Scotland', ES1: 'Spain', L1: 'Germany', IT1: 'Italy', FR1: 'France',
  NL1: 'Netherlands', PO1: 'Portugal', BE1: 'Belgium', TR1: 'Turkey', GR1: 'Greece', DK1: 'Denmark',
  SE1: 'Sweden', NO1: 'Norway', PL1: 'Poland', A1: 'Austria', C1: 'Switzerland', KR1: 'Croatia',
  SER1: 'Serbia', RO1: 'Romania', UKR1: 'Ukraine', RU1: 'Russia', TS1: 'Czechia',
  ARG1: 'Argentina', BRA1: 'Brazil', COL1: 'Colombia', MEX1: 'Mexico', MLS1: 'USA & Canada',
  JAP1: 'Japan', RSK1: 'South Korea', SA1: 'Saudi Arabia', AUS1: 'Australia & NZ',
};
const PACKET_OF_COMP = c =>
  c === 'GB1' ? 'pl' : c === 'SC1' ? 'sco' :
  ['ES1', 'L1', 'IT1', 'FR1'].includes(c) ? 'big5' :
  ['ARG1', 'BRA1', 'COL1', 'MEX1', 'MLS1'].includes(c) ? 'amer' :
  ['JAP1', 'RSK1', 'SA1', 'AUS1'].includes(c) ? 'asia' : 'euro';
const PACKETS = [
  { id: 'pl', name: 'The Premier League', sub: 'The top flight in England' },
  { id: 'efl', name: 'The Football League', sub: 'Championship, League One and League Two' },
  { id: 'sco', name: 'Scotland', sub: 'The Premiership and all the way down' },
  { id: 'wal', name: 'Wales', sub: 'Swansea, Wrexham and the Cymru Premier' },
  { id: 'nl', name: 'English non-league', sub: 'Old Football League names and proper romance' },
  { id: 'ire', name: 'Ireland, north & south', sub: 'The Irish League and the League of Ireland' },
  { id: 'big5', name: 'The big four of Europe', sub: 'Spain, Germany, Italy and France' },
  { id: 'euro', name: 'The rest of Europe', sub: 'From Lisbon to Kyiv' },
  { id: 'amer', name: 'The Americas', sub: 'Brazil, Argentina, Mexico, Colombia and MLS' },
  { id: 'asia', name: 'Asia & Oceania', sub: 'Japan, Korea, Saudi Arabia and the A-League' },
];
const HAND_PACKET = { eng: 'efl', sco: 'sco', wal: 'wal', nl: 'nl', ire: 'ire', euro: 'euro' };
const HAND_COUNTRY = { eng: 'England', sco: 'Scotland', wal: 'Wales', nl: 'England', ire: 'Ireland', euro: 'Europe' };

const slug = s => s.toLowerCase().replace(/[øö]/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const groundName = s => {
  s = (s || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return /(Stadium|Arena|Stadion|Ground|Park Stadium)$/i.test(s) || /^(Stadio|Estadio|Estádio|Stade)\b/i.test(s) ? 'the ' + s : s;
};

const clubs = readCSV('data-raw/clubs.csv');
const players = readCSV('data-raw/players.csv');
console.log(`read ${clubs.length} clubs, ${players.length} players`);

// ---- players grouped by their (last) club ----
const byClub = new Map();
for (const p of players) {
  if (!p.current_club_id) continue;
  if (!byClub.has(p.current_club_id)) byClub.set(p.current_club_id, []);
  byClub.get(p.current_club_id).push(p);
}
const POS = { Attack: 'A', Midfield: 'M', Defender: 'D', Goalkeeper: 'G' };
const shortName = p => (p.last_name || p.name || '').trim();
function squadOf(clubId, season) {
  const ps = (byClub.get(clubId) || []).filter(p => p.last_season === season)
    .sort((a, b) => (+b.market_value_in_eur || 0) - (+a.market_value_in_eur || 0)).slice(0, 24);
  const counts = {};
  ps.forEach(p => { const s = shortName(p); counts[s] = (counts[s] || 0) + 1; });
  return ps.map(p => [counts[shortName(p)] > 1 ? p.name.trim() : shortName(p), POS[p.position] || 'M']).filter(x => x[0]);
}
function squadValue(clubId) {
  return (byClub.get(clubId) || []).filter(p => p.last_season === CURRENT)
    .map(p => +p.market_value_in_eur || 0).sort((a, b) => b - a).slice(0, 18).reduce((s, v) => s + v, 0);
}
function dataLegends(clubId) {
  return (byClub.get(clubId) || []).filter(p => p.last_season < CURRENT && (+p.highest_market_value_in_eur || 0) >= 15e6)
    .sort((a, b) => (+b.highest_market_value_in_eur) - (+a.highest_market_value_in_eur)).slice(0, 4).map(shortName);
}

const plain = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function mergeLegends(hand, data, squad) {
  const now = new Set(squad.map(x => plain(x[0])));
  const out = [];
  for (const n of [...(hand || []), ...data]) {
    const p = plain(n);
    if (now.has(p) || [...now].some(x => x.startsWith(p) || p.startsWith(x)) || out.some(o => plain(o) === p)) continue;
    out.push(n);
  }
  return out.slice(0, 8);
}

// ---- hand legends ----
const handLegends = {};
readFileSync('scripts/hand-legends.txt', 'utf8').split('\n').forEach(l => {
  l = l.trim(); if (!l || l.startsWith('#')) return;
  const i = l.indexOf(':'); handLegends[key(l.slice(0, i))] = l.slice(i + 1).split(',').map(s => s.trim()).filter(Boolean);
});

// ---- data clubs ----
const teams = [], squads = {}, seen = new Map();
const dataByKey = new Map();
clubs.forEach(c => {
  const k = key(cleanName(c.name, c.club_code));
  const prev = dataByKey.get(k);
  if (!prev || c.last_season > prev.last_season) dataByKey.set(k, c);
});
const current = clubs.filter(c => c.last_season === CURRENT);
const ranked = current.map(c => ({ c, v: squadValue(c.club_id) })).sort((a, b) => b.v - a.v);
const tierOfRank = r => r < 24 ? 1 : r < 70 ? 2 : r < 170 ? 3 : r < 330 ? 4 : 5;
ranked.forEach(({ c }, r) => {
  const name = cleanName(c.name, c.club_code), k = key(name);
  if (seen.has(k)) return;
  const id = slug(name);
  teams.push({ id, n: name, g: groundName(c.stadium_name), t: tierOfRank(r), p: PACKET_OF_COMP(c.domestic_competition_id), c: COUNTRY[c.domestic_competition_id] || '' });
  seen.set(k, id);
  const s = squadOf(c.club_id, CURRENT);
  squads[id] = { s, l: mergeLegends(handLegends[k], dataLegends(c.club_id), s) };
});

// ---- hand clubs ----
let packet = null, handAdded = 0, enriched = 0;
readFileSync('scripts/hand-clubs.txt', 'utf8').split('\n').forEach(line => {
  line = line.trim();
  const m = line.match(/^# packet (\w+)/);
  if (m) { packet = m[1]; return; }
  if (!line || line.startsWith('#')) return;
  const [t, n, g] = line.split('|'); const name = n.trim(), k = key(name);
  if (seen.has(k)) return;                       // the data already has this club
  const hand = +t || 5;
  const tier = packet === 'euro' ? hand : hand === 1 ? 2 : Math.min(5, hand + 1);
  const id = slug(name);
  teams.push({ id, n: name, g: (g || '').trim(), t: tier, p: HAND_PACKET[packet], c: HAND_COUNTRY[packet] });
  seen.set(k, id); handAdded++;
  const dc = dataByKey.get(k);
  const sq = { s: [], l: [] };
  if (dc) {
    if (dc.last_season >= '2023') sq.s = squadOf(dc.club_id, dc.last_season);
    sq.l = dataLegends(dc.club_id);
    if (sq.s.length) enriched++;
  }
  sq.l = mergeLegends(handLegends[k], sq.l, sq.s);
  if (sq.s.length || sq.l.length) squads[id] = sq;
});

mkdirSync('data', { recursive: true });
writeFileSync('data/teams.json', JSON.stringify({ built: new Date().toISOString().slice(0, 10), packets: PACKETS, teams }));
writeFileSync('data/squads.json', JSON.stringify(squads));
const counts = {}; teams.forEach(t => counts[t.p] = (counts[t.p] || 0) + 1);
console.log(`wrote ${teams.length} teams (${handAdded} hand-written, ${enriched} of those with real squads)`, counts);
console.log('tier counts', [1, 2, 3, 4, 5].map(t => teams.filter(x => x.t === t).length));
