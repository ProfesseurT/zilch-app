// Garde-fou de la mise en page mobile.
//
// Mesure faite le 2026-09-10 sur de vrais viewports iPhone : AVANT ce lot, les
// boutons Z, Z+ et « Essai raté » etaient physiquement INTERCEPTES par la
// barre de navigation — elementFromPoint renvoyait une icone de la nav — et le
// bouton Valider etait cache par le clavier natif sur TOUS les modeles, sans
// exception. La page faisait 1046 px pour une zone utile de 489 a 686 px.
//
// Ces tests ne remplacent pas une mesure dans un navigateur, mais ils
// verrouillent les quatre conditions qui rendaient le defaut possible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(racine + 'css/zilch.css', 'utf8');
const html = readFileSync(racine + 'index.html', 'utf8');
const ui = readFileSync(racine + 'js/ui.js', 'utf8');

test('la hauteur de la barre de navigation est une variable, pas un nombre epars', () => {
  assert.match(css, /--nav-h:\s*\d+px/, 'une variable --nav-h doit exister');
  const nav = css.slice(css.indexOf('nav{'), css.indexOf('}', css.indexOf('nav{')));
  assert.match(nav, /height:calc\(var\(--nav-h\)/, 'la nav doit porter cette hauteur');
});

test('l ecran de partie soustrait la barre de navigation de sa hauteur', () => {
  // Sans cette soustraction, la zone d action passe SOUS la nav et ses boutons
  // ne sont plus tapables, meme s ils restent visibles.
  const bloc = css.slice(css.indexOf('#e-partie.actif{'), css.indexOf('}', css.indexOf('#e-partie.actif{')));
  assert.match(bloc, /var\(--nav-h\)/, 'la hauteur doit retirer --nav-h');
  assert.match(bloc, /var\(--bs\)/, 'et la zone sure du bas');
});

test('le corps utilise min-height, jamais une hauteur figee', () => {
  // Avec height:100%, le padding-bottom du body n est pas honore et le dernier
  // bouton de chaque ecran finit sous la nav.
  assert.ok(!/\bhtml,body\{[^}]*height:\s*100%/.test(css), 'html,body{height:100%} est interdit');
  assert.match(css, /body\{\s*min-height:100%\s*\}/, 'le body doit etre en min-height');
  assert.match(css, /padding:calc\(var\(--hg\)[^;]*var\(--nav-h\)/,
    'le padding bas du body doit reserver la hauteur de la nav');
});

test('la saisie du score n utilise aucun clavier natif', () => {
  // Le clavier d iOS mange environ 300 px sur les 664 d un iPhone 14.
  assert.ok(!/<input[^>]*id="points"/.test(html), 'le champ numerique natif doit avoir disparu');
  assert.ok(!/inputmode="numeric"/.test(html), 'plus aucun champ numerique natif');
  assert.match(html, /id="f-pave"/, 'un pave numerique dessine dans la page le remplace');
  assert.match(ui, /function rendrePave/, 'et il est construit par le code');
});

test('la feuille de saisie couvre tout l ecran', () => {
  const bloc = css.slice(css.indexOf('.feuille{'), css.indexOf('}', css.indexOf('.feuille{')));
  assert.match(bloc, /position:fixed/);
  assert.match(bloc, /inset:0/, 'elle occupe tout l ecran : rien ne peut la recouvrir');
});

test('les actions du tour vivent dans une zone qui ne defile pas', () => {
  assert.match(html, /class="barre-action"/, 'une barre d action fixe doit exister');
  for (const id of ['b-marquer', 'b-essai', 'b-z', 'b-zplus']) {
    const i = html.indexOf(`id="${id}"`);
    assert.ok(i > html.indexOf('class="barre-action"'), `${id} doit etre dans la barre d action`);
  }
});
