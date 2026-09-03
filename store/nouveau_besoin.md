# PROMPT MASTER — THE PIRATE’S DICE

## Mission générale

Tu travailles sur le projet existant **The Pirate’s Dice**.

L’objectif est de poursuivre le développement du jeu sans détériorer ce qui existe déjà, en intégrant les nouvelles fonctionnalités gameplay, UI, compte utilisateur, sécurité multijoueur, IA et tests décrites ci-dessous.

Tu dois travailler comme sur un projet déjà avancé en production.

Tu ne dois donc jamais considérer qu’il est acceptable de réécrire une fonctionnalité existante simplement parce qu’une autre implémentation te paraît plus simple.

Les priorités sont, dans cet ordre :

1. ne pas casser l’existant ;
2. préserver les assets et modifications déjà présentes ;
3. comprendre l’architecture avant d’écrire du code ;
4. conserver un serveur autoritaire pour tout le gameplay ;
5. assurer l’idempotence des opérations critiques ;
6. réutiliser les composants et assets existants ;
7. ajouter les tests correspondant aux changements ;
8. ne pas introduire de refactoring hors sujet ;
9. conserver la compatibilité des comptes existants ;
10. conserver la compatibilité avec les parties et données déjà existantes lorsque cela est possible.

---

# 0. RÈGLE ABSOLUE — NE PAS CASSER LE TRAVAIL EXISTANT

J’ai effectué de nombreuses modifications, corrections graphiques et mises à jour.

Elles sont déjà présentes dans le repository et ont été pushées.

Le dossier suivant est particulièrement sensible :

```text
www/dice/img
```

La version actuellement présente dans le repository constitue la **source de vérité**.

Avant toute modification :

```text
1. Vérifier git status.
2. Inspecter les derniers commits.
3. Examiner les derniers diffs.
4. Identifier l’architecture frontend/backend.
5. Identifier les fichiers réellement concernés par chaque tâche.
6. Identifier les composants/services/modèles existants réutilisables.
7. Identifier les assets déjà disponibles.
8. Identifier les tests existants.
9. Vérifier les migrations et la structure de la base.
10. Établir un plan avant les grosses modifications.
```

Interdictions :

- ne pas faire de refactoring global ;
- ne pas renommer massivement les fichiers ;
- ne pas déplacer les assets pour « mieux organiser » le projet ;
- ne pas supprimer un asset considéré comme inutilisé sans vérification ;
- ne pas remplacer une image par une ancienne version ;
- ne pas recréer un asset qui existe déjà ;
- ne pas écraser mes modifications graphiques ;
- ne pas modifier des fichiers sans rapport avec la mission ;
- ne pas modifier silencieusement les règles du jeu.

Avant de terminer, inspecter obligatoirement :

```bash
git status
git diff
```

et vérifier qu’aucun changement accidentel n’a été introduit.

---

# 1. RÉFÉRENCES VISUELLES

Je fournis plusieurs captures de l’état actuel du jeu.

Elles représentent notamment :

- la Home Page ;
- l’écran d’une partie ;
- le Market / Fournisseur du bord ;
- le style général du jeu ;
- les couleurs ;
- les contours blancs ;
- les panneaux violets ;
- les boutons ;
- les cartes ;
- les slots de dés ;
- les portraits des capitaines.

Ces captures servent de référence pour **l’état actuel du jeu**.

Ne redesign pas l’application selon tes goûts.

Lorsqu’une maquette spécifique est fournie, elle devient la référence pour la fonctionnalité concernée.

---

# 2. GESTION DES ASSETS — RÈGLE TRÈS IMPORTANTE

Avant de créer une nouvelle représentation graphique d'un effet, inspecte les assets existants.

L’objectif est :

> **réutiliser les assets déjà créés au lieu de réinventer la roue.**

Les assets peuvent être utilisés :

- comme image principale ;
- comme overlay ;
- par-dessus un slot ;
- par-dessus un dé ;
- sur une grille entière ;
- en arrière-plan ;
- pour un état activé ;
- pour un état protégé ;
- pour un état masqué ;
- pour un effet temporaire.

---

## 2.1 Registre des assets

Inspecte notamment les assets fournis et ceux déjà présents dans :

```text
www/dice/img
```

