# Rapport d'audit — `pd/outils/vitrine.py`

Outil HORS LIGNE : rend les captures de boutique dans un Chrome headless piloté
par le protocole CDP sur un **client WebSocket brut « en trente lignes »**
(classe `Navigateur`). Lancé à la main. Démarre un `http.server` et un Chrome en
sous-processus.

## a) Fonctions / méthodes (nom | ligne)
- Navigateur.__init__ | 71
- Navigateur.appel | 97
- Navigateur.js | 127
- Navigateur.taille | 133
- Navigateur.photo | 138
- attendre | 147
- jouer_des_tours | 157
- acheter_des_effets | 181
- parcours | 203
- prendre (imbriquée dans parcours) | 206
- main | 262

Classe : `Navigateur` (70).

**Écart de comptage** : je compte **11** fonctions/méthodes Python (dont
`prendre`, imbriquée). Le lot annonce 12 — écart d'1, probablement une
arrow-function JS embarquée comptée par la métrique auto. Rien de manquant.

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| Navigateur.__init__ | Ouvre le WS CDP (handshake manuel) | **boucle de lecture busy-spin infinie si le pair ferme** ; `socket.create_connection` sans timeout | FAILLE (F1) |
| Navigateur.appel | Envoie une commande CDP, lit la trame réponse | **busy-spin infini si recv() → b""** ; `recv(2)` court → `e[1]` IndexError ; `recv(2/8)` court → struct.error | FAILLE (F1) |
| Navigateur.js | Évalue du JS et renvoie la valeur | propage les erreurs d'`appel` | OK |
| Navigateur.taille | `Emulation.setDeviceMetricsOverride` | aucun propre | OK |
| Navigateur.photo | Capture PNG, écrit le fichier | `r["data"]` KeyError si capture ratée (fail-loud) ; `open(...,"wb")` temp | OK |
| attendre | Sonde une condition JS, bornée par `plafond` | boucle bornée dans le temps | OK |
| jouer_des_tours | Joue quelques tours pour peupler le plateau | sort si `attendre` échoue | OK |
| acheter_des_effets | Achète 3 effets pour ouvrir la cale | `%` de constantes dans du JS (pas d'injection réelle) | OK |
| parcours / prendre | Enchaîne les captures des écrans | séquentiel ; `photo` écrit les fichiers | OK |
| main | Lance http.server + Chrome, boucle langues×formats | **cleanup try/finally bien fait** ; MAIS un blocage dans `Navigateur.__init__` empêche le `finally` de tourner → sous-processus fuités | voir F1 |

## c) Findings détaillés

### F1 — `vitrine.py:93-94`, `112-122` — process bloqué + fuite ressource
Gravité : **process bloqué (hang) / fuite ressource**, faible probabilité (CDP
local répond normalement), mais défaut réel du client WebSocket minimal.

Deux boucles de réception ne gèrent pas la **fermeture du pair** (recv qui
renvoie `b""`) :

Handshake (`__init__`, lignes 93-94) :
```
while b"\r\n\r\n" not in tampon:
    tampon += self.s.recv(4096)
```
Si Chrome ferme la connexion pendant le handshake, `recv` renvoie `b""`
indéfiniment : `tampon` ne grandit jamais, la condition n'est jamais vraie →
**boucle infinie consommant du CPU**.

Corps de trame (`appel`, lignes 120-122) :
```
d = b""
while len(d) < n:
    d += self.s.recv(n - len(d))
```
Même défaut : si le pair ferme en cours de trame, `recv` renvoie `b""`, `len(d)`
reste `< n` → **boucle infinie**. (L'en-tête `recv(2)` ligne 112 est, lui,
protégé par `if not e: raise SystemExit`.)

Conséquence : l'outil se fige. Comme le hang peut survenir dans `__init__` (avant
l'entrée du `try`), le `finally` de `main` (lignes 301-306) ne s'exécute pas → le
Chrome headless et le `http.server` restent lancés (**fuite de sous-processus**).

**Défaut secondaire, même zone** — `appel`, lignes 112-119 : `self.s.recv(2)` (et
`recv(2)`/`recv(8)` pour les longueurs étendues) suppose une lecture complète.
TCP peut renvoyer moins d'octets : une lecture courte de l'en-tête donne
`e[1]` → **IndexError**, ou `struct.unpack(">H"/">Q", ...)` → **struct.error**,
non attrapées. Rare en local, mais latent. Un `recv` en boucle jusqu'à obtenir la
taille exacte corrigerait les deux points.
