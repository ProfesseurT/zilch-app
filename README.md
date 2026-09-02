# ZILCH

Compagnon de score pour un jeu de dés joué avec de vrais dés. Un seul iPhone,
hors ligne, sans compte ni serveur. Application web installée sur l'écran d'accueil.

## Structure

    index.html  manifest.json  service-worker.js  icon-*.png   la PWA servie
    js/       engine.js store.js idb.js sounds.js ui.js        le code
    css/      zilch.css                                        deux thèmes
    tests/    *.test.js + simulate.js                          113 tests
    sons/     13 MP3                                6 Z, 3 Z+, 3 pénalité, 1 victoire
    docs/     specifications.md adr.md              la référence qui fait autorité
    docs/archive/                                   ancienne app, référence seule

## Lancer les tests

    npm test          # 113 tests, doit être au vert avant tout changement de phase
    npm run simulate  # contrôle d'équilibre, doit retomber sur le §17 de la spec

Aucune installation. Node 18+ suffit, il n'y a pas de `node_modules`.

## Déployer

Le dépôt est **`zilch-app`**, distinct de l'ancien `Zilch` qui reste en ligne et
intact. URL publiée : `https://<utilisateur>.github.io/zilch-app/`

1. **Incrémenter `VERSION` en tête de `service-worker.js`** — `zilch-v1` → `zilch-v2`.
   Sans ça, le cache sert indéfiniment l'ancienne version : le correctif
   n'atteindra jamais l'iPhone, et **rien ne le signalera**.
2. `npm test` au vert. Un test vérifie que le service worker précache bien tout
   `js/`, `css/`, les icônes et les 13 sons — un fichier oublié casserait le
   mode hors ligne en silence.
3. Publier `main` depuis GitHub Desktop.

Tous les chemins sont **relatifs** (`./`), jamais absolus : GitHub Pages sert le
dépôt dans un sous-dossier et ses fichiers sont sensibles à la casse.

## Installer sur iPhone

Ouvrir l'URL **avec Safari** → Partager → Sur l'écran d'accueil → lancer ZILCH.

L'installation n'est pas un confort, c'est ce qui garde les données : Safari
efface le stockage d'un site après 7 jours sans visite. Une icône sur l'écran
d'accueil y échappe.

**Safari et l'application installée sont deux stockages séparés.** Ce qui a été
enregistré dans l'onglet ne suit pas dans l'icône. Exporter avant d'installer,
réimporter ensuite — l'application le rappelle d'elle-même.

## Ce qui détruit quand même les données

- Effacer historique et données de sites dans Safari.
- Supprimer l'icône de l'écran d'accueil.
- Réinitialiser l'appareil.

D'où l'export JSON proposé à la fin de chaque partie. C'est la seule vraie sauvegarde.
