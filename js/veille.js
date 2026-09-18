// ZILCH — empecher l'ecran de s'eteindre pendant une partie.
//
// NON TESTABLE PAR `node --test` : l'API Screen Wake Lock n'existe que dans un
// navigateur. Ce fichier est donc volontairement mince et sans logique metier,
// comme idb.js.
//
// Trois limites du systeme, a connaitre avant de lire le code :
//
// 1. Le verrou est RELACHE AUTOMATIQUEMENT des que la page n'est plus visible
//    — changement d'application, appel entrant, verrouillage manuel. Il faut
//    donc le reprendre a chaque retour au premier plan, sinon l'ecran
//    recommence a s'eteindre sans que personne ne comprenne pourquoi.
// 2. Le mode Economie d'energie d'iOS REFUSE la demande. Rien ne le contourne.
//    L'application doit le dire, pas faire semblant que ca marche.
// 3. Rien ne peut empecher un appui sur le bouton lateral. Ca reste la
//    decision de celui qui tient le telephone, et c'est tres bien ainsi.

let verrou = null;
let enVol = null;            // demande en cours, pour ne jamais en lancer deux
let souhaite = false;       // l'utilisateur veut-il l'ecran allume ?
let raison = '';            // pourquoi la derniere demande a echoue
const abonnes = new Set();

/** L'appareil sait-il faire ? Safari iOS le sait depuis la version 18.4. */
export function supporte() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function etat() {
  return { supporte: supporte(), souhaite, actif: verrou !== null, raison };
}

/** S'abonner aux changements d'etat, pour rafraichir l'affichage. */
export function surChangement(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

function prevenir() {
  for (const fn of abonnes) { try { fn(etat()); } catch { /* jamais bloquant */ } }
}

async function acquerir() {
  // Deux appels rapproches (navigation + rendu du meme ecran) demandaient DEUX
  // verrous : le second ecrasait le premier, qui n'etait alors jamais relache.
  // Une seule demande peut donc etre en vol a la fois.
  if (enVol) return enVol;
  if (!souhaite || verrou || !supporte()) return etat();
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return etat();

  enVol = (async () => {
    try {
      const v = await navigator.wakeLock.request('screen');
      if (!souhaite) { try { await v.release(); } catch { /* deja relache */ } return etat(); }
      verrou = v;
      raison = '';
      // Le systeme peut relacher de lui-meme : on le note pour pouvoir reprendre.
      v.addEventListener('release', () => { if (verrou === v) verrou = null; prevenir(); });
    } catch (err) {
      verrou = null;
      // Cas le plus frequent : mode Economie d'energie, ou batterie trop basse.
      raison = err?.message || 'refusé par le système';
    }
    prevenir();
    return etat();
  })().finally(() => { enVol = null; });

  return enVol;
}

/** Demander a garder l'ecran allume. Ne leve jamais. */
export async function garderAllume() {
  souhaite = true;
  return acquerir();
}

/** Rendre la main au systeme. Ne leve jamais. */
export async function laisserEteindre() {
  souhaite = false;
  // Une demande partie juste avant doit finir avant qu'on relache, sinon elle
  // reinstalle un verrou que plus personne ne suit.
  try { await enVol; } catch { /* jamais bloquant */ }
  const v = verrou;
  verrou = null;
  try { await v?.release(); } catch { /* deja relache */ }
  // On NE remet PAS `raison` a zero : un refus du systeme survenu pendant la
  // partie doit rester lisible apres coup. Une demande acceptee l'effacera.
  prevenir();
  return etat();
}

// Reprise automatique au retour au premier plan : c'est la moitie du travail.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquerir();
  });
}
