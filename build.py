#!/usr/bin/env python3
"""Assemble l'application mobile dans www/ — a lancer avant tout build Capacitor.

⛔ LE JEU N'EST PAS DUPLIQUE. `js/pages/dice*.js`, `css/dice.css` et les assets
sont COPIES depuis `static/` du tool a chaque build : il n'existe qu'une seule
source pour les regles, la menuiserie et les effets. Un correctif fait dans le
tool arrive dans l'application au prochain build, sans que personne y pense.

Ce qui est PROPRE au mobile vit dans `app/` : la coque (index.html, boot.js),
l'identite par appareil, la couche CSS portrait, et les quatre petits modules que
le jeu importe du tool (dom, api, toast, dialogs).

Usage :
    python build.py                       # serveur par defaut (LAN)
    python build.py --server https://dice.exemple.com
    python build.py --check               # verifie seulement, n'ecrit rien
"""
import argparse
import subprocess
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.abspath(os.path.join(HERE, "..", ".."))
STATIC = os.path.join(TOOL, "static")
APP = os.path.join(HERE, "app")
WWW = os.path.join(HERE, "www")

DEFAULT_SERVER = "http://192.168.1.19:8100"

# Le jeu partage : (source, destination dans www)
SHARED_FILES = [
    (os.path.join(STATIC, "css", "dice.css"), os.path.join("css", "dice.css")),
    # Le catalogue anglais est la SOURCE des textes : les autres langues, cote
    # mobile, ne font que le couvrir. Le copier evite deux verites.
    (os.path.join(STATIC, "js", "core", "i18n_en.js"), os.path.join("js", "core", "i18n_en.js")),
]
SHARED_GLOBS = [
    (os.path.join(STATIC, "js", "pages"), "dice", os.path.join("js", "pages")),
]
SHARED_TREES = [
    (os.path.join(STATIC, "dice"), "dice"),
]

IMPORT_RE = re.compile(r"""import[^'"]*['"](\.{1,2}/[^'"]+)['"]|from\s*['"](\.{1,2}/[^'"]+)['"]""")


def copy_tree(src, dst):
    if not os.path.isdir(src):
        sys.exit("SOURCE ABSENTE : %s" % src)
    shutil.copytree(src, dst, dirs_exist_ok=True)


def standalone():
    """Le depot autonome (piratesdice) n'a pas `static/` : le jeu y est deja
    assemble dans www/. On ne refait donc que ce qui peut changer la-bas —
    les fichiers propres au mobile et l'adresse du serveur."""
    return not os.path.isdir(STATIC)


NL = chr(10)


def source_de(rel):
    """Le fichier de `static/` (ou d'`app/`) dont ce fichier de `www/` est la copie."""
    rel = rel.replace(os.sep, "/")
    for src, r in SHARED_FILES:
        if rel == r.replace(os.sep, "/"):
            return src
    for folder, prefix, r in SHARED_GLOBS:
        r = r.replace(os.sep, "/")
        if rel.startswith(r + "/"):
            nom = rel[len(r) + 1:]
            if nom.startswith(prefix) and "/" not in nom:
                return os.path.join(folder, nom)
    for src, r in SHARED_TREES:
        r = r.replace(os.sep, "/")
        if rel.startswith(r + "/"):
            return os.path.join(src, rel[len(r) + 1:].replace("/", os.sep))
    cand = os.path.join(APP, rel.replace("/", os.sep))
    return cand if os.path.isfile(cand) else None


def travail_a_la_main():
    """Ce que `www/` contient et que `static/` ne produirait pas.

    ⛔ POURQUOI CE CONTROLE EXISTE. `build()` VIDE `www/` avant de recopier. Une
    image retouchee a la main dans `www/` disparait donc au build suivant, sans
    une ligne d'avertissement — et le travail est irrecuperable, `www/` n'etant
    pas suivi par git. C'est arrive DEUX FOIS a l'admin : quinze images
    corrigees (portraits de capitaines, icones de traits) ecrasees par un build
    lance pour une raison sans rapport.

    `www/` est un produit de build. La correction doit vivre dans `static/`.
    """
    if standalone() or not os.path.isdir(WWW):
        return []
    ecarts = []
    for base, _d, fs in os.walk(WWW):
        for f in fs:
            chemin = os.path.join(base, f)
            rel = os.path.relpath(chemin, WWW).replace(os.sep, "/")
            if rel == "index.html":
                continue          # GENERE : l'adresse du serveur y est gravee
            src = source_de(rel)
            if not src or not os.path.isfile(src):
                continue                       # genere (index.html) ou orphelin
            if open(chemin, "rb").read() != open(src, "rb").read():
                ecarts.append(rel)
    return sorted(ecarts)


