// ZILCH — moteur metier pur.
// Aucune dependance, aucun acces au DOM, au stockage ou au reseau.
// Toute la logique de regles vit ici et nulle part ailleurs.

/** Configuration metier. Aucune valeur magique ailleurs dans le code. */
export const CONFIG = {
  target: 10000,          // seuil declenchant le dernier tour
  minTurn: 250,           // plancher applicable a chaque tour
  scoreStep: 50,          // tout score est un multiple de 50
  maxAttempts: 3,         // essais pour atteindre le plancher
  penalty: 1000,          // penalite
  punitiveThreshold: 3,   // seuil du compteur punitif
  zPoints: 1,             // un Z vaut 1 point punitif
  zPlusPoints: 2,         // un Z+ en vaut 2
  floorAtZero: true,      // le score ne descend jamais sous zero
  resetPunitiveToZero: true, // §1 : remise a 0, pas soustraction de 3
  chainCarryOver: true,   // §1 : la reprise peut s'enchainer
  triggerWinsTie: true,   // §1 : egalite parfaite -> le declencheur gagne
  minDiceLeft: 1,         // une main pleine force la relance : jamais 0
  maxDiceLeft: 4,
};
Object.freeze(CONFIG);

export class RuleError extends Error {}

/** Cree une partie. `players` : [{id, name}] dans l'ordre de jeu. */
export function createGame(players, config = CONFIG) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new RuleError('Il faut au moins deux joueurs.');
  }
  return replay([], players, config);
}

/** Applique une commande et renvoie un nouvel etat. L'etat est immuable. */
export function apply(state, command) {
  const events = state.events.concat([command]);
  return replay(events, state.players, state.config);
}

/**
 * Rejoue un historique complet en UNE passe.
 * `apply()` rejoue tout depuis zero a chaque evenement : enchainer 210 appels
 * coute 22 155 transitions au lieu de 210. Pour reconstruire une partie entiere
 * — ce que font l'affichage et les statistiques — passer par ici.
 */
export function replayAll(events, players, config = CONFIG) {
  return replay(events, players, config);
}

/** Annule la derniere action en rejouant l'historique amoindri. */
export function undo(state) {
  if (state.events.length === 0) return state;
  return replay(state.events.slice(0, -1), state.players, state.config);
}

// ---------------------------------------------------------------------------
// Rejeu integral : une seule source de verite, donc une annulation fiable.
// ---------------------------------------------------------------------------

function replay(events, players, config) {
  const s = {
    config,
    players,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    punitive: Object.fromEntries(players.map((p) => [p.id, 0])),
    activeIndex: 0,
    attempts: 0,
    pending: null,     // {score, dice} laisse par le joueur precedent
    carryTaken: false, // le tour courant est-il une reprise
    status: 'IN_PROGRESS',
    trigger: null,
    finalRemaining: 0,
    penalties: [],   // trace de chaque -1000 : {id, nominal, applied}
    turns: [],       // un tour termine = une ligne. Voir endTurn().
    winner: null,
    events: [],
  };
  for (const e of events) step(s, e);
  s.events = events;
  return s;
}

function activeId(s) {
  return s.players[s.activeIndex].id;
}

function step(s, e) {
  if (s.status === 'FINISHED') throw new RuleError('La partie est terminee.');

  switch (e.type) {
    case 'TAKE_CARRY': {
      if (!s.pending) throw new RuleError('Aucun de a reprendre.');
      if (s.carryTaken) throw new RuleError('Reprise deja choisie pour ce tour.');
      s.carryTaken = true;
      return;
    }
    case 'DECLINE_CARRY': {
      if (!s.pending) throw new RuleError('Aucun de a reprendre.');
      // Sans ce refus, l'etat devenait carryTaken=true et pending=null, et le
      // premier score du tour plantait sur une reference nulle : le tour
      // devenait definitivement injouable. Un double tap suffisait.
      if (s.carryTaken) throw new RuleError('Reprise deja choisie pour ce tour.');
      s.pending = null;
      return;
    }
    case 'FAILED_ATTEMPT': {
      // Un lancer qui rapporte des points mais laisse le joueur sous le plancher.
      if (s.carryTaken) {
        throw new RuleError("Les essais ne s'appliquent pas a un tour repris.");
      }
      s.attempts += 1;
      if (s.attempts >= s.config.maxAttempts) endTurn(s, 'Z');
      return;
    }
    case 'SCORE': {
      validateScore(s, e);
      const id = activeId(s);
      s.scores[id] += e.points;
      s.punitive[id] = 0;
      const next = { score: e.points, dice: e.diceLeft };
      endTurn(s, 'SCORE', next);
      return;
    }
    case 'Z':
      endTurn(s, 'Z');
      return;
    case 'Z_PLUS': {
      // Le Z+ ne sanctionne que le tout premier lancer, a 5 des.
      if (s.carryTaken) throw new RuleError('Un tour repris ne peut pas produire de Z+.');
      if (s.attempts > 0) throw new RuleError('Le Z+ ne concerne que le premier lancer.');
      endTurn(s, 'Z_PLUS');
      return;
    }
    default:
      throw new RuleError(`Commande inconnue : ${e.type}`);
  }
}

