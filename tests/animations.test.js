// §10 — la regle unique et non negociable : aucune animation ne doit bloquer
// la saisie suivante. Une partie compte ~105 tours ; une animation bloquante
// d'une seconde et demie en fin de tour, c'est trois minutes d'attente cumulee.
//
// Ces tests lisent le CSS et le JS. Ils ne prouvent pas l'absence de blocage
// — seule la mesure sur appareil le fait — mais ils verrouillent les
// conditions qui la rendent possible, et attrapent une regression a l'ecriture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(racine + 'css/zilch.css', 'utf8');
const ui = readFileSync(racine + 'js/ui.js', 'utf8');

const durees = [...css.matchAll(/animation:\s*[\w-]+\s+([\d.]+)(m?s)/g)]
  .map(([, v, u]) => (u === 's' ? Number(v) * 1000 : Number(v)));

test('le flash ne peut pas intercepter un tap', () => {
  const bloc = css.slice(css.indexOf('#flash{'), css.indexOf('#flash.on'));
  assert.match(bloc, /pointer-events:\s*none/,
    'le flash se joue PAR-DESSUS l interface, le joueur suivant doit pouvoir agir dessous');
});

test('aucune animation ne depasse une seconde et demie', () => {
  assert.ok(durees.length >= 2, 'au moins le flash et la bascule de joueur');
  for (const d of durees) assert.ok(d <= 1500, `animation de ${d} ms : trop longue`);
});

test('le changement de joueur reste sous 200 ms', () => {
  // Son seul role est d empecher qu on saisisse le score du joueur precedent.
  for (const m of css.matchAll(/\.actif-bloc\.change\{[^}]*animation:\s*[\w-]+\s+([\d.]+)(m?s)/g)) {
    const ms = m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1]);
    assert.ok(ms < 200, `bascule de ${ms} ms : au-dela de 200 ms elle se remarque`);
  }
});

test('rien n attend la fin d une animation', () => {
  assert.ok(!/await\s+.*(anim|flash|transitionend|animationend)/i.test(ui),
    'aucune attente sur une animation');
  assert.ok(!/addEventListener\(\s*['"]animationend/.test(ui),
    'personne n ecoute la fin d une animation pour continuer');
});

test('aucune transition entre ecrans, aucun defilement anime', () => {
  // §10 : transitions entre ecrans proscrites.
  assert.ok(!/behavior:\s*['"]smooth/.test(ui), 'le defilement doit etre instantane');
  assert.ok(!/\.ecran[^{]*\{[^}]*transition/.test(css), 'pas de transition sur les ecrans');
});

test('aucun effet chronometre sur les boutons de saisie', () => {
  // §10 : « tout effet sur les boutons de saisie » est proscrit. Le retour
  // tactile instantane de :active est conserve — il n a aucune duree, il
  // confirme seulement que le tap a ete pris.
  const zones = ['button{', '.des button{', 'input,select{'];
  for (const z of zones) {
    const i = css.indexOf(z);
    if (i < 0) continue;
    const bloc = css.slice(i, css.indexOf('}', i));
    assert.ok(!/transition|animation/.test(bloc), `effet chronometre sur ${z}`);
  }
});

test('les animations reduites sont respectees ET l information survit', () => {
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  // Le piege : l animation ramenee a 0,001 ms saute a son image finale,
  // opacity 0 — le Z devenait invisible. D ou un etat affiche sans animation.
  assert.match(css, /#flash\.statique\{[^}]*opacity:\s*1/,
    'un etat statique doit exister pour le flash');
  assert.match(ui, /MOUVEMENT_REDUIT\.matches/,
    'le code doit brancher sur la preference de l utilisateur');
});

test('le resultat d un tour est toujours ecrit, jamais porte par le seul mouvement', () => {
  assert.match(ui, /Tour perdu/, 'un Z ou un Z+ laisse une phrase');
  assert.match(ui, /marque \$\{nb\(tourTermine\.points\)\}/, 'un score laisse une phrase');
});

test('le son et le flash suivent le resultat du tour, pas la touche pressee', () => {
  // Regression : un 3e essai rate est un FAILED_ATTEMPT pour le doigt et un Z
  // pour le jeu. En se fiant au type de la commande, l application restait
  // muette sur un Z sur trois.
  const debut = ui.indexOf('const tourTermine');
  const bloc = ui.slice(debut, ui.indexOf('sonner(evtSonore)', debut));
  assert.match(bloc, /type:\s*tourTermine\?\.outcome/,
    'choisirSon doit recevoir le resultat inscrit par le moteur');
  assert.ok(!/type:\s*evenement\.type/.test(ui),
    'le type de la commande ne doit plus decider du son');
});
