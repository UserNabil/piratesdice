# Rapport — pd/.github/workflows/play-listing.yml

**0 fonction** — Workflow GitHub Actions (YAML) : publication de la FICHE Play (titres, descriptions, images, coordonnees) quand `store/**` change, hors `store/dernier-envoi.json`.

## Fonctions
Aucune (fichier de configuration CI).

## Risques evidents
- **Secrets** : `PLAY_SERVICE_ACCOUNT_JSON` injecte via `env:` a chaque etape ; aucun secret en clair, aucune cle materialisee sur disque.
- **Aucune interpolation d'entree non fiable** dans un `run` — pas de surface d'injection.
- **Concurrency** : meme `group: play` que android-release.yml pour serialiser les editions Play. Correct.
- **Filtre de chemins** : `paths: ['store/**', '!store/dernier-envoi.json']` (ligne 27) evite la republication en boucle apres chaque envoi. Correct.

## Statut : OK
