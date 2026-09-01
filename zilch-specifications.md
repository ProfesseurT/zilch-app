# ZILCH — SPÉCIFICATIONS COMPLÈTES

**Document unique et faisant autorité.**
Il annule et remplace toutes les spécifications, notes et addenda antérieurs relatifs à ZILCH.

---

## 0. RÈGLES DE LECTURE

Ce document est la seule référence. Il ne renvoie à aucun document extérieur.

En cas d'ambiguïté résiduelle :

1. une règle métier explicite prévaut sur une interprétation implicite ;
2. ne jamais modifier silencieusement une règle pour simplifier le développement ;
3. si une contradiction rend une décision métier impossible, l'isoler dans le compte rendu final plutôt que d'inventer une règle ;
4. la priorité absolue est : **fiabilité des règles → rapidité d'usage → conservation des données → ergonomie mobile → identité visuelle**.

L'objectif n'est pas un prototype visuel mais une application réellement utilisable.

**Statut du §3 (règles du jeu) : à confirmer par une partie réelle.** Les règles ont été établies par échanges successifs, pas encore validées à une table. Le reste du document est stable.

---

## 1. DÉCISIONS OUVERTES

Trois points ont reçu une valeur par défaut faute d'arbitrage explicite. Chacun doit être un paramètre de configuration modifiable en une ligne, et chacun doit apparaître dans le compte rendu final.

| Point | Valeur par défaut appliquée |
|---|---|
| Chaînage de la reprise | Autorisé sans limite : un joueur qui a lui-même repris peut à son tour laisser des dés au suivant. |
| Compteur punitif après déclenchement de la pénalité | Remis à 0 (et non diminué de 3). |
| Égalité parfaite au sommet en fin de partie | Le joueur ayant déclenché le dernier tour l'emporte. |

---

## 2. VISION PRODUIT

Le nom de l'application est **ZILCH**.

ZILCH est un **compagnon de partie** pour un jeu de dés joué avec de vrais dés physiques. L'application ne simule pas les dés et ne demande jamais la **valeur** des dés.

Elle a en revanche besoin du **nombre de dés restants** en fin de tour, car la règle de reprise en dépend (§3.7).

**Un seul iPhone fait tourner la partie**, celui qui tient le score. Les autres joueurs n'installent rien. Il n'y a ni compte, ni serveur, ni synchronisation : toutes les données vivent sur cet appareil.

Elle sert à :

- créer et suivre des joueurs réutilisables ;
- démarrer une partie et gérer l'ordre des joueurs ;
- enregistrer le lieu de la partie ;
- enregistrer les scores de chaque tour ;
- gérer les événements Z et Z+ ;
- gérer la reprise du tour précédent ;
- appliquer automatiquement les pénalités ;
- calculer les scores cumulés et détecter la fin de partie ;
- conserver les parties et produire des statistiques historiques par joueur ;
- fonctionner très rapidement autour d'une table, sans réseau.

L'expérience est pensée pour des joueurs qui ont les dés devant eux. La saisie doit demander le minimum d'interactions.

---

## 3. RÈGLES DU JEU

### 3.1 Objectif

La partie se joue jusqu'à **10 000 points**.

La valeur 10 000 est une constante de configuration métier centralisée. Aucune valeur magique `10000` ne doit apparaître ailleurs dans le code.

### 3.2 Le plancher de 250 points

Un joueur doit obtenir **au minimum 250 points pour enregistrer un score positif sur son tour**.

Ce plancher s'applique à **chaque tour, pendant toute la partie**. Ce n'est pas un seuil d'ouverture franchi une seule fois.

Un score compris entre 1 et 249 ne peut jamais être validé. L'interface doit l'empêcher et afficher une indication immédiate et lisible (`Minimum 250`), jamais une erreur technique.

Tout score de tour est un multiple de 50. Une valeur qui ne l'est pas est refusée.

Une fois les 250 points atteints, il n'existe aucun plafond : un tour peut valoir plusieurs milliers de points.

### 3.3 Déroulement d'un tour

1. Le joueur dispose de **3 essais maximum** pour atteindre 250 points. Un essai est un lancer de dés.
2. Les points des essais successifs **s'additionnent** à l'intérieur du même tour.
3. Si le **tout premier lancer** du tour ne rapporte aucun point, le tour devient un **Z+**. C'est le seul cas de Z+ du jeu.
4. Dès que le total atteint 250 ou plus, le joueur **peut** s'arrêter et enregistrer son score, ou continuer à lancer les dés restants.
5. Au-delà de 250, le compteur des 3 essais ne s'applique plus. Le joueur peut relancer autant qu'il le souhaite.
6. Un lancer blanc à tout autre moment — 2e ou 3e essai, ou après avoir dépassé 250 — fait perdre **l'intégralité des points du tour** et produit un **Z**.
7. Si les 3 essais sont consommés sans lancer blanc et sans atteindre 250, le tour devient un **Z**.

Le compteur d'essais appartient au tour courant. Il est remis à zéro au changement de joueur et lors de toute annulation ou restauration.

**Interaction attendue** : le joueur signale à l'application chaque essai qui échoue à atteindre 250, par un bouton dédié. Au troisième, l'application déclenche automatiquement un Z. Les essais ne s'appliquent jamais à un tour repris (§3.7.5).

### 3.4 Main pleine — relance obligatoire

