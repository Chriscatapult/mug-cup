// The play screen: rows of fixtures, dice you throw by hand, the line about what the
// second die needs, extra dice or penalties, and the buttons for when you want the mug to do the work.
// Cup mode and season mode both hand this a "session" describing what's being played.
import { app, speed, SPEEDS } from './state.js';
import { $, esc, sleep, replaceEl } from './dom.js';
import { dieHTML, grabDieHTML, rollDie, d10HTML, grabD10HTML, waitD10HTML, fdieHTML } from './pieces.js';
import { cardHTML, scan } from './card.js';
import { SND, sound } from './sound.js';
import { goals, plural, cap } from '../engine/util.js';
import { nameOf, groundOf, tierOf } from '../engine/env.js';
import { setScores, completeMatch, isOG } from '../engine/match.js';
import { tieStatus } from '../engine/competition.js';
import { needsLine, pensLine } from '../engine/tension.js';
import { h2h, careerGoals } from '../engine/almanac.js';
import * as RU from '../engine/rules.js';

let S = null;        // the current session
let cardM = null;    // the match whose results card is open (expanded rules)
export const session = () => S;
export function setSession(s) { S = s; }

/* ---------- which rows are special ---------- */
export function pickFeatured(items, memo, key) {
  if (memo[key] === undefined) {
    let best = -1, bi = -1;
    items.forEach((it, i) => {
      const a = tierOf(it.m.h), b = tierOf(it.m.a);
      const sc = Math.abs(a - b) + (b < a ? 0.5 : 0) + Math.random() * 0.4;
      if (sc > best) { best = sc; bi = i; }
    });
    memo[key] = items.length > 2 ? bi : -1;
  }
  return memo[key];
}
const followed = id => app.S.follow.includes(id);
export const isFollowedMatch = m => followed(m.h) || followed(m.a);
// The ones "roll everything but…" leaves for you: the tie of the round, and your own club's match.
function keep(i, it) { return i === S.featured() || !!(S.mine && S.mine(it)); }
let split = false;   // true while the page shows "Still to throw" above "Results"
function special(i, it) { return S.special ? S.special(i, it) : (i === S.featured() || isFollowedMatch(it.m) || !!S.pivot(it)); }

