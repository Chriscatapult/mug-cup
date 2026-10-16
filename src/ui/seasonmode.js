// Season mode: regions, shelves, regional cups and the summer's world tournaments.
import { app, saveS, saveSeason, saveH, saveHonours, available, allTeams } from './state.js';
import { esc } from './dom.js';
import { packetsHTML } from './packets.js';
import { compProvider, compSession, compCtx } from './comp.js';
import { pickFeatured, isFollowedMatch } from './play.js';
import { winnersHTML } from './cupmode.js';
import { mugSVG, confettiHTML, TROPHY } from './pieces.js';
import { nameOf, groundOf, team } from '../engine/env.js';
import { plural, ordinal, cap } from '../engine/util.js';
import * as C from '../engine/competition.js';
import * as SE from '../engine/season.js';
import { leagueTable } from '../engine/league.js';
import { recordMatch, recordTrophy, recordMove, goldenBoot } from '../engine/almanac.js';

const nm = id => esc(nameOf(id));
const s_ = () => app.season;
const label = () => SE.seasonLabel(s_().no);

/* ---------- setup ---------- */
export function seasonSetupHTML() {
  if (!app.S.sPools) app.S.sPools = app.data.packets.map(p => p.id);
  const n = available(app.S.sPools).length, need = SE.teamsNeeded(app.S.sRegions);
  let h = '';
  if (app.season) h += `<div class="resume tape"><p><b>${esc(app.season.name)}</b> is on the go: ${esc(SE.seasonLabel(app.season.no))}.</p><button class="btn" data-act="go" data-v="mug" data-mode="season">Carry on with it</button></div>`;
  h += `<p class="kicker">Season</p><h2 class="round-title">Start a season</h2>
    <p class="sub">Every club drawn out of the mug into made-up regions, four shelves deep. Eight clubs on a shelf, home and away, fourteen games. Two up, two down. A regional cup for everyone in the region. Then a summer of world tournaments: the top two from each Top Shelf go into the World Championship, third and fourth into the World Shield, and the regional cup winners into the World Cup Winners' Cup.</p>`;
  h += `<h2 class="step"><span class="num">1</span>Give it a name</h2><input id="sname" class="line-input" value="${esc(app.S.sName)}" maxlength="60" aria-label="Season name">`;
  h += `<h2 class="step"><span class="num">2</span>How big a world?</h2><div class="choices">
    ${[[16, 'Sixteen regions', '512 clubs. About 4,200 matches a season. The full thing.'], [8, 'Eight regions', '256 clubs. About 2,100 matches a season.'], [4, 'Four regions', '128 clubs. A season you could finish on a wet Sunday.']].map(([r, t, d]) => `<button class="choice${app.S.sRegions === r ? ' on' : ''}" data-act="sregions" data-v="${r}"><strong>${t}</strong><span>${d}</span></button>`).join('')}</div>`;
  h += `<h2 class="step"><span class="num">3</span>How are they shared out?</h2><div class="choices">
    <button class="choice${!app.S.sSeeded ? ' on' : ''}" data-act="sseeded" data-v="0"><strong>Totally random</strong><span>Real Madrid could start Under the Bed. Albion Rovers could start on the Top Shelf. Anything goes.</span></button>
    <button class="choice${app.S.sSeeded ? ' on' : ''}" data-act="sseeded" data-v="1"><strong>Big clubs on the top shelf</strong><span>Four pots by size. The giants start at the top and the minnows at the bottom, then it's up to the dice.</span></button></div>`;
  h += `<h2 class="step"><span class="num">4</span>Write out the slips</h2><p class="note">You need at least ${need} slips. If there are more, ${need} come out of the mug and the rest stay in.</p>${packetsHTML('sPools')}`;
  h += `<div class="start-bar"><p>${plural(n, 'slip')} written. ${n >= need ? `${need} will come out of the mug.` : `That's ${need - n} short.`}</p>
    <button class="btn big red" data-act="startseason" ${n >= need ? '' : 'disabled'}>Into the mug with them</button></div>`;
  if (app.season) h += `<p class="note" style="margin-top:10px">Starting a new season world throws away the one you've got.</p>`;
  return h;
}
export function startSeasonDraw() {
  const ids = available(app.S.sPools).map(t => t.id);
  app.season = SE.createSeasonDraw({ teamIds: ids, regions: app.S.sRegions, seeded: app.S.sSeeded, name: app.S.sName.trim() || 'The Mug League' });
  app.active = 'season'; saveSeason();
}

