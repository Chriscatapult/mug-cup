// The mug. A "provider" says what's in it and where each slip goes; this file does the rummaging,
// the unfolding, the pause before the second name of a tie, and the pile you can pick from.
import { app, speed } from './state.js';
import { $, esc, sleep } from './dom.js';
import { mugSVG } from './pieces.js';
import { SND } from './sound.js';
import { nameOf } from '../engine/env.js';
import { plural, shuffle } from '../engine/util.js';

let P = null;           // current provider
let spread = null;      // the slips tipped onto the carpet to pick from
export const provider = () => P;
export function setProvider(p) { P = p; spread = null; }

export function drawHTML() {
  return `<div class="round-head"><h2 class="round-title">${esc(P.title)}</h2><p class="sub">${esc(P.sub)}</p></div>
  <div class="draw-layout">
    <div class="mug-col">
      <p class="caption" id="caption" aria-live="polite"></p>
      <div class="mug-stage" data-grab="mug" role="button" tabindex="0" aria-label="Reach into the mug and pull out a slip">${mugSVG(P.left(), P.start())}<div class="slip-reveal" id="slip" aria-live="polite"></div></div>
      <div id="drawctl">${ctlHTML()}</div>
    </div>
    <div class="dest-col">${P.destHTML()}</div>
  </div>`;
}
function spreadHTML() {
  if (!spread) return '';
  const cols = ['#fffdf6', '#fff4c4', '#fde0d8', '#e0eef7', '#e5f0dc'];
  return `<div class="spread">${spread.map((id, k) => `<button class="folded" data-act="pickslip" data-k="${k}" style="--r:${(k * 37 % 24) - 12}deg;background:${cols[k % 5]}" aria-label="A folded slip"></button>`).join('')}</div>
    <p class="hint">Pick one. <button class="linkish" data-act="spreadmore">Tip out a different handful</button></p>`;
}
export function ctlHTML() {
  if (!P.done()) {
    let h = `<p class="mug-count">${plural(P.left(), 'slip')} in the mug</p>`;
    h += spread ? spreadHTML() : `<p class="hint">Press and hold the mug to have a rummage. Let go to pull a slip out.${P.left() > 1 ? ` <button class="linkish" data-act="spread">Or tip a handful onto the carpet and pick one</button>` : ''}</p>`;
    const rest = P.need() - P.doneCount();
    if (app.S.shortcuts) h += `<div class="draw-btns"><button class="btn" data-act="pull" ${app.auto ? 'disabled' : ''}>Pull one for me</button>
      <button class="btn ghost small" data-act="keep">${app.auto ? 'Stop pulling' : 'Keep pulling'}</button>
      <button class="btn ghost small" data-act="tip" ${app.auto ? 'disabled' : ''}>Tip the whole mug out</button></div>`;
    else if (rest > 24) h += `<div class="big-hint">That's ${rest} slips to pull. Fancy some help? <button class="btn ghost small" data-act="tip" style="margin-top:6px">Tip the whole mug out</button></div>`;
    return h;
  }
  return `<p class="mug-count">The draw is done.</p>${P.leftovers ? P.leftovers() : ''}<div class="draw-btns"><button class="btn big red" data-act="drawfinish">${esc(P.finishLabel || 'Get the dice out')}</button></div>`;
}
export function refreshMug() {
  const svg = $('#mugsvg'); if (svg) svg.outerHTML = mugSVG(P.left(), P.start());
  const c = $('#drawctl'); if (c) c.innerHTML = ctlHTML();
}
function caption(txt) { const c = $('#caption'); if (c) { c.textContent = txt; c.classList.toggle('on', !!txt); } }
function reveal(name, ms) {
  const el = $('#slip'); if (!el) return;
  el.textContent = name; el.classList.remove('show'); void el.offsetWidth;
  el.style.setProperty('--dur', ms + 'ms'); el.classList.add('show');
  const mug = $('#mugsvg'); if (mug) { mug.classList.remove('shake'); void mug.offsetWidth; mug.classList.add('shake'); }
  SND.unfold();
}
export async function pull(animated, byHand, chosen) {
  if (!P || P.done()) return;
  const sp = speed();
  const ms = byHand ? Math.max(sp.pull, 900) : sp.pull;
  const anim = animated && ms > 0;
  const res = P.pull(chosen);
  if (anim && res.before) { caption(res.before); await sleep(Math.min(1100, ms * 0.55)); }
  if (anim) { reveal(nameOf(res.id), ms); await sleep(ms * 0.72); }
  const el = document.getElementById(res.dest);
  if (el) {
    el.outerHTML = P.destRowHTML(res.dest);
    const nel = document.getElementById(res.dest);
    if (nel) {
      const mark = nel.querySelector('.filled:last-of-type') || nel;
      mark.classList.add('fresh');
      if (anim) nel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  caption(res.after || '');
  if (spread) { spread = spread.filter(x => x !== res.id); if (!spread.length || P.done()) spread = null; }
  refreshMug();
  if (anim) await sleep(ms * 0.28);
}
export async function keepPulling() {
  if (app.auto) { app.auto = false; return; }
  if (app.busy) return;
  if (speed().pull === 0) { P.tip(); return true; }
  app.auto = true; app.busy = true; refreshMug();
  while (app.auto && P && !P.done()) await pull(true, false);
  app.auto = false; app.busy = false;
  if (P) refreshMug();
}
export function openSpread() { spread = shuffle(P.mugIds().slice()).slice(0, 18); refreshMug(); }
export async function pickFromSpread(k) {
  if (!spread || app.busy) return;
  const id = spread[k]; if (!id) return;
  app.busy = true; await pull(true, true, id); app.busy = false;
  if (P) refreshMug();
}
