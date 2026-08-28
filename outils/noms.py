#!/usr/bin/env python3
"""
outils/noms.py — LE NOM APPELE EXISTE-T-IL ?

⛔ CE FICHIER NAIT D'UN BOGUE MUET. `rain()` vivait dans `dice_match.js` sans
`export` ; `dice_end.js` l'appelait. A chaque VICTOIRE : `ReferenceError`, avale
par le `try` du routeur de messages, et le gagnant restait devant un plateau
mort — la carte de fin etait construite mais la ligne qui l'affiche venait apres
l'appel. Rien ne le signalait : les modules se parsent, les imports resolvent,
la partie tourne. Seul le chemin execute revelait la faute, et il ne l'a revele
qu'a l'ecran, en partie reelle.

CE QU'IL VERIFIE. Pour chaque module : tout nom appele comme une fonction est-il
declare quelque part dans le fichier, importe, ou connu du navigateur ?

⚠️ IL IGNORE LES PORTEES, DELIBEREMENT. Un nom declare dans une fonction compte
pour tout le fichier : on rate ainsi quelques fautes (un nom hors de sa portee),
mais on n'en invente aucune. Un verificateur qui crie a tort est un verificateur
qu'on eteint.
"""
import os
import re
import sys

MOTS = {
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
    'new', 'do', 'else', 'await', 'yield', 'delete', 'void', 'in', 'of',
    'instanceof', 'case', 'throw', 'super', 'this', 'import', 'export',
    'const', 'let', 'var', 'class', 'try', 'finally', 'break', 'continue',
    'default', 'null', 'true', 'false', 'undefined', 'get', 'set', 'static',
    'async',
}
GLOBAUX = {
    'window', 'document', 'console', 'Math', 'JSON', 'Date', 'Object', 'Array',
    'String', 'Number', 'Boolean', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet',
    'Symbol', 'BigInt', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Proxy',
    'Reflect', 'Intl', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
    'queueMicrotask', 'structuredClone', 'fetch', 'parseInt', 'parseFloat',
    'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI',
    'decodeURI', 'atob', 'btoa', 'alert', 'confirm', 'prompt', 'getComputedStyle',
    'matchMedia', 'addEventListener', 'removeEventListener', 'dispatchEvent',
    'CustomEvent', 'Event', 'URL', 'URLSearchParams', 'Audio', 'Image', 'Blob',
    'File', 'FileReader', 'FormData', 'Headers', 'Request', 'Response',
    'AbortController', 'WebSocket', 'XMLHttpRequest', 'AudioContext', 'MutationObserver', 'ResizeObserver',
    'IntersectionObserver', 'DOMParser', 'TextEncoder', 'TextDecoder',
    'Uint8Array', 'Int32Array', 'Float32Array', 'ArrayBuffer', 'DataView',
    'localStorage', 'sessionStorage', 'navigator', 'location', 'history',
    'performance', 'screen', 'crypto', 'Notification', 'Capacitor', 'require',
}

CHAINE = re.compile(r"""('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)""", re.S)
LIGNE = re.compile(r"//[^\n]*")
BLOC = re.compile(r"/\*.*?\*/", re.S)
APPEL = re.compile(r"(?<![.\w$?])([A-Za-z_$][\w$]*)\s*\(")
NOM = r"[A-Za-z_$][\w$]*"


def nettoyer(src):
    """Le code sans ses chaines ni ses commentaires — on garde les retours."""
    src = BLOC.sub(lambda m: "\n" * m.group(0).count("\n"), src)
    src = LIGNE.sub("", src)
    src = CHAINE.sub(lambda m: '""' + "\n" * m.group(0).count("\n"), src)
    return src


def declares(src):
    """Tous les noms que ce fichier pose, quelle que soit la portee."""
    noms = set()
    for m in re.finditer(r"\b(?:function\*?|class)\s+(" + NOM + ")", src):
        noms.add(m.group(1))
    for m in re.finditer(r"\b(?:const|let|var)\s+([^=;\n]+)", src):
        noms.update(re.findall(NOM, m.group(1)))
    for m in re.finditer(r"\bimport\s+([^;]+?)\s+from", src):
        noms.update(re.findall(NOM, m.group(1).replace(" as ", " ")))
    # Une METHODE est une declaration, pas un appel : `connect(a) {` dans une
    # classe ou un objet litteral s'ecrit comme un appel et n'en est pas un.
    for m in re.finditer(r"(?:^|[{,;])\s*(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?\*?\s*("
                         + NOM + r")\s*\([^()]*\)\s*\{", src, re.M):
        noms.add(m.group(1))
    for m in re.finditer(r"\bcatch\s*\(\s*(" + NOM + r")", src):
        noms.add(m.group(1))
    # Les parametres : tout ce qui tient entre les parentheses d'une signature.
    for m in re.finditer(r"(?:function\*?\s*" + NOM + r"?\s*|\b" + NOM + r"\s*)\(([^()]*)\)\s*(?:=>|\{)", src):
        noms.update(re.findall(NOM, m.group(1)))
    for m in re.finditer(r"\(?\s*(" + NOM + r")\s*\)?\s*=>", src):
        noms.add(m.group(1))
    # ⚠️ UNE FLECHE PASSEE EN ARGUMENT A AUSSI DES PARAMETRES. `new Promise((ok,
    # non) => {...})` : la liste est precedee d'une parenthese, pas d'un nom, et
    # la regle du dessus ne la voyait pas — les deux parametres passaient donc
    # pour des fonctions inconnues. Un verificateur qui crie a tort est un
    # verificateur qu'on eteint : il apprend cette forme-la.
    for m in re.finditer(r"[(,]\s*\(([^()]*)\)\s*=>", src):
        noms.update(re.findall(NOM, m.group(1)))
    for m in re.finditer(r"\bfor\s*\(\s*(?:const|let|var)\s+([^)]+?)\s+(?:of|in)\b", src):
        noms.update(re.findall(NOM, m.group(1)))
    return noms


def fautes(chemin):
    src = nettoyer(open(chemin, encoding="utf-8").read())
    connus = declares(src) | GLOBAUX | MOTS
    vues, out = set(), []
    for m in APPEL.finditer(src):
        nom = m.group(1)
        if nom in connus or nom in vues:
            continue
        vues.add(nom)
        out.append((src[:m.start()].count("\n") + 1, nom))
    return out


def main(racines):
    total = 0
    for racine in racines:
        for dossier, _, fichiers in os.walk(racine):
            for f in sorted(fichiers):
                if not f.endswith(".js"):
                    continue
                chemin = os.path.join(dossier, f)
                for ligne, nom in fautes(chemin):
                    print("%s:%d  %s() n'est ni declare, ni importe" % (chemin, ligne, nom))
                    total += 1
    if total:
        print("%d nom(s) appele(s) sans exister." % total)
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["www/js"]))
