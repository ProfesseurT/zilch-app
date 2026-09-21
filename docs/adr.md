# ZILCH — Décisions d'architecture

Neuf décisions structurantes, les sept premières prises pendant la spécification. Chacune est réversible à un coût précis, indiqué en fin de fiche. Ce document sert à ne pas les re-litiger sans raison, et à savoir quoi rouvrir si le contexte change.

**Déciders :** Ted (produit et arbitrage), Claude (proposition et mesure)

---

# ADR-1 : Compagnon de score plutôt que jeu de dés

**Statut :** Accepté · **Date :** 2026-09-01

## Contexte

ZILCH accompagne un jeu joué avec de vrais dés autour d'une table. La question était de savoir si l'application devait connaître les dés, et à quel niveau de détail. Trois modèles de saisie ont été mesurés sur une partie type de 105 tours.

## Décision

L'application ne demande **jamais la valeur des dés**. Elle reçoit le score total du tour, plus le nombre de dés laissés sur la table.

## Options considérées

### Option A — Saisie de la valeur des dés

| Dimension | Évaluation |
|---|---|
| Actions par partie | **765** |
| Fiabilité des règles | Maximale, triche impossible |
| Rapidité d'usage | Rédhibitoire |

**Pour :** l'application calcule tout, applique n'importe quel barème, arbitre les désaccords de table.
**Contre :** une action toutes les 2,3 secondes pendant 30 minutes. Plus lent qu'un crayon.

### Option B — Saisie de la combinaison gardée

| Dimension | Évaluation |
|---|---|
| Actions par partie | 174 |
| Fiabilité des règles | Bonne, arbitrage possible |
| Rapidité d'usage | Acceptable |

**Pour :** rend les paramètres de barème réellement fonctionnels ; tranche le désaccord classique sur le brelan obtenu en un ou deux lancers.
**Contre :** une grille de combinaisons à afficher et maintenir ; complexité d'interface sur l'écran le plus critique.

### Option C — Saisie du score du tour *(retenue)*

| Dimension | Évaluation |
|---|---|
| Actions par partie | **105**, plus une pour les dés restants |
| Fiabilité des règles | Partielle : plancher, essais, pénalité, fin de partie |
| Rapidité d'usage | Excellente |

**Pour :** le plus rapide autour d'une table ; l'application reste un compagnon, pas un arbitre.
**Contre :** le barème du §3.11 ne sert à rien en V1 ; une erreur d'addition humaine n'est pas rattrapée.

## Analyse

Le concurrent réel n'est pas une autre application, c'est une feuille de papier. Une application plus lente que le papier ne sera pas utilisée, quelles que soient ses fonctionnalités. L'option A est éliminée par l'arithmétique. Entre B et C, C a été retenue parce que le besoin exprimé était la conservation de l'historique et les statistiques, pas l'arbitrage.

Une validation faible subsiste gratuitement : tout score de tour est un multiple de 50, ce qui attrape les fautes de frappe.

## Conséquences

- L'écran de partie reste très simple et très rapide.
- Le barème doit être une **table de données de référence**, jamais dispersé dans le code, pour qu'un futur module de calcul puisse arriver sans réécriture.
- Aucun paramètre de barème ne doit apparaître dans les réglages : il ne modifierait aucun comportement.

**Coût de réouverture :** moyen. Passer à l'option B ajoute une couche de saisie devant le moteur, sans le modifier.

---

# ADR-2 : Modèle événementiel et rejeu intégral

**Statut :** Accepté · **Date :** 2026-09-01

## Contexte

Le §6 exige une annulation qui restaure exactement l'état précédent : score, joueur actif, compteur punitif, pénalité, compteur d'essais, dés laissés, choix de reprise, état de partie. Le §7 exige des statistiques recalculables après coup.

## Décision

L'état d'une partie **n'est jamais stocké**. Seule est conservée la liste ordonnée des événements atomiques. Tout état est obtenu en rejouant cette liste depuis le début.

## Options considérées

### Option A — État courant stocké, annulation par compensation

| Dimension | Évaluation |
|---|---|
| Complexité | Faible au début, croissante |
| Fiabilité de l'annulation | **Mauvaise** |

**Pour :** immédiat à écrire, lecture directe.
**Contre :** chaque nouvelle règle exige sa propre logique d'annulation. Annuler un tour ayant déclenché une pénalité et le plancher à zéro devient un cas particulier ; annuler une reprise en devient un autre. C'est la source classique des bugs de score irrattrapables.

