// Drawn bits: dice, the mug, the trophy, margin doodles.
import { esc } from './dom.js';
import { d6 } from '../engine/util.js';
import { sleep } from './dom.js';

const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function pipsHTML(face) { const on = PIPS[face || 0]; let h = ''; for (let i = 0; i < 9; i++) h += `<span class="pip${on.includes(i) ? ' on' : ''}"></span>`; return h; }
export const dieHTML = (cls, face) => `<div class="die ${cls}${face ? '' : ' blank'}" data-face="${face || 0}" aria-hidden="true">${pipsHTML(face)}</div>`;
export const grabDieHTML = (cls, kind, i, label) => `<div class="die ${cls} blank grab" data-grab="${kind}" data-i="${i}" role="button" tabindex="0" aria-label="${esc(label)}">${pipsHTML(0)}</div>`;
// A ten-sided die, drawn as the kite-shaped face you see from above. cls: 'h' (red), 'a' (blue) or 'pen' (green).
const KITE = '<svg viewBox="0 0 44 48" aria-hidden="true"><path class="k-out" d="M22 2L42 19L22 46L2 19Z"/><path class="k-face" d="M22 3L11 21L22 31L33 21Z"/><path class="k-line" d="M2 19L11 21M42 19L33 21M22 31V46"/></svg>';
export const d10HTML = (cls, face) => `<div class="die d10 ${cls}${face ? '' : ' blank'}" data-face="${face || 0}" aria-hidden="true">${KITE}<span class="num">${face || ''}</span></div>`;
export const grabD10HTML = (cls, kind, i, label) => `<div class="die d10 ${cls} blank grab" data-grab="${kind}" data-i="${i}" role="button" tabindex="0" aria-label="${esc(label)}">${KITE}<span class="num"></span></div>`;
export const waitD10HTML = cls => `<div class="die d10 ${cls} blank wait" aria-hidden="true">${KITE}<span class="num"></span></div>`;
// The form die: a homemade six-sided die with stickers on. faces: what each side is worth.
export const fdieHTML = (label, grab, i) => grab
  ? `<div class="die fdie blank grab" data-grab="f" data-i="${i}" role="button" tabindex="0" aria-label="Throw the form die"><span class="num">?</span></div>`
  : `<div class="die fdie" aria-hidden="true"><span class="num">${esc(label)}</span></div>`;
export function setFace(el, face, label) {
  el.dataset.face = face; el.classList.remove('blank');
  const num = el.querySelector('.num');
  if (num) { num.textContent = label ? label(face) : face; return; }
  const on = PIPS[face];
  el.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', on.includes(i)));
}
// opts: { sides, label(face) for the sticker die, onFace(face, landed) to follow the tumble }
export async function rollDie(el, face, ms, opts = {}) {
  if (!el) return;
  const n = opts.sides || 6;
  el.classList.remove('blank', 'landed', 'grab', 'next', 'shaking', 'wait'); el.classList.add('rolling');
  el.removeAttribute('data-grab'); el.removeAttribute('tabindex'); el.removeAttribute('role');
  const t0 = performance.now(); let step = 55, last = 0;
  while (performance.now() - t0 < ms) {
    let f = 1 + Math.floor(Math.random() * n); if (f === last && n > 1) f = f % n + 1;
    last = f; setFace(el, f, opts.label); if (opts.onFace) opts.onFace(f, false);
    await sleep(step); step *= 1.1;
  }
  setFace(el, face, opts.label); if (opts.onFace) opts.onFace(face, true);
  el.classList.remove('rolling'); void el.offsetWidth; el.classList.add('landed');
}