Parmi les références fournies figurent notamment :

```text
Anne Levent.png
Black Caesar.png
Captain Kidd.png
Sayyida al-Hurra.png
Wang Zhi.png

background_cap_info.png
background_effect.png

Dé pipé.png
Brouillard de poudre.png
Manœuvre de pont.png
Coque renforcée.png
Changement de quart.png

shield.png

fx_hide_enemi.png
fx_hide_player.png

maquette_info_cap.png
```

Il existe également déjà dans le projet des assets comme :

```text
fx_gel_case.png
```

et potentiellement d’autres effets similaires.

---

# 3. STRATÉGIE OBLIGATOIRE POUR LES EFFETS VISUELS

Pour chaque effet gameplay :

1. rechercher d’abord un asset existant ;
2. vérifier comment les effets similaires sont déjà rendus ;
3. réutiliser l’infrastructure existante lorsque possible ;
4. seulement si aucun asset approprié n’existe, signaler ce manque ;
5. ne jamais remplacer automatiquement un asset par un CSS approximatif.

Exemple :

si un effet doit masquer plusieurs slots, et que `fx_gel_case.png` est déjà utilisé comme overlay de slot, il faut réutiliser **la même logique de rendu par slot**.

Il ne faut pas créer un deuxième système uniquement pour le brouillard.

Conceptuellement :

```text
Grid
 ├─ Slot
 │   ├─ Dice
 │   └─ EffectOverlay
 ├─ Slot
 │   ├─ Dice
 │   └─ EffectOverlay
 ...
```

Les effets devraient idéalement utiliser un mécanisme commun du type :

```text
slot.effectOverlay
```

ou l'équivalent adapté à l'architecture existante.

---

# 4. BROUILLARD — AFFICHAGE DES SLOTS

Pour **B013 — Wang Zhi — Brouillard de poudre**, il faut également représenter visuellement le brouillard.

Lorsqu’il est actif, utiliser les assets appropriés déjà disponibles.

Les assets fournis incluent notamment :

```text
fx_hide_enemi.png
fx_hide_player.png
```

Inspecte leur rôle exact avant intégration.

Si le brouillard doit être appliqué sur chaque case, utiliser la logique existante d’overlay par slot, notamment celle employée par :

```text
fx_gel_case.png
```

Il ne faut pas créer une deuxième grille spécialement pour cet effet.

Le dé doit continuer d’exister sous l’overlay.

L’effet graphique ne doit jamais modifier l’état réel du dé.

À la fin de l’effet :

```text
overlay supprimé
dé toujours présent
état réel toujours synchronisé avec le serveur
```

Les overlays doivent également être correctement reconstruits après reconnexion à partir de l’état du match envoyé par le serveur.

---

# 5. FICHE CAPITAINE

Lorsqu’un utilisateur appuie sur un capitaine, ouvrir une fiche détaillée.

La maquette fournie :

```text
maquette_info_cap.png
```

constitue la référence de structure.

L’image :

```text
background_cap_info.png
```

peut être utilisée pour l’arrière-plan conformément au design fourni.

La fiche doit afficher :

```text
Portrait

Nom

Titre / surnom

Lore court

Bonus offert

Icône du bonus

Description exacte du bonus

État :
- verrouillé
- débloqué
- sélectionné

Progression

Condition de déblocage

Bouton Sélectionner
```

Les informations ne doivent pas être écrites directement dans le composant UI.

Prévoir une structure extensible pour les capitaines.

Exemple conceptuel :

```ts
CaptainDefinition {
    id
    name
    title
    portrait
    lore
    bonusId
    bonusName
    bonusIcon
    bonusDescription
    unlockCondition
}
```

Adapte cela aux conventions réelles du projet.

---

# 6. UN CAPITAINE DOIT TOUJOURS ÊTRE SÉLECTIONNÉ

Il ne doit jamais exister d’état normal où le compte ne possède aucun capitaine actif.

Comportement attendu :

```text
création compte
→ capitaine par défaut

ancien compte sans capitaine
→ réparation automatique

capitaine sélectionné supprimé/invalide
→ fallback vers un capitaine valide

capitaine verrouillé envoyé par client
→ refus serveur
```

Le serveur valide toujours la sélection.