function validateScore(s, e) {
  const { minTurn, scoreStep, minDiceLeft, maxDiceLeft } = s.config;
  if (!Number.isInteger(e.points)) throw new RuleError('Score non entier.');
  if (e.points % scoreStep !== 0) {
    throw new RuleError(`Un score est un multiple de ${scoreStep}.`);
  }
  if (e.points < minTurn) throw new RuleError(`Minimum ${minTurn} points.`);
  if (!Number.isInteger(e.diceLeft) || e.diceLeft < minDiceLeft || e.diceLeft > maxDiceLeft) {
    throw new RuleError(`Des restants : entre ${minDiceLeft} et ${maxDiceLeft}.`);
  }
  if (s.carryTaken && e.points <= s.pending.score) {
    // §3.7.2 : le repreneur doit lancer au moins une fois, donc ajouter des points.
    throw new RuleError('Une reprise doit ajouter des points au total herite.');
  }
}

function endTurn(s, outcome, nextPending = null) {
  const id = activeId(s);
  const penalitesAvant = s.penalties.length;
  const etaitUneReprise = s.carryTaken;
  const essaisConsommes = s.attempts;

  if (outcome === 'Z' || outcome === 'Z_PLUS') {
    s.punitive[id] += outcome === 'Z' ? s.config.zPoints : s.config.zPlusPoints;
    if (s.punitive[id] >= s.config.punitiveThreshold) {
      applyPenalty(s, id);
    }
    s.pending = null; // un tour perdu ne laisse aucun de
  } else {
    s.pending = s.config.chainCarryOver || !s.carryTaken ? nextPending : null;
  }

  inscrireTour(s, id, outcome, nextPending, penalitesAvant, etaitUneReprise, essaisConsommes);

  // Declenchement ou progression du dernier tour.
  if (s.status === 'FINAL_ROUND') {
    s.finalRemaining -= 1;
    if (s.finalRemaining === 0) return finish(s);
  } else if (s.scores[id] >= s.config.target) {
    s.status = 'FINAL_ROUND';
    s.trigger = id;
    s.finalRemaining = s.players.length - 1;
  }

  s.activeIndex = (s.activeIndex + 1) % s.players.length;
  s.attempts = 0;
  s.carryTaken = false;
}

// §7 : le moteur est le seul a savoir qu'un tour se termine et a qui il
// appartient — un 3e essai rate termine le tour sans qu'aucune commande ne le
// dise. Il l'inscrit donc ici, une fois. Les statistiques n'ont plus qu'a
// compter ces lignes. Toute autre facon de recompter les tours diverge du
// moteur : c'est exactement ce qui rendait les statistiques fausses.
function inscrireTour(s, id, outcome, nextPending, penalitesAvant, reprise, essais) {
  s.turns.push({
    playerId: id,
    outcome,                                          // 'SCORE' | 'Z' | 'Z_PLUS'
    points: outcome === 'SCORE' ? nextPending?.score ?? 0 : 0,
    diceLeft: outcome === 'SCORE' ? nextPending?.dice ?? null : null,
    carry: reprise,
    attempts: essais,
    penalty: s.penalties.length > penalitesAvant ? s.penalties.at(-1) : null,
  });
}

function applyPenalty(s, id) {
  const nominal = s.config.penalty;
  const applied = s.config.floorAtZero ? Math.min(nominal, s.scores[id]) : nominal;
  s.scores[id] -= applied;
  s.punitive[id] = s.config.resetPunitiveToZero
    ? 0
    : s.punitive[id] - s.config.punitiveThreshold;
  // §3.9 : la penalite est un evenement metier a part entiere, avec sa valeur
  // nominale ET la valeur reellement appliquee. Une penalite sur un joueur a 0
  // point applique 0 : elle reste un evenement, et l'interface doit l'afficher.
  const trace = { id, nominal, applied };
  s.penalties.push(trace);
  s.lastPenalty = trace;
}

function finish(s) {
  s.status = 'FINISHED';
  s.pending = null;   // plus personne ne joue : il n'y a plus rien a reprendre
  const best = Math.max(...Object.values(s.scores));
  const tied = s.players.filter((p) => s.scores[p.id] === best).map((p) => p.id);
  s.winner =
    tied.length > 1 && s.config.triggerWinsTie && tied.includes(s.trigger)
      ? s.trigger
      : tied[0];
}

// ---------------------------------------------------------------------------
// Aides de lecture pour l'interface. Aucune logique de regle ici.
// ---------------------------------------------------------------------------

export const view = {
  activePlayer: (s) => s.players[s.activeIndex],
  remaining: (s) => Math.max(0, s.config.target - s.scores[activeId(s)]),
  attemptsLabel: (s) => `Essai ${Math.min(s.attempts + 1, s.config.maxAttempts)}/${s.config.maxAttempts}`,
  carryOffer: (s) =>
    s.pending && !s.carryTaken
      ? { score: s.pending.score, dice: s.pending.dice }
      : null,
  scoreToBeat: (s) => (s.status === 'FINAL_ROUND' ? Math.max(...Object.values(s.scores)) : null),
};

// ---------------------------------------------------------------------------
// §3.11 — Bareme des des. DONNEE DE REFERENCE UNIQUEMENT.
// N'alimente aucun calcul : l'application ne demande jamais la valeur des des.
// Centralise ici pour ne pas etre disperse, et pret pour un futur module de
// calcul automatique. Les suites valent 750/500 : c'est la regle maison,
// differente des baremes francais courants. Ne pas "corriger" sans instruction.
// ---------------------------------------------------------------------------
export const DICE_TABLE = [
  ['Un 1 seul', 100],
  ['Un 5 seul', 50],
  ['Trois 1', 1000],
  ['Trois 2', 200],
  ['Trois 3', 300],
  ['Trois 4', 400],
  ['Trois 5', 500],
  ['Trois 6', 600],
  ['Suite 1-2-3-4-5', 750],
  ['Suite 2-3-4-5-6', 500],
];