/* ---------- the big draw ---------- */
function regionCard(r) {
  const s = s_(), rg = s.regions[r];
  return `<div class="rcard" id="rg-${r}"><h3>${esc(rg.name)}</h3>${rg.divs.map((dv, d) => dv.teams.length || SE.shelfBeingDrawn(s) === d ? `<p class="shelf-h">${SE.SHELVES[d]}</p><ol>${dv.teams.map(id => `<li class="filled">${nm(id)}</li>`).join('')}${dv.teams.length < 8 ? `<li class="empty">${8 - dv.teams.length} to come</li>` : ''}</ol>` : '').join('')}</div>`;
}
export function seasonDrawProvider(render) {
  const s = s_();
  return {
    get title() { return `${s.name}: the big draw`; },
    get sub() {
      const d = SE.shelfBeingDrawn(s);
      return s.draw.pots ? `Pot ${d + 1} is in the mug, and every slip in it goes onto ${SE.SHELVES[d].replace(/^The /, 'the ')} of one of the ${s.regionCount} regions.` : `${s.draw.need} slips, ${s.regionCount} regions, four shelves each. They go out region by region, ${SE.SHELVES[d].replace(/^The /, 'the ')} first, then down the shelves.`;
    },
    left: () => s.mug.length, start: () => s.draw.pots ? s.draw.need / 4 : s.draw.need + s.draw.unused,
    need: () => s.draw.need, doneCount: () => s.draw.done, done: () => SE.seasonDrawDone(s), mugIds: () => s.mug,
    pull(chosen) {
      const res = SE.seasonPull(s, chosen); saveSeason();
      return { id: res.id, dest: 'rg-' + res.r, after: `${s.regions[res.r].name}, ${SE.SHELVES[res.d]}` };
    },
    destHTML: () => `<div class="rcards">${s.regions.map((_, r) => regionCard(r)).join('')}</div>`,
    destRowHTML: dest => regionCard(+dest.slice(3)),
    tip() { SE.seasonTip(s); saveSeason(); },
    finish() { s.phase = 'pick'; saveSeason(); render(); },
    finishLabel: 'Now pull out your club',
    leftovers: () => s.mug.length ? `<p class="leftovers">${plural(s.mug.length, 'slip')} stayed in the mug this time.</p>` : '',
  };
}