function flower(c) { let p = ''; for (let i = 0; i < 6; i++) p += `<ellipse cx="0" cy="-8" rx="4.5" ry="8" fill="${c}" stroke="#a88f78" stroke-width="1" transform="rotate(${i * 60})"/>`; return p + `<circle r="4" fill="#e4b54f" stroke="#a97d22"/>`; }
// left, start: slips in the mug now and at the start of the draw
export function mugSVG(left, start) {
  const cols = ['#fffdf6', '#fff4c4', '#fde0d8', '#e0eef7', '#e5f0dc', '#fffdf6', '#fff4c4', '#fde0d8'];
  const pos = [[62, -16], [82, 8], [100, -8], [118, 12], [136, -6], [74, -2], [112, -18], [128, 6]];
  const show = Math.min(8, Math.ceil(left / Math.max(1, (start || 8) / 8)));
  let slips = '';
  pos.forEach(([x, r], i) => {
    slips += `<g class="mslip" style="opacity:${i < show ? 1 : 0}" transform="rotate(${r} ${x + 11} 90)"><rect x="${x}" y="${22 + (i % 3) * 9}" width="22" height="70" rx="1.5" fill="${cols[i]}" stroke="#cbbd9e" stroke-width="1.2"/><path d="M${x + 2} ${34 + (i % 3) * 9}h18" stroke="#cbbd9e" stroke-width="1"/></g>`;
  });
  return `<svg class="mug-svg" id="mugsvg" viewBox="0 0 230 230" aria-hidden="true">
    <ellipse cx="102" cy="222" rx="80" ry="7" fill="rgba(40,30,20,.22)"/>
    <ellipse cx="102" cy="82" rx="68" ry="12" fill="#6a5238"/>
    ${slips}
    <path d="M170 104c44-6 46 68 0 64" fill="none" stroke="#5b4632" stroke-width="15" stroke-linecap="round"/>
    <path d="M170 104c44-6 46 68 0 64" fill="none" stroke="#f5ecd8" stroke-width="9" stroke-linecap="round"/>
    <path d="M34 82h136v96c0 26-18 42-42 42H76c-24 0-42-16-42-42z" fill="#f5ecd8" stroke="#5b4632" stroke-width="3"/>
    <path d="M36 168h132" stroke="#3f7cac" stroke-width="9"/><path d="M36 178h132" stroke="#3f7cac" stroke-width="2.5"/>
    <g transform="translate(70 124)">${flower('#eab9b0')}</g>
    <g transform="translate(104 112) scale(.75)">${flower('#fffdf6')}</g>
    <g transform="translate(136 130) scale(.9)">${flower('#e4b54f')}</g>
    <path d="M58 142c6 10 14 12 22 8M122 130c8 2 12 10 10 18" fill="none" stroke="#6f8c6b" stroke-width="2"/>
    <path d="M34 82c0 9 30 13 68 13s68-4 68-13" fill="none" stroke="#5b4632" stroke-width="3"/>
    <path d="M52 100c-4 22-4 50 0 72" stroke="rgba(255,255,255,.7)" stroke-width="6" stroke-linecap="round" fill="none"/>
  </svg>`;
}
export const TROPHY = `<svg class="trophy" viewBox="0 0 160 180" aria-hidden="true">
  <path d="M48 26c-30-2-34 40 4 46M112 26c30-2 34 40-4 46" fill="none" stroke="#7a5a22" stroke-width="7"/>
  <path d="M48 26c-30-2-34 40 4 46M112 26c30-2 34 40-4 46" fill="none" stroke="#e4b54f" stroke-width="3"/>
  <path d="M42 18h76v34c0 30-17 52-38 52S42 82 42 52z" fill="#e4b54f" stroke="#7a5a22" stroke-width="3"/>
  <path d="M56 28c-2 22 2 40 12 56" stroke="rgba(255,255,255,.65)" stroke-width="6" stroke-linecap="round" fill="none"/>
  <ellipse cx="80" cy="18" rx="38" ry="6" fill="#f1cd78" stroke="#7a5a22" stroke-width="3"/>
  <rect x="72" y="102" width="16" height="22" fill="#e4b54f" stroke="#7a5a22" stroke-width="3"/>
  <path d="M52 124h56l7 22H45z" fill="#7d5c35" stroke="#4e3920" stroke-width="3"/>
  <rect x="38" y="146" width="84" height="16" rx="2" fill="#5b4632"/>
  <path d="M118 44l18 40-8-2-4 8-14-40" fill="#3f7cac" stroke="#2b5878" stroke-width="2"/>
  <path d="M42 44l-18 40 8-2 4 8 14-40" fill="#d9534a" stroke="#9e352e" stroke-width="2"/>
</svg>`;
export const SPEAKER = on => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3.5v11L6 12H3z" fill="#fffaf0" stroke="#3b2d22" stroke-width="1.5" stroke-linejoin="round"/>${on ? '<path d="M13 7c1.3 1.6 1.3 4.4 0 6M15.2 5c2.4 2.8 2.4 7.2 0 10" fill="none" stroke="#3b2d22" stroke-width="1.5" stroke-linecap="round"/>' : '<path d="M13 8l4 4M17 8l-4 4" stroke="#c0392b" stroke-width="1.7" stroke-linecap="round"/>'}</svg>`;

