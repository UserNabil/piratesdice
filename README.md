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

## Ce qu'il reste à faire pour publier

1. **Un serveur joignable depuis l'internet, en HTTPS.** Aujourd'hui l'app parle
   à `192.168.1.19:8100` : ça ne marche que sur le réseau du bureau. Un téléphone
   ne peut pas emprunter le tunnel SSH du tool. Voir « Exposer le service ».
2. **Nom, icône, identifiant de paquet** (`com.edenreforged.piratesdice` est un
   provisoire) et la fiche Play.
3. **Une clé de signature** (`.jks`) + `android/keystore.properties`, et
   `./gradlew bundleRelease` pour l'AAB.
4. **Une politique de confidentialité** en ligne : Play l'exige dès qu'un compte
   existe, même invité.

## Exposer le service

Le port 8100 n'est **pas** ouvert sur l'extérieur, et il n'y a pas de raison de
l'ouvrir en clair. Deux voies, au choix de l'admin :

- **Cloudflare Tunnel** (`cloudflared` sur la machine de jeu) → `dice.<domaine>`
  en HTTPS, sans toucher au routeur, certificat compris. C'est la voie courte, et
  le domaine est déjà chez Cloudflare.
- **Ouvrir 443 vers un reverse-proxy** (Caddy/nginx) avec Let's Encrypt.

Dans les deux cas, rebâtir avec `--server https://…` : c'est la seule chose qui
change côté application.