Lorsque **les 5 dés ont été mis de côté**, en un ou plusieurs lancers, le joueur réalise une **main pleine**.

Il **doit** alors reprendre les 5 dés et relancer. Il ne peut jamais s'arrêter sur une main pleine, quel que soit son total. Les points déjà accumulés sont conservés et continuent de s'additionner, mais un lancer blanc lui fera tout perdre.

Conséquences à implémenter :

- **Un tour réussi laisse toujours entre 1 et 4 dés sur la table.** Le cas « 0 dé restant » est impossible et ne doit pas exister dans le modèle de données.
- Si la main pleine survient alors que le joueur est encore sous 250, la relance des 5 dés consomme un essai comme n'importe quel autre lancer.
- **La boucle de tour doit être bornée.** Une suite de mains pleines est théoriquement infinie ; prévoir une limite de sécurité afin qu'aucun test ni aucune simulation ne puisse tourner indéfiniment.

### 3.5 Z

**Z = tout tour perdu qui n'est pas un Z+.** Deux cas : les 3 essais ont été joués sans atteindre 250, ou un lancer blanc est survenu après le premier lancer.

Lorsqu'il est enregistré :

- aucun point positif n'est ajouté ;
- un événement `Z` est inscrit dans l'historique ;
- le son Z est joué ;
- le compteur punitif du joueur est mis à jour ;
- aucun dé n'est laissé au joueur suivant ;
- le tour est terminé et le joueur suivant devient actif.

Le Z peut être déclenché manuellement par un bouton, ou automatiquement à l'issue du troisième essai insuffisant. Le comportement est strictement identique dans les deux cas.

Le Z est devenu l'échec courant du jeu : environ 28 % des tours.

### 3.6 Z+

**Z+ = le tout premier lancer du tour, à 5 dés, ne rapporte aucun point.** Le Z+ sanctionne un tour mort-né, pas un tour raté. Un tour repris ne peut jamais produire de Z+ : il commence avec moins de 5 dés.

Lorsqu'il est enregistré :

- aucun point positif n'est ajouté ;
- un événement `Z_PLUS` est inscrit dans l'historique ;
- le son Z+ est joué ;
- le compteur punitif du joueur est mis à jour ;
- aucun dé n'est laissé au joueur suivant ;
- le tour est terminé et le joueur suivant devient actif.

Z et Z+ restent **deux événements métier distincts** dans les données. Ne jamais réduire Z+ à un booléen attaché à Z : l'historique et les statistiques les distinguent.

Le Z+ est rare : environ 6 % des tours.

**Le moteur refuse un Z+ hors de son cas légitime** — après un essai raté, ou pendant un tour repris. L'interface doit donc griser le bouton Z+ dès le premier essai raté et pendant toute reprise. Réserve à connaître : le moteur ne peut pas détecter un lancer blanc survenu après un dépassement de 250 sans essai raté préalable ; dans ce cas seul, l'utilisateur doit choisir Z de lui-même.

### 3.7 Reprise du tour précédent

Lorsqu'un joueur s'arrête volontairement et enregistre son score, il laisse sur la table les dés qu'il n'a pas utilisés — toujours entre 1 et 4.

Le joueur suivant a alors **le choix** :

- **Reprendre** : il repart du total du joueur précédent et lance les dés restants ;
- **Repartir de zéro** : tour normal à 5 dés selon le §3.3.

Règles de la reprise :

1. **Les points du joueur précédent lui restent acquis.** Ils ne lui sont jamais retirés. Le total hérité est une base de départ, pas un transfert.
2. Le joueur qui reprend **doit lancer au moins une fois**. Il ne peut pas encaisser immédiatement le total hérité sans avoir pris de risque. En pratique : le score qu'il enregistre doit être strictement supérieur au total hérité.
3. Un lancer blanc lui fait perdre **la totalité du total, héritage compris**, et produit un **Z**, jamais un Z+.
4. La main pleine s'applique normalement : s'il utilise tous les dés restants, il reprend les 5 dés et doit relancer.
5. Le plancher de 250 est déjà franchi par construction. Le compteur des 3 essais ne s'applique donc pas à un tour repris.
6. Après un Z ou un Z+, il ne reste rien à reprendre : le joueur suivant repart obligatoirement de zéro avec 5 dés.

Le chaînage de la reprise est réglé au §1.

### 3.8 Compteur punitif et pénalité de -1000

Chaque joueur possède un compteur personnel. Les tours des autres joueurs ne l'affectent pas.

| Événement du joueur | Effet sur son compteur |
|---|---|
| Z | +1 |
| Z+ | +2 |
| Score valide (≥ 250) | remise à 0 |

Dès que le compteur **atteint ou dépasse 3**, une pénalité de **-1000 points** est appliquée automatiquement, puis le compteur est remis à 0.

Cette règle unique couvre les quatre séquences punitives du jeu : `Z→Z→Z`, `Z+→Z+`, `Z→Z+` et `Z+→Z`.

La pénalité :

- est un **événement métier distinct** dans l'historique (`PENALTY`), jamais une modification silencieuse du total ;
- déclenche le son de pénalité ;
- est affichée de façon très visible.

### 3.9 Plancher de score à zéro

**Le score cumulé d'un joueur ne peut jamais être négatif.**

Si la pénalité s'applique à un joueur dont le score est inférieur à 1000, le score est ramené à 0. La dette n'est pas reportée sur les tours suivants.

