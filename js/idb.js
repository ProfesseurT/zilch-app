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
    req.onsuccess = () => {
      connexion = req.result;
      // Une autre fenetre demande une montee de version : liberer la connexion.
      connexion.onversionchange = () => {
        connexion.close();
        connexion = null;
      };
      resolve(connexion);
    };
    req.onerror = () => reject(req.error);
  });
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
  const db = await open();
  const trouve = await tx(db, 'readonly', (os) => os.get(KEY));
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

/** Sauve l'etat complet. Remonte une erreur claire si le quota est depasse. */
export async function save(store) {
  const db = await open();
  try {
    await tx(db, 'readwrite', (os) => os.put(store, KEY));
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      throw new Error("Stockage plein. Exportez vos donnees avant d'en enregistrer d'autres.");
    }
    throw err;
  }
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
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
