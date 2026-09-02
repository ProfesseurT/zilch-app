// ZILCH — interface.
//
// REGLE ABSOLUE : aucune logique de regle ici. Chaque bouton construit un
// evenement et le confie a store.record(), qui le fait valider par le moteur.
// Aucun calcul de score, aucun seuil, aucune condition de victoire dans ce
// fichier. Tout ce qui s'affiche vient de engine.view ou de replayGame().

import * as store from './store.js';
import * as idb from './idb.js';
import { view, CONFIG, DICE_TABLE } from './engine.js';
import { createPicker, preload, unlock, play, choisirSon } from './sounds.js';

// --- Theme ------------------------------------------------------------------
// Le choix vit dans le store (donc exporte et reimporte), mais il est aussi
// recopie dans localStorage : le store se charge en asynchrone, et sans ce
// raccourci synchrone l'application afficherait un theme puis l'autre.

const THEMES = [
  { id: 'azulejo', nom: 'Azulejos', teinte: 'linear-gradient(90deg,#1B4D8F 50%,#F5EFE1 50%)' },
  { id: 'tableau', nom: 'Tableau',  teinte: 'linear-gradient(90deg,#08090A 50%,#FF4A17 50%)' },
];
const CLE_THEME = 'zilch.theme';

function poserTheme(id) {
  const choisi = THEMES.some((t) => t.id === id) ? id : 'azulejo';
  document.documentElement.dataset.theme = choisi;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', choisi === 'tableau' ? '#08090A' : '#123A6B');
  try { localStorage.setItem(CLE_THEME, choisi); } catch { /* mode prive */ }
  return choisi;
}

// Applique le theme memorise avant le premier rendu, pour eviter le clignotement.
try { poserTheme(localStorage.getItem(CLE_THEME)); } catch { poserTheme('azulejo'); }

const $ = (id) => document.getElementById(id);
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (n) => Number(n || 0).toLocaleString('fr-FR');
const quand = (iso) => { try { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; } };

const picker = createPicker();
let S = null;            // le store persiste
let partieId = null;     // partie affichee dans l'ecran de partie
// Aucun defaut. Une valeur collante d'un tour sur l'autre paraissait deja
// repondue, donc on sautait l'etape : elle n'etait juste que 45 % du temps par
// hasard, et le joueur suivant se voyait proposer une reprise fausse.
let desChoisis = null;
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

let ephemere = false;   // le stockage est inaccessible : on joue sans filet

/**
 * Sauve, et dit la verite si ca echoue.
 *
 * Avant, un echec d'ecriture etait totalement silencieux : l'ecran se figeait,
 * aucun message, et l'utilisateur retapait — deuxieme evenement en memoire,
 * divergence entre l'ecran et le disque. Desormais l'etat en memoire revient
 * a ce qui est REELLEMENT ecrit, et on le dit.
 *
 * @param {object} avant l'etat a restaurer si l'ecriture echoue
 */
async function sauver(avant = null) {
  if (ephemere) return true;   // rien a ecrire, l'utilisateur a ete prevenu
  try {
    await idb.save(S);
    return true;
  } catch (err) {
    if (avant) S = avant;
    alerteStockage(err);
    return false;
  }
}

/** Le seul chemin d'export : il note aussi la date, personne d'autre ne le fait. */
async function exporter() {
  idb.downloadBackup(store.exportJSON(S));
  const avant = S;
  S = { ...S, settings: { ...S.settings, lastExportAt: new Date().toISOString() } };
  await sauver(avant);
  rendreAccueil();
}

function alerteStockage(err) {
  const m = el(`<div class="modale"><div class="boite">
    <p class="legende">Sauvegarde impossible</p>
    <p>${esc(err?.message || 'Le stockage a refuse l\'ecriture.')}</p>
    <p class="legende">Ta dernière action n'a pas été enregistrée. Exporte tes données
       maintenant, puis recommence-la.</p>
    <button class="or" id="b-sos-export">Exporter maintenant</button>
    <button class="discret espace" id="b-sos-fermer">J'ai compris</button>
  </div></div>`);
  $('modale').innerHTML = '';
  $('modale').append(m);
  $('b-sos-export').onclick = () => { idb.downloadBackup(store.exportJSON(S)); };
  $('b-sos-fermer').onclick = () => { $('modale').innerHTML = ''; rendrePartie(); };
}

