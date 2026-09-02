import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyStore, addPlayer, renamePlayer, startGame, record, getGame,
  replayGame, undoLast, stats, exportJSON, importJSON, migrateLegacy,
  SCHEMA_VERSION, StoreError, LEGACY_KEY,
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
//
// Les fixtures ci-dessous reproduisent la forme REELLE de l'ancien etat, telle
// que relevee dans l'index.html de l'ebauche (archive dans docs/archive/).
// Ne pas les remplacer par des formes inventees : c'est ce qui rendait la
// version precedente de ces tests verte et sans valeur.

const LEGACY = {
  version: 1,
  sound: true,
  players: [
    { id: 'p-ana', name: 'Ana', createdAt: '2026-05-01T18:00:00.000Z' },
    { id: 'p-bruno', name: 'Bruno', createdAt: '2026-05-01T18:00:10.000Z' },
  ],
  games: [
    {
      id: 'g-1',
      startedAt: '2026-05-02T20:00:00.000Z',
      finishedAt: '2026-05-02T21:10:00.000Z',
      locationLabel: 'Porto',
      geo: { lat: 41.1496, lon: -8.611, accuracy: 12 },
      turnIndex: 0,
      entryAttempts: 0,
      winnerId: 'p-ana',
      abandoned: false,
      participants: [
        { playerId: 'p-ana', nameSnapshot: 'Ana', score: 10250, lossSeq: [] },
        { playerId: 'p-bruno', nameSnapshot: 'Bruno', score: 8900, lossSeq: ['Z'] },
      ],
      events: [
        {
          id: 'e-1', at: '2026-05-02T20:01:00.000Z', playerId: 'p-ana', playerName: 'Ana',
          type: 'score', points: 450, penalty: 0, afterScore: 450,
          before: { turnIndex: 0, entryAttempts: 0, participants: [{ score: 0, lossSeq: [] }, { score: 0, lossSeq: [] }] },
        },
      ],
    },
  ],
  activeGame: null,
};

test('la migration reprend les joueurs a l identique', () => {
  const s = migrateLegacy(LEGACY);
  assert.deepEqual(s.players.map((p) => p.name), ['Ana', 'Bruno']);
  assert.equal(s.players[0].id, 'p-ana', 'les identifiants existants sont conserves');
  assert.equal(s.players[0].createdAt, '2026-05-01T18:00:00.000Z');
});

test('la migration ne convertit aucune partie mais n en perd aucune', () => {
  const s = migrateLegacy(LEGACY);
  assert.deepEqual(s.games, [], 'aucune partie inventee dans le nouveau modele');
  assert.deepEqual(s.legacyArchive, LEGACY, 'l ancien etat reste integralement recuperable');
  assert.equal(s.legacyArchive.games[0].events.length, 1, 'les evenements d origine sont intacts');
  assert.equal(s.migratedFrom, LEGACY_KEY);
});

test('la migration ecarte les doublons de nom', () => {
  const s = migrateLegacy({ players: [{ name: 'Ana' }, { name: 'ana' }, { name: 'Bruno' }] });
  assert.deepEqual(s.players.map((p) => p.name), ['Ana', 'Bruno']);
});

test('la migration accepte des joueurs sous forme de simples chaines', () => {
  const s = migrateLegacy({ players: ['Ana', 'Bruno'], games: [] });
  assert.equal(s.players.length, 2);
  assert.ok(s.players[0].id, 'un identifiant est genere quand il manque');
});

test('la migration survit a des donnees absentes ou corrompues', () => {
  for (const bad of [null, undefined, {}, { players: 'nope', games: 3 }, { players: [null, '', { name: '  ' }] }]) {
    const s = migrateLegacy(bad);
    assert.equal(s.schema, SCHEMA_VERSION);
    assert.deepEqual(s.players, []);
    assert.deepEqual(s.games, []);
  }
});

test('un etat migre est exportable et reimportable sans perte', () => {
  const s = migrateLegacy(LEGACY);
  const back = importJSON(emptyStore(), exportJSON(s));
  assert.equal(back.players.length, 2);
  assert.equal(back.players[0].name, 'Ana');
});

test('un joueur migre reste utilisable par le reste du store', () => {
  let s = migrateLegacy(LEGACY);
  s = startGame(s, s.players.map((p) => p.id), 'Porto');
  assert.equal(s.games.length, 1, 'une partie demarre avec des joueurs migres');
  assert.throws(() => addPlayer(s, 'Ana'), StoreError, 'l unicite des noms tient apres migration');
});

