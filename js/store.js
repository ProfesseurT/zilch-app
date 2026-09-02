// ZILCH — couche de persistance, en memoire.
// Aucun acces a IndexedDB : toute la logique de lecture, d'ecriture, de
// migration et d'export vit ici, donc elle est testable sans navigateur.
// L'adaptateur IndexedDB (idb.js) se contente de charger et sauver ce contenu.

import { createGame, apply, replayAll, CONFIG } from './engine.js';

export const SCHEMA_VERSION = 2;
export const LEGACY_KEY = 'dixmille_compagnon_v1';

export class StoreError extends Error {}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/** Etat vide. */
export function emptyStore() {
  return { schema: SCHEMA_VERSION, players: [], games: [], settings: { sound: true, reducedMotion: false } };
}

// --- Joueurs ----------------------------------------------------------------

export function addPlayer(store, name) {
  const clean = String(name || '').trim();
  if (!clean) throw new StoreError('Le nom du joueur est vide.');
  if (store.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
    throw new StoreError(`Le joueur ${clean} existe deja.`);
  }
  const player = { id: uid(), name: clean, createdAt: new Date().toISOString() };
  return { ...store, players: store.players.concat([player]) };
}

export function renamePlayer(store, id, name) {
  const clean = String(name || '').trim();
  if (!clean) throw new StoreError('Le nom du joueur est vide.');
  if (!store.players.some((p) => p.id === id)) throw new StoreError('Joueur inconnu.');
  return { ...store, players: store.players.map((p) => (p.id === id ? { ...p, name: clean } : p)) };
}

// --- Parties ----------------------------------------------------------------

export function startGame(store, playerIds, location = null) {
  if (playerIds.length < 2) throw new StoreError('Il faut au moins deux joueurs.');
  // Une seconde partie en cours devenait invisible : l'ecran d'accueil ne
  // rouvrait que la premiere, et l'historique ne liste que les parties finies.
  if (currentGame(store)) throw new StoreError('Une partie est deja en cours.');
  const unknown = playerIds.filter((id) => !store.players.some((p) => p.id === id));
  if (unknown.length) throw new StoreError(`Joueur inconnu : ${unknown[0]}`);
  const game = {
    id: uid(),
    createdAt: new Date().toISOString(),
    finishedAt: null,
    order: playerIds.slice(),
    location,
    events: [],       // seule source de verite : l'etat se rejoue depuis ici
    status: 'IN_PROGRESS',
    winner: null,
    // Les regles sont figees ICI, a la creation. Sans cela, une partie archivee
    // serait rejouee avec la configuration courante : changer le plancher ou
    // l'objectif rendrait tout l'historique illisible, ecrans vides et sans
    // message. Le §12 autorise explicitement un objectif reglable.
    config: { ...CONFIG },
  };
  return { ...store, games: store.games.concat([game]) };
}

/** Ajoute un evenement metier a une partie, apres validation par le moteur. */
export function record(store, gameId, event) {
  const game = getGame(store, gameId);
  if (game.status === 'FINISHED') throw new StoreError('La partie est terminee.');
  if (game.status === 'ABANDONED') throw new StoreError('La partie a ete arretee.');
  const next = apply(replayGame(store, game), event); // le moteur valide ou refuse
  const updated = {
    ...game,
    events: game.events.concat([event]),
    status: next.status,
    winner: next.winner,
    finishedAt: next.status === 'FINISHED' ? new Date().toISOString() : null,
  };
  return { ...store, games: store.games.map((g) => (g.id === gameId ? updated : g)) };
}

/**
 * Arrete une partie sans vainqueur. Un etat de cycle de vie n'a rien a faire
 * dans un gestionnaire de bouton : il se decide ici, et il est teste.
 */
export function abandonGame(store, gameId) {
  const game = getGame(store, gameId);
  if (game.status === 'FINISHED') throw new StoreError('La partie est deja terminee.');
  const updated = { ...game, status: 'ABANDONED', finishedAt: new Date().toISOString() };
  return { ...store, games: store.games.map((g) => (g.id === gameId ? updated : g)) };
}

/** La partie en cours, s'il y en a une. Il ne peut y en avoir qu'une. */
export function currentGame(store) {
  return store.games.find((g) => g.status === 'IN_PROGRESS' || g.status === 'FINAL_ROUND') ?? null;
}

export function getGame(store, gameId) {
  const g = store.games.find((x) => x.id === gameId);
  if (!g) throw new StoreError('Partie inconnue.');
  return g;
}

/** Reconstruit l'etat moteur d'une partie depuis ses evenements. */
export function replayGame(store, game) {
  const players = game.order.map((id) => ({
    id,
    name: store.players.find((p) => p.id === id)?.name ?? '?',
  }));
  // Une seule passe. L'ancienne version enchainait un apply() par evenement,
  // chacun rejouant tout depuis zero : 22 155 transitions pour une partie de
  // 105 tours au lieu de 210, et l'ecran Stats les payait pour chaque joueur.
  return replayAll(game.events, players, game.config ?? CONFIG);
}