// Biro doodles for the margin of the exercise book.
const DOODLES = [
  // football
  `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M20 12l7 5-3 8h-8l-3-8z" fill="currentColor" opacity=".8"/><path d="M20 12V5M27 17l7-3M24 25l4 7M16 25l-4 7M13 17l-7-3" stroke="currentColor" stroke-width="1.3"/></svg>`,
  // stick-man goalie diving
  `<svg viewBox="0 0 60 40"><rect x="4" y="6" width="52" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1 0"/><path d="M4 6l6 6h40l6-6M10 12v24M50 12v24" stroke="currentColor" stroke-width=".8" fill="none"/><circle cx="20" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M22 19l14 6M28 22l-4 8M30 23l6-6M26 21l-8-4" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="44" cy="15" r="2.5" fill="currentColor"/></svg>`,
  // star
  `<svg viewBox="0 0 40 40"><path d="M20 4l4.5 10.5 11 1-8.5 7.5 2.7 11L20 28l-9.7 6 2.7-11L4.5 15.5l11-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  // shield badge attempt
  `<svg viewBox="0 0 40 44"><path d="M6 6h28v14c0 10-7 17-14 20C13 37 6 30 6 20z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 16h28M20 6v34" stroke="currentColor" stroke-width="1.2"/><path d="M11 10l3 3M26 24l4 4" stroke="currentColor" stroke-width="1.2"/></svg>`,
  // arrow and "1-0"
  `<svg viewBox="0 0 60 30"><path d="M4 22c10-14 26-16 40-10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M40 7l5 5-7 2" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="44" y="28" font-family="Caveat,cursive" font-size="14" fill="currentColor">1-0</text></svg>`,
  // little trophy
  `<svg viewBox="0 0 40 44"><path d="M12 6h16v8c0 7-4 11-8 11s-8-4-8-11z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 9c-6 0-6 8 1 9M28 9c6 0 6 8-1 9M20 25v7M13 38h14l-2-6H15z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
];
export function doodlesHTML(seed = 0, n = 3) {
  let h = '';
  for (let k = 0; k < n; k++) {
    const i = (seed * 7 + k * 3) % DOODLES.length;
    const top = 14 + ((seed * 13 + k * 31) % 70);
    const rot = ((seed + k * 5) % 21) - 10;
    h += `<span class="doodle" style="top:${top}%;transform:rotate(${rot}deg)">${DOODLES[i]}</span>`;
  }
  return `<div class="doodles" aria-hidden="true">${h}</div>`;
}
// Torn slips falling for a winner.
export function confettiHTML(n = 26) {
  const cols = ['#fffdf6', '#fff4c4', '#fde0d8', '#e0eef7', '#e5f0dc'];
  let h = '';
  for (let i = 0; i < n; i++) {
    const w = 10 + Math.random() * 14, hgt = 6 + Math.random() * 8;
    h += `<span class="slipfall" style="left:${Math.random() * 100}%;width:${w}px;height:${hgt}px;background:${cols[i % cols.length]};animation-duration:${5 + Math.random() * 6}s;animation-delay:${-Math.random() * 9}s"></span>`;
  }
  return `<div class="confetti" aria-hidden="true">${h}</div>`;
}
