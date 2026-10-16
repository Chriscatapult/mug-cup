// The play screen: rows of fixtures, dice you throw by hand, the line about what the
// second die needs, extra dice, and the buttons for when you want the mug to do the work.
// Cup mode and season mode both hand this a "session" describing what's being played.
import { app, speed, SPEEDS, saveS } from './state.js';
import { $, esc, sleep, replaceEl } from './dom.js';
import { dieHTML, grabDieHTML, rollDie, setFace } from './pieces.js';
import { SND, sound } from './sound.js';
import { d6, goals, plural, cap } from '../engine/util.js';
import { nameOf, groundOf, tierOf } from '../engine/env.js';
import { setScores, completeMatch, isOG } from '../engine/match.js';
import { tieStatus } from '../engine/competition.js';
import { needsLine } from '../engine/tension.js';
import { h2h, careerGoals } from '../engine/almanac.js';

let S = null;   // the current session
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
    if (t.w && last && tieStatus(t, r) === 'done') bits.push(`<b>${nm(t.w)} ${r.final ? 'lift the trophy' : 'go through'}${t.mark === 'a' ? ' on away goals' : t.mark === '*' ? ' on the extra dice' : ''}.</b>`);
    else if (m.kind === 'single' && m.hs === m.as && r.level === 'replay') bits.push(`Level. Replay at ${esc(groundOf(m.a))}.`);
  }
  return bits.join(' ');
}
export function rowHTML(it, i) {
  const m = it.m, done = m.done, t = it.t, feat = i === S.featured();
  let wH = false, wA = false;
  if (done) {
    if (t) { const dec = t.w && t.matches[t.matches.length - 1] === m && tieStatus(t, it.r) === 'done'; wH = dec && t.w === m.h; wA = dec && t.w === m.a; }
    else { wH = m.hs > m.as; wA = m.as > m.hs; }
  }
  const dieFor = (side, face, id) => face ? dieHTML(side, face) : grabDieHTML(side, side, i, `Throw the die for ${nameOf(id)}`);
  const sc = face => face ? goals(face) : '';
  const pendX = !done && m.fh && m.fa && t && tieStatus(t, it.r) === 'extra';
  let extra = '';
  if (done && m.x.length) extra = `extra dice: ${m.x.map(p => p[0] + '–' + p[1]).join(', then ')}.`;
  else if (pendX) extra = `Level! ${m.x.length ? `Extra dice so far: ${m.x.map(p => p[0] + '–' + p[1]).join(', ')}. ` : ''}Grab the extra dice: <span class="xpair pending">${grabDieHTML('mini', 'x', i, 'Throw the extra dice')}<span>–</span>${grabDieHTML('mini', 'x', i, 'Throw the extra dice')}</span>`;
  const pv = S.pivot(it);
  let met = '';
  if (!done && !m.fh) {
    const pr = h2h(app.H, m.h, m.a);
    met = pr ? `<span class="met">Met ${pr.n === 1 ? 'once' : pr.n + ' times'} before: ${pr.aw}–${pr.d}–${pr.bw}. Last time: ${esc(pr.last)}.</span>` : '<span class="met">First ever meeting.</span>';
  }
  const needs = !done && m.fh && !m.fa ? needsLine(it, S.needsCtx ? S.needsCtx(it) : {}) : '';
  const ctx = contextHTML(it);
  const yours = S.mine && S.mine(it);
  return `<div class="fx${done ? ' done' : ''}${feat ? ' feat' : ''}${pv && !done ? ' pivotal' : ''}${yours ? ' yours' : ''}" id="fx-${i}">
    ${pv ? `<span class="feat-tag pv">${esc(cap(pv))}</span>` : feat ? '<span class="feat-tag">Tie of the round</span>' : yours ? '<span class="feat-tag mine">Your lot</span>' : ''}
    ${it.label && S.showLabels ? `<span class="fx-label">${esc(it.label)}</span>` : ''}
    <div class="fx-main">
      <span class="tm home${wH ? ' win' : ''}">${starHTML(m.h)}${esc(nameOf(m.h))}</span>
      ${dieFor('h', m.fh, m.h)}<span class="sc h${m.fh === 6 ? ' nil' : ''}">${sc(m.fh)}</span><span class="dash">–</span><span class="sc a${m.fa === 6 ? ' nil' : ''}">${sc(m.fa)}</span>${dieFor('a', m.fa, m.a)}
      <span class="tm away${wA ? ' win' : ''}">${esc(nameOf(m.a))}${starHTML(m.a)}</span>
      ${done ? `<span class="sco h">${scorerText(m.gh)}</span><span class="sco a">${scorerText(m.ga)}</span>` : ''}
    </div>
    ${needs ? `<p class="needs">${esc(needs)}</p>` : ''}
    <div class="fx-meta"><span class="venue">at ${esc(S.venue(it))}</span>${ctx ? `<span class="ctx">${ctx}</span>` : ''}
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
  const rest = restCount();
  const restBtn = rest > 0 && total > 1 ? `<button class="btn ghost" data-act="rollrest" ${app.busy || app.auto ? 'disabled' : ''} title="Leaves your matches, the big ones and the tie of the round for you to throw">Roll the other ${plural(rest, 'match', 'matches')} for me</button>` : '';
  const prog = `<span class="progress">${played} of ${plural(total, 'match', 'matches')} rolled</span>`;
  if (!app.S.shortcuts) return `${prog}${restBtn}<span class="play-tip">Press and hold a die to shake it. Let go to throw.</span>`;
  const sp = `<div class="chips mini" role="group" aria-label="Speed">${Object.entries(SPEEDS).map(([k, v]) => `<button class="chip${app.S.speed === k ? ' on' : ''}" data-act="speed" data-v="${k}">${v.label}</button>`).join('')}</div>`;
  return `${prog}${restBtn}<button class="btn" data-act="rollnext" ${app.busy || app.auto ? 'disabled' : ''}>Roll the next match</button>
    <button class="btn ghost" data-act="rollall" ${app.busy && !app.auto ? 'disabled' : ''}>${app.auto ? 'Stop after this one' : 'Roll them all'}</button>${sp}`;
}
function footHTML() { const { total, played } = counts(); const nl = S.nextLabel(); return played < total || !nl ? '' : `<button class="btn big red" data-act="next">${esc(nl)}</button>`; }
export function playHTML() {
  const items = S.items(), vis = S.visible ? S.visible() : items.map((_, i) => i);
  let rows = '', lastLabel = null;
  vis.forEach(i => {
    const it = items[i];
    if (S.group && it.label && it.label !== lastLabel) { rows += `<h3 class="glabel">${esc(it.label)}</h3>`; lastLabel = it.label; }
    rows += rowHTML(it, i);
  });
  const hidden = items.length - vis.length;
  const side = S.side ? `<aside class="side" id="side">${S.side()}</aside>` : '';
  return `<div class="round-head">${S.headHTML()}<div id="dreamers">${S.dreamers ? S.dreamers() : ''}</div></div>
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

/* ---------- throwing ---------- */
function writeGoal(row, side, face) {
  const sc = row.querySelector('.sc.' + side); if (!sc) return;
  sc.textContent = goals(face); sc.classList.toggle('nil', face === 6);
  sc.classList.remove('write'); void sc.offsetWidth; sc.classList.add('write');
  SND.scribble();
}
async function throwDie(i, side, ms) {
  const it = S.items()[i], m = it.m, key = 'f' + side;
  if (m[key]) return;
  const face = d6();
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  if (row && ms > 0) {
    row.classList.add('live'); SND.clatter();
    await rollDie(row.querySelector('.die.' + side), face, ms);
    m[key] = face; writeGoal(row, side, face);
  } else m[key] = face;
  if (side === 'h' && !m.fa && row) {
    // the line that makes the second die matter
    const line = needsLine(it, S.needsCtx ? S.needsCtx(it) : {});
    if (line) {
      const p = document.createElement('p'); p.className = 'needs'; p.textContent = line;
      const met = row.querySelector('.met'); if (met) met.remove();
      row.querySelector('.fx-main').after(p);
    }
    if (S.pivot(it)) { row.querySelector('.die.a')?.classList.add('sweat'); SND.humStart(); }
  }
  S.save();
}
async function throwExtra(i, ms) {
  const m = S.items()[i].m, eh = d6(), ea = d6();
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
  m.x.push([goals(eh), goals(ea)]); m.xf.push([eh, ea]);
  S.save();
}
async function settle(i, autoMode) {
  const it = S.items()[i], m = it.m;
  if (m.done || !m.fh || !m.fa) return;
  SND.humStop();
  setScores(m);
  const sp = speed();
  const anim = !app.bulk && sp.roll > 0 && !!document.getElementById('fx-' + i);
  if (it.t && tieStatus(it.t, it.r) === 'extra') {
    if (!autoMode) { if (!app.bulk) { renderRow(i); markNext(); SND.humStart(); } S.save(); return; }
    do {
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
  S.onComplete(it, note);
  if (app.bulk) return;
  if (withSound) {
    if (m.shock) SND.crowd(false);
    else if (S.pivot(it) && ctx.winner) { SND.crowd(true); }
    else if (sp.roll >= 800) SND.whistle();
  }
  if (sp.gap) await sleep(sp.gap * 0.5);
  renderRow(i, true);
  refreshBits();
}
async function playMatch(i) {
  const it = S.items()[i];
  if (!it || it.m.done) return;
  const m = it.m, sp = speed(), pv = !!S.pivot(it);
  const row = app.bulk ? null : document.getElementById('fx-' + i);
  const anim = !!row && sp.roll > 0;
  if (anim) { row.classList.add('live'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); await sleep(Math.min(300, sp.gap)); }
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
  const ms = (Math.max(sp.roll, 500) + Math.min(held || 0, 1500) * 0.3) * (kind === 'a' && S.pivot(it) ? 1.5 : 1);
  if (kind === 'x') await throwExtra(i, ms * 0.8); else await throwDie(i, kind, ms);
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
  const m = S.items()[i].m;
  return { kind: !m.fh ? 'h' : !m.fa ? 'a' : 'x', i };
}
