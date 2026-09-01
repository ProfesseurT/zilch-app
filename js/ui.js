// ZILCH — interface.
//
// REGLE ABSOLUE : aucune logique de regle ici. Chaque bouton construit un
// evenement et le confie a store.record(), qui le fait valider par le moteur.
// Aucun calcul de score, aucun seuil, aucune condition de victoire dans ce
// fichier. Tout ce qui s'affiche vient de engine.view ou de replayGame().

import * as store from './store.js';
import * as idb from './idb.js';
import { view, CONFIG, DICE_TABLE } from './engine.js';
import { createPicker, preload, unlock, play, allFiles } from './sounds.js';

const $ = (id) => document.getElementById(id);
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (n) => Number(n || 0).toLocaleString('fr-FR');
const quand = (iso) => { try { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; } };

const picker = createPicker();
let S = null;            // le store persiste
let partieId = null;     // partie affichee dans l'ecran de partie
let desChoisis = 2;      // des laisses, defaut raisonnable (§17 : 1 et 2 dominent)
let audioPret = false;
let dernierActif = null; // pour n'animer la bascule que quand le joueur change

// --- Navigation -------------------------------------------------------------

function aller(nom) {
  document.querySelectorAll('.ecran').forEach((s) => s.classList.toggle('actif', s.id === `e-${nom}`));
  document.querySelectorAll('nav button').forEach((b) => {
    if (b.dataset.aller === nom) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (nom === 'joueurs') rendreJoueurs();
  if (nom === 'nouvelle') rendreNouvelle();
  if (nom === 'partie') rendrePartie();
  if (nom === 'historique') rendreHistorique();
  if (nom === 'stats') rendreStats();
  if (nom === 'accueil') rendreAccueil();
  window.scrollTo({ top: 0 });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-aller]');
  if (b) aller(b.dataset.aller);
});

// --- Persistance ------------------------------------------------------------

const sauver = () => idb.save(S);

// --- Sons : iOS exige un geste utilisateur avant toute lecture --------------

document.addEventListener('click', async function amorce() {
  document.removeEventListener('click', amorce);
  try { preload(); audioPret = await unlock(); } catch { audioPret = false; }
}, { once: true });

const sonner = (evt) => { if (audioPret) play(picker, evt); };

function flasher(mot, couleur) {
  const f = $('flash');
  f.querySelector('.mot').textContent = mot;
  f.querySelector('.mot').style.color = couleur;
  f.classList.remove('on');
  void f.offsetWidth;              // force le redemarrage de l'animation
  f.classList.add('on');           // non bloquant : rien n'attend sa fin
}

// --- Accueil ----------------------------------------------------------------

function partieEnCours() {
  return S.games.find((g) => g.status === 'IN_PROGRESS' || g.status === 'FINAL_ROUND') ?? null;
}

function rendreAccueil() {
  const g = partieEnCours();
  const b = $('b-reprendre');
  b.hidden = !g;
  if (g) {
    const etat = store.replayGame(S, g);
    b.textContent = `Reprendre — ${view.activePlayer(etat)?.name ?? ''}`;
    b.onclick = () => { partieId = g.id; aller('partie'); };
  }
}

// --- Joueurs ----------------------------------------------------------------

function rendreJoueurs() {
  const root = $('liste-joueurs');
  root.innerHTML = '';
  if (!S.players.length) {
    root.append(el('<div class="carte vide">Aucun joueur pour l\'instant.</div>'));
    return;
  }
  for (const p of S.players) {
    const st = store.stats(S, p.id);
    root.append(el(`<div class="puce">
      <div class="nom">${esc(p.name)}<div class="meta">${st.games} partie${st.games > 1 ? 's' : ''} · ${st.wins} victoire${st.wins > 1 ? 's' : ''}</div></div>
    </div>`));
  }
}

$('b-ajouter').onclick = async () => {
  const champ = $('nouveau-nom');
  try {
    S = store.addPlayer(S, champ.value);
    champ.value = '';
    await sauver();
    rendreJoueurs();
    dire('m-joueurs', 'Joueur ajouté.', 'ok');
  } catch (err) { dire('m-joueurs', err.message, 'ko'); }
};
$('nouveau-nom').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('b-ajouter').click(); });

function dire(id, texte, classe = '') { const n = $(id); n.textContent = texte; n.className = 'msg ' + classe; }

// --- Nouvelle partie --------------------------------------------------------

let selection = [];

function rendreNouvelle() {
  selection = selection.filter((id) => S.players.some((p) => p.id === id));
  const root = $('choix-joueurs');
  root.innerHTML = '';
  if (!S.players.length) {
    root.append(el('<div class="vide">Ajoute d\'abord des joueurs.</div>'));
    return;
  }
  for (const p of S.players) {
    const rang = selection.indexOf(p.id);
    const puce = el(`<div class="puce ${rang >= 0 ? 'choisi' : ''}">
      <span class="rang">${rang >= 0 ? rang + 1 : '·'}</span>
      <div class="nom">${esc(p.name)}</div></div>`);
    puce.onclick = () => {
      if (rang >= 0) selection.splice(rang, 1); else selection.push(p.id);
      rendreNouvelle();
    };
    root.append(puce);
  }
}

