// Controle de coherence du §17 : simule des parties completes en pilotant
// le moteur avec des des virtuels, et compare les resultats aux reperes.
// Ce fichier ne fait pas partie de l'application. Il sert a verifier le moteur.

import { createGame, apply, CONFIG } from './engine.js';

const BAREME = { straight15: 750, straight26: 500 };
const MAX_LANCERS = 200; // garde-fou : une suite de mains pleines est theoriquement infinie

function lancer(n) {
  const d = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  const c = {};
  for (const v of d) c[v] = (c[v] || 0) + 1;
  if (n === 5) {
    const set = new Set(d);
    if (set.size === 5 && !set.has(6)) return { pts: BAREME.straight15, used: 5 };
    if (set.size === 5 && !set.has(1)) return { pts: BAREME.straight26, used: 5 };
  }
  let pts = 0, used = 0;
  for (const [face, k] of Object.entries(c)) {
    const v = +face;
    const seul = v === 1 ? 100 : v === 5 ? 50 : 0;
    if (k >= 3) {
      pts += v === 1 ? 1000 : v * 100; used += 3;
      if (seul) { pts += seul * (k - 3); used += k - 3; }
    } else if (seul) { pts += seul * k; used += k; }
  }
  return { pts, used };
}

/** Un tour frais. Seul un premier lancer blanc donne un Z+ ; sinon Z. */
function tourFrais() {
  let pts = 0, n = 5, essais = 0, premier = true;
  for (let i = 0; i < MAX_LANCERS; i++) {
    if (pts < CONFIG.minTurn) essais++;
    const { pts: p, used } = lancer(n);
    if (p === 0) return { issue: premier ? 'Z_PLUS' : 'Z', essais };
    premier = false;
    pts += p; n -= used;
    if (n === 0) {                                   // main pleine : relance obligatoire
      n = 5;
      if (pts < CONFIG.minTurn && essais >= CONFIG.maxAttempts) return { issue: 'Z', essais };
      continue;
    }
    if (pts >= CONFIG.minTurn) return { issue: 'SCORE', pts, dice: n, essais };
    if (essais >= CONFIG.maxAttempts) return { issue: 'Z', essais };
  }
  return { issue: 'Z', essais };
}

/** Un tour repris : au moins un lancer obligatoire. Un blanc donne un Z, jamais un Z+. */
function tourRepris(herite, n) {
  let pts = herite;
  for (let i = 0; i < MAX_LANCERS; i++) {
    const { pts: p, used } = lancer(n);
    if (p === 0) return { issue: 'Z' };
    pts += p; n -= used;
    if (n === 0) { n = 5; continue; }
    return { issue: 'SCORE', pts, dice: n };
  }
  return { issue: 'Z' };
}

// Seuils de rentabilite de la reprise, mesures : au-dela, reprendre bat un tour frais.
const SEUIL_REPRISE = { 1: 1200, 2: 500, 3: 250, 4: 250 };

function partie(nbJoueurs = 4) {
  const players = Array.from({ length: nbJoueurs }, (_, i) => ({ id: `p${i}`, name: `J${i}` }));
  let s = createGame(players);
  const stat = { tours: 0, z: 0, zplus: 0, scores: 0, cumul: 0, offertes: 0, prises: 0, penalites: 0 };
  let penalitesVues = 0;

  while (s.status !== 'FINISHED' && stat.tours < 4000) {
    stat.tours++;
    const offre = s.pending;
    let r;
    if (offre) {
      stat.offertes++;
      if (offre.score >= SEUIL_REPRISE[offre.dice]) {
        stat.prises++;
        s = apply(s, { type: 'TAKE_CARRY' });
        r = tourRepris(offre.score, offre.dice);
      } else {
        s = apply(s, { type: 'DECLINE_CARRY' });
        r = tourFrais();
      }
    } else {
      r = tourFrais();
    }

    if (r.issue === 'SCORE') {
      stat.scores++; stat.cumul += r.pts;
      s = apply(s, { type: 'SCORE', points: arrondi(r.pts), diceLeft: r.dice });
    } else if (r.issue === 'Z') {
      stat.z++; s = apply(s, { type: 'Z' });
    } else {
      stat.zplus++; s = apply(s, { type: 'Z_PLUS' });
    }
    if (s.lastPenalty && s.events.length !== penalitesVues) {
      // compte les penalites en observant les transitions du compteur punitif
    }
    stat.penalites = compterPenalites(s);
  }
  return stat;
}

const arrondi = (p) => Math.round(p / CONFIG.scoreStep) * CONFIG.scoreStep;

/** Recompte les penalites en rejouant le compteur punitif depuis l'historique. */
function compterPenalites(s) {
  const pun = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  let idx = 0, n = 0;
  for (const e of s.events) {
    if (e.type === 'TAKE_CARRY' || e.type === 'DECLINE_CARRY') continue;
    const id = s.players[idx].id;
    if (e.type === 'Z' || e.type === 'Z_PLUS') {
      pun[id] += e.type === 'Z' ? CONFIG.zPoints : CONFIG.zPlusPoints;
      if (pun[id] >= CONFIG.punitiveThreshold) { pun[id] = 0; n++; }
    } else if (e.type === 'SCORE') pun[id] = 0;
    else continue;
    idx = (idx + 1) % s.players.length;
  }
  return n;
}

const N = Number(process.argv[2] || 5000);
const t = { tours: 0, z: 0, zplus: 0, scores: 0, cumul: 0, offertes: 0, prises: 0, penalites: 0 };
for (let i = 0; i < N; i++) {
  const s = partie(4);
  for (const k of Object.keys(t)) t[k] += s[k];
}

const pct = (x) => `${((100 * x) / t.tours).toFixed(1)} %`;
const ligne = (label, valeur, attendu) => `${label.padEnd(34)} ${String(valeur).padStart(9)}   attendu ${attendu}`;

console.log(`\nZILCH — controle d'equilibre sur ${N} parties a 4 joueurs\n`);
console.log(ligne('Tours valides', pct(t.scores), '~66 %'));
console.log(ligne('Z+', pct(t.zplus), '~6 %'));
console.log(ligne('Z simple', pct(t.z), '~29 %'));
console.log(ligne('Score moyen d un tour valide', Math.round(t.cumul / t.scores), '~540'));
console.log(ligne('Esperance par tour', Math.round(t.cumul / t.tours), '~350'));
console.log(ligne('Tours par partie', Math.round(t.tours / N), '~106'));
console.log(ligne('Penalites -1000 par partie', (t.penalites / N).toFixed(1), '~5'));
console.log(ligne('Reprise proposee', pct(t.offertes), '~65 %'));
console.log(ligne('Reprise prise', pct(t.prises), '~18 %'));
console.log();
