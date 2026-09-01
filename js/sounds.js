// ZILCH — sons.
// La partie SELECTION est pure et testee. La partie LECTURE touche au DOM et
// n'est pas testable hors navigateur : elle est reduite au strict minimum.

// ---------------------------------------------------------------------------
// Manifeste : ajouter un son = deposer un fichier et ajouter une ligne ici.
// Rien d'autre a modifier dans le code.
// ---------------------------------------------------------------------------

export const SOUND_MANIFEST = {
  // ~30 fois par partie : c'est ici qu'il faut le plus de variantes.
  Z: ['z-01.mp3', 'z-02.mp3', 'z-03.mp3', 'z-04.mp3', 'z-05.mp3', 'z-06.mp3'],
  // ~7 fois par partie.
  Z_PLUS: ['zplus-01.mp3', 'zplus-02.mp3', 'zplus-03.mp3'],
  // ~5 fois par partie.
  PENALTY: ['penalite-01.mp3', 'penalite-02.mp3', 'penalite-03.mp3'],
  // 1 fois par partie : une seule, volontairement. C'est la signature du jeu.
  VICTORY: ['victoire.mp3'],
};

export class SoundError extends Error {}

/**
 * Tireur de sons. Ne rejoue jamais deux fois de suite le meme fichier pour un
 * meme evenement, ce qui supprime la repetition immediate, la seule vraiment
 * perceptible autour d'une table.
 */
export function createPicker(manifest = SOUND_MANIFEST, random = Math.random) {
  const last = {};
  return {
    pick(event) {
      const pool = manifest[event];
      if (!Array.isArray(pool) || pool.length === 0) {
        throw new SoundError(`Aucun son declare pour l'evenement ${event}.`);
      }
      if (pool.length === 1) return pool[0];
      const candidats = pool.filter((f) => f !== last[event]);
      const choix = candidats[Math.floor(random() * candidats.length)];
      last[event] = choix;
      return choix;
    },
    lastPlayed(event) {
      return last[event] ?? null;
    },
  };
}

/** Tous les fichiers a precacher par le service worker. */
export function allFiles(manifest = SOUND_MANIFEST) {
  return Object.values(manifest).flat();
}

// ---------------------------------------------------------------------------
// LECTURE — NON TESTE. Aucune logique ici, uniquement du branchement.
//
// Elements <audio> et jamais Web Audio : sur iOS, un son joue via AudioContext
// est coupe par le bouton silence physique de l'iPhone, un <audio> non.
// ---------------------------------------------------------------------------

const BASE = 'sons/';
const elements = new Map();
let unlocked = false;

/** Cree les elements et les precharge. A appeler une seule fois au demarrage. */
export function preload(manifest = SOUND_MANIFEST) {
  for (const file of allFiles(manifest)) {
    if (elements.has(file)) continue;
    const el = new Audio(BASE + file);
    el.preload = 'auto';
    el.load();
    elements.set(file, el);
  }
}

/**
 * Deverrouille l'audio. iOS refuse toute lecture non declenchee par un geste
 * utilisateur : appeler ceci depuis le premier tap de l'application.
 */
export async function unlock() {
  if (unlocked) return true;
  const first = elements.values().next().value;
  if (!first) return false;
  try {
    first.muted = true;
    await first.play();
    first.pause();
    first.currentTime = 0;
    first.muted = false;
    unlocked = true;
  } catch {
    unlocked = false;
  }
  return unlocked;
}

/**
 * Joue un son pour un evenement. Ne leve jamais : une erreur audio ne doit
 * jamais interrompre une partie.
 */
export function play(picker, event) {
  try {
    const file = picker.pick(event);
    const el = elements.get(file);
    if (!el) return false;
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}