Tests à prévoir au minimum :

- nouveau compte ;
- ancien compte ;
- compte sans capitaine sélectionné ;
- capitaine enregistré devenu invalide ;
- tentative de sélectionner un capitaine verrouillé ;
- reconnexion ;
- relance complète de l’application.

---

# 7. HOME PAGE

Mettre en place la disposition des boutons correspondant au design fourni.

Conserver :

- actions existantes ;
- navigation ;
- animations ;
- états disabled ;
- états selected ;
- responsive ;
- safe areas.

Le design fourni constitue la référence.

Ne déplacer aucun autre composant sans raison.

Vérifier notamment :

- alignement ;
- espacements ;
- dimensions ;
- responsive ;
- safe areas ;
- états pressé / disabled / selected ;
- absence d’overlap ;
- comportement sur petits écrans.

---

# 8. ICÔNE MARY READ

L’icône de la Home Page constitue la référence.

Le Market doit utiliser exactement la même ressource.

Ne crée pas une copie si les deux composants peuvent pointer vers le même asset.

Chercher également les autres occurrences du bonus de Mary Read pour éviter une troisième icône incohérente.

---

# 9. GESTION DU COMPTE — NOUVELLE SECTION

Je veux désormais donner à l’utilisateur de vraies possibilités de gestion de son compte.

Ajouter une section **Compte** dans les paramètres existants, ou à l’endroit le plus cohérent avec l’architecture actuelle.

Elle doit permettre :

```text
Changer son pseudo

Voir ses méthodes de connexion

Lier Google

Lier Apple

Lier une adresse e-mail

Créer un mot de passe

Modifier le mot de passe

Mot de passe oublié

Déconnexion

Suppression du compte
```

Ne crée pas des comptes séparés lorsqu’un utilisateur ajoute une nouvelle méthode de connexion.

Toutes les méthodes doivent pouvoir représenter **le même compte joueur**.

---

# 10. CHANGEMENT DE PSEUDO

Ajouter la possibilité de modifier son pseudo.

Le pseudo ne doit pas être considéré comme un identifiant d’authentification.

Le compte doit continuer d’être identifié par son identifiant interne.

Validation serveur obligatoire.

Vérifier au minimum :

```text
longueur minimale
longueur maximale
caractères autorisés
normalisation
pseudo vide
unicité si le jeu l’impose
mots interdits si un système existe déjà
spam de changements
```

Ne jamais faire confiance uniquement à la validation frontend.

Après changement :

- mettre à jour l’interface ;
- mettre à jour le classement ;
- mettre à jour les écrans où le pseudo est affiché ;
- invalider le cache concerné si nécessaire.

Ne pas modifier les anciennes données historiques de partie sauf si l’architecture actuelle utilise volontairement une référence dynamique vers le compte.

---

# 11. LIAISON D’UNE ADRESSE E-MAIL

Permettre à un compte Google ou Apple existant d’ajouter une adresse e-mail.

Le compte existant doit rester le même.

Exemple :

```text
Compte #1234

Google ✓
Apple ✗
Email ✗
```

après liaison :

```text
Compte #1234

Google ✓
Apple ✗
Email ✓
```

et non :

```text
Compte #1234
+
nouveau compte #9876
```

---

# 12. CONFLITS DE LIAISON DE COMPTE

Cas important :

un utilisateur connecté avec Google veut ajouter une adresse e-mail déjà associée à un autre compte.

Ne fusionne jamais silencieusement les comptes.

Le serveur doit détecter le conflit et renvoyer un état explicite.

Ne déplace :

- progression ;
- achats ;
- monnaies ;
- statistiques ;
- ELO ;
- capitaines ;

entre comptes sans une procédure explicitement définie.

---

# 13. VÉRIFICATION DE L’ADRESSE E-MAIL

Si l’infrastructure disponible le permet, une adresse ajoutée doit être vérifiée avant d’être considérée comme méthode d’authentification complète.

Flux recommandé :

```text
ajout email
↓
email en attente
↓
envoi lien/code
↓
validation
↓
emailVerified = true
```

Les tokens de validation doivent :

- expirer ;
- être single-use ;
- être invalidés après utilisation ;
- ne pas être stockés en clair lorsque cela peut être évité.

