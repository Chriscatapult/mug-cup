// Every sound is made on the fly with Web Audio. No files to download.
let ctx = null, buf = null, out = null, humNode = null;
export const sound = { on: true, quiet: false };   // quiet: temporarily silenced (bulk rolling)

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { ctx = new C(); } catch (e) { return null; }
    out = ctx.createGain(); out.gain.value = 0.7; out.connect(ctx.destination);
    const len = ctx.sampleRate * 2; buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const ok = () => sound.on && !sound.quiet && ac();
function nz(t, dur, type, freq, q, gain, attack = 0.003) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  return { s, g, f };
}
function tn(t, freq, dur, type, gain, attack = 0.005) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
}
function knock(t, g) { nz(t, 0.035, 'bandpass', 2200 + Math.random() * 2800, 4, g); tn(t, 140 + Math.random() * 80, 0.06, 'sine', g * 0.6); }

export const SND = {
  unlock() { ac(); },
  rattle() { if (!ok()) return; const t = ctx.currentTime; knock(t, 0.06); knock(t + 0.03 + Math.random() * 0.02, 0.045); },
  // dice on carpet: softer and duller than on a table
  clatter() { if (!ok()) return; let t = ctx.currentTime + 0.01, gap = 0.07, g = 0.24; for (let k = 0; k < 6; k++) { knock(t, g); t += gap * (0.7 + Math.random() * 0.6); gap *= 1.25; g *= 0.68; } nz(ctx.currentTime, 0.25, 'lowpass', 500, 0.7, 0.05, 0.02); },
  rustle(d = 0.3) { if (!ok()) return; const t = ctx.currentTime, n = Math.round(d / 0.04); for (let k = 0; k < n; k++) nz(t + k * 0.04 + Math.random() * 0.02, 0.07, 'highpass', 2000 + Math.random() * 3000, 0.7, 0.03 + Math.random() * 0.05); },
  unfold() { if (!ok()) return; const t = ctx.currentTime; nz(t, 0.16, 'bandpass', 3200, 0.8, 0.12, 0.01); nz(t + 0.14, 0.1, 'bandpass', 4200, 1, 0.08, 0.005); },
  scribble() { if (!ok()) return; const t = ctx.currentTime; for (let k = 0; k < 5; k++) nz(t + k * 0.05, 0.045, 'bandpass', 3500 + Math.random() * 2000, 2.5, 0.035, 0.01); },
  whistle() { if (!ok()) return; const t = ctx.currentTime; const o = tn(t, 2750, 0.34, 'sine', 0.07, 0.02); const l = ctx.createOscillator(); l.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 110; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.4); },
  crowd(big) { if (!ok()) return; const t = ctx.currentTime, d = big ? 3.4 : 2; nz(t, d, 'lowpass', big ? 1100 : 750, 0.7, big ? 0.32 : 0.2, 0.5); nz(t, d * 0.9, 'bandpass', big ? 1500 : 1000, 1.2, big ? 0.14 : 0.08, 0.6); },
  groan() { if (!ok()) return; const t = ctx.currentTime; const n = nz(t, 1.6, 'lowpass', 600, 0.8, 0.16, 0.15); n.f.frequency.exponentialRampToValueAtTime(220, t + 1.5); },
  // a crowd hum that builds while the big die is in your hand
  humStart() {
    if (!ok() || humNode) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 2.5);
    f.frequency.linearRampToValueAtTime(900, t + 3);
    s.connect(f); f.connect(g); g.connect(out); s.start(t);
    humNode = { s, g };
  },
  humStop() {
    if (!humNode || !ctx) return;
    const t = ctx.currentTime, { s, g } = humNode; humNode = null;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.stop(t + 0.4);
  },
  fanfare() { if (!ok()) return; const t = ctx.currentTime + 0.25; [523, 659, 784, 1047].forEach((f, i) => tn(t + i * 0.17, f, i === 3 ? 1 : 0.22, 'triangle', 0.11)); tn(t + 0.51, 784, 1, 'triangle', 0.05); },
};
