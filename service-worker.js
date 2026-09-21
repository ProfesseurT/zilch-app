// ZILCH — service worker.
//
// ATTENTION, LIGNE SUIVANTE : incrementer VERSION a CHAQUE deploiement.
// Le projet n'a pas d'etape de build, donc aucun nom de fichier n'est
// versionne automatiquement. Sans ce numero, le cache sert indefiniment
// l'ancienne version : un correctif pousse sur GitHub Pages n'atteint jamais
// l'iPhone, et rien ne le signale.
const VERSION = 'zilch-v21';

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
  './js/veille.js',
  './js/pluie.js',
  './polices/ShareTechMono-Regular.woff2',
  './polices/Anton-Regular.woff2',
  './icon-180.png',
  './icon-180-tableau.png',
  './icon-180-matrix.png',
  './icon-180-wordart.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './sons/son-01.mp3',
  './sons/son-02.mp3',
  './sons/son-03.mp3',
  './sons/son-04.mp3',
  './sons/son-05.mp3',
  './sons/son-06.mp3',
  './sons/son-07.mp3',
  './sons/son-08.mp3',
  './sons/son-09.mp3',
  './sons/son-10.mp3',
  './sons/son-11.mp3',
  './sons/son-12.mp3',
  './sons/son-13.mp3',
  './sons/son-14.mp3',
  './sons/son-15.mp3',
  './sons/son-16.mp3',
  './sons/son-17.mp3',
  './sons/son-18.mp3',
  './sons/son-19.mp3',
  './sons/son-20.mp3',
  './sons/son-21.mp3',
  './sons/son-22.mp3',
  './sons/son-23.mp3',
  './sons/son-24.mp3',
  './sons/son-25.mp3',
  './sons/son-26.mp3',
  './sons/son-27.mp3',
  './sons/son-28.mp3',
  './sons/son-29.mp3',
  './sons/son-30.mp3',
  './sons/son-31.mp3',
  './sons/son-32.mp3',
  './sons/son-33.mp3',
  './sons/son-34.mp3',
  './sons/son-35.mp3',
  './sons/son-36.mp3',
  './sons/son-37.mp3',
  './sons/son-38.mp3',
  './sons/victoire-01.mp3',
  './sons/victoire-02.mp3',
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
