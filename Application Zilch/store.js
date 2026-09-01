// ZILCH — couche de persistance, en memoire.
// Aucun acces a IndexedDB : toute la logique de lecture, d'ecriture, de
// migration et d'export vit ici, donc elle est testable sans navigateur.
// L'adaptateur IndexedDB (idb.js) se contente de charger et sauver ce contenu.

import { createGame, apply, CONFIG } from './engine.js';

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
  };
  return { ...store, games: store.games.concat([game]) };
}

/** Ajoute un evenement metier a une partie, apres validation par le moteur. */
export function record(store, gameId, event) {
  const game = getGame(store, gameId);
  if (game.status === 'FINISHED') throw new StoreError('La partie est terminee.');
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
  return game.events.reduce((s, e) => apply(s, e), createGame(players));
}

/** Annule la derniere action d'une partie. */
export function undoLast(store, gameId) {
  const game = getGame(store, gameId);
  if (game.events.length === 0) return store;
  const events = game.events.slice(0, -1);
  const players = game.order.map((id) => ({ id, name: '' }));
  const state = events.reduce((s, e) => apply(s, e), createGame(players));
  const updated = { ...game, events, status: state.status, winner: state.winner, finishedAt: null };
  return { ...store, games: store.games.map((g) => (g.id === gameId ? updated : g)) };
}

// --- Statistiques : toujours recalculees, jamais stockees --------------------

export function stats(store, playerId) {
  const s = {
    games: 0, wins: 0, turns: 0, positiveTurns: 0, points: 0,
    bestTurn: 0, z: 0, zPlus: 0, penalties: 0, carryTaken: 0, carryWon: 0,
  };
  for (const game of store.games) {
    if (!game.order.includes(playerId)) continue;
    if (game.status !== 'FINISHED') continue;
    s.games += 1;
    if (game.winner === playerId) s.wins += 1;

    const state = replayGame(store, game);
    s.points += state.scores[playerId] ?? 0;

    let idx = 0;
    let carry = false;
    for (const e of game.events) {
      const current = game.order[idx];
      if (e.type === 'TAKE_CARRY') { if (current === playerId) { s.carryTaken += 1; carry = true; } continue; }
      if (e.type === 'DECLINE_CARRY' || e.type === 'FAILED_ATTEMPT') continue;
      if (current === playerId) {
        s.turns += 1;
        if (e.type === 'SCORE') {
          s.positiveTurns += 1;
          s.bestTurn = Math.max(s.bestTurn, e.points);
          if (carry) s.carryWon += 1;
        } else if (e.type === 'Z') s.z += CONFIG.zPoints && 1;
        else if (e.type === 'Z_PLUS') s.zPlus += 1;
      }
      carry = false;
      idx = (idx + 1) % game.order.length;
    }
  }
  s.winRate = s.games ? s.wins / s.games : 0;
  s.avgScore = s.games ? Math.round(s.points / s.games) : 0;
  s.avgPositiveTurn = s.positiveTurns ? Math.round(s.points / s.positiveTurns) : 0;
  return s;
}

// --- Export / import --------------------------------------------------------

export function exportJSON(store) {
  return JSON.stringify({ ...store, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2);
}

/**
 * Importe une sauvegarde. Par defaut fusionne sans rien ecraser :
 * les joueurs et parties deja presents (meme identifiant) sont conserves tels quels.
 */
export function importJSON(store, json, { mode = 'merge' } = {}) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new StoreError('Fichier illisible : ce n\'est pas du JSON valide.');
  }
  if (!data || typeof data !== 'object') throw new StoreError('Fichier vide ou invalide.');
  if (data.schema !== SCHEMA_VERSION) {
    throw new StoreError(`Version de sauvegarde inconnue (${data.schema ?? 'absente'}), attendu ${SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(data.players) || !Array.isArray(data.games)) {
    throw new StoreError('Structure inattendue : joueurs ou parties manquants.');
  }
  if (mode === 'replace') {
    return { ...emptyStore(), players: data.players, games: data.games, settings: data.settings ?? emptyStore().settings };
  }
  const knownPlayers = new Set(store.players.map((p) => p.id));
  const knownGames = new Set(store.games.map((g) => g.id));
  return {
    ...store,
    players: store.players.concat(data.players.filter((p) => !knownPlayers.has(p.id))),
    games: store.games.concat(data.games.filter((g) => !knownGames.has(g.id))),
  };
}

// --- Migration depuis l'ancienne version ------------------------------------

/**
 * ATTENTION : la forme exacte des objets `players` et `games` de la version 1
 * n'a pas pu etre inspectee. Cette fonction est volontairement defensive et
 * DOIT etre completee une fois les vraies donnees sous les yeux.
 * Elle preserve les noms de joueurs et le resume des parties, et ne jette
 * jamais rien : ce qui n'est pas compris part dans `legacyRaw`.
 */
export function migrateLegacy(legacy) {
  const store = emptyStore();
  if (!legacy || typeof legacy !== 'object') return store;

  const players = Array.isArray(legacy.players) ? legacy.players : [];
  store.players = players
    .map((p) => {
      const name = typeof p === 'string' ? p : p?.name ?? p?.nom ?? null;
      if (!name) return null;
      return { id: p?.id ?? uid(), name: String(name).trim(), createdAt: p?.createdAt ?? null };
    })
    .filter(Boolean);

  const games = Array.isArray(legacy.games) ? legacy.games : [];
  store.games = games.map((g) => ({
    id: g?.id ?? uid(),
    createdAt: g?.date ?? g?.createdAt ?? null,
    finishedAt: g?.finishedAt ?? null,
    order: Array.isArray(g?.order) ? g.order : [],
    location: g?.location ?? g?.lieu ?? null,
    events: [],                 // l'ancienne version ne stockait pas d'evenements
    status: 'FINISHED',
    winner: g?.winner ?? g?.gagnant ?? null,
    legacyRaw: g,               // rien n'est jete : tout reste recuperable
  }));

  store.settings = { sound: legacy.sound !== false, reducedMotion: false };
  store.migratedFrom = LEGACY_KEY;
  return store;
}
