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

## Lot 19 — 2026-09-21 · à pousser

**Un tour sur six ne faisait aucun bruit, depuis le début.**

- L'application créait un élément `<audio>` par fichier, 26 au total, et n'en déverrouillait qu'un seul, le premier. iOS attache l'autorisation de lecture à l'élément, pas à l'application : les vingt-cinq autres ne pouvaient pas jouer. Seul `z-01` sortait, soit un Z sur six.
- Invisible depuis un ordinateur, où tout joue sans rien demander. Invisible aussi pour les tests, qui ne couvraient pas la lecture : le fichier disait « aucune logique ici, uniquement du branchement ».
- Désormais un seul élément, réutilisé pour tous les sons. Le canal unique devient gratuit, il n'y a plus qu'une voix possible, et la limite d'éléments audio d'iOS ne peut plus être atteinte.
- Le déverrouillage ne dépend plus d'aucun fichier : 0,02 seconde de silence écrite dans la page, 204 octets. Il ne peut plus échouer faute de réseau.
- Changer la source ne télécharge rien : le service worker a déjà tous les sons.
- `tests/lecture-sons.test.js` : huit garde-fous sur un faux élément audio. Un seul élément créé quels que soient les sons, le déverrouillage porte sur celui qui jouera, et un refus du navigateur n'interrompt pas la partie.
- `VERSION` incrémentée.

**Ce qui n'a pas été fait.** Rien ne mesure le taux de réussite réel sur l'appareil. La preuve reste une partie jouée sur l'iPhone.

---

## Lot 18 — 2026-09-21 · à pousser

**Les sons pesaient dix fois leur poids utile.**

- 40 fichiers convertis en AAC 48 kbit/s mono, avec `afconvert`, livré avec macOS. Mesure avant et après, sur les fichiers du dépôt : 2688 ko puis 1001 ko.
- Le contenu ne change pas, seul l'encodage. Les treize sons d'origine étaient en 128 kbit/s stéréo pour des effets de cinq secondes joués sur le haut-parleur d'un téléphone.
- Extension `.m4a`. Safari lit l'AAC dans un élément `<audio>` comme il lit le mp3, et c'est toujours un élément `<audio>`, jamais la Web Audio API, que le bouton silence de l'iPhone coupe.
- Le sac et le précache ne changent que d'extension. Un contrôle vérifie que chaque son déclaré existe bien sur le disque avant d'écrire quoi que ce soit.
- `VERSION` incrémentée.

**Ce qui n'a pas été fait.** Aucune égalisation de volume. Les fichiers viennent de sources différentes et n'ont pas le même niveau : ça s'entend plus qu'un débit bas, mais `afconvert` ne sait pas le corriger et rien d'autre n'est installé sur la machine.

---

## Lot 17 — 2026-09-21 · à pousser

**Un seul sac de sons, tiré au hasard, pour les quatre thèmes.**

- La voix n'appartient plus au thème. Le Z, le Z+ et la pénalité tirent dans la même liste de 38 fichiers. La victoire garde les siens, 2.
- Les fichiers sont renommés `son-01` et suivants, dans un ordre tiré au hasard : leur nom ne dit plus à quel événement ni à quel thème ils appartenaient. Le dossier `sons/matrix/` disparaît, tout est à plat.
- `docs/adr.md` ADR-9 disait l'inverse et passe en Remplacé. ADR-14 prend la suite.
- Le tireur ne rejoue jamais le même fichier deux fois de suite pour un même événement. Avec un sac plus grand, la répétition immédiate devient encore moins probable.
- `tests/sounds.test.js` ne fige plus aucun nombre de fichiers. Il vérifie des propriétés : tout son déclaré existe sur le disque, tout fichier posé dans `sons/` est joué, et aucun son de victoire ne peut sortir ailleurs.
- `VERSION` incrémentée.

**Ce qui n'a pas été fait.** Aucune compression. Le poids des sons reste celui d'avant, et le point ouvert du §14 sur l'origine des fichiers reste ouvert.

---

## Lot 16 — 2026-09-21 · à pousser

**Le compteur punitif parle enfin comme la table : trois cases Z, cochées.**

