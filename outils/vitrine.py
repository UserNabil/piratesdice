#!/usr/bin/env python3
"""
outils/vitrine.py — LES CAPTURES DE BOUTIQUE, RENDUES HORS ECRAN.

    python3 outils/vitrine.py                       # les quatre langues, tous formats
    python3 outils/vitrine.py --langues fr --formats phone

⛔ L'AUTRE OUTIL PILOTE LE SIMULATEUR, ET IL PREND LA SOURIS. `outils/captures.py`
deplace le vrai curseur avec `cliclick` et met la fenetre du simulateur au
premier plan : pendant qu'il travaille, la machine ne s'utilise plus. « Tu
m'occupes la souris et le simulateur alors que je les utilise. » C'est
rehdibitoire pour un travail qui dure plusieurs minutes et qu'on refait souvent.

Le jeu est une page web : il se rend dans un navigateur SANS FENETRE, a la
taille exacte demandee par chaque boutique, et il se pilote par le protocole de
debogage — `element.click()` plutot qu'un curseur physique. Rien n'est vole a
personne, et c'est dix fois plus rapide.

⚠️ CE N'EST PAS UNE MAQUETTE POUR AUTANT. C'est le vrai `www/`, le vrai serveur
de jeu, une vraie partie contre l'IA : ce que la boutique montrera est ce que le
joueur trouvera. La seule chose qui manque est la barre d'etat du telephone, que
les boutiques n'exigent pas.

LES TAILLES. Apple veut du 6,9 pouces (1320 x 2868) ; Play veut trois familles
(telephone, 7 pouces, 10 pouces). On rend a la bonne taille plutot que
d'agrandir une image : un texte rendu a 1320 est net, un texte etire depuis 390
ne l'est pas.
"""
import argparse
import base64
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import time

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
WWW = os.path.join(RACINE, "www")
CHROME = ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
PORT_WEB = 8971
PORT_CDP = 9411

# Ce que chaque boutique demande. La largeur et la hauteur sont en PIXELS de
# l'image finale ; `echelle` dit combien de pixels pour un point de mise en page
# — c'est lui qui fait la difference entre un rendu net et un rendu grossi.
FORMATS = {
    # ⚠️ LE JEU EXISTANT DE L'APP STORE EST UN 6,7 POUCES, ET ON REMPLACE SES
    # IMAGES PLUTOT QUE D'EN CREER UN AUTRE : un jeu vide ou mal dimensionne se
    # decouvre au moment de soumettre, c'est-a-dire trop tard.
    "apple67": (1290, 2796, 3),      # iPhone 6,7 pouces — le jeu deja en place
    # L'application se declare universelle (UIDeviceFamily [1, 2]) : Apple exige
    # donc aussi des captures d'iPad.
    "ipad129": (2048, 2732, 2),      # iPad Pro 12,9 pouces
    "apple69": (1320, 2868, 3),      # iPhone 6,9 pouces — exige par l'App Store
    "phone": (1080, 1920, 3),        # Play, telephone
    "seven": (1200, 1920, 2),        # Play, 7 pouces
    "ten": (1300, 2080, 2),          # Play, 10 pouces
}

LANGUES = ["fr", "en", "es", "ar"]


# ── le protocole de debogage, en trente lignes ───────────────────────────────