L'événement `PENALTY` enregistre **la valeur nominale (-1000) et la valeur réellement appliquée**, afin que les statistiques restent exactes.

### 3.10 Fin de partie

1. Le premier joueur dont le score atteint ou dépasse **10 000 points** ne gagne pas : il **déclenche le dernier tour**.
2. Tous les autres joueurs jouent alors **un et un seul tour supplémentaire**, dans l'ordre normal, de sorte que chaque joueur ait joué le même nombre de tours.
3. À l'issue de ce dernier tour, **le joueur au score le plus élevé l'emporte**, qu'il ait déclenché la fin ou non.
4. Le déclencheur ne rejoue pas et son score n'évolue plus. Les dés qu'il laisse restent reprenables par le joueur suivant.
5. La pénalité de -1000 s'applique normalement pendant le dernier tour.

Trois états de partie sont nécessaires : `IN_PROGRESS` → `FINAL_ROUND` → `FINISHED`, plus `ABANDONED` pour les parties interrompues.

Pendant `FINAL_ROUND`, l'interface affiche en permanence le **score à battre** et, pour le joueur actif, **l'écart à combler**.

### 3.11 Barème des dés — donnée de référence uniquement

L'application ne demande pas la valeur des dés. Ce barème n'alimente **aucun calcul** en V1.

Il doit être implémenté comme une **table de données de référence**, consultable depuis un écran de règles et prête à alimenter un futur module de calcul automatique. Il ne doit pas être dispersé dans le code.

| Combinaison | Points |
|---|---|
| Un 1 seul | 100 |
| Un 5 seul | 50 |
| Trois 1 | 1 000 |
| Trois 2 | 200 |
| Trois 3 | 300 |
| Trois 4 | 400 |
| Trois 5 | 500 |
| Trois 6 | 600 |
| Suite 1-2-3-4-5 | 750 |
| Suite 2-3-4-5-6 | 500 |

Un brelan ou une suite ne compte que s'il apparaît dans un seul et même lancer.

Il n'existe ni carré, ni quinte, ni full, ni double paire. Quatre dés identiques valent le brelan, plus le quatrième dé compté seul s'il s'agit d'un 1 ou d'un 5.

Réserve documentée, à ne pas corriger sans instruction : les valeurs de suites retenues divergent des barèmes français courants, qui donnent 1 500 aux deux suites. La valeur ci-dessus est la règle maison.

**Ne jamais afficher dans les réglages un paramètre de barème qui ne modifie aucun comportement.**

---

## 4. JOUEURS

Les joueurs sont réutilisables d'une partie à l'autre. Une partie référence des joueurs existants par leur identifiant, elle ne les duplique pas.

Un profil joueur comporte au minimum : identifiant unique stable, nom, date de création, statistiques calculables depuis l'historique.

L'utilisateur peut créer un joueur, en sélectionner plusieurs pour une nouvelle partie, modifier un nom, consulter les statistiques.

Prévoir l'ajout ultérieur d'avatar, couleur et surnom sans surcharger l'interface actuelle.

---

## 5. CRÉATION ET STRUCTURE D'UNE PARTIE

Parcours attendu : **Accueil → Nouvelle partie → Choisir les joueurs → Déterminer l'ordre → Lieu → Démarrer**

Minimum deux joueurs.

Chaque partie possède un identifiant unique et conserve : date et heure de création, date et heure de fin, participants, ordre des joueurs, lieu, tours, événements, scores, gagnant, état.

### Lieu

Détection proposée, jamais obligatoire. Sur iPhone, utiliser la géolocalisation lorsque l'autorisation est accordée. En cas de refus ou d'indisponibilité, la partie démarre et l'utilisateur peut saisir un lieu manuellement.

Le besoin est de retrouver des statistiques du type « parties jouées à Porto », « à la maison », « chez Marc ». Ne pas conserver de coordonnées GPS précises de façon permanente : une implémentation respectueuse de la vie privée est préférable.

---

## 6. ÉCRAN DE PARTIE

C'est l'écran le plus important. Priorité absolue : **lisibilité et vitesse** autour d'une table.

Afficher clairement :

- le joueur actif, identifiable instantanément ;
- son score total ;
- l'écart restant jusqu'à 10 000 ;
- les scores des autres joueurs ;
- la saisie du score du tour ;
- l'état des essais (`Essai 2/3`) et le bouton signalant un essai raté ;
- le bouton de validation ;
- les boutons **Z** et **Z+**, très visibles ;
- l'annulation de la dernière action ;
- pendant le dernier tour, le score à battre.

Grandes zones tactiles adaptées à l'iPhone.

Éviter : petits boutons, menus cachés, modales inutiles, doubles confirmations, transitions lentes, saisie imposant de faire défiler l'écran.

### Saisie du score et des dés restants

Le score du tour est saisi directement en points, au clavier numérique. Jamais la valeur des dés.

À la validation d'un score positif, le joueur indique également **combien de dés il laisse sur la table** : un sélecteur de 1 à 4, sans saisie clavier. La valeur 0 est impossible (§3.4) et ne doit pas être proposée.

Aucun sélecteur n'apparaît lors d'un Z ou d'un Z+.

Gérer : champ vide, zéro, nombre négatif, valeur non numérique, valeur sous 250, valeur non multiple de 50, valeur anormalement élevée. Ne pas brider arbitrairement un score élevé.

### Proposition de reprise

