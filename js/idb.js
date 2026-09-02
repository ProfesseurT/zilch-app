// ZILCH — adaptateur IndexedDB.
//
// NON TESTE PAR `node --test`. C'est le seul fichier du projet dans ce cas :
// IndexedDB n'existe que dans un navigateur. Il est donc volontairement mince
// et sans aucune logique metier. Tout ce qui peut etre teste vit dans store.js.
//
// A verifier sur iPhone : chargement, sauvegarde, migration depuis
// localStorage, comportement quand le quota est depasse.

import { emptyStore, migrateLegacy, LEGACY_KEY, SCHEMA_VERSION } from './store.js';

const DB_NAME = 'zilch';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'current';

let connexion = null;

function open() {
  if (connexion) return Promise.resolve(connexion);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    // Sans ceci, une montee de version bloquee par une autre fenetre laissait
    // la promesse en suspens pour toujours : ecran de demarrage fige, aucun
    // message, ni erreur ni succes.
    req.onblocked = () => reject(new Error('ZILCH est ouvert dans une autre fenetre. Ferme-la, puis reessaie.'));
    req.onsuccess = () => {
      connexion = req.result;
      // Une autre fenetre demande une montee de version : liberer la connexion.
      connexion.onversionchange = () => { connexion.close(); connexion = null; };
      // Et si le systeme ferme la connexion de lui-meme — mise en veille,
      // pression memoire — il faut le savoir. Sans ce handler, `connexion`
      // restait en cache, ferme, et plus AUCUNE sauvegarde n'aboutissait pour
      // le reste de la soiree, sans le moindre signe.
      connexion.onclose = () => { connexion = null; };
      resolve(connexion);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Rejoue une operation une fois si la connexion s'est fermee entre-temps. */
async function avecConnexion(operation) {
  try {
    return await operation(await open());
  } catch (err) {
    if (err?.name !== 'InvalidStateError' && err?.name !== 'TransactionInactiveError') throw err;
    connexion = null;                       // la connexion etait morte : on rouvre
    return operation(await open());
  }
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * Demande au systeme de proteger le stockage de l'eviction.
 * A appeler a CHAQUE ouverture : la demande n'est pas definitive. Ne bloque
 * jamais l'application si elle est refusee.
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return { supported: false, granted: false };
    const deja = await navigator.storage.persisted();
    const granted = deja || (await navigator.storage.persist());
    return { supported: true, granted };
  } catch {
    return { supported: false, granted: false };
  }
}

/** true si l'application tourne installee sur l'ecran d'accueil. */
export function isInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
  );
}

/**
 * Charge l'etat.
 *
 * REGLE ABSOLUE : si IndexedDB contient deja quelque chose, ce contenu est
 * renvoye tel quel et n'est JAMAIS remplace, meme si son `schema` differe de
 * SCHEMA_VERSION. Une version anterieure de ce fichier retombait dans la
 * branche de migration en cas d'ecart de schema et ecrasait silencieusement
 * l'etat existant. Le jour ou le schema evoluera, il faudra une fonction de
 * montee de version explicite et testee dans store.js — pas cette branche-ci.
 *
 * La migration depuis localStorage ne se declenche donc qu'une seule fois :
 * au tout premier lancement, quand IndexedDB est vide.
 */
export async function load() {
  const trouve = await avecConnexion((db) => tx(db, 'readonly', (os) => os.get(KEY)));
  if (trouve) return trouve;

  const brut = localStorage.getItem(LEGACY_KEY);
  if (brut) {
    let parsed = null;
    try {
      parsed = JSON.parse(brut);
    } catch {
      parsed = null;
    }
    const migre = migrateLegacy(parsed);
    await save(migre);
    // L'ancienne cle localStorage n'est jamais effacee, ni ici ni ailleurs.
    // L'ebauche reste installee sur l'appareil et continue de s'en servir.
    return migre;
  }

  const neuf = emptyStore();
  await save(neuf);
  return neuf;
}

// Les sauvegardes s'enchainent, elles ne se croisent pas : deux ecritures
// concurrentes de l'etat complet peuvent s'ecraser l'une l'autre, et le
// dernier arrive n'est pas forcement le plus recent.
let file = Promise.resolve();

/** Sauve l'etat complet. Remonte une erreur claire si le quota est depasse. */
export function save(store) {
  file = file.catch(() => {}).then(async () => {
    try {
      await avecConnexion((db) => tx(db, 'readwrite', (os) => os.put(store, KEY)));
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        throw new Error('Stockage plein. Exporte tes donnees avant d\'en enregistrer d\'autres.');
      }
      throw err;
    }
  });
  return file;
}

/**
 * Point d'entree unique au demarrage de l'application.
 * Renvoie l'etat plus ce que l'interface doit savoir : si l'application est
 * installee, et si le stockage est protege. Ne leve jamais pour un probleme
 * de stockage persistant : c'est une information, pas une condition.
 */
export async function boot() {
  const installed = isInstalled();
  const persistence = await requestPersistence();
  const store = await load();
  return { store, installed, persistence, schema: SCHEMA_VERSION };
}

/** Declenche le telechargement d'une sauvegarde JSON, vers Fichiers sur iPhone. */
export function downloadBackup(json, filename = `zilch-${new Date().toISOString().slice(0, 10)}.json`) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // L'ancre doit etre DANS le document : sur WebKit, un <a download> detache
  // ne declenche pas toujours le telechargement.
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}
