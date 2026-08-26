#!/usr/bin/env python3
"""
outils/studio.py — L'ATELIER DE REGLAGE, SUR LE MAC, L'APERCU SUR L'APPAREIL.

    python3 outils/studio.py
    puis ouvrir http://localhost:8123 dans un navigateur du Mac.

⛔ LA PREMIERE VERSION S'OUVRAIT SUR LE TELEPHONE, ET C'ETAIT ABSURDE. Un
panneau de reglage qui couvre les deux tiers de l'ecran cache exactement ce
qu'on regle : on bougeait un curseur pour voir le plateau… sous le curseur.
L'atelier appartient a la machine ou l'on travaille, l'apercu a l'appareil ou
l'on regarde.

COMMENT CA MARCHE. Ce serveur tient la verite : un dictionnaire de reglages et
un numero de version. La page du Mac les modifie ; l'application, elle, demande
« quoi de neuf depuis la version N ? » cinq fois par seconde et applique ce qui
a change. Deux cents millisecondes de retard, invisibles a l'oeil, pour zero
ligne de protocole a ecrire.

⚠️ PAS DE WEBSOCKET, ET C'EST DELIBERE. Il en faudrait un serveur complet dans
la bibliotheque standard — poignee de main, trames, masques — soit deux cents
lignes a maintenir pour gagner cent quatre-vingts millisecondes sur un geste
humain. Une interrogation reguliere fait le meme travail en dix.

⚠️ ET RIEN N'ECOUTE EN PRODUCTION. L'application essaie `localhost` (simulateur
iOS) puis `10.0.2.2` (emulateur Android) ; sur un vrai telephone, dans le monde,
personne ne repond et elle cesse d'essayer apres trois echecs. Le cout d'un
atelier absent est donc exactement nul.

ENREGISTRER. Le bouton « enregistrer dans combat.css » ecrit les valeurs dans le
tableau de bord du fichier, sur cette machine. C'est la que finit un reglage :
tant qu'il n'y est pas, il ne vit que dans la memoire de ce serveur.
"""
import http.server
import json
import os
import re
import socketserver
import threading
import webbrowser

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
FEUILLES = [os.path.join(RACINE, "www", "css", f)
            for f in ("combat.css", "dice.css", "mobile.css")]
CIBLE = os.path.join(RACINE, "www", "css", "combat.css")
MIROIR = os.path.join(RACINE, "app", "css", "combat.css")
PORT = 8123

ETAT = {"v": 0, "vars": {}}
VERROU = threading.Lock()

DECLARATION = re.compile(r"^\s*(--cbt-[a-z0-9-]+)\s*:\s*([^;]+);", re.I | re.M)
RENVOI = re.compile(r"^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*(.+?))?\s*\)$", re.I | re.S)


def resoudre(valeur, table, profondeur=6):
    """Suivre les `var(--autre)` jusqu'a une valeur ecrite en clair.

    ⚠️ POUR LE CURSEUR, PAS POUR LE FICHIER. Un reglage qui en recopie un autre
    — `--cbt-gel-moi-echelle: var(--cbt-gel-echelle)` — n'est pas un nombre :
    sans ce demelage l'atelier n'affichait qu'un champ de texte, et les trois
    reglages de MON cote du plateau restaient sans curseur alors qu'ils sont
    exactement ceux qu'on veut regler a l'oeil. On ne resout que pour placer le
    curseur au bon endroit ; le fichier garde son renvoi tant que personne n'a
    touche a rien, et ne recoit un nombre que le jour ou on bouge le curseur.
    """
    for _ in range(profondeur):
        m = RENVOI.match(valeur.strip())
        if not m:
            return valeur
        vise, secours = m.group(1), m.group(2)
        if vise in table:
            valeur = table[vise]
        elif secours:
            valeur = secours
        else:
            return valeur
    return valeur


def reglages():
    """Tous les reglages declares, dans l'ordre du fichier, valeur d'origine.

    ⚠️ ON GARDE LA PREMIERE DECLARATION, PAS LA DERNIERE. Le tableau de bord
    donne la valeur de reference en tete de fichier ; les couches telephone la
    redefinissent plus bas. C'est la reference qu'on veut montrer, pas la
    variante d'un ecran particulier.
    """
    out = []
    table = {}
    for chemin in FEUILLES:
        if not os.path.isfile(chemin):
            continue
        texte = open(chemin, encoding="utf-8").read()
        for nom, valeur in DECLARATION.findall(texte):
            if nom in table:
                continue
            table[nom] = valeur.strip()
            out.append({"nom": nom, "valeur": valeur.strip(),
                        "ou": os.path.basename(chemin)})
    for r in out:
        r["depart"] = resoudre(r["valeur"], table)
    return out