// --- Sons : iOS exige un geste utilisateur avant toute lecture --------------

document.addEventListener('click', async function amorce() {
  document.removeEventListener('click', amorce);
  try { preload(); audioPret = await unlock(); } catch { audioPret = false; }
}, { once: true });

const sonner = (evt) => { if (evt && audioPret) play(picker, evt); };

const FLASH = { PENALTY: 'var(--terre)', Z: 'var(--terre)', Z_PLUS: 'var(--terre)' };
let penaliteDuTour = null;   // penalite survenue au tour qui vient d'etre joue

function flasher(mot, couleur) {
  const f = $('flash');
  f.querySelector('.mot').textContent = mot;
  f.querySelector('.mot').style.color = couleur;
  f.classList.remove('on');
  void f.offsetWidth;              // force le redemarrage de l'animation
  f.classList.add('on');           // non bloquant : rien n'attend sa fin
}

// --- Accueil ----------------------------------------------------------------

const partieEnCours = () => store.currentGame(S);

function rendreThemes() {
  const actuel = document.documentElement.dataset.theme;
  const root = $('choix-theme');
  root.innerHTML = '';
  for (const t of THEMES) {
    const b = el(`<button aria-pressed="${t.id === actuel}">
      <span class="apercu" style="background:${t.teinte}"></span>${t.nom}</button>`);
    b.onclick = async () => {
      const choisi = poserTheme(t.id);
      const etatDisque = S;
      S = { ...S, settings: { ...S.settings, theme: choisi } };
      await sauver(etatDisque);
      rendreThemes();
    };
    root.append(b);
  }
}

// §8.2 : l'export est le seul filet reel. Une sauvegarde qu'il faut penser a
// declencher n'est jamais faite — donc on rappelle son age, a l'endroit ou on
// passe forcement.
function rendreRappelExport() {
  const zone = $('rappel-export');
  zone.innerHTML = '';
  if (!S.games.length) return;
  const dernier = S.settings?.lastExportAt;
  const jours = dernier ? Math.floor((Date.now() - new Date(dernier)) / 86400000) : null;
  const partiesDepuis = dernier
    ? S.games.filter((g) => (g.finishedAt || g.createdAt) > dernier).length
    : S.games.length;
  if (dernier && partiesDepuis === 0) return;
  const texte = dernier
    ? `Dernière sauvegarde il y a ${jours} jour${jours > 1 ? 's' : ''} — ${partiesDepuis} partie${partiesDepuis > 1 ? 's' : ''} depuis.`
    : 'Tes parties ne sont sauvegardées nulle part.';
  const b = el(`<div class="bandeau ${dernier ? 'info' : 'alerte'}">
    <b>${esc(texte)}</b>
    <button class="discret espace" id="b-export-rappel">Exporter maintenant</button></div>`);
  zone.append(b);
  $('b-export-rappel').onclick = exporter;
}

function rendreAccueil() {
  rendreThemes();
  rendreRappelExport();
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
    const etatDisque = S;
    S = store.addPlayer(S, champ.value);
    champ.value = '';
    if (!(await sauver(etatDisque))) return;
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
    const etatDisque = S;
    S = store.startGame(S, selection, $('lieu').value.trim() || null);
    partieId = S.games.at(-1).id;
    selection = [];
    $('lieu').value = '';
    if (!(await sauver(etatDisque))) return;
    aller('partie');
  } catch (err) { dire('m-nouvelle', err.message, 'ko'); }
};

// --- Ecran de partie --------------------------------------------------------

function laPartie() {
  const g = S.games.find((x) => x.id === partieId) ?? partieEnCours();
  partieId = g?.id ?? null;
  return g ?? null;
}

// Valider reste inerte tant que les des restants n'ont pas ete designes.
function majValider() {
  const b = $('b-valider');
  b.disabled = desChoisis === null;
  b.textContent = desChoisis === null ? 'Combien de dés restent ?' : 'Valider';
}

