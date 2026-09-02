// ZILCH — service worker.
//
// ATTENTION, LIGNE SUIVANTE : incrementer VERSION a CHAQUE deploiement.
// Le projet n'a pas d'etape de build, donc aucun nom de fichier n'est
// versionne automatiquement. Sans ce numero, le cache sert indefiniment
// l'ancienne version : un correctif pousse sur GitHub Pages n'atteint jamais
// l'iPhone, et rien ne le signale.
const VERSION = 'zilch-v3';

// Tout ce qui doit fonctionner hors ligne. Un fichier ajoute au projet et
// oublie ici ne sera pas disponible en mode avion — et l'oubli est silencieux.
// Un test verifie que cette liste couvre bien js/, css/ et le manifeste des sons.
const A_PRECACHER = [
  './',
  './index.html',
  './manifest.json',
  './css/zilch.css',
  './js/ui.js',
  './js/engine.js',
  './js/store.js',
  './js/idb.js',
  './js/sounds.js',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './sons/z-01.mp3',
  './sons/z-02.mp3',
  './sons/z-03.mp3',
  './sons/z-04.mp3',
  './sons/z-05.mp3',
  './sons/z-06.mp3',
  './sons/zplus-01.mp3',
  './sons/zplus-02.mp3',
  './sons/zplus-03.mp3',
  './sons/penalite-01.mp3',
  './sons/penalite-02.mp3',
  './sons/penalite-03.mp3',
  './sons/victoire.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Fichier par fichier, JAMAIS cache.addAll : un seul 404 y ferait echouer
    // l'installation entiere du service worker, donc plus aucun hors ligne,
    // sans la moindre erreur visible.
    const resultats = await Promise.allSettled(
      A_PRECACHER.map(async (url) => {
        const rep = await fetch(url, { cache: 'reload' });
        if (!rep.ok) throw new Error(`${url} : ${rep.status}`);
        await cache.put(url, rep);
      }),
    );
    const rates = resultats.filter((r) => r.status === 'rejected');
    if (rates.length) console.warn('[ZILCH] non precache :', rates.map((r) => r.reason?.message));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Purge de tout ce qui ne porte pas la version courante.
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // rien d'externe, par construction

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);

    // Navigation : le reseau d'abord, pour qu'une nouvelle version arrive des
    // qu'elle existe ; le cache si le reseau manque. C'est la seule requete ou
    // l'attente reseau est acceptable, elle n'arrive qu'au lancement.
    if (req.mode === 'navigate') {
      try {
        const frais = await fetch(req);
        cache.put('./index.html', frais.clone());
        return frais;
      } catch {
        return (await cache.match('./index.html')) ?? Response.error();
      }
    }

    // Le reste : cache d'abord. Demarrage immediat, aucune latence sur les sons.
    const connu = await cache.match(req, { ignoreSearch: true });
    if (connu) return connu;
    try {
      const rep = await fetch(req);
      if (rep.ok) cache.put(req, rep.clone());
      return rep;
    } catch {
      return Response.error();
    }
  })());
});
