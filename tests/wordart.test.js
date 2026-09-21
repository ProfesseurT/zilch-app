// Garde-fous du theme « wordart ».
//
// Ce theme repose sur un effet decoratif qui peut, s il derape, rendre
// illisible le seul chiffre qui compte. Les tests ci-dessous tiennent la
// regle posee au lot 15 : l arc-en-ciel ne touche que le decoratif.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const lire = (f) => readFileSync(racine + f, 'utf8');

const css = lire('css/zilch.css');
const ui = lire('js/ui.js');
const sw = lire('service-worker.js');

// Toutes les regles du theme, une par une.
const regles = [...css.matchAll(/\[data-theme="wordart"\]([^{]*)\{([^}]*)\}/g)]
  .map((m) => ({ cible: m[1].trim(), corps: m[2] }));

test('le theme est declare aux trois endroits de ui.js', () => {
  assert.match(ui, /\{ id: 'wordart'/, 'absent de la liste des themes');
  assert.match(ui, /wordart: '#008080'/, 'absent des couleurs de barre d etat');
  assert.match(ui, /wordart: '\.\/icon-180-wordart\.png'/, 'absent des icones');
});

test('la police du theme est embarquee, precachee, et sa licence est la', () => {
  assert.match(css, /@font-face\{\s*font-family:'Anton'/, 'police non declaree');
  assert.ok(existsSync(racine + 'polices/Anton-Regular.woff2'), 'fichier de police absent');
  assert.ok(sw.includes("'./polices/Anton-Regular.woff2'"), 'police absente du precache');
  assert.ok(existsSync(racine + 'polices/OFL-Anton.txt'), 'licence absente du depot');
});

test('le theme repeint tout ce qu un theme doit repeindre', () => {
  // Un theme qui oublie un de ces morceaux laisse apparaitre les azulejos
  // au milieu du sien, et personne ne le voit avant une vraie partie.
  const attendus = ['body', '.carte', 'button', '.actif-bloc', 'nav', '.modale .boite',
    '.pave button', '.f-affichage', '.barre-action', '.feuille', '.ligne', '.bandeau'];
  for (const cible of attendus) {
    assert.ok(regles.some((r) => r.cible === cible), `theme incomplet : ${cible}`);
  }
});

test('aucun degrade sur un chiffre : un total doit rester lisible', () => {
  // La decision du lot 15. Un fond decoupe sur du texte rend la couleur
  // transparente : sur un score, il ne reste qu un contour a bout de bras.
  const chiffres = ['.actif-bloc .total', '.ligne .pts', '.f-affichage', '.kpi b',
    'table.bareme td:last-child', '.pave button'];
  for (const r of regles) {
    if (!chiffres.includes(r.cible)) continue;
    assert.doesNotMatch(r.corps, /background-clip/,
      `degrade decoupe sur un chiffre : ${r.cible}`);
    assert.doesNotMatch(r.corps, /color:\s*transparent/,
      `couleur transparente sur un chiffre : ${r.cible}`);
  }
});

test('les effets decoratifs n animent rien', () => {
  // 105 tours par partie : le relief et le biseau sont peints une fois.
  for (const r of regles) {
    if (r.cible === '.actif-bloc.change') continue;   // deja au catalogue, 0,16 s
    assert.doesNotMatch(r.corps, /animation:/, `animation ajoutee par le theme : ${r.cible}`);
  }
});

test('chaque couleur de texte du theme reste lisible sur son fond', () => {
  // Seuil 4,5:1, le minimum pour du texte normal. Les valeurs sont lues dans
  // le CSS : changer une variable sans refaire le calcul fait echouer ici.
  const decl = css.match(/\[data-theme="wordart"\]\{([^}]*)\}/)[1];
  const val = (nom) => decl.match(new RegExp(`--${nom}:(#[0-9A-Fa-f]{6})`))?.[1];
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (h + 0.05) / (l + 0.05);
  };
  const paires = [
    ['rouge-texte', 'gris95'], ['vert-texte', 'gris95'], ['navy', 'gris95'],
    ['jaune', 'navy'],
  ];
  for (const [texte, fond] of paires) {
    const a = val(texte); const b = val(fond);
    assert.ok(a && b, `variable manquante : ${texte} ou ${fond}`);
    const k = ratio(a, b);
    assert.ok(k >= 4.5, `${texte} sur ${fond} : ${k.toFixed(2)}:1, il faut 4,5`);
  }
});

test('le mot arc-en-ciel porte son ombre par filtre, pas par text-shadow', () => {
  // Avec background-clip:text la couleur est transparente : une text-shadow
  // serait peinte transparente elle aussi, donc invisible. Piege paye une fois.
  for (const r of regles) {
    if (!/background-clip/.test(r.corps)) continue;
    assert.match(r.corps, /filter:drop-shadow/, `ombre invisible sur : ${r.cible}`);
  }
});