---

# 14. CRÉATION D’UN MOT DE PASSE

Un joueur connecté avec Google ou Apple doit pouvoir créer un mot de passe afin de pouvoir ensuite se connecter par :

```text
email + mot de passe
```

sans perdre ses méthodes Google/Apple.

Exemple :

```text
Google ✓
Email ✓
Mot de passe ✓
```

Toutes ces méthodes donnent accès au même compte.

---

# 15. SÉCURITÉ DES MOTS DE PASSE

Ne jamais :

```text
stocker un mot de passe en clair
logger un mot de passe
renvoyer un hash au client
```

Utiliser le système déjà disponible dans le backend s’il existe.

Sinon employer un algorithme reconnu de password hashing adapté à l’environnement utilisé.

Prévoir également :

- politique minimale de mot de passe ;
- protection brute-force ;
- rate limiting ;
- réinitialisation sécurisée ;
- expiration des tokens de reset ;
- invalidation des tokens utilisés ;
- éventuellement invalidation des sessions sensibles après changement.

Ne crée pas un système cryptographique maison.

---

# 16. MODIFICATION DES INFORMATIONS SENSIBLES

Pour les opérations sensibles telles que :

```text
ajouter email
changer email
créer mot de passe
changer mot de passe
délier Google
délier Apple
supprimer compte
```

prévoir une revalidation de l’identité lorsque nécessaire.

Ne jamais permettre à un utilisateur de supprimer sa dernière méthode de connexion sans lui fournir une autre méthode valide.

Exemple interdit :

```text
Google = seule connexion
→ supprimer Google
→ compte inaccessible
```

---

# 17. SUPPRESSION DE COMPTE ET CLASSEMENT

La désinstallation de l’application n’est pas équivalente à la suppression du compte.

Lorsqu’un compte est réellement supprimé côté serveur :

```text
utilisateur
classement
ELO public
cache
sessions
tokens
données publiques
```

doivent être nettoyés ou invalidés selon l’architecture.

Vérifier notamment :

- table utilisateur ;
- classement / leaderboard ;
- cache du classement ;
- ranking ELO ;
- statistiques publiques ;
- références éventuelles dans Redis/cache ;
- sessions actives ;
- tokens ;
- relations annexes maintenant artificiellement le joueur dans le classement.

Après suppression :

```text
ancien access token
→ refusé

ancien refresh token
→ refusé

classement mis en cache
→ invalider/recalculer
```

La suppression doit être cohérente et, lorsque cela est pertinent, transactionnelle.

---

# 18. SERVEUR AUTORITAIRE

Tout ce qui influence une partie doit être décidé et validé par le serveur.

Le client est uniquement :

```text
interface
+
source de commandes
```

Il n’est jamais la source de vérité.

Pour chaque commande gameplay sensible, vérifier :

```text
accountId
matchId
turnId
commandId
commandType
appartenance au match
état du match
joueur actif
bonus disponible
action autorisée
```

Ne jamais considérer `matchId`, `turnId` ou tout autre état envoyé par le client comme fiable.

---

# 19. COMMANDES IDEMPOTENTES

Les commandes comme :

```text
placeDice
useBonus
abandon
settlement
offline token
```

doivent résister aux doubles appels.

Exemple :

```text
commandId = abc123

premier appel
→ appliqué

second appel
→ détecté comme duplicate
→ aucun deuxième changement
```

Un double clic ou deux paquets WebSocket simultanés ne doivent jamais produire deux actions.

Chaque commande sensible devrait au minimum être reliée à :

```text
accountId
matchId
turnId
commandId
type de commande
```

---

# 20. MULTI-SESSION

Un même compte ne doit pas participer simultanément à deux matchs incompatibles.

Il faut cependant autoriser une reconnexion légitime à la même partie.

Différencier :

```text
DEVICE A perd connexion
DEVICE B / même compte reprend match A
→ reconnexion possible selon règles définies

DEVICE A joue match A
DEVICE B tente de démarrer match B
→ refus
```

Prévoir une stratégie robuste autour de :

- session ;
- match actif ;
- device/session identifier si nécessaire ;
- reconnexion ;
- déconnexion brutale ;
- expiration.

---

# 21. REPLAY DE COMMANDES

