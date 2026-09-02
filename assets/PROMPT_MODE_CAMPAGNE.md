# Mode Campagne — étude de l'existant et brief d'implémentation

Un mode solo à progression : des **paliers**, des **niveaux**, des **étoiles**,
de l'**or**, et les **capitaines** en récompense. Jouable **sans réseau**, avec
une IA qui monte en puissance de palier en palier.

Ce fichier est le prompt complet à donner à l'agent qui implémentera : d'abord
ce qui existe déjà (avec les fichiers), puis la spécification, puis l'ordre de
chantier.

---

## 1. L'EXISTANT — ce sur quoi on construit

### L'IA a DÉJÀ quatre niveaux, côté serveur
`dice-server/src/game/ai.js` :
```
LEVELS = {
  greedy: { search: false },                                  // 1 coup d'avance
  normal: { search: true, timeMs: 40,  maxDepth: 3, blunder: 0.12 },
  strong: { search: true, timeMs: 150, maxDepth: 8,  blunder: 0 },
  brutal: { search: true, timeMs: 400, maxDepth: 10, blunder: 0 },
}
```
- `blunder` = bévue volontaire (12 % de coups gloutons au niveau normal).
- La recherche s'appuie sur des **poids entraînés** (`src/learn/weights.js`,
  self-play + trainer) : un seul jeu de poids actif à la fois.
- L'IA joue aussi les **effets** (`planEffet`) — la bordée, le gel, etc.
→ La montée en difficulté de la campagne est donc presque gratuite EN LIGNE :
  passer `options.level` selon le palier.

### L'IA hors ligne est UN SEUL niveau, glouton
`piratesdice/www/js/pages/dice_horsligne.js` → `coupDeLaMachine()` :
1 coup d'avance, gain de score + destruction comptée double. Pas de recherche,
pas de bévues, pas de niveaux.
→ Pour une campagne jouable hors ligne, il faut une ÉCHELLE de difficulté dans
  le moteur de poche (voir §3, chantier C). Attention : le moteur hors ligne
  est REJOUÉ par le vérificateur serveur (`dice-server/src/game/horsligne.js`,
  RNG issu de la graine du jeton) — tout ce que l'IA de poche fait doit rester
  déterministe à partir de la graine, sinon la vérification casse.

