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
  if (spec.kicker) { ctx.fillStyle = '#b73e36'; ctx.font = '700 40px Caveat, cursive'; ctx.fillText(spec.kicker, L, y); }
  y = RULE0 + STEP - 6;
  ctx.fillStyle = '#5b4632'; ctx.font = '400 62px "IM Fell English", Georgia, serif';
  wrap(ctx, spec.title, maxW).forEach(l => { ctx.fillText(l, L, y); y += STEP * 1.5; });
  ctx.strokeStyle = '#b73e36'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L, y - STEP * 1.5 + 16); ctx.bezierCurveTo(L + 80, y - STEP * 1.5 + 6, L + 160, y - STEP * 1.5 + 26, L + 260, y - STEP * 1.5 + 12); ctx.stroke();
  if (spec.big) {
    y = nextRule(y + STEP) - 8;
    ctx.fillStyle = '#2b3d6d'; ctx.font = '700 92px Caveat, cursive';
    wrap(ctx, spec.big, maxW).forEach(l => { ctx.fillText(l, L, y); y += STEP * 2; });
  }
  y = nextRule(y) - 9;
  for (const raw of spec.lines || []) {
    const ln = typeof raw === 'string' ? { text: raw } : raw;
    const style = ln.style || 'body';
    if (style === 'head') y += STEP;
    if (y > y0 + ph - 130) break;
    ctx.font = style === 'head' ? '400 40px "IM Fell English", Georgia, serif' : style === 'small' ? '400 30px "Patrick Hand", cursive' : style === 'red' ? '700 42px Caveat, cursive' : '400 34px "Patrick Hand", cursive';
    ctx.fillStyle = style === 'head' ? '#5b4632' : style === 'small' ? '#7a6f5f' : style === 'red' ? '#b73e36' : '#2b3d6d';
    wrap(ctx, ln.text, maxW).forEach(l => { if (y <= y0 + ph - 130) ctx.fillText(l, L, y); y += STEP; });
  }
  ctx.fillStyle = '#7a6f5f'; ctx.font = '700 32px Caveat, cursive';
  ctx.fillText('The Mug Cup · dice football from the bedroom floor', L, y0 + ph - 34);
  if (spec.stamp) {
    ctx.save(); ctx.translate(R - 150, y0 + ph - 150); ctx.rotate(-0.16);
    ctx.font = '400 44px "IM Fell English", Georgia, serif';
    const w = Math.max(220, ctx.measureText(spec.stamp).width + 50);
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