### Option B — Journal d'événements et rejeu *(retenue)*

| Dimension | Évaluation |
|---|---|
| Complexité | Moyenne, constante |
| Fiabilité de l'annulation | **Exacte par construction** |

**Pour :** annuler consiste à retirer le dernier événement et à rejouer ; aucune logique d'annulation à écrire, jamais. Les statistiques se recalculent. Un bug de score corrigé plus tard corrige rétroactivement l'historique.
**Contre :** un rejeu à chaque lecture d'état.

## Analyse

Le coût du rejeu est négligeable : une partie compte environ 105 événements, et la boucle est de l'arithmétique pure. Le bénéfice est structurel — la complexité de l'annulation ne croît pas avec le nombre de règles, alors que huit changements de règles ont eu lieu pendant la seule phase de spécification.

## Conséquences

- L'annulation est gratuite et exacte, y compris sur les cas composés.
- Les statistiques ne sont jamais persistées, donc jamais fausses ni à migrer.
- La couche de stockage n'écrit que des événements : le format est stable même si les règles changent.
- Un garde-fou est nécessaire si l'historique devenait très long, ce qui n'arrive pas à cette échelle.

**Coût de réouverture :** élevé. C'est la décision la plus structurante du projet.

---

# ADR-3 : Moteur métier isolé de tout

**Statut :** Accepté · **Date :** 2026-09-01

## Contexte

L'application existante calcule dans les gestionnaires de boutons. Les règles ont changé huit fois pendant la spécification et changeront encore après la partie test.

## Décision

Le moteur (`engine.js`) ne connaît **ni le DOM, ni le stockage, ni le réseau, ni les dés**. Il reçoit des commandes, renvoie un état. Il est exécutable et testable avec `node --test`, sans navigateur.

## Analyse

La validation empirique est arrivée d'elle-même : quand la règle du Z+ a été redéfinie — d'un lancer blanc quelconque à un premier lancer uniquement — **les 42 tests sont restés au vert sans qu'une ligne du moteur ne bouge**. Savoir *quand* un lancer blanc devient un Z+ est une règle de table ; le moteur ne reçoit qu'un bouton pressé.

Le changement suivant, en revanche, a bien touché le moteur : puisque le Z+ n'est plus légal que dans un état précis, le moteur peut désormais le **refuser** après un essai raté ou pendant une reprise. Il attrape deux des trois cas d'erreur possibles. Le troisième — un lancer blanc après un dépassement de 250 sans essai raté préalable — reste invisible pour lui, et c'est documenté plutôt que masqué.

## Conséquences

- Une règle peut changer sans toucher à l'interface, et réciproquement.
- Les tests s'exécutent en une seconde, sans navigateur ni installation.
- Le moteur est réutilisable tel quel si l'application change de forme.
- L'interface doit griser les boutons que le moteur refuserait, plutôt que d'attendre l'erreur.

**Coût de réouverture :** aucun intérêt à rouvrir.

---

# ADR-4 : Stockage local uniquement, sans compte ni serveur

**Statut :** Accepté · **Date :** 2026-09-01 · **Remplace :** une architecture Supabase avec compte facultatif

## Contexte

Trois positions successives ont été tenues : backend Supabase avec comptes, puis compte facultatif, puis abandon complet. Contraintes : budget nul, solutions pérennes et vérifiées, application utilisée quelques soirées par mois.

## Décision

**Aucun compte, aucun serveur, aucune synchronisation.** IndexedDB est la source de vérité, l'export JSON est la sauvegarde.

## Options considérées

### Option A — Supabase avec compte facultatif

| Dimension | Évaluation |
|---|---|
| Complexité | **La plus élevée des trois** |
| Coût | Gratuit, avec réserves |
| Pérennité | **Incertaine** |

**Contre, vérifié :** les projets gratuits sont mis en pause après 7 jours d'inactivité, avec un réveil manuel d'une trentaine de secondes — exactement le rythme d'usage de ZILCH. Le serveur d'e-mails par défaut refuse de livrer à toute adresse extérieure à l'équipe du projet et plafonne à deux messages par heure, donc personne d'autre que le propriétaire ne peut créer de compte. Un compte facultatif exige en outre le local **et** le distant **et** la synchronisation **et** la résolution de conflits : c'est plus de travail que l'un ou l'autre séparément.

### Option B — Local seul avec export JSON *(retenue)*

