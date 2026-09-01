// ZILCH — adaptateur IndexedDB.
//
// NON TESTE. Ce fichier est le seul du projet qui ne peut pas etre couvert par
// `node --test` : IndexedDB n'existe que dans un navigateur. Il est donc
// volontairement mince et sans aucune logique metier. Tout ce qui peut etre
// teste vit dans store.js.
//
// A verifier sur iPhone lors de la phase 3 : chargement, sauvegarde, migration
// depuis localStorage, et comportement quand le quota est depasse.

import { emptyStore, migrateLegacy, LEGACY_KEY, SCHEMA_VERSION } from './store.js';

const DB_NAME = 'zilch';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'current';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
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
 * Doit etre appele a CHAQUE ouverture de l'application : la demande n'est pas
 * definitive. Ne bloque jamais l'application si elle est refusee.
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return { supported: false, granted: false };
    const already = await navigator.storage.persisted();
    const granted = already || (await navigator.storage.persist());
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

/** Charge l'etat. Migre depuis localStorage au premier lancement, une seule fois. */
export async function load() {
  const db = await open();
  const found = await tx(db, 'readonly', (os) => os.get(KEY));
  if (found && found.schema === SCHEMA_VERSION) return found;

  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (legacyRaw) {
    let parsed = null;
    try {
      parsed = JSON.parse(legacyRaw);
    } catch {
      parsed = null;
    }
    const migrated = migrateLegacy(parsed);
    await save(migrated);
    // L'ancienne cle est CONSERVEE telle quelle : tant que la migration n'a pas
    // ete verifiee sur de vraies donnees, rien ne doit etre efface.
    return migrated;
  }
  const fresh = emptyStore();
  await save(fresh);
  return fresh;
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
