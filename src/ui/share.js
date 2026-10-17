// "Tear out the page": draws a page of the exercise book onto a canvas, ready to save or send.
// spec: { kicker, title, big, lines: [string | { text, style: 'head'|'small'|'red'|'score' }], stamp }
const W = 1080, H = 1350;

async function fontsReady() {
  if (!document.fonts) return;
  try {
    await Promise.all(['700 64px Caveat', '400 40px "Patrick Hand"', '400 80px "IM Fell English"'].map(f => document.fonts.load(f)));
  } catch (e) { /* fall back to whatever is there */ }
}
function wrap(ctx, text, maxW) {
  const words = String(text).split(' '), out = []; let line = '';
  words.forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
  if (line) out.push(line);
  return out;
}
export async function drawPage(spec) {
  await fontsReady();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // the carpet behind the page
  ctx.fillStyle = '#4e6377'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '20,30,40'},${Math.random() * 0.12})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  // the page, slightly torn and tilted
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -H / 2);
  const x0 = 60, y0 = 50, pw = W - 120, ph = H - 100;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#fdf8ec';
  ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let x = x0; x <= x0 + pw; x += 18) ctx.lineTo(x, y0 + (Math.random() * 7));
  ctx.lineTo(x0 + pw, y0 + ph); ctx.lineTo(x0, y0 + ph); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#c8dae8'; ctx.lineWidth = 2;
  for (let y = y0 + 120; y < y0 + ph - 20; y += 46) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + pw, y); ctx.stroke(); }
  ctx.strokeStyle = '#e6a2a2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + 110, y0 + 10); ctx.lineTo(x0 + 110, y0 + ph); ctx.stroke();
  // punched holes
  ctx.fillStyle = '#4e6377'; [0.18, 0.5, 0.82].forEach(f => { ctx.beginPath(); ctx.arc(x0 + 48, y0 + ph * f, 16, 0, Math.PI * 2); ctx.fill(); });
  const L = x0 + 140, R = x0 + pw - 50, maxW = R - L;
  const RULE0 = y0 + 120, STEP = 46;
  const nextRule = y => RULE0 + Math.ceil((y - RULE0) / STEP) * STEP;   // baselines sit just above a ruled line
  let y = y0 + 72;
  ctx.textBaseline = 'alphabetic';
  let kickEnd = L, bigEnd = null;
  if (spec.kicker) { ctx.fillStyle = '#b73e36'; ctx.font = '700 40px Caveat, cursive'; ctx.fillText(spec.kicker, L, y); kickEnd = L + ctx.measureText(spec.kicker).width; }
  y = RULE0 + STEP - 6;
  ctx.fillStyle = '#5b4632'; ctx.font = '400 62px "IM Fell English", Georgia, serif';
  wrap(ctx, spec.title, maxW).forEach(l => { ctx.fillText(l, L, y); y += STEP * 1.5; });
  ctx.strokeStyle = '#b73e36'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L, y - STEP * 1.5 + 16); ctx.bezierCurveTo(L + 80, y - STEP * 1.5 + 6, L + 160, y - STEP * 1.5 + 26, L + 260, y - STEP * 1.5 + 12); ctx.stroke();
  if (spec.big) {
    y = nextRule(y + STEP) - 8;
    ctx.fillStyle = '#2b3d6d'; ctx.font = '700 92px Caveat, cursive';
    const bl = wrap(ctx, spec.big, maxW);
    bl.forEach((l, k) => { ctx.fillText(l, L, y); if (k === bl.length - 1) bigEnd = { x: L + ctx.measureText(l).width, y }; y += STEP * 2; });
  }
  // Decide where the stamp goes before writing the lines, so they can leave room for it.
  let stampAt = null, limit = y0 + ph - 130;
  const hardLimit = y0 + ph - 130;
  if (spec.stamp) {
    ctx.font = '400 44px "IM Fell English", Georgia, serif';
    const w = Math.max(220, ctx.measureText(spec.stamp).width + 50);
    if (bigEnd && R - bigEnd.x >= w + 50) stampAt = { x: Math.min(R - w / 2, bigEnd.x + 40 + w / 2), y: bigEnd.y - 30, w };
    else if (R - kickEnd >= w + 40) stampAt = { x: R - w / 2 - 6, y: y0 + 62, w };
    else { stampAt = { x: R - w / 2 - 6, y: y0 + ph - 150, w }; limit = y0 + ph - 230; }
  }
  y = nextRule(y) - 9;
  // Fit the lines to the page: drop the earliest "drop" lines first, never leave a heading on its own.
  const FONT = { head: '400 40px "IM Fell English", Georgia, serif', small: '400 30px "Patrick Hand", cursive', red: '700 42px Caveat, cursive', body: '400 34px "Patrick Hand", cursive' };
  const COLOUR = { head: '#5b4632', small: '#7a6f5f', red: '#b73e36', body: '#2b3d6d' };
  let lines = (spec.lines || []).map(raw => (typeof raw === 'string' ? { text: raw } : { ...raw }));
  const rowsOf = ln => { ctx.font = FONT[ln.style || 'body']; return wrap(ctx, ln.text, maxW).length + (ln.style === 'head' ? 1 : 0); };
  const rowsLeft = Math.floor((limit - y) / STEP) + 1;
  let dropped = 0;
  while (lines.reduce((n, ln) => n + rowsOf(ln), 0) > rowsLeft) {
    // lowest drop number goes first (shocks are 1, early rounds 2); a heading left with nothing under it goes too
    let k = -1;
    lines.forEach((ln, i) => { if (ln.drop && (k < 0 || ln.drop < lines[k].drop)) k = i; });
    if (k < 0) break;
    if (lines[k].drop === 2) dropped++;
    lines.splice(k, 1);
    lines = lines.filter((ln, i) => !(ln.style === 'head' && (!lines[i + 1] || lines[i + 1].style === 'head')));
  }
  if (dropped) { const k = lines.findIndex(ln => ln.drop === 2); if (k >= 0 && lines.reduce((n, ln) => n + rowsOf(ln), 0) < rowsLeft) lines.splice(k, 0, { text: `…and ${dropped} earlier round${dropped === 1 ? '' : 's'}`, style: 'small' }); }
  lines.forEach((ln, idx) => {
    const style = ln.style || 'body';
    if (style === 'head') {
      y += STEP;
      const next = lines[idx + 1];
      if (!next || y + STEP > hardLimit) { y = hardLimit + STEP; return; }   // no room for what follows: skip the heading
    }
    if (y > hardLimit) return;
    ctx.font = FONT[style]; ctx.fillStyle = COLOUR[style];
    // Below the reserved line, only write if the words stop short of the stamp.
    wrap(ctx, ln.text, maxW).forEach(l => { if (y <= limit || (y <= hardLimit && L + ctx.measureText(l).width < stampAt.x - stampAt.w / 2 - 20)) ctx.fillText(l, L, y); y += STEP; });
  });
  ctx.fillStyle = '#7a6f5f'; ctx.font = '700 32px Caveat, cursive';
  ctx.fillText('The Mug Cup · dice football from the bedroom floor', L, y0 + ph - 34);
  if (spec.stamp) {
    const { x: sx, y: sy, w } = stampAt;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.12);
    ctx.font = '400 44px "IM Fell English", Georgia, serif';
    ctx.globalAlpha = 0.85; ctx.strokeStyle = '#b73e36'; ctx.lineWidth = 5; ctx.strokeRect(-w / 2, -44, w, 88);
    ctx.fillStyle = '#b73e36'; ctx.textAlign = 'center'; ctx.fillText(spec.stamp, 0, 15);
    ctx.restore();
  }
  ctx.restore();
  return cv;
}
export async function sharePage(spec, filename) {
  const cv = await drawPage(spec);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return { url: URL.createObjectURL(blob), blob, filename: filename || 'mug-cup-page.png' };
}
export async function nativeShare(page, text) {
  try {
    const file = new File([page.blob], page.filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return true; }
  } catch (e) { /* cancelled */ }
  return false;
}