| Dimension | Évaluation |
|---|---|
| Complexité | Faible |
| Coût | Nul, définitivement |
| Pérennité | Bonne, sous conditions |

**Contre :** rien ne survit à la perte du téléphone sans export.

## Analyse

Le compte ne rendait pas l'application multi-joueurs : un seul iPhone tient le score, les autres joueurs sont des noms dans une base, pas des utilisateurs. Sa seule fonction réelle était la sauvegarde — que l'export JSON assure pour zéro infrastructure.

Trois faits vérifiés sur iOS déterminent les garde-fous : Safari supprime tout le stockage d'un site après 7 jours sans interaction ; les applications installées sur l'écran d'accueil échappent à cette règle et disposent de leur propre compteur d'usage ; depuis iOS 17 toute origine est en mode « meilleur effort » et peut être évincée si l'appareil manque d'espace.

## Conséquences

- **L'installation sur l'écran d'accueil devient obligatoire**, imposée par un avertissement dans l'application, et non recommandée dans un README.
- `navigator.storage.persist()` doit être appelé à **chaque** lancement.
- L'export est **proposé automatiquement en fin de partie** : une sauvegarde qu'il faut penser à déclencher n'est jamais faite.
- Aucune donnée personnelle de tiers n'est stockée — des prénoms, rien de plus. Charge réglementaire quasi nulle.
- Tous les identifiants sont générés côté client en UUID, pour qu'un backend reste possible plus tard sans migration.

**Coût de réouverture :** faible, grâce aux UUID et au journal d'événements, tous deux directement synchronisables.

---

# ADR-5 : JavaScript natif sans étape de build

**Statut :** Accepté · **Date :** 2026-09-01

## Contexte

L'application existante est un fichier `index.html` unique, sans outillage. La spécification demande des tests, du typage, IndexedDB et un déploiement GitHub Pages. Le mainteneur n'est pas développeur.

## Décision

Modules ES natifs, `node --test`, typage par annotations JSDoc, aucune dépendance installée. Toute bibliothèque tierce est copiée dans le dépôt.

## Options considérées

### Option A — TypeScript, Vite, Vitest

| Dimension | Évaluation |
|---|---|
| Complexité | Moyenne |
| Familiarité de l'équipe | **Nulle** |
| Maintenance | Chaîne d'outils à suivre |

**Pour :** typage strict, écosystème confortable.
**Contre :** un `node_modules`, une configuration de sous-chemin `/zilch-app/`, des dépendances qui vieillissent, et une chaîne indéboguable par le mainteneur si elle casse dans six mois.

### Option B — JavaScript natif *(retenue)*

**Pour :** rien à installer, rien à construire, GitHub Pages sert le dépôt tel quel. N'importe qui — humain ou IA — reprend le projet sans contexte.
**Contre :** pas de noms de fichiers versionnés automatiquement, et le typage JSDoc ne protège que dans un éditeur configuré, que le mainteneur n'ouvrira pas.

## Analyse

Le moteur fait quelques centaines de lignes de logique pure. Le typage apporte beaucoup sur cinquante mille lignes, presque rien ici. **Ce qui protège réellement, ce sont les 77 tests**, et ils tournent sans aucune dépendance.

## Conséquences

- **Contrepartie critique** : sans build, le service worker sert indéfiniment l'ancienne version. Une constante de version en tête du service worker, incrémentée à chaque déploiement, avec purge des caches obsolètes à l'activation, devient obligatoire — et son oubli est silencieux.
- Le chemin de déploiement doit respecter la casse exacte du dépôt : `/zilch-app/`, tout en minuscules.
- Aucun CDN, sous peine de casser le mode hors ligne.

**Coût de réouverture :** faible. Ajouter un build plus tard n'invalide aucun code écrit.

---

# ADR-6 : Persistance en deux couches

**Statut :** Accepté · **Date :** 2026-09-01

## Contexte

IndexedDB n'existe que dans un navigateur, donc tout code qui l'utilise échappe aux tests automatiques. Or la persistance porte la migration des données existantes, l'export et l'import — exactement les endroits où une erreur détruit des données.

## Décision

Séparer une **couche mémoire** (`store.js`), qui contient toute la logique et se teste sans navigateur, d'un **adaptateur** (`idb.js`) mince et sans logique, vérifiable uniquement sur appareil.

## Analyse