Au début du tour suivant, si des dés ont été laissés, présenter un **choix binaire** en gros boutons, jamais une saisie :

> *Marc laisse 2 dés et 400 points.*
> **Reprendre** — **Repartir de zéro**

Le choix est enregistré dans l'historique du tour, car il conditionne le calcul et l'annulation.

### Enchaînement

Après validation d'un score, d'un Z ou d'un Z+ :

1. enregistrer l'événement ;
2. mettre à jour le score ;
3. appliquer la pénalité éventuelle, plancher zéro compris ;
4. enregistrer les dés laissés ;
5. vérifier le déclenchement du dernier tour ou la fin de partie ;
6. persister l'état ;
7. passer au joueur suivant.

Le changement de joueur doit être visuellement évident, pour éviter qu'un utilisateur saisisse le tour suivant en croyant être encore sur le précédent.

### Annulation

L'annulation doit **réellement restaurer l'état précédent**, pas soustraire le dernier score affiché. Elle restaure : score, joueur actif, compteur punitif, pénalité éventuelle, compteur d'essais, dés laissés, choix de reprise, état de partie, historique.

La méthode retenue est le **rejeu intégral de l'historique d'événements amputé de la dernière action**. C'est ce que fait le moteur de référence, et c'est la seule approche qui garantisse un état identique.

---

## 7. HISTORIQUE ET STATISTIQUES

Toutes les parties terminées sont consultables : date, lieu, joueurs, gagnant, scores finaux, et une vue détaillée des tours et événements.

**Ne pas stocker uniquement le score final.** Conserver assez de données atomiques pour recalculer les statistiques ultérieurement. La source de vérité est l'historique métier ; ne pas persister de statistiques dérivées recalculables.

Par joueur, au minimum : parties jouées, victoires, taux de victoire, score moyen, score moyen par tour positif, plus gros tour, nombre total de tours, nombre de Z, nombre de Z+, nombre de pénalités, série punitive maximale, nombre moyen de tours par partie, adversaires les plus fréquents, lieux les plus fréquents.

Ajouter, du fait de la reprise : reprises tentées, reprises réussies, points gagnés et points perdus en reprise.

Prévoir une vue globale permettant des classements : plus de victoires, meilleur taux, plus gros tour, plus de Z, plus de Z+, plus de pénalités.

---

## 8. STOCKAGE ET SAUVEGARDE

**Il n'y a ni compte, ni serveur, ni synchronisation.** Toutes les données vivent sur l'iPhone qui tient le score. Cette section remplace intégralement toute mention antérieure de backend ou d'authentification.

### 8.1 Où vivent les données

| Couche | Contenu | Rôle |
|---|---|---|
| **IndexedDB** | Joueurs, parties, tours, événements | Source de vérité unique |
| **Fichier JSON** | Copie complète exportable | Seule sauvegarde réelle |

L'application doit fonctionner intégralement hors ligne, sans exception et sans dégradation.

### 8.2 Le risque d'effacement, et comment le traiter

Le stockage local d'iOS n'est pas garanti. Trois faits déterminent l'architecture :

- **Safari supprime tout le stockage écrit par un site après 7 jours sans interaction.** Une partie de ZILCH tous les quinze jours tombe en plein dans cette fenêtre.
- **Les applications ajoutées à l'écran d'accueil échappent à cette règle** : elles ne font pas partie de Safari et disposent de leur propre compteur de jours d'usage, réinitialisé à chaque utilisation.
- **Depuis iOS 17, toute origine est en mode « meilleur effort » par défaut** et peut être évincée, notamment lorsque l'appareil manque d'espace. Le mode persistant se demande via l'API Storage, et la demande doit être renouvelée à chaque ouverture.

Trois mesures obligatoires en découlent :

**1. L'installation sur l'écran d'accueil est obligatoire, pas recommandée.** L'application détecte si elle tourne dans un onglet Safari plutôt qu'en mode autonome, et affiche alors un avertissement bloquant : *ZILCH doit être installé sur l'écran d'accueil, sinon vos données seront effacées au bout de 7 jours.* Avec la procédure d'installation directement à l'écran.

**2. Demander le mode de stockage persistant à chaque lancement**, via `navigator.storage.persist()`. Journaliser le résultat, sans jamais bloquer l'application s'il est refusé.

**3. L'export n'est pas un bouton perdu dans les réglages, c'est le filet principal.** Il est **proposé automatiquement à la fin de chaque partie**, refusable en un tap, et produit un fichier JSON destiné à Fichiers ou iCloud Drive. Une sauvegarde qu'il faut penser à déclencher n'est jamais faite.

Trois gestes détruisent malgré tout les données, et doivent être documentés dans le README : effacer l'historique et les données de sites dans Safari, supprimer l'icône de l'écran d'accueil, réinitialiser l'appareil.

### 8.3 Export et import

Format JSON, couvrant joueurs, parties, événements et historique complet, avec un numéro de version de schéma.

L'import valide le schéma, refuse proprement un fichier invalide, et **n'écrase jamais silencieusement les données existantes** : il fusionne, ou demande confirmation explicite.

### 8.4 Structure de la persistance

Séparer en deux morceaux :

- une **couche mémoire**, testable sans navigateur, qui contient toute la logique de lecture, d'écriture et de migration ;
- un **adaptateur IndexedDB** mince, sans logique, vérifiable uniquement sur appareil.

