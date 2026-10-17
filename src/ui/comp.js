// Draw providers and play sessions for a cup-style competition. Used by cup mode,
// the season's regional cups, and the world tournaments.
import { app, saveH } from './state.js';
import { esc } from './dom.js';
import { nameOf, groundOf, tierOf, team } from '../engine/env.js';
import { cap, plural } from '../engine/util.js';
import * as C from '../engine/competition.js';
import { recordMatch } from '../engine/almanac.js';
import { pickFeatured, isFollowedMatch } from './play.js';
import { expanded } from '../engine/rules.js';

const nm = id => esc(nameOf(id));
export const stagePrefix = c => c.cfg.stages.length > 1 ? `${C.stageName(c, c.stageIdx)}: ` : '';
const joinersHere = c => Object.keys(c.entry).filter(id => c.entry[id] === c.stageIdx).length;

/* ---------- the draw ---------- */
function drawSub(c) {
  const d = c.draw, jn = c.stageIdx > 0 ? joinersHere(c) : 0;
  const joinTxt = jn && (d.kind === 'groups' || C.curStage(c).rounds.length === 1) ? ` ${plural(jn, 'team')} join the mug for this stage.` : '';
  if (d.kind === 'groups') {
    const G = C.curStage(c).groups.length;
    return (G === 1 ? `One big league of ${d.need}. Pull them out to write up the table.` : `${G} groups. ${d.start} slips in the mug, ${d.need} come out. They go A, B, C and round again until every group is full.`) + joinTxt;
  }
  const r = C.curRound(c), ties = d.need / 2, byes = r.count - d.need;
  if (r.final) return 'Two slips left. One final. The first name out gets the home dressing room.';
  let s = `${plural(ties, 'tie')} to draw${r.legs === 2 ? ', home and away' : ''}. The first name out of each pair is at home${r.legs === 2 ? ' first' : ''}.`;
  if (d.limited) s += ` ${d.start} slips in the mug, only ${d.need} come out.`;
  else if (byes > 0) s += ` Whoever's still in the mug at the end gets a bye.`;
  return s + joinTxt;
}
function tieRow(c, k) {
  const r = C.curRound(c), t = r.ties[k], full = t && t.a;
  const venue = full ? (r.neutral ? 'at ' + esc(C.venueOf(c, t, r)) : 'at ' + esc(groundOf(t.h)) + (r.legs === 2 ? ', then at ' + esc(groundOf(t.a)) : '')) : '';
  return `<li class="tie${t ? '' : ' empty'}${t && !full ? ' waiting' : ''}" id="t-${k}"><span class="n">${k + 1}.</span><span class="home${t ? ' filled' : ''}">${t ? nm(t.h) : '…'}</span><span class="v">v</span><span class="away${full ? ' filled' : ''}">${full ? nm(t.a) : t ? '<span class="dots">?</span>' : '…'}</span>${full ? `<span class="venue">${venue}</span>` : ''}</li>`;
}
function groupCard(c, i) {
  const g = C.curStage(c).groups[i];
  return `<div class="gcard" id="g-${i}"><h3>${g.name === 'The League' ? 'The League' : 'Group ' + g.name}</h3><ol>${Array.from({ length: g.size }, (_, j) => g.teams[j] ? `<li class="filled">${nm(g.teams[j])}</li>` : '<li class="empty">…</li>').join('')}</ol></div>`;
}
// opts: { title?, save, onFinish }
export function compProvider(c, opts) {
  return {
    get title() { return opts.title || cap(stagePrefix(c) + (c.draw.kind === 'groups' ? (C.curStage(c).groups.length === 1 ? 'writing up the league' : 'the group draw') : C.curRound(c).name + ', the draw')); },
    get sub() { return opts.sub || drawSub(c); },
    left: () => c.mug.length, start: () => c.draw.start, need: () => c.draw.need, doneCount: () => c.draw.done,
    done: () => C.drawComplete(c), mugIds: () => c.mug,
    pull(chosen) {
      const res = C.pullOne(c, chosen); opts.save();
      if (c.draw.kind === 'ko') {
        const t = C.curRound(c).ties[Math.floor((c.draw.done - 1) / 2)];
        if (res.second) return { ...res, before: `${nameOf(t.h)} will play…` };
        return { ...res, after: `${nameOf(res.id)} will play…` };
      }
      return res;
    },
    destHTML: () => c.draw.kind === 'groups' ? `<div class="gcards">${C.curStage(c).groups.map((g, i) => groupCard(c, i)).join('')}</div>` : `<ol class="ties">${Array.from({ length: c.draw.need / 2 }, (_, k) => tieRow(c, k)).join('')}</ol>`,
    destRowHTML: dest => dest.startsWith('t-') ? tieRow(c, +dest.slice(2)) : groupCard(c, +dest.slice(2)),
    tip() { C.tipOut(c); opts.save(); },
    finish() { C.finishDraw(c); opts.save(); opts.onFinish && opts.onFinish(); },
    leftovers() {
      if (!c.mug.length) return '';
      const isBye = c.draw.kind === 'ko' && !c.draw.limited, names = c.mug.map(nm);
      return `<div class="leftovers"><b>${isBye ? 'Byes to the next round' : 'Left in the mug, never drawn'}:</b> ${names.slice(0, 60).join(', ')}${names.length > 60 ? ` and ${names.length - 60} more` : ''}.</div>`;
    },
  };
}