L'adaptateur est le seul fichier non testé du projet, et cela est assumé et documenté. Il ne fait que charger, sauver, demander la persistance et détecter l'installation. Tout le reste — validation, fusion, migration, calcul des statistiques — est couvert par 23 tests.

Effet de bord utile : la couche mémoire fait **valider chaque action par le moteur avant enregistrement**. Une saisie refusée n'entre jamais dans l'historique.

## Conséquences

- La partie risquée du code est testée ; la partie non testable est triviale.
- La migration depuis `dixmille_compagnon_v1` est aujourd'hui un **squelette défensif** : la forme réelle des anciennes données n'a jamais pu être inspectée. Elle préserve les noms, survit aux données corrompues, et conserve chaque ancienne partie intacte dans un champ `legacyRaw`. **Elle doit être complétée avec les vraies données sous les yeux.**
- L'ancienne clé `localStorage` n'est jamais effacée après migration.

**Coût de réouverture :** faible.

---

# ADR-7 : Sons par pool de variantes, tirage sans répétition

**Statut :** Accepté · **Date :** 2026-09-01

## Contexte

Les sons sont l'identité du jeu. La demande initiale était un fichier par événement, puis des variantes aléatoires.

## Décision

Chaque événement dispose d'un pool de variantes. Le tirage **ne rejoue jamais deux fois de suite la même variante**. La victoire fait exception avec une variante unique.

## Analyse

La fréquence des événements varie d'un facteur trente sur une partie de 105 tours : environ 30 Z, 7 Z+, 5 pénalités, 1 victoire. L'effort d'enregistrement doit suivre cette distribution, pas être réparti uniformément.

Le hasard seul ne suffit pas. Avec six variantes et trente occurrences, le même son de Z tomberait cinq fois par partie juste après lui-même — et la répétition immédiate est la seule que l'oreille remarque autour d'une table. La règle d'exclusion du dernier joué ramène ce nombre à zéro : **six sons avec la règle valent mieux que douze sans**.

La victoire, entendue une seule fois par partie, gagne à rester unique : plusieurs variantes diluent une signature au lieu de l'enrichir.

## Conséquences

- Treize fichiers à enregistrer : 6 Z, 3 Z+, 3 pénalités, 1 victoire.
- **Variété à l'intérieur d'un événement, contraste entre événements.** Si la table doit regarder l'écran pour savoir ce qui vient de se passer, les sons ont échoué.
- Éléments `<audio>` obligatoires : sur iOS, un son joué via Web Audio est coupé par le bouton silence physique de l'iPhone.
- Tous les fichiers doivent être préchargés par le service worker, sinon la première partie hors ligne est muette.
- Les sons actuels, issus de Myinstants, doivent être remplacés : le site ne revendique pas la propriété de son contenu et interdit la redistribution commerciale.

**Coût de réouverture :** nul. Ajouter un son se fait en deux gestes.

---

# ADR-8 : La taille du texte suit le réglage iOS, entre deux bornes

**Statut :** Accepté · **Date :** 2026-09-18

## Contexte

Toutes les tailles de la feuille de style étaient en pixels fixes. Un joueur qui augmente la taille du texte dans Réglages > Affichage ne voyait aucune différence dans ZILCH. Le §12 demande un texte lisible ; il ne disait rien du réglage système.

Sur iOS, ce réglage n'atteint une page web que par une seule porte : la police `-apple-system-body`. Aucune autre technique ne le lit.

## Décision

Au démarrage, l'application mesure `-apple-system-body` sur un élément témoin, **borne le résultat entre 16 et 21 px**, et pose cette valeur sur la racine du document. Toutes les tailles de texte et toutes les hauteurs de bouton sont exprimées en `rem`, donc tout suit.

**La barre de navigation du bas est exclue** et garde des tailles en pixels.

## Options considérées

### Option A — Ne rien faire

**Pour :** aucun risque de régression sur un écran déjà contraint.
**Contre :** un joueur qui a besoin d'un texte plus gros ne peut pas jouer. C'est le seul cas où l'application est inutilisable plutôt qu'imparfaite.

### Option B — Suivre le réglage sans borne

**Pour :** respect intégral du choix de l'utilisateur.
**Contre :** mesuré sur un iPhone 13 mini, à partir de 21 px la zone d'action de l'écran de partie déborde et les boutons Z et Z+ repassent sous le pli. Le remède recrée le défaut corrigé au lot 6.

### Option C — Suivre le réglage, borné à 16-21 px *(retenue)*