/* ---------- picking your club ---------- */
export function pickHTML() {
  const s = s_(), c = s.pickCandidate;
  const all = s.regions.flatMap(rg => rg.divs.flatMap(dv => dv.teams));
  const w = c ? SE.whereIs(s, c) : null;
  return `<div class="round-head"><h2 class="round-title">Now pull out your club</h2>
    <p class="sub">Every slip goes back in the mug. Close your eyes and pull one out: that's who you're following this season. You'll throw the dice for their matches and see their shelf's table as you go.</p></div>
    <div class="draw-layout"><div class="mug-col">
      <p class="caption${c ? ' on' : ''}" id="caption">${c ? 'Your club is…' : ''}</p>
      <div class="mug-stage" data-grab="mug" role="button" tabindex="0" aria-label="Pull out your club">${mugSVG(all.length, all.length)}<div class="slip-reveal" id="slip"></div></div>
      <p class="hint">Press and hold the mug, then let go.</p>
    </div><div class="dest-col">
      ${c ? `<div class="pick-card"><p class="kicker">Your club</p><h3>${nm(c)}</h3><p>${esc(s.regions[w.r].name)}, ${SE.SHELVES[w.d]}</p>
        <p><button class="btn big red" data-act="keepclub">Keep them</button> <button class="btn ghost" data-act="againclub">Put them back and pull again</button></p></div>` : ''}
      <p class="note" style="margin-top:22px">Or pick one yourself:</p>
      <div class="sheet-row"><input id="pickIn" list="picklist" placeholder="type a club…" aria-label="Choose your club"><datalist id="picklist">${all.map(id => `<option value="${esc(nameOf(id))}">`).join('')}</datalist><button class="btn small" data-act="pickchosen">That one</button></div>
    </div></div>`;
}
export function pickRandomClub() {
  const s = s_(), all = s.regions.flatMap(rg => rg.divs.flatMap(dv => dv.teams));
  s.pickCandidate = all[Math.floor(Math.random() * all.length)];
  saveSeason();
  return s.pickCandidate;
}
export function keepClub(id) {
  const s = s_(); s.my = id || s.pickCandidate; s.pickCandidate = null;
  if (!app.S.follow.includes(s.my)) { app.S.follow.push(s.my); saveS(); }
  SE.beginSeason(s); saveSeason();
}

/* ---------- the calendar strip ---------- */
function calendarHTML() {
  const s = s_();
  return `<div class="calendar" aria-label="The season so far">${s.calendar.map((st, i) => {
    const cls = i < s.step ? 'past' : i === s.step ? 'now' : '';
    const t = st.k === 'league' ? st.md + 1 : st.k === 'cup' ? 'Cup' : st.k === 'world' ? { champ: 'WC', shield: 'WS', cwc: 'CWC' }[st.which] : '★';
    const title = st.k === 'league' ? `Matchday ${st.md + 1}` : st.k === 'cup' ? `Regional cup round ${st.round}` : st.k === 'world' ? SE.WORLD[st.which].name : 'End of season';
    return `<span class="cal ${st.k} ${cls}" title="${esc(title)}">${t}</span>`;
  }).join('')}</div>`;
}
function zoneClass(d, i, size) {
  if (d === 0 && i < 2) return 'z-champ';
  if (d === 0 && i < 4) return 'z-shield';
  if (d > 0 && i < 2) return 'z-up';
  if (d < 3 && i >= size - 2) return 'z-down';
  return '';
}
export function shelfTableHTML(r, d, highlight, compact) {
  const s = s_(), tb = leagueTable(s.regions[r].divs[d].league);
  return `<table class="tbl shelf${compact ? ' compact' : ''}"><thead><tr><th>${compact ? '' : 'Team'}</th><th>P</th>${compact ? '' : '<th>W</th><th>D</th><th>L</th>'}<th>F</th><th>A</th><th>Pts</th></tr></thead><tbody>${tb.map((row, i) => `<tr class="${zoneClass(d, i, tb.length)}${row.id === highlight ? ' me' : ''}"><td>${i + 1}. ${nm(row.id)}</td><td>${row.p}</td>${compact ? '' : `<td>${row.w}</td><td>${row.d}</td><td>${row.l}</td>`}<td>${row.f}</td><td>${row.a}</td><td class="pts">${row.pts}</td></tr>`).join('')}</tbody></table>`;
}
const zoneKey = d => `<p class="zone-key">${d === 0 ? '<span class="z-champ">World Championship</span> <span class="z-shield">World Shield</span>' : '<span class="z-up">Going up</span>'}${d < 3 ? ' <span class="z-down">Going down</span>' : ''}</p>`;

