// Builds index.html from dev.html: one self-contained file with the styles, the code and the club data inside.
// It works on Vercel, GitHub Pages, or opened straight from your computer.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';

const js = (await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2019' })).outputFiles[0].text;
const css = readFileSync('css/style.css', 'utf8');
const data = JSON.stringify({ teams: JSON.parse(readFileSync('data/teams.json', 'utf8')), squads: JSON.parse(readFileSync('data/squads.json', 'utf8')) });
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1');
let html = readFileSync('dev.html', 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script>window.MUG_DATA=${safe(data)};</script>\n<script>${safe(js)}</script>`);
if (html.includes('src/main.js') || html.includes('css/style.css')) throw new Error('build did not inline everything');

writeFileSync('index.html', html);
console.log(`index.html: ${(html.length / 1024).toFixed(0)} KB`);
