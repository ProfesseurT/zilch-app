import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyStore, addPlayer, renamePlayer, startGame, record, getGame,
  replayGame, undoLast, stats, exportJSON, importJSON, migrateLegacy,
  SCHEMA_VERSION, StoreError,
} from '../js/store.js';

const throws = (fn) => assert.throws(fn, StoreError);

function base() {
  let s = emptyStore();
  s = addPlayer(s, 'Ana');
  s = addPlayer(s, 'Bruno');
  return s;
}
const ids = (s) => s.players.map((p) => p.id);

function partieDemarree() {
  const s = base();
  return startGame(s, ids(s));
}

// --- Joueurs ----------------------------------------------------------------

test('creation et unicite des joueurs', () => {
  const s = base();
  assert.equal(s.players.length, 2);
  throws(() => addPlayer(s, 'ana'));
  throws(() => addPlayer(s, '   '));
});

test('un joueur peut etre renomme sans perdre son identifiant', () => {
  let s = base();
  const id = s.players[0].id;
  s = renamePlayer(s, id, 'Ana Maria');
  assert.equal(s.players[0].id, id);
  assert.equal(s.players[0].name, 'Ana Maria');
});

test('les joueurs sont reutilises, jamais dupliques entre parties', () => {
  let s = base();
  s = startGame(s, ids(s));
  s = startGame(s, ids(s));
  assert.equal(s.players.length, 2);
  assert.equal(s.games.length, 2);
});

// --- Parties et rejeu -------------------------------------------------------

test('une partie exige au moins deux joueurs connus', () => {
  const s = base();
  throws(() => startGame(s, [s.players[0].id]));
  throws(() => startGame(s, [s.players[0].id, 'inconnu']));
});

test('un evenement refuse par le moteur n est pas enregistre', () => {
  let s = partieDemarree();
  const g = s.games[0].id;
  assert.throws(() => record(s, g, { type: 'SCORE', points: 200, diceLeft: 2 }));
  assert.equal(getGame(s, g).events.length, 0);
});

test('l etat d une partie se rejoue depuis ses evenements', () => {
  let s = partieDemarree();
  const g = s.games[0].id;
  s = record(s, g, { type: 'SCORE', points: 450, diceLeft: 2 });
  s = record(s, g, { type: 'TAKE_CARRY' });
  s = record(s, g, { type: 'SCORE', points: 900, diceLeft: 1 });
  const state = replayGame(s, getGame(s, g));
  assert.equal(state.scores[ids(s)[0]], 450);
  assert.equal(state.scores[ids(s)[1]], 900);
});

test('la partie passe en FINISHED et retient le vainqueur', () => {
  let s = partieDemarree();
  const g = s.games[0].id;
  s = record(s, g, { type: 'SCORE', points: 10000, diceLeft: 2 });
  assert.equal(getGame(s, g).status, 'FINAL_ROUND');
  s = record(s, g, { type: 'DECLINE_CARRY' });
  s = record(s, g, { type: 'Z' });
  const game = getGame(s, g);
  assert.equal(game.status, 'FINISHED');
  assert.equal(game.winner, ids(s)[0]);
  assert.ok(game.finishedAt, 'la date de fin est renseignee');
});

test('aucun evenement n est accepte apres la fin', () => {
  let s = partieDemarree();
  const g = s.games[0].id;
  s = record(s, g, { type: 'SCORE', points: 10000, diceLeft: 2 });
  s = record(s, g, { type: 'DECLINE_CARRY' });
  s = record(s, g, { type: 'Z' });
  throws(() => record(s, g, { type: 'Z' }));
});

test('annuler la derniere action ramene la partie a son etat precedent', () => {
  let s = partieDemarree();
  const g = s.games[0].id;
  s = record(s, g, { type: 'SCORE', points: 10000, diceLeft: 2 });
  s = record(s, g, { type: 'DECLINE_CARRY' });
  s = record(s, g, { type: 'Z' });
  assert.equal(getGame(s, g).status, 'FINISHED');
  s = undoLast(s, g);
  const game = getGame(s, g);
  assert.equal(game.status, 'FINAL_ROUND');
  assert.equal(game.winner, null);
  assert.equal(game.finishedAt, null);
});

test('annuler sur une partie vide ne casse rien', () => {
  const s = partieDemarree();
  assert.deepEqual(undoLast(s, s.games[0].id), s);
});

// --- Statistiques -----------------------------------------------------------

