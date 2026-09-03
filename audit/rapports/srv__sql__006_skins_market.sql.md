# Audit — srv/sql/006_skins_market.sql

Fichier : `/Users/develop/dice-server/sql/006_skins_market.sql` — 28 lignes.
Nature : **migration SQL — 0 fonction**. Fixe ce qui est en vente : `UPDATE product SET enabled = false` pour S003/S004/S005/S007, `= true` pour S002/S006.
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun**.
- Uniquement des `UPDATE` sur des identifiants littéraux → pas d'injection, pas de secret, pas de shell.
- Rejoué à chaque démarrage (le commentaire le pose explicitement comme l'autorité de « ce qui est en vente ») → désactive sans supprimer, donc l'inventaire des joueurs (`ON DELETE CASCADE`) est préservé. Comportement voulu et sûr.
