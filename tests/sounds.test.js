import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGame, apply } from '../js/engine.js';
import { createPicker, allFiles, SOUND_MANIFEST, SoundError, choisirSon, PRIORITE, manifestePour } from '../js/sounds.js';

const racine = fileURLToPath(new URL('../', import.meta.url));

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
  const p = createPicker({ VICTORY: ['seul.mp3'] });
  assert.equal(p.pick('VICTORY'), 'seul.mp3');
  assert.equal(p.pick('VICTORY'), 'seul.mp3');
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
  const tirages = SOUND_MANIFEST.Z.length * 60;
  for (let i = 0; i < tirages; i++) vus.add(p.pick('Z'));
  assert.equal(vus.size, SOUND_MANIFEST.Z.length, 'tous les sons doivent etre joues');
});

test('la repartition reste equilibree', () => {
  const p = createPicker();
  const n = {};
  const tirages = SOUND_MANIFEST.Z.length * 500;
  for (let i = 0; i < tirages; i++) {
    const s = p.pick('Z');
    n[s] = (n[s] || 0) + 1;
  }
  const attendu = tirages / SOUND_MANIFEST.Z.length;
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
  for (const nom of f) {
    assert.ok(existsSync(racine + 'sons/' + nom), `son declare mais absent du disque : ${nom}`);
  }
  const posees = new Set(readdirSync(racine + 'sons').filter((n) => /\.(mp3|m4a|wav|aac|ogg)$/i.test(n)));
  for (const nom of posees) {
    assert.ok(f.includes(nom), `fichier dans sons/ mais jamais joue : ${nom}`);
  }
});

test('les quatre themes partagent le meme pot', () => {
  // Decision du lot 17 : la voix n appartient plus au theme. Ce test
  // remplace celui qui interdisait a un theme d emprunter la voix d un autre.
  for (const theme of ['azulejo', 'tableau', 'matrix', 'wordart', 'inexistant']) {
    assert.equal(manifestePour(theme), SOUND_MANIFEST, `${theme} doit tirer dans le pot commun`);
  }
});

test('chaque evenement a de quoi sonner', () => {
  for (const e of PRIORITE) {
    assert.ok(Array.isArray(SOUND_MANIFEST[e]) && SOUND_MANIFEST[e].length, `${e} sans son`);
  }
});

test('Z, Z+ et penalite tirent dans le meme sac, la victoire non', () => {
  const pot = new Set(SOUND_MANIFEST.Z);
  assert.deepEqual(new Set(SOUND_MANIFEST.Z_PLUS), pot, 'le Z+ doit tirer dans le meme sac');
  assert.deepEqual(new Set(SOUND_MANIFEST.PENALTY), pot, 'la penalite doit tirer dans le meme sac');
  for (const v of SOUND_MANIFEST.VICTORY) {
    assert.ok(!pot.has(v), `un son de victoire ne doit jamais sortir ailleurs : ${v}`);
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