function rendreDes() {
  const root = $('choix-des');
  root.innerHTML = '';
  for (let n = CONFIG.minDiceLeft; n <= CONFIG.maxDiceLeft; n++) {
    const b = el(`<button aria-pressed="${n === desChoisis}">${n}</button>`);
    b.onclick = () => { desChoisis = n; rendreDes(); majValider(); };
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

  // Tout reactiver d'abord : le verrou d'action a pu tout desarmer, et seuls
  // les cas ci-dessous doivent rester gris.
  armerBoutons(!actionEnCours);
  rendreDes();   // sinon un de reste visuellement selectionne apres remise a zero
  $('p-essais').textContent = etat.carryTaken ? 'Tour repris' : view.attemptsLabel(etat);
  $('p-plancher').textContent = etat.carryTaken ? `Plus de ${nb(etat.pending.score)}` : `Minimum ${nb(CONFIG.minTurn)}`;
  // §3.6 : le moteur refuse le Z+ hors de son cas legitime, l'interface le grise.
  $('b-zplus').disabled = etat.attempts > 0 || etat.carryTaken;
  $('b-essai').disabled = etat.carryTaken;
  $('b-annuler').disabled = g.events.length === 0 || actionEnCours;
  majValider();

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
const BOUTONS_JEU = ['b-valider', 'b-essai', 'b-z', 'b-zplus', 'b-reprendre-des', 'b-zero', 'b-annuler'];
let actionEnCours = false;   // verrou : un tap = une action, jamais deux

function armerBoutons(actifs) {
  for (const id of BOUTONS_JEU) { const b = $(id); if (b) b.disabled = !actifs; }
}

async function commande(evenement) {
  const g = laPartie();
  if (!g) return;
  // Sans ce verrou, un second tap — le reflexe quand rien ne semble se passer —
  // enregistrait un deuxieme tour, souvent au nom du joueur suivant.
  if (actionEnCours) return;
  actionEnCours = true;
  armerBoutons(false);
  try {
    await executer(g, evenement);
  } finally {
    actionEnCours = false;
    rendrePartie();          // reetablit l'etat exact des boutons
  }
}

async function executer(g, evenement) {
  const avant = store.replayGame(S, g);
  const joueur = view.activePlayer(avant);
  const etatDisque = S;                  // ce qui est reellement ecrit
  try {
    S = store.record(S, g.id, evenement);
  } catch (err) {
    dire('m-tour', err.message, 'ko');
    return;
  }
  // Ecrire d'abord. Ni son, ni flash, ni message tant que ce n'est pas sur le
  // disque : celebrer un tour qui n'a pas ete enregistre est un mensonge.
  if (!(await sauver(etatDisque))) return;
  const apres = store.replayGame(S, laPartie());

  // Le moteur trace chaque penalite. On compare le nombre de traces avant et
  // apres : aucune regle ici, aucun seuil recalcule. La comparaison des scores
  // ne suffirait pas — une penalite sur un joueur a zero n'en fait baisser aucun.
  const nouvelle = apres.penalties.length > avant.penalties.length
    ? apres.penalties.at(-1) : null;

  // UN TOUR = UN SON, ET LE MEME EVENEMENT DECIDE DU FLASH.
  // L'echelle vit dans sounds.js et elle est testee. Ici on se contente de lui
  // donner les trois faits du tour ; le son et l'image ne peuvent plus se
  // contredire, puisqu'ils sortent de la meme decision.
  const evtSonore = choisirSon({
    victoire: apres.status === 'FINISHED',
    penalite: !!nouvelle,
    type: evenement.type,
  });
  penaliteDuTour = nouvelle;          // lue par la modale de victoire
  sonner(evtSonore);
  // La victoire n'a pas de flash : la modale est son affichage.
  if (evtSonore === 'PENALTY') flasher(`−${nb(nouvelle.nominal)}`, FLASH.PENALTY);
  else if (evtSonore === 'Z_PLUS') flasher('Z+', FLASH.Z_PLUS);
  else if (evtSonore === 'Z') flasher('Z', FLASH.Z);

  $('points').value = '';
  if (evenement.type === 'SCORE') desChoisis = null;   // choix explicite au tour suivant
  rendrePartie();
  if (nouvelle) {
    const nom = avant.players.find((p) => p.id === nouvelle.id)?.name ?? '';
    dire('m-tour', nouvelle.applied < nouvelle.nominal
      ? `${nom} : pénalité de ${nb(nouvelle.nominal)}, ${nb(nouvelle.applied)} appliqués — le score ne passe pas sous zéro.`
      : `${nom} : pénalité de ${nb(nouvelle.nominal)} points.`, 'ko');
  } else dire('m-tour', '');
}

$('b-valider').onclick = () => {
  if (desChoisis === null) return dire('m-tour', 'Choisis combien de dés restent sur la table.', 'ko');
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

async function annuler() {
  const g = laPartie();
  if (!g || actionEnCours) return;
  actionEnCours = true;
  armerBoutons(false);
  try {
    const etatDisque = S;
    S = store.undoLast(S, g.id);   // rejeu integral, jamais une soustraction
    if (!(await sauver(etatDisque))) return;
    $('modale').innerHTML = '';
    $('modale').dataset.pour = '';
    desChoisis = null;
    dire('m-tour', 'Dernière action annulée.', 'ok');
  } finally {
    actionEnCours = false;
    rendrePartie();
  }
}
$('b-annuler').onclick = annuler;

$('b-abandon').onclick = () => {
  const g = laPartie();
  if (!g) return;
  // Un pouce imprecis au tour 60 effacait la soiree sans un mot.
  const m = el(`<div class="modale"><div class="boite">
    <p class="legende">Arrêter la partie</p>
    <p>La partie sera archivée telle quelle. Tu ne pourras plus la reprendre.</p>
    <button class="terre" id="b-abandon-oui">Oui, arrêter</button>
    <button class="discret espace" id="b-abandon-non">Continuer à jouer</button>
  </div></div>`);
  $('modale').innerHTML = '';
  $('modale').append(m);
  $('b-abandon-non').onclick = () => { $('modale').innerHTML = ''; };
  $('b-abandon-oui').onclick = async () => {
    const etatDisque = S;
    S = store.abandonGame(S, g.id);   // etat de cycle de vie : decide dans le store
    if (!(await sauver(etatDisque))) return;
    $('modale').innerHTML = '';
    partieId = null;
    // §8.2 : l'export est propose a la fin de CHAQUE partie, arret compris.
    aller('accueil');
  };
};

function montrerVainqueur(g, etat) {
  if ($('modale').dataset.pour === g.id) return;
  $('modale').dataset.pour = g.id;
  const nom = etat.players.find((p) => p.id === etat.winner)?.name ?? '?';
  // Aucun son ici. Il a deja ete decide par l'echelle de priorite au moment du
  // dernier coup joue — sinon la fanfare se rejouerait a chaque reouverture de
  // l'application sur une partie deja terminee.
  const m = el(`<div class="modale"><div class="boite">
    <p class="legende">Victoire</p>
    <div class="vainqueur">${esc(nom)}</div>
    <p>${nb(etat.scores[etat.winner])} points.</p>
    ${penaliteDuTour ? `<p class="legende">Et une pénalité de ${nb(penaliteDuTour.nominal)} sur le dernier tour.</p>` : ''}
    <button class="or" id="b-sauver-fin">Exporter la sauvegarde</button>
    <button class="discret espace" id="b-annuler-fin">Annuler le dernier tour</button>
    <button class="discret espace" id="b-fermer-fin">Voir l'historique</button>
  </div></div>`);
  $('modale').innerHTML = '';
  $('modale').append(m);
  // §8.2 : l'export est propose a la fin de chaque partie, refusable en un tap.
  $('b-sauver-fin').onclick = exporter;
  // Sans ce bouton, un score mal tape au dernier tour terminait la partie sans
  // aucun retour possible : la modale couvrait le seul bouton Annuler.
  $('b-annuler-fin').onclick = annuler;
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

$('b-exporter').onclick = async () => {
  await exporter();
  dire('m-donnees', 'Sauvegarde exportée. Range-la dans Fichiers ou iCloud Drive.', 'ok');
};
$('b-importer').onclick = () => $('fichier').click();
$('fichier').onchange = async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const etatDisque = S;
    S = store.importJSON(S, await f.text());
    if (!(await sauver(etatDisque))) return;
    const r = S.lastImport;
    const bouts = [];
    if (r.players) bouts.push(`${r.players} joueur${r.players > 1 ? 's' : ''}`);
    if (r.games) bouts.push(`${r.games} partie${r.games > 1 ? 's' : ''}`);
    if (r.repaired) bouts.push(`${r.repaired} partie${r.repaired > 1 ? 's' : ''} complétée${r.repaired > 1 ? 's' : ''}`);
    rendreHistorique();
    rendreAccueil();
    dire('m-donnees', bouts.length ? `Importé : ${bouts.join(', ')}.` : 'Rien de nouveau : tout y était déjà.', 'ok');
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

/**
 * Le passage de Safari a l'application installee.
 *
 * Sur iOS, Safari et l'application installee sont DEUX COFFRES SEPARES : rien
 * de ce qui a ete enregistre dans l'onglet ne suit dans l'icone. Une banniere
 * qui se contente de dire « installe » envoie donc perdre ses joueurs, une
 * seule fois, sans bruit, exactement au pire moment. D'ou les deux moities.
 */
function rendreBandeauInstallation(installe) {
  const zone = $('avert-install');
  zone.innerHTML = '';

  if (!installe) {
    const aDesDonnees = S.players.length || S.games.length;
    zone.append(el(`<div class="bandeau alerte">
      <b>Installe ZILCH sur ton écran d'accueil.</b> Hors de l'écran d'accueil, Safari
      efface tout au bout de 7 jours sans ouverture. Bouton <b>Partager</b>, puis
      <b>Sur l'écran d'accueil</b>.<br>
      <b>Ce que tu enregistres ici ne suivra pas dans l'application installée.</b>
      Exporte d'abord, tu réimporteras ensuite.
      ${aDesDonnees ? '<button class="or espace" id="b-export-install">Exporter avant d\'installer</button>' : ''}
    </div>`));
    if ($('b-export-install')) $('b-export-install').onclick = exporter;
    return;
  }

  // Installee et vide : soit c'est la toute premiere fois, soit l'utilisateur
  // arrive de Safari et croit avoir tout perdu. Dans les deux cas, dire ou
  // sont ses donnees coute un bandeau et sauve la soiree.
  if (!S.players.length && !S.games.length) {
    zone.append(el(`<div class="bandeau info">
      <b>Bienvenue.</b> Si tu as déjà joué dans Safari, tes données ne suivent pas
      toutes seules : récupère-les depuis l'onglet <b>Parties</b>, bouton
      <b>Importer un fichier</b>.</div>`));
  }
}

(async function demarrer() {
  $('bareme').innerHTML = DICE_TABLE.map(([nom, pts]) => `<tr><td>${esc(nom)}</td><td>${nb(pts)}</td></tr>`).join('');
  rendreDes();
  majValider();

  // La detection d'installation ne depend pas du stockage : elle doit marcher
  // meme si IndexedDB est mort, parce que c'est justement le conseil qui sauve
  // les donnees.
  const installe = idb.isInstalled();

  try {
    const b = await idb.boot();
    S = b.store;
    // Le store fait autorite sur le raccourci localStorage : c'est lui qui suit
    // l'utilisateur a travers un export et un changement de telephone.
    if (S.settings?.theme) poserTheme(S.settings.theme);
    if (b.persistence.supported && !b.persistence.granted) {
      console.info('[ZILCH] stockage persistant refuse par le systeme : exporter plus souvent.');
    }
  } catch (err) {
    // Plutot qu'un ecran mort ou chaque ecran plante sur un store nul : on
    // joue, on le dit, et l'export reste possible.
    ephemere = true;
    S = store.emptyStore();
    document.body.prepend(el(`<div class="bandeau alerte">
      <b>Stockage inaccessible — rien ne sera conservé.</b> ${esc(err.message)}
      Tu peux jouer et exporter, mais si tu fermes l'application tout disparaît.</div>`));
  }

  rendreBandeauInstallation(installe);
  rendreAccueil();
  const g = partieEnCours();
  if (g) { partieId = g.id; aller('partie'); }
})();
