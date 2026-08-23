#!/usr/bin/env python3
"""studio.py — le pupitre de reglage de l'interface, dans un navigateur.

Le probleme qu'il resout : peaufiner un arrondi ou un ecart demandait de trouver
la bonne ligne dans dice.css (1700 lignes), de reconstruire, de resynchroniser et
de reinstaller — une minute par essai, et l'essai suivant avait deja fait oublier
le precedent.

Ici, un curseur bouge et le plateau bouge avec, tout de suite. « Enregistrer »
ecrit dans css/combat.css, qui reste la source : le studio ne stocke rien de son
cote, il n'a pas de base, pas d'etat cache. Ferme-le, le fichier porte tout.

⛔ IL N'ECRIT JAMAIS DANS dice.css. C'est le fichier partage avec le tool. Les
jetons partages (couleurs, liseres) qu'on regle ici sont ecrits en surcouche dans
combat.css, dans un bloc delimite — exactement ce que fait deja mobile.css.

Usage :
    python3 studio.py                 # ouvre http://localhost:8099
    python3 studio.py --port 9000
    python3 studio.py --no-open       # n'ouvre pas le navigateur
"""
import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.join(HERE, "www")
STUDIO = os.path.join(HERE, "studio")
COMBAT = os.path.join(HERE, "app", "css", "combat.css")
COMBAT_WWW = os.path.join(WWW, "css", "combat.css")
DICE = os.path.join(WWW, "css", "dice.css")

# Le bloc que le studio ecrit lui-meme, et le seul qu'il se permet de reecrire
# en entier. Tout ce qui est en dehors est ecrit a la main : on n'y touche qu'une
# valeur a la fois, en laissant les commentaires en place.
MARQUE_DEBUT = "/* ==== JETONS REPRIS DE dice.css — bloc ecrit par studio.py ==== */"
MARQUE_FIN = "/* ==== fin du bloc de studio.py ==== */"

# Mesuree par js/fit.js a chaque affichage : un reglage ici serait efface a la
# premiere rotation. On la montre, on ne la propose pas.
NON_REGLABLES = {"--dc-cell"}


# ── lire les reglages ────────────────────────────────────────────────────────

def _bloc(texte, depart):
    """Le contenu d'un bloc `{ … }` qui commence apres `depart`."""
    i = texte.find(depart)
    if i < 0:
        return None, 0
    ouvre = texte.find("{", i)
    ferme = texte.find("}", ouvre)
    return texte[ouvre + 1:ferme], ouvre + 1


# ⚠️ REPERER UNE SECTION PAR SON NOM SEUL NE MARCHE PAS : l'en-tete du fichier
# cite « LE TABLEAU DE BORD » et « LE CABLAGE » dans une phrase, et la lecture
# s'arretait donc au bout de 800 caracteres, sans un seul reglage trouve. On
# exige la BANNIERE : une ligne de « ==== » puis le titre.
BANNIERE = re.compile(r"/\*[ \t]*=+[ \t]*\n[ \t]*(?P<titre>[^\n]+)")

# Une declaration peut tenir sur plusieurs lignes (le halo du plateau en fait
# cinq) : c'est le point-virgule qui la termine, pas le retour a la ligne.
DECL = re.compile(r"^\s*(?P<nom>--[\w-]+)\s*:\s*(?P<valeur>[^;]+);\s*$", re.S)
JETON = re.compile(r"(?P<comm>/\*.*?\*/)|(?P<decl>--[\w-]+\s*:\s*[^;]+;)", re.S)
TITRE = re.compile(r"^\s*──\s*(?P<titre>.+?)\s*─*\s*$", re.S)


def _section(texte, nom):
    """L'indice de la banniere dont le titre commence par `nom`."""
    for m in BANNIERE.finditer(texte):
        if m.group("titre").strip().startswith(nom):
            return m.start()
    return -1


def _propre(valeur):
    """Une valeur sur plusieurs lignes se relit mieux en une seule."""
    return re.sub(r"\s+", " ", valeur).strip()


