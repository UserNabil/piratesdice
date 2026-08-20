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


def build(server, build_id):
    # ⚠️ On VIDE www/ sans le supprimer : un serveur de test ou un editeur pose
    # dessus tient le dossier ouvert, et `rmtree` echoue alors sur Windows
    # (WinError 32) — le build s'arretait pour une raison sans rapport avec lui.
    os.makedirs(WWW, exist_ok=True)
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

    # 2. le jeu, copie tel quel depuis le tool
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=DEFAULT_SERVER, help="adresse du serveur de jeu")
    ap.add_argument("--build", default="dev", help="identifiant de build, affiche dans l'app")
    ap.add_argument("--check", action="store_true", help="verifie www/ sans le reconstruire")
    args = ap.parse_args()

    if not args.check:
        build(args.server.rstrip("/"), args.build)
        print("www/ assemble  (serveur : %s)" % args.server)

    problems = check()
    if problems:
        print("\n".join("  ✖ " + p for p in problems))
        sys.exit("%d probleme(s) — l'application ne demarrerait pas." % len(problems))

    total, biggest = weigh()
    print("verification : tous les imports et references resolvent.")
    print("poids : %.1f Mo" % (total / 1e6))
    for size, rel in biggest:
        print("   %7.1f Ko  %s" % (size / 1024, rel))


if __name__ == "__main__":
    main()
