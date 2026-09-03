# Audit — pd/app/js/ui/volumes.js (97 lignes)

Fichier lu en entier. Lot annonce **10 fonctions** ; **6 fonctions nommées + 1 arrow = 7 trouvées** (écart -3 : la métrique auto gonfle ; il n'y a que 6 `function` + 1 `=>` dans ce fichier). Module client (runtime jeu) : garde les niveaux de deux canaux audio dans `localStorage` et prévient des abonnés. Ne joue aucun son.

## (a) Fonctions

| nom | ligne |
|---|---|
| borne | 45 |
| lire | 51 |
| volumes | 62 |
| facteur | 71 |
| reglerVolume | 77 |
| surVolume | 93 |
| (arrow) `() => abonnes.delete(fn)` | 96 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| borne | borne un nombre à [0,100], repli sur `defaut` | `Number(null/undefined/'x')`→NaN→`!Number.isFinite`→`defaut`. Entrées hostiles bien gérées. | OK |
| lire | lit `pd.volumes` de localStorage, JSON.parse en try/catch | parse en échec → `{}` → valeurs bornées par `borne`. Contenu abîmé/hostile inoffensif (seuls deux nombres bornés extraits). | OK |
| volumes | charge paresseusement `niveaux`, renvoie une copie | aucun | OK |
| facteur | facteur de gain d'un canal | canal inconnu → `volumes()[canal]` undefined → `undefined/100`=NaN → **renvoie NaN** ; appliqué à un GainNode ce serait un gain invalide. Mais `canal` est une constante interne ('effets'/'musique'). Cosmétique. | OK |
| reglerVolume | écrit un curseur, persiste, notifie les abonnés | localStorage en try/catch (mode privé → session seule) ; chaque abonné appelé en try/catch isolé (un abonné cassé n'en punit pas un autre). Canal inconnu → écrirait une clé parasite + `borne(x, undefined)` (undefined si x invalide). Cosmétique. | OK |
| surVolume | abonne `fn`, l'appelle une fois `fn(null,null)`, renvoie le désabonnement | appel initial en try/catch ; renvoie `() => abonnes.delete(fn)` pour libérer. | OK |
| arrow l.96 | désabonne | aucun | OK |

## (c) Findings

- **volumes.js:73 | cosmétique** | `return (v / 100) * (PLAFOND[canal] || 1);` — `facteur('inconnu')` renvoie `NaN` (v=undefined). Non atteignable en pratique (`canal` ∈ {effets, musique}, constantes du code). À noter seulement.
- **Grille 8 points** : (1) exceptions localStorage/JSON.parse/abonnés toutes attrapées ; (2) pas d'async ; (3) pas de callback différé ; (4) `borne` valide correctement null/undefined/hors-bornes ; (5) échec localStorage → réglage vaut pour la session, jamais bloquant ; (6) `surVolume` fournit le désabonnement, pas de fuite (le `Set abonnes` grandit si un abonné n'appelle jamais son désabonnement — comportement normal) ; (7) JS mono-thread, `niveaux`/`abonnes` sans vraie course ; (8) valeurs de retour, pas de code d'erreur ignoré.

**Verdict : OK**