- Les pastilles rondes et le décompte « 2 / 3 » disparaissent. À leur place, trois cases portant la lettre Z, cochées au fur et à mesure. Un Z en coche une, un Z+ en coche deux, puisqu'il compte double.
- Même changement dans le tableau des scores : les mots « 2 points punitifs » deviennent les mêmes cases, en plus petit. C'est le seul endroit où l'information apparaissait en toutes lettres.
- Les quatre thèmes sont servis par une seule règle. La case cochée se remplit d'un calque de la couleur du texte à 22 % au lieu d'un aplat : la lettre reste lisible sur n'importe quel fond, sans que le compteur ait à connaître la couleur du bloc.
- Coché et non coché diffèrent par le trait, plein contre pointillé, pas seulement par la couleur.
- Les cases sont muettes pour les lecteurs d'écran, qui entendent le compte une seule fois : « 2 Z sur 3 ». Sans cela, ils auraient lu « Z Z Z » sans dire lesquels sont cochés.
- Tailles en rem et em, pas en pixels : le garde-fou du lot 6 l'a attrapé au premier essai, les cases suivent maintenant le réglage de taille de texte d'iOS.
- La page Règles suivait l'ancien vocabulaire. Elle dit maintenant « un Z coche une case, un Z+ en coche deux ».
- `tests/cases-z.test.js` : cinq garde-fous, dont le comptage réel de la fonction prise dans `js/ui.js`, pas recopiée.
- Tests : 196 au vert, contre 191 au lot 15. `VERSION` passée à `zilch-v20`.

**Ce qui n'a pas été fait.** Aucune décision dans `docs/adr.md` : c'est un changement de vocabulaire d'affichage, pas de structure. Le moteur n'a pas bougé, le compteur est toujours en points.

---

## Lot 15 — 2026-09-21 · à pousser

**Un quatrième thème, WordArt, et la règle qui l'empêche de nuire.**

- Bureau turquoise, panneaux gris en relief, titres arc-en-ciel biseautés. Police Anton embarquée, licence OFL, 18,6 ko mesurés sur le fichier du dépôt.
- Règle tenue partout : l'arc-en-ciel ne touche que le décoratif. Le total du joueur actif, les scores du tableau, l'affichage de saisie et les chiffres de statistiques restent pleins et opaques. Un dégradé découpé sur un texte en rend la couleur transparente : sur un score, il ne resterait qu'un contour. Décision en `docs/adr.md`, ADR-13.
- Contrastes mesurés avant écriture, seuil 4,5:1 : noir sur panneau 11,54, blanc sur bleu 16,01, jaune du total sur bleu 11,41, bleu des scores sur panneau 8,80. Deux couleurs tombaient sous le seuil en texte, le rouge à 3,24 et le vert à 4,44 : deux variantes réservées au texte ont été ajoutées, 5,03 et 5,83.
- Aucune animation ajoutée. Le relief et le biseau sont des ombres empilées, peintes une fois. 105 tours par partie, rien de plus à faire tourner.
- Pas de voix dédiée. Le thème reprend les sons d'origine, comme le thème tableau. Treize fichiers de plus auraient pesé 1,9 Mo au précache, et la question des sons du §14 reste ouverte.
- `tests/wordart.test.js` : sept garde-fous, dont l'interdiction du dégradé sur un chiffre et le calcul de contraste relu depuis le CSS.
- Précache : deux fichiers de plus, la police 18,6 ko et l'icône 1,3 ko. `VERSION` passée à `zilch-v19`.
- Tests : 191 au vert, contre 184 avant le lot. `node tests/simulate.js` inchangé, 65,3 % de tours valides, 6,3 % de Z+, 106 tours par partie, 4,9 pénalités.

**Ce qui n'a pas été fait.** Aucune mesure au navigateur piloté. Le protocole du lot 8 n'a pas été rejoué : le thème ne touche à aucune hauteur ni à aucun espacement de structure, mais les titres sont plus grands, donc la vérification reste due sur l'iPhone.

---

## Lot 14 — 2026-09-20 · `1fefef4`

**Une partie terminée de force pouvait donner une victoire à quelqu'un qui n'a pas gagné.**

- L'écran Historique propose d'effacer une partie. Deux gestes : le premier annonce ce qui disparaît, le second efface.
- `store.deleteGame` refuse la partie en cours. L'arrêter d'abord, sinon l'écran de jeu pointerait vers une partie disparue.
- Les statistiques ne sont pas recalculées à la main : elles n'ont jamais été stockées, elles se refont depuis les parties restantes.
- `tests/suppression-partie.test.js` : la partie en cours est protégée, et les chiffres tombent bien de ce que la partie effacée apportait.

**Ce qui n'a pas été fait.** Aucune corbeille, aucun retour en arrière. Un export avant de faire le ménage reste la seule sauvegarde.

---

## Lot 13 — 2026-09-20 · `3fd06be`

**Une icône par thème, et la limite d'iOS écrite noir sur blanc.**

Entrée écrite après coup : le script du lot précédent l'avait sautée sans le dire, son garde-fou voyant un « Lot 11 » déjà présent dans ce fichier. Le commit porte donc le numéro 11, le journal le numéro 13. Signalé plutôt que réécrit.

