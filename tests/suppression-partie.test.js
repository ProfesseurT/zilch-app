// Effacer une partie.
//
// Geste irreversible qui change les statistiques de tous ceux qui y etaient.
// Ces tests verifient les deux seules choses qui comptent : la partie en cours
// est protegee, et les chiffres suivent sans qu on les touche.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyStore, addPlayer, startGame, record, deleteGame, abandonGame,
  stats, currentGame, StoreError,
} from '../js/store.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function deuxParties() {
  let s = emptyStore();
  s = addPlayer(s, 'Ana');
  s = addPlayer(s, 'Bruno');
  const ids = s.players.map((p) => p.id);

  s = startGame(s, ids);
  const a = s.games.at(-1).id;
  s = record(s, a, { type: 'SCORE', points: 300, diceLeft: 2 });
  s = record(s, a, { type: 'Z' });
  s = abandonGame(s, a);

  s = startGame(s, ids);
  const b = s.games.at(-1).id;
  s = record(s, b, { type: 'SCORE', points: 300, diceLeft: 2 });
  s = abandonGame(s, b);

  return { s, a, b, ids };
}

test('une partie effacee disparait de la liste', () => {
  const { s, a, b } = deuxParties();
  const apres = deleteGame(s, a);
  assert.equal(apres.games.length, 1);
  assert.equal(apres.games[0].id, b);
});

test('les statistiques suivent sans etre touchees', () => {
  const { s, a, ids } = deuxParties();
  const avant = stats(s, ids[0]);
  const apres = stats(deleteGame(s, a), ids[0]);
  assert.equal(avant.turns - apres.turns, 1, 'le tour de la partie effacee ne compte plus');
  assert.equal(avant.z - apres.z, 0, 'le Z etait sur le tour de Bruno');
});

test('les tours de la partie effacee ne comptent plus pour personne', () => {
  const { s, a, ids } = deuxParties();
  const apres = deleteGame(s, a);
  assert.equal(stats(apres, ids[1]).z, 0);
  assert.equal(stats(s, ids[1]).z, 1);
});

test('la partie en cours ne peut pas etre effacee', () => {
  let s = emptyStore();
  s = addPlayer(s, 'Ana');
  s = addPlayer(s, 'Bruno');
  s = startGame(s, s.players.map((p) => p.id));
  const id = currentGame(s).id;
  assert.throws(() => deleteGame(s, id), StoreError);
});

test('effacer une partie inconnue echoue au lieu de ne rien faire', () => {
  const { s } = deuxParties();
  assert.throws(() => deleteGame(s, 'inexistant'), StoreError);
});

test('effacer ne touche pas aux joueurs', () => {
  const { s, a } = deuxParties();
  assert.deepEqual(deleteGame(s, a).players, s.players);
});

test("l ecran d historique propose bien la suppression", () => {
  // ui.js n est pas executable ici : on verifie le cablage par lecture.
  const src = readFileSync(fileURLToPath(new URL('../js/ui.js', import.meta.url)), 'utf8');
  assert.match(src, /monterSuppression/, 'la carte d historique doit monter le bouton');
  assert.match(src, /store\.deleteGame/, 'le bouton doit appeler deleteGame');
  assert.match(src, /Effacer définitivement/, 'un second tap doit confirmer');
});
