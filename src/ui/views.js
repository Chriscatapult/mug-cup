// The floor (home), the cup pages of the book, the almanac, and the drawer.
import { app, SPEEDS, allTeams } from './state.js';
import { esc, fmtDate } from './dom.js';
import { mugSVG, TROPHY } from './pieces.js';
import { bootHTML } from './cupmode.js';
import { seasonBookHTML } from './seasonmode.js';
import { nameOf, team } from '../engine/env.js';
import { plural, ordinal } from '../engine/util.js';
import * as C from '../engine/competition.js';
import * as SE from '../engine/season.js';
import { sheetFor } from '../engine/match.js';
import { rulesName } from '../engine/rules.js';
import { rulesPickerHTML, cardEditorHTML } from './rulespick.js';

const nm = id => esc(nameOf(id));

/* ---------- the floor ---------- */
export function homeHTML() {
  const cupOn = app.cup && app.cup.phase !== 'done', sOn = !!app.season;
  const carry = (cupOn || sOn) ? `<div class="carry">${cupOn ? `<button class="carry-card" data-act="go" data-v="mug" data-mode="cup"><span class="kicker">Carry on</span><strong>${esc(app.cup.name)}</strong><span>${esc(cupProgress())}</span></button>` : ''}
    ${sOn ? `<button class="carry-card" data-act="go" data-v="mug" data-mode="season"><span class="kicker">Carry on</span><strong>${esc(app.season.name)}</strong><span>${esc(seasonProgress())}</span></button>` : ''}</div>` : '';
  return `<div class="home">
    <div class="home-hero">
      <div class="home-mug">${mugSVG(8, 8)}</div>
      <div><h2 class="round-title">Write the slips. Fold them up. Into the mug.</h2>
      <p class="sub">One die for each team: <b>1 to 5</b> is how many they score, <b>a six</b> is a big fat nil. Level in a cup tie? More dice until somebody blinks. Everything else happens in your head.</p></div>
    </div>
    ${carry}
    <div class="modes">
      <div class="mode-card quick"><h3>Quick draw</h3><p>Sixty-four slips: this season's Champions League sides, Celtic and Rangers, and 26 more from anywhere at all. Straight knockout.</p><p class="xs">Dice: ${esc(rulesName({ dice: app.S.dice, mode: app.S.card, form: app.S.form }))}. <button class="linkish" data-act="go" data-v="drawer">Change</button></p><button class="btn big red" data-act="quick">Tip them in</button></div>
      <div class="mode-card"><h3>A cup</h3><p>Pick the slips, pick the format. Ready-made cups, or design your own monster stage by stage.</p><button class="btn big" data-act="go" data-v="cupsetup">Build a cup</button></div>
      <div class="mode-card"><h3>A season</h3><p>Every club into made-up regions, four shelves deep. Promotion, relegation, regional cups and a summer of world tournaments. Then do it all again.</p><button class="btn big" data-act="go" data-v="seasonsetup">Start a season</button></div>
    </div>
  </div>`;
}
function cupProgress() {
  const c = app.cup; if (!c) return '';
  if (c.phase === 'draw') return 'in the middle of a draw';
  const st = C.curStage(c), it = C.sitting(c), p = it.filter(x => x.m.done).length;
  return (st.type === 'groups' ? `matchday ${st.md + 1} of ${st.mdCount}` : C.curRound(c).name.replace(/^The /, 'the ')) + `, ${p} of ${it.length} rolled`;
}
function seasonProgress() {
  const s = app.season;
  if (s.phase === 'draw') return 'in the middle of the big draw';
  if (s.phase === 'pick') return 'picking your club';
  if (s.phase === 'end') return `the ${SE.seasonLabel(s.no)} season is over`;
  return `${SE.seasonLabel(s.no)}, ${SE.stepTitle(s).replace(/^The /, 'the ')}${s.my ? `, following ${nameOf(s.my)}` : ''}`;
}

