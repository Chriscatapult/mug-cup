// The Mug Cup: start-up, routing, and everything you can click, hold or press.
import { app, saveS, saveCup, saveSeason, saveH, saveHonours, saveAll, loadAll, syncTeams, allTeams, available, slug } from './ui/state.js';
import * as store from './ui/store.js';
import { $, esc, sleep, setHTML } from './ui/dom.js';
import { SND, sound } from './ui/sound.js';
import { SPEAKER, doodlesHTML } from './ui/pieces.js';
import * as D from './ui/draw.js';
import * as PL from './ui/play.js';
import { openPackets } from './ui/packets.js';
import { quickDraw, startCup, cupSetupHTML, cupProvider, cupSession, winnersHTML, cupPageSpec } from './ui/cupmode.js';
import * as SM from './ui/seasonmode.js';
import { homeHTML, bookHTML, almanacHTML, drawerHTML, sheetEdHTML, setSheet, setAlm, clubCard, setBookRegion } from './ui/views.js';
import { wallchartHTML, ladderHTML } from './ui/wallchart.js';
import { sharePage, nativeShare } from './ui/share.js';
import { env, setEnv, nameOf, team } from './engine/env.js';
import { newAlmanac } from './engine/almanac.js';
import * as C from './engine/competition.js';
import { PRESETS } from './engine/presets.js';
import { clone, pow2floor } from './engine/util.js';

/* ---------- routing ---------- */
const TABS = [['home', 'The floor'], ['mug', 'The mug'], ['book', 'The book'], ['almanac', 'The almanac'], ['drawer', 'The drawer']];
const tabOf = v => v === 'cupsetup' || v === 'seasonsetup' ? 'home' : v;
let bookShow = null;
function renderTabs() {
  const wallOK = (app.active === 'cup' && app.cup) || (app.active === 'season' && app.season && app.season.phase !== 'draw' && app.season.phase !== 'pick');
  setHTML('#tabs', TABS.map(([v, l]) => `<button class="tab${tabOf(app.view) === v ? ' on' : ''}" data-act="go" data-v="${v}" ${tabOf(app.view) === v ? 'aria-current="page"' : ''}>${l}</button>`).join('') +
    `<span class="tools">${wallOK ? '<button class="tool-btn" data-act="wall" title="Wallchart (W)">Wallchart</button>' : ''}<button class="tool-btn${app.S.sound ? '' : ' off'}" data-act="sound" title="Sound (M)" aria-pressed="${app.S.sound}">${SPEAKER(app.S.sound)}<span>${app.S.sound ? 'Sound on' : 'Sound off'}</span></button><button class="tool-btn" data-act="help" title="Keys (?)" aria-label="Keyboard keys">?</button></span>`);
}
function mugHTML() {
  PL.setSession(null); D.setProvider(null);
  if (app.active === 'season' && app.season) {
    const v = SM.seasonView(render);
    if (v.kind === 'draw') { D.setProvider(v.provider); return D.drawHTML(); }
    if (v.kind === 'play') { PL.setSession(v.session); return PL.playHTML(); }
    return v.html;
  }
  if (app.cup) {
    app.active = 'cup';
    if (app.cup.phase === 'draw') { D.setProvider(cupProvider(render)); return D.drawHTML(); }
    if (app.cup.phase === 'play') { PL.setSession(cupSession(render)); return PL.playHTML(); }
    return winnersHTML(app.cup, { kicker: app.cup.quick ? 'The quick draw' : '' });
  }
  return `<div class="empty-state"><h2 class="round-title">The mug is empty</h2><p class="sub">Tip in a quick draw, build a cup or start a season.</p><p><button class="btn" data-act="go" data-v="home">Back to the floor</button></p></div>`;
}
let viewSeed = 0;
export function render() {
  renderTabs();
  let h = '';
  if (app.view === 'home') h = homeHTML();
  else if (app.view === 'cupsetup') h = cupSetupHTML();
  else if (app.view === 'seasonsetup') h = SM.seasonSetupHTML();
  else if (app.view === 'mug') h = mugHTML();
  else if (app.view === 'book') h = bookHTML(bookShow);
  else if (app.view === 'almanac') h = almanacHTML();
  else if (app.view === 'drawer') h = drawerHTML();
  if (app.view !== 'mug') { PL.setSession(null); D.setProvider(null); }
  const flash = app.flash ? `<div class="resume tape flash"><p>${app.flash}</p></div>` : '';
  app.flash = '';
  setHTML('#main', flash + h);
  setHTML('#doodles', doodlesHTML(viewSeed, 3));
  PL.markNext();
}
function go(v, mode) {
  if (mode) app.active = mode;
  if (v !== app.view) viewSeed++;
  app.view = v; app.auto = false;
  render(); window.scrollTo({ top: 0 });
}

