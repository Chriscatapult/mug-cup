// Choosing the dice rules, and filling in your own results card.
import { app } from './state.js';
import { esc } from './dom.js';
import * as RU from '../engine/rules.js';

export function ensureCustom() {
  if (!Array.isArray(app.S.customCard) || app.S.customCard.length !== 100) app.S.customCard = RU.cardToText(RU.STANDARD_CARD).flat();
  if (!Array.isArray(app.S.customPens) || app.S.customPens.length !== 10) app.S.customPens = RU.pensToText(RU.STANDARD_PENS);
}
export function customProblems() {
  ensureCustom();
  const c = RU.readCustom(app.S.customCard, app.S.customPens);
  return c.bad.length + c.badPens.length;
}
// The rules choice. full: show the longer descriptions (setup pages and the drawer).
export function rulesPickerHTML() {
  const S = app.S, ex = S.dice === 'expanded';
  const choice = (act, v, on, title, desc) => `<button class="choice${on ? ' on' : ''}" data-act="${act}" data-v="${v}"><strong>${title}</strong><span>${desc}</span></button>`;
  let h = `<div class="choices">
    ${choice('dice', 'classic', !ex, 'Classic dice', 'One die each. 1 to 5 is how many they score, a six is a big fat nil. Level in a cup tie? Extra dice until somebody blinks.')}
    ${choice('dice', 'expanded', ex, 'Expanded dice rules', 'Two ten-sided dice and a results card. The red die picks the row, the blue die picks the square. Level in a cup tie? One roll on the penalty card.')}</div>`;
  if (ex) {
    const bad = S.card === 'custom' ? customProblems() : 0;
    h += `<p class="note" style="margin-top:16px">Which results card?</p><div class="choices">
      ${choice('cardmode', 'high', S.card === 'high', 'Higher dice is better', 'The standard card. A high red die is good for the home side, a high blue die is good for the away side.')}
      ${choice('cardmode', 'random', S.card === 'random', 'Fully random', 'The same squares, shuffled once at the start of each cup or season. No number is safe.')}
      ${choice('cardmode', 'custom', S.card === 'custom', 'Your own card', 'Fill in all 100 squares and the penalty card yourself, in the drawer.')}</div>
      ${S.card === 'custom' ? `<p class="${bad ? 'warn' : 'note'}" style="margin-top:8px">${bad ? `${bad} square${bad === 1 ? '' : 's'} on your card need fixing. ` : ''}<button class="linkish" data-act="go" data-v="drawer">Fill in your card in the drawer</button></p>` : ''}`;
  }
  h += `<p class="note" style="margin-top:16px">Form? A club has won its last three, or lost its last three, anywhere in the book.</p><div class="choices">
    ${choice('form', '0', !S.form, 'No form', 'Every match starts from nothing.')}
    ${choice('form', '1', !!S.form, 'Form counts', ex
      ? 'A team in form, or facing a team out of form, gets the form die: four 0s, a 1 and a 2 added to their score. In form against out of form gets the big one: two 0s, three 1s and a 2.'
      : 'A team in form throws two dice and keeps the better. A team out of form throws two and keeps the worse.')}</div>`;
  return h;
}
export function tallyText() {
  ensureCustom();
  const c = RU.readCustom(app.S.customCard, app.S.customPens), t = RU.tally(c.card);
  const pct = n => Math.round(n / t.n * 100);
  const bad = c.bad.length + c.badPens.length;
  return `${pct(t.hw)}% home wins, ${pct(t.d)}% draws, ${pct(t.aw)}% away wins, ${t.goals.toFixed(2)} goals a game. Penalties: home side wins on ${c.pens.filter(e => e[0] === 'h').length} numbers out of 10.${bad ? ` <b class="warn-inline">${bad} square${bad === 1 ? '' : 's'} need${bad === 1 ? 's' : ''} fixing.</b>` : ''}`;
}
export function cardEditorHTML() {
  ensureCustom();
  const cells = app.S.customCard, pens = app.S.customPens;
  const c = RU.readCustom(cells, pens), bad = new Set(c.bad), badP = new Set(c.badPens);
  const head = `<thead><tr><th class="corner"><span class="hd">home</span> <span class="ad">away</span></th>${Array.from({ length: 10 }, (_, k) => `<th class="ad">${k + 1}</th>`).join('')}</tr></thead>`;
  const rows = Array.from({ length: 10 }, (_, r) => `<tr><th class="hd">${r + 1}</th>${Array.from({ length: 10 }, (_, k) => { const i = r * 10 + k; return `<td><input class="cc${bad.has(i) ? ' bad' : ''}" data-k="${i}" value="${esc(cells[i])}" maxlength="5" inputmode="numeric" aria-label="Red ${r + 1}, blue ${k + 1}"></td>`; }).join('')}</tr>`).join('');
  return `<div class="card-editor">
    <p class="note">Each square is a score, home first, like <b>2-1</b>. Every square is 1% of matches, so the tally underneath shows what your card will play like. Used when you pick <b>Your own card</b>.</p>
    <div class="rc-scroll"><table class="rcard edit">${head}<tbody>${rows}</tbody></table></div>
    <p class="tally" id="cardTally">${tallyText()}</p>
    <div class="row-btns"><button class="btn ghost small" data-act="cardstd">Start from the standard card</button><button class="btn ghost small" data-act="cardshuffle">Shuffle the squares</button><button class="btn ghost small" data-act="cardclear">Rub it all out</button></div>
    <h4 class="glabel">The penalty card</h4>
    <div class="pen-edit">${pens.map((e, k) => `<label class="pe${badP.has(k) ? ' bad' : ''}"><b>${k + 1}</b><select data-pw="${k}" aria-label="Who wins on a ${k + 1}"><option value="h"${e[0] === 'h' ? ' selected' : ''}>Home win</option><option value="a"${e[0] === 'a' ? ' selected' : ''}>Away win</option></select><input data-pk="${k}" value="${esc(e[1])}" maxlength="5" aria-label="Shootout score on a ${k + 1}"></label>`).join('')}</div>
    <p class="note" style="font-size:15px">Shootout scores are the winner's first, like 5-4.</p></div>`;
}