Le moteur métier ne connaît ni l'un ni l'autre.

### 8.5 Évolution ultérieure

Un backend reste possible plus tard. Pour ne pas se fermer la porte : **tous les identifiants — joueur, partie, événement — sont générés côté client en UUID**, jamais par un compteur incrémental. C'est la seule précaution nécessaire aujourd'hui.

---

## 9. SONS

Trois sons font partie de l'identité du jeu :

| Événement | Nom logique |
|---|---|
| Z | `faaah` |
| Z+ | `fahhhhhhhhhhhhhh` |
| Pénalité -1000 | `faaahhh-3` |

### Les fichiers actuels doivent être remplacés

Les deux sons présents dans le dépôt proviennent de Myinstants. Ce site indique explicitement qu'une grande partie de son contenu provient de tiers et d'utilisateurs, qu'il n'en revendique pas la propriété, et interdit toute redistribution commerciale sans autorisation écrite. Ces fichiers sont par ailleurs déjà publiés dans un dépôt GitHub public, ce qui constitue une distribution.

**Les trois sons doivent être enregistrés par les joueurs eux-mêmes**, au format MP3, et déposés dans le dépôt. Licence claire, coût nul, identité renforcée.

### Contraintes techniques

- **Utiliser des éléments `<audio>`, jamais la Web Audio API.** Sur iOS, un son joué via `AudioContext` est coupé lorsque le bouton silence physique de l'iPhone est activé, alors qu'un élément `<audio>` continue de jouer. Beaucoup de joueurs gardent leur téléphone en silencieux en permanence.
- Supprimer les données audio encodées en base64 dans `index.html` et les remplacer par des fichiers distincts mis en cache par le service worker. L'encodage actuel alourdit le document d'environ un tiers et le fait recharger intégralement à chaque ouverture.
- **Aucun silence en tête de fichier** : couper au premier échantillon, sinon la latence perçue ressemble à un bug.
- **Précharger les trois fichiers** au premier geste utilisateur.
- **Normaliser les trois au même niveau sonore.**
- Tenir compte des restrictions iOS sur l'autoplay : un geste utilisateur préalable initialise l'audio.
- **Une erreur audio ne doit jamais bloquer la logique de la partie.**

---

## 10. ANIMATIONS

**Règle unique et non négociable : aucune animation ne doit bloquer la saisie suivante.** Elle se joue par-dessus l'interface ; le joueur suivant peut agir immédiatement.

Justification chiffrée : une partie compte environ 105 tours. Une animation bloquante d'une seconde et demie en fin de tour représente près de trois minutes d'attente cumulée.

Animations justifiées :

- **Z, Z+, pénalité** — c'est le moment de spectacle du jeu. Court, franc, non bloquant.
- **Changement de joueur** — transition très rapide, sous 200 ms, dont le seul rôle est d'empêcher qu'on saisisse le score du joueur précédent.

Animations à proscrire :

- score qui défile en comptant ;
- transitions entre écrans ;
- tout effet sur les boutons de saisie.

Respecter `prefers-reduced-motion` : un utilisateur qui a désactivé les animations doit avoir une application strictement instantanée.

---

## 11. CIBLE IPHONE ET PWA

Cible principale : **iPhone**. Ne pas concevoir une interface desktop puis la rétrécir.

Prévoir : manifest, `display: standalone`, icônes adaptées, couleur de thème, viewport iPhone, safe areas iOS, comportement correct avec notch et Dynamic Island, plein écran, fonctionnement hors ligne après installation.

Tester au minimum dans un viewport équivalent à un iPhone récent.

### Mise à jour de l'application — point critique

Le projet n'a **pas d'étape de build** (§13), donc pas de noms de fichiers versionnés automatiquement. Sans précaution, le service worker sert indéfiniment l'ancienne version : un correctif poussé sur GitHub Pages n'atteint jamais l'iPhone, sans aucun signal d'erreur.

Obligatoire :

- une **constante de version** en tête du service worker, incrémentée à chaque déploiement ;
- **purge des caches ne correspondant pas à la version courante** lors de l'activation ;
- prise de contrôle immédiate des pages ouvertes ;
- la procédure de déploiement du README rappelle en première ligne d'incrémenter cette version.

### Déploiement GitHub Pages

Le dépôt s'appelle **`Zilch`**, avec une majuscule. Les chemins GitHub Pages étant sensibles à la casse, l'URL réelle est de la forme `https://<utilisateur>.github.io/Zilch/`.

Le base path, le manifest, le service worker et les chemins d'assets doivent utiliser **la casse exacte du dépôt**, sous peine d'échecs silencieux à l'installation et hors ligne. Ne pas supposer un hébergement à la racine.

### Installation iPhone

Procédure courte dans le README : ouvrir l'URL avec Safari → Partager → Sur l'écran d'accueil → installer ZILCH → lancer.

Cette procédure doit également être **affichée dans l'application** tant qu'elle n'est pas installée (§8.2), car l'installation conditionne la survie des données.

---

## 12. IDENTITÉ VISUELLE

Nom affiché : **ZILCH**.

L'identité est très portugaise, assumée, volontairement un peu kitsch. Référence majeure : les **azulejos portugais**.

Pas un simple quadrillage bleu et blanc censé évoquer vaguement des carreaux, mais de vrais motifs traditionnels : ornements, fleurs, arabesques, rosaces, motifs géométriques complexes, répétitions décoratives, bleu cobalt, blanc cassé, éventuellement touches de jaune doré, rouge ou vert.

