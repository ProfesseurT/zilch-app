import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, apply } from '../js/engine.js';
import { createPicker, allFiles, SOUND_MANIFEST, SoundError, choisirSon, PRIORITE, manifestePour } from '../js/sounds.js';

test('un son tire appartient bien au pool de son evenement', () => {
  const p = createPicker();
  for (let i = 0; i < 200; i++) {
    assert.ok(SOUND_MANIFEST.Z.includes(p.pick('Z')));
  }
});

test('jamais deux fois le meme son de suite pour un meme evenement', () => {
  const p = createPicker();
  let precedent = null;
  for (let i = 0; i < 500; i++) {
    const s = p.pick('Z');
    assert.notEqual(s, precedent, 'repetition immediate detectee');
    precedent = s;
  }
});

test('un pool d un seul son renvoie toujours ce son', () => {
  const p = createPicker();
  assert.equal(p.pick('VICTORY'), 'victoire.mp3');
  assert.equal(p.pick('VICTORY'), 'victoire.mp3');
});

test('les evenements ne se genent pas entre eux', () => {
  const p = createPicker({ Z: ['a', 'b'], Z_PLUS: ['a', 'b'] });
  const z1 = p.pick('Z');
  p.pick('Z_PLUS');
  const z2 = p.pick('Z');
  assert.notEqual(z1, z2, 'la memoire du Z doit etre independante du Z+');
});

test('un evenement sans son declare leve une erreur claire', () => {
  const p = createPicker();
  assert.throws(() => p.pick('INCONNU'), SoundError);
  assert.throws(() => createPicker({ Z: [] }).pick('Z'), SoundError);
});

test('tout le pool finit par sortir', () => {
  const p = createPicker();
  const vus = new Set();
  for (let i = 0; i < 400; i++) vus.add(p.pick('Z'));
  assert.equal(vus.size, SOUND_MANIFEST.Z.length, 'tous les sons doivent etre joues');
});

test('la repartition reste equilibree', () => {
  const p = createPicker();
  const n = {};
  for (let i = 0; i < 12000; i++) {
    const s = p.pick('Z');
    n[s] = (n[s] || 0) + 1;
  }
  const attendu = 12000 / SOUND_MANIFEST.Z.length;
  for (const v of Object.values(n)) {
    assert.ok(Math.abs(v - attendu) < attendu * 0.15, `repartition trop desequilibree : ${v}`);
  }
});

test('la liste des fichiers a precacher couvre TOUS les themes', () => {
  // Sans argument, allFiles doit renvoyer les sons de tous les themes : un
  // theme change en mode avion doit sonner. Un oubli ici est un silence
  // qui n'apparait que hors ligne, donc jamais pendant les tests manuels.
  const f = allFiles();
  assert.equal(new Set(f).size, f.length, 'aucun doublon');
  assert.ok(f.includes('victoire.mp3'));
  assert.ok(f.includes('matrix/victoire.mp3'));
  assert.equal(f.length, 26, '13 sons par voix, deux voix distinctes');
});

test('chaque theme a sa voix, et chaque voix est complete', () => {
  for (const theme of ['azulejo', 'tableau', 'matrix']) {
    const m = manifestePour(theme);
    for (const e of PRIORITE) {
      assert.ok(Array.isArray(m[e]) && m[e].length, `${theme} : ${e} sans son`);
    }
    assert.equal(allFiles(m).length, 13, `${theme} : 13 fichiers attendus`);
  }
  // Un theme inconnu ne rend jamais l'application muette.
  assert.equal(manifestePour('inexistant'), SOUND_MANIFEST);
  assert.notEqual(manifestePour('matrix'), SOUND_MANIFEST, 'matrix a bien sa propre voix');
});