/* ---------- the run: sessions for each kind of step ---------- */
function onMatch(it, note) {
  const s = s_();
  if (note) { s.notes.push(note); if (s.notes.length > 300) s.notes.shift(); }
  recordMatch(app.H, it.m); saveH(); saveSeason();
}
function afterAdvance() {
  const s = s_();
  if (s.phase === 'end' && s.summary && !s.summary.recorded) recordSeasonEnd(s);
}
function recordSeasonEnd(s) {
  const L = label();
  s.regions.forEach((rg, r) => {
    const sum = s.summary.regions[r];
    sum.shelves.forEach((rows, d) => {
      recordTrophy(app.H, rows[0][0], `${SE.SHELVES[d]} champions, ${rg.name} ${L}`, rows[1][0]);
      if (d > 0) rows.slice(0, 2).forEach(x => recordMove(app.H, x[0], 1));
      if (d < 3) rows.slice(-2).forEach(x => recordMove(app.H, x[0], -1));
    });
    if (rg.cup.champion) recordTrophy(app.H, rg.cup.champion, `${rg.cup.name} ${L}`, rg.cup.runner);
  });
  app.H.seasons++;
  saveH();
  const my = s.summary.my, w = s.summary.world;
  app.honours.unshift({ kind: 'season', name: `${s.name} ${L}`, date: Date.now(),
    champ: w.champ ? nameOf(w.champ.champ) : '', score: [w.champ && `World Championship: ${nameOf(w.champ.champ)}`, w.shield && `World Shield: ${nameOf(w.shield.champ)}`, w.cwc && `Cup Winners' Cup: ${nameOf(w.cwc.champ)}`].filter(Boolean).join('. '),
    my: my ? storyLine(my) : '' });
  app.honours = app.honours.slice(0, 300);
  saveHonours();
  s.summary.recorded = true; saveSeason();
}
export function storyLine(my) {
  const shelf = my.shelf.replace(/^The /, 'the ');
  const fin = my.champions ? `won ${shelf}` : `finished ${ordinal(my.pos)} on ${shelf}`;
  const moved = my.moved === 'promoted' ? ' and went up' : my.moved === 'relegated' ? ' and went down' : '';
  const cup = my.cupRun === 'won the cup' ? ', and won the regional cup' : `. In the cup they ${my.cupRun === 'went out early' ? 'went out early' : 'went ' + my.cupRun}`;
  const world = my.world.map(w => `${w.won ? 'won' : w.runner ? 'were runners-up in' : 'played in'} the ${SE.WORLD[w.k].short}`).join(' and ');
  return `${nameOf(my.id)} ${fin} in ${my.region}${moved}${cup}${world ? `. They ${world}` : ''}.`;
}
function leagueSession(render) {
  const s = s_(), my = SE.whereIs(s, s.my) || { r: 0, d: 0 };
  const key = `L${s.no}-${s.step}`;
  const items = () => SE.stepItems(s);
  const myDiv = it => it.r === my.r && it.d === my.d;
  const pivot = it => SE.pivotFor(s, it);
  const sess = {
    items, showLabels: true,
    featured: () => pickFeatured(items(), s.feat, key),
    pivot: it => (it.r === my.r || isFollowedMatch(it.m)) ? pivot(it) : '',
    special: (i, it) => myDiv(it) || isFollowedMatch(it.m) || i === sess.featured() || (it.r === my.r && !!pivot(it)),
    visible() { const f = sess.featured(); return items().map((it, i) => i).filter(i => sess.special(i, items()[i])); },
    needsCtx: it => ({ league: it.league, zones: it.zones }),
    venue: it => groundOf(it.m.h),
    ctx: it => SE.matchContext(s, it),
    mine: it => it.m.h === s.my || it.m.a === s.my,
    onComplete: onMatch, save: () => saveSeason(),
    headHTML: () => `<p class="kicker">${esc(s.name)} ${label()} · ${esc(SE.stepTitle(s))}</p><h2 class="round-title">${esc(s.regions[my.r].name)}: ${SE.SHELVES[my.d]}</h2>
      <p class="sub">Your shelf, plus anyone you follow and the big ones in your region. The other ${plural(items().length - sess.visible().length, 'match', 'matches')} are going on across the world.</p>${calendarHTML()}`,
    side: () => `<h3>${SE.SHELVES[my.d]} <span class="xs">live</span></h3>${shelfTableHTML(my.r, my.d, s.my, true)}${zoneKey(my.d)}<button class="linkish" data-act="ladder">See all four shelves</button>`,
    elsewhere(vis) {
      const all = items(), set = new Set(vis), hidden = all.filter((it, i) => !set.has(i));
      const done = hidden.filter(it => it.m.done);
      if (done.length < hidden.length) return `${plural(hidden.length, 'other match', 'other matches')} going on across ${plural(s.regionCount, 'region')}.`;
      const shocks = hidden.filter(it => it.m.shock).slice(0, 6);
      return `<b>Elsewhere:</b> ${plural(hidden.length, 'match', 'matches')} played.${shocks.length ? ` Shocks: ${shocks.map(it => `${nm(it.m.hs > it.m.as ? it.m.h : it.m.a)} beat ${nm(it.m.hs > it.m.as ? it.m.a : it.m.h)} ${Math.max(it.m.hs, it.m.as)}–${Math.min(it.m.hs, it.m.as)} <span class="xs">(${esc(it.label)})</span>`).join('; ')}.` : ''} <button class="linkish" data-act="go" data-v="book">All the tables are in the book</button>`;
    },
    nextLabel: () => SE.nextStepLabel(s),
    next() { SE.advanceSeason(s); afterAdvance(); saveSeason(); render(); },
  };
  return sess;
}
function cupSession(render) {
  const s = s_(), myR = SE.myRegionIndex(s), rg = s.regions[myR];
  const key = `C${s.no}-${s.step}`;
  const items = () => SE.stepItems(s);
  const sess = {
    items, group: true,
    featured: () => pickFeatured(items(), s.feat, key),
    pivot: it => (it.r === myR || isFollowedMatch(it.m)) ? C.cupPivot(it.c, it) : '',
    special: (i, it) => it.m.h === s.my || it.m.a === s.my || isFollowedMatch(it.m) || i === sess.featured() || (it.r === myR && !!C.cupPivot(it.c, it)),
    visible: () => items().map((it, i) => i).filter(i => items()[i].r === myR || sess.special(i, items()[i])),
    venue: it => C.venueOf(it.c, it.m, it.r),
    ctx: it => compCtx(it.c, it),
    mine: it => it.m.h === s.my || it.m.a === s.my,
    onComplete: onMatch, save: () => saveSeason(),
    headHTML: () => { const r = C.curRound(rg.cup); return `<p class="kicker">${esc(s.name)} ${label()} · ${esc(SE.stepTitle(s))}</p><h2 class="round-title">${esc(rg.cup.name)}: ${esc(r.name.replace(/^The /, 'the '))}</h2><p class="sub">${r.final ? `The final, at ${esc(C.venueOf(rg.cup, r.ties[0].matches[0], r))}. The other regions play their finals tonight too.` : `Every club in ${esc(rg.name)}, Top Shelf to Under the Bed. Level? Extra dice. The other ${s.regionCount - 1} regional cups are being played tonight as well.`}</p>${calendarHTML()}`; },
    elsewhere(vis) {
      const all = items(), set = new Set(vis), hidden = all.filter((it, i) => !set.has(i));
      if (hidden.some(it => !it.m.done)) return `${plural(hidden.length, 'other cup tie', 'other cup ties')} in the other regions.`;
      const finals = hidden.filter(it => it.r && it.r.final);
      if (finals.length) return `<b>The other regional finals:</b><ul class="results">${finals.map(it => `<li>${esc(it.c.name)}: ${nm(it.m.h)}<span class="sc2">${it.m.hs}–${it.m.as}</span>${nm(it.m.a)} <span class="xs">${nm(it.t.w)} win it${it.t.mark === '*' ? ' on extra dice' : ''}</span></li>`).join('')}</ul>`;
      const shocks = hidden.filter(it => it.m.shock).slice(0, 6);
      return `<b>Elsewhere:</b> ${plural(hidden.length, 'tie')} played.${shocks.length ? ` Giant-killings: ${shocks.map(it => `${nm(it.t.w)} knock out ${nm(it.t.w === it.t.h ? it.t.a : it.t.h)} <span class="xs">(${esc(it.c.name.replace(/^The /, ''))})</span>`).join('; ')}.` : ''}`;
    },
    nextLabel: () => SE.nextStepLabel(s),
    next() { SE.advanceSeason(s); afterAdvance(); saveSeason(); render(); },
  };
  return sess;
}