def enregistrer(valeurs):
    """Ecrire les reglages dans le tableau de bord de combat.css.

    ⚠️ ON REMPLACE LA DECLARATION EXISTANTE, ON N'AJOUTE PAS UN BLOC. Un second
    `#dicewrap { … }` colle en fin de fichier gagnerait sur le tableau de bord
    et le rendrait mensonger : on lirait une valeur en haut et on en verrait une
    autre a l'ecran. C'est exactement le genre de piege que ce depot passe son
    temps a demonter.
    """
    if not valeurs:
        return 0, "aucun reglage modifie"
    texte = open(CIBLE, encoding="utf-8").read()
    poses, absents = 0, []
    for nom, valeur in valeurs.items():
        motif = re.compile(r"^(\s*)" + re.escape(nom) + r"\s*:\s*[^;]+;", re.M)
        if motif.search(texte):
            texte = motif.sub(lambda m: "%s%s: %s;" % (m.group(1), nom, valeur),
                              texte, count=1)
            poses += 1
        else:
            absents.append(nom)
    open(CIBLE, "w", encoding="utf-8").write(texte)
    if os.path.isfile(MIROIR):
        open(MIROIR, "w", encoding="utf-8").write(texte)
    mot = "%d reglage(s) ecrit(s) dans css/combat.css" % poses
    if absents:
        mot += " — introuvables : " + ", ".join(absents)
    return poses, mot


PAGE = """<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Studio — The Pirate's Dice</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;background:#14101f;color:#e9e4ff;font:13px/1.4 ui-monospace,Menlo,monospace}
 header{position:sticky;top:0;background:#1c1630;border-bottom:2px solid #ffd166;
        padding:10px 14px;display:flex;gap:10px;align-items:center;z-index:2}
 header b{color:#ffd166;font-size:15px}
 header .n{opacity:.6;margin-right:auto}
 button{font:inherit;background:#ffd166;color:#1b1233;border:0;border-radius:7px;
        padding:6px 11px;cursor:pointer}
 button.g{background:#3a2f55;color:#e9e4ff}
 #mot{padding:8px 14px;color:#9fe6a0;min-height:1.2em}
 .fam{margin:16px 14px 6px;color:#ffd166;text-transform:uppercase;letter-spacing:.1em;
      border-top:1px solid #2e2746;padding-top:8px}
 .l{display:grid;grid-template-columns:minmax(0,14em) 1fr minmax(9em,16em);
    gap:10px;align-items:center;padding:3px 14px}
 .l:hover{background:#191430}
 .nom{opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .nom.mod{color:#ffd166}
 input[type=range]{width:100%;accent-color:#ffd166}
 input[type=text]{font:inherit;color:#fff;background:#221b3a;border:1px solid #3a2f55;
                  border-radius:5px;padding:4px 7px;min-width:0}
 .l > input[type=text]:nth-child(2){grid-column:2/-1}
</style>
<header>
  <b>Studio</b><span class="n" id="n"></span>
  <button id="enr">enregistrer dans combat.css</button>
  <button class="g" id="raz">tout remettre</button>
</header>
<div id="mot"></div><div id="corps"></div>
<script>
const corps = document.getElementById('corps');
const mot = document.getElementById('mot');
let modifs = {};

function unite(v){ const m=/^\\s*(-?\\d+(?:\\.\\d+)?)\\s*(px|%|em|rem|vw|vh|deg|s|ms)?\\s*$/.exec(v||''); return m?{n:parseFloat(m[1]),u:m[2]||''}:null; }
/* ⚠️ LA BORNE BASSE DOIT POUVOIR ETRE NEGATIVE. Le premier jeu de bornes
   partait de zero : le curseur de `--cbt-gel-y`, dont la bonne valeur est -3%,
   ne pouvait pas atteindre sa propre valeur. Un decalage se regle des deux
   cotes du centre ou il ne se regle pas. */
function bornes(n,u){
  const b=(bas,haut,pas)=>[Math.min(bas,Math.floor(n)),Math.max(haut,Math.ceil(n*2)),pas];
  if(u==='%')  return b(-100,200,0.5);
  if(u==='')   return b(0,2,0.01);
  if(u==='deg')return b(-180,180,1);
  return b(n<0?-40:0,40,1);
}
function famille(nom){ const r=nom.slice(6); const i=r.indexOf('-'); return i<0?r:r.slice(0,i); }

fetch('/reglages').then(r=>r.json()).then((liste)=>{
  document.getElementById('n').textContent = liste.length + ' reglages';
  let fam=null;
  for(const r of liste){
    const f=famille(r.nom);
    if(f!==fam){ fam=f; const t=document.createElement('div'); t.className='fam'; t.textContent=f; corps.appendChild(t); }
    const l=document.createElement('div'); l.className='l';
    const nom=document.createElement('span'); nom.className='nom'; nom.title=r.nom+'  ('+r.ou+')'+(r.depart!==r.valeur?'  = '+r.depart:'');
    nom.textContent=r.nom.slice(6+f.length+1)||f; l.appendChild(nom);
    const champ=document.createElement('input'); champ.type='text'; champ.value=r.valeur; champ.spellcheck=false;
    const s=unite(r.depart||r.valeur); let gl=null;
    if(s){ const [a,b,p]=bornes(s.n,s.u); gl=document.createElement('input'); gl.type='range';
           gl.min=a; gl.max=b; gl.step=p; gl.value=s.n; l.appendChild(gl); }
    l.appendChild(champ); corps.appendChild(l);
    const poser=(v)=>{ modifs[r.nom]=v; nom.classList.add('mod');
      fetch('/poser',{method:'POST',headers:{'content-type':'application/json'},
                      body:JSON.stringify({nom:r.nom,valeur:v})}); };
    champ.oninput=()=>{ poser(champ.value); const q=unite(champ.value); if(gl&&q) gl.value=q.n; };
    if(gl) gl.oninput=()=>{ const v=gl.value+(s.u||''); champ.value=v; poser(v); };
  }
});

document.getElementById('enr').onclick=()=>{
  fetch('/enregistrer',{method:'POST'}).then(r=>r.json()).then(d=>{ mot.textContent=d.mot; });
};
document.getElementById('raz').onclick=()=>{
  fetch('/raz',{method:'POST'}).then(()=>location.reload());
};
</script></html>"""


