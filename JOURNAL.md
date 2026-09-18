# ZILCH — Journal de bord

À quoi sert ce fichier, et à quoi il ne sert pas.

`docs/specifications.md` dit ce que l'application **doit** faire. `docs/adr.md` garde les décisions structurantes et leur coût de réouverture. Ce journal-ci raconte ce qui a **réellement** été fait, dans l'ordre, avec les mesures qui ont motivé chaque lot. C'est le fichier qu'on relit pour se rappeler pourquoi une chose est comme elle est alors qu'elle n'a l'air d'aucune décision.

## Règles d'écriture

- Une entrée par lot poussé, la plus récente en haut.
- **Tout chiffre dit d'où il vient.** Une mesure sans son protocole ne vaut rien ici.
- Ce qui a été volontairement écarté est écrit, avec la raison. C'est la moitié utile du journal.
- Une décision structurante va dans `docs/adr.md`, pas ici. Le journal la cite et renvoie vers elle.
- Aucun tiret cadratin dans ce dépôt.

---

## Lot 8 — 2026-09-18 · `6ac1230`

**L'écran tient dans la main, et le texte suit le réglage du téléphone.**

Mesures faites dans un navigateur piloté, viewport 375 x 812, encoches de 50 px en haut et 34 en bas, application en mode installé, partie réelle jouée à 4 joueurs.

| Point mesuré | Avant | Après |
|---|---|---|
| Vide sous le bouton Valider, feuille de saisie | 152 px | 61 px |
| Bas du bouton Valider | 660 px | 751 px |
| Hauteur d'une touche du pavé | 56 px | 69 px |
| Écran de partie hors offre, débordement | 21 px | 0 px |
| Écran de partie pendant une offre, débordement | 191 px | 76 px |
| Cibles tactiles sous 44 px | 1 | 0 |
| Contrastes sous le seuil WCAG AA | 1 | 0 |

Ce qui a changé :

- Le pavé numérique n'est plus plafonné à 300 px, et le bloc du bas de la feuille est collé au bas de l'écran. Valider est enfin sous le pouce.
- **« Annuler » et « Arrêter » ont quitté la zone qui défile pour la barre d'action fixe.** C'était le vrai défaut : pendant une offre de reprise, soit 65 % des tours, le rattrapage passait sous le pli, exactement au tour où l'erreur est la plus probable.
- Le tableau des scores ne répète plus le joueur actif, déjà affiché en grand juste au-dessus. Le §6 demandait déjà « son score total » puis « les scores des autres joueurs ».
- Les tailles de texte et les hauteurs de bouton passent en `rem`, et la racine suit `-apple-system-body`, bornée entre 16 et 21 px. Voir **ADR-8**, qui porte le tableau de mesures par taille.
- Un or éclairci pour le seul onglet actif de la barre du bas : l'or du logo ne tenait que 4,28:1 sur le cobalt foncé en 11 px.
- `tests/simulate.js` portait encore les valeurs de suites inversées corrigées au lot 7. Le contrôle du §17 mentait donc légèrement.

Cinq tests ajoutés, un par acquis, pour qu'aucun ne se reperde. 157 tests au vert. Le §17 retombe juste : 65,4 % de tours valides, 6,3 % de Z+, 105 tours par partie.

**Écarté volontairement.** Le système. Mesuré avant de toucher quoi que ce soit : premier affichage 84 ms, 136 Ko pour la coque, rejeu complet de l'historique 0,05 ms sur 400 évènements, classements 6 ms sur 30 parties. Il n'y avait rien à gagner, et optimiser là n'aurait fait que risquer une régression. Écarté aussi : refaire le choix de reprise en deux gros boutons, décision déjà tranchée au lot 3 sur un calcul de gestes.

**Reste ouvert.** À 4 joueurs pendant une offre, la fin du tableau des scores passe encore sous le pli, 76 px. C'est de l'information de référence, jamais une action. À 2 et 3 joueurs tout tient. L'annexe de `docs/specifications.md` cite encore l'ancien dépôt `/Zilch/`, corrigé au §11 mais pas dans l'annexe.

---