| Taille de base | Écran de partie, 4 joueurs, hors offre | Accueil installé |
|---|---|---|
| 16 px | tient | tient |
| 19 px | tient | tient |
| 21 px | 33 px sous le pli | 29 px sous le pli |

**Pour :** couvre l'écart qui compte sans casser l'écran le plus critique.
**Contre :** un utilisateur réglé au-delà de 21 px n'obtient pas tout ce qu'il a demandé.

## Analyse

La borne basse à 16 px n'est pas cosmétique : en dessous, Safari iOS zoome automatiquement sur les champs de saisie, ce qui déplace toute la page.

La borne haute est un arbitrage assumé entre deux besoins d'accessibilité qui se contredisent sur un petit écran : un texte plus gros, et des boutons qui restent atteignables. Le §0 tranche dans cet ordre : fiabilité des règles, rapidité d'usage, conservation des données, ergonomie mobile. Un bouton Z hors d'atteinte coûte plus qu'un texte à 21 px plutôt qu'à 24.

La barre du bas est exclue parce que sa hauteur est verrouillée par `--nav-h`, que l'écran de partie soustrait de sa propre hauteur. La laisser grandir rouvrirait exactement le défaut du lot 6 : la zone d'action passant sous la barre, et ses boutons interceptés.

## Conséquences

- Toute nouvelle taille de texte s'écrit en `rem`, jamais en pixels. Un test le vérifie sur l'ensemble de la feuille de style, barre du bas exclue.
- Le contrôle ne peut pas se faire dans un navigateur de bureau : `-apple-system-body` n'existe que sur WebKit. La mesure se simule en forçant la taille de la racine.
- Les bornes sont deux nombres dans `reglerEchelleTexte`, dans `js/ui.js`.

**Coût de réouverture :** faible. Déplacer une borne est un nombre. Sortir la barre du bas de son exception demande de revoir `--nav-h`.

---

# ADR-9 : Un thème habille aussi la voix et le décor, pas seulement les couleurs

**Remplacé par l'ADR-14 le 2026-09-21 pour la partie sonore.** Le décor reste vrai : la pluie et le rideau appartiennent toujours au thème Matrix.

**Statut :** Accepté · **Date :** 2026-09-19

## Contexte

Les thèmes « Azulejos » et « Tableau » ne changeaient que des couleurs et des formes. Le thème « Matrix » demandait trois choses qu'aucun thème n'avait touchées : une police qui n'existe pas sur l'iPhone, des sons différents, et une animation de fond. Chacune ouvre une question que le projet avait jusque-là évitée.

## Décision

Un thème peut changer trois choses de plus, à trois conditions fermes.

1. **Une police embarquée.** Share Tech Mono, licence SIL Open Font License 1.1, fichier `polices/ShareTechMono-Regular.woff2` de 16,5 ko, avec sa licence à côté dans `polices/OFL.txt`. Aucun appel distant : la règle du hors ligne total tient.
2. **Une voix propre.** `js/sounds.js` porte un manifeste par thème. Les fichiers d'un thème vivent dans leur sous-dossier, ici `sons/matrix/`. Le service worker précache les sons de **tous** les thèmes, pas seulement ceux du thème actif : changer de thème en mode avion doit sonner.
3. **Un décor, jamais une information.** La pluie de caractères vit dans un canvas séparé, `js/pluie.js`, derrière tout le contenu, avec les taps neutralisés. Elle ne s'anime que sur l'accueil et pendant un flash. L'écran de partie garde un fond noir figé.

## Alternatives écartées

**Une police du système à la place d'une police embarquée.** Coût nul, mais l'effet terminal disparaît : c'est précisément ce que le thème vient chercher.

**Une pluie permanente sur tous les écrans.** Plus immersive, mais une partie dure environ 105 tours : une animation plein écran qui tourne du début à la fin chauffe le téléphone qui tient la partie, pour un décor que personne ne regarde pendant qu'il saisit un score.

**Des sons téléchargés d'une banque libre.** Écarté : licence à vérifier à chaque fichier, et le §14 de la spécification veut des sons maison. Les sons Matrix sont fabriqués par synthèse, donc sans licence tierce, mais ils ne sont pas non plus des enregistrements des joueurs : c'est l'écart assumé ci-dessous.

## Analyse

