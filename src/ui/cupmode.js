// Cup mode: build a cup (or take the quick draw), draw it, roll it, crown somebody.
import { app, saveS, saveCup, saveH, saveHonours, SPEEDS, available, allTeams } from './state.js';
import { esc, fmtDate } from './dom.js';
import { packetsHTML } from './packets.js';
import { compProvider, compSession } from './comp.js';
import { TROPHY, confettiHTML } from './pieces.js';
import { nameOf, team } from '../engine/env.js';
import { plural, cap, ordinal, shuffle, clone } from '../engine/util.js';
import * as C from '../engine/competition.js';
import { PRESETS, QUICK_CORE, QUICK_SIZE, QUICK_STAGES } from '../engine/presets.js';
import { recordTrophy, recordTour, goldenBoot, club } from '../engine/almanac.js';
import { makeRules, rulesName } from '../engine/rules.js';
import { rulesPickerHTML } from './rulespick.js';

const nm = id => esc(nameOf(id));

/* ---------- starting ---------- */
export function quickDraw() {
  const all = allTeams().map(t => t.id), have = new Set(app.data.teams.map(t => t.id));
  const core = QUICK_CORE.filter(id => have.has(id));
  const rest = shuffle(all.filter(id => !core.includes(id))).slice(0, QUICK_SIZE - core.length);
  const rules = makeRules(app.S);
  app.cup = C.createCompetition({ name: 'The Quick Draw', stages: QUICK_STAGES, size: QUICK_SIZE, teamIds: [...core, ...rest] });
  app.cup.quick = true; app.cup.rules = rules;
  app.active = 'cup'; saveCup();
}
export function startCup() {
  const teams = available();
  const rules = makeRules(app.S);
  app.cup = C.createCompetition({ name: (app.S.name || 'The Mug Cup').trim(), stages: app.S.stages, size: app.S.size, teamIds: teams.map(t => t.id) });
  app.cup.rules = rules;
  app.active = 'cup'; saveCup();
}