Une ancienne commande WebSocket ne doit jamais être rejouable.

Vérifier l’état serveur courant.

Exemple :

```text
commande :
match A
turn 12

état actuel :
match B
turn 3

→ REJECT
```

Aucune modification de l’état.

Le serveur doit systématiquement vérifier que :

- le match existe ;
- le joueur appartient au match ;
- le match est encore actif ;
- le `turnId` correspond à l’état serveur courant ;
- le joueur a actuellement le droit de jouer ;
- la commande n’a pas déjà été consommée ;
- le bonus demandé est encore disponible.

---

# 22. SETTLEMENT IDEMPOTENT

La finalisation d’une partie doit être atomique/idempotente.

Architecture possible :

```text
ACTIVE
↓
SETTLING
↓
SETTLED
```

Une seule finalisation attribue :

```text
victoire
défaite
ELO
expérience
or
progression
récompenses
statistiques
```

Même si :

```text
timeout
+
abandon
```

arrivent simultanément.

Tester aussi :

- reconnexion ;
- timeout ;
- abandon ;
- fin normale ;
- déconnexion ;
- abandon + timeout quasiment simultanés ;
- deux handlers détectant la victoire simultanément.

---

# 23. BONUS B012 — CAPTAIN KIDD — DÉ PIPÉ

Effet :

```text
après lancer :

valeur +1
OU
valeur -1
```

Pas de wrap.

```text
1 → seulement 2
6 → seulement 5
4 → 3 ou 5
```

Le bonus ne permet jamais de sélectionner librement n’importe quelle face.

La nouvelle valeur devient la valeur réelle utilisée pour le placement et le scoring.

Asset :

```text
Dé pipé.png
```

---

# 24. BONUS B013 — WANG ZHI — BROUILLARD DE POUDRE

Effet :

> Le prochain dé placé par l’adversaire peut être placé normalement et marque normalement ses points, mais il ne détruit aucun de tes dés.

Le bonus est consommé sur le prochain placement adverse concerné.

Il survit à une reconnexion.

Tester notamment :

- dé placé sans correspondance ;
- dé qui aurait normalement détruit plusieurs dés ;
- reconnexion avant utilisation ;
- fin de partie avant consommation du bonus.

Asset :

```text
Brouillard de poudre.png
```

Représentation visuelle : utiliser le système d’overlay décrit précédemment.

---

# 25. BONUS B014 — ANNE LEVENT — MANŒUVRE DE PONT

Effet :

> Déplace le dé supérieur d’une de tes colonnes vers une autre de tes colonnes non pleine.

Conditions :

- uniquement l’un de ses propres dés ;
- uniquement le dé situé au sommet d’une colonne ;
- destination différente ;
- destination non pleine ;
- aucune destruction déclenchée par le déplacement.

Le déplacement n’est pas considéré comme le placement classique d’un nouveau dé.

Il ne doit donc pas réexécuter les effets normalement provoqués par `placeDice`.

Vérifier le scoring après déplacement selon les règles existantes du jeu.

Asset :

```text
Manœuvre de pont.png
```

---

# 26. BONUS B015 — BLACK CAESAR — COQUE RENFORCÉE

Effet :

> Protège un de tes dés jusqu’à la fin du prochain tour adverse.

Le joueur choisit un de ses dés présent sur la grille.

Si une destruction doit toucher le dé :

```text
dé survit
protection consommée
```

Sinon :

```text
fin tour adverse
→ protection expire
```

La protection doit :

- être visible dans l’état de partie envoyé au client ;
- survivre à une reconnexion ;
- être correctement gérée lors d’une destruction multiple d’une même valeur.

Asset principal :

```text
Coque renforcée.png
```

Effet visuel disponible :

```text
shield.png
```

Réutiliser cet asset autour/sur le dé protégé.

Ne dessine pas un nouveau bouclier en CSS.

---

# 27. BONUS B016 — SAYYIDA AL-HURRA — CHANGEMENT DE QUART

Effet :

> Échange les multiplicateurs de deux colonnes pour les deux joueurs jusqu’à la fin de la partie.

Exemple :

```text
avant

x0.8 | x0.5 | x1 | x1.3

après échange 1 ↔ 4

x1.3 | x0.5 | x1 | x0.8
```

