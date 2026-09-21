// Garde-fous des cases Z.
//
// Le compteur punitif est la seule chose qui annonce le −1000. Il est passe
// de pastilles rondes et d un decompte de points a trois cases Z cochees,
// le vocabulaire de la table. Ce qui doit tenir : le bon nombre de cases, le
// bon nombre de cochees, et un compte dit a voix haute pour qui ne voit pas
// la difference entre une bordure pleine et une bordure en pointille.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const ui = readFileSync(racine + 'js/ui.js', 'utf8');
const css = readFileSync(racine + 'css/zilch.css', 'utf8');

// ui.js n exporte rien, par choix : c est la couche d affichage. La fonction
// est donc prise dans le fichier tel quel, pas recopiee ici. Une recopie
// testerait le test, pas l application.
const source = ui.slice(ui.indexOf('function cases('));
const cases = new Function(`${source.slice(0, source.indexOf('\n}') + 2)}\nreturn cases;`)();

const coches = (html) => (html.match(/class="zed coche"/g) ?? []).length;
const total = (html) => (html.match(/class="zed/g) ?? []).length;

test('le nombre de cases est le seuil, quel que soit le compte', () => {
  for (const n of [0, 1, 2, 3]) assert.equal(total(cases(n, 3)), 3);
});

test('un Z coche une case, un Z+ en coche deux', () => {
  // Le compte est en points : Z vaut 1, Z+ vaut 2. Deux cases cochees
  // peuvent donc venir d un seul Z+, et l affichage est le meme.
  assert.equal(coches(cases(1, 3)), 1);
  assert.equal(coches(cases(2, 3)), 2);
  assert.equal(coches(cases(3, 3)), 3);
});

test('les cases sont muettes, le compte est dit une seule fois', () => {
  // Sans aria-hidden, un lecteur d ecran annoncerait « Z Z Z » sans dire
  // combien sont cochees : l information exacte serait perdue.
  assert.equal((cases(2, 3).match(/aria-hidden="true"/g) ?? []).length, 3);
  assert.match(ui, /aria-label', !pun \? '' : `\$\{pun\} Z sur \$\{seuil\}`/,
    'le bloc du joueur actif doit annoncer son compte');
  assert.match(ui, /aria-label="\$\{pun\} Z sur \$\{seuilPun\}"/,
    'chaque ligne du tableau doit annoncer son compte');
});

test('le mot « point punitif » a quitte l ecran de partie', () => {
  const rendu = ui.slice(ui.indexOf('function rendrePartie('), ui.indexOf('function ouvrirFeuille('));
  assert.doesNotMatch(rendu, /point.{0,3} punitif/i, 'vocabulaire abandonne au lot 16');
});

test('coche et non coche different par autre chose que la couleur', () => {
  // Une case cochee change de style de bordure ET se remplit. Le theme peut
  // changer les couleurs sans jamais effacer la difference.
  const regle = css.slice(css.indexOf('.punitif .zed{'), css.indexOf('.punitif .zed span'));
  assert.match(regle, /border:2px dashed/, 'la case vide est en pointille');
  assert.match(regle, /\.coche\{ border-style:solid/, 'la case cochee est en trait plein');
  assert.match(regle, /\.coche::before\{ opacity:/, 'la case cochee se remplit');
});