/* ---------- what the mug shows right now in a season ---------- */
// Returns { kind: 'draw', provider } | { kind: 'play', session } | { kind: 'html', html }
export function seasonView(render) {
  const s = s_();
  if (s.phase === 'draw') return { kind: 'draw', provider: seasonDrawProvider(render) };
  if (s.phase === 'pick') return { kind: 'html', html: pickHTML() };
  if (s.phase === 'end') return { kind: 'html', html: endHTML() };
  const st = SE.curStep(s);
  if (st.k === 'league') return { kind: 'play', session: leagueSession(render) };
  if (st.k === 'cup') {
    if (s.sub === 'draw') {
      const myR = SE.myRegionIndex(s), rg = s.regions[myR];
      return { kind: 'draw', provider: compProvider(rg.cup, {
        title: `${rg.cup.name}: ${C.curRound(rg.cup).name.replace(/^The /, 'the ')}, the draw`,
        sub: `Your region's cup${s.my ? `, with ${nameOf(s.my)} in it` : ''}. The other ${s.regionCount - 1} regional draws are being done in the back room.`,
        save: saveSeason, onFinish() { SE.finishCupDraws(s); saveSeason(); render(); } }) };
    }
    return { kind: 'play', session: cupSession(render) };
  }
  if (st.k === 'world') {
    const c = s.world[st.which];
    if (c.phase === 'draw') return { kind: 'draw', provider: compProvider(c, { save: saveSeason, onFinish: render,
      sub: st.which === 'cwc' ? `The ${c.size} regional cup winners, into the mug. ${C.curRound(c) ? '' : ''}` : st.which === 'champ' ? `The top two from every Top Shelf. ${c.size} clubs, groups of four, then a knockout.` : `Third and fourth from every Top Shelf. ${c.size} clubs, straight knockout.` }) };
    if (c.phase === 'play') return { kind: 'play', session: compSession(c, { save: saveSeason, prefix: `${s.name} ${label()} · the summer`,
      mine: it => it.m.h === s.my || it.m.a === s.my,
      next() {
        C.advance(c);
        if (c.phase === 'done') { recordTrophy(app.H, c.champion, `${c.name} ${label()}`, c.runner); saveH(); }
        saveSeason(); render();
      } }) };
    return { kind: 'html', html: winnersHTML(c, { kicker: `${s.name} ${label()}`, nextBtn: `<button class="btn big red" data-act="seasonnext">${esc(SE.nextStepLabel(s))}</button>` }) };
  }
  return { kind: 'html', html: '' };
}
export function seasonNext(render) { const s = s_(); SE.advanceSeason(s); afterAdvance(); saveSeason(); render(); }