L'ensemble peut évoquer une vieille façade portugaise, une taverne, une cuisine familiale : chaleureux, populaire, généreux, légèrement kitsch.

**La lisibilité prime.** Les zones fonctionnelles utilisent des surfaces suffisamment opaques ou contrastées devant les motifs.

### Interdits visuels

Interface SaaS générique, dashboard corporate, thème bleu moderne recouvert d'un quadrillage, esthétique fintech, gradients futuristes, néon, imitation de casino, excès d'ombres et de cartes flottantes, interface bourrée de phrases marketing.

### Pas de hero marketing

Aucune prose du type « le jeu qui va révolutionner vos soirées ». L'accueil peut se limiter à **ZILCH** puis aux actions principales.

### Ton de l'interface

Libellés courts, directs, en français : `Nouvelle partie`, `Joueurs`, `Stats`, `Historique`, `Valider`, `Annuler`, `Essai 2/3`, `Minimum 250`, `Reprendre`, `Repartir de zéro`, `Exporter`.

### Réglages

Ce qui a sa place dans les réglages : sons activés et volume, animations réduites, export et import des données, gestion des joueurs enregistrés, objectif de points pour jouer des parties courtes.

**Ce qui n'y a pas sa place : tout paramètre de règle.** Le barème, le plancher de 250, la pénalité et la reprise ne sont pas des préférences. Un réglage qui les modifie transforme chaque partie en négociation.

### Accessibilité

Contraste suffisant, texte lisible, boutons et cibles tactiles larges, focus clavier correct sur desktop, labels accessibles, jamais d'information portée uniquement par la couleur, respect des préférences de réduction des animations.

---

## 13. ARCHITECTURE ET STACK

### Stack retenue : JavaScript natif, sans étape de build

- **Modules ES natifs**, chargés directement par le navigateur. Aucun bundler, aucun transpileur, aucun `node_modules` en production.
- **Tests avec `node --test`**, le lanceur intégré à Node. Aucune dépendance de test à installer.
- **Typage par annotations JSDoc**, vérifiées par l'éditeur. Pas de compilation.
- **Toute bibliothèque tierce est copiée dans le dépôt**, jamais chargée depuis un CDN, sous peine de casser le mode hors ligne.
- GitHub Pages sert le dépôt tel quel.

Ce choix privilégie la pérennité et l'absence de chaîne d'outils à maintenir. Sa contrepartie est traitée au §11 : la gestion des versions du cache devient manuelle et obligatoire.

### Séparation des responsabilités

Séparer clairement : interface, règles du jeu, persistance, audio, géolocalisation, statistiques.

Le **moteur métier est testable indépendamment de l'interface**. Aucune logique de score dans les handlers de boutons. Un moteur de référence conforme au §3 existe déjà, couvert par 46 tests : `engine.js`, `engine.test.js`, `simulate.js`. Le réutiliser plutôt que le réécrire.

Types explicites attendus : `Player`, `Game`, `GameParticipant`, `Turn`, `TurnEvent`, `ScoreEvent`, `ZEvent`, `ZPlusEvent`, `PenaltyEvent`, `CarryOverEvent`.

### Modèle événementiel

L'état de la partie est le **rejeu d'une liste d'événements atomiques** : `SCORE +450 (laisse 2 dés)`, `CARRY_OVER (reprend 400 sur 2 dés)`, `FAILED_ATTEMPT`, `Z`, `Z_PLUS`, `PENALTY -1000`.

Cela rend l'historique fiable, les statistiques recalculables, l'annulation exacte et les bugs de score diagnosticables.

### Qualité

Code lisible, modulaire, maintenable, sans duplication importante, sans logique métier cachée dans les composants visuels, sans dépendances inutiles. Ne pas ajouter une bibliothèque massive pour un problème trivial.

### Performance

Démarrage quasi immédiat, aucune dépendance réseau, interactions instantanées, sons sans latence perceptible, changements de joueur immédiats.

---

## 14. MIGRATION DE L'EXISTANT

Le projet actuel stocke tout dans `localStorage` sous la clé `dixmille_compagnon_v1`.

Migration obligatoire vers IndexedDB. **Aucune partie ni aucun joueur déjà enregistré ne doit disparaître.** Migration simple, explicite, testée, et exécutée une seule fois.

Dette à traiter :

- deux blocs `:root` successifs dans la feuille de style, le premier thème étant intégralement écrasé par le second : supprimer le code mort ;
- sons en base64 dans le HTML : extraire vers des fichiers et remplacer les sources (§9) ;
- absence de versionnement du cache du service worker (§11).

Ne pas reconstruire ce qui fonctionne déjà — la coque PWA, la gestion des joueurs, l'historique et l'identité visuelle sont réutilisables. L'écran de partie doit en revanche être refait pour intégrer les essais, Z, Z+, la pénalité, les dés restants, la reprise et le dernier tour.

---

## 15. CAS LIMITES À GÉRER

