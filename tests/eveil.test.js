// Le rideau du theme Matrix, joue une fois au demarrage d'une partie.
//
// Il ne porte aucune information : c'est un clin d'oeil. Les conditions
// verrouillees ici sont celles qui l'empecheraient de nuire : il n'existe qu'en
// Matrix, il est saute quand les animations sont reduites, un tap le leve, et
// un minuteur le leve tout seul si personne ne tape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(racine + 'css/zilch.css', 'utf8');
const html = readFileSync(racine + 'index.html', 'utf8');
const ui = readFileSync(racine + 'js/ui.js', 'utf8');

const bloc = ui.slice(ui.indexOf('function eveiller'), ui.indexOf('// --- Ecran de partie'));
const nb = (nom) => Number(ui.match(new RegExp(`const ${nom} = (\\d+)`))[1]);

test('le rideau existe et part cache', () => {
  assert.match(html, /<div id="eveil" aria-hidden="true">/,
    'il ne doit rien annoncer a un lecteur d ecran : il ne porte aucune information');
  assert.match(css, /#eveil\{[^}]*display:none/, 'cache tant que la classe on n est pas posee');
  assert.match(css, /#eveil\.on\{\s*display:flex/);
});

test('le rideau ne joue qu en theme Matrix', () => {
  assert.match(bloc, /dataset\.theme !== 'matrix'\)\s*return/, 'tout autre theme sort aussitot');
});

test('le rideau est saute quand les animations sont reduites', () => {
  assert.match(bloc, /MOUVEMENT_REDUIT\.matches\)\s*return/,
    'aucune information ne depend de ce mouvement : on le supprime, on ne le fige pas');
});

test('un tap leve le rideau', () => {
  assert.match(bloc, /onclick = fermerEveil/, 'le rideau ne piege jamais la table');
});

test('le rideau se leve meme si personne ne tape', () => {
  assert.match(bloc, /setTimeout\(fermerEveil/, 'il faut un filet, pas seulement un tap');
});

test('le rideau ne depasse pas trois secondes', () => {
  const texte = ui.match(/const EVEIL_TEXTE = '([^']*)'/)[1];
  const total = texte.length * nb('EVEIL_LETTRE') + nb('EVEIL_PAUSE');
  assert.ok(total <= 3000, `rideau de ${total} ms : au-dela de 3 s, une table attend`);
});

test('le rideau se declenche au demarrage, pas a chaque tour', () => {
  const clic = ui.slice(ui.indexOf("$('b-demarrer').onclick"));
  assert.match(clic.slice(0, clic.indexOf('};')), /eveiller\(\);/, 'branche sur Demarrer');
  assert.equal((ui.match(/eveiller\(\);/g) || []).length, 1,
    'un seul appel dans tout le fichier : une fois par partie, jamais par tour');
});
