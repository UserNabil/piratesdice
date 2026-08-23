# The Pirate's Dice — l'application Android

Le jeu du tool, dans un téléphone. **Il n'y a pas deux versions du jeu** :
`build.py` recopie `static/js/pages/dice*.js`, `static/css/dice.css` et
`static/dice/**` à chaque build. Un correctif fait dans Reforged Studio arrive
dans l'application au build suivant, sans que personne ait à y penser.

## Ce qui est propre au mobile

| Fichier | Rôle |
|---|---|
| `app/index.html` | la page ; `__PD_SERVER__` y est remplacé au build |
| `app/js/boot.js` | premier lancement (nom du capitaine), bouton RETOUR, réglages |
| `app/js/identity.js` | le secret d'appareil et la session — **remplace le tool** |
| `app/js/fit.js` | la taille des cases, **mesurée** et non devinée |
| `app/js/core/`, `app/js/ui/` | les 4 modules que le jeu importe du tool (dom, api, toast, dialogs) |
| `app/css/mobile.css` | la couche portrait, posée **par-dessus** `dice.css` (jamais modifié) |
| `app/fonts/` | Cinzel + Spectral embarquées (SIL OFL) : une app s'ouvre hors ligne |

## Construire

```bash
cd tools/eden_ultimate_tool/dice_server/mobile
python build.py --server http://192.168.1.19:8100     # assemble www/ + vérifie
npx cap sync android                                   # pousse www/ dans le projet Android

cd android
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug
# -> app/build/outputs/apk/debug/app-debug.apk   (~10 Mo)
```

`build.py` **refuse de finir** si un import relatif ou une référence de la page
ne tombe pas sur un fichier réel : c'est le seul garde-fou contre l'écran noir
(un module manquant ne produit aucun message dans une WebView).

## Essayer sans téléphone

```bash
cd www && python -m http.server 8095
# puis un navigateur en 360x740, ou le script de session : t_mobile.py
```

## L'identité du joueur

Le tool signait le jeton parce qu'il savait qui était connecté. Un téléphone ne
sait rien de tel, et **l'APK ne doit pas porter le secret du serveur** : il se
décompile, et quiconque l'extrairait pourrait forger l'identité d'un autre.

Le téléphone tire donc **son propre secret de 256 bits** au premier lancement,
le garde chez lui, et l'échange contre un jeton d'une heure :

```
POST /api/device   { "deviceId": "<64 hexa>", "name": "Barbe Noire" }
   -> { "token": "...", "expires": ..., "player": { ... } }
```

Le sujet du jeton est le **HMAC** du secret (`sea-…`), jamais le secret. C'est un
compte invité : rien à retenir, rien à voler dans l'application. Effacer ses
données se fait depuis ⚙ → *Erase my data* (exigence de la fiche Play).

## Déployer

```
python3 play_api.py --check          # ce que portent les pistes
python3 play_api.py --historique     # ce qu'on a envoyé, et ce qui n'est jamais sorti
```

**Une piste ne porte qu'une version.** Pousser pendant que la précédente est en
examen ne l'ajoute pas : elle la **remplace**, et l'ancienne passe « Non publiée »
sans jamais atteindre un testeur. Le 23 août 2026, onze paquets avaient été
envoyés et les testeurs en étaient restés à la 1.0.22 du 21 août — neuf versions
s'étaient effacées les unes les autres.

Aucun champ de l'API Play ne dit « en examen » : `completed` signifie seulement
« diffusion demandée à 100 % ». Le seul endroit qui le dise est la console.
D'où le cycle :

1. envoyer — `play_api.py` note la version dans `store/dernier-envoi.json` ;
2. **attendre**, toute nouvelle poussée sur cette piste est refusée ;
3. lire *Play Console → Tests fermés → alpha → Versions* ;
4. quand la version dit « Accessible sur Google Play » :
   `python3 play_api.py --sortie 55 --track alpha` — la piste rouvre.

`--forcer` passe outre. Il n'a de sens que pour remplacer sciemment une version
en examen dont on ne veut plus.

Côté iOS, `publier-ios.py` fait l'équivalent ; Apple, lui, expose bien l'état
(`asc.py get /v1/apps/6804324160/appStoreVersions`).

## Exposer le service

Le port 8100 n'est **pas** ouvert sur l'extérieur, et il n'y a pas de raison de
l'ouvrir en clair. Deux voies, au choix de l'admin :

- **Cloudflare Tunnel** (`cloudflared` sur la machine de jeu) → `dice.<domaine>`
  en HTTPS, sans toucher au routeur, certificat compris. C'est la voie courte, et
  le domaine est déjà chez Cloudflare.
- **Ouvrir 443 vers un reverse-proxy** (Caddy/nginx) avec Let's Encrypt.

Dans les deux cas, rebâtir avec `--server https://…` : c'est la seule chose qui
change côté application.
