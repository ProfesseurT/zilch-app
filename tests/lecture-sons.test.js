// Garde-fous de la LECTURE des sons.
//
// Cette partie n'etait pas testee : « aucune logique ici, uniquement du
// branchement ». C'est exactement la qu'un defaut a vecu plusieurs mois.
// L'application creait un element <audio> par fichier, 26 au total, et n'en
// deverrouillait qu'un seul. iOS attache l'autorisation de lecture a
// l'element : les vingt-cinq autres restaient muets, un tour sur six sonnait.
// Rien ne pouvait le voir depuis un ordinateur, ou tout joue sans permission.
//
// Un faux element <audio> suffit a verrouiller l'essentiel sans navigateur.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPicker, preload, unlock, play, _reset } from '../js/sounds.js';

// --- Faux <audio> ----------------------------------------------------------

let crees = [];

class FauxAudio {
  constructor(src = '') {
    this.src = src;
    this.muted = false;
    this.currentTime = 0;
    this.joues = [];
    this.refusePlay = false;
    crees.push(this);
  }

  play() {
    if (this.refusePlay) return Promise.reject(new Error('refuse'));
    this.joues.push(this.src);
    return Promise.resolve();
  }

  pause() {}
}

beforeEach(() => {
  crees = [];
  globalThis.Audio = FauxAudio;
  _reset();
});

// --- Les tests -------------------------------------------------------------

test('un seul element audio est cree, quel que soit le nombre de sons', () => {
  preload();
  const p = createPicker();
  for (let i = 0; i < 50; i++) play(p, 'Z');
  assert.equal(crees.length, 1, `${crees.length} elements crees, il en faut UN`);
});

test('le deverrouillage ne depend d aucun fichier', async () => {
  preload();
  assert.equal(await unlock(), true);
  assert.match(crees[0].joues[0], /^data:audio\/wav/, 'le silence doit etre dans la page');
});

test('le deverrouillage porte sur l element qui jouera vraiment', async () => {
  // Le defaut d origine : on deverrouillait un element, on jouait les autres.
  preload();
  await unlock();
  const p = createPicker();
  play(p, 'Z');
  assert.equal(crees.length, 1, 'le son doit sortir de l element deverrouille');
});

test('chaque son joue depuis le dossier sons/', () => {
  preload();
  const p = createPicker();
  play(p, 'Z');
  assert.match(crees[0].src, /^sons\/.+\.(mp3|m4a)$/);
});

test('un refus du navigateur ne casse pas la partie', () => {
  preload();
  crees[0].refusePlay = true;
  const p = createPicker();
  assert.doesNotThrow(() => play(p, 'Z'));
});

test('un evenement inconnu ne casse pas la partie', () => {
  preload();
  const p = createPicker();
  assert.equal(play(p, 'INCONNU'), false, 'doit repondre non, sans lever');
});

test('jouer sans avoir prepare le canal ne casse rien', () => {
  const p = createPicker();
  assert.doesNotThrow(() => play(p, 'Z'));
  assert.equal(crees.length, 1, 'le canal se cree tout seul au besoin');
});

test('deux sons de suite ne font jamais deux voix', () => {
  preload();
  const p = createPicker();
  play(p, 'Z');
  play(p, 'Z_PLUS');
  assert.equal(crees.length, 1, 'un seul element, donc une seule voix possible');
});
