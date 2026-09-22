# ZILCH

Compagnon de score pour un jeu de dés joué avec de vrais dés. Un seul iPhone,
hors ligne, sans compte ni serveur. Application web installée sur l'écran d'accueil.

## Structure

    index.html  manifest.json  service-worker.js  icon-*.png   la PWA servie
    js/       engine.js store.js idb.js sounds.js ui.js pluie.js  le code
    css/      zilch.css                                     trois thèmes
    tests/    *.test.js + simulate.js                          160 tests
    sons/     13 MP3                                6 Z, 3 Z+, 3 pénalité, 1 victoire
    sons/matrix/  13 MP3                            la voix du thème Matrix
    polices/  ShareTechMono-Regular.woff2 + OFL.txt  police du thème Matrix
    docs/     specifications.md adr.md              la référence qui fait autorité
    docs/archive/                                   ancienne app, référence seule
    JOURNAL.md                                      ce qui a été fait, lot par lot

## Lancer les tests

    npm test          # 160 tests, doit être au vert avant tout changement de phase
    npm run simulate  # contrôle d'équilibre, doit retomber sur le §17 de la spec

Aucune installation. Node 18+ suffit, il n'y a pas de `node_modules`.

## Déployer

Le dépôt est **`zilch-app`**, distinct de l'ancien `Zilch` qui reste en ligne et
intact. URL publiée : `https://<utilisateur>.github.io/zilch-app/`

    git add -A
    git commit -m "ce que j'ai changé"
    git pull --rebase
    git push

Deux crochets git, dans `.githooks/`, remplacent les contrôles qu'un script
faisait avant :

1. **`pre-commit`.** Si un fichier réellement servi hors ligne a changé
   (`index.html`, `manifest.json`, `service-worker.js`, `js/`, `css/`, `sons/`,
   `polices/`, `icon-`) et que `VERSION` n'a pas déjà bougé dans le commit, il
   l'incrémente lui-même dans `service-worker.js`. Sans nouveau numéro, le
   cache sert indéfiniment l'ancienne version : le correctif n'atteindrait
   jamais l'iPhone, et **rien ne le signalerait**. Toucher `docs/` ou `tests/`
   n'atteint pas Safari, donc ne déclenche rien.
2. **`pre-push`.** Lance `npm test` et refuse l'envoi si un test échoue. Un
   test vérifie que le service worker précache bien tout `js/`, `css/`, les
   icônes, les polices et les sons de tous les thèmes. Un fichier oublié
   casserait le mode hors ligne en silence.

`git pull --rebase` avant `git push` reste manuel, pour ne pas se faire
rejeter par une modification faite depuis GitHub sur le web.

Première fois seulement, pour activer les crochets :

    git config core.hooksPath .githooks

Après le push, `git verif` interroge le site en ligne et affiche la `VERSION`
qu'il sert, pour confirmer que la publication a bien eu lieu (GitHub Pages met
une à deux minutes).

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
