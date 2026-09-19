// ZILCH - pluie de caracteres du theme matrix.
//
// POURQUOI ELLE NE TOURNE PAS EN PERMANENCE. Une partie dure environ 105
// tours. Une animation plein ecran qui tourne du debut a la fin chauffe le
// telephone et vide la batterie de celui qui tient la partie, pour une
// decoration que personne ne regarde pendant qu'il saisit un score. Elle ne
// s'anime donc que sur l'accueil et pendant un flash, et l'ecran de partie
// garde un fond noir fige.
//
// AUCUNE INFORMATION NE PASSE PAR ELLE. C'est un decor, et rien d'autre : si
// le canvas ne s'affiche jamais, l'application reste complete.

const CHIFFRES = '0123456789';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Katakana demi-chasse : la vraie signature du film. Toutes les polices ne
// les portent pas, on verifie avant de s'en servir plutot que d'afficher des
// rectangles vides.
const KATAKANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';

const TAILLE = 16;          // px par caractere
const VITESSE = 55;         // ms entre deux descentes

let canvas = null;
let ctx = null;
let colonnes = [];
let alphabet = CHIFFRES + LATIN;
let boucle = null;
let dernier = 0;
let actif = false;

const reduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Vrai si la police de rendu porte reellement ce caractere. */
function glypheConnu(c) {
  if (!ctx) return false;
  ctx.font = `${TAILLE}px monospace`;
  const absent = ctx.measureText('￿').width;
  const teste = ctx.measureText(c).width;
  return teste > 0 && Math.abs(teste - absent) > 0.01;
}

function dimensionner() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const l = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(l * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = l + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.ceil(l / TAILLE);
  colonnes = Array.from({ length: n }, () => Math.random() * -40);
  ctx.fillStyle = '#050A07';
  ctx.fillRect(0, 0, l, h);
}

function dessiner() {
  const l = window.innerWidth;
  const h = window.innerHeight;
  // Voile noir translucide : ce qui a ete dessine avant s'efface peu a peu,
  // ce qui donne la trainee sans garder le moindre historique en memoire.
  ctx.fillStyle = 'rgba(5,10,7,.09)';
  ctx.fillRect(0, 0, l, h);
  ctx.font = `${TAILLE}px ${'Share Tech Mono'}, monospace`;
  ctx.textBaseline = 'top';
  for (let i = 0; i < colonnes.length; i++) {
    const c = alphabet[Math.floor(Math.random() * alphabet.length)];
    const y = colonnes[i] * TAILLE;
    ctx.fillStyle = '#A8FF60';                 // tete de goutte, plus claire
    ctx.fillText(c, i * TAILLE, y);
    ctx.fillStyle = 'rgba(0,255,102,.55)';     // corps
    ctx.fillText(alphabet[Math.floor(Math.random() * alphabet.length)], i * TAILLE, y - TAILLE);
    colonnes[i] = y > h && Math.random() > 0.975 ? 0 : colonnes[i] + 1;
  }
}

function pas(ts) {
  if (!actif) return;
  if (ts - dernier >= VITESSE) { dessiner(); dernier = ts; }
  boucle = requestAnimationFrame(pas);
}

/** Cree le canvas au premier besoin. Rien n'est fait hors du theme matrix. */
function preparer() {
  if (canvas) return true;
  canvas = document.getElementById('pluie');
  if (!canvas || !canvas.getContext) return false;
  ctx = canvas.getContext('2d');
  if (!ctx) return false;
  if (glypheConnu(KATAKANA[0])) alphabet = KATAKANA + CHIFFRES;
  dimensionner();
  window.addEventListener('resize', () => { if (canvas) dimensionner(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) arreter(); });
  return true;
}

export function demarrer() {
  if (document.documentElement.dataset.theme !== 'matrix') return false;
  if (!preparer()) return false;
  if (reduit()) {
    // Mouvement reduit : une seule image, fixe. Le decor existe, il ne bouge pas.
    if (!actif) { dessiner(); dessiner(); }
    return true;
  }
  if (actif) return true;
  actif = true;
  dernier = 0;
  boucle = requestAnimationFrame(pas);
  return true;
}

export function arreter() {
  actif = false;
  if (boucle) { cancelAnimationFrame(boucle); boucle = null; }
}

/** Efface le canvas et coupe l'animation : utilise en quittant le theme. */
export function eteindre() {
  arreter();
  if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

export const enMarche = () => actif;
