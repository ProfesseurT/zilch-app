# ZILCH — instructions de travail

À lire en entier avant de toucher au dépôt. Ce fichier ne remplace pas `docs/specifications.md`, il dit comment travailler ici.

---

## 1. Ce qu'est ZILCH

**Le jeu.** Un jeu de dés joué avec de vrais dés, autour d'une table. Premier à atteindre **10 000 points**. L'essentiel des règles :

- Il faut **au moins 250 points** pour marquer un tour. En dessous, rien n'est enregistré. Tout score est un multiple de 50.
- **3 essais** pour franchir ces 250. Au-delà, plus de limite.
- Un lancer blanc au **tout premier jet** donne un **Z+**. Un lancer blanc ailleurs, ou trois essais insuffisants, donnent un **Z**.
- **Main pleine** : les 5 dés mis de côté obligent à relancer. Un tour réussi laisse donc toujours **1 à 4 dés** sur la table.
- Le joueur suivant peut **reprendre** ces dés et ce total, ou repartir de zéro. Les points du précédent lui restent acquis.
- Compteur punitif par joueur : Z vaut 1, Z+ vaut 2. À **3**, pénalité de **-1000**, puis remise à zéro. Le score ne descend jamais sous zéro.
- À 10 000, le **dernier tour** se déclenche : chacun joue une fois de plus, le meilleur score l'emporte.

**L'application.** Un compagnon de score, pas un simulateur. Elle ne demande **jamais la valeur des dés**, seulement le score du tour et le nombre de dés laissés. Un seul iPhone tient la partie. Ni compte, ni serveur, ni synchronisation : tout vit sur l'appareil, en IndexedDB, et l'export JSON est la seule vraie sauvegarde. L'application est installée sur l'écran d'accueil, et doit l'être : hors de l'écran d'accueil, Safari efface tout au bout de 7 jours sans ouverture.

Toutes les constantes de règle vivent dans `CONFIG`, dans `js/engine.js`. **Aucune valeur de règle en dur ailleurs.**

---

## 2. Où est la vérité, dans l'ordre

1. **`docs/specifications.md`** fait autorité. Document unique, il annule tout le reste. Une règle métier explicite y prévaut toujours sur une interprétation.
2. **`docs/adr.md`** garde les huit décisions structurantes et leur coût de réouverture. On ne les re-litige pas sans raison.
3. **`JOURNAL.md`** raconte ce qui a réellement été fait, lot par lot, avec les mesures. C'est là qu'on comprend pourquoi une chose paraît arbitraire.
4. **`README.md`** donne les procédures : tests, déploiement, installation iPhone.
5. **`docs/archive/`** est l'ancienne application. Référence seule. Ne jamais la modifier ni s'en inspirer pour du neuf.

Ne jamais modifier silencieusement une règle pour simplifier le code. Si une contradiction empêche une décision métier fiable, l'isoler et la signaler plutôt qu'inventer.

---

## 3. Comment on travaille ici

- **Reformuler avant d'agir.** Dire ce qu'on a compris, puis faire.
- **Mesurer avant d'affirmer.** Tout chiffre avancé dit d'où il vient et comment il a été obtenu. Une intuition de performance ou d'ergonomie ne vaut rien sans protocole.
- **Signaler, ne pas corriger en douce.** Une incohérence trouvée en chemin se signale. On la corrige seulement si c'est notre propre changement qui l'a rendue fausse.
- **Ted pousse lui-même.** On lui donne la commande, on ne pousse jamais à sa place.
- **Confirmation avant tout geste irréversible.**
- **Pas de jargon de développeur.** Ted est néophyte en informatique et comprend vite : expliquer l'effet, pas la mécanique interne.
- **Aucun tiret cadratin** nulle part, ni dans le code, ni dans les textes, ni dans les réponses.
- Une décision structurante s'écrit dans `docs/adr.md`, le récit du lot dans `JOURNAL.md`, dans le même commit que le code.

---

## 4. Déployer

Le dépôt est `ProfesseurT/zilch-app`, tout en minuscules, publié sur `https://professeurt.github.io/zilch-app/`. Le clone de travail est sur le Mac de Ted, dans `~/Projets/zilch-app`. **C'est la seule copie qui fait foi.** Ne jamais en cloner une seconde pour y travailler en parallèle.

La commande à lui donner, toujours celle-ci :

```
cd ~/Projets/zilch-app
./pousser.sh "ce qui a changé"
```

Le script fait trois contrôles dans l'ordre et s'arrête au premier qui échoue :

1. **`VERSION` en tête de `service-worker.js` a-t-elle changé ?** C'est la seule panne silencieuse du projet : sans nouveau numéro, l'iPhone sert l'ancienne version pour toujours et rien ne le signale. Le script ne l'exige que si un fichier réellement servi hors ligne a bougé. Toucher à `docs/` ou `tests/` n'atteint pas Safari.
2. **`npm test` au vert.**
3. **`git pull --rebase`** avant le push.

Première fois sur une machine : `chmod +x pousser.sh`.

Le dépôt n'a **aucune étape de build** et **aucun `node_modules`**. Modules ES natifs servis tels quels. Aucune bibliothèque distante : tout ce qui est chargé depuis un CDN casse le mode hors ligne.

---

## 5. Vérifier avant de livrer

```
npm test          # 157 tests, tous au vert, sans exception
npm run simulate  # contrôle d'équilibre, doit retomber sur le §17
```

Le simulateur doit sortir environ : 65 % de tours valides, 6 % de Z+, 28 % de Z, 105 tours par partie, 5 pénalités. Un écart net signale une règle mal implémentée, pas un aléa.

