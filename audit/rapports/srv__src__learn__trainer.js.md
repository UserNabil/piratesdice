# Rapport — srv/src/learn/trainer.js (175 lignes)

Entraînement IA : régression logistique (Adam) du résultat final sur les traits de position, puis match de qualification contre les poids actifs, promotion seulement si le challenger l'emporte nettement. **Tourne dans son PROPRE processus** (fork depuis la passerelle).

## a) Fonctions (nom | ligne)
- `sigmoid` | 28
- `logloss` | 34
- `fit` | 44
- `loadSamples` (async) | 73
- `promote` (async) | 87
- `train` (async) | 100
- `finish` (async, imbriquée dans train) | 109
- `main` (async) | 155

**Écart de comptage** : 8 fonctions recensées contre 20 annoncées. Écart dû aux arrows (`.map(Number)`, `.some(x=>…)`, callback `tx(async (c) => …)`, `finish`) et à la métrique. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| sigmoid | sigmoïde numériquement stable | branche x≥0 / x<0 anti-overflow ; pur | OK |
| logloss | perte logistique moyenne | `Math.max(p,1e-9)` anti-log(0) ; `/samples.length` (garanti ≥ MIN_SAMPLES par l'appelant) ; pur | OK |
| fit | descente Adam bornée | ITERATIONS=400, clamp w∈[-20,20], dénominateurs jamais nuls ; pur, CPU-lourd mais isolé (fork) | OK |
| loadSamples | charge et VALIDE les échantillons | `LIMIT $1` paramétré ; filtre longueur/finitude des traits et `y∈{0,0.5,1}` — bonne validation de la donnée DB ; rejet propagé | OK |
| promote | transaction : désactive l'actif, insère le nouvel actif | `db.tx` atomique, SQL paramétré ; garantit l'invariant « un seul actif » ; rejet propagé | OK |
| train | orchestre run→fit→gate→promote | tous les `await` remontent à `main` ; `finish` met à jour training_run (skip si runId null) | OK |
| finish | clôt le training_run | `await q(UPDATE …)` paramétré ; rejet propagé | OK |
| main | point d'entrée du process de train | try/catch/finally : catch→exitCode=1, finally→`pool.end()` ; garde `learningEnabled` | OK |

## c) Findings
Aucune faille. Le fichier est robuste : SQL entièrement paramétré, promotion sous transaction (invariant « un seul jeu de poids actif » tenu par l'`UPDATE active=false` + `INSERT active=true` atomiques), et **validation stricte** de la donnée d'entraînement dans `loadSamples`. Observations mineures :

1. **Confirmation du concern selfplay** : `selfplay.duel(...)` (L135, synchrone et bloquant) est appelé ici, mais l'en-tête (L16-18) et `if (require.main === module) main()` (L173) confirment que trainer s'exécute **dans un processus forké dédié**, pas dans le serveur de jeu. Le blocage de l'event loop est donc intentionnel et isolé — pas d'impact sur les parties en cours. C'est la mitigation attendue du finding selfplay #1.

2. **`main()` en fire-and-forget (L173)** — gravité : cosmétique. `main()` n'est pas `.catch`é ; son corps est intégralement enveloppé (try/catch/finally), donc la seule voie de rejet non géré serait un `pool.end()` qui rejette dans le `finally` — invraisemblable et sans conséquence (au pire un log de rejet non géré, dans un process de train jetable).

3. **Concurrence de deux trainers** — gravité : état incohérent (très faible). Deux process de train simultanés pourraient se disputer le numéro de version ; l'index unique sur `version` (et l'unique partiel sur `active`) fait échouer/annuler la transaction perdante. La passerelle est censée n'en forker qu'un à la fois.

Statut : OK
