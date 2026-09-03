# Rapport — srv/src/grosmots.js (54 lignes)

Filtre d'insultes pour pseudos (≤10 caractères) : normalisation (minuscules, accents retirés, substitutions leet) puis recherche de racines interdites en sous-chaîne. Fonction pure, pas de réseau ni de base.

## a) Fonctions (nom | ligne)
- `normaliser` | 35
- `estInsulte` | 44

**Écart de comptage** : 2 fonctions recensées contre 3 annoncées. Pas de 3ᵉ fonction dans le fichier (le reste est constantes `RACINES`/`COURTES` et `module.exports`) ; surcompte de la métrique auto. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| normaliser | normalise une chaîne (case, accents, leet, ne garde que a-z) | `String(s)` gère null/undefined ; regex simples sans backtracking catastrophique (pas de ReDoS) ; pure | OK |
| estInsulte | vrai si une racine interdite apparaît (mot entier pour les très courtes) | pure, borné par la liste ; `if (!n) return false` | OK |

## c) Findings
Aucun. Fonctions pures, mono-fil, sans async/timer/ressource/état partagé. Entrées bien gardées (`String()`). Les regex sont des classes de caractères simples appliquées globalement — pas de risque de ReDoS même sur entrée hostile. Le filtre est volontairement imparfait (documenté) mais ce n'est pas une faille de robustesse.

Statut : OK