// --- Statistiques (regression : tours attribues au mauvais joueur) ----------

function partieAvecZauto() {
  // Ana rate 3 essais (Z automatique), Bruno marque, Ana marque, Bruno perd.
  let s = emptyStore();
  s = addPlayer(s, 'Ana');
  s = addPlayer(s, 'Bruno');
  const [ana, bruno] = s.players.map((p) => p.id);
  s = startGame(s, [ana, bruno]);
  const g = s.games.at(-1).id;
  for (const e of [
    { type: 'FAILED_ATTEMPT' }, { type: 'FAILED_ATTEMPT' }, { type: 'FAILED_ATTEMPT' },
    { type: 'SCORE', points: 700, diceLeft: 2 },   // Bruno
    { type: 'TAKE_CARRY' },                        // Ana reprend
    { type: 'SCORE', points: 900, diceLeft: 1 },   // Ana
    { type: 'DECLINE_CARRY' },                     // Bruno repart de zero
    { type: 'Z' },                                 // Bruno
  ]) s = record(s, g, e);
  return { s, ana, bruno };
}

test('les tours ne sont plus attribues au mauvais joueur apres un Z automatique', () => {
  const { s, ana, bruno } = partieAvecZauto();
  const a = stats(s, ana);
  const b = stats(s, bruno);
  assert.equal(a.turns, 2, 'Ana : son Z automatique et son tour a 900');
  assert.equal(a.z, 1);
  assert.equal(a.bestTurn, 900, 'le meilleur tour d Ana lui appartient');
  assert.equal(a.carryTaken, 1);
  assert.equal(a.carryWon, 1);
  assert.equal(b.turns, 2, 'Bruno : son tour a 700 et son Z');
  assert.equal(b.z, 1);
  assert.equal(b.bestTurn, 700);
  assert.equal(b.carryTaken, 0);
});

test('les statistiques comptent les penalites', () => {
  let s = emptyStore();
  s = addPlayer(s, 'Ana');
  s = addPlayer(s, 'Bruno');
  const [ana, bruno] = s.players.map((p) => p.id);
  s = startGame(s, [ana, bruno]);
  const g = s.games.at(-1).id;
  // Ana : Z, Z, Z+ -> 1+1+2 = 4, penalite au troisieme.
  for (const e of [
    { type: 'Z' }, { type: 'SCORE', points: 250, diceLeft: 2 }, { type: 'DECLINE_CARRY' },
    { type: 'Z' }, { type: 'SCORE', points: 250, diceLeft: 2 }, { type: 'DECLINE_CARRY' },
    { type: 'Z_PLUS' },
  ]) s = record(s, g, e);
  assert.equal(stats(s, ana).penalties, 1);
  assert.equal(stats(s, ana).z, 2);
  assert.equal(stats(s, ana).zPlus, 1);
  assert.equal(stats(s, bruno).penalties, 0);
});

test('la moyenne d un tour positif ignore la penalite', () => {
  let s = emptyStore();
  s = addPlayer(s, 'Ana');
  s = addPlayer(s, 'Bruno');
  const [ana, bruno] = s.players.map((p) => p.id);
  s = startGame(s, [ana, bruno]);
  const g = s.games.at(-1).id;
  for (const e of [
    { type: 'SCORE', points: 3000, diceLeft: 2 },   // Ana : un seul tour positif
    { type: 'DECLINE_CARRY' }, { type: 'Z' },       // Bruno
    { type: 'Z' },                                  // Ana
    { type: 'Z' },                                  // Bruno
    { type: 'Z' },                                  // Ana
    { type: 'Z' },                                  // Bruno
    { type: 'Z' },                                  // Ana : 3e Z -> penalite
  ]) s = record(s, g, e);
  const a = stats(s, ana);
  assert.equal(a.penalties, 1);
  assert.equal(a.positiveTurns, 1);
  assert.equal(a.bestTurn, 3000);
  assert.equal(a.avgPositiveTurn, 3000, 'le tour valait 3000, la penalite est venue apres');
});

test('les tours d une partie inachevee comptent quand meme', () => {
  const { s, ana } = partieAvecZauto();     // partie toujours IN_PROGRESS
  const a = stats(s, ana);
  assert.equal(a.games, 0, 'aucune partie terminee');
  assert.equal(a.turns, 2, 'mais ses tours existent');
});