/* ---------- overlays ---------- */
function closeOverlay() { const o = $('#overlay'); if (o) { const u = o.dataset.url; if (u) URL.revokeObjectURL(u); o.remove(); } }
function openOverlay(inner, cls = '') {
  closeOverlay();
  const o = document.createElement('div');
  o.className = 'overlay ' + cls; o.id = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  o.innerHTML = inner;
  o.addEventListener('click', e => { if (e.target === o) closeOverlay(); });
  document.body.appendChild(o);
  const c = o.querySelector('.close'); if (c) c.focus();
  return o;
}
function openWall() {
  if (app.active === 'season' && app.season && app.season.phase === 'run') {
    const st = app.season.calendar[app.season.step];
    if (st.k === 'world') return openOverlay(wallchartHTML(C.snapshot(app.season.world[st.which])));
    const L = SM.ladderData();
    return openOverlay(ladderHTML(L.title, L.sub, L.shelves));
  }
  if (app.active === 'season' && app.season && app.season.phase === 'end') { const L = SM.ladderData(); return openOverlay(ladderHTML(L.title, L.sub, L.shelves)); }
  if (app.cup) openOverlay(wallchartHTML(C.snapshot(app.cup)));
}
function openHelp() {
  openOverlay(`<div class="help-card"><h2>Keys</h2><dl>
    <dt><kbd>W</kbd></dt><dd>Pin up the wallchart</dd><dt><kbd>M</kbd></dt><dd>Sound on or off</dd>
    <dt><kbd>Enter</kbd></dt><dd>Pull or throw whatever you've tabbed to</dd><dt><kbd>Esc</kbd></dt><dd>Take down whatever's pinned up</dd>
    ${app.S.shortcuts ? `<dt><kbd>Space</kbd></dt><dd>Pull a slip, or throw the next die</dd><dt><kbd>R</kbd></dt><dd>Roll the next whole match</dd>
    <dt><kbd>A</kbd></dt><dd>Keep pulling, or roll them all (again to stop)</dd><dt><kbd>T</kbd></dt><dd>Tip the whole mug out</dd><dt><kbd>N</kbd></dt><dd>On to the next round</dd>` : ''}</dl>
    ${app.S.shortcuts ? '<button class="btn ghost small" data-act="shortcuts" data-v="0">Go back to all by hand</button>' : '<p style="margin:0 0 12px;font-size:17px">Want the mug and dice to do the work sometimes? Shortcuts add Space, R, A, T and N.</p><button class="btn small" data-act="shortcuts" data-v="1">Turn on shortcuts</button>'}
    <button class="btn ghost small close" data-act="closeov" style="position:absolute;top:-14px;right:-8px">Close</button></div>`);
}
async function tearOut(spec, filename) {
  if (!spec) return;
  const o = openOverlay('<div class="help-card tear"><h2>Tearing out the page…</h2></div>');
  const page = await sharePage(spec, filename);
  o.dataset.url = page.url;
  const canShare = !!(navigator.canShare && navigator.share);
  o.innerHTML = `<div class="tear-card"><img src="${page.url}" alt="${esc(spec.title)}: a page torn out of the book">
    <p class="tear-btns"><a class="btn red" href="${page.url}" download="${esc(page.filename)}">Save the picture</a>${canShare ? '<button class="btn" data-act="sharepage">Send it to someone</button>' : ''}<button class="btn ghost close" data-act="closeov">Put it back</button></p></div>`;
  o._page = page; o._text = spec.title;
}
const say = msg => { const m = $('#drawerMsg') || $('#sheetMsg'); if (m) m.textContent = msg; else { app.flash = esc(msg); render(); } };
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) { /* nothing */ } ta.remove(); return ok;
  }
}