L’échange affecte les deux joueurs.

L’effet reste jusqu’à la fin du match.

Il modifie :

```text
scoring futur
affichage des multiplicateurs
état sérialisé
reconnexion
IA
```

Il ne déplace aucun dé.

Asset :

```text
Changement de quart.png
```

---

# 28. IA — REFONTE DU NIVEAU DE JEU

L’IA actuelle joue trop mal.

Elle ne doit plus choisir principalement une action valide au hasard.

Pour chaque placement possible, évaluer notamment :

```text
gain immédiat
multiplicateur
doublon
triplé
destruction adverse
risque futur
place disponible
potentiel futur de la colonne
état de la grille adverse
proximité de la fin de partie
score actuel
score adverse
capitaine adverse
bonus encore disponibles
```

Comparer plusieurs actions avant de sélectionner.

---

# 29. IA ET BONUS

Créer une stratégie spécifique pour chaque bonus existant, y compris B012 à B016.

Un bonus ne doit jamais être utilisé uniquement parce qu’il est disponible.

Exemple Captain Kidd :

```text
dé obtenu = 4

simulation 3
simulation 5
simulation conservation du 4

→ choisir l’action ayant la meilleure valeur stratégique
```

L’IA doit notamment évaluer si une transformation :

- crée un multiplicateur ;
- détruit une valeur adverse ;
- évite une mauvaise colonne ;
- améliore le score futur ;
- apporte réellement un avantage.

Faire de même pour tous les bonus.

---

# 30. NIVEAUX DE DIFFICULTÉ

Si le projet possède différents niveaux d’IA, conserver cette possibilité.

La différence de difficulté doit idéalement provenir de paramètres contrôlés comme :

- profondeur de recherche ;
- qualité de l’heuristique ;
- nombre de coups simulés ;
- probabilité contrôlée de choisir un coup suboptimal.

L’IA ne doit pas tricher.

Elle ne doit pas accéder à des informations qu’un joueur humain ne peut pas connaître.

---

# 31. IA ET APPRENTISSAGE FUTUR

Préparer une télémétrie permettant plus tard d’améliorer les heuristiques.

Enregistrer, lorsque pertinent :

```text
matchId anonymisable
état avant décision
actions possibles
action choisie
bonus disponibles
action adverse suivante
évolution du score
résultat
victoire/défaite
évaluation du coup
version IA
```

Cette télémétrie pourra ensuite être utilisée pour améliorer :

- les poids heuristiques ;
- les stratégies ;
- les simulations ;
- ou entraîner ultérieurement un modèle.

Ne mets pas en production une IA qui modifie librement ses propres paramètres sans contrôle.

Si une adaptation automatique simple est mise en place, elle doit être :

- bornée ;
- versionnée ;
- réversible ;
- testable ;
- reproductible.

---

# 32. DÉTECTION DES BOTS

Ne pas utiliser de mécanisme invasif côté appareil.

Collecter des signaux serveur :

```text
nombre de parties
durée de session
temps entre actions
variance des réactions
activité continue
patterns répétitifs
```

Construire éventuellement :

```text
suspicionScore
```

mais :

```text
1 signal ≠ bannissement
```

Prévoir idéalement :

- score de suspicion ;
- logs ;
- métriques ;
- seuils ;
- possibilité d’analyse ;
- limitation progressive si nécessaire.

Les résultats doivent pouvoir être examinés.

---

# 33. TOKENS OFFLINE

Si des jetons offline existent :

```text
unique id
account bound
expiration
single-use
signature/vérification serveur
```

Une restauration d’une ancienne base locale ne doit pas permettre leur réutilisation.

Si plusieurs graines/jetons sont préchargés, le joueur ne doit pas être en mesure de choisir celui qui l’avantage.

Le système doit imposer :

- un ordre ;
- un compteur ;
- une chaîne cryptographique ;
- ou une autre approche déterministe et vérifiable.

Documenter clairement le mécanisme retenu.

---

# 34. TESTS DE GAMEPLAY

Pour chaque nouveau bonus :

```text
activation valide
activation invalide
état avant
état après
consommation
expiration
reconnexion
double commande
fin de partie
```

Ajouter également des tests de non-régression sur les règles existantes susceptibles d’être impactées.