def _lire_bloc(bloc, groupe_defaut, source):
    """Les declarations d'un bloc, avec leur groupe et leur explication.

    Le fichier est sa propre documentation : les titres `── … ──` deviennent les
    sections du panneau, et le commentaire qui precede une variable devient son
    explication. Rien a tenir a jour en double."""
    reglages, groupe, aide = [], groupe_defaut, []
    for m in JETON.finditer(bloc or ""):
        if m.group("decl"):
            d = DECL.match(m.group("decl"))
            reglages.append({"nom": d.group("nom"), "groupe": groupe,
                             "aide": " ".join(aide).strip(), "actif": True,
                             "valeur": _propre(d.group("valeur")), "source": source})
            aide = []
            continue
        dedans = m.group("comm")[2:-2]
        titre = TITRE.match(dedans)
        if titre:
            groupe, aide = titre.group("titre").strip(), []
            continue
        # Un reglage mis en commentaire reste un reglage : il est propose, eteint.
        d = DECL.match(dedans)
        if d:
            reglages.append({"nom": d.group("nom"), "groupe": groupe,
                             "aide": " ".join(aide).strip(), "actif": False,
                             "valeur": _propre(d.group("valeur")), "source": source})
            aide = []
            continue
        aide.append(re.sub(r"\s+", " ", dedans).strip())
    return reglages


# ⚠️ IL Y A PLUS DE DEUX COUCHES, ET LES OUBLIER FAIT MENTIR LE STUDIO.
# mobile.css empile quatre conditions sur les memes proprietes : le bureau, le
# portrait, le paysage large, et les ecrans de moins de 400 px. Un studio qui ne
# connait que « base » et « portrait » ecrit dans une couche que la suivante
# recouvre : le curseur bouge, le fichier change, et l'ecran ne bouge pas.
# On lit donc TOUTES les couches, dans l'ordre du fichier, et c'est le navigateur
# de l'apercu qui dira laquelle s'applique a la taille regardee.
MEDIA = re.compile(r"@media([^{]+)\{")


def _couches(tableau):
    """Les blocs `#dicewrap { … }` du tableau de bord, dans l'ordre du fichier.

    Retourne [(condition, contenu)] — condition vide pour le bloc de base."""
    out = []
    base, apres = _bloc(tableau, "#dicewrap {")
    if base is not None:
        out.append(("", base))
    for m in MEDIA.finditer(tableau):
        dedans, _ = _bloc(tableau[m.start():], "#dicewrap {")
        if dedans is not None:
            out.append((" ".join(m.group(1).split()), dedans))
    return out


def lire_combat():
    """Les reglages du tableau de bord, groupes comme dans le fichier."""
    texte = open(COMBAT, encoding="utf-8").read()
    debut, fin = _section(texte, "LE TABLEAU DE BORD"), _section(texte, "LE CABLAGE")
    tableau = texte[debut:fin]

    couches = _couches(tableau)
    ordre = [c for c, _ in couches]

    # La couche de base porte le groupe, l'explication et l'etat ; les autres ne
    # font que redonner une valeur a un reglage qui existe deja.
    reglages = _lire_bloc(dict(couches).get("", ""), "Reglages", "combat")
    par_nom = {r["nom"]: r for r in reglages}
    for r in reglages:
        r["faces"] = {"": r["valeur"]}

    for condition, contenu in couches:
        if not condition:
            continue
        for autre in _lire_bloc(contenu, "", "combat"):
            if autre["nom"] in par_nom:
                par_nom[autre["nom"]]["faces"][condition] = autre["valeur"]
    for r in reglages:
        r["ordre"] = [c for c in ordre if c in r["faces"]]
    return reglages


