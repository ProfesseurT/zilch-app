// Garde-fou du bareme.
//
// DICE_TABLE n'alimente AUCUN calcul en V1 (§3.11) : c'est une table de
// reference, affichee dans l'ecran Regles, et c'est precisement pour ca
// qu'elle etait le seul endroit de l'application ou une valeur fausse pouvait
// vivre indefiniment avec tous les tests au vert.
//
// Elle l'a fait : les deux suites ont ete inversees jusqu'au 2026-09-18.
// Personne ne s'en est apercu par le code, seulement a table.
//
// Ce fichier ne prouve pas que les valeurs sont JUSTES — aucun test ne peut le
// faire, c'est une regle maison. Il rend toute modification VOLONTAIRE : on ne
// peut plus changer le bareme par accident, il faut venir editer ce fichier.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICE_TABLE } from '../js/engine.js';

// Le bareme de reference, recopie a la main depuis le §3.11 de la spec.
const REFERENCE = [
  ['Un 1 seul', 100],
  ['Un 5 seul', 50],
  ['Trois 1', 1000],
  ['Trois 2', 200],
  ['Trois 3', 300],
  ['Trois 4', 400],
  ['Trois 5', 500],
  ['Trois 6', 600],
  ['Suite 1-2-3-4-5', 500],
  ['Suite 2-3-4-5-6', 750],
];

test('le bareme est exactement celui du §3.11, libelles compris', () => {
  assert.deepEqual(DICE_TABLE, REFERENCE,
    'Si ce test casse, c\'est soit une faute de frappe, soit un changement de regle.\n'
    + '    Dans le second cas : editer AUSSI le §3.11 de docs/specifications.md.');
});

test('la suite 2-3-4-5-6 vaut plus que la 1-2-3-4-5', () => {
  // La regle maison, dans le sens ou elle a ete tranchee. L'inversion de ces
  // deux lignes est l'erreur exacte qui a vecu dans le depot, donc elle a son
  // propre test, qui la nomme.
  const petite = DICE_TABLE.find(([n]) => n === 'Suite 1-2-3-4-5')[1];
  const grande = DICE_TABLE.find(([n]) => n === 'Suite 2-3-4-5-6')[1];
  assert.equal(petite, 500);
  assert.equal(grande, 750);
  assert.ok(grande > petite, 'les suites sont inversees');
});

test('aucune valeur du bareme n\'est absurde', () => {
  for (const [nom, pts] of DICE_TABLE) {
    assert.ok(typeof nom === 'string' && nom.length, 'chaque ligne a un libelle');
    assert.ok(Number.isInteger(pts) && pts > 0, `${nom} : points entiers et positifs`);
    assert.equal(pts % 50, 0, `${nom} : tout le bareme est multiple de 50 (§3.2)`);
  }
});
