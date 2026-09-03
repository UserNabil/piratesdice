# Audit — pd/app/js/ui/toast.js (63 lignes)

Fichier lu EN ENTIER. Lot annonce **8 fonctions** ; **2 nommées** (`host`, `toast`) + arrows setTimeout/rAF → écart dû au compteur auto.

## (a) Fonctions

| nom | ligne |
|---|---|
| host() | 7 |
| toast(msg, type) (export) | 34 |
| (arrows) setTimeout/rAF de vie du bandeau | 45, 47, 56, 57, 59 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| host | conteneur `#pd-toasts` (créé au besoin) | idempotent (réutilise l'existant) | OK |
| toast | affiche un bandeau, dé-doublonne les messages identiques | contenu posé via `textContent` (l.54) → PAS d'injection ; `String(msg==null?'':msg)` ; `clearTimeout` avant nouveau `setTimeout` → pas d'accumulation ; `derniere.note.isConnected` évite de ranimer un nœud retiré | OK |

## (c) Findings

- **Aucune faille.** Anti-spam correct : un message identique dans la fenêtre `REPETITION_MS` ranime le bandeau existant (`clearTimeout(derniere.minuteur)` l.44 puis re-`setTimeout`) au lieu d'en empiler un ; les minuteurs sont toujours annulés avant recréation → aucune fuite. Le texte passe par `textContent`, donc aucune interprétation HTML même si l'appelant compose des phrases traduites.
- Concurrence (point 7) : mono-thread ; `derniere` cohérent.

**Verdict : OK**