/* ---------- the book ---------- */
let bookRegion = null;
export const setBookRegion = r => { bookRegion = r; };
export function bookHTML(which) {
  const hasCup = !!app.cup, hasSeason = !!app.season;
  if (!hasCup && !hasSeason) return `<div class="empty-state"><h2 class="round-title">A fresh exercise book</h2><p class="sub">Every group, every result and every shock gets written in here as you go.</p><p><button class="btn" data-act="go" data-v="home">Back to the floor</button></p></div>`;
  const show = which || (app.active === 'season' && hasSeason ? 'season' : hasCup ? 'cup' : 'season');
  const switcher = hasCup && hasSeason ? `<div class="chips mini book-switch"><button class="chip${show === 'cup' ? ' on' : ''}" data-act="bookshow" data-v="cup">${esc(app.cup.name)}</button><button class="chip${show === 'season' ? ' on' : ''}" data-act="bookshow" data-v="season">${esc(app.season.name)}</button></div>` : '';
  return switcher + (show === 'season' ? seasonBookHTML(bookRegion) : cupBookHTML());
}
function resultLine(m) {
  return `${nm(m.h)}<span class="sc2">${m.hs}–${m.as}</span>${nm(m.a)}${m.x && m.x.length ? ` <span class="xs">(extra dice ${m.x.map(p => p[0] + '–' + p[1]).join(', ')})</span>` : m.pk ? ` <span class="xs">(${nm(m.pk.w === 'h' ? m.h : m.a)} won ${m.pk.s} on penalties)</span>` : ''}`;
}
function scorersInline(m) {
  const s = l => (l || []).map(g => esc(g.p) + ' ' + g.m + "'").join(', ');
  const a = s(m.gh), b = s(m.ga);
  return a || b ? `<br><span class="xs">${a || 'nobody'}; ${b || 'nobody'}</span>` : '';
}
function cupTableHTML(g, cfg) {
  const tb = C.table(g, cfg.pts), complete = g.matches.length && g.matches.every(m => m.done);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>F</th><th>A</th><th>Pts</th></tr></thead><tbody>${tb.map((r, i) => `<tr class="${i < cfg.adv ? 'q' : ''}"><td>${nm(r.id)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.f}</td><td>${r.a}</td><td class="pts">${r.pts}</td></tr>`).join('')}</tbody></table></div>${complete ? '' : '<p class="note" style="font-size:14px;margin:4px 0 0">Still being played.</p>'}`;
}
function cupBookHTML() {
  const c = app.cup, all = C.allMatches(c).filter(m => m.done);
  let stats = '';
  if (all.length) {
    const big = all.slice().sort((a, b) => Math.abs(b.hs - b.as) - Math.abs(a.hs - a.as))[0];
    const most = all.slice().sort((a, b) => (b.hs + b.as) - (a.hs + a.as))[0];
    const g = all.reduce((s, m) => s + m.hs + m.as, 0);
    stats = `<p class="stats">${plural(all.length, 'match', 'matches')} rolled, ${plural(g, 'goal')} scored. Biggest win: ${resultLine(big)}. Most goals in a game: ${resultLine(most)}.</p>`;
  }
  const notes = c.notes.length ? `<aside class="sticky"><h4>Notes in the margin</h4><ul>${c.notes.slice().sort((a, b) => b.gap - a.gap).slice(0, 14).map(n => `<li>${esc(n.where)}: ${esc(n.text)} (${esc(n.score)})</li>`).join('')}</ul>${c.notes.length > 14 ? `<p style="margin:4px 0 0;font-size:15px">…and ${c.notes.length - 14} more shocks.</p>` : ''}</aside>` : '';
  let h = `<div class="round-head">${notes}<h2 class="round-title">The book of ${esc(c.name)}</h2>
    <p class="sub">Started ${fmtDate(c.created)}. ${c.size} teams.${c.champion ? ` Won by ${nm(c.champion)}.` : ''}</p>${stats}
    <p><button class="btn ghost small" data-act="wall">Pin up the wallchart</button></p></div>${bootHTML(all)}`;
  for (let si = c.stages.length - 1; si >= 0; si--) {
    const st = c.stages[si], cfg = c.cfg.stages[si]; if (!st) continue;
    if (st.type === 'ko') st.rounds.slice().reverse().forEach(r => {
      if (!r.ties.length) return;
      h += `<div class="book-sec"><h3>${esc(r.name)}</h3><ul class="results">${r.ties.map(t => {
        if (!t.a) return '';
        const played = t.matches.filter(m => m.done);
        if (!played.length) return `<li class="muted">${nm(t.h)} v ${nm(t.a)} <span class="xs">still to be rolled</span></li>`;
        const lines = played.map(m => `${m.kind === 'leg2' ? '<span class="xs">2nd leg:</span> ' : m.kind === 'replay' ? '<span class="xs">Replay:</span> ' : m.kind === 'leg1' ? '<span class="xs">1st leg:</span> ' : ''}${resultLine(m)}${scorersInline(m)}`).join('<br>');
        const out = t.w && played.length === t.matches.length && C.tieStatus(t, r) === 'done' ? ` <span class="xs">${nm(t.w)} through${t.mark === 'a' ? ' on away goals' : t.mark === '*' ? ' on extra dice' : t.mark === 'p' ? ' on penalties' : ''}</span>` : '';
        return `<li class="${played.some(m => m.shock) ? 'shock' : ''}">${lines}${out}</li>`;
      }).join('')}</ul>${r.byes.length ? `<p class="byes">Byes: ${r.byes.map(nm).join(', ')}.</p>` : ''}</div>`;
    });
    else if (st.groups[0].matches.length) {
      h += `<div class="book-sec"><h3>${esc(C.stageName(c, si))}: ${st.groups.length === 1 ? 'the league' : 'the groups'}</h3><div class="gtables${st.groups.length === 1 ? ' one' : ''}">${st.groups.map(g => `<div><h4 class="glabel" style="margin-top:6px">${g.name === 'The League' ? 'The League' : 'Group ' + g.name}</h4>${cupTableHTML(g, cfg)}<ul class="results">${g.matches.filter(m => m.done).slice(-60).map(m => `<li class="${m.shock ? 'shock' : ''}" style="font-size:16px">${resultLine(m)}</li>`).join('')}</ul></div>`).join('')}</div></div>`;
    }
  }
  if (c.leftIn && c.leftIn.length) h += `<div class="book-sec"><h3>Never came out of the mug</h3><p class="byes">${c.leftIn.map(nm).join(', ')}.</p></div>`;
  return h;
}

/* ---------- the almanac ---------- */
let almSort = 't', almClub = null;
export const setAlm = (sort, clubId) => { if (sort) almSort = sort; if (clubId !== undefined) almClub = clubId; };
// counts: how often each face came up. nil: the face to colour pink (the classic six).
function diceChart(counts, nil) {
  const n = counts.length, total = counts.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...counts, 1), exp = total / n;
  const W = 400, x0 = 60, span = W - x0 - 10, bw = Math.min(40, span / n - 8), gap = span / n - bw;
  let bars = '';
  counts.forEach((c, i) => {
    const h = c / mx * 120, x = x0 + i * (bw + gap), y = 140 - h;
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${i === nil ? '#f2b8ae' : n === 10 ? '#f4c6c0' : '#bcd3e6'}" stroke="#3b2d22" stroke-width="1.5" rx="2"/>
      <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="${n === 10 ? 10 : 13}" fill="#2b3d6d">${(c / total * 100).toFixed(n === 10 ? 0 : 1)}%</text>
      <text x="${x + bw / 2}" y="158" text-anchor="middle" font-size="15" fill="#3b2d22">${i + 1}</text>`;
  });
  const ey = 140 - exp / mx * 120;
  return `<svg class="dice-chart" viewBox="0 0 ${W} 170" role="img" aria-label="How often each face has come up">${bars}<line x1="14" x2="${W - 6}" y1="${ey}" y2="${ey}" stroke="#b73e36" stroke-width="1.5" stroke-dasharray="5 4"/><text x="16" y="${ey - 5}" font-size="12" fill="#b73e36">fair share</text></svg>`;
}
function clubCardHTML(H) {
  if (!almClub) return '';
  const c = H.clubs[almClub];
  if (!c) return '<p class="note">No games in the book for that club yet.</p>';
  const scorers = Object.entries(H.players).filter(([k]) => k.slice(k.lastIndexOf('|') + 1) === almClub).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const rivals = Object.entries(H.h2h).filter(([k]) => k.split('|').includes(almClub)).map(([k, r]) => {
    const [a, b] = k.split('|'), me = a === almClub, opp = me ? b : a;
    return { opp, w: me ? r[0] : r[2], d: r[1], l: me ? r[2] : r[0], n: r[0] + r[1] + r[2] };
  }).sort((a, b) => b.n - a.n).slice(0, 5);
  const f = app.S.follow.includes(almClub);
  return `<div class="club-card"><h4>${nm(almClub)}</h4>
    <p>Played ${c.p}, won ${c.w}, drawn ${c.d}, lost ${c.l}. Scored ${c.f}, let in ${c.a}.${c.up || c.down ? ` Promoted ${c.up === 1 ? 'once' : c.up + ' times'}, relegated ${c.down === 1 ? 'once' : c.down + ' times'}.` : ''}</p>
    <p>${c.t ? `${plural(c.t, 'trophy', 'trophies')}: ${esc(c.titles.slice(-8).join('; '))}.` : 'No trophies yet.'}${c.fin ? ` Runners-up ${c.fin === 1 ? 'once' : c.fin + ' times'}.` : ''}</p>
    <p>Average dice roll ${c.rolls ? (c.faces / c.rolls).toFixed(2) : '–'}.${c.big ? ` Biggest win: ${esc(c.big[1])}.` : ''}</p>
    ${c.last.length ? `<p>Last five: ${c.last.slice().reverse().map(esc).join('; ')}.</p>` : ''}
    ${scorers.length ? `<p>Top scorers: ${scorers.map(([k, n]) => esc(k.slice(0, k.lastIndexOf('|'))) + ' ' + n).join(', ')}.</p>` : ''}
    ${rivals.length ? `<p>Most-played opponents: ${rivals.map(r => `${nm(r.opp)} (won ${r.w}, drew ${r.d}, lost ${r.l})`).join('; ')}.</p>` : ''}
    <button class="btn ghost small" data-act="follow" data-id="${esc(almClub)}">${f ? '★ Following' : '☆ Follow them'}</button></div>`;
}
export function almanacHTML() {
  const H = app.H;
  const honours = honoursHTML();
  if (!H.matches) return `<div class="empty-state"><h2 class="round-title">The almanac</h2><p class="sub">Every match you roll goes into the record books: every club's wins and losses, every scorer's tally, every head-to-head, and how the dice have really been behaving.</p></div>${honours}`;
  const rolls = H.dice.reduce((a, b) => a + b, 0), d10 = H.dice10 || [], rolls10 = d10.reduce((a, b) => a + b, 0);
  const avgFace = rolls ? H.dice.reduce((s, c, i) => s + c * (i + 1), 0) / rolls : 0;
  const avg10 = rolls10 ? d10.reduce((s, c, i) => s + c * (i + 1), 0) / rolls10 : 0;
  const scores = Object.entries(H.scores).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const clubs = Object.entries(H.clubs).filter(([id]) => team(id)).map(([id, c]) => ({ id, ...c, pct: c.p ? c.w / c.p : 0, avg: c.rolls ? c.faces / c.rolls : 0 }));
  const sorters = { t: (a, b) => b.t - a.t || b.fin - a.fin || b.w - a.w, w: (a, b) => b.w - a.w, f: (a, b) => b.f - a.f, pct: (a, b) => b.pct - a.pct, avg: (a, b) => b.avg - a.avg, up: (a, b) => b.up - a.up || a.down - b.down, p: (a, b) => b.p - a.p };
  const list = clubs.filter(c => (almSort === 'pct' || almSort === 'avg') ? c.p >= 5 : true).sort(sorters[almSort]).slice(0, 40);
  const players = Object.entries(H.players).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const chip = (k, l) => `<button class="chip${almSort === k ? ' on' : ''}" data-act="almsort" data-v="${k}">${l}</button>`;
  return `<div class="round-head"><h2 class="round-title">The almanac</h2>
    <p class="sub">${[H.tours ? plural(H.tours, 'cup') : '', H.seasons ? plural(H.seasons, 'season') : ''].filter(Boolean).join(' and ') || 'Nothing'} finished, ${plural(H.matches, 'match', 'matches')} rolled, ${plural(H.goals, 'goal')} (${(H.goals / H.matches).toFixed(2)} a game), ${plural(rolls + rolls10, 'die', 'dice')} thrown.</p></div>
    <div class="alm-grid">
      ${rolls ? `<div class="alm-card"><h3>How the six-sided dice have behaved</h3>${diceChart(H.dice, 5)}<p class="note" style="margin:0">Average roll ${avgFace.toFixed(2)}, against a fair 3.50. Sixes, the nils, are in pink.</p></div>` : ''}
      ${rolls10 ? `<div class="alm-card"><h3>How the ten-sided dice have behaved</h3>${diceChart(H.dice10, -1)}<p class="note" style="margin:0">Average roll ${avg10.toFixed(2)}, against a fair 5.50.${H.pens ? ` ${plural(H.pens, 'cup tie')} settled on penalties.` : ''}</p></div>` : ''}
      <div class="alm-card"><h3>Most common scores</h3><ul class="results">${scores.map(([s, c]) => `<li><span class="sc2">${s}</span> <span class="xs">${plural(c, 'time')}</span></li>`).join('')}</ul></div>
    </div>
    <div class="book-sec"><h3>Look up a club</h3><div class="sheet-row"><input id="almClub" list="almlist" placeholder="type a club…" aria-label="Club" value="${almClub ? esc(nameOf(almClub)) : ''}"><datalist id="almlist">${clubs.map(c => `<option value="${esc(nameOf(c.id))}">`).join('')}</datalist></div><div id="clubCard">${clubCardHTML(H)}</div></div>
    <div class="book-sec"><h3>The clubs</h3><div class="chips mini">${chip('t', 'Trophies')}${chip('w', 'Wins')}${chip('f', 'Goals')}${chip('pct', 'Win rate')}${chip('avg', 'Luckiest dice')}${chip('up', 'Promotions')}${chip('p', 'Most games')}</div>
      <div class="tbl-wrap"><table class="tbl alm"><thead><tr><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>F</th><th>A</th><th title="Trophies">🏆</th><th title="Promotions">Up</th><th title="Average dice roll">Avg roll</th></tr></thead>
      <tbody>${list.map(c => `<tr><td><button class="linkish" data-act="almclub" data-id="${esc(c.id)}">${nm(c.id)}</button></td><td>${c.p}</td><td>${c.w}</td><td>${c.d}</td><td>${c.l}</td><td>${c.f}</td><td>${c.a}</td><td class="pts">${c.t}</td><td>${c.up}</td><td>${c.avg.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="book-sec"><h3>All-time top scorers</h3><ul class="results">${players.map(([k, n]) => { const i = k.lastIndexOf('|'); return `<li>${esc(k.slice(0, i))} <span class="xs">(${nm(k.slice(i + 1))})</span><span class="sc2">${n}</span></li>`; }).join('')}</ul></div>
    ${honours}
    <p style="margin-top:28px"><button class="btn ghost small" data-act="clearalm">Start the almanac again</button></p>`;
}
export const clubCard = () => clubCardHTML(app.H);
function honoursHTML() {
  const hon = app.honours;
  if (!hon.length) return '<div class="book-sec"><h3>The honours board</h3><p class="note">Nobody\'s lifted anything yet.</p></div>';
  const cols = ['#e4b54f', '#bcd3e6', '#f2b8ae', '#c9dcc4'];
  const rosette = c => `<svg viewBox="0 0 52 60" width="44" aria-hidden="true"><path d="M18 34l-6 24 9-5 5 7 3-24M34 34l6 24-9-5-5 7-3-24" fill="${c}" stroke="#3b2d22" stroke-width="1.5"/><circle cx="26" cy="22" r="19" fill="${c}" stroke="#3b2d22" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="26" cy="22" r="11" fill="#fffdf6" stroke="#3b2d22" stroke-width="1.5"/><text x="26" y="27" text-anchor="middle" font-family="Caveat,cursive" font-size="14" font-weight="700" fill="#b73e36">1st</text></svg>`;
  return `<div class="book-sec"><h3>The honours board</h3><ul class="honours">${hon.map((x, i) => `<li>${rosette(cols[i % 4])}<div><div class="who">${esc(x.kind === 'season' ? x.name : x.champ)}</div><div class="what">${x.kind === 'season' ? `${esc(x.score)}.${x.my ? ` <br>${esc(x.my)}` : ''}` : `${esc(x.name)}, ${fmtDate(x.date)}. ${x.size} teams. ${esc(x.score)}.${x.boot ? ` Golden boot: ${esc(x.boot)}.` : ''}${x.shocks ? ` ${plural(x.shocks, 'shock')} along the way.` : ''}`}</div>${x.chart ? `<button class="btn ghost small" style="margin-top:6px" data-act="hchart" data-i="${i}">See the wallchart</button>` : ''}</div></li>`).join('')}</ul>
    <p><button class="btn ghost small" data-act="clearhon">Rub out the honours board</button></p></div>`;
}

/* ---------- the drawer ---------- */
let sheetId = null;
export const setSheet = id => { sheetId = id; };
export function sheetEdHTML() {
  if (!sheetId || !team(sheetId)) return '';
  const t = team(sheetId), { list, legends } = sheetFor(sheetId), own = app.S.squads[sheetId], f = app.S.follow.includes(sheetId);
  return `<div class="sheet-ed"><p class="note" style="margin:0 0 6px">${own ? 'Your own team sheet. Names near the top score more often.' : `${list.length} names, strikers most likely to score${legends.length ? `, plus legends who might pop up: ${esc(legends.join(', '))}` : ''}. Write your own to replace them, one per line.`}</p>
    <textarea id="sheetText" aria-label="Players for ${esc(t.n)}">${esc((own || list.map(x => x.n)).join('\n'))}</textarea>
    <div class="row"><button class="btn small" data-act="savesheet">Save ${esc(t.n)}'s sheet</button>${own ? '<button class="btn ghost small" data-act="resetsheet">Put the original names back</button>' : ''}
    <button class="btn ghost small" data-act="follow" data-id="${esc(sheetId)}">${f ? '★ Following' : '☆ Follow them'}</button><span id="sheetMsg" class="pen" style="font-size:21px;color:var(--green)"></span></div></div>`;
}
export function drawerHTML() {
  const follows = app.S.follow.filter(id => team(id));
  return `<div class="round-head"><h2 class="round-title">The drawer</h2><p class="sub">Everything that isn't the mug or the book.</p></div>
    <div class="book-sec"><h3>The dice rules</h3><p class="note">Used for every new cup, season and quick draw. Anything already on the go keeps the rules it started with.</p>${rulesPickerHTML()}</div>
    <div class="book-sec"><h3>Your own results card</h3>${cardEditorHTML()}</div>
    <div class="book-sec"><h3>How you play</h3>
      <div class="choices">
        <button class="choice${!app.S.shortcuts ? ' on' : ''}" data-act="shortcuts" data-v="0"><strong>All by hand</strong><span>Press and hold the mug to rummage, let go to pull. Press and hold a die to shake it, let go to throw.</span></button>
        <button class="choice${app.S.shortcuts ? ' on' : ''}" data-act="shortcuts" data-v="1"><strong>By hand, with shortcuts</strong><span>Everything above, plus buttons and keys to pull, roll a whole match or roll the lot.</span></button></div>
      <p class="note" style="margin-top:16px">How long the dice tumble and the slips take to unfold:</p>
      <div class="chips">${Object.entries(SPEEDS).map(([k, v]) => `<button class="chip${app.S.speed === k ? ' on' : ''}" data-act="speed" data-v="${k}">${v.label}</button>`).join('')}</div></div>
    <div class="book-sec"><h3>Team sheets and the clubs you follow</h3>
      <p class="note">Goals come from each team's sheet. Real clubs have their real squads, strikers first, with the odd legend from the past popping up. Lower-league clubs get made-up locals until you write in your own.</p>
      <div class="sheet-row"><input id="sheetTeam" list="teamlist" placeholder="pick a team…" aria-label="Team" value="${sheetId && team(sheetId) ? esc(team(sheetId).n) : ''}"><datalist id="teamlist">${allTeams().map(t => `<option value="${esc(t.n)}">`).join('')}</datalist></div>
      <div id="sheetEd">${sheetEdHTML()}</div>
      ${follows.length ? `<p class="note" style="margin-top:14px">Following: ${follows.map(id => `<button class="slip-chip" data-act="follow" data-id="${esc(id)}" title="Stop following">★ ${nm(id)}</button>`).join(' ')}</p>` : ''}</div>
    <div class="book-sec"><h3>Save &amp; share</h3>
      <p><button class="btn small" data-act="export">Save everything to a file</button><br><span class="xs">Slips, team sheets, the cup and the season on the go, the honours board and the almanac, in one file.</span></p>
      <p><button class="btn ghost small" data-act="import">Load a save file</button><input type="file" id="importFile" accept=".json,application/json" hidden><br><span class="xs">This replaces what's on this device with what's in the file.</span></p>
      ${app.cup ? '<p><button class="btn ghost small" data-act="copyres">Copy the cup results as text</button></p>' : ''}
      <p id="drawerMsg" class="pen" style="font-size:22px;color:var(--green);min-height:1em;margin:0"></p></div>
    <div class="book-sec"><h3>Where the slips come from</h3><p class="note">Clubs, grounds and squads from the Transfermarkt dataset (CC0 1.0), built ${esc(app.data.built || '')}. Lower leagues and legends written by hand. Everything you play is kept in this browser.</p></div>`;
}