---

# 35. TESTS DE CONCURRENCE

Créer de vrais tests concurrents.

## Test A

```text
2 placeDice simultanés
→ 1 seul placement
```

## Test B

```text
2 useBonus simultanés
→ 1 seule consommation
```

## Test C

```text
timeout + abandon
→ 1 settlement
```

## Test D

```text
2 appareils
1 compte
2 matchs
→ refus
```

## Test E

```text
ancien turnId
→ rejet
```

## Test F

```text
même token offline deux fois
→ deuxième rejet
```

---

# 36. TESTS DU COMPTE

Ajouter également des tests concernant la nouvelle gestion de compte.

Au minimum :

```text
changement de pseudo valide
pseudo invalide
pseudo déjà utilisé si unicité
mise à jour leaderboard

liaison email

email déjà lié au même compte

email lié à un autre compte

validation email

token validation expiré

token validation déjà utilisé

création mot de passe

connexion email/password

mauvais password

password reset

token reset expiré

token reset déjà consommé

compte Google + création password

compte Apple + création password

tentative de retirer la dernière méthode de connexion

suppression compte

utilisation ancien token après suppression
```

---

# 37. OBSERVABILITÉ

Logs structurés au minimum pour :

```text
match start
reconnect
command rejected
duplicate commandId
invalid turnId
double session
bonus activation
bonus expiration
settlement
offline token rejected
suspicious behavior

username change
email link
email verification
password creation
password change
account unlink
account deletion
```

Ne jamais logger :

```text
mot de passe
hash
refresh token complet
access token complet
token reset complet
```

Les logs doivent permettre de comprendre pourquoi une action a été refusée.

---

# 38. MÉTHODE DE TRAVAIL OBLIGATOIRE

## Phase 1 — Audit

Avant de modifier :

```text
architecture
frontend
backend
auth
WebSocket
base de données
matches
captains
bonuses
AI
offline
leaderboard
assets
tests
```

Ne commence pas directement à coder.

La première réponse doit être un audit synthétique du repository et un plan d’implémentation basé sur les fichiers réellement trouvés.

N’invente aucun nom de table, route, service, composant, WebSocket event ou fichier avant d’avoir vérifié ce qui existe réellement dans le projet.

---

## Phase 2 — Cartographie

Produire une liste interne :

```text
fonctionnalité
→ fichiers actuels
→ fichiers à modifier
→ modèle DB concerné
→ risque
→ tests nécessaires
```

---

## Phase 3 — Asset audit

Créer une cartographie :

```text
fonction
→ asset existant
```

Exemple :

```text
Captain Kidd
→ Captain Kidd.png

B012
→ Dé pipé.png

B013
→ Brouillard de poudre.png

B014
→ Manœuvre de pont.png

B015
→ Coque renforcée.png
→ shield.png

B016
→ Changement de quart.png

Captain modal background
→ background_cap_info.png
```

Compléter cette liste avec ce qui existe réellement dans `www/dice/img`.

---

## Phase 4 — Implémentation

Procéder fonctionnalité par fonctionnalité.

Éviter de toucher simultanément à un grand nombre de systèmes sans raison.

Éviter les refactorings unrelated.

---

## Phase 5 — Tests

Après chaque groupe :

```text
build
typecheck
lint
unit tests
integration tests
gameplay tests
concurrency tests
```

---

## Phase 6 — Vérification visuelle

Contrôler au minimum :

```text
Home

Market

Captain modal

match screen

small screen

large screen

safe areas

captain locked

captain unlocked

captain selected

fog active

shield active

column swap active
```

---

# 39. NE PAS INVENTER DE FONCTIONNALITÉ

Si une information nécessaire manque :

1. inspecter le projet ;
2. chercher une convention existante ;
3. réutiliser cette convention ;
4. si une vraie décision produit est nécessaire, la signaler.

Ne modifie pas silencieusement une règle pour contourner le problème.

Si une ancienne implémentation entre en conflit avec ces nouvelles spécifications, analyser le comportement existant et l’adapter proprement plutôt que d’empiler un deuxième système par-dessus.

---

# 40. CRITÈRE « TERMINÉ »

Une fonctionnalité n’est pas terminée simplement parce qu’elle compile.