$('b-geo').onclick = () => {
  if (!navigator.geolocation) return dire('m-nouvelle', 'Position indisponible sur cet appareil.', 'ko');
  $('b-geo').disabled = true;
  $('b-geo').textContent = 'Recherche…';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      // Vie privee : aucune coordonnee precise n'est conservee, seulement une
      // etiquette grossiere que l'utilisateur peut reecrire.
      const lat = pos.coords.latitude.toFixed(1);
      const lon = pos.coords.longitude.toFixed(1);
      $('lieu').value = $('lieu').value || `Vers ${lat}, ${lon}`;
      $('b-geo').disabled = false;
      $('b-geo').textContent = 'Utiliser ma position';
      dire('m-nouvelle', 'Renomme ce lieu si tu veux : « chez Marc » vaut mieux.', 'ok');
    },
    () => {
      $('b-geo').disabled = false;
      $('b-geo').textContent = 'Utiliser ma position';
      dire('m-nouvelle', 'Position refusée. Saisis le lieu à la main.', 'ko');
    },
    { timeout: 9000, maximumAge: 60000 },
  );
};

$('b-demarrer').onclick = async () => {
  try {
    S = store.startGame(S, selection, $('lieu').value.trim() || null);
    partieId = S.games.at(-1).id;
    selection = [];
    $('lieu').value = '';
    await sauver();
    aller('partie');
  } catch (err) { dire('m-nouvelle', err.message, 'ko'); }
};

// --- Ecran de partie --------------------------------------------------------

function laPartie() {
  const g = S.games.find((x) => x.id === partieId) ?? partieEnCours();
  partieId = g?.id ?? null;
  return g ?? null;
}

function rendreDes() {
  const root = $('choix-des');
  root.innerHTML = '';
  for (let n = CONFIG.minDiceLeft; n <= CONFIG.maxDiceLeft; n++) {
    const b = el(`<button aria-pressed="${n === desChoisis}">${n}</button>`);
    b.onclick = () => { desChoisis = n; rendreDes(); };
    root.append(b);
  }
}

function rendrePartie() {
  const g = laPartie();
  if (!g) {
    $('bandeaux').innerHTML = '<div class="bandeau info">Aucune partie en cours.</div>';
    $('bloc-saisie').hidden = true;
    $('bloc-reprise').hidden = true;
    $('p-qui').textContent = '—'; $('p-total').textContent = '0'; $('p-reste').textContent = '';
    $('tableau').innerHTML = '';
    return;
  }
  const etat = store.replayGame(S, g);
  const actif = view.activePlayer(etat);
  const fini = etat.status === 'FINISHED';

  if (actif && actif.id !== dernierActif) {
    $('bloc-actif').classList.remove('change'); void $('bloc-actif').offsetWidth;
    $('bloc-actif').classList.add('change');
    dernierActif = actif.id;
  }

  $('p-qui').textContent = fini ? 'Partie terminée' : actif.name;
  $('p-total').textContent = fini ? '' : nb(etat.scores[actif.id]);
  const reste = view.remaining(etat);
  $('p-reste').textContent = fini ? ''
    : etat.status === 'FINAL_ROUND' ? 'dernier tour'
    : reste === 0 ? `${nb(CONFIG.target)} atteints`
    : `${nb(reste)} pts avant le dernier tour`;

  const bandeaux = [];
  if (etat.status === 'FINAL_ROUND') {
    const abattre = view.scoreToBeat(etat);
    const ecart = Math.max(0, abattre - etat.scores[actif.id]);
    bandeaux.push(`<div class="bandeau final"><b>DERNIER TOUR.</b> Score à battre : <b>${nb(abattre)}</b>${ecart ? ` — il manque ${nb(ecart)}.` : ' — tu es devant.'}</div>`);
  }
  $('bandeaux').innerHTML = bandeaux.join('');

  const offre = fini ? null : view.carryOffer(etat);
  $('bloc-reprise').hidden = !offre;
  if (offre) {
    $('reprise-texte').innerHTML = `Il reste <b>${offre.dice} dé${offre.dice > 1 ? 's' : ''}</b> et <b>${nb(offre.score)} points</b> sur la table.`;
  }
  $('bloc-saisie').hidden = !!offre || fini;

  $('p-essais').textContent = etat.carryTaken ? 'Tour repris' : view.attemptsLabel(etat);
  $('p-plancher').textContent = etat.carryTaken ? `Plus de ${nb(etat.pending.score)}` : `Minimum ${nb(CONFIG.minTurn)}`;
  // §3.6 : le moteur refuse le Z+ hors de son cas legitime, l'interface le grise.
  $('b-zplus').disabled = etat.attempts > 0 || etat.carryTaken;
  $('b-essai').disabled = etat.carryTaken;
  $('b-annuler').disabled = g.events.length === 0;

  $('tableau').innerHTML = etat.players.map((p) => {
    const pun = etat.punitive[p.id];
    return `<div class="ligne ${!fini && p.id === actif.id ? 'courant' : ''}">
      <span class="nom">${esc(p.name)}${p.id === etat.trigger ? ' ✦' : ''}
        ${pun ? `<span class="serie"> ${pun} point${pun > 1 ? 's' : ''} punitif${pun > 1 ? 's' : ''}</span>` : ''}</span>
      <span class="pts">${nb(etat.scores[p.id])}</span></div>`;
  }).join('');

  if (fini) montrerVainqueur(g, etat);
}

