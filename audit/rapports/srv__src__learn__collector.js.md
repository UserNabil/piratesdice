# Rapport — srv/src/learn/collector.js (75 lignes)

Collecte les positions d'entraînement de l'IA : chaque pose devient un vecteur de traits (vu des deux sièges) étiqueté par le résultat, inséré en base ; élagage à 400 000 lignes ; compteur d'échantillons en attente. Aucune identité de joueur enregistrée.

## a) Fonctions (nom | ligne)
- `samplesFrom` | 22
- `store` (async) | 37
- `prune` (async) | 56
- `count` (async) | 62
- `pending` | 67
- `resetPending` | 71

**Écart de comptage** : 6 fonctions recensées contre 9 annoncées. Écart dû à l'arrow `rows.forEach((row, i) => …)` et à la métrique auto. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| samplesFrom | déplie un trail en lignes {seat,mode,features,result} | `evalMod.features(step.grids, …)` peut throw si step malformé (trail serveur, interne) ; `results[seat]` supposé défini | OK |
| store | insère les échantillons (INSERT paramétré) | garde `!learningEnabled/!trail/!length` ; SQL **paramétré** (`$n`) — pas d'injection ; `pendingSinceTraining += rows.length` APRÈS l'await (compte le persisté) ; rejet de `q` propagé à l'appelant (gateway) | OK |
| prune | supprime au-delà de MAX_ROWS | `MAX(id)-$1` NULL si table vide → aucune suppression (sûr) ; paramétré ; rejet propagé | OK |
| count | compte les lignes | rejet propagé (http.js le `.catch(()=>0)`) | OK |
| pending | lit le compteur module | trivial | OK |
| resetPending | remet le compteur à 0 | trivial | OK |

## c) Findings
Aucune faille. SQL entièrement paramétré (le `values.join(',')` n'assemble que des placeholders `($n,…)`, jamais des données). Points de vigilance faibles :

1. **État de module partagé `pendingSinceTraining` (L20)** — gravité : cosmétique. Incrémenté dans `store` (synchrone, hors await → pas de perte de MAJ en mono-fil), lu par `pending`, remis à 0 par `resetPending`. Un `resetPending` intercalé entre l'await d'un `store` et son incrément pourrait sur/sous-compter légèrement — heuristique de déclenchement d'entraînement, sans impact fonctionnel.

2. **Rejets de `store`/`prune` propagés à l'appelant** — gravité : dépend de gateway. Si `collector.store(...)`/`prune()` est appelé sans `.catch`/await gardé dans `gateway.settle`, un échec DB d'insertion d'échantillons remonte ; à vérifier côté gateway (rattrapé in fine par `process.on('unhandledRejection')` d'index.js — ne fait pas tomber le process).

Statut : OK