/* ---------- the end of the season ---------- */
function endHTML() {
  const s = s_(), sum = s.summary, my = sum.my;
  const w = sum.world;
  const worldLine = k => w[k] ? `<li><b>${esc(SE.WORLD[k].name)}:</b> ${nm(w[k].champ)} <span class="xs">${esc(w[k].text || '')}</span></li>` : '';
  const myR = my ? my.r : 0;
  const shelfMoves = sum.regions[myR].shelves.map((rows, d) => `<div class="gcard"><h3>${SE.SHELVES[d]}</h3>${rows.map((x, i) => `<p class="end-row ${zoneClass(d, i, rows.length)}${my && x[0] === my.id ? ' me' : ''}">${i + 1}. ${nm(x[0])} <span class="xs">${x[1]} pts</span></p>`).join('')}</div>`).join('');
  const champs = sum.regions.map(rg => `<li><b>${esc(rg.name)}:</b> ${nm(rg.shelves[0][0][0])} <span class="xs">cup: ${rg.cup ? nm(rg.cup) : '–'}</span></li>`).join('');
  return `<div class="round-head"><p class="kicker">${esc(s.name)}</p><h2 class="round-title">The ${esc(sum.label)} season is over</h2>${calendarHTML()}</div>
    ${my ? `<div class="story">${confettiHTML(my.champions || my.moved === 'promoted' || my.cupRun === 'won the cup' ? 22 : 0)}<p class="kicker">Your club</p><h3>${nm(my.id)}</h3>
      <p class="big-line">${my.champions ? `Champions of ${esc(my.shelf)}` : `${ordinal(my.pos)} on ${esc(my.shelf)}`}, ${esc(my.region)}</p>
      <p>${esc(storyLine(my))}</p><p class="xs">Played 14, won ${my.w}, drew ${my.dr}, lost ${my.l}. Scored ${my.f}, let in ${my.a}. ${my.pts} points.</p>
      <p><button class="btn ghost" data-act="tearseason">Tear out the page</button></p></div>` : ''}
    <div class="book-sec"><h3>The summer</h3><ul class="results">${worldLine('champ')}${worldLine('shield')}${worldLine('cwc')}</ul></div>
    <div class="book-sec"><h3>${esc(sum.regions[myR].name)}: how the shelves finished</h3><div class="gcards">${shelfMoves}</div>${zoneKey(1)}</div>
    <div class="book-sec"><h3>Top Shelf champions everywhere</h3><ul class="results cols">${champs}</ul></div>
    <p class="done-btns"><button class="btn big red" data-act="nextseason">Start the ${esc(SE.seasonLabel(s.no + 1))} season</button></p>`;
}
export function seasonPageSpec() {
  const s = s_(), my = s.summary && s.summary.my;
  if (!my) return null;
  const ms = seasonMatches(s).filter(m => m.h === my.id || m.a === my.id);
  const gb = goldenBoot(ms, 10).filter(g => g.t === my.id).slice(0, 3);
  const lines = [
    { text: `${my.region}, ${my.shelf}`, style: 'red' },
    { text: `Played 14, won ${my.w}, drew ${my.dr}, lost ${my.l}. ${my.pts} points.` },
    { text: `Scored ${my.f}, let in ${my.a}.`, style: 'small' },
    { text: 'The cup', style: 'head' }, { text: cap(my.cupRun) + '.' },
  ];
  if (my.world.length) lines.push({ text: 'The summer', style: 'head' }, ...my.world.map(w => ({ text: `${w.won ? 'Won' : w.runner ? 'Runners-up in' : 'Played in'} ${SE.WORLD[w.k].name.replace(/^The /, 'the ')}.` })));
  const wins = ms.filter(m => m.done && ((m.h === my.id && m.hs > m.as) || (m.a === my.id && m.as > m.hs)))
    .sort((a, b) => Math.abs(b.hs - b.as) - Math.abs(a.hs - a.as) || (b.hs + b.as) - (a.hs + a.as));
  if (wins[0]) lines.push({ text: 'Best day out', style: 'head' }, { text: `${nameOf(wins[0].h)} ${wins[0].hs}–${wins[0].as} ${nameOf(wins[0].a)}` });
  if (gb.length) lines.push({ text: 'Top scorers', style: 'head' }, { text: gb.map(g => `${g.p} ${g.n}`).join(', ') });
  const stamp = my.champions ? 'CHAMPIONS' : my.cupRun === 'won the cup' ? 'CUP WINNERS' : my.moved === 'promoted' ? 'PROMOTED' : my.moved === 'relegated' ? 'RELEGATED' : '';
  return { kicker: `${s.name} ${SE.seasonLabel(s.no)}`, title: `${nameOf(my.id)}'s season`, big: my.champions ? `Champions!` : `${ordinal(my.pos)} on ${my.shelf.replace(/^The /, 'the ')}`, lines, stamp };
}
export function seasonMatches(s) {
  const out = [];
  s.regions.forEach(rg => { rg.divs.forEach(dv => dv.league && dv.league.matches.forEach(m => out.push(m))); if (rg.cup) C.allMatches(rg.cup).forEach(m => out.push(m)); });
  Object.values(s.world).forEach(c => C.allMatches(c).forEach(m => out.push(m)));
  return out;
}

