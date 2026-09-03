# Audit — srv/sql/002_learning.sql

Fichier : `/Users/develop/dice-server/sql/002_learning.sql` — 38 lignes.
Nature : **migration SQL — 0 fonction**. Tables d'apprentissage IA : `ai_weights`, `training_sample`, `training_run` + index.
Métrique du lot : 4 « fonctions ». **Écart attendu** : SQL sans fonction ; l'auto-compteur a compté les 3 `CREATE TABLE` + index. Aucune fonction réelle.

Risques évidents : **aucun**.
- Aucune valeur dynamique, aucun secret, aucune commande shell.
- Idempotent (`IF NOT EXISTS` partout).

Observation (non-risque, plutôt un point fort) : `CREATE UNIQUE INDEX ai_weights_one_active ON ai_weights (active) WHERE active` garantit **un seul** jeu de poids actif à la fois — invariant métier protégé au niveau base, pas seulement en code.
