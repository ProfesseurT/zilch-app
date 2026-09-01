import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, apply, undo, view, RuleError, CONFIG } from '../js/engine.js';

const P = [
  { id: 'a', name: 'Ana' },
  { id: 'b', name: 'Bruno' },
  { id: 'c', name: 'Carla' },
];
const g = () => createGame(P);
const score = (s, points, diceLeft = 2) => apply(s, { type: 'SCORE', points, diceLeft });
const z = (s) => apply(s, { type: 'Z' });
const zp = (s) => apply(s, { type: 'Z_PLUS' });
const fail = (s) => apply(s, { type: 'FAILED_ATTEMPT' });
const decline = (s) => apply(s, { type: 'DECLINE_CARRY' });
const take = (s) => apply(s, { type: 'TAKE_CARRY' });
const throws = (fn) => assert.throws(fn, RuleError);

// --- Plancher et essais -----------------------------------------------------

test('refus d un score entre 1 et 249', () => {
  throws(() => score(g(), 200));
  throws(() => score(g(), 50));
});

test('validation d un score de 250 et au-dela', () => {
  assert.equal(score(g(), 250).scores.a, 250);
  assert.equal(score(g(), 1450).scores.a, 1450);
});

test('un score doit etre un multiple de 50', () => {
  throws(() => score(g(), 275));
});

test('les des laisses vont de 1 a 4, jamais 0', () => {
  throws(() => score(g(), 300, 0));
  throws(() => score(g(), 300, 5));
  assert.equal(score(g(), 300, 1).pending.dice, 1);
  assert.equal(score(g(), 300, 4).pending.dice, 4);
});

test('trois essais insuffisants declenchent un Z automatique', () => {
  let s = g();
  s = fail(s); s = fail(s);
  assert.equal(s.activeIndex, 0, 'toujours le meme joueur apres deux essais');
  assert.equal(s.punitive.a, 0);
  s = fail(s);
  assert.equal(s.activeIndex, 1, 'le tour est passe');
  assert.equal(s.punitive.a, CONFIG.zPoints, 'un Z a ete enregistre');
});

test('un essai reussi remet le compteur d essais a zero au tour suivant', () => {
  let s = g();
  s = fail(s);
  s = score(s, 300);
  assert.equal(s.attempts, 0);
});

// --- Main pleine ------------------------------------------------------------

test('un tour reussi ne laisse jamais zero de', () => {
  throws(() => score(g(), 750, 0));
});

// --- Reprise ----------------------------------------------------------------

test('un Z ne laisse aucun de a reprendre', () => {
  assert.equal(z(g()).pending, null);
});

test('un Z+ ne laisse aucun de a reprendre', () => {
  assert.equal(zp(g()).pending, null);
});

test('la reprise est proposee apres un score', () => {
  const s = score(g(), 400, 2);
  assert.deepEqual(view.carryOffer(s), { score: 400, dice: 2 });
});

test('le repreneur ne peut pas encaisser sans ajouter de points', () => {
  let s = score(g(), 400, 2);
  s = take(s);
  throws(() => score(s, 400, 1));
  throws(() => score(s, 350, 1));
});

test('reprise reussie : le repreneur encaisse le total, le precedent garde ses points', () => {
  let s = score(g(), 400, 2);
  s = take(s);
  s = score(s, 700, 1);
  assert.equal(s.scores.a, 400, 'Ana conserve ses points');
  assert.equal(s.scores.b, 700, 'Bruno encaisse le total complet');
});

test('lancer blanc en reprise : tout est perdu, heritage compris', () => {
  let s = score(g(), 400, 2);
  s = take(s);
  s = z(s);                       // un tour repris ne peut produire qu'un Z
  assert.equal(s.scores.b, 0);
  assert.equal(s.scores.a, 400, 'le joueur precedent n est pas touche');
  assert.equal(s.punitive.b, CONFIG.zPoints);
});

test('les trois essais ne s appliquent pas a un tour repris', () => {
  let s = score(g(), 400, 2);
  s = take(s);
  throws(() => fail(s));
});

test('refuser la reprise efface l offre', () => {
  let s = score(g(), 400, 2);
  s = decline(s);
  assert.equal(s.pending, null);
  assert.equal(view.carryOffer(s), null);
});

test('la reprise peut s enchainer', () => {
  let s = score(g(), 400, 2);
  s = take(s); s = score(s, 700, 1);
  assert.deepEqual(view.carryOffer(s), { score: 700, dice: 1 });
});

// --- Compteur punitif et penalite -------------------------------------------

test('Z vaut 1 point punitif, Z+ en vaut 2', () => {
  assert.equal(z(g()).punitive.a, 1);
  assert.equal(zp(g()).punitive.a, 2);
});

const roundOf = (s, acts) => acts.reduce((acc, f) => f(acc), s);
const otherPlayersScore = (s) => score(score(s, 300, 2), 300, 2);

test('deux Z ne declenchent aucune penalite', () => {
  let s = g();
  s = z(s); s = otherPlayersScore(s);
  s = z(s);
  assert.equal(s.scores.a, 0);
  assert.equal(s.punitive.a, 2);
});

