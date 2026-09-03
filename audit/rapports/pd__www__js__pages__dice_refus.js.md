# Rapport d'audit — pd/www/js/pages/dice_refus.js

Fichier lu en entier (105 lignes). Rôle : table de traduction des refus du serveur
(anglais → clés i18n), partagée par la socket et les routes HTTP, plus une fonction
de résolution. L'essentiel du fichier est une donnée (l'objet `REFUS`).

## a) Liste des fonctions

| nom | ligne |
|---|---|
| messageServeur | 101 |

Comptage conforme au lot (1). L'objet `REFUS` (l.22-99) est une donnée pure
(0 fonction).

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| messageServeur | traduit un message de refus brut | garde `!brut` → 'err.refused' ; repli sur le brut si clé inconnue ; `REFUS[brut]` sans hasOwnProperty (voir c) | OK |

## c) Findings détaillés

Aucune FAILLE.

Observation de très faible gravité :

1. `messageServeur` — dice_refus.js:103 `const cle = REFUS[brut];` — gravité :
   cosmétique. La recherche ne filtre pas les propriétés héritées : un `brut`
   égal à `'constructor'`/`'toString'`/`'__proto__'` trouverait une propriété de
   `Object.prototype` (fonction ou objet), rendrait `cle` truthy, et appellerait
   `t(cle)` avec une valeur non-chaîne — sortie incohérente possible selon
   l'implémentation de `t()`. `brut` vient du serveur de confiance et ces chaînes
   ne sont jamais de vrais messages de refus : probabilité nulle en pratique.
   C'est une LECTURE, aucune pollution de prototype. Un
   `Object.prototype.hasOwnProperty.call(REFUS, brut)` fermerait la porte, mais
   l'impact ne le justifie pas.

Nature « donnée » : l'objet `REFUS` ne contient ni secret, ni commande, ni
injection — uniquement des correspondances message→clé i18n. Un message inconnu
retombe volontairement sur le texte brut (repli documenté). Pas d'async, pas de
ressource, pas d'état partagé.

Statut fichier : OK.