test('les statistiques se recalculent depuis l historique', () => {
  let s = partieDemarree();
  const g = s.games[0].id;
  const [ana, bruno] = ids(s);
  s = record(s, g, { type: 'SCORE', points: 600, diceLeft: 2 });
  s = record(s, g, { type: 'DECLINE_CARRY' });
  s = record(s, g, { type: 'Z_PLUS' });
  s = record(s, g, { type: 'SCORE', points: 9400, diceLeft: 2 });
  s = record(s, g, { type: 'DECLINE_CARRY' });
  s = record(s, g, { type: 'Z' });
  assert.equal(getGame(s, g).status, 'FINISHED');

  const a = stats(s, ana);
  assert.equal(a.games, 1);
  assert.equal(a.wins, 1);
  assert.equal(a.winRate, 1);
  assert.equal(a.positiveTurns, 2);
  assert.equal(a.bestTurn, 9400);

  const b = stats(s, bruno);
  assert.equal(b.wins, 0);
  assert.equal(b.zPlus, 1);
  assert.equal(b.z, 1);
});

test('une partie en cours ne compte pas dans les statistiques', () => {
  let s = partieDemarree();
  s = record(s, s.games[0].id, { type: 'SCORE', points: 300, diceLeft: 2 });
  assert.equal(stats(s, ids(s)[0]).games, 0);
});

// --- Export et import -------------------------------------------------------

test('export puis import redonnent des donnees identiques', () => {
  let s = partieDemarree();
  s = record(s, s.games[0].id, { type: 'SCORE', points: 450, diceLeft: 2 });
  const json = exportJSON(s);
  const vide = emptyStore();
  const restore = importJSON(vide, json);
  assert.deepEqual(restore.players, s.players);
  assert.deepEqual(restore.games, s.games);
});

test('un import ne duplique pas ce qui est deja la', () => {
  let s = partieDemarree();
  const json = exportJSON(s);
  const merged = importJSON(s, json);
  assert.equal(merged.players.length, 2);
  assert.equal(merged.games.length, 1);
});

test('un import fusionne sans ecraser les donnees existantes', () => {
  let a = base();
  a = startGame(a, ids(a));
  let b = emptyStore();
  b = addPlayer(b, 'Carla');
  const merged = importJSON(b, exportJSON(a));
  assert.equal(merged.players.length, 3);
  assert.ok(merged.players.some((p) => p.name === 'Carla'), 'Carla est conservee');
});

test('un JSON illisible est refuse proprement', () => {
  const s = base();
  throws(() => importJSON(s, 'ceci nest pas du json'));
  throws(() => importJSON(s, 'null'));
});

test('une version de schema inconnue est refusee', () => {
  const s = base();
  throws(() => importJSON(s, JSON.stringify({ schema: 99, players: [], games: [] })));
  throws(() => importJSON(s, JSON.stringify({ players: [], games: [] })));
});

test('une structure incomplete est refusee', () => {
  const s = base();
  throws(() => importJSON(s, JSON.stringify({ schema: SCHEMA_VERSION, players: [] })));
});

// --- Migration --------------------------------------------------------------

test('la migration preserve les noms de joueurs', () => {
  const legacy = { version: 1, sound: true, players: [{ id: 'x', name: 'Ana' }, { name: 'Bruno' }], games: [] };
  const s = migrateLegacy(legacy);
  assert.deepEqual(s.players.map((p) => p.name), ['Ana', 'Bruno']);
  assert.equal(s.players[0].id, 'x', 'un identifiant existant est conserve');
  assert.ok(s.players[1].id, 'un identifiant est genere sinon');
});

test('la migration accepte des joueurs sous forme de simples chaines', () => {
  const s = migrateLegacy({ players: ['Ana', 'Bruno'], games: [] });
  assert.equal(s.players.length, 2);
});

test('la migration ne jette aucune donnee de partie', () => {
  const g = { date: '2026-01-01', gagnant: 'x', bidule: 42 };
  const s = migrateLegacy({ players: [], games: [g] });
  assert.equal(s.games.length, 1);
  assert.deepEqual(s.games[0].legacyRaw, g, 'tout l original reste recuperable');
  assert.equal(s.games[0].winner, 'x');
});

test('la migration survit a des donnees absentes ou corrompues', () => {
  for (const bad of [null, undefined, {}, { players: 'nope', games: 3 }]) {
    const s = migrateLegacy(bad);
    assert.equal(s.schema, SCHEMA_VERSION);
    assert.deepEqual(s.players, []);
    assert.deepEqual(s.games, []);
  }
});

test('les donnees migrees sont exportables et reimportables', () => {
  const s = migrateLegacy({ players: ['Ana', 'Bruno'], games: [] });
  const back = importJSON(emptyStore(), exportJSON(s));
  assert.equal(back.players.length, 2);
});