test('trois Z declenchent la penalite au troisieme', () => {
  let s = createGame(P);
  s = score(s, 3000, 2); s = otherPlayersScore(s);          // Ana se constitue un capital
  for (let i = 0; i < 3; i++) { s = z(s); s = otherPlayersScore(s); }
  assert.equal(s.scores.a, 2000);
  assert.equal(s.punitive.a, 0, 'compteur remis a zero');
});

test('deux Z+ declenchent la penalite au second', () => {
  let s = createGame(P);
  s = score(s, 3000, 2); s = otherPlayersScore(s);
  s = zp(s); s = otherPlayersScore(s);
  assert.equal(s.scores.a, 3000, 'un seul Z+ ne suffit pas');
  s = zp(s);
  assert.equal(s.scores.a, 2000);
});

test('Z puis Z+ declenche la penalite, et Z+ puis Z aussi', () => {
  for (const seq of [[z, zp], [zp, z]]) {
    let s = createGame(P);
    s = score(s, 3000, 2); s = otherPlayersScore(s);
    for (const act of seq) { s = act(s); s = otherPlayersScore(s); }
    assert.equal(s.scores.a, 2000, `sequence ${seq.length}`);
  }
});

test('un score valide remet le compteur punitif a zero', () => {
  let s = createGame(P);
  s = zp(s); s = otherPlayersScore(s);
  s = score(s, 300, 2); s = otherPlayersScore(s);
  s = zp(s);
  assert.equal(s.punitive.a, 2, 'la serie est repartie de zero');
  assert.equal(s.scores.a, 300, 'aucune penalite');
});

test('les tours des autres joueurs n affectent pas le compteur d un joueur', () => {
  let s = createGame(P);
  s = score(s, 3000, 2);
  s = z(s); s = z(s);                 // Bruno et Carla enchainent les Z
  s = z(s);                            // Ana : premier Z
  assert.equal(s.punitive.a, 1);
  assert.equal(s.scores.a, 3000, 'Ana n est pas penalisee');
});

test('penalite sur un joueur a 300 points : plancher a zero, trace exacte', () => {
  let s = createGame(P);
  s = score(s, 300, 2); s = otherPlayersScore(s);
  s = zp(s); s = otherPlayersScore(s);
  s = zp(s);
  assert.equal(s.scores.a, 0);
  assert.deepEqual(s.lastPenalty, { id: 'a', nominal: 1000, applied: 300 });
});

test('penalite sur un joueur a zero : le score reste a zero', () => {
  let s = createGame(P);
  s = zp(s); s = otherPlayersScore(s);
  s = zp(s);
  assert.equal(s.scores.a, 0);
  assert.equal(s.lastPenalty.applied, 0);
});

// --- Fin de partie ----------------------------------------------------------

test('franchir 10 000 declenche le dernier tour, pas la fin', () => {
  const s = score(g(), 10000, 2);
  assert.equal(s.status, 'FINAL_ROUND');
  assert.equal(s.trigger, 'a');
  assert.equal(s.winner, null);
});

test('chaque joueur restant joue exactement une fois', () => {
  let s = score(g(), 10000, 2);
  s = z(s);
  assert.equal(s.status, 'FINAL_ROUND');
  s = z(s);
  assert.equal(s.status, 'FINISHED');
  assert.equal(s.winner, 'a');
});

test('le declencheur ne rejoue pas mais laisse ses des reprenables', () => {
  const s = score(g(), 10000, 3);
  assert.deepEqual(view.carryOffer(s), { score: 10000, dice: 3 });
});

test('un joueur qui depasse le declencheur pendant le dernier tour gagne', () => {
  let s = score(g(), 10000, 2);
  s = decline(s); s = score(s, 10500, 2);
  s = decline(s); s = z(s);
  assert.equal(s.status, 'FINISHED');
  assert.equal(s.winner, 'b');
});

test('egalite parfaite : le declencheur l emporte', () => {
  let s = score(g(), 10000, 2);
  s = decline(s); s = score(s, 10000, 2);
  s = decline(s); s = z(s);
  assert.equal(s.winner, 'a');
});

test('la penalite s applique normalement pendant le dernier tour', () => {
  const duo = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }];
  let s = createGame(duo);
  s = score(s, 300, 2);                        // Ana 300
  s = decline(s); s = score(s, 2000, 2);       // Bruno 2000
  s = decline(s); s = score(s, 300, 2);        // Ana 600
  s = decline(s); s = zp(s);                   // Bruno : 2 points punitifs
  s = score(s, 9400, 2);                       // Ana 10000 -> dernier tour
  assert.equal(s.status, 'FINAL_ROUND');
  s = decline(s); s = z(s);                    // Bruno : 3e point punitif
  assert.equal(s.status, 'FINISHED');
  assert.equal(s.scores.b, 1000, 'penalite appliquee pendant le dernier tour');
  assert.deepEqual(s.lastPenalty, { id: 'b', nominal: 1000, applied: 1000 });
  assert.equal(s.winner, 'a');
});

