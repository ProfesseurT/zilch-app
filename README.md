# ZILCH

Compagnon de score pour un jeu de dés joué avec de vrais dés. Un seul iPhone,
hors ligne, sans compte ni serveur. Application web installée sur l'écran d'accueil.

## Structure

    js/       engine.js store.js idb.js sounds.js   le code de l'application
    tests/    *.test.js + simulate.js               77 tests, aucune dépendance
    sons/     13 MP3                                 6 Z, 3 Z+, 3 pénalité, 1 victoire
    docs/     specifications.md adr.md               la référence qui fait autorité
    docs/archive/                                    ancienne app, référence seule

À la racine viendront `index.html`, `manifest.json`, `service-worker.js` et les
icônes : c'est ce que GitHub Pages sert.

## Lancer les tests

    npm test          # 77 tests, doit être au vert avant tout changement de phase
    npm run simulate  # contrôle d'équilibre, doit retomber sur le §17 de la spec

Aucune installation. Node 18+ suffit, il n'y a pas de `node_modules`.

## Déployer

1. **Incrémenter la constante de version en tête de `service-worker.js`.**
   Sans ça, le correctif n'atteindra jamais l'iPhone.
2. `git push` sur la branche servie par GitHub Pages.
3. L'URL respecte la casse du dépôt : `https://<utilisateur>.github.io/Zilch/`.

## Installer sur iPhone

Ouvrir l'URL **avec Safari** → Partager → Sur l'écran d'accueil → lancer ZILCH.

L'installation n'est pas un confort, c'est ce qui garde les données : Safari
efface le stockage d'un site après 7 jours sans visite. Une icône sur l'écran
d'accueil y échappe.

## Ce qui détruit quand même les données

- Effacer historique et données de sites dans Safari.
- Supprimer l'icône de l'écran d'accueil.
- Réinitialiser l'appareil.

D'où l'export JSON proposé à la fin de chaque partie. C'est la seule vraie sauvegarde.