/** Annule la derniere action d'une partie. */
export function undoLast(store, gameId) {
  const game = getGame(store, gameId);
  if (game.status === 'ABANDONED') throw new StoreError('La partie a ete arretee.');
  if (game.events.length === 0) return store;
  const events = game.events.slice(0, -1);
  const players = game.order.map((id) => ({ id, name: '' }));
  const state = replayAll(events, players, game.config ?? CONFIG);
  const updated = { ...game, events, status: state.status, winner: state.winner, finishedAt: null };
  return { ...store, games: store.games.map((g) => (g.id === gameId ? updated : g)) };
}

// --- Statistiques : toujours recalculees, jamais stockees --------------------

/**
 * Statistiques d'un joueur. Elles ne sont jamais stockees : elles se
 * recalculent depuis les evenements, comme l'exige le §7.
 *
 * Cette fonction NE DECIDE PLUS a qui appartient un tour. C'est le moteur qui
 * l'inscrit dans `state.turns`, parce qu'il est le seul a savoir qu'un 3e essai
 * rate termine un tour. La version precedente refaisait ce calcul de son cote,
 * l'ignorait, et attribuait tout le reste de la partie au mauvais joueur.
 */
export function stats(store, playerId) {
  const s = {
    games: 0, wins: 0, turns: 0, positiveTurns: 0, points: 0, turnPoints: 0,
    bestTurn: 0, z: 0, zPlus: 0, penalties: 0, carryTaken: 0, carryWon: 0,
  };

  for (const game of store.games) {
    if (!game.order.includes(playerId)) continue;
    const state = replayGame(store, game);

    // Le rejeu fait foi, pas le statut recopie sur la partie.
    if (state.status === 'FINISHED') {
      s.games += 1;
      if (state.winner === playerId) s.wins += 1;
      s.points += state.scores[playerId] ?? 0;
    }

    // Les tours, eux, comptent meme dans une partie inachevee ou arretee :
    // le §7 demande le nombre TOTAL de tours, de Z et de Z+.
    for (const t of state.turns) {
      if (t.playerId !== playerId) continue;
      s.turns += 1;
      if (t.carry) s.carryTaken += 1;
      if (t.penalty) s.penalties += 1;
      if (t.outcome === 'SCORE') {
        s.positiveTurns += 1;
        s.turnPoints += t.points;
        s.bestTurn = Math.max(s.bestTurn, t.points);
        if (t.carry) s.carryWon += 1;
      } else if (t.outcome === 'Z') {
        s.z += 1;
      } else if (t.outcome === 'Z_PLUS') {
        s.zPlus += 1;
      }
    }
  }

  s.winRate = s.games ? s.wins / s.games : 0;
  s.avgScore = s.games ? Math.round(s.points / s.games) : 0;
  // Moyenne des tours positifs, pas du score final : la penalite ne doit pas
  // faire baisser la moyenne d'un tour qu'elle n'a pas touche.
  s.avgPositiveTurn = s.positiveTurns ? Math.round(s.turnPoints / s.positiveTurns) : 0;
  return s;
}

// --- Export / import --------------------------------------------------------