test('aucune commande n est acceptee apres la fin', () => {
  let s = score(g(), 10000, 2);
  s = z(s); s = z(s);
  throws(() => z(s));
});

// --- Annulation -------------------------------------------------------------

test('annulation d un score', () => {
  const s0 = g();
  const s1 = score(s0, 450, 2);
  const back = undo(s1);
  assert.equal(back.scores.a, 0);
  assert.equal(back.activeIndex, 0);
  assert.equal(back.pending, null);
});

test('annulation d un Z et d un Z+', () => {
  for (const act of [z, zp]) {
    const back = undo(act(g()));
    assert.equal(back.punitive.a, 0);
    assert.equal(back.activeIndex, 0);
  }
});

test('annulation du Z automatique du troisieme essai', () => {
  let s = g();
  s = fail(s); s = fail(s); s = fail(s);
  assert.equal(s.activeIndex, 1);
  s = undo(s);
  assert.equal(s.activeIndex, 0);
  assert.equal(s.attempts, 2);
  assert.equal(s.punitive.a, 0);
});

test('annulation d une reprise : des et total du precedent restaures', () => {
  let s = score(g(), 400, 2);
  s = take(s); s = score(s, 700, 1);
  s = undo(s); s = undo(s);
  assert.deepEqual(view.carryOffer(s), { score: 400, dice: 2 });
  assert.equal(s.scores.b, 0);
});

test('annulation d une penalite : score restaure avant plancher', () => {
  let s = createGame(P);
  s = score(s, 300, 2); s = otherPlayersScore(s);
  s = zp(s); s = otherPlayersScore(s);
  s = zp(s);
  assert.equal(s.scores.a, 0);
  s = undo(s);
  assert.equal(s.scores.a, 300, 'les 300 points sont revenus');
  assert.equal(s.punitive.a, 2);
});

test('annulation du tour declenchant le dernier tour', () => {
  let s = score(g(), 10000, 2);
  assert.equal(s.status, 'FINAL_ROUND');
  s = undo(s);
  assert.equal(s.status, 'IN_PROGRESS');
  assert.equal(s.trigger, null);
});

test('annulation du tour gagnant', () => {
  let s = score(g(), 10000, 2);
  s = z(s); s = z(s);
  assert.equal(s.status, 'FINISHED');
  s = undo(s);
  assert.equal(s.status, 'FINAL_ROUND');
  assert.equal(s.winner, null);
});

test('une partie complete se rejoue a l identique depuis son historique', () => {
  let s = g();
  s = score(s, 450, 2); s = take(s); s = score(s, 900, 1); s = decline(s);
  s = fail(s); s = z(s); s = score(s, 300, 3);
  const rebuilt = s.events.reduce((acc, e) => apply(acc, e), createGame(P));
  assert.deepEqual(rebuilt.scores, s.scores);
  assert.deepEqual(rebuilt.punitive, s.punitive);
  assert.equal(rebuilt.activeIndex, s.activeIndex);
});

// --- Garde-fous -------------------------------------------------------------

test('il faut au moins deux joueurs', () => {
  throws(() => createGame([{ id: 'a', name: 'Ana' }]));
});

test('reprendre sans des disponibles est refuse', () => {
  throws(() => take(g()));
});

// --- Restriction du Z+ au premier lancer ------------------------------------

test('le Z+ est refuse apres un essai rate', () => {
  let s = fail(g());
  throws(() => zp(s));
  assert.equal(z(s).punitive.a, 1, 'seul le Z est possible');
});

test('le Z+ est refuse pendant un tour repris', () => {
  let s = score(g(), 400, 2);
  s = take(s);
  throws(() => zp(s));
});

test('un lancer blanc en reprise est un Z : 1 point punitif, heritage perdu', () => {
  let s = score(g(), 400, 2);
  s = take(s);
  s = z(s);
  assert.equal(s.scores.b, 0);
  assert.equal(s.punitive.b, 1);
  assert.equal(s.scores.a, 400, 'le precedent conserve ses points');
});

test('le Z+ reste possible au premier lancer apres un refus de reprise', () => {
  let s = score(g(), 400, 2);
  s = decline(s);
  assert.equal(zp(s).punitive.b, 2);
});

test('chaque penalite laisse une trace, meme appliquee a zero', () => {
  let s = createGame([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }]);
  // Ana enchaine trois Z ; son score n'a jamais depasse zero.
  for (let i = 0; i < 3; i++) {
    s = apply(s, { type: 'Z' });                 // Ana
    if (s.status === 'FINISHED') break;
    s = apply(s, { type: 'SCORE', points: 250, diceLeft: 2 }); // Bruno
    s = apply(s, { type: 'DECLINE_CARRY' });     // Ana repart de zero
  }
  assert.equal(s.penalties.length, 1, 'une seule penalite declenchee');
  assert.equal(s.penalties[0].id, 'a');
  assert.equal(s.penalties[0].nominal, CONFIG.penalty);
  assert.equal(s.penalties[0].applied, 0, 'un joueur a zero ne descend pas sous zero');
  assert.equal(s.scores.a, 0);
});