/* ---------- save files and links ---------- */
function exportAll() {
  saveAll();
  const data = { app: 'mug-cup', v: 2, saved: new Date().toISOString(), settings: app.S, cup: app.cup, season: app.season, honours: app.honours, almanac: app.H };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mug-cup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  say('Saved. Check your downloads.');
}
function importFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (d.app !== 'mug-cup') throw new Error('not ours');
      if (!confirm('Load this save file? It replaces everything on this device.')) return;
      if (d.settings) app.S = Object.assign(app.S, d.settings);
      app.cup = d.cup && d.cup.v === 4 ? d.cup : null;
      app.season = d.season && d.season.v === 1 ? d.season : null;
      app.H = d.almanac && d.almanac.v === 2 ? d.almanac : newAlmanac();
      app.honours = d.honours || [];
      syncTeams(); saveAll(); closeOverlay();
      app.flash = 'Save file loaded.'; go('home');
    } catch (e) { say("That file isn't a Mug Cup save."); }
  };
  rd.readAsText(file);
}
function resultsText() {
  const c = app.cup, lines = [`${c.name}${c.champion ? `, won by ${nameOf(c.champion)}` : ''}`];
  if (c.finalText) lines.push(c.finalText);
  c.stages.slice().reverse().forEach(st => { if (st && st.type === 'ko') st.rounds.slice().reverse().forEach(r => {
    const res = r.ties.filter(t => t.matches.some(m => m.done)); if (!res.length) return;
    lines.push('', r.name.replace(/^The /, ''));
    res.forEach(t => t.matches.filter(m => m.done).forEach(m => lines.push(`${nameOf(m.h)} ${m.hs}-${m.as} ${nameOf(m.a)}${m.x.length ? ' (extra dice)' : ''}`)));
  }); });
  lines.push('', 'Rolled on The Mug Cup');
  return lines.join('\n');
}
const designLink = () => location.href.split('#')[0] + '#design=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({ n: app.S.name, s: app.S.size, st: app.S.stages })))));
function readDesignFromHash() {
  const m = location.hash.match(/^#design=(.+)$/); if (!m) return false;
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    if (!Array.isArray(d.st) || !d.st.length) return false;
    app.S.stages = d.st.map(s => ({ type: s.type === 'groups' ? 'groups' : 'ko', gsize: +s.gsize || 0, legs: s.legs === 2 ? 2 : 1, adv: +s.adv || 2, pts: s.pts === 2 ? 2 : 3,
      level: ['dice', 'replay', 'away'].includes(s.level) ? s.level : 'dice', final1: !!s.final1, until: s.until === 'fit' ? 'fit' : (+s.until || 1), join: Array.isArray(s.join) ? s.join.map(Number) : [] }));
    app.S.preset = 'custom'; if (d.n) app.S.name = String(d.n).slice(0, 60); if (d.s) app.S.size = d.s === 'all' ? 'all' : +d.s;
    saveS(); app.flash = "Someone shared a cup design with you. It's all set up below.";
    history.replaceState(null, '', location.href.split('#')[0]);
    return true;
  } catch (e) { return false; }
}