export function exportJSON(store) {
  return JSON.stringify({ ...store, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2);
}

/**
 * Montee de version d'une sauvegarde.
 *
 * Sans elle, le jour ou SCHEMA_VERSION passe a 3, TOUS les fichiers JSON deja
 * exportes deviennent illisibles — et c'est la seule vraie sauvegarde de
 * l'utilisateur (ADR-4). Ajouter une version = ajouter une entree ici, avec
 * son test. Ne jamais se contenter de relever SCHEMA_VERSION.
 */
const MONTEES = {
  // 1 -> 2 : aucune sauvegarde v1 n'a jamais ete produite par cette
  // application. L'entree existe pour que la mecanique soit en place et testee.
  1: (d) => ({ ...d, schema: 2 }),
};

export function migrateSchema(data) {
  let d = data;
  let v = Number(d?.schema);
  if (!Number.isFinite(v)) throw new StoreError('Version de sauvegarde absente.');
  if (v > SCHEMA_VERSION) {
    throw new StoreError(
      `Cette sauvegarde vient d'une version plus recente de ZILCH (${v}). Mets l'application a jour.`,
    );
  }
  while (v < SCHEMA_VERSION) {
    const monter = MONTEES[v];
    if (!monter) throw new StoreError(`Aucune montee de version connue depuis le schema ${v}.`);
    d = monter(d);
    const suivant = Number(d.schema);
    if (!(suivant > v)) throw new StoreError(`La montee depuis ${v} n'a pas avance.`);
    v = suivant;
  }
  return d;
}

/**
 * Importe une sauvegarde.
 *
 * Fusionne par defaut, et ne detruit jamais rien :
 * - un joueur ou une partie deja present est conserve ;
 * - SAUF si la sauvegarde contient une version PLUS COMPLETE de la meme partie
 *   (plus d'evenements). C'est le cas d'un appareil ou une ecriture a echoue :
 *   avant, l'import annoncait « fusionnee » et ne reparait rien ;
 * - les reglages sont fusionnes, jamais remplaces par du vide ;
 * - `legacyArchive` et `migratedFrom` survivent : c'est l'ancienne application,
 *   et rien d'autre ne la conserve.
 */
export function importJSON(store, json, { mode = 'merge' } = {}) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new StoreError('Fichier illisible : ce n\'est pas du JSON valide.');
  }
  if (!data || typeof data !== 'object') throw new StoreError('Fichier vide ou invalide.');
  data = migrateSchema(data);
  if (!Array.isArray(data.players) || !Array.isArray(data.games)) {
    throw new StoreError('Structure inattendue : joueurs ou parties manquants.');
  }
  for (const g of data.games) {
    if (!g || typeof g !== 'object' || !g.id || !Array.isArray(g.order) || !g.order.length || !Array.isArray(g.events)) {
      throw new StoreError('Structure inattendue : une partie est incomplete.');
    }
  }

  const reglages = { ...emptyStore().settings, ...(store.settings ?? {}), ...(data.settings ?? {}) };
  const archive = data.legacyArchive ?? store.legacyArchive;
  const venuDe = data.migratedFrom ?? store.migratedFrom;

  if (mode === 'replace') {
    const remplace = { ...data, schema: SCHEMA_VERSION, settings: reglages };
    delete remplace.exportedAt;
    return remplace;
  }

  const parId = new Map(store.games.map((g) => [g.id, g]));
  let ajoutees = 0;
  let completees = 0;
  for (const g of data.games) {
    const ici = parId.get(g.id);
    if (!ici) { parId.set(g.id, g); ajoutees += 1; continue; }
    if (g.events.length > ici.events.length) { parId.set(g.id, g); completees += 1; }
  }

  const connus = new Set(store.players.map((p) => p.id));
  const nouveaux = data.players.filter((p) => p?.id && !connus.has(p.id));

  const fusionne = {
    ...store,
    players: store.players.concat(nouveaux),
    games: [...parId.values()],
    settings: reglages,
    lastImport: { at: new Date().toISOString(), players: nouveaux.length, games: ajoutees, repaired: completees },
  };
  if (archive) fusionne.legacyArchive = archive;
  if (venuDe) fusionne.migratedFrom = venuDe;
  return fusionne;
}

// --- Migration depuis l'ancienne version ------------------------------------

/**
 * Migration depuis la cle localStorage `dixmille_compagnon_v1` de l'ebauche.
 *
 * Forme reelle de l'ancien etat, relevee dans son index.html :
 *   { version, sound, players:[{id,name,createdAt}], games:[...], activeGame }
 *
 * Deux traitements distincts, et c'est deliberé :
 *
 * - Les JOUEURS sont repris tels quels. Meme forme, aucune perte. Les
 *   identifiants existants sont conserves : ils sont references ailleurs dans
 *   l'archive. Les doublons de nom sont ecartes, l'invariant de addPlayer()
 *   valant aussi pour les donnees importees.
 *
 * - Les PARTIES ne sont PAS converties. L'ancien modele ne connait ni les des
 *   restants, ni la reprise, ni le dernier tour : les traduire en evenements du
 *   nouveau moteur reviendrait a inventer des donnees qui n'ont jamais existe,
 *   et fausserait toutes les statistiques. Elles sont conservees intactes dans
 *   `legacyArchive`, exportables, jamais rejouees.
 *
 * La cle localStorage d'origine n'est jamais effacee — voir idb.js.
 */
export function migrateLegacy(legacy) {
  const store = emptyStore();
  if (!legacy || typeof legacy !== 'object') return store;

  const players = Array.isArray(legacy.players) ? legacy.players : [];
  const vus = new Set();
  store.players = players
    .map((p) => {
      const name = typeof p === 'string' ? p.trim() : String(p?.name ?? '').trim();
      if (!name) return null;
      const cle = name.toLowerCase();
      if (vus.has(cle)) return null;
      vus.add(cle);
      return { id: (typeof p === 'object' && p?.id) || uid(), name, createdAt: p?.createdAt ?? null };
    })
    .filter(Boolean);

  store.games = [];
  store.legacyArchive = legacy;
  store.migratedFrom = LEGACY_KEY;
  return store;
}
