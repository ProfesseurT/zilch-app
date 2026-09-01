# ZILCH — Message de reprise

> À coller tel quel comme premier message dans le projet Cowork, une fois le dossier rempli.

---

## Avant d'envoyer — vérifie que ces fichiers sont dans le dossier

**Documents** — produits, à jour :

- [ ] `zilch-specifications.md` — document unique faisant autorité, 784 lignes
- [ ] `zilch-adr.md` — les 7 décisions d'architecture et leur coût de réouverture
- [ ] `zilch-protocole-partie-test.md` — protocole de validation des règles à une vraie table
- [ ] `zilch-instructions-projet.md` — à coller dans les instructions du projet, pas dans le dossier

**Code** — écrit et testé, 77 tests au vert :

- [ ] `engine.js` · `engine.test.js` — 46 tests
- [ ] `store.js` · `store.test.js` — 23 tests
- [ ] `sounds.js` · `sounds.test.js` — 8 tests
- [ ] `idb.js` — adaptateur IndexedDB, **non testé**, vérifiable seulement sur iPhone
- [ ] `simulate.js` — contrôle d'équilibre
- [ ] `package.json`

**Existant** — indispensable, jamais inspecté à ce jour :

- [ ] `index.html` de l'ancienne application, celui du dépôt `ProfesseurT/Zilch`
- [ ] `manifest.json`, `service-worker.js`, icônes du même dépôt

**Sans l'ancien `index.html`, la phase 3 ne peut pas démarrer.** C'est le seul endroit où se trouve la forme réelle des données `dixmille_compagnon_v1`, et la fonction de migration actuelle est un squelette écrit à l'aveugle.

---

## Le message

```
Contexte : je reprends le projet ZILCH. Tout le travail préparatoire est
dans le dossier. Lis d'abord zilch-specifications.md en entier, puis
zilch-adr.md. Ne me repose pas les questions déjà tranchées dedans.

ÉTAT DES LIEUX

ZILCH est un compagnon de score pour un jeu de dés joué avec de vrais dés,
sur un seul iPhone, hors ligne, sans compte ni serveur. Une application
web installée sur l'écran d'accueil, déployée sur GitHub Pages à
https://profess eurT.github.io/Zilch/ (attention à la majuscule du dépôt).

Ce qui est fait et testé, à réutiliser tel quel sans le réécrire :
- engine.js — toutes les règles du jeu, pures, 46 tests
- store.js — persistance mémoire, stats, export, import, 23 tests
- sounds.js — manifeste et tirage aléatoire des sons, 8 tests
- simulate.js — contrôle d'équilibre par simulation
- idb.js — adaptateur IndexedDB, non testé, à vérifier sur appareil

Ce qui est réutilisable dans l'ancienne app : la coque PWA, la gestion des
joueurs, l'historique, l'identité visuelle azulejos.

Ce qui est à refaire entièrement : l'écran de partie. Il ne gère ni les
3 essais, ni Z et Z+, ni la pénalité de -1000, ni les dés restants, ni la
reprise du tour précédent, ni le dernier tour.

Ce qui reste à produire : 13 fichiers audio, l'interface, un service worker
versionné.

CE QUE JE VEUX MAINTENANT — PHASE 0, AUCUN CODE

1. Lance node --test à la racine. Confirme-moi 77 tests au vert.
2. Lance node simulate.js 4000. Confirme que les chiffres retombent sur
   le tableau du §17 de la spec.
3. Ouvre l'ancien index.html. Il fait environ 256 Ko dont l'essentiel est
   occupé par deux blocs audio en base64 : ignore-les, va lire le
   JavaScript qui les suit. Rapporte-moi précisément :
   - la structure exacte des objets sauvegardés sous la clé
     dixmille_compagnon_v1 : forme d'un joueur, forme d'une partie, tous
     les champs, avec un exemple réel
   - ce que font exactement les boutons Z, Z+ et « Essai < 250 » dans le
     code, et si leur comportement diffère de ce que dit la spec
   - la version du cache du service worker et sa stratégie
4. Liste les contradictions entre l'ancien code et la spécification.
   Ne les corrige pas, liste-les.

Livre-moi un compte rendu de 20 lignes maximum. Aucun fichier modifié.

APRÈS VALIDATION, PHASE 3 — PERSISTANCE

Dans cet ordre :
1. Compléter migrateLegacy() dans store.js avec la vraie forme des
   données que tu viens de relever, et écrire les tests correspondants.
2. Brancher idb.js : chargement, sauvegarde, migration exécutée une
   seule fois, navigator.storage.persist() à chaque lancement, détection
   du mode standalone.
3. Ne jamais effacer la clé localStorage d'origine.

Critère de validation : je joue une partie, je ferme l'app, je la rouvre,
rien n'est perdu.

CONTRAINTES

- Travaille sur une branche, pas sur main. main doit rester fonctionnel.
- Pas de build, pas de node_modules en production, pas de CDN.
- Aucune logique de règle en dehors de engine.js.
- Décide seul sur tout ce qui est technique, documente en une ligne.
  Ne me pose une question que si elle change une règle du jeu ou risque
  de détruire des données. Une question maximum par message.
```

---

## Ce que tu dois savoir pour arbitrer, si on te pose une question

**Trois valeurs par défaut appliquées, à confirmer un jour :**

| Point | Défaut retenu |
|---|---|
| Chaînage de la reprise | Illimité |
| Compteur punitif après pénalité | Remis à 0 |
| Égalité parfaite en fin de partie | Le déclencheur gagne |

**Le §3 dans son ensemble n'a pas encore été validé à une vraie table.** Le protocole de partie test est dans le dossier. Si une règle change après ta soirée, elle prime sur tout code déjà écrit — et le moteur est fait pour encaisser ça sans réécriture.

**Repères d'équilibre attendus**, à 4 joueurs : environ 105 tours par partie, 65 % de tours valides, 6 % de Z+, 28 % de Z, 5 pénalités de -1000, reprise proposée dans 65 % des tours et rentable dans 18 %. Un écart d'un facteur deux signale une règle mal implémentée.

**Ce que tu dois enregistrer toi-même** : 13 fichiers MP3 courts, avec les gens qui jouent. Six variantes de Z, trois de Z+, trois de pénalité, une seule de victoire. Les deux sons actuels viennent de Myinstants et doivent être supprimés du dépôt.