class Navigateur:
    def __init__(self, port):
        import urllib.request
        for _ in range(60):
            try:
                pages = json.load(urllib.request.urlopen(
                    "http://127.0.0.1:%d/json" % port))
                cible = [p for p in pages if p["type"] == "page"][0]
                break
            except Exception:
                time.sleep(0.4)
        else:
            raise SystemExit("le navigateur ne repond pas")
        url = cible["webSocketDebuggerUrl"]
        hote, chemin = url[5:].split("/", 1)
        h, p = hote.split(":")
        self.s = socket.create_connection((h, int(p)))
        cle = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(("GET /" + chemin + " HTTP/1.1\r\nHost:" + hote
                        + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                        + "Sec-WebSocket-Key: " + cle
                        + "\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        tampon = b""
        while b"\r\n\r\n" not in tampon:
            tampon += self.s.recv(4096)
        self.n = 0

    def appel(self, methode, params=None):
        self.n += 1
        d = json.dumps({"id": self.n, "method": methode,
                        "params": params or {}}).encode()
        m = os.urandom(4)
        t = b"\x81"
        n = len(d)
        if n < 126:
            t += bytes([0x80 | n])
        elif n < 65536:
            t += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            t += bytes([0x80 | 127]) + struct.pack(">Q", n)
        self.s.sendall(t + m + bytes(b ^ m[i % 4] for i, b in enumerate(d)))
        while True:
            e = self.s.recv(2)
            if not e:
                raise SystemExit("le navigateur a ferme la connexion")
            n = e[1] & 127
            if n == 126:
                n = struct.unpack(">H", self.s.recv(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self.s.recv(8))[0]
            d = b""
            while len(d) < n:
                d += self.s.recv(n - len(d))
            o = json.loads(d)
            if o.get("id") == self.n:
                return o.get("result", {})

    def js(self, code):
        r = self.appel("Runtime.evaluate",
                       {"expression": "(() => {" + code + "})()",
                        "returnByValue": True, "awaitPromise": True})
        return (r.get("result") or {}).get("value")

    def taille(self, w, h, echelle):
        self.appel("Emulation.setDeviceMetricsOverride",
                   {"width": int(w / echelle), "height": int(h / echelle),
                    "deviceScaleFactor": echelle, "mobile": True})

    def photo(self, chemin):
        r = self.appel("Page.captureScreenshot", {"format": "png"})
        os.makedirs(os.path.dirname(chemin) or ".", exist_ok=True)
        open(chemin, "wb").write(base64.b64decode(r["data"]))
        return chemin


# ── le parcours, en gestes de page ───────────────────────────────────────────

def attendre(nav, code, plafond=25.0):
    """Attend qu'une condition de la page devienne vraie."""
    fin = time.time() + plafond
    while time.time() < fin:
        if nav.js("return !!(" + code + ");"):
            return True
        time.sleep(0.3)
    return False


def jouer_des_tours(nav, tours):
    """Quelques tours joues pour de vrai : un plateau vide ne vend rien."""
    for _ in range(tours):
        if not attendre(nav, "document.getElementById('dc-cup') && "
                             "!document.getElementById('dc-cup').classList.contains('dc-cup-eteint')",
                        plafond=30):
            return
        nav.js("document.getElementById('dc-cup').click(); return 1;")
        time.sleep(1.4)
        # ⚠️ UNE COLONNE PLEINE REFUSE LE DE, et le serveur le dit a l'ecran.
        # On vise donc une colonne qui a encore de la place.
        nav.js("""
            const libres = [...document.querySelectorAll('.dc-board:not(.dc-board-top) .dc-col')]
              .filter((c) => c.querySelector('.dc-cell:not(.dc-cell-filled)'));
            const c = libres[Math.floor(libres.length / 2)] || libres[0];
            if (c) { const r = c.getBoundingClientRect();
                     const x = r.left + r.width / 2, y = r.top + r.height / 2;
                     const e = document.elementFromPoint(x, y);
                     e.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: x, clientY: y}));
                     e.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: x, clientY: y})); }
            return 1;""")
        time.sleep(1.8)


def acheter_des_effets(nav):
    """Trois effets dans la cale : sans eux, l'eventail ne s'ouvre pas.

    ⚠️ UN COMPTE NEUF N'A RIEN A MONTRER. La cale refuse de s'ouvrir quand elle
    est vide — c'est la bonne regle dans le jeu, et c'est une capture perdue
    pour la boutique. On achete donc trois effets DIFFERENTS (ils ne se jouent
    qu'une fois chacun par partie) avant d'entrer dans l'arene.
    """
    # ⚠️ LA BOUTIQUE A DES RAYONS DEPUIS QU'ELLE EST RANGEE. Elle s'ouvre sur
    # « jeux de des » : les jetons d'effet ne sont meme pas dans la page, et les
    # trois achats tombaient dans le vide sans rien dire.
    nav.js("""const t = document.querySelector('[data-rayon=bonus]');
              if (t) t.click(); return 1;""")
    time.sleep(1.2)
    for identifiant in ("B001", "B004", "B006"):
        nav.js("""const b = document.querySelector('[data-buy=%s]');
                  if (b) b.click(); return 1;""" % identifiant)
        time.sleep(1.8)
    print("      cale : %s" % nav.js(
        "return (window.__pdInv || []).length ? 'ok' : 'achats a verifier';"))


def parcours(nav, sortie, tours):
    faites = []

    def prendre(nom):
        time.sleep(0.7)
        # ⚠️ PAS DE MESSAGE FUGACE SUR UNE CAPTURE DE BOUTIQUE. « this column is
        # full » s'est invite au milieu d'une capture : c'est un mot du serveur,
        # en anglais, au milieu d'une fiche francaise.
        nav.js("document.querySelectorAll('#pd-toasts > *').forEach(e => e.remove()); return 1;")
        time.sleep(0.2)
        faites.append(nav.photo(os.path.join(sortie, nom + ".png")))
        print("      📸 " + nom)

    attendre(nav, "document.getElementById('dc-solo')", plafond=40)
    time.sleep(1.2)
    prendre("1_menu")

    # ⛔ LA BOUTIQUE SE PHOTOGRAPHIE DEPUIS LE PONT, PAS DEPUIS L'ARENE. Elle
    # FERME ses caisses pendant une partie (on n'achete pas sa sortie en cours
    # de route) : prise depuis l'arene, la capture montrait un panneau « revenez
    # plus tard ». C'est aussi la ou le joueur y va.
    nav.js("document.querySelector('.dc-tab[data-panel=shop]').click(); return 1;")
    time.sleep(2.4)
    prendre("2_boutique")
    acheter_des_effets(nav)
    nav.js("const t = document.querySelector('.dc-tab.on'); if (t) t.click(); return 1;")
    time.sleep(0.9)

    for nom, onglet in (("3_classement", "ranking"), ("4_regles", "rules")):
        nav.js("document.querySelector('.dc-tab[data-panel=%s]').click(); return 1;" % onglet)
        time.sleep(2.4)
        prendre(nom)
        nav.js("const t = document.querySelector('.dc-tab.on'); if (t) t.click(); return 1;")
        time.sleep(0.9)

    nav.js("document.getElementById('dc-solo').click(); return 1;")
    attendre(nav, "document.querySelector('.dc-arena')", plafond=30)
    time.sleep(1.6)
    jouer_des_tours(nav, tours)
    prendre("5_plateau")

    nav.js("""const s = document.getElementById('dc-bag');
              const r = s.getBoundingClientRect();
              s.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true,
                  clientX: r.left + r.width / 2, clientY: r.top + r.height / 2}));
              return 1;""")
    time.sleep(1.0)
    ouverte = nav.js("return !!document.querySelector('.dc-bonus-open');")
    if not ouverte:
        print("      ⚠ la cale ne s'est pas ouverte — capture sautee")
    else:
        prendre("6_cale")
        nav.js("""document.getElementById('dicewrap').dispatchEvent(
                    new PointerEvent('pointerdown', {bubbles: true, clientX: 5, clientY: 5}));
                  return 1;""")
        time.sleep(0.5)
    return faites


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langues", nargs="*", default=LANGUES)
    ap.add_argument("--formats", nargs="*", default=list(FORMATS))
    ap.add_argument("--tours", type=int, default=4)
    ap.add_argument("--sortie", default=os.path.join(RACINE, "store", "captures"))
    args = ap.parse_args()

    if not os.path.exists(CHROME):
        sys.exit("Chrome introuvable : " + CHROME)

    web = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT_WEB)],
                           cwd=WWW, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        for langue in args.langues:
            for forme in args.formats:
                w, h, echelle = FORMATS[forme]
                profil = "/tmp/_pd_vitrine_%s_%s" % (langue, forme)
                shutil.rmtree(profil, ignore_errors=True)
                print("   %s / %s (%d x %d)" % (langue, forme, w, h))
                chrome = subprocess.Popen(
                    [CHROME, "--headless=new", "--disable-gpu", "--mute-audio",
                     "--remote-debugging-port=%d" % PORT_CDP,
                     "--user-data-dir=" + profil,
                     "--window-size=%d,%d" % (int(w / echelle), int(h / echelle)),
                     "http://localhost:%d/index.html" % PORT_WEB],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try:
                    nav = Navigateur(PORT_CDP)
                    nav.taille(w, h, echelle)
                    # La langue AVANT le premier rendu : elle est lue au demarrage.
                    nav.js("localStorage.setItem('pd.lang', '%s'); return 1;" % langue)
                    nav.appel("Page.navigate",
                              {"url": "http://localhost:%d/index.html" % PORT_WEB})
                    time.sleep(2.0)
                    dossier = os.path.join(args.sortie, langue, forme)
                    shutil.rmtree(dossier, ignore_errors=True)
                    parcours(nav, dossier, args.tours)
                finally:
                    chrome.terminate()
                    time.sleep(0.6)
                    shutil.rmtree(profil, ignore_errors=True)
    finally:
        web.terminate()
    print("\n   captures dans %s" % os.path.relpath(args.sortie, RACINE))
    return 0


if __name__ == "__main__":
    sys.exit(main())