def lire_jetons():
    """Les jetons partages de dice.css : couleurs, liseres, trames."""
    texte = open(DICE, encoding="utf-8").read()
    base, _ = _bloc(texte, "#dicewrap {")
    poses = jetons_poses()
    out = []
    for r in _lire_bloc(base, "Jetons partages (dice.css)", "jetons"):
        r["groupe"] = "Jetons partages (dice.css)"
        r["origine"] = r["valeur"]
        r["actif"] = r["nom"] in poses
        r["valeur"] = poses.get(r["nom"], r["valeur"])
        # ⚠️ UN JETON N'A QU'UNE COUCHE, mais il doit la declarer comme les
        # autres : sans ces deux champs le panneau cherchait `faces[...]` sur
        # `undefined`, s'arretait au premier jeton, et la moitie des reglages ne
        # s'affichait plus — sans une seule erreur visible a l'ecran.
        r["faces"] = {"": r["valeur"]}
        r["ordre"] = [""]
        r["fige"] = r["nom"] in NON_REGLABLES
        out.append(r)
    return out


def jetons_poses():
    """Ce que le studio a deja ecrit en surcouche, s'il a deja ecrit."""
    texte = open(COMBAT, encoding="utf-8").read()
    i, j = texte.find(MARQUE_DEBUT), texte.find(MARQUE_FIN)
    if i < 0 or j < 0:
        return {}
    return {r["nom"]: r["valeur"] for r in _lire_bloc(texte[i:j], "", "jetons")}


# ── ecrire les reglages ──────────────────────────────────────────────────────

def poser(texte, nom, valeur, actif):
    """Remplace UNE variable la ou elle est, sans toucher a ce qui l'entoure.

    ⚠️ Le commentaire au-dessus d'une variable explique pourquoi elle vaut ce
    qu'elle vaut : le studio le laisse tel quel. Une valeur qui change sans que
    son explication change, c'est un fichier qui ment — mais reecrire le fichier
    entier a chaque curseur ferait perdre TOUS les commentaires d'un coup.

    Les deux formes possibles, dans cet ordre : le reglage eteint (en
    commentaire) est plus specifique, il doit etre essaye en premier."""
    eteint = re.compile(r"([ \t]*)/\*\s*" + re.escape(nom) + r"\s*:\s*[^;]+;\s*\*/")
    allume = re.compile(r"([ \t]*)" + re.escape(nom) + r"\s*:\s*[^;]+;")
    propre = re.sub(r"\s+", " ", valeur).strip()

    def remplace(m):
        marge = m.group(1)
        if actif:
            return "%s%s: %s;" % (marge, nom, propre)
        return "%s/* %s: %s; */" % (marge, nom, propre)

    for motif in (eteint, allume):
        nouveau, n = motif.subn(remplace, texte, count=1)
        if n:
            return nouveau, n
    return texte, 0


def enregistrer(charge):
    """Ecrit tout, puis recopie vers www/ pour que le rechargement montre juste."""
    texte = open(COMBAT, encoding="utf-8").read()
    ecrits, manquants = 0, []

    # 1. les reglages du tableau de bord, chacun dans SA couche
    debut, fin = _section(texte, "LE TABLEAU DE BORD"), _section(texte, "LE CABLAGE")
    tableau = texte[debut:fin]

    # Les frontieres des couches, pour n'ecrire que dans la bonne : remplacer
    # dans tout le tableau toucherait la premiere occurrence, qui est rarement
    # celle qu'on regarde.
    coupes = [0]
    for m in MEDIA.finditer(tableau):
        coupes.append(m.start())
    coupes.append(len(tableau))
    morceaux = [tableau[coupes[i]:coupes[i + 1]] for i in range(len(coupes) - 1)]
    conditions = [""] + [" ".join(m.group(1).split()) for m in MEDIA.finditer(tableau)]

    for nom, r in (charge.get("combat") or {}).items():
        face = r.get("face", "")
        try:
            i = conditions.index(face)
        except ValueError:
            manquants.append(nom)
            continue
        morceaux[i], n = poser(morceaux[i], nom, r["valeur"], r.get("actif", True))
        ecrits += n
        if not n:
            manquants.append(nom)
    texte = texte[:debut] + "".join(morceaux) + texte[fin:]

    # 2. les jetons partages, dans LEUR bloc — jamais dans dice.css
    jetons = {n: v for n, v in (charge.get("jetons") or {}).items() if v}
    i, j = texte.find(MARQUE_DEBUT), texte.find(MARQUE_FIN)
    if i >= 0 and j >= 0:
        texte = texte[:i] + texte[j + len(MARQUE_FIN):]
        texte = texte.rstrip() + "\n"
    if jetons:
        lignes = "\n".join("  %s: %s;" % (n, v) for n, v in sorted(jetons.items()))
        texte = texte.rstrip() + "\n\n" + "\n".join([
            MARQUE_DEBUT,
            "/* Ces jetons appartiennent a dice.css, qui est PARTAGE avec le tool et",
            "   ne doit pas etre modifie. On les recouvre ici, comme le fait deja",
            "   mobile.css. Vider un reglage dans le studio retire sa ligne. */",
            "#dicewrap {", lignes, "}", MARQUE_FIN, ""])
        ecrits += len(jetons)

    open(COMBAT, "w", encoding="utf-8", newline="\n").write(texte)
    shutil.copy2(COMBAT, COMBAT_WWW)
    return ecrits, manquants


