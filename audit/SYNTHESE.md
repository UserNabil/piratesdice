# SYNTHÈSE DE L'AUDIT INTÉGRAL

## Couverture

- **Fichiers traités : 183 / 183 (100 %)** — un rapport écrit par fichier dans `audit/rapports/` (vérifié : 0 fichier sans rapport).
- **Lignes : 68 732** — toutes lues (fichiers ≥ 300 lignes découpés en tranches de 200).
- **Fonctions : ~3 290** (dénominateur `queue.md` ; les écarts par fichier viennent de l'heuristique de comptage `=>`/méthodes, chaque fichier a été lu intégralement).
- **Résultat : 148 fichiers OK, 35 fichiers avec findings.** 0 TODO restant dans `queue.md`.
- Deux dépôts : `pd/` (client + outils), `srv/` (serveur).
- **Aucune correction pendant l'audit** (comme demandé).

---

## Findings triés par gravité

### 🔴 CRASH PROCESS (le serveur tombe → TOUTES les parties cassent)

Rappel : il n'existe **aucun handler `uncaughtException`** (seulement `unhandledRejection` qui logge). Une exception synchrone dans un callback de timer tue donc le process. J'ai déjà blindé `match.js:later()` cette session — mais le même risque vit ailleurs :

1. **`srv/src/gateway.js` — callbacks différés (heartbeat + gardes) non protégés** (§1 du rapport). Les timers de la passerelle exécutent leur corps sans try/catch : une exception latente y crasherait le process. **C'est le candidat n°1 des « parties cassées ».** *Latent aujourd'hui, catastrophique si déclenché.*
2. **`srv/src/game/bilan.js:90-95` — `absorber` indexe `bilan[auteur]` sans borner `e.par` à {0,1}**, alors que `cible`/`victime` sont gardés partout ailleurs. Un `par` hors {0,1} → `undefined.detruits += n` → TypeError au milieu d'un tour. Entrée moteur (pas client direct) → probabilité faible, impact fort.
3. **`srv/src/migrate.js` — aucune table `schema_migrations`** : tous les `.sql` rejoués à chaque démarrage. Idempotent *aujourd'hui* (22 `ON CONFLICT`, `IF NOT EXISTS`), mais **zéro filet** : le premier `.sql` non-idempotent ajouté casse le 2ᵉ run. `sort()` lexicographique casserait aussi à un `100_x.sql`.
4. **`pd/play_api.py:130-190` — appels HTTP Play sans filet complet** : avorte le déploiement (récupérable par relance), et **F2 (`:312-345`) : la garde anti-écrasement de version peut être défaite** → une version en examen effacée.
5. **`pd/www/js/pages/dice_match.js:1051` / `srv/src/game/succes.js:319-323`** — accès non gardés (`p.etoiles`, `avant.grids[victime][c]`) : théoriques (état serveur bien formé), mais remonteraient jusqu'à `settle`.

### 🟠 PARTIE BLOQUÉE (le joueur reste coincé, pas de crash)

6. **`pd/www/js/core/i18n.js:73` (et copie `app/js/core/i18n.js`) — `detect()` fait `localStorage.getItem` HORS try/catch, appelé au niveau module (`initLang` l.114)**. En navigation privée / WKWebView restreint, l'import d'i18n échoue → **écran noir au démarrage**. Incohérence flagrante : `setLang()` protège bien son `setItem`, pas `detect()`. **Le plus impactant côté client.**
7. **`srv/src/device.js` (F1) — `claim` : rejet de `store.ensurePlayer` non géré, caller sans filet** → login/entrée en partie bloqués si la base hoquette.
8. **`srv/src/apple.js` — `store.*` non gardé** (même forme que device/http) → connexion Apple bloquée sur erreur base.
9. **`pd/www/js/pages/dice_end.js` — `onOver` : `m.scores[…]` et `$('#dc-over')` non gardés**, exception avalée par le routeur → **carte de fin jamais affichée**, le joueur reste sur le plateau mort.
10. **`pd/www/js/pages/dice_solo.js` — un chemin non gardé bloque la partie hors ligne.**
11. **`srv/src/game/match.js` (F3) — `push` propage une exception de `hooks.broadcast`** (faible).

### 🟡 ÉTAT INCOHÉRENT (données fausses, pas de blocage)

12. **`pd/www/js/identity.js:191 (`pret`) — la promesse d'`initialize` est mémoïsée AVEC son rejet** : un échec transitoire fige la connexion Google/Apple pour toute la session (invité OK, liaison compte cassée jusqu'au redémarrage). *Même finding dans `app/js/identity.js`.*
13. **`srv/src/store.js`** — quatre points : `:600-624` parties hors-ligne gratuites en trop ; `:241-256` or de campagne payé deux fois (faible) ; `:762-982` double crédit / note perdue ; `:39-73` mineur.
14. **`pd/www/js/boot.js` (et `app/js/boot.js`) — 3 à 5 points d'état incohérent** (mirroir app/www).
15. **`pd/www/js/core/dom.js` / `pd/www/js/pages/dice_board.js`** — chaîne XSS latente : `esc()` n'échappe pas l'apostrophe, `t()` substitue `{var}` sans échappement, `dieFace()` concatène `value`/`skin` en HTML. Non exploitable par les callers actuels (attributs en guillemets doubles, valeurs numériques) **mais** dangereux si une donnée hostile atteint ces primitives partagées.
16. **`pd/outils/studio.py` / `pd/studio.py:237-261` — slicing négatif corrompt silencieusement** un CSS/HTML si l'en-tête attendu est absent, en répondant `ok:True` (outil de dev).
17. **`srv/src/game/match.js` (F1,F2), `srv/src/migrate.js:12-18` — divers.**

### 🔵 FUITE RESSOURCE / ABUS

18. **`srv/src/gateway.js` (§2,§5) — `settle` peut ne pas détruire le match si une section awaitée lève** ; croissance mémoire lente de `dernierDuel`/`finEnAttente`.
19. **`srv/src/device.js` (F2) — `rateOk` : clé de limitation contrôlable par le client + purge globale** (`hits.clear()` à 5000) → un attaquant peut vider la table de tous.
20. **`pd/outils/vitrine.py` — process bloqué / fuite ressource** (outil).
21. **`pd/www/js/pages/dice_match.js` — un listener/timer non libéré** (faible).

### 🟣 SÉCURITÉ (scripts de déploiement — exécutés en root)

22. **`srv/deploy/tunnel.py:64-67` — binaire `cloudflared` téléchargé depuis `releases/latest` (non épinglé) et exécuté EN ROOT sans aucune vérif d'intégrité** (ni checksum ni signature). Un MITM ou un artefact compromis → exécution root. **Le plus grave côté sécurité.**
23. **`srv/deploy/tunnel.py` — `base.run(client, cmd)` : toute valeur interpolée dans `cmd` est un vecteur d'injection shell exécuté en root.**
24. **`srv/deploy/deploy.py` — mot de passe root en dur (F1) + `AutoAddPolicy` désactive la vérification de clé d'hôte SSH (F2)** → MITM possible sur la connexion de déploiement.
25. **`srv/deploy/wire_tool.py:50-77,107-109` — l'outil peut répondre « OK » alors que le back-end n'est pas branché** (l'inverse de sa raison d'être).

### ⚪ COSMÉTIQUE

`dice_horsligne.js`, `dice_lobby.js` (2), `dice_regles.js`, `musique.js` — sans impact fonctionnel.

### 🧪 TESTS FAUSSEMENT VERTS (couverture qui ment)

26. **`srv/test/lien_compte.test.js` — réimplémente la règle de liaison INLINE et n'appelle jamais `store.lierIdentite`** : le fichier ne prouve rien sur le code de prod ; la règle `display_name` (celle qui a causé le bug « pseudo qui ne change pas ») est **non couverte**.
- Fragiles mais OK : `match.test.js:330,349` (tests sensibles au timing — l'anti-pattern que le fichier lui-même condamne), `search.test.js:195` (banc dépendant de la vitesse machine), `enligne.test.js` (4 tests sans try/finally + mutation globale de `store`), `file_attente.test.js` (branche repli/patience non couverte), `effets2.test.js:628` (assertion conditionnelle vacante).

---

## Patterns récurrents → correctifs transversaux (plutôt que N patchs locaux)

1. **`localStorage` non gardé au démarrage** (`i18n.js:73`, `identity.js:130/366`, `boot.js`) → un seul helper `stockLire()/stockEcrire()` try/catch, utilisé partout. Supprime le risque d'écran noir.
2. **Callbacks de timer non protégés côté serveur** (`gateway.js` heartbeat/gardes) → même remède que `match.js:later()` déjà appliqué : envelopper TOUT corps de `setTimeout`/`setInterval` dans un try/catch qui logge. **Ajouter en plus un `process.on('uncaughtException')` qui logge et NE tue pas** (filet ultime pour tout le serveur).
3. **Rejets `store.*` non gérés remontant au caller** (`device.js:claim`, `apple.js`, `http.js`, `succes.js`) → un wrapper `async` unique autour des handlers de la passerelle qui `catch` et répond une erreur au client au lieu de laisser rejeter.
4. **Promesses mémoïsées incluant le rejet** (`identity.js:pret`) → ne mémoïser QUE sur succès (remettre `prepare = null` dans le `.catch`).
5. **Accès DOM/état de fin non gardés** (`dice_end.js:onOver`, `dice_solo.js`) → garder `m.scores` et les éléments DOM ; ne jamais laisser une exception de rendu de fin avaler la carte.
6. **Index de siège non borné dans le moteur** (`bilan.js:auteur`) → appliquer la même garde `if (x < 0 || x > 1) …` que les autres branches, systématiquement.
7. **Scripts de déploiement root** → épingler la version + vérifier le checksum de `cloudflared` (tunnel.py) ; retirer `AutoAddPolicy` (deploy.py) au profit d'une clé d'hôte connue.
8. **Filet migrations** (`migrate.js`) → table `schema_migrations` + tri numérique, pour ne plus dépendre de l'idempotence manuelle de chaque `.sql`.

---

## Recommandation d'ordre de correction (quand tu voudras)

1. `process.on('uncaughtException')` + try/catch sur les timers `gateway.js` (empêche le crash serveur global — ta douleur n°1).
2. `i18n.js:detect()` try/catch (écran noir au démarrage).
3. `identity.js:pret()` ne mémoïse pas le rejet (login figé).
4. `dice_end.js:onOver` gardé (carte de fin qui n'apparaît pas).
5. Sécurité déploiement (`tunnel.py` checksum, `deploy.py` host key).
6. Le reste (état incohérent boutique, tests faussement verts) au fil de l'eau.

*(Ce document ne corrige rien — il constate. Dis-moi par quoi commencer et je traite dans l'ordre.)*
