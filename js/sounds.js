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
  'son-01.m4a',
  'son-02.m4a',
  'son-03.m4a',
  'son-04.m4a',
  'son-05.m4a',
  'son-06.m4a',
  'son-07.m4a',
  'son-08.m4a',
  'son-09.m4a',
  'son-10.m4a',
  'son-11.m4a',
  'son-12.m4a',
  'son-13.m4a',
  'son-14.m4a',
  'son-15.m4a',
  'son-16.m4a',
  'son-17.m4a',
  'son-18.m4a',
  'son-19.m4a',
  'son-20.m4a',
  'son-21.m4a',
  'son-22.m4a',
  'son-23.m4a',
  'son-24.m4a',
  'son-25.m4a',
  'son-26.m4a',
  'son-27.m4a',
  'son-28.m4a',
  'son-29.m4a',
  'son-30.m4a',
  'son-31.m4a',
  'son-32.m4a',
  'son-33.m4a',
  'son-34.m4a',
  'son-35.m4a',
  'son-36.m4a',
  'son-37.m4a',
  'son-38.m4a',
];

export const SOUND_MANIFEST = {
  Z: POT,
  Z_PLUS: POT,
  PENALTY: POT,
  VICTORY: ['victoire-01.m4a', 'victoire-02.m4a'],
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

// Un SEUL element <audio>, reutilise pour tous les sons.
//
// Avant le lot 19, il y avait un element par fichier, soit 26, et le
// deverrouillage n'en touchait qu'un : le premier. Or iOS attache
// l'autorisation de lecture a L'ELEMENT, pas a l'application. Les vingt-cinq
// autres restaient donc muets, et le defaut etait invisible depuis un
// ordinateur, ou tout joue sans rien demander.
//
// Un seul element regle aussi le reste : le canal unique devient gratuit,
// puisqu'il n'y a qu'une voix possible, et la limite d'elements audio d'iOS
// ne peut plus etre atteinte. Les fichiers sont deja dans le cache du
// service worker : changer la source ne declenche aucun telechargement.
let canal = null;
let unlocked = false;

// 0,02 seconde de silence, 204 octets, ecrit dans la page : le deverrouillage
// ne depend d'aucun fichier, donc il ne peut pas echouer faute de reseau.
const SILENCE = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

function leCanal() {
  if (!canal) {
    canal = new Audio();
    canal.preload = 'auto';
  }
  return canal;
}

/** Prepare le canal. A appeler une seule fois au demarrage. */
export function preload() {
  leCanal();
}

/**
 * Deverrouille l'audio. iOS refuse toute lecture non declenchee par un geste
 * utilisateur : appeler ceci depuis le premier tap de l'application.
 */
export async function unlock() {
  if (unlocked) return true;
  const el = leCanal();
  try {
    el.src = SILENCE;
    el.muted = true;
    await el.play();
    el.pause();
    el.currentTime = 0;
    el.muted = false;
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
    const el = leCanal();
    // Une seule voix : la source precedente est remplacee, quoi qu'il arrive.
    el.pause();
    el.src = BASE + file;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Pour les tests : remet le module dans l'etat d'un demarrage. */
export function _reset() {
  canal = null;
  unlocked = false;
}