# ── le serveur ───────────────────────────────────────────────────────────────

class Studio(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WWW, **kw)

    def end_headers(self):
        """⚠️ RIEN N'EST MIS EN CACHE, JAMAIS. Sans cela, « Enregistrer » recharge
        le cadre, le navigateur ressert l'ancien combat.css, et le studio montre
        l'AVANT en pretendant montrer l'APRES — le pire mensonge qu'il puisse
        faire. Vaut aussi pour les fichiers servis par la classe parente."""
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def _envoyer(self, charge, type_mime="application/json"):
        corps = charge if isinstance(charge, bytes) else json.dumps(charge).encode()
        self.send_response(200)
        self.send_header("Content-Type", type_mime)
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def _fichier(self, chemin, type_mime):
        if not os.path.isfile(chemin):
            self.send_error(404)
            return
        self._envoyer(open(chemin, "rb").read(), type_mime)

    def do_GET(self):
        route = self.path.split("?")[0]
        if route in ("/", "/index.html"):
            return self._fichier(os.path.join(STUDIO, "index.html"), "text/html; charset=utf-8")
        if route == "/apercu":
            return self._fichier(os.path.join(STUDIO, "apercu.html"), "text/html; charset=utf-8")
        if route == "/jeu":
            return self._fichier(os.path.join(WWW, "index.html"), "text/html; charset=utf-8")
        if route == "/__studio/reglages":
            return self._envoyer({"reglages": lire_combat() + lire_jetons()})
        if route.startswith("/__studio/"):
            nom = os.path.basename(route)
            mime = "text/css" if nom.endswith(".css") else "text/javascript"
            return self._fichier(os.path.join(STUDIO, nom), mime + "; charset=utf-8")
        return super().do_GET()

    def do_POST(self):
        if self.path != "/__studio/enregistrer":
            return self.send_error(404)
        taille = int(self.headers.get("Content-Length", 0))
        charge = json.loads(self.rfile.read(taille) or b"{}")
        try:
            ecrits, manquants = enregistrer(charge)
        except Exception as err:                      # noqa: BLE001
            return self._envoyer({"ok": False, "erreur": str(err)})
        return self._envoyer({"ok": True, "ecrits": ecrits, "manquants": manquants})

    def log_message(self, *a):
        pass                                          # le terminal reste lisible


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8099)
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()

    for chemin in (COMBAT, DICE, os.path.join(STUDIO, "index.html")):
        if not os.path.isfile(chemin):
            raise SystemExit("ABSENT : %s" % chemin)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", args.port), Studio) as httpd:
        url = "http://localhost:%d/" % args.port
        print("studio : %s" % url)
        print("   les reglages vont dans app/css/combat.css — dice.css n'est pas touche.")
        print("   Ctrl+C pour arreter.")
        if not args.no_open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstudio arrete.")


if __name__ == "__main__":
    main()