/* ---------- playing ---------- */
export function compCtx(c, it) {
  const m = it.m, where = `${c.name.replace(/^The /, '')}, ${C.whereLabel(c, it)}`, venue = C.venueOf(c, m, it.r);
  if (it.t) {
    const st = C.tieStatus(it.t, it.r), decided = st === 'done' && it.t.matches[it.t.matches.length - 1] === m;
    return { winner: decided ? it.t.w : (m.hs !== m.as ? (m.hs > m.as ? m.h : m.a) : null), decided, knockout: true, where, venue };
  }
  return { winner: m.hs > m.as ? m.h : m.as > m.hs ? m.a : null, knockout: false, where, venue };
}
function dreamers(c) {
  if (C.curStage(c).type !== 'ko') return '';
  const r = C.curRound(c), alive = new Set(r.byes);
  r.ties.forEach(t => { if (t.w && t.matches.every(m => m.done)) alive.add(t.w); else { alive.add(t.h); alive.add(t.a); } });
  const arr = [...alive].map(id => team(id));
  if (arr.length < 2) return '';
  const maxT = Math.max(...arr.map(t => t.t)), minT = Math.min(...arr.map(t => t.t));
  if (maxT - minT < 2 || maxT < 3) return '';
  const d = arr.filter(t => t.t === maxT);
  return `<p class="dreamers">Still dreaming: ${d.slice(0, 5).map(t => '<b>' + esc(t.n) + '</b>').join(', ')}${d.length > 5 ? ` and ${d.length - 5} more minnows` : ''}.</p>`;
}
export function compHead(c, prefix = '') {
  const st = C.curStage(c), items = C.sitting(c);
  let head, sub;
  if (st.type === 'groups') {
    head = stagePrefix(c) + (st.groups.length === 1 ? 'the league' : 'the groups') + `, matchday ${st.md + 1} of ${st.mdCount}`;
    sub = `${plural(items.length, 'match', 'matches')}${st.groups.length > 1 ? ` across ${plural(st.groups.length, 'group')}` : ''}. ${C.curCfg(c).pts === 2 ? 'Two points for a win' : 'Three points for a win'}, one for a draw.`;
  } else {
    const r = C.curRound(c);
    head = stagePrefix(c) + r.name + (r.sit > 0 ? (r.legs === 2 ? ', second legs' : ', replays') : r.legs === 2 ? ', first legs' : '');
    const tb = expanded() ? 'penalties' : 'extra dice';
    const lvl = r.legs === 2 ? (r.level === 'away' ? `Level on aggregate? Away goals, then ${tb}.` : `Level on aggregate? ${expanded() ? 'Penalties' : 'Extra dice'}.`) : r.level === 'replay' && r.sit === 0 ? 'Level? A replay at the other ground.' : expanded() ? 'Level? One roll on the penalty card.' : 'Level? Extra dice until someone blinks.';
    sub = (r.neutral ? `One tie, at ${C.venueOf(c, r.ties[0].matches[0] || r.ties[0], r)}. ` : `${plural(items.length, 'tie')}${r.byes.length && r.sit === 0 ? `, ${plural(r.byes.length, 'team')} through on byes` : ''}. `) + lvl;
  }
  return `${prefix ? `<p class="kicker">${esc(prefix)}</p>` : ''}<h2 class="round-title">${esc(cap(head))}</h2><p class="sub">${esc(sub)}</p>`;
}
// opts: { save, next, prefix, mine(it), after() }
export function compSession(c, opts) {
  return {
    items: () => C.sitting(c),
    featured() { return pickFeatured(C.sitting(c), c.feat, C.sittingKey(c)); },
    pivot: it => C.cupPivot(c, it),
    venue: it => C.venueOf(c, it.m, it.r),
    ctx: it => compCtx(c, it),
    mine: opts.mine,
    group: true,
    onComplete(it, note) {
      if (note) c.notes.push(note);
      recordMatch(app.H, it.m); saveH(); opts.save();
    },
    save: () => opts.save(),
    headHTML: () => compHead(c, opts.prefix),
    dreamers: () => dreamers(c),
    after: opts.after,
    nextLabel: () => opts.nextLabel ? opts.nextLabel() : C.nextLabel(c),
    next: opts.next,
  };
}
export { dreamers };