/* ---------- the season pages of the book ---------- */
export function seasonBookHTML(r) {
  const s = s_();
  if (!s || s.phase === 'draw' || s.phase === 'pick') return '<p class="empty-state">The season hasn\'t kicked off yet.</p>';
  const myR = SE.myRegionIndex(s);
  if (r === undefined || r === null) r = myR;
  const rg = s.regions[r];
  const opts = s.regions.map((x, i) => `<option value="${i}"${i === r ? ' selected' : ''}>${esc(x.name)}${i === myR ? ' (yours)' : ''}</option>`).join('');
  let h = `<div class="round-head"><p class="kicker">${esc(s.name)} ${label()}</p><h2 class="round-title">The book of the season</h2>
    <p class="sub">Region: <select class="sel" id="bookRegion" aria-label="Region">${opts}</select></p></div>`;
  h += `<div class="gtables">${rg.divs.map((dv, d) => `<div class="gcard"><h3>${SE.SHELVES[d]}</h3>${shelfTableHTML(r, d, s.my)}</div>`).join('')}</div>${zoneKey(0)}`;
  const cr = rg.cup.stages[0] ? rg.cup.stages[0].rounds : [];
  if (cr.some(x => x.ties.some(t => t.matches.some(m => m.done)))) {
    h += `<div class="book-sec"><h3>${esc(rg.cup.name)}</h3>${cr.slice().reverse().map(round => {
      const res = round.ties.filter(t => t.matches.some(m => m.done));
      if (!res.length) return '';
      return `<h4 class="glabel">${esc(round.name)}</h4><ul class="results">${res.map(t => { const m = t.matches[t.matches.length - 1]; return `<li class="${m.shock ? 'shock' : ''}">${nm(m.h)}<span class="sc2">${m.hs}–${m.as}</span>${nm(m.a)}${m.x.length ? ' <span class="xs">(extra dice)</span>' : ''}</li>`; }).join('')}</ul>`;
    }).join('')}</div>`;
  }
  Object.keys(SE.WORLD).forEach(k => {
    const c = s.world[k]; if (!c) return;
    const ms = C.allMatches(c).filter(m => m.done);
    if (!ms.length) return;
    h += `<div class="book-sec"><h3>${esc(c.name)}${c.champion ? `: won by ${nm(c.champion)}` : ''}</h3><p><button class="btn ghost small" data-act="worldwall" data-v="${k}">Pin up its wallchart</button></p></div>`;
  });
  if (s.archive.length) {
    h += `<div class="book-sec"><h3>Seasons gone by</h3><ul class="results">${s.archive.slice().reverse().map(a => `<li><b>${esc(a.label)}</b>: ${a.world.champ ? `World Championship ${nm(a.world.champ.champ)}` : ''}${a.world.cwc ? `, Cup Winners' Cup ${nm(a.world.cwc.champ)}` : ''}${a.my ? `<br><span class="xs">${esc(storyLine(a.my))}</span>` : ''}</li>`).join('')}</ul></div>`;
  }
  return h;
}
export function ladderData(r) {
  const s = s_(); if (r === undefined) r = SE.myRegionIndex(s);
  return { title: s.regions[r].name, sub: `${s.name} ${label()}`, shelves: s.regions[r].divs.map((dv, d) => {
    const tb = leagueTable(dv.league);
    return { name: SE.SHELVES[d], rows: tb.map(x => [nameOf(x.id), x.pts]), zone: i => ({ 'z-champ': 'q', 'z-shield': 'q', 'z-up': 'q', 'z-down': 'dn' }[zoneClass(d, i, tb.length)] || '') };
  }) };
}
