export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function setHTML(sel, html) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.innerHTML = html; return el; }
export function replaceEl(id, html) {
  const el = document.getElementById(id); if (!el) return null;
  el.outerHTML = html; return document.getElementById(id);
}
export const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fmtDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