**Pour tout changement de mise en page**, mesurer dans un navigateur piloté plutôt que juger à l'œil. Le protocole utilisé au lot 8, à reconstruire si besoin :

- viewport **375 x 812**, la taille d'un iPhone 13 mini, le plus petit modèle encore en service ;
- injecter les encoches à la main, `--hg:50px` et `--bs:34px`, car un navigateur de bureau ne simule pas `env(safe-area-inset-*)` ;
- jouer une vraie partie à 4 joueurs, pas seulement charger la page ;
- relever : débordement de `#e-partie .defile`, vide sous le bouton Valider, cibles sous 44 px, contrastes, texte coupé.

Repères actuels à ne pas dégrader : écran de partie hors offre **0 px** de débordement, avec offre **76 px** à 4 joueurs, vide sous Valider **61 px**, aucune cible sous 44 px, aucun contraste sous le seuil.

Le lot 9 a mesuré les trois thèmes le même jour, dans les mêmes conditions, avec la racine forcée à 17 px : hors offre 0 px pour Azulejos et Matrix, 63 px pour Tableau ; pendant une offre à 4 joueurs, 128 px pour Azulejos, 159 px pour Matrix, 263 px pour Tableau. Ces chiffres se comparent entre eux, pas avec ceux du lot 8. **Une mesure de mise en page se refait sur les trois thèmes**, la chasse fixe du thème Matrix n'occupe pas la même place.

**Deux pièges de mesure.** Le bandeau d'installation ne s'affiche que hors écran d'accueil et pèse plus de 200 px : il fausse toute mesure de l'accueil, il faut le neutraliser. Et `-apple-system-body` n'existe que sur WebKit : la taille de texte du système se simule en forçant la taille de la racine.

---

## 6. Pièges connus, chacun payé une fois

- **Le clavier natif d'iOS** mange environ 300 px. Il cachait Valider sur tous les modèles. D'où le pavé numérique dessiné dans la page. Ne jamais réintroduire un champ numérique natif.
- **La barre de navigation est en position fixe.** Toute zone d'action doit soustraire `--nav-h`, sinon ses boutons passent dessous et deviennent intapables tout en restant visibles.
- **Le verrou d'écran est accordé puis ignoré** dans une application installée, d'iOS 16.4 à 18.3, bug WebKit 254545. L'interface ne promet donc jamais que l'écran reste allumé, elle dit que la demande a été acceptée.
- **Safari et l'application installée sont deux coffres séparés.** Rien de ce qui est enregistré dans l'onglet ne suit dans l'icône.
- **Les sons passent par des éléments `<audio>`, jamais par la Web Audio API** : sur iOS, le bouton silence physique coupe la seconde et beaucoup de joueurs jouent en silencieux.
- **Animations réduites** : une information ne doit jamais dépendre d'un mouvement. Ramener une animation à zéro la fait sauter à son image finale, et le Z devenait invisible.
- **La taille de texte du système** n'atteint une page web que par `-apple-system-body`, bornée ici entre 16 et 21 px. Voir ADR-8. En dessous de 16, iOS zoome sur les champs.
- **`position:relative` décroche ce qui est en position fixe.** Pour empiler le décor du thème Matrix, la barre du bas, la feuille de saisie et le flash avaient reçu `position:relative` : la feuille repartait 764 px plus bas et les touches du pavé tombaient à 39 px. Sur un élément déjà fixe, ne toucher qu'au `z-index`.
- **Toute animation est non bloquante.** Une partie compte environ 105 tours : une seconde et demie bloquante en fin de tour, c'est trois minutes d'attente par partie.

---

## 7. Tranché, à ne pas rouvrir sans instruction

- **Le barème maison** : suite 1-2-3-4-5 vaut **500**, suite 2-3-4-5-6 vaut **750**. Cela diverge des barèmes français courants, qui donnent 1 500 aux deux. C'est voulu, et verrouillé par `tests/bareme.test.js`.
- **Pas de bouton « Repartir de zéro ».** Décidé au lot 3 sur un calcul de gestes : la reprise est proposée dans 65 % des tours et acceptée dans 18 %, donc le bouton ne servait qu'à dire non environ 47 fois par partie. Marquer un score vaut refus, et le refus est bien inscrit dans l'historique.
- **Aucun paramètre de règle dans les réglages.** Ni barème, ni plancher, ni pénalité, ni reprise. Un réglage qui les modifie transforme chaque partie en négociation.
- **Un thème peut changer la police, les sons et le décor**, aux trois conditions de l'**ADR-9** : police embarquée avec sa licence dans `polices/`, un manifeste de sons par thème dans `js/sounds.js` avec tous les thèmes au précache, et un décor qui ne porte jamais d'information et ne s'anime pas pendant une partie.
- **Les trois arbitrages par défaut du §1** : chaînage de la reprise autorisé, compteur punitif remis à 0 après pénalité, égalité parfaite au profit du déclencheur.

---

## 8. Reste ouvert

- Les règles du §3 attendent toujours d'être validées par une partie réelle à une table.
- L'annexe de `docs/specifications.md` cite encore l'ancien dépôt `/Zilch/`, corrigé au §11 mais pas dans l'annexe.
- À 4 joueurs pendant une offre de reprise, la fin du tableau des scores passe sous le pli, 76 px. De l'information de référence, jamais une action. À 2 et 3 joueurs tout tient.
- Les sons du dépôt doivent être des enregistrements maison. Vérifier que c'est bien le cas avant toute diffusion large.
