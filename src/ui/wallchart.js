// The wallchart: a poster pinned to the bedroom wall, filling in as the tournament goes.
import { esc } from './dom.js';
import { TROPHY } from './pieces.js';
import { plural } from '../engine/util.js';

function wcTie(t) {
  const hw = t[4] === 0, aw = t[4] === 1, sc = v => v === null || v === undefined ? '' : v;
  const mk = m => m === '*' ? '*' : m === 'a' ? ' (a)' : m === 'r' ? ' (r)' : m === 'p' ? ' (p)' : '';
  return `<div class="wc-tie"><div class="r ${hw ? 'w' : aw ? 'l' : ''}"><span>${esc(t[0])}</span><b>${sc(t[2])}${hw ? mk(t[5]) : ''}</b></div><div class="r ${aw ? 'w' : hw ? 'l' : ''}"><span>${esc(t[1])}</span><b>${sc(t[3])}${aw ? mk(t[5]) : ''}</b></div></div>`;
}
function wcEmpty(k) {
  let h = ''; const n = Math.min(k, 16);
  for (let i = 0; i < n; i++) h += '<div class="wc-tie empty"><div class="r"><span>…</span></div><div class="r"><span>…</span></div></div>';
  if (k > n) h += `<p class="wc-more">and ${k - n} more ties</p>`;
  return h;
}
export function wallchartHTML(s, sub) {
  let cols = '';
  s.cols.forEach(c => {
    if (c.kind === 'groups') {
      let body;
      if (c.groups.length) body = c.groups.map(g => `<div class="wc-g"><b>${g.n === 'The League' ? 'The League' : 'Group ' + esc(g.n)}</b>${g.rows.slice(0, 24).map((r, i) => `<span class="${i < (g.q || 2) && g.done ? 'q' : ''}">${esc(r[0])}<i>${r[1]}</i></span>`).join('')}${g.rows.length > 24 ? `<span>and ${g.rows.length - 24} more</span>` : ''}</div>`).join('');
      else { const n = Math.min(c.ph.G, 12); body = Array.from({ length: n }, () => `<div class="wc-g empty">${Array.from({ length: Math.min(c.ph.size, 6) }, () => '<span>…</span>').join('')}</div>`).join('') + (c.ph.G > n ? `<p class="wc-more">and ${c.ph.G - n} more groups</p>` : ''); }
      cols += `<div class="wc-col${c.groups.length === 1 ? ' wide' : ''}"><h4>${esc(c.title)}</h4><div class="wc-body">${body}</div></div>`;
    } else {
      const empty = Math.max(0, c.planned - c.ties.length);
      cols += `<div class="wc-col"><h4>${esc(c.name.replace(/^The /, ''))}</h4><div class="wc-body">${c.ties.map(wcTie).join('')}${wcEmpty(empty)}${c.byes ? `<p class="wc-more">${plural(c.byes, 'bye')}</p>` : ''}</div></div>`;
    }
  });
  cols += `<div class="wc-col"><h4>Winners</h4><div class="wc-body"><div class="wc-champ">${TROPHY}<p>${s.champ ? esc(s.champ) : '?'}</p></div></div></div>`;
  return posterHTML('The wallchart', sub || s.name, `<div class="wc-scroll"><div class="wc-cols">${cols}</div></div>`,
    'Highlighted names went through. * extra dice, (p) penalties, (a) away goals, (r) after a replay. Each round is a fresh draw from the mug, so it fills in as you go.');
}
// A season "wallchart": the four shelves of a region, side by side.
export function ladderHTML(title, sub, shelves) {
  const body = shelves.map(sh => `<div class="wc-col wide"><h4>${esc(sh.name)}</h4><div class="wc-body top"><div class="wc-g">${sh.rows.map((r, i) => `<span class="${sh.zone(i)}">${i + 1}. ${esc(r[0])}<i>${r[1]}</i></span>`).join('')}</div></div></div>`).join('');
  return posterHTML(title, sub, `<div class="wc-scroll"><div class="wc-cols">${body}</div></div>`, 'Green: going up or into the world tournaments. Red: going down.');
}
function posterHTML(title, sub, inner, foot) {
  const pins = '<span class="pin" style="left:8px;top:-6px"></span><span class="pin" style="right:8px;top:-6px"></span><span class="pin" style="left:8px;bottom:-6px"></span><span class="pin" style="right:8px;bottom:-6px"></span>';
  return `<div class="board"><span class="board-btns"><button class="btn ghost small" data-act="printwall">Print it</button><button class="btn ghost small close" data-act="closeov">Take it down</button></span><div class="poster">${pins}
    <h2>${esc(title)}</h2><p class="wc-sub">${esc(sub)}</p>${inner}<p class="wc-foot">${esc(foot)}</p></div></div>`;
}