/* ---------- clicks ---------- */
const newStage = type => type === 'groups' ? { type: 'groups', gsize: 4, legs: 1, adv: 2, pts: 3, join: [] } : { type: 'ko', legs: 1, level: 'dice', final1: true, until: 1, join: [] };
function confirmThrowAway(game, what) { return !game || confirm(`Start a new ${what}? The one you've got on the go will be thrown away.`); }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const act = b.dataset.act, v = b.dataset.v;
  SND.unlock();
  switch (act) {
    case 'go': closeOverlay(); go(v, b.dataset.mode); break;
    case 'quick':
      if (!confirmThrowAway(app.cup && app.cup.phase !== 'done' ? app.cup : null, 'cup')) return;
      quickDraw(); SND.rustle(0.6); go('mug', 'cup'); break;
    case 'startcup':
      if (!confirmThrowAway(app.cup && app.cup.phase !== 'done' ? app.cup : null, 'cup')) return;
      app.S.name = ($('#tname') && $('#tname').value.trim()) || app.S.name; saveS();
      startCup(); SND.rustle(0.6); go('mug', 'cup'); break;
    case 'startseason':
      if (!confirmThrowAway(app.season, 'season world')) return;
      app.S.sName = ($('#sname') && $('#sname').value.trim()) || app.S.sName; saveS();
      SM.startSeasonDraw(); SND.rustle(0.8); go('mug', 'season'); break;
    case 'pool': { const k = b.dataset.k; app.S[k] = app.S[k] || [...app.S.pools]; const id = b.dataset.id; app.S[k] = app.S[k].includes(id) ? app.S[k].filter(x => x !== id) : app.S[k].concat(id); saveS(); render(); break; }
    case 'slip': { const id = b.dataset.id; app.S.off = app.S.off.includes(id) ? app.S.off.filter(x => x !== id) : app.S.off.concat(id); saveS(); render(); break; }
    case 'addc': addCustom(); break;
    case 'rmc': app.S.custom.splice(+b.dataset.i, 1); saveS(); syncTeams(); render(); break;
    case 'size': app.S.size = v === 'all' ? 'all' : +v; saveS(); render(); break;
    case 'preset':
      if (v !== 'custom') { const p = PRESETS.find(x => x.id === v); app.S.stages = clone(p.stages); const n = available().length; app.S.size = p.size === 'all' || p.size > n ? 'all' : p.size; }
      app.S.preset = v; saveS(); render(); break;
    case 'customise': app.S.preset = 'custom'; saveS(); render(); break;
    case 'addstage': {
      const last = app.S.stages[app.S.stages.length - 1];
      if (last && last.type === 'ko' && last.until === 1) last.until = 'fit';
      if (last && last.type === 'groups' && !last.gsize) last.gsize = 4;
      app.S.stages.push(newStage(v)); app.S.preset = 'custom'; saveS(); render(); break;
    }
    case 'stup': { const i = +b.dataset.i; [app.S.stages[i - 1], app.S.stages[i]] = [app.S.stages[i], app.S.stages[i - 1]]; app.S.preset = 'custom'; saveS(); render(); break; }
    case 'stdown': { const i = +b.dataset.i; [app.S.stages[i + 1], app.S.stages[i]] = [app.S.stages[i], app.S.stages[i + 1]]; app.S.preset = 'custom'; saveS(); render(); break; }
    case 'strm': if (app.S.stages.length > 1) { app.S.stages.splice(+b.dataset.i, 1); app.S.preset = 'custom'; saveS(); render(); } break;
    case 'sregions': app.S.sRegions = +v; saveS(); render(); break;
    case 'sseeded': app.S.sSeeded = v === '1'; saveS(); render(); break;
    case 'speed': app.S.speed = v; saveS(); document.querySelectorAll('[data-act="speed"]').forEach(x => x.classList.toggle('on', x.dataset.v === app.S.speed)); break;
    case 'shortcuts':
      app.S.shortcuts = v === '1'; saveS();
      if ($('#overlay')) openHelp();
      if (app.view === 'mug' && D.provider() && !app.busy) D.refreshMug();
      else if (app.view === 'mug' && PL.session()) PL.refreshBits();
      else render();
      break;
    case 'follow': {
      const id = b.dataset.id;
      app.S.follow = app.S.follow.includes(id) ? app.S.follow.filter(x => x !== id) : app.S.follow.concat(id); saveS();
      if (app.view === 'mug' && PL.session() && !app.busy && !app.auto) render();
      else if (app.view === 'almanac') setHTML('#clubCard', clubCard());
      else if (app.view === 'drawer') render();
      break;
    }
    case 'savesheet': {
      const ta = $('#sheetText'), id = currentSheet; if (!ta || !id) break;
      const list = ta.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).slice(0, 25);
      if (list.length) app.S.squads[id] = list; else delete app.S.squads[id];
      saveS(); setEnv({ custom: app.S.squads }); setHTML('#sheetEd', sheetEdHTML()); const m = $('#sheetMsg'); if (m) m.textContent = 'Saved.'; break;
    }
    case 'resetsheet': delete app.S.squads[currentSheet]; saveS(); setEnv({ custom: app.S.squads }); setHTML('#sheetEd', sheetEdHTML()); break;
    // the mug
    case 'pull': if (app.busy || app.auto) return; app.busy = true; await D.pull(true, false); app.busy = false; if (D.provider()) D.refreshMug(); break;
    case 'keep': if (await D.keepPulling()) render(); break;
    case 'tip': app.auto = false; SND.rustle(0.8); D.provider().tip(); render(); break;
    case 'drawfinish': { const p = D.provider(); SND.clatter(); p.finish(); if (app.active === 'cup') render(); window.scrollTo({ top: 0, behavior: 'smooth' }); break; }
    case 'spread': case 'spreadmore': SND.rustle(0.5); D.openSpread(); break;
    case 'pickslip': await D.pickFromSpread(+b.dataset.k); break;
    // the dice
    case 'rollnext': { const i = PL.nextUnplayed(); if (i >= 0) PL.rollOne(i); break; }
    case 'rollall': PL.rollAll(render); break;
    case 'rollrest': if (!app.busy && !app.auto) { app.busy = true; await PL.rollRest(() => { app.busy = false; render(); }); } break;
    case 'next': {
      if (app.busy) return;
      const s = PL.session(); if (!s) return;
      const wasDone = app.cup && app.cup.phase === 'done';
      s.next();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (app.active === 'cup' && app.cup && app.cup.phase === 'done' && !wasDone) { SND.crowd(true); SND.fanfare(); }
      if (app.active === 'season' && SM && app.season && app.season.calendar[app.season.step]?.k === 'world' && app.season.world[app.season.calendar[app.season.step].which]?.phase === 'done') { SND.crowd(true); SND.fanfare(); }
      break;
    }
    // season
    case 'keepclub': SM.keepClub(); SND.clatter(); render(); break;
    case 'againclub': app.season.pickCandidate = null; saveSeason(); render(); break;
    case 'pickchosen': {
      const val = ($('#pickIn') || {}).value || '';
      const all = app.season.regions.flatMap(rg => rg.divs.flatMap(dv => dv.teams));
      const id = all.find(x => nameOf(x).toLowerCase() === val.trim().toLowerCase());
      if (id) { SM.keepClub(id); render(); }
      break;
    }
    case 'seasonnext': SM.seasonNext(render); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'nextseason': {
      const s = app.season;
      import('./engine/season.js').then(SE => { SE.nextSeason(s); saveSeason(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      break;
    }
    case 'ladder': openWall(); break;
    case 'worldwall': openOverlay(wallchartHTML(C.snapshot(app.season.world[v]))); break;
    case 'tearseason': tearOut(SM.seasonPageSpec(), `${slug(nameOf(app.season.my))}-season.png`); break;
    case 'tearcup': {
      const st = app.active === 'season' && app.season && app.season.calendar[app.season.step];
      const c = st && st.k === 'world' ? app.season.world[st.which] : app.cup;
      tearOut(cupPageSpec(c), `${slug(c.name)}.png`); break;
    }
    case 'sharepage': { const o = $('#overlay'); if (o && o._page) await nativeShare(o._page, o._text); break; }
    // pinned up, saved, shared
    case 'wall': openWall(); break;
    case 'hchart': { const x = app.honours[+b.dataset.i]; if (x && x.chart) openOverlay(wallchartHTML(x.chart)); break; }
    case 'printwall': setTimeout(() => window.print(), 60); break;
    case 'closeov': closeOverlay(); break;
    case 'sound': toggleSound(); break;
    case 'help': openHelp(); break;
    case 'export': exportAll(); break;
    case 'import': { const f = $('#importFile'); if (f) f.click(); break; }
    case 'copyres': say(await copyText(resultsText()) ? 'Copied. Paste it wherever you like.' : "Couldn't copy on this browser."); break;
    case 'sharedesign': { const ok = await copyText(designLink()); app.flash = ok ? 'Link copied. Send it to whoever you like.' : "Couldn't copy on this browser."; render(); break; }
    case 'almsort': setAlm(v); render(); break;
    case 'almclub': setAlm(null, b.dataset.id); render(); { const c = $('#clubCard'); if (c) c.scrollIntoView({ block: 'center' }); } break;
    case 'bookshow': bookShow = v; render(); break;
    case 'clearhon': if (confirm('Rub out every name on the honours board?')) { app.honours = []; saveHonours(); render(); } break;
    case 'clearalm': if (confirm('Wipe the almanac and start the record books again?')) { app.H = newAlmanac(); saveH(); render(); } break;
  }
});
let currentSheet = null;
function toggleSound() { app.S.sound = !app.S.sound; saveS(); renderTabs(); if (app.S.sound) { SND.unlock(); SND.rattle(); } }
function addCustom() {
  const inp = $('#customIn'); if (!inp) return;
  const n = inp.value.trim().replace(/\s+/g, ' ');
  if (!n) return;
  if (!app.S.custom.some(x => slug(x) === slug(n))) app.S.custom.push(n);
  saveS(); syncTeams(); render();
  const again = $('#customIn'); if (again) again.focus();
}

