// The world the engine plays in: who the teams are, where the randomness comes from,
// and whose names go on the team sheets. The app sets this once at start-up; tests set their own.
export const env = {
  teams: {},                 // id -> { id, n: name, g: ground, t: tier 1..5, p: packet, c: country }
  squads: {},                // id -> { s: [[name, 'A'|'M'|'D'|'G'], ...], l: [legend, ...] }
  custom: {},                // id -> [name, ...] team sheets the player wrote themselves
  rng: Math.random,
};
export function setEnv(patch) { Object.assign(env, patch); }

export const team = id => env.teams[id] || { id, n: id, g: '', t: 3, p: '', c: '' };
export const nameOf = id => team(id).n;
export const tierOf = id => team(id).t;
export const groundOf = id => { const t = team(id); return t.g || `${t.n}'s ground`; };

// A seeded generator, for tests and for repeatable fake names.
export function seeded(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000003) / 1000003; };
}
