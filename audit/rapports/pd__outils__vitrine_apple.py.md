# Rapport d'audit — `pd/outils/vitrine_apple.py`

Outil HORS LIGNE : pousse les captures d'écran sur App Store Connect (jeton ES256
via `asc`). Lancé à la main. Réseau sans dépendance (urllib).

## a) Fonctions (nom | ligne)
- api | 29
- deposer | 45
- jeu_de_captures | 53
- poser | 71
- main | 96

5 fonctions — conforme au lot (5).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| api | Appel REST ASC, lève `SystemExit` sur HTTPError | **pas de `timeout` sur `urlopen`** → blocage possible si le serveur stalle ; `URLError`/timeout réseau non attrapés (fail-loud) | OK (voir note) |
| deposer | PUT/POST binaire d'un morceau de capture | pas de timeout ; erreur remontée à `poser` qui nettoie | OK |
| jeu_de_captures | Jeu existant (vidé) ou neuf pour un format | `s["attributes"][...]` KeyError si l'API change (fail-loud) | OK |
| poser | Réserve, téléverse par morceaux, confirme | **try/except propre** : sur échec, DELETE la réservation (« jamais de réserve orpheline ») puis `raise` | OK |
| main | Parcourt langues × formats, pose les captures | `["data"][0]` → IndexError si le bundle est introuvable (fail-loud) ; captures/dossier absents gérés par `continue` | OK |

## c) Findings détaillés
Aucune faille bloquante. La gestion de ressource est **bien faite** : `poser`
(lignes 82-92) supprime toujours la réservation ASC en cas d'échec d'upload avant
de relever l'exception, évitant une réservation orpheline.

- `vitrine_apple.py:37` et `:49` — robustesse faible : `urllib.request.urlopen`
  sans `timeout`. Un serveur qui n'envoie jamais la fin de réponse ferait
  **pendre l'outil indéfiniment** (point 6). Gravité cosmétique (outil manuel,
  interruptible au clavier ; ASC répond normalement) ; à noter car `play_api.py`,
  lui, met bien des timeouts.
- Note : si le DELETE de nettoyage (ligne 91) échoue à son tour (HTTPError →
  `SystemExit`), il masque l'exception d'upload d'origine. Impact mineur.