/* ---------- rendering ---------- */
function scorerText(list) {
  if (!list || !list.length) return '';
  const order = [], by = {};
  list.forEach(g => { if (!by[g.p]) { by[g.p] = []; order.push(g.p); } by[g.p].push(g.m + "'"); });
  return order.map(p => esc(p) + ' ' + by[p].join(', ')).join('<br>');
}
function starHTML(id) {
  const on = followed(id);
  return `<button class="star${on ? ' on' : ''}" data-act="follow" data-id="${esc(id)}" aria-label="${on ? 'Stop following' : 'Follow'} ${esc(nameOf(id))}" title="${on ? 'Following' : 'Follow'}">${on ? '★' : '☆'}</button>`;
}
const tiedOn = (mark, t) => { const pk = t && t.matches[t.matches.length - 1].pk; return mark === 'a' ? ' on away goals' : mark === '*' ? ' on the extra dice' : mark === 'p' ? ` on penalties${pk ? `, ${pk.s}` : ''}` : ''; };
function contextHTML(it) {
  const m = it.m, t = it.t, r = it.r;
  if (!t) return '';
  const bits = [], nm = id => esc(nameOf(id));
  if (m.kind === 'leg1') bits.push(m.done ? 'First leg. Second leg to come.' : 'First leg.');
  if (m.kind === 'leg2') {
    const f = t.matches[0];
    bits.push(`Second leg. First leg: ${nm(f.h)} ${f.hs}–${f.as} ${nm(f.a)}.`);
    if (m.hs !== null) bits.push(`On aggregate: ${nm(t.h)} ${f.hs + m.as}–${f.as + m.hs} ${nm(t.a)}.`);
  }
  if (m.kind === 'replay') { const f = t.matches[0]; bits.push(`Replay. First game finished ${f.hs}–${f.as}.`); }
  if (m.done) {
    const last = t.matches[t.matches.length - 1] === m;
    if (t.w && last && tieStatus(t, r) === 'done') bits.push(`<b>${nm(t.w)} ${r.final ? 'lift the trophy' : 'go through'}${tiedOn(t.mark, t)}.</b>`);
    else if (m.kind === 'single' && m.hs === m.as && r.level === 'replay') bits.push(`Level. Replay at ${esc(groundOf(m.a))}.`);
  }
  return bits.join(' ');
}
// What form means for this match, in words (and the form die when it's waiting to be thrown).
function formHTML(m, i) {
  if (!m.fm || (!m.fm[0] && !m.fm[1])) return '';
  const nm = id => esc(nameOf(id)), word = f => f > 0 ? 'are in form' : 'are out of form';
  const who = [m.fm[0] ? `${nm(m.h)} ${word(m.fm[0])}` : '', m.fm[1] ? `${nm(m.a)} ${word(m.fm[1])}` : ''].filter(Boolean).join(' and ');
  if (!RU.expanded()) {
    const edge = s => RU.classicEdge(m, s);
    const bits = ['h', 'a'].filter(edge).map(s => `${nm(s === 'h' ? m.h : m.a)} ${edge(s) > 0 ? 'are in form: two dice, the better one counts' : 'are out of form: two dice, the worse one counts'}`);
    return m.done ? '' : `<span class="formnote">${bits.join('. ')}.</span>`;
  }
  if (!m.fp) return m.done ? '' : `<span class="formnote">${who}, so it cancels out.</span>`;
  const gets = nm(m.fp.s === 'h' ? m.h : m.a), die = m.fp.big ? 'the big form die (two 0s, three 1s, a 2)' : 'the form die (four 0s, a 1, a 2)';
  if (!m.ff) return `<span class="formnote">${who}. ${gets} get ${die}. Throw it first: ${fdieHTML('', true, i)}</span>`;
  return `<span class="formnote">${who}. Form die: ${fdieHTML(m.fb ? '+' + m.fb : '0', false)} ${m.fb ? `+${m.fb} for ${gets}` : `nothing for ${gets}`}.</span>`;
}
function diceFor(m, i, side) {
  const id = side === 'h' ? m.h : m.a, face = m['f' + side];
  if (RU.expanded()) {
    if (face) return d10HTML(side, face);
    if (RU.formDiePending(m) || (side === 'a' && !m.fh)) return waitD10HTML(side);
    return grabD10HTML(side, side, i, `Throw the ${side === 'h' ? 'red' : 'blue'} die for ${nameOf(id)}`);
  }
  const pair = m['f' + side + 'x'];
  if (pair) return `<span class="dpair">${pair.slice(0, 2).map((f, k) => dieHTML(`${side} mini${k === pair[2] ? '' : ' spent'}`, f)).join('')}</span>`;
  if (face) return dieHTML(side, face);
  const two = RU.classicEdge(m, side) ? ' two' : '';
  return grabDieHTML(side + two, side, i, `Throw the die for ${nameOf(id)}`);
}
export function rowHTML(it, i) {
  const m = it.m, done = m.done, t = it.t, feat = i === S.featured(), ex = RU.expanded();
  if (!done) RU.prepare(m);
  let wH = false, wA = false;
  if (done) {
    if (t) { const dec = t.w && t.matches[t.matches.length - 1] === m && tieStatus(t, it.r) === 'done'; wH = dec && t.w === m.h; wA = dec && t.w === m.a; }
    else { wH = m.hs > m.as; wA = m.as > m.hs; }
  }
  const scH = ex ? (m.hs ?? '') : (m.fh ? goals(m.fh) + (m.fb && m.fp?.s === 'h' ? m.fb : 0) : '');
  const scA = ex ? (m.as ?? '') : (m.fa ? goals(m.fa) : '');
  const nilH = !ex && m.fh === 6, nilA = !ex && m.fa === 6;
  const pend = !done && m.fh && m.fa && t && tieStatus(t, it.r) === 'extra';
  let extra = '';
  if (done && m.x.length) extra = `extra dice: ${m.x.map(p => p[0] + '–' + p[1]).join(', then ')}.`;
  else if (pend && !ex) extra = `Level! ${m.x.length ? `Extra dice so far: ${m.x.map(p => p[0] + '–' + p[1]).join(', ')}. ` : ''}Grab the extra dice: <span class="xpair pending">${grabDieHTML('mini', 'x', i, 'Throw the extra dice')}<span>–</span>${grabDieHTML('mini', 'x', i, 'Throw the extra dice')}</span>`;
  if (pend && ex) m.pkOpen = true;
  const pv = S.pivot(it);
  let met = '';
  if (!done && !m.fh) {
    const pr = h2h(app.H, m.h, m.a);
    met = pr ? `<span class="met">Met ${pr.n === 1 ? 'once' : pr.n + ' times'} before: ${pr.aw}–${pr.d}–${pr.bw}. Last time: ${esc(pr.last)}.</span>` : '<span class="met">First ever meeting.</span>';
  }
  const needs = !done && m.fh && !m.fa ? esc(needsLine(it, S.needsCtx ? S.needsCtx(it) : {})) : pend && ex ? `${esc(pensLine(m))} ${grabD10HTML('pen', 'p', i, 'Roll the green penalty die')}` : '';
  const ctx = contextHTML(it);
  const yours = S.mine && S.mine(it);
  const card = ex && cardM === m ? cardHTML(m, i) : '';
  return `<div class="fx${done ? ' done' : ''}${feat ? ' feat' : ''}${pv && !done ? ' pivotal' : ''}${yours ? ' yours' : ''}${ex ? ' ex' : ''}" id="fx-${i}">
    ${feat ? `<span class="feat-tag${pv ? ' pv' : ''}">Tie of the round${pv ? `: ${esc(pv)}` : ''}</span>` : pv ? `<span class="feat-tag pv">${esc(cap(pv))}</span>` : yours ? '<span class="feat-tag mine">Your lot</span>' : ''}
    ${it.label && (S.showLabels || (split && !done)) ? `<span class="fx-label">${esc(it.label)}</span>` : ''}
    <div class="fx-main">
      <span class="tm home${wH ? ' win' : ''}">${starHTML(m.h)}${esc(nameOf(m.h))}</span>
      ${diceFor(m, i, 'h')}<span class="sc h${nilH ? ' nil' : ''}">${scH}</span><span class="dash">–</span><span class="sc a${nilA ? ' nil' : ''}">${scA}</span>${diceFor(m, i, 'a')}
      <span class="tm away${wA ? ' win' : ''}">${esc(nameOf(m.a))}${starHTML(m.a)}</span>
      ${done ? `<span class="sco h">${scorerText(m.gh)}</span><span class="sco a">${scorerText(m.ga)}</span>` : ''}
    </div>
    ${needs ? `<p class="needs">${needs}</p>` : ''}
    ${card}
    <div class="fx-meta"><span class="venue">at ${esc(S.venue(it))}</span>${formHTML(m, i)}${ctx ? `<span class="ctx">${ctx}</span>` : ''}
      <span class="extra">${extra}</span>${m.shock ? '<span class="stamp">Shock!</span>' : ''}${met}</div>
    ${done && m.rep ? `<p class="report">${esc(m.rep)}</p>` : ''}
  </div>`;
}
function counts() { const it = S.items(); return { total: it.length, played: it.filter(x => x.m.done).length }; }
function restCount() { const items = S.items(); return items.filter((it, i) => !it.m.done && !special(i, it)).length; }
export function ctlHTML() {
  const { total, played } = counts();
  if (played === total) {
    const nl = S.nextLabel();
    return `<span class="progress">All ${plural(total, 'match', 'matches')} rolled.</span>${nl ? `<button class="btn red" data-act="next">${esc(nl)}</button>` : ''}`;
  }
  const items = S.items(), off = app.busy || app.auto ? 'disabled' : '';
  const rest = restCount();
  const but = items.filter((it, i) => !it.m.done && !keep(i, it)).length;
  const kept = items.map((it, i) => [it, i]).filter(([it, i]) => !it.m.done && keep(i, it));
  const keepsFeat = kept.some(([, i]) => i === S.featured()), keepsMine = kept.some(([it]) => S.mine && S.mine(it));
  const butLabel = keepsFeat && keepsMine ? 'everything but your match and the tie of the round' : keepsFeat ? 'everything but the tie of the round' : keepsMine ? 'everything but your match' : `all ${plural(but, 'match', 'matches')}`;
  const butBtn = but > 0 && total > 1 ? `<button class="btn ghost" data-act="rollbut" ${off} title="Rolls the whole round for you in one go">Roll ${butLabel}${kept.length ? ` (${but})` : ''}</button>` : '';
  const restBtn = rest > 0 && total > 1 && rest !== but ? `<button class="btn ghost" data-act="rollrest" ${off} title="Leaves your matches, the big ones and the tie of the round for you to throw">Roll ${plural(rest, 'match', 'matches')}, leave the big ones</button>` : '';
  const restBtnAll = restBtn + butBtn;
  const prog = `<span class="progress">${played} of ${plural(total, 'match', 'matches')} rolled</span>`;
  if (!app.S.shortcuts) return `${prog}${restBtnAll}<span class="play-tip">Press and hold a die to shake it. Let go to throw.</span>`;
  const sp = `<div class="chips mini" role="group" aria-label="Speed">${Object.entries(SPEEDS).map(([k, v]) => `<button class="chip${app.S.speed === k ? ' on' : ''}" data-act="speed" data-v="${k}">${v.label}</button>`).join('')}</div>`;
  return `${prog}${restBtnAll}<button class="btn" data-act="rollnext" ${app.busy || app.auto ? 'disabled' : ''}>Roll the next match</button>
    <button class="btn ghost" data-act="rollall" ${app.busy && !app.auto ? 'disabled' : ''}>${app.auto ? 'Stop after this one' : 'Roll them all'}</button>${sp}`;
}
function footHTML() { const { total, played } = counts(); const nl = S.nextLabel(); return played < total || !nl ? '' : `<button class="btn big red" data-act="next">${esc(nl)}</button>`; }
function rulesStrip() {
  const r = RU.R();
  if (r.dice !== 'expanded' && !r.form) return '';
  return `<p class="rules-strip">${esc(RU.rulesName(r))}.${r.dice === 'expanded' ? ' <button class="linkish" data-act="showcard">See the results card</button>' : ''}</p>`;
}
export function playHTML() {
  const items = S.items(), vis = S.visible ? S.visible() : items.map((_, i) => i);
  if (cardM && !items.some(it => it.m === cardM)) cardM = null;
  // Once some are played and some aren't, the ones still to throw go to the top.
  const todo = vis.filter(i => !items[i].m.done), done = vis.filter(i => items[i].m.done);
  split = todo.length > 0 && done.length > 0;
  let rows = '', lastLabel = null;
  const listed = list => list.forEach(i => {
    const it = items[i];
    if (S.group && it.label && it.label !== lastLabel && !(split && !it.m.done)) { rows += `<h3 class="glabel">${esc(it.label)}</h3>`; lastLabel = it.label; }
    rows += rowHTML(it, i);
  });
  if (split) {
    const rank = i => (i === S.featured() ? 0 : S.mine && S.mine(items[i]) ? 1 : S.pivot(items[i]) ? 2 : 3);
    rows += `<h3 class="sect" id="todo-head">Still to throw <span class="xs">(${todo.length})</span></h3>`;
    listed(todo.slice().sort((a, b) => rank(a) - rank(b) || a - b));
    rows += `<h3 class="sect">Results <span class="xs">(${done.length})</span></h3>`;
    listed(done);
  } else listed(vis);
  const hidden = items.length - vis.length;
  const side = S.side ? `<aside class="side" id="side">${S.side()}</aside>` : '';
  return `<div class="round-head">${S.headHTML()}${rulesStrip()}<div id="dreamers">${S.dreamers ? S.dreamers() : ''}</div></div>
    <div class="play-ctl" id="playctl">${ctlHTML()}</div>
    <div class="play-wrap${side ? ' with-side' : ''}"><div class="fixtures">${rows}
      ${hidden > 0 ? `<div class="elsewhere" id="elsewhere">${S.elsewhere ? S.elsewhere(vis) : `${plural(hidden, 'other match', 'other matches')} going on elsewhere.`}</div>` : ''}
      ${S.after ? S.after() : ''}</div>${side}</div>
    <div class="next-bar" id="playfoot">${footHTML()}</div>`;
}
export function markNext() {
  document.querySelectorAll('.die.next').forEach(d => d.classList.remove('next'));
  if (!S || app.busy) return;
  const d = document.querySelector('.fixtures .pivotal [data-grab]') || document.querySelector('.fixtures .yours [data-grab]') || document.querySelector('.fixtures .feat [data-grab]') || document.querySelector('.fixtures [data-grab]');
  if (d) d.classList.add('next');
}
export function refreshBits() {
  const c = $('#playctl'); if (c) c.innerHTML = ctlHTML();
  const f = $('#playfoot'); if (f) f.innerHTML = footHTML();
  const d = $('#dreamers'); if (d && S.dreamers) d.innerHTML = S.dreamers();
  const s = $('#side'); if (s && S.side) s.innerHTML = S.side();
  const e = $('#elsewhere'); if (e && S.elsewhere) e.innerHTML = S.elsewhere(S.visible ? S.visible() : []);
  markNext();
}
function renderRow(i, flash) {
  if (!document.getElementById('fx-' + i)) return;
  const nr = replaceEl('fx-' + i, rowHTML(S.items()[i], i));
  if (flash && nr) nr.classList.add('just');
}