- Azulejos sur fond crème, Tableau en Z noir sur orange, Matrix en Z phosphore sur pluie de caractères. Tracées en vecteur, aucune police, aucun fichier extérieur, 18 ko pour les six fichiers après réduction de palette.
- `poserTheme` échange le lien `apple-touch-icon` en même temps que la couleur de barre d'état.
- `tests/icones.test.js` : un thème ajouté sans icône échoue au test.

**Reste à mesurer.** iOS fige l'icône à l'ajout à l'écran d'accueil. Que Safari lise bien le lien posé par le script, et non celui écrit dans la page, n'est documenté nulle part chez Apple. À vérifier sur un vrai iPhone : thème Matrix, ajouter à l'écran d'accueil, regarder l'icône obtenue.

---

## Lot 12 — 2026-09-19 · à pousser

**On monte la table sans quitter l'écran.**

Au premier soir, sans un seul joueur enregistré, l'écran Nouvelle partie affichait « Ajoute d'abord des joueurs » et rien d'autre. Pas de champ, pas de bouton, pas de lien : la seule sortie était la barre du bas, et il fallait deviner l'onglet Joueurs puis revenir. Constat lu dans `rendreNouvelle()`.

- Un champ et un bouton **Ajouter à la table**, dans la carte « Qui joue », toujours visibles. Un joueur créé là entre directement dans l'ordre du tour : l'avoir nommé vaut sélection.
- La touche Entrée ajoute aussi, pour enchaîner quatre prénoms sans viser un bouton entre chaque.
- Un bouton discret **Gérer les joueurs** mène à l'écran complet. Renommer, archiver et supprimer y restent, ils n'ont rien à faire au moment de monter une table.
- Le message de l'écran vide désigne maintenant le champ qui est juste en dessous.

Cinq tests dans `tests/table.test.js`. Aucune règle touchée, aucun fichier ajouté, aucun style nouveau : le champ réutilise ceux de l'écran Joueurs.

**Écarté volontairement.** Renommer et archiver depuis cet écran, qui dupliquerait l'écran Joueurs sur celui qu'on a déjà passé deux lots à dégonfler.

**Signalé, pas corrigé.** Le clavier d'iOS s'ouvre sur cet écran et masque le bas de la page, dont le bouton Démarrer. L'écran défile, donc ce n'est pas le piège du lot 6, où le bouton était inatteignable. À vérifier au protocole du lot 8 avant de le déclarer sans effet.

---

## Lot 11 — 2026-09-19 · à pousser

**Le thème Matrix ouvre une partie comme le film.**

Juste après Démarrer, un écran noir et « Wake up, Neo... » qui s'écrit lettre par lettre en vert, curseur clignotant, en haut à gauche et en petit, comme une ligne de terminal. Uniquement en thème Matrix.

Durée totale 2550 ms, mesurée sur les constantes du code : 15 caractères à 110 ms, puis 900 ms de lecture. Une fois par partie, donc 2550 ms pour environ 105 tours. Le même effet joué à chaque tour aurait coûté 4 minutes 34 par partie.

Trois garde-fous, parce qu'un rideau qui ne se lève pas immobilise le seul téléphone qui détient les scores :

- Un tap n'importe où le lève.
- Un minuteur le lève tout seul si personne ne tape.
- Animations réduites : il ne s'affiche pas du tout. Il ne porte aucune information, donc on le supprime au lieu de le figer, contrairement au flash du Z.

Six tests dans `tests/eveil.test.js` verrouillent ces conditions. Voir **ADR-10**, qui borne le §10 au lieu de le contredire : la règle vise les effets qui se répètent.

**Écarté volontairement.** Le son. Le §14 veut des enregistrements maison et la question de provenance des sons est déjà ouverte : ce n'est pas le moment d'en ajouter un. La pluie de caractères derrière le texte, aussi : le rideau est noir, comme demandé.

---

## Lot 10 — 2026-09-19 · à pousser

**L'application maigrit de ce qu'elle ne joue pas.**

Poids mesurés sur le dépôt après coup, taille réelle des fichiers.

- Les métadonnées de tous les mp3 sont retirées. Le flux audio n'est pas touché, pas un octet réencodé. `sons/zplus-02.mp3` portait à lui seul une pochette d'album de 447 ko pour 5,4 secondes de son, soit 21 % de tout le précache.
- `Claude outputs/` était versionné et servi publiquement, référencé nulle part : retiré.
- L'annexe de la spécification et l'ADR-7 citaient encore l'ancien dépôt avec une majuscule, l'erreur de casse exacte contre laquelle ils mettent en garde. Point ouvert depuis le lot 7, fermé.

Après ce lot : sons du thème par défaut 1640 ko, thème Matrix 188 ko, dépôt entier 2286 ko.

