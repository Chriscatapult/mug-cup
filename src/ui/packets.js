// Packets of slips: tick the ones that go in the mug, look inside to cross teams out.
import { app, available } from './state.js';
import { esc } from './dom.js';

export const openPackets = new Set();
const TIERS = { 1: 'giants', 2: 'big clubs', 3: 'solid', 4: 'smaller', 5: 'minnows' };
export function packetsHTML(key) {
  const pools = app.S[key] || app.S.pools, off = new Set(app.S.off);
  const html = app.data.packets.map(p => {
    const on = pools.includes(p.id), ts = app.data.teams.filter(t => t.p === p.id);
    const live = ts.filter(t => !off.has(t.id)).length;
    const byC = {};
    ts.forEach(t => { (byC[t.c] = byC[t.c] || []).push(t); });
    const inside = Object.entries(byC).map(([c, list]) => `${Object.keys(byC).length > 1 ? `<p class="country">${esc(c)}</p>` : ''}<div class="slips">${list.map(t => `<button class="slip-chip${off.has(t.id) ? ' off' : ''}" data-act="slip" data-id="${t.id}" title="${esc(TIERS[t.t])}${off.has(t.id) ? ', crossed out' : ''}">${esc(t.n)}</button>`).join('')}</div>`).join('');
    return `<div class="packet${on ? '' : ' off'}">
      <button class="packet-head" data-act="pool" data-k="${key}" data-id="${p.id}" aria-pressed="${on}">
        <span class="tick">${on ? '✓' : ''}</span>
        <span><span class="packet-name">${esc(p.name)}</span><span class="packet-sub">${esc(p.sub)}</span><span class="packet-count">${live} slips</span></span>
      </button>
      <details data-pool="${p.id}"${openPackets.has(p.id) ? ' open' : ''}><summary>look inside the packet</summary>${inside}</details></div>`;
  }).join('');
  const custom = `<div class="packet">
    <div class="packet-head" style="cursor:inherit"><span class="tick">✎</span>
    <span><span class="packet-name">Your own slips</span><span class="packet-sub">Your school team, your Sunday league side, your dad's pub team</span><span class="packet-count">${app.S.custom.length} slips</span></span></div>
    <div class="custom-row"><input id="customIn" maxlength="40" placeholder="write a team…" aria-label="Team name"><button class="btn small" data-act="addc">Add</button></div>
    <div class="slips">${app.S.custom.map((n, i) => `<button class="slip-chip" data-act="rmc" data-i="${i}" title="Tear it up">${esc(n)}<span class="x">×</span></button>`).join('')}</div></div>`;
  return `<div class="packets">${html}${custom}</div>`;
}
export const availableFor = key => available(app.S[key] || app.S.pools);