// Toute action de jeu passe par ici. Un seul chemin, donc un seul endroit ou
// se tromper — et aucune regle : le moteur accepte ou refuse.
async function commande(evenement) {
  const g = laPartie();
  if (!g) return;
  const avant = store.replayGame(S, g);
  const joueur = view.activePlayer(avant);
  try {
    S = store.record(S, g.id, evenement);
  } catch (err) {
    dire('m-tour', err.message, 'ko');
    return;
  }
  const apres = store.replayGame(S, laPartie());
  await sauver();

  // Le moteur trace chaque penalite. On compare le nombre de traces avant et
  // apres : aucune regle ici, aucun seuil recalcule. La comparaison des scores
  // ne suffirait pas — une penalite sur un joueur a zero n'en fait baisser aucun.
  const nouvelle = apres.penalties.length > avant.penalties.length
    ? apres.penalties.at(-1) : null;

  if (nouvelle) { flasher(`−${nb(nouvelle.nominal)}`, '#B4543A'); sonner('PENALTY'); }
  else if (evenement.type === 'Z') { flasher('Z', '#B4543A'); sonner('Z'); }
  else if (evenement.type === 'Z_PLUS') { flasher('Z+', '#8C4029'); sonner('Z_PLUS'); }

  $('points').value = '';
  rendrePartie();
  if (nouvelle) {
    const nom = avant.players.find((p) => p.id === nouvelle.id)?.name ?? '';
    dire('m-tour', nouvelle.applied < nouvelle.nominal
      ? `${nom} : pénalité de ${nb(nouvelle.nominal)}, ${nb(nouvelle.applied)} appliqués — le score ne passe pas sous zéro.`
      : `${nom} : pénalité de ${nb(nouvelle.nominal)} points.`, 'ko');
  } else dire('m-tour', '');
}

$('b-valider').onclick = () => {
  const v = $('points').value.trim();
  if (v === '') return dire('m-tour', 'Saisis un score.', 'ko');
  commande({ type: 'SCORE', points: Number(v), diceLeft: desChoisis });
};
$('points').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.blur(); $('b-valider').click(); } });
$('b-essai').onclick = () => commande({ type: 'FAILED_ATTEMPT' });
$('b-z').onclick = () => commande({ type: 'Z' });
$('b-zplus').onclick = () => commande({ type: 'Z_PLUS' });
$('b-reprendre-des').onclick = () => commande({ type: 'TAKE_CARRY' });
$('b-zero').onclick = () => commande({ type: 'DECLINE_CARRY' });

$('b-annuler').onclick = async () => {
  const g = laPartie();
  if (!g) return;
  S = store.undoLast(S, g.id);   // rejeu integral, jamais une soustraction
  await sauver();
  $('modale').innerHTML = '';
  rendrePartie();
  dire('m-tour', 'Dernière action annulée.', 'ok');
};

$('b-abandon').onclick = async () => {
  const g = laPartie();
  if (!g) return;
  S = { ...S, games: S.games.map((x) => (x.id === g.id ? { ...x, status: 'ABANDONED', finishedAt: new Date().toISOString() } : x)) };
  await sauver();
  partieId = null;
  aller('historique');
};

function montrerVainqueur(g, etat) {
  if ($('modale').dataset.pour === g.id) return;
  $('modale').dataset.pour = g.id;
  const nom = etat.players.find((p) => p.id === etat.winner)?.name ?? '?';
  sonner('VICTORY');
  const m = el(`<div class="modale"><div class="boite">
    <p class="legende">Victoire</p>
    <div class="vainqueur">${esc(nom)}</div>
    <p>${nb(etat.scores[etat.winner])} points.</p>
    <button class="or" id="b-sauver-fin">Exporter la sauvegarde</button>
    <button class="discret espace" id="b-fermer-fin">Voir l'historique</button>
  </div></div>`);
  $('modale').innerHTML = '';
  $('modale').append(m);
  // §8.2 : l'export est propose a la fin de chaque partie, refusable en un tap.
  $('b-sauver-fin').onclick = () => { idb.downloadBackup(store.exportJSON(S)); };
  $('b-fermer-fin').onclick = () => { $('modale').innerHTML = ''; partieId = null; aller('historique'); };
}