**Écarté volontairement.** Le réencodage en mono 96 kbps, qui ferait tomber les sons du thème par défaut à 893 ko. Il coûte une génération de compression et se juge à l'oreille, pas à la mesure.

**Reste ouvert.** Les treize sons du thème par défaut portent une signature de conversion depuis un conteneur vidéo, et l'un d'eux portait encore l'adresse de sa vidéo source. Ce ne sont probablement pas des enregistrements maison, ce que le §14 exige. L'application est publique. Rien n'a été touché : le point est signalé, pas corrigé.

---

## Lot 9 — 2026-09-19 · `f863c95`

**Un troisième thème, qui change aussi ce qu'on entend et ce qu'on voit derrière.**

Mesures faites dans un navigateur piloté, viewport 375 x 812, encoches de 50 px en haut et 34 en bas, racine forcée à 17 px, bandeau d'installation neutralisé, partie réelle jouée à 4 joueurs. Le protocole n'est pas strictement celui du lot 8 : il mesure les trois thèmes dans les mêmes conditions, le même jour, ce qui rend les colonnes comparables entre elles mais pas avec les chiffres du lot 8.

| Point mesuré | Azulejos | Tableau | Matrix |
|---|---|---|---|
| Écran de partie hors offre, débordement | 0 px | 63 px | 0 px |
| Écran de partie pendant une offre, 4 joueurs | 128 px | 263 px | 159 px |
| Vide sous le bouton Valider | 61 px | 61 px | 61 px |
| Cibles tactiles sous 44 px | 0 | 0 | 0 |
| Boutons interceptés par un autre élément | 0 | 0 | 0 |
| Texte coupé | 0 | 0 | 0 |

Ce qui a changé :

- Un thème **Matrix** : vert phosphore sur noir, angles vifs, halo sur les grands chiffres, police à chasse fixe embarquée. Contrastes calculés avant écriture, le plus bas est à 5,98:1 pour le texte secondaire sur les cartes, le seuil étant 4,5.
- **Une police dans le dépôt**, Share Tech Mono sous licence SIL Open Font License 1.1, 16,5 ko en woff2, avec sa licence à côté. Aucun appel distant, le hors ligne reste entier.
- **Une voix par thème.** `js/sounds.js` porte maintenant un manifeste par thème, et le thème Matrix a ses treize sons dans `sons/matrix/`, fabriqués par synthèse. Le tireur de sons est recréé au changement de thème : ce qu'on entend change dès le tour suivant.
- **Une pluie de caractères** dans un canvas séparé, `js/pluie.js`, derrière tout le contenu et avec les taps neutralisés. Elle ne tourne que sur l'accueil et pendant un flash, et s'efface partout ailleurs. Voir **ADR-9**.
- Le service worker précache les sons de **tous** les thèmes et la police. Un thème changé en mode avion doit sonner, et un oubli ici serait un silence invisible tant qu'il y a du réseau.

Trois corrections trouvées par la mesure, pas à l'œil :

- Le canvas avait d'abord été empilé en passant `position:relative` sur la barre du bas, la feuille de saisie et le flash, qui sont en position fixe. La feuille de saisie repartait alors 764 px plus bas et les touches du pavé tombaient à 39 px, sous le seuil de 44. Seuls les écrans ont besoin d'un contexte d'empilement.
- Le grand total du joueur actif à 3 rem et les lignes de score à 10 px de marge poussaient 186 px de tableau sous le pli. Ramenés à 2,5 rem et 7 px : 159 px.
- Les cinq libellés de la barre du bas se touchaient en chasse fixe. Interlettrage ramené de 0,1 à 0,02 em, taille à 10 px.

160 tests au vert, trois ajoutés : la couverture du précache par tous les thèmes, l'intégrité de chaque voix, et la présence sur le disque de toute police appelée par la feuille de style. Le §17 retombe juste : 65,2 % de tours valides, 6,4 % de Z+, 105 tours par partie, 4,8 pénalités.

**Écarté volontairement.** Une pluie permanente sur tous les écrans, pour la batterie du téléphone qui tient la partie. Une police du système à la place d'une police embarquée, qui aurait vidé le thème de son effet. Des sons téléchargés d'une banque libre, pour ne pas avoir à vérifier une licence par fichier.

**Reste ouvert.** Les sons Matrix sont de la synthèse, pas des enregistrements maison : c'est un écart au §14, assumé dans l'ADR-9, et il ne concerne que ce thème. Sur l'écran de partie pendant une offre à 4 joueurs, Matrix déborde 31 px de plus qu'Azulejos : c'est de l'information de référence, jamais une action, et c'est nettement moins que le thème Tableau.

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
