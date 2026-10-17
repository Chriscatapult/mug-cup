// The results card: a sheet of squared maths paper taped inside the front cover.
// The red (home) die picks the row, the blue (away) die picks the square. While a die
// tumbles, the highlight follows whatever face it's showing, then locks where it lands.
import { esc } from './dom.js';
import { nameOf } from '../engine/env.js';
import { R, scoreOf } from '../engine/rules.js';

const res = ([h, a]) => (h > a ? 'hw' : h === a ? 'dr' : 'aw');
const sc = ([h, a]) => `${h}–${a}`;
const head = () => `<thead><tr><th class="corner"><span class="hd">home</span> <span class="ad">away</span></th>${Array.from({ length: 10 }, (_, c) => `<th class="ad" data-c="${c + 1}">${c + 1}</th>`).join('')}</tr></thead>`;

// A match's card. Before the home die: plain. After it: that row lit up as wins, draws
// and defeats (form bonus included). After the away die: the square circled.
export function cardHTML(m, i) {
  const card = R().card, hot = m.fh, hit = m.fa && m.fh;
  const bonus = m.fb ? ` (with ${nameOf(m.fp.s === 'h' ? m.h : m.a)}'s +${m.fb} from the form die)` : '';
  let cap;
  if (!m.fh) cap = m.fp && !m.ff ? 'The form die first. Then the <b class="hd">red die</b> picks the row.' : 'The <b class="hd">red die</b> picks the row.';
  else if (!m.fa) cap = `Row ${m.fh}. Now the <b class="ad">blue die</b> picks the square${bonus ? `. Scores shown${esc(bonus)}` : ''}.`;
  else { const s = scoreOf(m); cap = `Row ${m.fh}, square ${m.fa}: <b>${s[0]}–${s[1]}</b>${esc(bonus)}.`; }
  const rows = card.map((row, r) => {
    const isHot = hot === r + 1;
    return `<tr data-r="${r + 1}" class="${isHot ? 'hot' : ''}"><th class="hd">${r + 1}</th>${row.map((cell, c) => {
      const shown = isHot ? scoreOf(m, c + 1) : cell;
      const cls = [isHot ? res(shown) : '', hit && isHot && m.fa === c + 1 ? 'hit' : ''].filter(Boolean).join(' ');
      return `<td data-c="${c + 1}"${cls ? ` class="${cls}"` : ''}>${sc(shown)}</td>`;
    }).join('')}</tr>`;
  }).join('');
  const legend = hot ? `<p class="rc-key"><span class="hw">${esc(nameOf(m.h))} win</span><span class="dr">draw</span><span class="aw">${esc(nameOf(m.a))} win</span></p>` : '';
  return `<div class="rcard-wrap" id="rc-${i}"><p class="rc-cap">${cap}</p>
    <div class="rc-scroll"><table class="rcard">${head()}<tbody>${rows}</tbody></table></div>${legend}${m.pk || m.pkOpen ? pensHTML(m) : ''}</div>`;
}
export function pensHTML(m) {
  const pens = R().pens;
  const key = m ? `<p class="rc-key"><span class="hw">${esc(nameOf(m.h))} win</span><span class="aw">${esc(nameOf(m.a))} win</span></p>` : '';
  return `<div class="pens"><p class="rc-cap">The penalty card. One roll of the <b class="pd">green die</b>.</p><div class="pstrip">${pens.map((e, k) =>
    `<span class="pc ${e[0] === 'h' ? 'hw' : 'aw'}${m && m.pk && m.pk.f === k + 1 ? ' hit' : ''}" data-p="${k + 1}"><b>${k + 1}</b><span class="ps">${e[1]}–${e[2]}</span></span>`).join('')}</div>${key}</div>`;
}
// The whole card on its own, for the overlay.
export function fullCardHTML(rules, title) {
  const rows = rules.card.map((row, r) => `<tr><th class="hd">${r + 1}</th>${row.map(cell => `<td class="${res(cell)}">${sc(cell)}</td>`).join('')}</tr>`).join('');
  return `<div class="help-card cardview"><h2>${esc(title || 'The results card')}</h2>
    <p class="rc-cap">Red die down the side picks the row, blue die along the top picks the square. Scores are home first.</p>
    <div class="rc-scroll"><table class="rcard all">${head()}<tbody>${rows}</tbody></table></div>
    <p class="rc-key"><span class="hw">home win</span><span class="dr">draw</span><span class="aw">away win</span></p>
    <div class="pens"><p class="rc-cap">The penalty card, for level cup ties.</p><div class="pstrip">${rules.pens.map((e, k) => `<span class="pc ${e[0] === 'h' ? 'hw' : 'aw'}"><b>${k + 1}</b><span class="pw">${e[0] === 'h' ? 'Home' : 'Away'}</span><span class="ps">${e[1]}–${e[2]}</span></span>`).join('')}</div></div>
    <button class="btn ghost small close" data-act="closeov" style="position:absolute;top:-14px;right:-8px">Close</button></div>`;
}
// Following a tumbling die across the card.
export function scan(wrap, side, f, landed) {
  if (!wrap) return;
  if (side === 'h') {
    wrap.querySelectorAll('tbody tr').forEach(tr => tr.classList.toggle('scan', +tr.dataset.r === f));
  } else if (side === 'a') {
    const tr = wrap.querySelector('tbody tr.hot');
    if (tr) tr.querySelectorAll('td').forEach(td => td.classList.toggle('scan', +td.dataset.c === f));
    wrap.querySelectorAll('thead th.ad').forEach(th => th.classList.toggle('scan', +th.dataset.c === f));
  } else if (side === 'p') {
    wrap.querySelectorAll('.pc').forEach(pc => pc.classList.toggle('scan', +pc.dataset.p === f));
  }
  if (landed) wrap.querySelectorAll('.scan').forEach(x => x.classList.add('locked'));
}
