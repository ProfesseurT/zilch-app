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

// --- Lot 8 : mesures faites le 2026-09-18 sur un viewport iPhone 13 mini ------
//
// 375 x 812, encoches de 50 px en haut et 34 en bas, application installee.
// AVANT ce lot : la feuille de saisie laissait 152 px vides sous Valider et
// bridait son pave a 300 px ; l'ecran de partie debordait de 191 px pendant une
// offre de reprise, et ce qui passait sous le pli etait « Annuler le dernier
// tour » — le rattrapage disparaissait au tour ou l'erreur est la plus probable.
// APRES : 61 px sous Valider, 0 px de debordement hors offre, 76 px avec offre
// a quatre joueurs, et les deux rattrapages ne defilent plus.

test('les deux rattrapages vivent dans la barre d action, pas dans le defilement', () => {
  const barre = html.indexOf('class="barre-action"');
  for (const id of ['b-annuler', 'b-abandon']) {
    assert.ok(html.indexOf(`id="${id}"`) > barre,
      `${id} doit etre dans la barre d action : sinon il passe sous le pli pendant une offre de reprise`);
  }
});

test('le bas de la feuille de saisie est colle au bas de l ecran', () => {
  // Sans ca, Valider remonte au milieu et 152 px restent vides sous le pouce.
  assert.match(css, /\.feuille \.bas\{[^}]*margin-top:auto/, 'le bloc du bas doit etre pousse en bas');
  assert.match(html, /class="legende bas"/, 'et le HTML doit le designer');
});

test('le pave numerique n est plus bride a 300 px', () => {
  const bloc = css.slice(css.indexOf('.pave{'), css.indexOf('}', css.indexOf('.pave{')));
  assert.match(bloc, /flex:1/, 'il prend la hauteur libre');
  assert.ok(!/max-height:\s*300px/.test(bloc), 'le plafond de 300 px doit avoir disparu');
});

test('les tailles de texte suivent le reglage iOS, sauf la barre du bas', () => {
  // Sur iOS, la taille choisie dans Reglages > Affichage n atteint une page web
  // que par -apple-system-body. Tout est en rem pour que la mesure se propage.
  assert.match(ui, /-apple-system-body/, 'la taille du systeme doit etre mesuree');
  assert.match(ui, /Math\.min\(21, Math\.max\(16,/, 'et bornee : au-dela l ecran de partie ne tient plus');
  // On retire les regles de la barre du bas, qui garde des tailles fixes : sa
  // hauteur est verrouillee par --nav-h, un texte qui grandit la ferait deborder.
  let horsNav = '', reste = css;
  while (reste.includes('{')) {
    const a = reste.indexOf('{'), b = reste.indexOf('}', a);
    if (b === -1) break;
    const sel = reste.slice(0, a).split(/[}{]/).pop().trim();
    const estNav = sel.split(',').some((x) => /(^|[\s>])nav\b/.test(x.trim()));
    if (!estNav) horsNav += reste.slice(a, b);
    reste = reste.slice(b + 1);
  }
  const restants = horsNav.match(/(?:font-size|min-height):\s*\d+px/g) || [];
  assert.deepEqual(restants, [], 'aucune taille de texte figee hors de la barre du bas');
});

test('l or de l onglet actif est lisible sur le cobalt fonce', () => {
  // #C9962C sur #123A6B donne 4,28:1 en 11 px. Il en faut 4,5.
  assert.match(css, /--or-nav:/, 'une teinte dediee doit exister');
  assert.match(css, /nav button\[aria-current="page"\]\{ color:var\(--or-nav\) \}/);
});