Elle doit être :

```text
implémentée
connectée au backend
validée serveur
persistée si nécessaire
reconnectable
visible dans l'UI
testée
sans régression évidente
```

Avant de considérer la mission terminée :

- lancer tous les tests disponibles ;
- vérifier compilation frontend ;
- vérifier compilation backend ;
- vérifier lint/typecheck si disponible ;
- vérifier migrations ;
- vérifier WebSocket ;
- vérifier responsive ;
- vérifier les assets.

---

# 41. COMPTE RENDU FINAL OBLIGATOIRE

À la fin, retourner exactement les sections suivantes.

## Modifications réalisées

Liste précise de ce qui est réellement terminé.

## Fichiers principaux modifiés

Pour chaque fichier :

```text
chemin
→ raison du changement
```

## Assets utilisés

Lister :

```text
asset
→ écran/fonctionnalité
```

Préciser explicitement si un nouvel asset a dû être créé.

## Base de données

Lister les migrations.

Sinon écrire :

```text
Aucune modification de schéma.
```

## Compte et authentification

Décrire :

```text
pseudo
email
password
Google
Apple
account linking
account deletion
```

## Sécurité

Décrire les protections contre :

```text
double commande
replay
double settlement
multi-session
bots
offline replay
sélection de seed
brute force auth
account linking conflict
```

## Bonus

Créer une sous-section séparée pour :

```text
B012
B013
B014
B015
B016
```

avec :

```text
logique
UI
asset
backend
tests
```

## IA

Décrire :

```text
ancien comportement
nouvel algorithme
bonus
télémétrie
```

## Tests exécutés

Donner :

- commandes utilisées ;
- nombre de tests réussis ;
- éventuels tests échoués ;
- raison de chaque échec restant.

## Points restant à faire

Ne jamais cacher une fonctionnalité partiellement terminée.

Indiquer explicitement tout ce qui reste à faire.

## Vérification Git

Indiquer :

```text
git status
git diff
```

et confirmer explicitement :

- aucune modification involontaire n’a été faite ;
- aucun asset n’a été écrasé involontairement ;
- `www/dice/img` n’a pas été détérioré ;
- les assets existants ont été préservés ;
- aucun fichier hors sujet n’a été modifié ;
- aucun refactoring massif inutile n’a été introduit.

---

# 42. PRINCIPES À RESPECTER PENDANT TOUTE LA MISSION

Priorités, dans cet ordre :

1. **Ne pas casser l’existant.**
2. **Serveur autoritaire pour le gameplay.**
3. **Idempotence des opérations critiques.**
4. **Aucune confiance dans l’état envoyé par le client.**
5. **Préserver le travail et les assets déjà présents.**
6. **Tests avant de considérer une fonctionnalité terminée.**
7. **Pas de refactoring massif hors sujet.**
8. **Pas de changement silencieux des règles du jeu.**
9. **Pas de mécanique anti-triche intrusive inutile.**
10. **Pas d’IA qui triche en utilisant des informations normalement inconnues du joueur.**
11. **Ne pas dupliquer les systèmes visuels déjà existants.**
12. **Réutiliser les assets existants avant d’en créer de nouveaux.**
13. **Ne jamais fusionner silencieusement deux comptes.**
14. **Ne jamais rendre un compte inaccessible en supprimant sa dernière méthode de connexion.**

---

# INSTRUCTION FINALE À L’AGENT

**Ne commence pas directement à coder.**

Ta première étape obligatoire est de :

1. lire l’état actuel du repository ;
2. inspecter les derniers commits et le diff ;
3. identifier les fichiers réellement concernés ;
4. identifier les systèmes existants réutilisables ;
5. auditer `www/dice/img` et les assets fournis ;
6. cartographier les impacts frontend/backend/base de données/tests ;
7. produire un plan d’implémentation concret basé sur les vrais fichiers trouvés.

Ensuite seulement, commence les modifications.

N’invente aucun nom de table, route, service, composant, WebSocket event, asset ou fichier avant d’avoir vérifié ce qui existe réellement dans le projet.


j'ai remarqué une instabilité, apres un lancé de dés un joueur a été ejecté du serveur et n'a pas pu la reprendre et a perdu des points de classement