## Lot 7 — 2026-09-18 · `4f3ecb9` et `29020fb`

**Le barème disait faux, et l'interface promettait ce qu'iOS ne tient pas.**

- Les deux suites étaient inversées dans la spec comme dans `DICE_TABLE` : 1-2-3-4-5 vaut 500 et 2-3-4-5-6 vaut 750. Réserve levée sur instruction, valeurs désormais verrouillées par `tests/bareme.test.js`. Ces valeurs divergent des barèmes français courants, qui donnent 1 500 aux deux suites : c'est la règle maison, pas une erreur.
- L'écran de veille ne prétend plus rester allumé. Entre iOS 16.4 et 18.3, une application installée obtient un verrou parfaitement valide et l'écran s'éteint quand même, bug WebKit 254545 corrigé en 18.4. Rien ne permet de détecter ce cas, donc l'interface rapporte ce qu'elle sait : la demande a été acceptée, pas davantage.
- Accessibilité : vrais libellés sur les champs nom et lieu, zones de message annoncées, contraste du texte d'aide remonté de 2,2:1 à 4,6:1.
- La documentation de déploiement citait encore l'ancien dépôt `Zilch` avec une majuscule, l'erreur de casse exacte contre laquelle elle met en garde deux lignes plus bas.
- `pousser.bat` retiré, remplacé par `pousser.sh` : passage au Mac. Le script refuse de pousser si `VERSION` n'a pas bougé alors qu'un fichier servi hors ligne a changé, tire avant de pousser, et demande le message de commit.

---

## Lot 6 — 2026-09-18 · `6343108` et `0b6ced9`

**L'écran de partie ne tenait sur aucun iPhone.**

Mesure de l'époque : la page faisait 1 046 px pour une zone utile de 489 à 686 px selon le modèle. Deux défauts, tous deux invisibles tant qu'on ne mesure pas.

- Le clavier natif d'iOS mange environ 300 px sur les 664 d'un iPhone 14 : le bouton Valider était caché sur **tous** les modèles. Remède : la saisie du score a son propre pavé numérique dessiné dans la page, qui ne redimensionne rien.
- La barre de navigation étant en position fixe, la zone d'action passait dessous : Z, Z+ et « Essai raté » étaient physiquement interceptés, `elementFromPoint` renvoyant une icône de la nav. Remède : ce qui se lit défile, ce qui s'actionne est fixe en bas, et la hauteur de l'écran de partie soustrait `--nav-h`.

Quatre tests verrouillent ces conditions dans `tests/ecran.test.js`. Ils ne remplacent pas une mesure en navigateur, ils empêchent le défaut de revenir.

L'écran reste allumé pendant une partie affichée, et seulement là : tenir le verrou sur l'accueil viderait la batterie sans rien rendre.

---

## Lots 1 à 5 — 2026-09-02

Reconstitué depuis les messages de commit, ces lots sont antérieurs à ce journal.

| Lot | Commit | Objet |
|---|---|---|
| 1 | `36040ea` | L'application cesse de mentir |
| 2 | `dc07661` | Les données cessent de disparaître en silence, plus mode éphémère et passerelle Safari vers application installée |
| 3 | `a64f9e9` | La saisie cesse de coûter des gestes, plus compaction de l'écran de partie |
| 4 | `d0335f4` | Gestion des joueurs et statistiques complètes du §7 |
| 5 | `1318854` | Le son suit le résultat du tour, pas la touche pressée |

---

## Phases 0 à 6 — 2026-09-01 et 2026-09-02

La construction initiale, suivant le plan du §18 de la spécification.

| Phase | Commit | Livrable |
|---|---|---|
| 0 à 2 | `0448c53` | Moteur, store, idb, sons, spec, ADR. 77 tests au vert |
| 3 | `0ab1b61` et `746906b` | Persistance, migration réelle depuis `localStorage`, banc d'essai sur iPhone |
| 4 | `2cf437e`, `7fa4774`, `fbcfd16`, `016ff97` | Interface complète, identité azulejos, second thème Tableau, un tour égale un son |
| 5 | `28ec82d` | Installable et hors ligne |
| 6 | `84d9714` | Finition des animations |