// --- Historique -------------------------------------------------------------

function rendreHistorique() {
  const root = $('liste-parties');
  const finies = S.games.filter((g) => g.status === 'FINISHED' || g.status === 'ABANDONED').slice().reverse();
  root.innerHTML = '';
  if (!finies.length) {
    root.append(el('<div class="carte vide">Aucune partie terminée.</div>'));
    return;
  }
  for (const g of finies) {
    const etat = store.replayGame(S, g);
    const classement = etat.players.slice().sort((a, b) => etat.scores[b.id] - etat.scores[a.id]);
    root.append(el(`<div class="carte serree">
      <div class="ligne"><span class="nom">${g.status === 'ABANDONED' ? 'Partie arrêtée' : '🏆 ' + esc(classement[0].name)}</span>
        <span class="meta">${quand(g.finishedAt || g.createdAt)}</span></div>
      ${g.location ? `<p class="legende">${esc(g.location)}</p>` : ''}
      <div class="tableau">${classement.map((p) => `<div class="ligne"><span class="nom">${esc(p.name)}</span><span class="pts">${nb(etat.scores[p.id])}</span></div>`).join('')}</div>
      <p class="legende espace">${g.events.filter((e) => e.type === 'Z').length} Z · ${g.events.filter((e) => e.type === 'Z_PLUS').length} Z+ · ${g.events.length} événements</p>
    </div>`));
  }
}

$('b-exporter').onclick = () => {
  idb.downloadBackup(store.exportJSON(S));
  dire('m-donnees', 'Sauvegarde exportée. Range-la dans Fichiers ou iCloud.', 'ok');
};
$('b-importer').onclick = () => $('fichier').click();
$('fichier').onchange = async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    S = store.importJSON(S, await f.text());   // fusionne, n'ecrase jamais
    await sauver();
    rendreHistorique();
    dire('m-donnees', 'Sauvegarde importée et fusionnée.', 'ok');
  } catch (err) { dire('m-donnees', err.message, 'ko'); }
  e.target.value = '';
};

// --- Stats ------------------------------------------------------------------

function rendreStats() {
  const root = $('classement');
  root.innerHTML = '';
  if (!S.players.length) {
    root.append(el('<div class="carte vide">Aucun joueur.</div>'));
    return;
  }
  const lignes = S.players.map((p) => ({ p, s: store.stats(S, p.id) }))
    .sort((a, b) => b.s.wins - a.s.wins || b.s.avgScore - a.s.avgScore);
  for (const { p, s } of lignes) {
    root.append(el(`<div class="carte serree">
      <h2>${esc(p.name)}</h2>
      <div class="kpi"><span>Parties</span><b>${s.games}</b></div>
      <div class="kpi"><span>Victoires</span><b>${s.wins}${s.games ? ` · ${Math.round(s.winRate * 100)} %` : ''}</b></div>
      <div class="kpi"><span>Score moyen</span><b>${nb(s.avgScore)}</b></div>
      <div class="kpi"><span>Meilleur tour</span><b>${nb(s.bestTurn)}</b></div>
      <div class="kpi"><span>Z · Z+</span><b>${s.z} · ${s.zPlus}</b></div>
      <div class="kpi"><span>Reprises tentées · gagnées</span><b>${s.carryTaken} · ${s.carryWon}</b></div>
    </div>`));
  }
}

// --- Demarrage --------------------------------------------------------------

(async function demarrer() {
  $('bareme').innerHTML = DICE_TABLE.map(([nom, pts]) => `<tr><td>${esc(nom)}</td><td>${nb(pts)}</td></tr>`).join('');
  rendreDes();
  try {
    const b = await idb.boot();
    S = b.store;
    if (!b.installed) {
      // §8.2 : hors ecran d'accueil, Safari efface tout apres 7 jours.
      $('avert-install').append(el(`<div class="bandeau alerte">
        <b>Installe ZILCH sur ton écran d'accueil.</b> Sinon Safari effacera tes parties
        au bout de 7 jours sans ouverture. Bouton <b>Partager</b>, puis
        <b>Sur l'écran d'accueil</b>.</div>`));
    }
    rendreAccueil();
    const g = partieEnCours();
    if (g) { partieId = g.id; aller('partie'); }
  } catch (err) {
    document.body.prepend(el(`<div class="bandeau alerte"><b>Stockage inaccessible.</b> ${esc(err.message)}</div>`));
  }
})();