Le §14 de la spécification demande que les sons soient enregistrés par les joueurs eux-mêmes. C'était une réponse à une question de licence et d'identité. Pour un thème de pastiche, un enregistrement maison n'aurait pas de sens : la voix cherchée est celle d'une machine. La synthèse répond au même souci de licence, coût nul et origine claire, sans prétendre remplacer les trois sons d'identité du jeu, qui restent ceux des thèmes Azulejos et Tableau.

Le §12 décrit une identité visuelle unique. Le thème « Tableau » s'en écartait déjà, et cet écart est assumé au même titre.

## Conséquences

- Ajouter un thème sonore : un sous-dossier dans `sons/`, une entrée dans `MANIFESTES`, les fichiers dans le précache. Deux tests le vérifient.
- Ajouter une police : le fichier dans `polices/`, sa licence à côté, un `@font-face` en chemin relatif. Un test vérifie que toute police appelée par la feuille de style est précachée et présente sur le disque.
- Le poids hors ligne de l'application augmente de 169 ko : 16,5 ko de police et 152 ko de sons.

**Coût de réouverture :** faible pour la police et les sons, ce sont des fichiers et une ligne de manifeste. Moyen pour le décor : retirer la pluie demande de reprendre `js/pluie.js`, son canvas et les trois appels dans `js/ui.js`.

---

# ADR-10 : Un thème peut ouvrir une partie par un rideau

## Contexte

Le thème Matrix change déjà la police, les sons et le décor. Il manquait le geste d'ouverture du film : un écran noir et une phrase qui s'écrit. Le §10 de la spécification proscrit les transitions entre écrans, pour une raison chiffrée : une partie compte environ 105 tours, et tout effet chronométré s'y multiplie.

## Décision

Un thème peut afficher un rideau plein écran **au démarrage d'une partie, et seulement là**, à quatre conditions : il ne porte aucune information, un tap le lève, un minuteur le lève tout seul, et il est entièrement supprimé quand les animations sont réduites.

## Analyse

Le §10 vise les effets qui se répètent. Ce rideau ne se joue qu'une fois par partie, soit une fois pour environ 105 tours : son coût cumulé est de 2,6 secondes, contre 4 minutes et 20 secondes pour le même effet joué à chaque tour. La règle du §10 n'est donc pas contredite, elle est bornée.

Le vrai risque n'est pas la durée, c'est le blocage. Un rideau qui ne se lève pas immobilise le seul téléphone qui détient les scores. D'où deux sorties indépendantes, le tap et le minuteur : il faudrait que les deux tombent en panne pour piéger une table.

## Conséquences

- `#eveil` dans `index.html`, son style en fin de `css/zilch.css`, trois fonctions dans `js/ui.js`, six tests dans `tests/eveil.test.js`.
- Ajouter un rideau à un autre thème : une condition de thème et une phrase. Les quatre conditions ci-dessus restent obligatoires.
- Le poids hors ligne n'augmente pas : aucun fichier ajouté.

**Coût de réouverture :** faible. Retirer le rideau, c'est supprimer un bloc dans chacun des trois fichiers et le fichier de tests.

---

# ADR-11 : L'icône d'accueil suit le thème, dans la limite d'iOS

## Contexte

Trois thèmes, une seule icône. Un utilisateur en thème Matrix installait une tuile cobalt.

## Décision

Un fichier d'icône par thème. `poserTheme` échange le lien `apple-touch-icon`, comme il échange déjà la couleur de la barre d'état. Le HTML continue de déclarer `icon-180.png` en dur, qui reste l'icône du thème par défaut.

## Analyse

iOS fige l'icône à l'ajout à l'écran d'accueil. Le choix ne vaut donc que pour les installations à venir, jamais pour celles déjà faites. Ce n'est pas un défaut de l'application, c'est la plateforme. Aucun texte de l'interface ne laisse croire l'inverse.

Le manifeste garde un seul jeu d'icônes, celui du thème par défaut. Android ne relit pas un manifeste modifié en cours de route, et personne ne joue à ZILCH sur Android.

## Conséquences

Deux fichiers de plus au précache, 6 ko. Coût de réouverture faible : supprimer la table `ICONE_SYSTEME` et le test suffit.

# ADR-12 : Effacer une partie, sans corbeille

## Contexte

Une partie interrompue doit parfois etre terminee de force. Elle designe alors un vainqueur qui n'a pas gagne, et ce faux resultat compte dans les statistiques de tout le monde.

## Décision

