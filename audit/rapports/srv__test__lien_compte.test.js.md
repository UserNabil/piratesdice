# Audit — srv/test/lien_compte.test.js (83 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **7 fonctions**,
**7 trouvées** (écart 0 : `base`, `creer`(méthode), `lier`(méthode), 4 rappels `test`).

## (a) Fonctions

| nom | ligne |
|---|---|
| `base` | 17 |
| `creer` (méthode) | 23 |
| `lier` (méthode) | 32 |
| test « le pirate du telephone garde tout… » | 44 |
| test « l appareil retrouve le meme pirate… » | 56 |
| test « un compte qui a deja son pirate garde le sien » | 66 |
| test « sans appareil connu, la liaison cree un pirate neuf » | 78 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `base` | base en mémoire (Map joueurs + Map alias) | aucun | OK |
| `creer` | insère un joueur + alias | aucun | OK |
| `lier` | **RÉIMPLÉMENTE la règle de liaison à la main** ; le commentaire dit « telle qu'elle est écrite dans store.lierIdentite » — mais c'est une COPIE, pas un appel | **faussement vert** (voir findings) | FAILLE |
| tests l.44-83 | vérifient fusion / non-fusion / création sur la copie inline | assertions présentes et correctes… mais portent sur le mock, pas sur `src/store.js` | FAILLE (par ricochet) |

## (c) Findings

- **lien_compte.test.js:32-40 | faussement vert (fausse confiance / état incohérent)** :
  ```js
  lier(sujet, sujetAppareil) {
    if (alias.has(sujet)) return { joueur: joueurs.get(alias.get(sujet)), fusion: false };
    if (sujetAppareil && alias.has(sujetAppareil)) { ... return { joueur: j, fusion: true }; }
    return { joueur: this.creer(sujet), fusion: false };
  }
  ```
  Ce `lier` est une **réécriture manuelle** de la règle. Le VRAI code testé devrait
  être `store.lierIdentite` (src/store.js:39), qui est `async`, passe par Postgres
  (`q(...)`) et `joueurDeAlias`/`ensurePlayer`. Le test n'importe même pas `store`.
  Conséquence : si `store.lierIdentite` régresse (le bug historique « un compte de
  plus à chaque connexion Apple » décrit dans l'en-tête), **ces tests restent
  verts** — ils valident une copie, pas la production.

- **lien_compte.test.js (couverture) | règle réelle non testée** : `store.lierIdentite`
  a une logique **display_name** entièrement absente du mock — « LE NOM EN BASE FAIT
  FOI, la connexion ne le réécrit pas » (store.js:41-55), le fix documenté « j'ai
  renommé barbarossa en nabil ios, ça n'a pas changé ». Le mock `lier` ne prend même
  pas de `displayName` en argument. Ce comportement — le plus subtil et le plus
  régressible — n'a **aucune couverture**.

- Aucun risque de timing/async dans le fichier lui-même (tout est synchrone), mais
  c'est précisément parce qu'il évite le vrai code async. Assertions présentes et
  justes sur le mock ; le défaut est qu'elles ne prouvent rien sur `src/store.js`.

**Verdict : FAILLES(1) — faussement vert (réimplémentation de store.lierIdentite au
lieu de l'appeler ; comportement display_name réel non couvert)**
