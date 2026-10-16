// Saving: IndexedDB for the games and the record books (plenty of room for long seasons),
// localStorage for small settings. Everything stays in this browser; export/import moves it.
const DB = 'mug-cup', STORE = 'kv';
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const memory = {};   // fallback when IndexedDB is blocked (private windows on some browsers)
export async function get(key, fallback = null) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const q = d.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result === undefined ? fallback : q.result);
      q.onerror = () => rej(q.error);
    });
  } catch (e) { return key in memory ? memory[key] : fallback; }
}
export async function set(key, value) {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (e) { memory[key] = value; return false; }
}
export async function del(key) {
  try { const d = await db(); await new Promise(res => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = res; tx.onerror = res; }); }
  catch (e) { delete memory[key]; }
}

// Debounced saving, so rolling 250 matches doesn't write 250 times.
const timers = {}, pending = {};
export function save(key, getValue, delay = 400) {
  pending[key] = getValue;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => { const g = pending[key]; delete pending[key]; set(key, g()); }, delay);
}
export function flush() {
  Object.keys(pending).forEach(k => { clearTimeout(timers[k]); const g = pending[k]; delete pending[k]; set(k, g()); });
}

export const settings = {
  load(defaults) { try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem('mugcup.settings') || '{}')); } catch (e) { return { ...defaults }; } },
  save(s) { try { localStorage.setItem('mugcup.settings', JSON.stringify(s)); } catch (e) { /* private mode */ } },
};