- aucun joueur existant ;
- suppression ou modification d'un joueur déjà présent dans un historique ;
- rafraîchissement de la page pendant une partie ;
- fermeture puis réouverture pendant une partie ;
- application ouverte dans Safari au lieu du mode autonome ;
- mode de stockage persistant refusé par le système ;
- refus de géolocalisation ;
- erreur de lecture audio ;
- double clic rapide sur Valider, Z, Z+, Reprendre ou Repartir ;
- score atteignant exactement 10 000 ;
- score dépassant 10 000 ;
- pénalité ramenant le score à 0 ;
- enchaînement théoriquement infini de mains pleines ;
- reprise en attente au moment où la partie bascule en dernier tour ;
- anciennes données issues de `localStorage` ;
- stockage inaccessible ou quota dépassé ;
- import d'un fichier JSON corrompu ou d'une version de schéma inconnue.

---

## 16. TESTS MÉTIER OBLIGATOIRES

Les 46 tests du moteur de référence couvrent déjà l'essentiel. Les reprendre tels quels et les compléter.

**Plancher et essais**

- refus d'un score entre 1 et 249 ;
- refus d'un score qui n'est pas multiple de 50 ;
- validation d'un score de 250 et d'un score supérieur ;
- lancer blanc au 1er essai ⇒ Z+ ; lancer blanc au 2e ou 3e ⇒ Z ;
- Z+ refusé après un essai raté et pendant un tour repris ;
- 3 essais insuffisants ⇒ Z automatique ;
- le compteur d'essais est remis à zéro au tour suivant.

**Main pleine**

- un tour réussi ne laisse jamais 0 dé ;
- les dés laissés vont de 1 à 4 ;
- suite de mains pleines ⇒ la boucle se termine.

**Reprise**

- un Z ou un Z+ ne laisse aucun dé à reprendre ;
- le repreneur ne peut pas encaisser sans ajouter de points ;
- reprise réussie ⇒ le repreneur encaisse le total, le précédent conserve les siens ;
- lancer blanc en reprise ⇒ perte du total héritage compris, Z (jamais Z+) ;
- les 3 essais ne s'appliquent pas à un tour repris ;
- refuser la reprise efface l'offre ;
- chaînage conforme au §1.

**Compteur punitif et pénalité**

- Z ⇒ 1 point punitif ; Z+ ⇒ 2 ;
- deux Z ⇒ aucune pénalité ; trois Z ⇒ pénalité au troisième ;
- deux Z+ ⇒ pénalité au second ;
- Z puis Z+, et Z+ puis Z ⇒ pénalité ;
- un score valide remet le compteur à zéro ;
- les tours des autres joueurs n'affectent pas le compteur d'un joueur ;
- pénalité sur un joueur à 300 points ⇒ score 0, trace `-1000 nominal / -300 appliqué` ;
- pénalité sur un joueur à 0 ⇒ score reste 0.

**Fin de partie**

- franchir 10 000 ⇒ `FINAL_ROUND`, pas `FINISHED` ;
- chaque joueur restant joue exactement une fois ;
- le déclencheur ne rejoue pas mais laisse ses dés reprenables ;
- dépassement du déclencheur pendant le dernier tour ⇒ le dépassant gagne ;
- égalité parfaite ⇒ le déclencheur gagne ;
- pénalité appliquée normalement pendant le dernier tour ;
- aucune commande acceptée après la fin.

**Annulation**

- annulation d'un score, d'un Z, d'un Z+, du Z automatique du troisième essai ;
- annulation d'une reprise ⇒ dés et total du précédent restaurés ;
- annulation d'une pénalité ⇒ score restauré avant application du plancher ;
- annulation du tour déclenchant le dernier tour ⇒ retour en `IN_PROGRESS` ;
- annulation du tour gagnant ;
- une partie complète se rejoue à l'identique depuis son historique.

**Persistance** *(couche mémoire, testable sans navigateur)*

- sauvegarde et restauration d'une partie en cours, reprise en attente comprise ;
- migration depuis `localStorage` sans perte, exécutée une seule fois ;
- export puis import ⇒ données strictement identiques ;
- import d'un JSON invalide ⇒ rejet propre, données existantes intactes ;
- import d'une version de schéma inconnue ⇒ refus explicite.

---

## 17. REPÈRES D'ÉQUILIBRE

Valeurs mesurées en pilotant le moteur de référence sur 4 000 parties complètes à 4 joueurs, avec des dés simulés et une stratégie simple : s'arrêter dès 250 atteints, reprendre lorsque c'est mathématiquement rentable.

| Indicateur | Valeur attendue |
|---|---|
| Tours valides | ≈ 65 % |
| Z+ | ≈ 6 % des tours |
| Z simple | ≈ 28 % des tours |
| Score moyen d'un tour valide | ≈ 540 pts |
| Espérance par tour | ≈ 350 pts |
| Tours par partie (4 joueurs) | ≈ 105 |
| Pénalités -1000 par partie | ≈ 5 |
| Reprise proposée | ≈ 65 % des tours |
| Reprise acceptée | ≈ 18 % des tours |

Dés laissés après un tour réussi : 1 dé ≈ 46 %, 2 dés ≈ 44 %, 3 dés ≈ 5 %, 4 dés ≈ 4 %.

Risque de tout perdre en reprise : 1 dé ≈ 69 %, 2 dés ≈ 45 %, 3 dés ≈ 28 %, 4 dés ≈ 16 %.

Seuils de rentabilité de la reprise, un tour frais valant environ 290 points : reprendre est avantageux au-delà de 1 200 points hérités sur 1 dé, 500 sur 2 dés, et toujours à partir de 3 dés.