/* ---------- the results card under the match being thrown ---------- */
// Opens the card for match i (and closes any other), without disturbing a die in your hand.
export function openCard(i) {
  if (!S || !RU.expanded()) return;
  const it = S.items()[i]; if (!it || it.m.done) return;
  if (cardM === it.m && document.getElementById('rc-' + i)) return;
  document.querySelectorAll('.rcard-wrap').forEach(x => { const row = x.closest('.fx'); x.remove(); if (row) row.classList.remove('carded'); });
  cardM = it.m;
  const row = document.getElementById('fx-' + i); if (!row) return;
  row.querySelector('.fx-meta').insertAdjacentHTML('beforebegin', cardHTML(it.m, i));
  row.classList.add('carded');
  const w = document.getElementById('rc-' + i); if (w) w.classList.add('opening');
}
function refreshCard(i) {
  const old = document.getElementById('rc-' + i); if (!old) return;
  old.outerHTML = cardHTML(S.items()[i].m, i);
}

/* ---------- throwing ---------- */
function writeScore(row, side, val, nil) {
  const sc = row.querySelector('.sc.' + side); if (!sc) return;
  sc.textContent = val; sc.classList.toggle('nil', !!nil);
  sc.classList.remove('write'); void sc.offsetWidth; sc.classList.add('write');
}
function showNeeds(row, it) {
  const line = needsLine(it, S.needsCtx ? S.needsCtx(it) : {});
  row.querySelector('.needs')?.remove();
  if (!line) return;
  const p = document.createElement('p'); p.className = 'needs'; p.textContent = line;
  row.querySelector('.met')?.remove();
  row.querySelector('.fx-main').after(p);
}
async function throwDie(i, side, ms) {
  const it = S.items()[i], m = it.m;
  if (m['f' + side]) return;
  RU.prepare(m);
  const res = RU.throwSide(m, side);
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  if (row && ms > 0) {
    row.classList.add('live'); SND.clatter();
    const el = row.querySelector('.fx-main .die.' + side);
    if (RU.expanded()) {
      openCard(i);
      const wrap = () => document.getElementById('rc-' + i);
      let lastF = 0;
      await rollDie(el, res.face, ms, { sides: 10, onFace: (f, landed) => { scan(wrap(), side, f, landed); if (f !== lastF && !landed) { SND.tick(); lastF = f; } } });
      await sleep(Math.min(420, ms * 0.25));
      refreshCard(i);
      if (side === 'a') SND.scribble();
    } else if (res.pair) {
      const holder = document.createElement('span'); holder.className = 'dpair';
      holder.innerHTML = dieHTML(side + ' mini', 0) + dieHTML(side + ' mini', 0);
      el.replaceWith(holder);
      const ds = holder.querySelectorAll('.die');
      await Promise.all([rollDie(ds[0], res.pair[0], ms), rollDie(ds[1], res.pair[1], ms)]);
      await sleep(250);
      ds[res.kept === 0 ? 1 : 0].classList.add('spent');
      writeScore(row, side, goals(res.face), res.face === 6); SND.scribble();
    } else {
      await rollDie(el, res.face, ms);
      writeScore(row, side, goals(res.face), res.face === 6); SND.scribble();
    }
  }
  if (side === 'h' && !m.fa && row) {
    showNeeds(row, it);    // the line that makes the second die matter
    if (RU.expanded()) { const a = row.querySelector('.fx-main .die.a'); if (a) a.outerHTML = grabD10HTML('a', 'a', i, `Throw the blue die for ${nameOf(m.a)}`); }
    if (S.pivot(it)) { row.querySelector('.fx-main .die.a')?.classList.add('sweat'); SND.humStart(); }
  }
  S.save();
}
async function throwFormDie(i, ms) {
  const it = S.items()[i], m = it.m;
  if (m.ff) return;
  RU.throwForm(m);
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  if (row && ms > 0) {
    openCard(i);
    const el = row.querySelector('.fdie'), faces = RU.formDieFaces(m);
    SND.clatter();
    await rollDie(el, m.ff, ms, { label: f => (faces[f - 1] ? '+' + faces[f - 1] : '0') });
    await sleep(350);
    renderRow(i);
  }
  S.save();
}
async function throwPensDie(i, ms) {
  const m = S.items()[i].m;
  if (m.pk) return;
  const f = RU.throwPens(m);
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  if (row && ms > 0) {
    if (!document.getElementById('rc-' + i)) openCard(i);
    const el = row.querySelector('.die.pen');
    const wrap = () => document.getElementById('rc-' + i);
    SND.clatter();
    await rollDie(el, f, ms, { sides: 10, onFace: (x, landed) => { scan(wrap(), 'p', x, landed); if (!landed) SND.tick(); } });
    await sleep(350);
    refreshCard(i);
  }
  S.save();
}
async function throwExtra(i, ms) {
  const m = S.items()[i].m;
  const [eh, ea] = RU.throwExtraPair(m);
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  if (row && ms > 0) {
    const pair = row.querySelector('.xpair.pending');
    if (pair) {
      pair.classList.remove('pending');
      const ds = pair.querySelectorAll('.die');
      SND.clatter();
      await Promise.all([rollDie(ds[0], eh, ms), rollDie(ds[1], ea, ms)]);
      SND.scribble();
    }
  }
  S.save();
}
async function settle(i, autoMode) {
  const it = S.items()[i], m = it.m;
  if (m.done || !m.fh || !m.fa) return;
  SND.humStop();
  setScores(m);
  const sp = speed();
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  const anim = !!row && sp.roll > 0;
  if (row && RU.expanded()) { writeScore(row, 'h', m.hs); writeScore(row, 'a', m.as); }
  if (it.t && tieStatus(it.t, it.r) === 'extra') {
    if (!autoMode) { if (row) { renderRow(i); markNext(); SND.humStart(); } S.save(); return; }
    if (RU.expanded()) {
      if (anim) { renderRow(i); await sleep(sp.gap * 1.2); }
      await throwPensDie(i, anim ? sp.roll * (S.pivot(it) ? 1.6 : 1.1) : 0);
    } else do {
      if (anim) { renderRow(i); await sleep(sp.gap * 1.1); }
      await throwExtra(i, anim ? sp.roll * 0.75 * (S.pivot(it) ? 1.5 : 1) : 0);
      if (anim) await sleep(sp.gap * 0.7);
    } while (tieStatus(it.t, it.r) === 'extra');
  }
  SND.humStop();
  await finalize(i, anim || (!app.bulk && !autoMode));
}
async function finalize(i, withSound) {
  const it = S.items()[i], m = it.m, sp = speed();
  const ctx = S.ctx(it);
  ctx.prior = h2h(app.H, m.h, m.a);
  ctx.career = (p, c) => careerGoals(app.H, p, c) + [...m.gh, ...m.ga].filter(g => g.p === p && !isOG(g)).length;
  const note = completeMatch(m, ctx);
  delete m.pkOpen;
  S.onComplete(it, note);
  if (app.bulk) return;
  if (withSound) {
    if (m.shock) SND.crowd(false);
    else if (S.pivot(it) && ctx.winner) SND.crowd(true);
    else if (sp.roll >= 800) SND.whistle();
  }
  if (sp.gap) await sleep(sp.gap * (RU.expanded() && cardM === m ? 1.4 : 0.5));
  renderRow(i, true);
  refreshBits();
}
async function playMatch(i) {
  const it = S.items()[i];
  if (!it || it.m.done) return;
  const m = it.m, sp = speed(), pv = !!S.pivot(it);
  RU.prepare(m);
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  const anim = !!row && sp.roll > 0;
  if (anim) { row.classList.add('live'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); openCard(i); await sleep(Math.min(300, sp.gap)); }
  if (RU.formDiePending(m)) { await throwFormDie(i, anim ? sp.roll * 0.7 : 0); if (anim) await sleep(sp.gap * 0.6); }
  if (!m.fh) { await throwDie(i, 'h', anim ? sp.roll : 0); if (anim) await sleep(sp.gap * (pv ? 2.6 : 1)); }
  if (!m.fa) await throwDie(i, 'a', anim ? sp.roll * (pv ? 1.8 : 1) : 0);
  await settle(i, true);
}
export const nextUnplayed = () => S.items().findIndex(x => !x.m.done);
export async function handThrow(kind, i, held) {
  if (app.busy || app.auto || !S) return;
  const it = S.items()[i]; if (!it || it.m.done) return;
  app.busy = true; markNext();
  const sp = speed();
  const ms = (Math.max(sp.roll, 500) + Math.min(held || 0, 1500) * 0.3) * ((kind === 'a' || kind === 'p') && S.pivot(it) ? 1.5 : 1);
  if (kind === 'x') await throwExtra(i, ms * 0.8);
  else if (kind === 'p') await throwPensDie(i, ms);
  else if (kind === 'f') await throwFormDie(i, ms * 0.8);
  else await throwDie(i, kind, ms);
  await settle(i, false);
  app.busy = false;
  refreshBits();
}
export async function rollBulk(filter, done) {
  app.bulk = true; sound.quiet = true;
  const items = S.items();
  for (let i = 0; i < items.length; i++) if (!items[i].m.done && filter(i, items[i])) await playMatch(i);
  app.bulk = false; sound.quiet = false;
  S.save(true); SND.clatter();
  done();
}
export const rollRest = done => rollBulk((i, it) => !special(i, it), done);
export const rollBut = done => rollBulk((i, it) => !keep(i, it), done);
// After a bulk roll: straight to whatever is left to throw.
export function toNext() {
  const h = document.getElementById('todo-head');
  if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
  else { const d = document.querySelector('.fixtures [data-grab]'); if (d) d.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
export async function rollOne(i) {
  if (app.busy || app.auto) return;
  app.busy = true; refreshBits();
  await playMatch(i);
  app.busy = false; refreshBits();
}
export async function rollAll(done) {
  if (app.auto) { app.auto = false; refreshBits(); return; }
  if (app.busy) return;
  if (speed().roll === 0) { await rollBulk(() => true, done); return; }
  app.auto = true; app.busy = true; refreshBits();
  while (app.auto && S) { const i = nextUnplayed(); if (i < 0) break; await playMatch(i); }
  app.auto = false; app.busy = false;
  refreshBits();
}
// Space bar with shortcuts on: the next die that wants throwing.
export function nextDie() {
  const i = nextUnplayed(); if (i < 0) return null;
  const m = RU.prepare(S.items()[i].m);
  if (RU.formDiePending(m)) return { kind: 'f', i };
  return { kind: !m.fh ? 'h' : !m.fa ? 'a' : RU.expanded() ? 'p' : 'x', i };
}
