// The app's state, and saving it.
import * as store from './store.js';
import { newAlmanac, trim } from '../engine/almanac.js';
import { env, setEnv } from '../engine/env.js';
import { PRESETS } from '../engine/presets.js';
import { sound } from './sound.js';
import { clone } from '../engine/util.js';

const DEFAULTS = {
  name: 'The Great Mug Cup', pools: ['pl', 'efl', 'sco', 'wal', 'big5'], off: [], custom: [], size: 64,
  preset: 'mug', stages: clone(PRESETS[0].stages), speed: 'slow', sound: true, shortcuts: false, squads: {}, follow: [],
  sName: 'The Mug League', sRegions: 16, sSeeded: false, sPools: null,
};
export const app = {
  S: store.settings.load(DEFAULTS),
  data: null,              // { packets, teams }
  cup: null, season: null, H: newAlmanac(), honours: [],
  view: 'home', active: null,
  busy: false, auto: false, bulk: false,
  flash: '',
};
export const SPEEDS = {
  slow: { label: 'Slow & tense', roll: 1500, gap: 850, pull: 2000 },
  steady: { label: 'Steady', roll: 800, gap: 380, pull: 1050 },
  quick: { label: 'Quick', roll: 300, gap: 110, pull: 380 },
  instant: { label: 'Instant', roll: 0, gap: 0, pull: 0 },
};
export const speed = () => SPEEDS[app.S.speed] || SPEEDS.slow;

export const saveS = () => { store.settings.save(app.S); sound.on = app.S.sound; };
export const saveCup = () => { if (!app.bulk) store.save('cup', () => app.cup); };
export const saveSeason = () => { if (!app.bulk) store.save('season', () => app.season, 800); };
export const saveH = () => { if (!app.bulk) store.save('almanac', () => { trim(app.H); return app.H; }, 1200); };
export const saveHonours = () => store.save('honours', () => app.honours);
export function saveAll() {
  store.save('cup', () => app.cup); store.save('season', () => app.season);
  store.save('almanac', () => { trim(app.H); return app.H; }); store.save('honours', () => app.honours);
  store.flush(); saveS();
}

export const slug = s => s.toLowerCase().replace(/[øö]/g, 'o').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const customTeams = () => app.S.custom.map(n => ({ id: 'c-' + slug(n), n, g: '', t: 3, p: 'custom', c: 'England' }));
export function syncTeams() {
  const teams = {};
  app.data.teams.forEach(t => { teams[t.id] = t; });
  customTeams().forEach(t => { teams[t.id] = t; });
  // keep clubs from saved games even if their packet has gone
  [app.cup, app.season].forEach(g => { if (g && g.extraTeams) Object.assign(teams, g.extraTeams); });
  setEnv({ teams, custom: app.S.squads });
}
export function allTeams() { return [...app.data.teams, ...customTeams()]; }
export function available(pools = app.S.pools) {
  const off = new Set(app.S.off);
  return allTeams().filter(t => (pools.includes(t.p) || t.p === 'custom') && !off.has(t.id));
}
export async function loadAll() {
  const [cup, season, H, honours] = await Promise.all([store.get('cup'), store.get('season'), store.get('almanac'), store.get('honours', [])]);
  app.cup = cup && cup.v === 4 ? cup : null;
  app.season = season && season.v === 1 ? season : null;
  app.H = H && H.v === 2 ? H : newAlmanac();
  app.honours = honours || [];
  sound.on = app.S.sound;
}
export const team = id => env.teams[id];
