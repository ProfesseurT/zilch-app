// Monter la table sans impasse.
//
// L'ecran Nouvelle partie affichait « Ajoute d'abord des joueurs » et rien
// d'autre : au premier soir, sans un seul joueur enregistre, la seule sortie
// etait la barre du bas. Ces tests verrouillent les deux issues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(racine + 'index.html', 'utf8');
const ui = readFileSync(racine + 'js/ui.js', 'utf8');

const ecran = html.slice(html.indexOf('id="e-nouvelle"'), html.indexOf('id="e-partie"'));

test('on peut creer un joueur sans quitter Nouvelle partie', () => {
  assert.match(ecran, /<input id="joueur-express"/, 'un champ de saisie sur l ecran lui-meme');
  assert.match(ecran, /id="b-joueur-express"/, 'et le bouton qui valide');
  assert.match(ecran, /<label class="legende espace" for="joueur-express">/,
    'un vrai libelle, pas un placeholder qui disparait a la frappe');
});

test('le joueur cree entre tout de suite dans l ordre du tour', () => {
  const bloc = ui.slice(ui.indexOf("$('b-joueur-express').onclick"));
  assert.match(bloc.slice(0, bloc.indexOf('};')), /selection\.push/,
    'le selectionner ensuite serait un tap pour rien');
});

test('la touche Entree ajoute aussi', () => {
  assert.match(ui, /\$\('joueur-express'\)\.addEventListener\('keydown'/,
    'enchainer quatre prenoms au clavier sans viser un bouton');
});

test('une sortie vers l ecran Joueurs existe', () => {
  assert.match(ecran, /id="b-vers-joueurs"/);
  assert.match(ui, /\$\('b-vers-joueurs'\)\.onclick = \(\) => aller\('joueurs'\)/);
});

test('l ecran vide n est plus une impasse', () => {
  assert.ok(!/Ajoute d\\'abord des joueurs/.test(ui),
    'l ancien message envoyait ailleurs sans dire ou');
  assert.match(ui, /Ajoute les joueurs juste en dessous/,
    'le message doit designer le champ qui est sous lui');
});