/* ---------- the setup page ---------- */
const SEL = (i, k, opts, val) => `<select class="sel" data-st="${i}" data-k="${k}" aria-label="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
const JOIN_OPTS = [['', 'nobody new'], ['1', 'the giants (tier 1)'], ['1,2', 'the top two tiers'], ['1,2,3', 'the top three tiers']];
function stageCard(st, i, total) {
  const isLast = i === total - 1;
  const join = i > 0 ? `<p>Late entrants joining here: ${SEL(i, 'join', JOIN_OPTS, (st.join || []).join(','))}.</p>` : '';
  let body;
  if (st.type === 'groups') {
    body = `<p>Split into groups of ${SEL(i, 'gsize', [[3, 3], [4, 4], [5, 5], [6, 6], [8, 8], [10, 10], [12, 12], [16, 16], [20, 20], [0, 'everyone, one big league']], st.gsize)}.
      Play each other ${SEL(i, 'legs', [[1, 'once'], [2, 'home and away']], st.legs)}.
      A win is worth ${SEL(i, 'pts', [[3, '3 points'], [2, '2 points, old school']], st.pts)}.
      ${isLast ? 'Top of the table wins it.' : `Top ${SEL(i, 'adv', [1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, n]), st.adv)} in each group go through.`}</p>`;
  } else {
    const lvl = st.legs === 2 ? [['away', 'away goals, then extra dice'], ['dice', 'straight to the extra dice']] : [['dice', 'extra dice straight away'], ['replay', 'a replay at the other ground, then extra dice']];
    const until = [[1, 'there is a winner'], ['fit', 'it fits the next stage'], ...[2, 4, 8, 16, 32, 64, 128, 256].map(n => [n, n + ' are left'])];
    body = `<p>Play ${SEL(i, 'legs', [[1, 'one game'], [2, 'home and away']], st.legs)}. If it's level: ${SEL(i, 'level', lvl, st.level)}.
      ${st.legs === 2 ? `Finish with ${SEL(i, 'final1', [[1, 'a one-off final'], [0, 'a two-legged final']], st.final1 ? 1 : 0)}.` : ''}
      Keep going until ${SEL(i, 'until', until, st.until)}.</p>`;
  }
  return `<div class="stage-card ${st.type}"><div class="stage-top"><span class="stage-name">Stage ${i + 1}: ${st.type === 'groups' ? 'groups' : 'knockout'}</span>
    <span class="stage-tools"><button class="mini-btn" data-act="stup" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="mini-btn" data-act="stdown" data-i="${i}" ${isLast ? 'disabled' : ''} aria-label="Move down">↓</button><button class="mini-btn" data-act="strm" data-i="${i}" aria-label="Remove stage">✕</button></span></div>
    ${body}${join}</div>`;
}
const verdict = n => n < 40 ? 'A quick one.' : n < 200 ? 'An afternoon.' : n < 1000 ? 'A proper tournament.' : n < 3000 ? 'Clear your weekend.' : 'Hideous. Brilliant. Good luck.';
export function cupSetupHTML() {
  const avail = available(), n = avail.length;
  const plan = C.planFor(app.S.stages, app.S.size, avail);
  let h = '';
  if (app.cup && app.cup.phase !== 'done') h += `<div class="resume tape"><p>You've got <b>${esc(app.cup.name)}</b> on the go.</p><button class="btn" data-act="go" data-v="mug" data-mode="cup">Carry on with it</button></div>`;
  h += `<p class="kicker">Cup</p><h2 class="round-title">Build a cup</h2>`;
  h += `<h2 class="step"><span class="num">1</span>Give it a name</h2><input id="tname" class="line-input" value="${esc(app.S.name)}" maxlength="60" aria-label="Tournament name">`;
  h += `<h2 class="step"><span class="num">2</span>Write out the slips</h2><p class="note">Tick the packets you want in the mug. Look inside to cross out any team you'd rather leave on the floor. Tiers go from the giants to the minnows. They never touch the dice.</p>${packetsHTML('pools')}`;
  h += `<h2 class="step"><span class="num">3</span>What are we playing?</h2><p class="note">Pick a ready-made one, or design your own stage by stage.</p>`;
  h += `<div class="choices presets">${PRESETS.map(p => `<button class="choice${app.S.preset === p.id ? ' on' : ''}" data-act="preset" data-v="${p.id}"><strong>${esc(p.name)}</strong><span>${esc(p.desc)}</span></button>`).join('')}
    <button class="choice${app.S.preset === 'custom' ? ' on' : ''}" data-act="preset" data-v="custom"><strong>Design your own</strong><span>Groups, knockouts, two legs, replays, late entrants. Stack up as many stages as you dare.</span></button></div>`;
  if (app.S.preset === 'custom') h += `<div class="designer">${app.S.stages.map((st, i) => stageCard(st, i, app.S.stages.length)).join('')}
    <div class="add-row"><button class="btn ghost small" data-act="addstage" data-v="groups">Add a group stage</button><button class="btn ghost small" data-act="addstage" data-v="ko">Add a knockout stage</button><button class="btn ghost small" data-act="sharedesign">Copy a link to this design</button></div></div>`;
  else h += `<p style="margin-top:14px"><button class="btn ghost small" data-act="customise">Change it in the designer</button></p>`;
  h += `<div class="flow">${plan.lines.map(l => `<p>${esc(l)}</p>`).join('')}${plan.matches ? `<p class="flow-total">About ${plural(Math.round(plan.matches), 'match', 'matches')}${plan.replays ? ', plus replays' : ''}. ${verdict(plan.matches)}</p>` : ''}${plan.errors.map(e => `<p class="warn">${esc(e)}</p>`).join('')}</div>`;
  const sizeOK = s => s === 'all' || s <= n;
  h += `<h2 class="step"><span class="num">4</span>How are the dice rolled?</h2>${rulesPickerHTML()}`;
  h += `<h2 class="step"><span class="num">5</span>How many come out of the mug?</h2><p class="note">Everyone goes in. Only this many get drawn out.</p>
    <div class="chips">${[8, 16, 20, 32, 64, 128, 256, 512, 'all'].map(s => `<button class="chip${app.S.size === s ? ' on' : ''}" data-act="size" data-v="${s}" ${sizeOK(s) ? '' : 'disabled'}>${s === 'all' ? 'Everyone (' + n + ')' : s}</button>`).join('')}
    <label class="any-n">or exactly <input id="sizeIn" type="number" min="2" max="${n}" value="${app.S.size === 'all' ? '' : app.S.size}" aria-label="Number of teams"></label></div>`;
  const ok = !plan.errors.length;
  h += `<div class="start-bar"><p>${plural(n, 'slip')} written.${ok ? ' ' + (app.S.size === 'all' || app.S.size === n ? 'Every one of them goes in.' : app.S.size + ' will come out of the mug.') : ''}</p>
    <button class="btn big red" data-act="startcup" ${ok ? '' : 'disabled'}>Fold them up and into the mug</button></div>`;
  if (!ok) h += `<p class="warn">${esc(plan.errors[0])}</p>`;
  return h;
}

