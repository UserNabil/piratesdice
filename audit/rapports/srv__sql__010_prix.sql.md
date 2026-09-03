# Audit — srv/sql/010_prix.sql

Fichier : `/Users/develop/dice-server/sql/010_prix.sql` — 24 lignes.
Nature : **migration SQL — 0 fonction**. `UPDATE product SET basic_price = 300, premium_price = 600` pour tous les cosmétiques (catégories `Skin`/`Motif`), **sauf** les ornements légendaires M005–M008 (sans prix, gagnés aux hauts faits).
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun**.
- Un seul `UPDATE` sur des catégories/identifiants littéraux → pas d'injection, pas de secret, pas de shell.
- Rejoué à chaque démarrage (autorité du prix) ; l'exclusion `identify NOT IN ('M005','M006','M007','M008')` protège les légendaires de la remise à 300/600. Sûr et idempotent.

Observation (non-risque) : le libellé « 300 pièces » du bandeau vise le prix `basic` ; `premium_price = 600` est la monnaie premium — pas une contradiction.
