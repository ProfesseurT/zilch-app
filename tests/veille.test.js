// ZILCH — le verrou d'ecran.
//
// L'API n'existe pas dans node : on la simule. Ce qui est teste ici n'est PAS
// « est-ce que l'ecran reste allume » (seul un vrai iPhone repond), mais les
// trois comportements dont depend l'honnetete de l'affichage :
//   - un refus du systeme (mode Economie d'energie) est visible, pas avale ;
//   - un relachement automatique est remarque ;
//   - le retour au premier plan reprend le verrou, sinon l'ecran s'eteint
//     apres le premier appel recu et personne ne comprend pourquoi.

import { test } from 'node:test';
import assert from 'node:assert/strict';

let compteurModule = 0;

/**
 * Installe un faux navigateur puis importe une instance NEUVE du module
 * (l'etat du verrou vit dans le module : une instance par scenario).
 */
async function monter({ wakeLock = true, refuse = false } = {}) {
  const ecouteurs = {};
  let relacher = null;

  const doc = {
    visibilityState: 'visible',
    addEventListener(nom, fn) { (ecouteurs[nom] ||= []).push(fn); },
  };
  const nav = wakeLock
    ? {
        wakeLock: {
          request: async () => {
            if (refuse) throw new Error('Le mode Economie d\'energie est actif');
            const sentinelle = {
              released: false,
              addEventListener(nom, fn) { if (nom === 'release') relacher = fn; },
              release: async () => { sentinelle.released = true; },
            };
            return sentinelle;
          },
        },
      }
    : {};

  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });

  const mod = await import(`../js/veille.js?t=${++compteurModule}`);
  return {
    mod,
    doc,
    relacherSysteme: () => relacher?.(),
    revenirAuPremierPlan: async () => {
      doc.visibilityState = 'visible';
      for (const fn of ecouteurs.visibilitychange ?? []) fn();
      await new Promise((r) => setTimeout(r, 0));
    },
    partirEnArrierePlan: () => { doc.visibilityState = 'hidden'; },
  };
}

test('sans API, on le dit au lieu de faire semblant', async () => {
  const { mod } = await monter({ wakeLock: false });
  assert.equal(mod.supporte(), false);
  const e = await mod.garderAllume();
  assert.equal(e.actif, false, 'aucun verrou ne peut etre pris');
});

test('demande acceptee : le verrou est actif', async () => {
  const { mod } = await monter();
  const e = await mod.garderAllume();
  assert.equal(e.supporte, true);
  assert.equal(e.souhaite, true);
  assert.equal(e.actif, true);
  assert.equal(e.raison, '');
});

test('refus du systeme : la raison est visible, pas avalee', async () => {
  const { mod } = await monter({ refuse: true });
  const e = await mod.garderAllume();
  assert.equal(e.souhaite, true, 'le souhait reste, seul le systeme a dit non');
  assert.equal(e.actif, false);
  assert.match(e.raison, /Economie/);
});

test('relachement automatique : remarque, et repris au retour au premier plan', async () => {
  const c = await monter();
  await c.mod.garderAllume();
  assert.equal(c.mod.etat().actif, true);

  // Ce que fait iOS des que la page passe en arriere-plan.
  c.partirEnArrierePlan();
  c.relacherSysteme();
  assert.equal(c.mod.etat().actif, false, 'le module doit savoir qu il a perdu le verrou');

  await c.revenirAuPremierPlan();
  assert.equal(c.mod.etat().actif, true, 'sans reprise, l ecran s eteint apres le premier appel');
});

test('page cachee : aucune demande (le systeme la refuserait)', async () => {
  const c = await monter();
  c.partirEnArrierePlan();
  const e = await c.mod.garderAllume();
  assert.equal(e.actif, false);
  await c.revenirAuPremierPlan();
  assert.equal(c.mod.etat().actif, true);
});

test('laisserEteindre rend la main et n empeche plus rien', async () => {
  const c = await monter();
  await c.mod.garderAllume();
  const e = await c.mod.laisserEteindre();
  assert.equal(e.souhaite, false);
  assert.equal(e.actif, false);
  // Et un retour au premier plan ne doit PAS le reprendre en douce.
  await c.revenirAuPremierPlan();
  assert.equal(c.mod.etat().actif, false);
});

test('les abonnes sont prevenus a chaque changement', async () => {
  const c = await monter();
  const vus = [];
  const stop = c.mod.surChangement((e) => vus.push(e.actif));
  await c.mod.garderAllume();
  await c.mod.laisserEteindre();
  stop();
  await c.mod.garderAllume();
  assert.deepEqual(vus, [true, false], 'un desabonnement doit vraiment desabonner');
});

test('deux appels rapproches ne demandent QU UN verrou', async () => {
  const c = await monter();
  let demandes = 0;
  const brut = globalThis.navigator.wakeLock.request;
  globalThis.navigator.wakeLock.request = async (t) => { demandes++; return brut(t); };
  // Ce que fait l interface : aller() puis rendrePartie(), sans attendre entre.
  await Promise.all([c.mod.garderAllume(), c.mod.garderAllume()]);
  assert.equal(demandes, 1, 'un verrou orphelin ne serait jamais relache');
  assert.equal(c.mod.etat().actif, true);
});

test('couper pendant une demande en vol ne laisse pas de verrou pris', async () => {
  const c = await monter();
  const promesse = c.mod.garderAllume();     // volontairement pas attendue
  await c.mod.laisserEteindre();
  await promesse;
  assert.equal(c.mod.etat().actif, false, 'le verrou arrive apres coup doit etre rendu');
  assert.equal(c.mod.etat().souhaite, false);
});
