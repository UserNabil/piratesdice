# Audit — pd/studio.py

Fichier : `/Users/develop/piratesdice/studio.py` — 368 lignes.
Nature : serveur HTTP local (dev tool) qui règle l'interface et écrit dans `app/css/combat.css`. Lié à `127.0.0.1`.
Fonctions annoncées : 20. Recomptées : **19** `def` (écart de 1 — la métrique auto a probablement compté une compréhension `{…}` ou la classe `Studio` ; aucune fonction manquante).

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| _bloc | 51 |
| _section | 74 |
| _propre | 82 |
| _lire_bloc | 87 |
| _couches | 129 |
| lire_combat | 144 |
| lire_jetons | 171 |
| jetons_poses | 193 |
| poser | 204 |
| remplace (imbriquée dans poser) | 218 |
| enregistrer | 231 |
| Studio.__init__ | 287 |
| Studio.end_headers | 290 |
| Studio._envoyer | 298 |
| Studio._fichier | 306 |
| Studio.do_GET | 312 |
| Studio.do_POST | 328 |
| Studio.log_message | 339 |
| main | 343 |

## b) Analyse fonction par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| _bloc | extrait le contenu `{ … }` après une ancre texte | si `depart` trouvé mais pas de `{` ensuite, `ouvre=-1` et le slice `texte[0:ferme]` renvoie un bloc erroné ; s'arrête au 1er `}` (pas de gestion d'accolades imbriquées, non présentes en CSS ici) | OK (edge case bénin) |
| _section | index de la bannière dont le titre commence par `nom` | renvoie -1 si absent ; appelants qui slicent avec -1 → voir lire_combat / enregistrer | OK |
| _propre | normalise les espaces d'une valeur | aucun | OK |
| _lire_bloc | parse déclarations/commentaires d'un bloc CSS | `d = DECL.match(...)` peut être None si `JETON` a matché une decl que `DECL` refuse (ligne 96 `d.group` sur None) — regex compatibles en pratique mais couplage fragile | OK (fragile) |
| _couches | liste les blocs `#dicewrap {}` (base + @media) | aucun | OK |
| lire_combat | lit les réglages du tableau de bord | `open(COMBAT)` sans try ni `with` ; si `_section` renvoie -1 → tableau vide silencieux ou tronqué | FAILLE (mineure) |
| lire_jetons | lit les jetons partagés de dice.css | `open(DICE)` sans `with` ; dépend de `_bloc` renvoyant non-None | OK (mineur) |
| jetons_poses | relit le bloc déjà écrit par le studio | `open(COMBAT)` sans `with` ; si marqueurs absents → {} propre | OK |
| poser | remplace UNE variable dans le texte via regex | `valeur` client injectée telle quelle dans le CSS écrit ; `nom` échappé (re.escape) donc pas d'injection regex | FAILLE (injection contenu) |
| remplace | callback de substitution regex | aucun (pur) | OK |
| enregistrer | réécrit combat.css puis copie vers www/ | **corruption de fichier si bannières absentes** (slice avec -1) ; `nom`/`valeur` jetons écrits sans validation ; `open` sans `with` | FAILLE |
| Studio.__init__ | fixe le répertoire servi à WWW | aucun | OK |
| Studio.end_headers | force Cache-Control no-store | aucun | OK |
| Studio._envoyer | sérialise et envoie une réponse | `json.dumps` pourrait lever si charge non sérialisable (contrôlée en interne) | OK |
| Studio._fichier | sert un fichier disque | `open(...).read()` sans `with` ; 404 si absent | OK (mineur) |
| Studio.do_GET | routage GET | exception de `lire_combat`/`lire_jetons` non attrapée → 500 par handler (pas de crash process) | OK |
| Studio.do_POST | reçoit le JSON et appelle enregistrer | `int(Content-Length)` et `json.loads` HORS du try → requête 500 sur en-tête/corps malformé | FAILLE (mineure) |
| Studio.log_message | silencie les logs | aucun | OK |
| main | parse args, vérifie fichiers, lance le serveur | serveur mono-thread (TCPServer) → pas de course ; KeyboardInterrupt géré | OK |