/* ---------- the hand: press, hold, let go ---------- */
let grab = null;
document.addEventListener('pointerdown', e => {
  SND.unlock();
  const g = e.target.closest('[data-grab]');
  if (!g || app.busy || app.auto || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  const kind = g.dataset.grab;
  const shakers = kind === 'x' ? [...g.closest('.xpair').querySelectorAll('.die')] : kind === 'mug' ? [g.closest('.mug-stage') || g] : [g];
  shakers.forEach(s => s.classList.add('shaking'));
  document.body.classList.add('grabbing');
  const tick = () => kind === 'mug' ? SND.rustle(0.25) : SND.rattle();
  tick();
  grab = { kind, i: +g.dataset.i, t0: performance.now(), shakers, timer: setInterval(tick, kind === 'mug' ? 260 : 95) };
  try { g.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
});
function releaseGrab(act) {
  if (!grab) return;
  const G = grab; grab = null;
  clearInterval(G.timer);
  document.body.classList.remove('grabbing');
  G.shakers.forEach(s => s.classList.remove('shaking'));
  if (act) handAction(G.kind, G.i, performance.now() - G.t0);
}
document.addEventListener('pointerup', () => releaseGrab(true));
document.addEventListener('pointercancel', () => releaseGrab(false));
async function handAction(kind, i, held) {
  if (app.busy || app.auto) return;
  if (kind === 'mug') {
    if (app.active === 'season' && app.season && app.season.phase === 'pick') return pickClubByHand();
    if (!D.provider()) return;
    app.busy = true; await D.pull(true, true); app.busy = false;
    if (D.provider()) D.refreshMug();
    return;
  }
  if (PL.session()) PL.handThrow(kind, i, held);
}
async function pickClubByHand() {
  app.busy = true;
  const id = SM.pickRandomClub();
  const el = $('#slip'), ms = Math.max(1400, 0);
  if (el) { el.textContent = nameOf(id); el.style.setProperty('--dur', '1800ms'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); SND.unfold(); await sleep(ms); }
  app.busy = false;
  render();
}

/* ---------- keys ---------- */
function clickAct(a) { const b = document.querySelector(`#main [data-act="${a}"]`); if (b && !b.disabled) b.click(); }
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (e.target.id === 'customIn' && e.key === 'Enter') { e.preventDefault(); addCustom(); return; }
  const g = e.target.closest && e.target.closest('[data-grab]');
  if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); SND.unlock(); handAction(g.dataset.grab, +g.dataset.i, 0); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if (e.key === 'Escape') { closeOverlay(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'w') { $('#overlay') ? closeOverlay() : openWall(); return; }
  if (k === 'm') { toggleSound(); return; }
  if (e.key === '?') { openHelp(); return; }
  if (!app.S.shortcuts || app.view !== 'mug' || $('#overlay')) return;
  SND.unlock();
  if (e.key === ' ') {
    if (/BUTTON|SUMMARY|A/.test(tag)) return;
    e.preventDefault();
    if (D.provider()) clickAct('pull');
    else if (PL.session()) { const n = PL.nextDie(); if (n) PL.handThrow(n.kind, n.i, 0); }
  } else if (k === 'r' && PL.session()) clickAct('rollnext');
  else if (k === 'a') clickAct(D.provider() ? 'keep' : 'rollall');
  else if (k === 't' && D.provider()) clickAct('tip');
  else if (k === 'n') { const b = document.querySelector('#main [data-act="next"], #main [data-act="drawfinish"], #main [data-act="seasonnext"]'); if (b) b.click(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'tname') { app.S.name = e.target.value; saveS(); }
  if (e.target.id === 'sname') { app.S.sName = e.target.value; saveS(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  const find = val => allTeams().find(x => x.n.toLowerCase() === val.trim().toLowerCase());
  if (el.id === 'sheetTeam') {
    const t = find(el.value); currentSheet = t ? t.id : null; setSheet(currentSheet);
    setHTML('#sheetEd', t ? sheetEdHTML() : '<p class="note">No slip with that name. Pick one from the list.</p>');
  } else if (el.id === 'almClub') {
    const t = find(el.value); setAlm(null, t ? t.id : null); setHTML('#clubCard', clubCard());
  } else if (el.id === 'bookRegion') { setBookRegion(+el.value); render(); }
  else if (el.id === 'sizeIn') { const n = Math.round(+el.value); if (n >= 2) { app.S.size = n; saveS(); render(); } }
  else if (el.id === 'importFile' && el.files && el.files[0]) importFile(el.files[0]);
  else if (el.dataset && el.dataset.st !== undefined) {
    const st = app.S.stages[+el.dataset.st], k = el.dataset.k, val = el.value;
    if (k === 'join') st.join = val ? val.split(',').map(Number) : [];
    else if (k === 'until') st.until = val === 'fit' ? 'fit' : +val;
    else if (k === 'final1') st.final1 = val === '1';
    else if (k === 'level') st.level = val;
    else { st[k] = +val; if (k === 'legs' && st.type === 'ko') st.level = st.legs === 2 ? 'away' : 'dice'; }
    app.S.preset = 'custom'; saveS(); render();
  }
});
document.addEventListener('toggle', e => {
  const d = e.target; if (!d.dataset || !d.dataset.pool) return;
  if (d.open) openPackets.add(d.dataset.pool); else openPackets.delete(d.dataset.pool);
}, true);
window.addEventListener('pagehide', saveAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveAll(); });

/* ---------- start-up ---------- */
async function boot() {
  try {
    const [teams, squads] = await Promise.all([fetch('data/teams.json').then(r => r.json()), fetch('data/squads.json').then(r => r.json())]);
    app.data = teams;
    setEnv({ squads });
  } catch (e) {
    setHTML('#main', '<div class="empty-state"><h2 class="round-title">The slips have gone missing</h2><p class="sub">The club list didn\'t load. If you opened index.html straight from your computer, run it through a little web server instead (see the README), or put it online.</p></div>');
    return;
  }
  await loadAll();
  syncTeams();
  if (readDesignFromHash()) app.view = 'cupsetup';
  else if (app.season && app.season.phase !== 'end') { app.active = 'season'; }
  else if (app.cup && app.cup.phase !== 'done') { app.active = 'cup'; }
  render();
}
boot();