L'écran Historique peut effacer une partie, définitivement, en deux gestes : le premier annonce ce qui disparaît, le second efface. Pas de corbeille, pas d'annulation.

## Analyse

Une corbeille demanderait un état de plus dans le magasin, un écran pour la vider, et une règle pour les parties à moitié présentes dans les statistiques. Le coût dépasse le besoin : la sauvegarde existe déjà, elle s'appelle Exporter.

La partie en cours est protégée. L'arrêter d'abord, sinon l'écran de jeu pointerait vers une partie disparue.

## Conséquences

Un geste irréversible de plus dans l'application, après la suppression d'un joueur. Même forme, même avertissement chiffré avant d'agir. Coût de réouverture faible.

## Ce qui reste ouvert

| Point | Valeur par défaut appliquée | À trancher par |
|---|---|---|
| Chaînage de la reprise | Autorisé sans limite | La partie test |
| Compteur punitif après pénalité | Remis à 0 | La partie test |
| Égalité parfaite en fin de partie | Le déclencheur gagne | Arbitrage |
| Fréquence de la pénalité (≈ 5 par partie) | Conservée | La partie test |
| Forme réelle des données `localStorage` | Migration défensive | Inspection du dépôt |

# ADR-13 : Un thème décoratif ne touche jamais aux chiffres

**Statut :** Accepté · **Date :** 2026-09-21

## Contexte

Le thème « wordart » repose sur un effet de 1997 : un dégradé arc-en-ciel découpé à la forme des lettres. L'effet est obtenu en rendant la couleur du texte transparente et en laissant apparaître un fond derrière elle. Appliqué à un score, il ne reste plus qu'un contour coloré, lu à bout de bras, à quatre autour d'une table, parfois sous une lampe.

## Décision

Dans tout thème, l'effet décoratif ne s'applique qu'au décoratif : la marque, le nom du joueur, le mot du flash, le nom du vainqueur. Le total du joueur actif, les scores du tableau, l'affichage de saisie, les chiffres de statistiques et le barème restent pleins et opaques.

## Analyse

La règle ne tient pas toute seule : elle est facile à enfreindre en ajoutant une ligne de style. `tests/wordart.test.js` lit chaque règle du thème et refuse `background-clip` ou une couleur transparente sur la liste des sélecteurs qui portent un chiffre.

Deuxième effet du même mécanisme, payé une fois : avec une couleur transparente, une ombre portée classique est peinte transparente elle aussi, donc invisible. Les ombres de ce thème passent par un filtre. Un test le vérifie.

## Conséquences

Un thème peut être aussi chargé qu'il veut, la lecture du score ne dépend pas de son goût. Coût de réouverture faible : supprimer le test et la liste de sélecteurs. Coût réel de la réouverture : un score illisible pendant une partie, constaté à table, pas ici.

# ADR-14 : La voix n'appartient plus au thème

**Statut :** Accepté · **Date :** 2026-09-21 · **Remplace :** ADR-9, partie sonore

## Contexte

Quatre thèmes, deux voix. Le thème Matrix avait la sienne, les trois autres partageaient celle d'origine. Le nombre de sons entendus dans une partie dépendait donc du thème choisi, et deux voix de treize fichiers valaient moins, à l'oreille, qu'un seul sac de vingt-six.

## Décision

Un seul sac. Le Z, le Z+ et la pénalité y tirent tous. Les quatre thèmes entendent la même chose. La victoire garde ses fichiers à part : c'est la signature du jeu, elle sonne une fois par partie et ne doit pas pouvoir sortir sur un Z.

## Analyse

Le prix payé est réel : les bips de synthèse du thème Matrix sonnent maintenant sous les azulejos, et l'inverse. En échange, la répétition immédiate, la seule vraiment perceptible autour d'une table, recule avec la taille du sac.

Le prix moins visible : le Z, le Z+ et la pénalité ne se distinguent plus à l'oreille. La pénalité est l'événement le plus grave, cinq fois par partie, et c'était le seul signal qui traversait la table quand personne ne regardait l'écran. Arbitrage de Ted, pris en connaissance de cause.

## Conséquences

Les noms de fichiers ne veulent plus rien dire, volontairement. Ajouter un son : le déposer dans `sons/`, une ligne dans le sac, une ligne dans le précache. Un test refuse tout fichier posé dans `sons/` et jamais joué.

**Coût de réouverture :** faible. Rendre un événement distinct redemande une liste séparée dans le manifeste et rien d'autre.
