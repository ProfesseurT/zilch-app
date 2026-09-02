// Garde-fou du hors ligne.
//
// Le service worker precache une liste ecrite a la main. Un fichier ajoute au
// projet et oublie dans cette liste ne sera pas disponible en mode avion, et
// l'oubli est TOTALEMENT SILENCIEUX : l'application marche parfaitement tant
// qu'il y a du reseau. Ces tests sont le seul endroit qui puisse le detecter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allFiles } from '../js/sounds.js';

const racine = fileURLToPath(new URL('../', import.meta.url));
const lire = (f) => readFileSync(racine + f, 'utf8');

const sw = lire('service-worker.js');
const precache = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
const html = lire('index.html');
const manifeste = JSON.parse(lire('manifest.json'));

test('le service worker porte une version, et elle sert de nom de cache', () => {
  const m = sw.match(/const VERSION = '([^']+)'/);
  assert.ok(m, 'une constante VERSION doit exister en tete de fichier');
  assert.match(m[1], /^zilch-v\d+$/, 'forme attendue : zilch-vN');
  assert.ok(sw.includes('caches.open(VERSION)'), 'le cache porte la version');
  assert.ok(sw.includes('n !== VERSION'), 'les caches d une autre version sont purges');
});

test('le service worker ne precache jamais avec addAll', () => {
  // Un seul 404 ferait echouer l installation entiere, donc plus aucun hors
  // ligne, sans erreur visible.
  assert.ok(!/\.addAll\s*\(/.test(sw), 'addAll est interdit ici (la mention en commentaire est permise)');
  assert.ok(sw.includes('allSettled'), 'le precache se fait fichier par fichier');
});

test('tous les sons du manifeste sont precaches', () => {
  for (const f of allFiles()) {
    assert.ok(precache.includes(`./sons/${f}`), `son absent du precache : ${f}`);
  }
});

test('tout le code et le style de l application sont precaches', () => {
  for (const f of readdirSync(racine + 'js')) {
    if (f.endsWith('.js')) assert.ok(precache.includes(`./js/${f}`), `module absent du precache : js/${f}`);
  }
  for (const f of readdirSync(racine + 'css')) {
    if (f.endsWith('.css')) assert.ok(precache.includes(`./css/${f}`), `feuille absente du precache : css/${f}`);
  }
  for (const f of ['./', './index.html', './manifest.json']) {
    assert.ok(precache.includes(f), `absent du precache : ${f}`);
  }
});

test('toutes les icones declarees sont precachees et existent', () => {
  const declarees = new Set(manifeste.icons.map((i) => i.src));
  for (const m of html.matchAll(/href="(\.\/icon-[^"]+)"/g)) declarees.add(m[1]);
  assert.ok(declarees.size >= 4, 'au moins 4 icones declarees');
  for (const src of declarees) {
    assert.ok(precache.includes(src), `icone absente du precache : ${src}`);
    assert.ok(existsSync(racine + src.slice(2)), `icone declaree mais absente du disque : ${src}`);
  }
});

test('chaque fichier precache existe reellement', () => {
  for (const url of precache) {
    if (url === './') continue;
    assert.ok(existsSync(racine + url.slice(2)), `precache un fichier inexistant : ${url}`);
  }
});

test('l application declare le manifeste et une icone iOS', () => {
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.json">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icon-180\.png">/,
    'iOS lit apple-touch-icon en priorite sur le manifeste');
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
});

test('le manifeste reste coherent avec le deploiement en sous-dossier', () => {
  // GitHub Pages sert le depot sous /zilch-app/ : tout chemin absolu casserait
  // l installation et le hors ligne.
  assert.equal(manifeste.start_url, './');
  assert.equal(manifeste.scope, './');
  assert.equal(manifeste.display, 'standalone');
  for (const i of manifeste.icons) assert.ok(i.src.startsWith('./'), `chemin absolu : ${i.src}`);
  assert.ok(manifeste.icons.some((i) => i.purpose === 'maskable'), 'une icone maskable est requise');
  assert.equal(manifeste.theme_color, '#123A6B', 'doit correspondre a la meta theme-color');
});