test('le tireur suit le manifeste qu on lui donne', () => {
  const p = createPicker(manifestePour('matrix'));
  for (let i = 0; i < 100; i++) {
    assert.match(p.pick('Z'), /^matrix\//, 'un theme ne doit jamais emprunter la voix d un autre');
  }
});

// --- Un tour = un son ------------------------------------------------------

test('la victoire couvre tout le reste', () => {
  assert.equal(choisirSon({ victoire: true, penalite: true, type: 'Z' }), 'VICTORY');
  assert.equal(choisirSon({ victoire: true, type: 'Z_PLUS' }), 'VICTORY');
  assert.equal(choisirSon({ victoire: true }), 'VICTORY');
});

test('la penalite couvre le Z et le Z+ qui l ont declenchee', () => {
  assert.equal(choisirSon({ penalite: true, type: 'Z' }), 'PENALTY');
  assert.equal(choisirSon({ penalite: true, type: 'Z_PLUS' }), 'PENALTY');
});

test('sans victoire ni penalite, le tour parle de lui-meme', () => {
  assert.equal(choisirSon({ type: 'Z' }), 'Z');
  assert.equal(choisirSon({ type: 'Z_PLUS' }), 'Z_PLUS');
});

test('un tour ordinaire ne joue rien', () => {
  assert.equal(choisirSon({ type: 'SCORE' }), null);
  assert.equal(choisirSon({ type: 'FAILED_ATTEMPT' }), null);
  assert.equal(choisirSon({ type: 'TAKE_CARRY' }), null);
  assert.equal(choisirSon({}), null);
  assert.equal(choisirSon(), null);
});

test('chaque son choisi existe au manifeste et l ordre de priorite est complet', () => {
  for (const e of PRIORITE) {
    assert.ok(Array.isArray(SOUND_MANIFEST[e]) && SOUND_MANIFEST[e].length,
      `${e} doit avoir au moins un fichier`);
  }
  const produits = new Set([
    choisirSon({ victoire: true }), choisirSon({ penalite: true }),
    choisirSon({ type: 'Z_PLUS' }), choisirSon({ type: 'Z' }),
  ]);
  assert.deepEqual([...produits].sort(), [...PRIORITE].sort(),
    'l echelle couvre exactement les evenements sonores du jeu');
});

// --- Le son suit le RESULTAT du tour, jamais la touche pressee -------------

test('trois essais rates declenchent le son du Z, comme n importe quel Z', () => {
  // Le doigt tape « Essai raté ». Le jeu, lui, inscrit un Z : le moteur termine
  // le tour tout seul au troisieme essai. Se fier au type de la commande
  // rendait l'application muette sur un Z sur trois.
  let s = createGame([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }]);
  let avant = s.turns.length;
  s = apply(s, { type: 'FAILED_ATTEMPT' });
  assert.equal(s.turns.length, avant, 'les deux premiers essais ne terminent rien');
  s = apply(s, { type: 'FAILED_ATTEMPT' });
  assert.equal(s.turns.length, avant, 'toujours rien');
  s = apply(s, { type: 'FAILED_ATTEMPT' });

  const tour = s.turns.at(-1);
  assert.equal(tour.outcome, 'Z', 'le moteur a bien inscrit un Z');
  assert.equal(tour.attempts, 3);
  assert.equal(
    choisirSon({ victoire: false, penalite: false, type: tour.outcome }), 'Z',
    'et le son qui en decoule est celui du Z',
  );
  // Alors que la commande tapee, elle, ne dit rien.
  assert.equal(choisirSon({ type: 'FAILED_ATTEMPT' }), null);
});

test('un Z automatique qui declenche la penalite joue la penalite, pas le Z', () => {
  let s = createGame([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }]);
  // Ana : deux Z, puis un troisieme par epuisement des essais.
  for (let tour = 0; tour < 2; tour++) {
    s = apply(s, { type: 'Z' });                                   // Ana
    s = apply(s, { type: 'SCORE', points: 250, diceLeft: 2 });     // Bruno
    s = apply(s, { type: 'DECLINE_CARRY' });                       // Ana repart
  }
  const penalitesAvant = s.penalties.length;
  s = apply(s, { type: 'FAILED_ATTEMPT' });
  s = apply(s, { type: 'FAILED_ATTEMPT' });
  s = apply(s, { type: 'FAILED_ATTEMPT' });
  const tour = s.turns.at(-1);
  assert.equal(tour.outcome, 'Z');
  assert.ok(s.penalties.length > penalitesAvant, 'la penalite est bien tombee');
  assert.equal(
    choisirSon({ victoire: false, penalite: true, type: tour.outcome }), 'PENALTY',
    'un seul son, et c est le plus fort',
  );
});
