// Garde-fou des icones de theme.
//
// Un theme ajoute sans son icone ne casse rien de visible : l application
// garde l icone du theme precedent, et personne ne le voit avant une
// installation. Ces tests sont le seul endroit qui puisse le detecter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const lire = (f) => readFileSync(racine + f, 'utf8');

const ui = lire('js/ui.js');
const sw = lire('service-worker.js');
const precache = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);

const themes = [...ui.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);
const bloc = ui.match(/const ICONE_SYSTEME = \{([^}]+)\}/);
const icones = Object.fromEntries(
  [...(bloc?.[1] ?? '').matchAll(/([a-z]+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
);

test('les trois themes existent toujours', () => {
  assert.deepEqual(themes, ['azulejo', 'tableau', 'matrix']);
});

test('chaque theme a son icone, et le fichier existe', () => {
  for (const t of themes) {
    assert.ok(icones[t], `theme sans icone : ${t}`);
    assert.ok(existsSync(racine + icones[t].slice(2)), `icone absente du disque : ${icones[t]}`);
  }
});

test('chaque icone de theme est precachee', () => {
  for (const src of Object.values(icones)) {
    assert.ok(precache.includes(src), `icone absente du precache : ${src}`);
  }
});

test('le theme par defaut garde le nom d icone que le HTML declare en dur', () => {
  // iOS lit ce lien avant tout script. S il pointait ailleurs, une premiere
  // installation faite avant le chargement du script prendrait la mauvaise.
  assert.equal(icones.azulejo, './icon-180.png');
  assert.match(lire('index.html'), /<link rel="apple-touch-icon" href="\.\/icon-180\.png">/);
});

test('changer de theme repose l icone', () => {
  assert.match(ui, /link\[rel="apple-touch-icon"\]/, 'poserTheme doit echanger le lien');
});