/* ---------- playing it ---------- */
export const cupProvider = render => compProvider(app.cup, { save: saveCup, onFinish: render });
export function cupSession(render) {
  return compSession(app.cup, {
    save: saveCup,
    next() { C.advance(app.cup); if (app.cup.phase === 'done') crownCup(); saveCup(); render(); },
  });
}
function crownCup() {
  const c = app.cup, id = c.champion;
  recordTrophy(app.H, id, c.name, c.runner);
  const played = new Set(); C.allMatches(c).forEach(m => { if (m.done) { played.add(m.h); played.add(m.a); } });
  recordTour(app.H, [...played]);
  saveH();
  const gb = goldenBoot(C.allMatches(c), 1)[0];
  app.honours.unshift({ kind: 'cup', name: c.name, champ: nameOf(id), runner: c.runner ? nameOf(c.runner) : '', score: c.finalText, venue: c.finalVenue_ || '',
    size: c.size, date: Date.now(), shocks: c.notes.length, boot: gb ? `${gb.p} (${nameOf(gb.t)}), ${plural(gb.n, 'goal')}` : '', chart: C.snapshot(c) });
  app.honours.forEach((x, i) => { if (i >= 40) delete x.chart; });
  app.honours = app.honours.slice(0, 300);
  saveHonours();
  c.celebrated = true;
}
function routeFor(c, id) {
  const out = [], nmf = m => `${nm(m.h)}<span class="sc2">${m.hs}–${m.as}</span>${nm(m.a)}${m.x.length ? ` <span class="xs">(extra dice ${m.x.map(p => p[0] + '–' + p[1]).join(', ')})</span>` : m.pk ? ` <span class="xs">(${nm(m.pk.w === 'h' ? m.h : m.a)} won ${m.pk.s} on penalties)</span>` : ''}`;
  c.stages.forEach(st => {
    if (!st) return;
    if (st.type === 'groups') st.groups.forEach(g => g.matches.forEach(m => { if (m.done && (m.h === id || m.a === id)) out.push(`<li><span class="xs">${esc(g.name === 'The League' ? 'League' : 'Group ' + g.name)}:</span> ${nmf(m)}</li>`); }));
    else st.rounds.forEach(r => {
      r.ties.forEach(t => t.matches.forEach(m => { if (m.done && (m.h === id || m.a === id)) out.push(`<li><span class="xs">${esc(r.name.replace(/^The /, ''))}${m.kind === 'leg1' ? ', 1st leg' : m.kind === 'leg2' ? ', 2nd leg' : m.kind === 'replay' ? ', replay' : ''}:</span> ${nmf(m)}</li>`); }));
      if (r.byes.includes(id)) out.push(`<li>${esc(r.name.replace(/^The /, ''))}: a bye</li>`);
    });
  });
  return out;
}
export function bootHTML(matches) {
  const gb = goldenBoot(matches, 5); if (!gb.length) return '';
  return `<div class="golden"><h3>The golden boot</h3><ul class="results">${gb.map(g => `<li>${esc(g.p)} <span class="xs">(${nm(g.t)})</span><span class="sc2">${g.n}</span></li>`).join('')}</ul></div>`;
}
// The winners page, for cup mode and the world tournaments. opts: { kicker, nextBtn }
export function winnersHTML(c, opts = {}) {
  const t = team(c.champion);
  const route = routeFor(c, c.champion);
  const hc = app.H.clubs[c.champion];
  const minnow = t.t >= 4 ? '<p class="sub center">From the bottom of the pile to the top of the shelf. Nobody saw that coming.</p>' : '';
  const hist = hc ? `<p class="sub center">${hc.t <= 1 ? 'Their first trophy in the book.' : `That's trophy number ${hc.t} for ${esc(t.n)} in the book.`}</p>` : '';
  return `<div class="done">${confettiHTML()}
    ${opts.kicker ? `<p class="kicker center">${esc(opts.kicker)}</p>` : ''}
    ${TROPHY}
    <p class="winners">Winners of ${esc(c.name)}</p>
    <h2 class="champ">${esc(t.n)}</h2>${minnow}${hist}
    <p class="final">${esc(c.finalText || '')}${c.finalVenue_ ? ` <span class="xs">at ${esc(c.finalVenue_)}</span>` : ''}</p>
    <div class="route"><h3>The road to the trophy</h3><ul class="results">${route.slice(-40).join('')}</ul></div>
    ${bootHTML(C.allMatches(c))}
    <p class="done-btns">${opts.nextBtn || '<button class="btn big red" data-act="go" data-v="home">Back to the floor</button>'} <button class="btn ghost" data-act="tearcup">Tear out the page</button> <button class="btn ghost" data-act="wall">See the wallchart</button></p>
  </div>`;
}
// The page you can save or send.
export function cupPageSpec(c, kicker) {
  // One line per tie: two legs become an aggregate, replays mention the first game.
  const route = [];
  c.stages.forEach(st => { if (st && st.type === 'ko') st.rounds.forEach(r => r.ties.forEach(t => {
    if (t.h !== c.champion && t.a !== c.champion) return;
    const ms = t.matches.filter(m => m.done); if (!ms.length) return;
    const last = ms[ms.length - 1], round = r.name.replace(/^The /, ''), me = c.champion;
    const opp = nameOf(t.h === me ? t.a : t.h), mine = m => (m.h === me ? [m.hs, m.as] : [m.as, m.hs]);
    let f = 0, a = 0;
    if (r.legs === 2) ms.forEach(m => { const [x, y] = mine(m); f += x; a += y; }); else [f, a] = mine(last);
    const agg = r.legs === 2 && ms.length === 2 ? ' on aggregate' : '';
    const how = t.mark === '*' ? ', then won on extra dice' : t.mark === 'a' ? ', through on away goals' : t.mark === 'p' && last.pk ? `, then won ${last.pk.s} on pens` : '';
    const replay = r.legs === 1 && ms.length === 2 ? ' in a replay' : '';
    route.push({ drop: 2, text: f === a ? `${round}: drew ${f}–${a} with ${opp}${agg}${how}` : `${round}: beat ${opp} ${f}–${a}${agg}${replay}${how}` });
  })); });
  const gb = goldenBoot(C.allMatches(c), 3);
  const lines = [{ text: `${c.finalText || ''}${c.finalVenue_ ? `, at ${c.finalVenue_}` : ''}`, style: 'red' }, { text: 'The road to the trophy', style: 'head' }, ...route.slice(-8).map((x, k, arr) => (k === arr.length - 1 ? { text: x.text } : x))];
  if (gb.length) lines.push({ text: 'The golden boot', style: 'head' }, { text: gb.slice(0, 2).map(g => `${g.p} (${nameOf(g.t)}) ${g.n}`).join(', ') });
  const shocks = c.notes.slice().sort((a, b) => b.gap - a.gap).slice(0, 2);
  if (shocks.length) lines.push({ text: 'Shocks', style: 'head' }, ...shocks.map(s => ({ text: `${s.text} ${s.score}`, style: 'small', drop: 1 })));
  return { kicker: kicker || `${c.size} teams · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, title: `Winners of ${c.name}`, big: nameOf(c.champion), lines, stamp: team(c.champion).t >= 4 ? 'GIANT KILLERS' : 'CHAMPIONS' };
}
