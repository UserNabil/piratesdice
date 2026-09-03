# srv/sql/031_succes_2.sql

0 fonction — migration SQL de DONNEE (INSERT ON CONFLICT DO UPDATE + UPDATE), rejouable.
Ecart avec le lot (nb_fonctions=0) : conforme.

## Contenu
- `INSERT INTO achievement (...) VALUES (A101..A200) ON CONFLICT (identify) DO UPDATE ... enabled=true` (l.13-123)
- `UPDATE achievement SET enabled=false WHERE identify IN (16 mesures pas encore implementees)` (l.125-126)

## Risques
- Valeurs litterales, aucune entree client : pas d'injection.
- Idempotent (upsert). Coherent avec sql/016 (meme contrat). Les succes sans mesure
  sont inseres puis re-desactives explicitement : pas de succes injouable actif. OK.

## Statut : OK
