# srv/sql/029_campagne.sql

0 fonction PL/pgSQL — migration SQL schema+donnee (2 CREATE TABLE + 1 INSERT ON CONFLICT).
Ecart avec le lot : le lot annonce nb_fonctions=2 ; il n'y a AUCUNE fonction (la
metrique a probablement compte les 2 CREATE TABLE). Recompte manuel : 0 fonction.

## Contenu
- `CREATE TABLE IF NOT EXISTS campaign_level (...)` (l.22-35)
- `CREATE TABLE IF NOT EXISTS campaign_progress (...)` avec FK ON DELETE CASCADE vers player et campaign_level (l.37-43)
- `INSERT INTO campaign_level (...) VALUES (75 lignes) ON CONFLICT (identify) DO UPDATE` (l.45-126)

## Risques
- Valeurs litterales, aucune entree client : pas d'injection.
- Idempotent : `IF NOT EXISTS` + upsert. FK CASCADE coherentes.
- Les cles de contraintes (`sum.detruits`, `max.score`, ...) sont des cles de releve
  consommees par le code (succes.compteurs) : pure donnee ici, pas de risque.

## Statut : OK