class Poste(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _rendre(self, code, corps, type_="application/json"):
        data = corps if isinstance(corps, bytes) else corps.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", type_ + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        # ⚠️ L'APPLICATION VIENT D'UNE AUTRE ORIGINE (capacitor://, file://) :
        # sans cet en-tete, le navigateur de la coque refuse la reponse et
        # l'atelier reste muet sans dire pourquoi.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._rendre(204, b"")

    def do_GET(self):
        if self.path.startswith("/etat"):
            with VERROU:
                self._rendre(200, json.dumps(ETAT))
            return
        if self.path.startswith("/reglages"):
            self._rendre(200, json.dumps(reglages()))
            return
        self._rendre(200, PAGE, "text/html")

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        brut = self.rfile.read(n) if n else b"{}"
        if self.path.startswith("/poser"):
            d = json.loads(brut or b"{}")
            with VERROU:
                ETAT["vars"][d["nom"]] = d["valeur"]
                ETAT["v"] += 1
            self._rendre(200, json.dumps({"v": ETAT["v"]}))
            return
        if self.path.startswith("/enregistrer"):
            with VERROU:
                poses, mot = enregistrer(dict(ETAT["vars"]))
            print("   " + mot)
            self._rendre(200, json.dumps({"poses": poses, "mot": mot}))
            return
        if self.path.startswith("/raz"):
            with VERROU:
                ETAT["vars"] = {}
                ETAT["v"] += 1
            self._rendre(200, json.dumps({"v": ETAT["v"]}))
            return
        self._rendre(404, json.dumps({"erreur": "inconnu"}))


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    n = len(reglages())
    print("Studio — %d reglages lus dans www/css/" % n)
    print("   atelier  : http://localhost:%d" % PORT)
    print("   l'apercu : ouvre le jeu dans le simulateur, il se branche seul")
    print("   (ctrl-C pour arreter)")
    with Serveur(("0.0.0.0", PORT), Poste) as srv:
        try:
            webbrowser.open("http://localhost:%d" % PORT)
        except Exception:
            pass
        srv.serve_forever()


if __name__ == "__main__":
    main()