Ces repères ne sont pas des règles et ne doivent être codés nulle part. Ils servent de contrôle de cohérence : un écart important signale une règle mal implémentée.

---

## 18. MÉTHODE DE TRAVAIL

Avant toute modification :

1. lire l'intégralité de ce document ;
2. inspecter le projet existant ;
3. identifier la stack, l'architecture et les données persistées ;
4. repérer les assets audio existants ;
5. exécuter les tests du moteur de référence.

Ensuite, dans cet ordre, avec validation humaine entre chaque phase :

| Phase | Livrable | Critère de validation |
|---|---|---|
| 0 · Contexte | Inventaire du dépôt et des contradictions | Compte rendu lu et arbitré, aucun code écrit |
| 1 · Moteur | Règles pures et tests | **Fait** — 46 tests au vert |
| 2 · Équilibre | Simulation de parties complètes | **Fait** — chiffres conformes au §17 |
| 3 · Persistance | Couche mémoire, IndexedDB, migration, export | Partie jouée, app fermée, app rouverte, rien perdu |
| 4 · Interface | Écran de partie | Une partie complète jouée sur iPhone |
| 5 · Sons et PWA | Audio, hors ligne, versionnement du cache | Mode avion, bouton silence activé, mise à jour reçue |
| 6 · Finition | Animations | Une partie ne dure pas plus longtemps qu'en phase 4 |

Ne pas reconstruire inutilement ce qui fonctionne. Refactorer sans hésiter une architecture manifestement fragile lorsque la fiabilité des règles l'exige.

### Autonomie

Prendre seul les décisions techniques raisonnables : nommage, découpage en modules, choix entre deux structures internes équivalentes, écriture d'un test, correction d'un bug évident, mise en responsive.

Lorsqu'un point est ambigu mais non bloquant, choisir l'option la plus cohérente avec ce document et documenter brièvement le choix. Ne bloquer que si une contradiction rend une décision métier fiable impossible.

**Les trois points du §1 ne relèvent pas de cette autonomie** : ils sont déjà tranchés par défaut et doivent apparaître tels quels dans le compte rendu final.

---

## 19. LIVRABLE ATTENDU

Pas seulement une analyse, une roadmap, du pseudocode ou une maquette. **Construire réellement l'application**, lançable et testable.

Fournir : code complet, tests métier, PWA fonctionnelle, persistance, export/import, audio, manifest, service worker versionné, icônes et assets, README, procédure de lancement, procédure de déploiement GitHub Pages.

---

## 20. CRITÈRE DE RÉUSSITE FINAL

Je dois pouvoir :

1. installer ZILCH sur l'écran d'accueil de mon iPhone, guidé par l'application ;
2. créer mes joueurs une fois et les réutiliser ;
3. lancer une partie en quelques secondes ;
4. renseigner le lieu ;
5. voir immédiatement qui joue ;
6. saisir son score et le nombre de dés laissés ;
7. ne jamais pouvoir enregistrer moins de 250 points ;
8. utiliser les trois essais ;
9. déclencher Z ou Z+ rapidement ;
10. me voir proposer la reprise quand elle est possible, et choisir en une pression ;
11. entendre les trois sons, y compris téléphone en silencieux ;
12. voir automatiquement les pénalités -1000, sans jamais passer sous zéro ;
13. annuler une erreur et retrouver l'état exact d'avant ;
14. atteindre 10 000, voir le dernier tour se jouer, et connaître le vainqueur ;
15. retrouver la partie et les statistiques ensuite ;
16. me voir proposer l'export en fin de partie ;
17. fermer puis rouvrir l'application sans perdre mes données ;
18. jouer entièrement sans connexion ;
19. réimporter une sauvegarde après un changement de téléphone ;
20. reconnaître immédiatement l'identité portugaise et les azulejos de ZILCH.

---

## ANNEXE — CE QUI A CHANGÉ EN COURS DE SPÉCIFICATION

Douze points diffèrent des intentions initiales. Vérifier que chacun correspond bien à ce que vous voulez.

| Point | Version initiale | Version retenue |
|---|---|---|
| Seuil de 250 | Lu comme un seuil d'ouverture unique | Plancher applicable à chaque tour |
| Z+ | Tour perdu dès le premier lancer | Inchangé : premier lancer à 5 dés uniquement, jamais en reprise |
| Pénalité | Quatre cas énumérés séparément | Compteur unique : Z = 1, Z+ = 2, seuil à 3 |
| Score négatif | Non tranché | Plancher à zéro, dette non reportée |
| Fin de partie | Premier joueur à 10 000 | Dernier tour déclenché, meilleur score à l'issue |
| Main pleine | Absente | Relance des 5 dés obligatoire, arrêt impossible |
| Reprise du tour précédent | Absente | Choix binaire, lancer obligatoire, perte totale sur blanc |
| Dés restants | Non suivis | Saisis à chaque tour, valeur de 1 à 4 |
| Compte et backend | Supabase avec compte facultatif | **Abandonnés** — stockage local uniquement |
| Sauvegarde | Export optionnel dans les réglages | Export proposé à la fin de chaque partie |
| Installation | Recommandée dans le README | **Obligatoire**, imposée par l'application |
| Sons | Fichiers Myinstants | Enregistrements maison, éléments `<audio>` |
| Stack | Non définie | JavaScript natif, sans build, cache versionné à la main |
| Chemin de déploiement | `/zilch/` | `/Zilch/`, casse du dépôt |
