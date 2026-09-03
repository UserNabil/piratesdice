# Rapport — srv/src/game/succes.js (643 lignes)

Traduit une partie terminée en compteurs (`sum.*` s'ajoute, `max.*` garde le plus grand, `now.*` écrase) que le catalogue de succès en base lit ensuite. Fichier purement calculatoire, appelé une fois en fin de partie (gateway.settle).

## a) Fonctions (nom | ligne)
- `plus` | 31
- `record` | 37
- `triples` | 47
- `colonnesPleines` | 56
- `colonneDuQuart` | 63
- `mesures` | 87
- `compteurs` | 239
- `quartsRanges` | 309
- `valeursDetruites` | 319
- `suiteMax` | 325
- `faits` | 335
- `derives` | 618

**Écart de comptage majeur** : 12 fonctions nommées recensées contre 95 annoncées au lot. L'écart est entièrement dû à la métrique auto qui compte chaque arrow-function inline — ce fichier en contient des dizaines (`.filter(l => …)`, `.map(…)`, `.every(…)`, `.some(…)`, `.reduce(…)`, plus les callbacks locaux `moy`, `compte`). Aucune fonction cachée : fichier lu en entier (3 tranches).

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| plus | ajoute n à une clé (crée au besoin) | `if (!n) return` court-circuite 0/NaN/undefined ; clé = concaténation de chaînes, jamais de throw | OK |
| record | garde le max si n>0 | `if (!(n>0)) return` neutralise NaN/négatif/undefined | OK |
| triples | nb de colonnes à 3 dés identiques | `rules.columnValues` sur grille par défaut `[]` (garde `|| []` chez les appelants) ; borné COLUMNS | OK |
| colonnesPleines | nb de colonnes pleines | borné | OK |
| colonneDuQuart | index de la colonne portant ce quart, -1 sinon | `if (!Array.isArray(quarts)) return -1` — validation explicite | OK |
| mesures | tous les compteurs qu'une partie ajoute (aussi lus pour les étoiles de campagne) | défensif partout (`|| {}`, `|| []`, `|| 0`) ; `Math.max.apply(null, cols)` gardé par `cols.length ?` | OK |
| compteurs | la « porte » : ne compte que les parties en ligne finies contre un humain (sauf 2 compteurs IA) | déserteur → remise à 0 des séries puis `return` ; `Object.assign(out, mesures(...))` | OK |
| quartsRanges | range les 4 colonnes par leur quart | délègue à colonneDuQuart | OK |
| valeursDetruites | valeurs des cases détruites, relues dans l'image précédente | voir finding #1 : accès `avant.grids[victime][c]` non gardé en profondeur | OK (faible) |
| suiteMax | plus longue suite d'égalité consécutive | pure, borné | OK |
| faits | tout ce que le journal/les images racontent (le gros des compteurs) | défensif (`Array.isArray(images)`, filtres `l && l.t===…`) ; qqs `.reduce((n,p)=>n+p.v)` → NaN si journal malformé (données serveur) | OK |
| derives | recompte les collections (`max.*`) à partir des cumuls | `cumul` supposé objet non-null (interne) | OK |

## c) Findings
Aucune faille bloquante. Le fichier est mono-fil, sans async/timer/socket/listener, et sans état de module mutable (chaque appel construit son propre `out = {}`). Points de vigilance à faible gravité, tous conditionnés à des **données serveur malformées** (les entrées viennent de l'état de partie et du journal produits par le serveur, pas du client) :

1. **`valeursDetruites` (L319-323)** — gravité : partie bloquée (théorique). Garde `if (!avant || !cellules) return []` mais **ne vérifie pas** `avant.grids` ni `avant.grids[victime]`. Si une image précédente existe sans `grids[victime]`, `cellules.map((c) => avant.grids[victime][c])` lève une TypeError non attrapée ici ; remontée jusqu'à `faits` → `mesures`/`compteurs` → `gateway.settle`. Si settle ne l'encapsule pas, le règlement de fin de partie échoue. Non atteignable avec les images bien formées de `rediffusion.js` et un `victime` = siège valide ; robustesse à confirmer côté appelant (gateway).

2. **Clés de compteur dérivées de valeurs de contexte non validées ici** (ex. `'sum.victoires.cap.' + c.capitaine` L106, `'sum.affronte.cap.' + contexte.capitaineAdverse` R110) — gravité : cosmétique/état incohérent. Si `capitaine`/`capitaineAdverse` porte une valeur inattendue, elle devient une clé de compteur persistée. Aucun risque d'injection tant que la persistance en base est paramétrée (à vérifier côté settle/DB), mais la validation de ces champs n'est pas faite dans ce fichier.

3. **Sommations sur le journal** (ex. `poses.reduce((n,p)=>n+p.v, 0)` R8/R9 de la tranche 3) donnent NaN si une entrée `pose` n'a pas de `v` numérique — pas de crash, seulement un compteur faux. Dépend de la bonne forme du journal serveur.

Statut : OK
