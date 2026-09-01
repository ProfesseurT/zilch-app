import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPicker, allFiles, SOUND_MANIFEST, SoundError } from '../js/sounds.js';

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

test('la liste des fichiers a precacher couvre tout le manifeste', () => {
  const f = allFiles();
  assert.equal(f.length, 13);
  assert.equal(new Set(f).size, f.length, 'aucun doublon');
  assert.ok(f.includes('victoire.mp3'));
});