## c) Findings détaillés

### F1 — enregistrer: corruption possible de combat.css si les bannières ne sont pas trouvées
`studio.py:237` puis `studio.py:261`
```python
debut, fin = _section(texte, "LE TABLEAU DE BORD"), _section(texte, "LE CABLAGE")
tableau = texte[debut:fin]
...
texte = texte[:debut] + "".join(morceaux) + texte[fin:]
open(COMBAT, "w", encoding="utf-8", newline="\n").write(texte)
```
Gravité : **état incohérent (corruption de fichier source)**.
`_section` renvoie `-1` si la bannière est absente. Aucun contrôle sur `debut`/`fin` avant les slices. Si `debut == -1` (ou `fin == -1`), `texte[:debut]` retire le dernier caractère, `texte[fin:]` prend le dernier caractère : le fichier réécrit est silencieusement corrompu et la réponse renvoie `ok: True`. Le slicing négatif ne lève **aucune exception**, donc le try/except de `do_POST` ne protège pas. Un `combat.css` dont l'en-tête a été renommé/supprimé se fait tronquer sans avertissement. Même faiblesse en lecture dans `lire_combat` (`studio.py:147-148`) mais là seulement une lecture tronquée (moins grave).

### F2 — enregistrer / poser: valeurs et noms client écrits dans le CSS sans validation
`studio.py:216-222` (poser) et `studio.py:270` (jetons)
```python
propre = re.sub(r"\s+", " ", valeur).strip()
...
return "%s%s: %s;" % (marge, nom, propre)
...
lignes = "\n".join("  %s: %s;" % (n, v) for n, v in sorted(jetons.items()))
```
Gravité : **état incohérent** (injection de contenu CSS ; portée limitée car outil localhost).
`nom`/`valeur` (et `n`/`v` des jetons) viennent directement du corps JSON du POST. `valeur` n'est jamais validée : un client hostile (ou un bug côté front) peut envoyer `red; } #dicewrap{} evil` et injecter des règles arbitraires, voire fermer prématurément le bloc `#dicewrap`. Ce n'est pas de l'exécution de code (CSS écrit dans un fichier local, serveur lié à 127.0.0.1), mais l'écriture de contenu non fiable dans un fichier source partagé mérite un garde-fou (liste blanche de `nom`, échappement/validation de `valeur`).

### F3 — do_POST: en-tête et corps parsés hors du bloc protégé
`studio.py:331-332`
```python
taille = int(self.headers.get("Content-Length", 0))
charge = json.loads(self.rfile.read(taille) or b"{}")
try:
    ecrits, manquants = enregistrer(charge)
```
Gravité : **partie/requête bloquée (mineure, dev tool)**.
`int(Content-Length)` lève `ValueError` sur un en-tête non numérique ; `json.loads` lève `JSONDecodeError` sur un corps invalide. Les deux sont AVANT le `try`, donc renvoient une 500 non maquillée au lieu du `{ok:False, erreur}` prévu. De plus `read(taille)` avec une `Content-Length` gigantesque tente d'allouer/lire d'un coup (pas de plafond). Le serveur étant mono-thread, une requête bloquée bloque le studio. Pas de crash du process (le handler http.server encapsule).

### F4 — Ouvertures de fichiers sans `with` (ressource)
`studio.py:146, 173, 195, 233, 279, 310`
```python
texte = open(COMBAT, encoding="utf-8").read()
...
open(COMBAT, "w", encoding="utf-8", newline="\n").write(texte)
```
Gravité : **fuite ressource (théorique)**.
Aucun handle n'est fermé explicitement ; en CPython le refcount ferme immédiatement après `.read()/.write()`, donc l'impact réel est nul ici, mais le motif est fragile (pas garanti hors CPython, et l'écriture ligne 279 sans flush explicite avant `shutil.copy2` repose sur la fermeture par GC).

Note concurrence : `socketserver.TCPServer` traite les requêtes en série (pas de `ThreadingMixIn`), donc le cycle lire-modifier-écrire de `enregistrer` n'a pas de course concurrente — invariant préservé tant que le serveur reste mono-thread.
