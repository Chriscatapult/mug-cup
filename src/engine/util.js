import { env } from './env.js';

export const rand = () => env.rng();
export const d6 = () => 1 + Math.floor(env.rng() * 6);
export const goals = face => (face === 6 ? 0 : face);
export const pick = a => a[Math.floor(env.rng() * a.length)];
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(env.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pow2floor = n => { let p = 1; while (p * 2 <= n) p *= 2; return p; };
export const clone = o => JSON.parse(JSON.stringify(o));
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const plural = (n, w, pl) => n.toLocaleString('en-GB') + ' ' + (n === 1 ? w : (pl || w + 's'));
export const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const gName = i => i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26);
export const groupSizes = (n, G) => Array.from({ length: G }, (_, i) => Math.floor(n / G) + (i < n % G ? 1 : 0));
export const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

// "a 4 or 5", "a 7 or higher", "a 3 to 6", "anything but a 6"
export function facePhrase(faces, max = 6) {
  return facePhrase_(faces, max).replace(/\ba (8|11|18)\b/g, 'an $1');
}
function facePhrase_(faces, max) {
  const f = [...new Set(faces)].sort((a, b) => a - b);
  if (!f.length) return '';
  if (f.length === max) return 'anything';
  if (f.length === max - 1) return `anything but a ${Array.from({ length: max }, (_, i) => i + 1).find(x => !f.includes(x))}`;
  const runs = [];
  f.forEach(x => { const r = runs[runs.length - 1]; if (r && x === r[1] + 1) r[1] = x; else runs.push([x, x]); });
  if (runs.length === 1 && runs[0][1] - runs[0][0] >= 2) {
    const [lo, hi] = runs[0];
    return hi === max ? `a ${lo} or higher` : lo === 1 ? `a ${hi} or lower` : `a ${lo} to ${hi}`;
  }
  const parts = runs.flatMap(([lo, hi]) => hi - lo >= 2 ? [`${lo} to ${hi}`] : lo === hi ? [String(lo)] : [String(lo), String(hi)]);
  return parts.length === 1 ? `a ${parts[0]}` : `a ${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

// Knockout round names, counting down from the size of the round.
export function nameSeq(count, rn) {
  if (count === 2) return ['The Final', rn];
  if (count === 4) return ['The Semi-Finals', rn];
  if (count === 8) return ['The Quarter-Finals', rn];
  if (count === 16) return ['The Last Sixteen', rn];
  if (pow2floor(count) !== count) return ['The Preliminary Round', rn];
  return ['Round ' + (WORDS[rn] || rn + 1), rn + 1];
}