### Les capitaines se débloquent aux parties jouées
`dice-server/src/game/captains.js` : 15 capitaines, `seuil` en parties
terminées (read 0, jack 25, ching 100, teach 150, omalley 250, bonny 350,
bart 400, lionne 450, … jusqu'à 800). Le serveur seul juge (`captains.ouvert`).
→ La campagne devient un DEUXIÈME chemin de déblocage : un capitaine s'ouvre
  par le seuil de parties OU par les étoiles du palier. Le `ouvert()` du
  serveur apprend ce « OU » ; l'écran du pont sait déjà repeindre.

### Le hors ligne est déjà vérifié et payé
- Jetons hors ligne pré-semés (graine RNG), parties rejouées par le serveur au
  retour du réseau, puis créditées (`horsligne.js`, `sql/019/020`).
→ Les niveaux de campagne joués hors ligne suivent EXACTEMENT ce chemin : la
  graine du niveau est fixée par le serveur (ou dérivée du jeton), le journal
  est rejoué, les étoiles et l'or ne sont crédités qu'après vérification.
  AUCUNE nouvelle confiance accordée au client.

### Le pont a trois cartes de mode
`piratesdice/www/js/pages/dice_lobby.js` : `#dc-solo` (Affronter l'IA),
`#dc-multi` (Défier un joueur), `#dc-ami` (Jouer avec un ami).
→ La campagne est une QUATRIÈME carte, `#dc-campagne`, même gabarit
  (`dc-carte-mode`). La grille des modes passe en 2×2 sur téléphone.

### Les récompenses existantes
- Or : `aiReward` (20) par victoire IA, `rankReward` (100) par montée classée.
- Pièces maudites : hauts faits (`achievement`).
- Le catalogue des textes est TOUJOURS côté client (i18n 4 langues), le serveur
  ne parle aucune langue — la campagne suit cette règle.

---

## 2. LA SPÉCIFICATION

### La forme
- **15 paliers**, un par capitaine, dans l'ordre des seuils actuels
  (palier 1 = Mary Read... palier 15 = le dernier). Chaque palier porte le
  portrait et l'univers de SON capitaine.
- Chaque palier = **5 niveaux**. Chaque niveau = une partie contre l'IA, avec
  jusqu'à **3 étoiles** :
  - ★ gagner la partie ;
  - ★★ gagner en respectant la **contrainte de style** du niveau ;
  - ★★★ gagner en respectant la **contrainte d'excellence** du niveau.
  Les trois étoiles peuvent s'obtenir en plusieurs passages (elles se cumulent,
  on rejoue un niveau librement).
- **Déblocage** : niveau N+1 s'ouvre dès ★ sur le niveau N. Le palier P+1
  s'ouvre dès que le palier P totalise **au moins 11 étoiles sur 15** ; le
  **capitaine** du palier P est offert quand ses **15 étoiles** sont prises.
  (Deux portes distinctes : avancer est accessible, la collection est exigeante.)
- **Or** : ★ = 15, ★★ = 25, ★★★ = 40 (par étoile, une seule fois chacune).
  Coffre de palier (15/15) : 300 or + 25 maudites.

### Les contraintes de style (exemples par famille, à varier selon le niveau)
- gagner sans perdre plus de 2 dés · gagner avec un triple · gagner sans poser
  de six · finir avec la colonne ×1,3 la plus haute · gagner sans jouer d'effet
  · gagner de 10 points d'écart · poser un escalier 1-2-3 · gagner avec les
  quatre colonnes remplies · détruire 5 dés adverses · gagner en moins de N
  tours.
Ces mesures existent presque toutes déjà dans `src/game/bilan.js` /
`src/game/succes.js` (compteurs des hauts faits) : LES RÉUTILISER, ne pas
recompter à la main.

### La montée de l'IA
| Paliers | Niveau IA (en ligne) | Poche (hors ligne) |
|---------|----------------------|--------------------|
| 1–3     | greedy, puis normal (blunder 0.15→0.08) | glouton actuel + bévues aléatoires-déterministes (graine) |
| 4–8     | normal → strong      | glouton sans bévue + anticipation 2 coups |
| 9–12    | strong               | anticipation 2 coups + effets mieux joués |
| 13–15   | brutal + meilleurs poids | anticipation 3 coups (budget fixe, déterministe) |
En ligne, l'IA joue en outre le CAPITAINE du palier (son effet offert) — le
boss du palier 4 gèle, celui du palier 9 a sa longue-vue, etc.

### Les écrans
- Pont : carte **Campagne** (2×2 avec les trois modes existants).
- **Carte au trésor** : les 15 paliers en îles sur une carte (défilement
  vertical), chaque île montre ses 5 niveaux en points d'étape + les étoiles
  prises (0–15) + le médaillon du capitaine (gris → doré à 15/15).
- Fiche de niveau (modale) : les 3 objectifs de l'étoile, le meilleur résultat,
  bouton Jouer / Rejouer.
- Fin de partie campagne : les étoiles gagnées CE passage, l'or crédité, et le
  bouton « niveau suivant ».
- Tout le texte via i18n (fr/en/es/ar), clés `camp.*`.

### Les données
- Serveur : table `campaign_progress(player_id, niveau_id, etoiles bitmask,
  meilleur_score, updated_at)` + `campaign_defs` versionnée en SQL (comme
  `achievement` : identifiants, contraintes par id de mesure, seuils, graine).
- Hors ligne : progression en cache local (`localStorage` via dice_cale),
  synchronisée au retour réseau APRÈS vérification du journal — même
  philosophie que les jetons hors ligne. Le serveur reste l'autorité.
- Anti-triche : une partie de campagne hors ligne = un jeton hors ligne marqué
  `campagne:<niveau_id>` ; le vérificateur rejoue et recalcule LUI-MÊME les
  étoiles à partir du journal (les contraintes sont des fonctions du journal,
  pas des déclarations du client).

---

## 3. L'ORDRE DE CHANTIER

**A. Serveur — définitions et progression** : `campaign_defs` en SQL,
`campaign_progress`, module `src/game/campagne.js` (contraintes → étoiles à
partir d'un journal/bilan), messages WS `campagne` (lire la carte) et
`campagne.jouer` (ouvrir une partie IA paramétrée palier/niveau), crédits d'or.
Tests : une partie simulée par contrainte, étoiles recalculées.

**B. Déblocage des capitaines** : `captains.ouvert(id, games, etoilesPalier)` —
le OU des deux chemins, testé, et l'écran du pont qui affiche la double
condition (« 250 parties OU palier 5 complet »).

**C. IA de poche à niveaux** : dans `dice_horsligne.js`, une échelle
déterministe (bévues tirées de la graine, anticipation à budget fixe) + son
MIROIR EXACT dans le vérificateur serveur (`horsligne.js`). Contrat de tests
comme `contrat_horsligne.test.js` : mêmes coups des deux côtés, graine par
graine.

**D. Client — écrans** : carte des paliers, fiche de niveau, carte de mode sur
le pont, fin de partie campagne, i18n 4 langues.

**E. Hors ligne bout en bout** : jeton `campagne:*`, rejeu, crédit différé,
bandeau « étoiles en attente de vérification ».

Chaque chantier se termine par : tests verts (`npm test` serveur, banc client),
vérification visuelle au simulateur, commit.

---

## 4. LES DÉCISIONS DÉJÀ PRISES (ne pas rouvrir sans l'admin)

- La campagne N'ENLÈVE RIEN au chemin actuel : les seuils de parties restent.
- Le serveur recalcule tout ; le client n'affirme jamais une étoile.
- Les textes au client, les nombres au serveur (règle de toute la base).
- Pas de vies, pas d'énergie, pas de minuterie d'attente : on rejoue à volonté.

## 5. CE QUI RESTE À DÉCIDER (demander avant de coder)

- Les assets : carte au trésor, îles, étoiles, coffres — prompts à préparer
  comme `PROMPT_SUCCES_101_200.md` une fois la maquette validée.
- Le nom du bouton : « Campagne » / « L'Aventure » / autre.
- L'or exact par étoile et le contenu du coffre de palier (équilibrage).
- Les 75 contraintes précises (15 paliers × 5 niveaux) — proposer un tableau
  complet à l'admin avant l'écriture SQL.
