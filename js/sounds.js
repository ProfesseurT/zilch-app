// ZILCH — sons.
// La partie SELECTION est pure et testee. La partie LECTURE touche au DOM et
// n'est pas testable hors navigateur : elle est reduite au strict minimum.

// ---------------------------------------------------------------------------
// Manifeste : ajouter un son = deposer un fichier et ajouter une ligne ici.
// Rien d'autre a modifier dans le code.
// ---------------------------------------------------------------------------

// Un seul sac. Depuis le lot 17, la voix n'appartient plus au theme : le Z,
// le Z+ et la penalite tirent tous dans la meme liste, et les quatre themes
// entendent la meme chose. Seule la victoire garde ses fichiers a elle.
// Ajouter un son = deposer le fichier dans sons/ et ajouter une ligne ici.
const POT = [
  'son-01.mp3',
  'son-02.mp3',
  'son-03.mp3',
  'son-04.mp3',
  'son-05.mp3',
  'son-06.mp3',
  'son-07.mp3',
  'son-08.mp3',
  'son-09.mp3',
  'son-10.mp3',
  'son-11.mp3',
  'son-12.mp3',
  'son-13.mp3',
  'son-14.mp3',
  'son-15.mp3',
  'son-16.mp3',
  'son-17.mp3',
  'son-18.mp3',
  'son-19.mp3',
  'son-20.mp3',
  'son-21.mp3',
  'son-22.mp3',
  'son-23.mp3',
  'son-24.mp3',
  'son-25.mp3',
  'son-26.mp3',
  'son-27.mp3',
  'son-28.mp3',
  'son-29.mp3',
  'son-30.mp3',
  'son-31.mp3',
  'son-32.mp3',
  'son-33.mp3',
  'son-34.mp3',
  'son-35.mp3',
  'son-36.mp3',
  'son-37.mp3',
  'son-38.mp3',
];

export const SOUND_MANIFEST = {
  Z: POT,
  Z_PLUS: POT,
  PENALTY: POT,
  VICTORY: ['victoire-01.mp3', 'victoire-02.mp3'],
};

export const MANIFESTES = {
  azulejo: SOUND_MANIFEST,
  tableau: SOUND_MANIFEST,
  matrix: SOUND_MANIFEST,
  wordart: SOUND_MANIFEST,
};

/** Manifeste d'un theme. Un theme inconnu retombe sur les sons d'origine. */
export function manifestePour(theme) {
  return MANIFESTES[theme] ?? SOUND_MANIFEST;
}

export class SoundError extends Error {}

// ---------------------------------------------------------------------------
// UN TOUR = UN SON. JAMAIS DEUX.
//
// Plusieurs choses peuvent survenir dans le meme tour : un Z qui declenche la
// penalite, une penalite sur le tour qui termine la partie. Sans arbitrage on
// entend deux sons superposes, et le plus important est couvert par le plus
// banal. L'echelle ci-dessous tranche une fois pour toutes, du plus fort au
// plus faible. Elle est pure : elle ne connait ni le DOM, ni l'audio, ni le
// moteur, et elle est testee.
//
//   1. VICTORY  — la partie est finie, plus rien d'autre ne compte
//   2. PENALTY  — le -1000 absorbe le Z ou le Z+ qui l'a declenche
//   3. Z_PLUS
//   4. Z
// ---------------------------------------------------------------------------

export const PRIORITE = ['VICTORY', 'PENALTY', 'Z_PLUS', 'Z'];

/**
 * Renvoie l'unique evenement sonore d'un tour, ou null s'il n'y a rien a jouer.
 * @param {{victoire?:boolean, penalite?:boolean, type?:string|null}} tour
 */
export function choisirSon({ victoire = false, penalite = false, type = null } = {}) {
  if (victoire) return 'VICTORY';
  if (penalite) return 'PENALTY';
  if (type === 'Z_PLUS') return 'Z_PLUS';
  if (type === 'Z') return 'Z';
  return null;
}

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

/**
 * Tous les fichiers a precacher par le service worker. Sans argument, il
 * renvoie les sons de TOUS les themes : un theme change hors ligne doit
 * sonner, et un fichier oublie ici est un silence qui n'apparait qu'en mode
 * avion, sans la moindre erreur visible.
 */
export function allFiles(manifest = null) {
  if (manifest) return Object.values(manifest).flat();
  const tous = new Set();
  for (const m of new Set(Object.values(MANIFESTES))) {
    for (const f of Object.values(m).flat()) tous.add(f);
  }
  return [...tous];
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
let enCours = null;   // canal unique : un seul son audible a la fois

/** Cree les elements et les precharge. A appeler une seule fois au demarrage. */
export function preload(manifest = null) {
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
    // Deuxieme garde-fou, independante de l'echelle de priorite : meme si deux
    // appels arrivent (double tap, sequence rapide), le son precedent est coupe
    // net. Jamais deux voix en meme temps autour d'une table.
    if (enCours && enCours !== el) {
      enCours.pause();
      enCours.currentTime = 0;
    }
    enCours = el;
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}