def build(server, build_id):
    # ⚠️ On VIDE www/ sans le supprimer : un serveur de test ou un editeur pose
    # dessus tient le dossier ouvert, et `rmtree` echoue alors sur Windows
    # (WinError 32) — le build s'arretait pour une raison sans rapport avec lui.
    ecarts = travail_a_la_main()
    if ecarts and not os.environ.get("PD_ECRASER"):
        trop = len(ecarts) - 20
        message = [
            "ARRET : %d fichier(s) de www/ different de la source, et www/ est" % len(ecarts),
            "        sur le point d'etre VIDE. Ce serait du travail a la main",
            "        detruit sans retour : www/ n'est pas suivi par git.",
            "",
        ] + ["        " + r for r in ecarts[:20]]
        if trop > 0:
            message.append("        … et %d autre(s)" % trop)
        message += [
            "",
            "        www/ est un produit de build. Pour GARDER ces changements,",
            "        les remonter dans static/dice/ — leur vraie place — puis",
            "        relancer. Pour les jeter volontairement : PD_ECRASER=1",
        ]
        sys.exit(NL.join(message))

    os.makedirs(WWW, exist_ok=True)
    if not standalone():
        for name in os.listdir(WWW):
            path = os.path.join(WWW, name)
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            else:
                try:
                    os.remove(path)
                except OSError:
                    pass

    # 1. ce qui est propre au mobile
    for name in os.listdir(APP):
        src = os.path.join(APP, name)
        dst = os.path.join(WWW, name)
        if os.path.isdir(src):
            copy_tree(src, dst)
        elif name != "index.html":
            shutil.copy2(src, dst)

    # 2. le jeu, copie tel quel depuis le tool — sauf dans le depot autonome,
    #    ou il est deja la et ou `static/` n'existe pas.
    if standalone():
        page = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
        page = page.replace("__PD_SERVER__", server).replace("__PD_BUILD__", build_id)
        open(os.path.join(WWW, "index.html"), "w", encoding="utf-8",
             newline=chr(10)).write(page)
        return page

    for src, rel in SHARED_FILES:
        dst = os.path.join(WWW, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    for folder, prefix, rel in SHARED_GLOBS:
        out = os.path.join(WWW, rel)
        os.makedirs(out, exist_ok=True)
        for name in sorted(os.listdir(folder)):
            if name.startswith(prefix) and name.endswith(".js"):
                shutil.copy2(os.path.join(folder, name), os.path.join(out, name))
    for src, rel in SHARED_TREES:
        copy_tree(src, os.path.join(WWW, rel))

    # 3. la page, avec l'adresse du serveur gravee dedans
    page = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
    page = page.replace("__PD_SERVER__", server).replace("__PD_BUILD__", build_id)
    open(os.path.join(WWW, "index.html"), "w", encoding="utf-8", newline="\n").write(page)
    return page


def check():
    """Chaque import relatif du front designe-t-il un fichier reellement present ?

    C'est LE controle qui compte : le jeu importe `../core/dom.js` et consorts en
    croyant vivre dans le tool. Si un de ces modules manque, le navigateur ne dit
    rien — le graphe entier ne demarre pas et l'ecran reste noir."""
    problems = []
    for root, _dirs, files in os.walk(os.path.join(WWW, "js")):
        for name in files:
            if not name.endswith(".js"):
                continue
            path = os.path.join(root, name)
            text = open(path, encoding="utf-8").read()
            for m in IMPORT_RE.finditer(text):
                spec = m.group(1) or m.group(2)
                target = os.path.normpath(os.path.join(root, spec))
                if not os.path.isfile(target):
                    problems.append("%s importe %s -> ABSENT" %
                                    (os.path.relpath(path, WWW), spec))

    page = os.path.join(WWW, "index.html")
    if os.path.isfile(page):
        html = open(page, encoding="utf-8").read()
        for ref in re.findall(r'(?:src|href)="([^":]+)"', html):
            if not os.path.isfile(os.path.join(WWW, ref)):
                problems.append("index.html reference %s -> ABSENT" % ref)
        if "__PD_SERVER__" in html:
            problems.append("index.html : l'adresse du serveur n'a pas ete remplacee")
    return problems


def weigh():
    total, biggest = 0, []
    for root, _dirs, files in os.walk(WWW):
        for name in files:
            path = os.path.join(root, name)
            size = os.path.getsize(path)
            total += size
            biggest.append((size, os.path.relpath(path, WWW)))
    biggest.sort(reverse=True)
    return total, biggest[:6]


def parse_js(www):
    """Chaque module JS livre est-il un JavaScript VALIDE ?

    ⚠️ CE CONTROLE MANQUAIT, ET SON ABSENCE A DEJA LIVRE UNE APPLICATION MORTE.
    Le 2026-08-21, trois apostrophes francaises non echappees dans le catalogue
    (`'Deux d'un coup'`) ont casse `i18n_fr.js` : plus aucun module ne se
    chargeait, l'application restait sur son ecran d'ouverture. Rien ici ne le
    voyait — la verification d'a cote ne lit que des CHEMINS, pas du code.

    ⛔ `node --check fichier.js` NE SUFFIT PAS. Sur un `.js` (par opposition a un
    `.mjs`) Node choisit son analyseur d'apres le paquet, et sur ces catalogues il
    rend 0 malgre une erreur de syntaxe franche — verifie ce jour-la. Il faut lui
    IMPOSER le mode module, ce que seule la lecture sur l'entree standard permet :
    `node --input-type=module --check < fichier`.
    """
    mauvais = []
    for root, _dirs, files in os.walk(os.path.join(www, "js")):
        for fn in sorted(files):
            if not fn.endswith(".js"):
                continue
            chemin = os.path.join(root, fn)
            with open(chemin, "rb") as f:
                r = subprocess.run(["node", "--input-type=module", "--check"],
                                   stdin=f, capture_output=True)
            if r.returncode != 0:
                ligne = next((l for l in r.stderr.decode("utf-8", "replace").splitlines()
                              if "Error" in l), "syntaxe refusee")
                mauvais.append("%s : %s" % (os.path.relpath(chemin, www), ligne.strip()))
    return mauvais


def copier_vers_android():
    """Recopie `www/` dans le projet Android.

    ⚠️ LE PIEGE LE PLUS COUTEUX DE CETTE CHAINE, ET IL EST SILENCIEUX.
    `build.py` assemble `www/`. Gradle, lui, empaquette
    `android/app/src/main/assets/public/`, qui en est une COPIE — et rien ne les
    rapproche sinon `npx cap copy`. Oublier cette etape ne casse rien, n'affiche
    aucune erreur, et produit un APK parfaitement valide : simplement, il
    contient le jeu d'il y a une heure. Vecu le 2026-08-21 — un geste tout neuf
    « ne marchait pas sur l'appareil » alors qu'il n'y etait pas.

    On la fait donc ICI, a la suite de l'assemblage, pour qu'il devienne
    impossible de construire un APK en retard sur `www/`.
    """
    projet = os.path.join(HERE, "android")
    if not os.path.isdir(projet):
        return
    r = subprocess.run(["npx", "cap", "copy", "android"], cwd=HERE,
                       capture_output=True, shell=(os.name == "nt"))
    if r.returncode != 0:
        sys.exit("la copie vers le projet Android a echoue :\n"
                 + r.stderr.decode("utf-8", "replace")[-800:])
    print("copie vers android/ : l'APK embarquera bien ce www/-ci.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=DEFAULT_SERVER, help="adresse du serveur de jeu")
    ap.add_argument("--build", default="dev", help="identifiant de build, affiche dans l'app")
    ap.add_argument("--check", action="store_true", help="verifie www/ sans le reconstruire")
    args = ap.parse_args()

    if not args.check:
        build(args.server.rstrip("/"), args.build)
        print("www/ assemble  (serveur : %s)%s"
              % (args.server, "  [depot autonome]" if standalone() else ""))

    problems = check() + parse_js(WWW)
    if problems:
        print("\n".join("  ✖ " + p for p in problems))
        sys.exit("%d probleme(s) — l'application ne demarrerait pas." % len(problems))

    copier_vers_android()

    total, biggest = weigh()
    print("verification : les imports resolvent, et chaque module JS se parse.")
    print("poids : %.1f Mo" % (total / 1e6))
    for size, rel in biggest:
        print("   %7.1f Ko  %s" % (size / 1024, rel))


if __name__ == "__main__":
    main()
