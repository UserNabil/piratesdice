#!/usr/bin/env python3
"""Parle a Google Play — sans dependance, pour qu'il n'y ait rien a installer.

Un compte de service s'authentifie par un JWT signe avec sa cle privee, echange
contre un jeton d'acces. C'est vingt lignes ; y ajouter une bibliotheque
serait deplacer le probleme, pas le resoudre.

    python play_api.py --check                  # que voit le compte de service ?
    python play_api.py --upload chemin.aab --track internal --notes-dir store/whatsnew
    python play_api.py --listing                # pousse la fiche (4 langues)

⛔ La cle vit dans signing/play-service-account.json, hors de git.
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# La console Windows est en cp1252 : un simple caractere de coche la ferait
# planter et masquerait le vrai message. On lui donne de l'UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:                                          # noqa: BLE001
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(HERE, "signing", "play-service-account.json")
# LE PAQUET EST UN PARAMETRE, PAS UNE CONSTANTE A REECRIRE.
#
# Le compte de service sert plusieurs applications du meme compte developpeur, et
# tout ce qui suit — l'API, les URL d'envoi, mais aussi `store/listing.json`,
# `store/graphics/` et `store/screenshots/` — est indexe sur ce seul nom. Reecrire
# la constante pour viser une autre app ne casse rien de visible : elle pousserait
# simplement la fiche, l'icone et les captures de The Pirate's Dice sur l'autre
# application, sans une ligne d'erreur. C'est exactement la forme de degat que ce
# fichier passe son temps a eviter ailleurs.
#
#     PLAY_PACKAGE=com.nabil.autre py play_api.py --check
#
# Sans la variable, rien ne change pour The Pirate's Dice.
PACKAGE = os.environ.get("PLAY_PACKAGE", "com.nabil.piratesdice")
# Et le dossier des VISUELS suit le paquet : fiche, icone, bandeau, captures,
# notes de version. Changer l'un sans l'autre publie les images d'une app sur
# une autre, en silence.
#
#     PLAY_PACKAGE=com.nabil.pirate PLAY_STORE_DIR=/chemin/store py play_api.py --check
STORE_DIR = os.path.abspath(os.environ.get("PLAY_STORE_DIR", os.path.join(HERE, "store")))
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" + PACKAGE
UPLOAD = ("https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/"
          + PACKAGE)


def key():
    """Le compte de service, du fichier local OU de l'environnement.

    Une chaine d'integration n'a pas de `signing/` : le secret y arrive par une
    variable. Le fichier reste prioritaire pour que rien ne change en local.
    """
    if os.path.isfile(KEY_PATH):
        return json.load(open(KEY_PATH, encoding="utf-8"))
    brut = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON", "").strip()
    if brut:
        return json.loads(brut)
    sys.exit("cle absente : ni %s, ni PLAY_SERVICE_ACCOUNT_JSON" % KEY_PATH)


def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


def access_token():
    """Signe un JWT et l'echange contre un jeton d'acces (RS256, une heure)."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    cred = key()
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claim = b64url(json.dumps({
        "iss": cred["client_email"], "scope": SCOPE, "aud": cred["token_uri"],
        "iat": now, "exp": now + 3600,
    }).encode())
    body = header + b"." + claim

    private = serialization.load_pem_private_key(cred["private_key"].encode(), password=None)
    signature = private.sign(body, padding.PKCS1v15(), hashes.SHA256())
    assertion = (body + b"." + b64url(signature)).decode()

    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
    }).encode()
    req = urllib.request.Request(cred["token_uri"], data=data,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())["access_token"]


def call(token, url, method="GET", body=None, raw=None, content_type=None):
    headers = {"Authorization": "Bearer " + token}
    payload = raw
    if body is not None:
        payload = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            text = resp.read().decode("utf-8", "replace")
            return True, (json.loads(text) if text.strip() else {})
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", "replace")
        try:
            return False, json.loads(text)
        except Exception:                                  # noqa: BLE001
            return False, {"error": {"code": exc.code, "message": text[:400]}}


CONFLICTS = ("has been deleted", "outside of this Edit", "edit is not valid",
             "has expired")   # ⚠️ manquait : a fait echouer un envoi de 35 Mo


def conflicted(payload):
    """Faut-il simplement RECOMMENCER, sans rien corriger ?

    Deux cas, et un seul comportement :
    - une autre edition Play est passee entre-temps (typiquement la CI qui envoie
      un AAB) : l'edition courante est perimee, il faut la refaire depuis le
      debut ;
    - Google repond 5xx. C'est arrive en pleine reecriture des notes
      (« 503 The service is currently unavailable ») : rien n'est faux dans ce
      qu'on envoie, le service n'etait pas la. Echouer la-dessus obligerait a
      relancer la commande a la main pour une panne d'en face.
    """
    err = (payload or {}).get("error") or {}
    message = str(err.get("message", ""))
    code = err.get("code")
    if isinstance(code, int) and 500 <= code < 600:
        return True
    return any(mark in message for mark in CONFLICTS)


def with_retry(work, tries=4, pause=20):
    """Rejoue `work` tant que Play repond « une autre edition est passee ».

    Deux editions simultanees s'annulent : la CI publie un AAB pendant qu'on
    pousse la fiche, et l'une des deux perd. Plutot que de surveiller a la main
    qui parle a Play, on recommence — l'operation est idempotente.
    """
    for attempt in range(1, tries + 1):
        ok, payload = work()
        if ok or not conflicted(payload):
            return ok, payload
        if attempt < tries:
            print("   une autre edition est passee — nouvel essai dans %d s (%d/%d)"
                  % (pause, attempt, tries - 1))
            time.sleep(pause)
    return False, payload


def why(payload):
    err = (payload or {}).get("error") or {}
    return "%s %s" % (err.get("code", "?"), err.get("message", payload))


def check(token):
    """Le compte de service voit-il l'application ? C'est LE test qui tranche."""
    ok, out = call(token, API + "/edits", method="POST", body={})
    if not ok:
        print("✖ le compte de service ne peut pas ouvrir l'application")
        print("  raison :", why(out))
        code = ((out or {}).get("error") or {}).get("code")
        if code == 401:
            print("  -> le compte n'est pas encore INVITE dans la Play Console")
        elif code == 403:
            print("  -> invite, mais sans le droit de gerer les versions")
        elif code == 404:
            print("  -> l'application n'existe pas encore sous ce nom de paquet, ou aucun")
            print("     paquet n'a jamais ete envoye (le premier envoi doit se faire a la main)")
        return False
    edit = out["id"]
    ok2, tracks = call(token, API + "/edits/%s/tracks" % edit)
    print("✔ acces confirme (edit %s)" % edit)
    if ok2:
        for t in tracks.get("tracks", []):
            rel = t.get("releases") or []
            if not rel:
                print("   piste %-12s vide" % t.get("track"))
                continue
            for r in rel:
                versions = ", ".join(str(v) for v in (r.get("versionCodes") or [])) or "-"
                # ⚠️ UNE VERSION PRESENTE N'EST PAS UNE VERSION DISTRIBUEE. Un
                # `draft` reste dans la console sans jamais partir chez personne,
                # et une fraction d'utilisateurs limite la diffusion : sans ces
                # deux valeurs, on lit « la piste a la version 49 » et on croit
                # que les testeurs l'ont.
                part = r.get("userFraction")
                print("   piste %-12s %-8s etat: %-11s%s" % (
                    t.get("track"), versions, r.get("status") or "?",
                    ("  fraction: %s" % part) if part is not None else ""))
    call(token, API + "/edits/" + edit, method="DELETE")
    return True


def commit(token, edit):
    """Valider une edition, meme quand Play refuse de l'envoyer en revue.

    ⚠️ UN REJET OUVERT BLOQUE TOUT ENVOI AUTOMATIQUE. Tant qu'une violation
    n'est pas resolue, `:commit` repond :

        400 Changes cannot be sent for review automatically.
            Please set the query parameter changesNotSentForReview to true.

    Ce n'est pas une erreur de notre cote : Play demande que la version soit
    deposee SANS demande de revue, puis envoyee a la main depuis la console une
    fois la violation corrigee. On retente donc avec ce parametre, et on le DIT —
    croire la version soumise alors qu'elle attend un geste humain, c'est la
    laisser dormir pendant qu'on croit les testeurs servis.
    """
    ok, out = call(token, API + "/edits/%s:commit" % edit, method="POST")
    if ok:
        return True, out, False
    if "changesNotSentForReview" not in json.dumps(out or {}):
        return False, out, False
    ok2, out2 = call(token, API + "/edits/%s:commit?changesNotSentForReview=true" % edit,
                     method="POST")
    return ok2, out2, True


def notes(folder):
    out = []
    if not folder or not os.path.isdir(folder):
        return out
    for name in sorted(os.listdir(folder)):
        if not name.startswith("whatsnew-"):
            continue
        out.append({"language": name[len("whatsnew-"):],
                    "text": open(os.path.join(folder, name), encoding="utf-8").read().strip()})
    return out


def prochain(token):
    """Le versionCode a utiliser : celui d'apres le plus haut deja envoye.

    ⚠️ POURQUOI PAS LE NUMERO DE COMPILATION. La chaine numerotait avec
    `github.run_number` pendant que les envois a la main suivaient leur propre
    compte. Deux compteurs pour une seule suite : Play refuse un versionCode
    deja pris, et l'echec ne tombe qu'a la DERNIERE etape, apres un build
    complet. Les compilations 1 a 31 de la chaine etaient condamnees d'avance.
    Play est la seule autorite sur ce qui est deja pris : on le lui demande.
    """
    ok, out = call(token, API + "/edits", method="POST", body={})
    if not ok:
        sys.exit("impossible d'ouvrir une edition : " + why(out))
    edit = out["id"]
    ok, out = call(token, API + "/edits/%s/bundles" % edit)
    if not ok:
        sys.exit("impossible de lire les versions : " + why(out))
    call(token, API + "/edits/%s" % edit, method="DELETE")
    codes = [int(b["versionCode"]) for b in out.get("bundles", [])]
    return (max(codes) + 1) if codes else 1


def upload(token, aab, track, notes_dir):
    """L'envoi complet, rejouable d'un bloc.

    ⚠️ UNE EDITION PERIMEE NE SE REPARE PAS AU MILIEU. L'envoi ouvre une edition,
    y depose l'AAB, pose la piste, puis valide. Si une autre edition passe entre
    l'ouverture et la fin — la chaine de la fiche, un geste dans la console —
    Play repond « This edit has expired » et TOUT ce qui suit est perdu : reprendre
    a l'etape suivante n'a aucun sens, l'edition n'existe plus. On refait donc
    depuis l'ouverture. Vecu : un envoi de 35 Mo mort a la derniere seconde.
    """
    blob = open(aab, "rb").read()
    ok, out = with_retry(lambda: envoyer(token, blob, aab, track, notes_dir))
    if not ok:
        sys.exit("envoi refuse : " + why(out))
    version, aLaMain = out
    print("✔ publie sur la piste %s (versionCode %s)" % (track, version))
    if aLaMain:
        print("   ⚠ deposee SANS demande de revue : un rejet est encore ouvert.")
        print("     Envoi a faire depuis la console, une fois la violation corrigee :")
        print("     Publication > Apercu de la publication > Envoyer les modifications")


def envoyer(token, blob, aab, track, notes_dir):
    ok, out = call(token, API + "/edits", method="POST", body={})
    if not ok:
        return False, out
    edit = out["id"]

    print("envoi de %s (%.1f Mo)…" % (os.path.basename(aab), len(blob) / 1e6))
    ok, out = call(token, UPLOAD + "/edits/%s/bundles?uploadType=media" % edit,
                   method="POST", raw=blob, content_type="application/octet-stream")
    if not ok:
        return False, out
    version = out["versionCode"]
    print("   accepte, versionCode %s" % version)

    release = {"name": "1.0.%s" % version, "versionCodes": [str(version)], "status": "completed"}
    body = notes(notes_dir)
    if body:
        release["releaseNotes"] = body
    ok, out = call(token, API + "/edits/%s/tracks/%s" % (edit, track),
                   method="PUT", body={"track": track, "releases": [release]})
    if not ok:
        return False, out

    ok, out, aLaMain = commit(token, edit)
    if not ok:
        return False, out
    return True, (version, aLaMain)



def renotes(token, track, notes_dir):
    """Reecrit les notes de version d'une piste DEJA publiee.

    Une version envoyee garde les notes qu'elle avait au moment de l'envoi. Celles
    de la piste interne annoncaient encore « premiere traversee » a des testeurs
    qui recevaient les capitaines : ce que le testeur lit doit decrire ce qu'il
    installe, sinon il cherche des choses qui n'existent pas et rate celles qui
    viennent d'arriver.

        python play_api.py --notes --track internal
    """
    textes = notes(notes_dir)
    if not textes:
        sys.exit("aucune note dans " + str(notes_dir))

    def travail():
        ok, edit = call(token, API + "/edits", method="POST", body={})
        if not ok:
            return False, edit
        eid = edit["id"]
        ok, piste = call(token, API + "/edits/%s/tracks/%s" % (eid, track))
        if not ok:
            return False, piste
        sorties = piste.get("releases") or []
        if not sorties:
            return False, {"error": {"message": "la piste %s n'a aucune version" % track}}
        for s in sorties:
            s["releaseNotes"] = textes
        ok, out = call(token, API + "/edits/%s/tracks/%s" % (eid, track),
                       method="PUT", body={"track": track, "releases": sorties})
        if not ok:
            return False, out
        return call(token, API + "/edits/%s:commit" % eid, method="POST")

    ok, out = with_retry(travail)
    if not ok:
        sys.exit("notes refusees : " + why(out))
    print("✔ notes de version reecrites sur la piste %s (%d langues)" % (track, len(textes)))


# ── la fiche : textes, captures, icone, banniere ─────────────────────────────

IMAGE_KINDS = {
    "icon": os.path.join(STORE_DIR, "graphics", "icon-512.png"),
    "featureGraphic": os.path.join(STORE_DIR, "graphics", "feature-graphic.png"),
}
SHOTS_ROOT = os.path.join(STORE_DIR, "screenshots")
LISTING = os.path.join(STORE_DIR, "listing.json")

# Les captures sont rangees par LANGUE puis par FORMAT : screenshots/<langue>/<forme>/.
# Play accepte trois familles ; les deux dernieres decident si l'app existe sur les
# surfaces grand ecran, et sans elles il la juge « non optimisee pour tablette ».
SHOT_KINDS = {
    "phone": "phoneScreenshots",
    "seven": "sevenInchScreenshots",
    "ten": "tenInchScreenshots",
}


def listing(token):
    ok, out = with_retry(lambda: push_listing(token))
    if not ok:
        sys.exit("fiche refusee : " + why(out))
    print("✔ fiche publiee (4 langues)")


def push_listing(token):
    """Pousse la fiche dans les quatre langues, avec ses images.

    L'icone et la banniere ne vont QUE sur la langue par defaut : elles ne
    portent aucun mot, et Play les reprend pour les autres langues.

    Les CAPTURES, elles, montrent l'interface — donc du texte. Les poser
    uniquement en anglais, c'etait montrer un jeu anglais a un visiteur francais,
    espagnol ou arabe (l'arabe se lit en plus de droite a gauche : la
    disposition entiere est differente). Chaque langue recoit donc les siennes,
    prises dans cette langue."""
    texts = json.load(open(LISTING, encoding="utf-8"))
    ok, out = call(token, API + "/edits", method="POST", body={})
    if not ok:
        return False, out                      # le reessai s'en charge
    edit = out["id"]

    for lang, body in texts.items():
        ok, out = call(token, API + "/edits/%s/listings/%s" % (edit, lang),
                       method="PUT", body=body)
        print("   %-6s %s" % (lang, "texte pose" if ok else "ECHEC " + why(out)))

    default = "en-US"
    for kind, path in IMAGE_KINDS.items():
        if not os.path.isfile(path):
            print("   %-16s absent : %s" % (kind, path))
            continue
        call(token, API + "/edits/%s/listings/%s/%s" % (edit, default, kind), method="DELETE")
        ok, out = call(token, UPLOAD + "/edits/%s/listings/%s/%s?uploadType=media"
                       % (edit, default, kind), method="POST",
                       raw=open(path, "rb").read(), content_type="image/png")
        print("   %-16s %s" % (kind, "pose" if ok else "ECHEC " + why(out)))

    for lang in texts:
        for forme, genre in SHOT_KINDS.items():
            dossier = os.path.join(SHOTS_ROOT, lang, forme)
            if not os.path.isdir(dossier):
                continue
            # Les captures sont en JPEG : sur un decor sombre, la qualite 92 rend
            # un ecart moyen de 1,8 sur 255 — invisible — pour 29 % du poids.
            # 37 Mo de PNG dans le depot pour la meme image, c'est non.
            images = [n for n in sorted(os.listdir(dossier))
                      if n.endswith(".jpg") or n.endswith(".png")]
            if not images:
                continue
            call(token, API + "/edits/%s/listings/%s/%s" % (edit, lang, genre), method="DELETE")
            poses = 0
            for name in images:
                ok, out = call(token, UPLOAD + "/edits/%s/listings/%s/%s?uploadType=media"
                               % (edit, lang, genre), method="POST",
                               raw=open(os.path.join(dossier, name), "rb").read(),
                               content_type="image/jpeg" if name.endswith(".jpg") else "image/png")
                if ok:
                    poses += 1
                else:
                    print("   %-6s %-10s %-10s ECHEC %s" % (lang, forme, name, why(out)[:60]))
            print("   %-6s %-18s %d capture(s)" % (lang, genre, poses))

    ok, out, _ = commit(token, edit)
    return ok, out


def details(token):
    """Les coordonnees de la fiche : contact et site. Play les exige, l'API les pose."""
    ok, out = call(token, API + "/edits", method="POST", body={})
    if not ok:
        sys.exit("impossible d'ouvrir une edition : " + why(out))
    edit = out["id"]
    ok, out = call(token, API + "/edits/%s/details" % edit, method="PATCH", body={
        "contactEmail": "n.ouldterki@gmail.com",
        "contactWebsite": "https://usernabil.github.io/piratesdice-site/",
        "defaultLanguage": "en-US",
    })
    print("coordonnees :", "posees" if ok else "ECHEC " + why(out))
    ok, out, aLaMain = commit(token, edit)
    print("validation  :", ("ok, sans demande de revue" if aLaMain else "ok") if ok else "ECHEC " + why(out))


def promote(token, version, track):
    """Fait passer une version DEJA envoyee d'une piste a une autre.

    C'est la bonne facon de mettre en production : on promeut le binaire qui a
    ete teste, on n'en reconstruit pas un autre. Un paquet rebati, meme depuis le
    meme code, n'est plus celui que les testeurs ont eu entre les mains.
    """
    ok, out = call(token, API + "/edits", method="POST", body={})
    if not ok:
        sys.exit("impossible d'ouvrir une edition : " + why(out))
    edit = out["id"]

    release = {"name": "1.0.%s" % version, "versionCodes": [str(version)], "status": "completed"}
    notes_body = notes(os.path.join(STORE_DIR, "whatsnew"))
    if notes_body:
        release["releaseNotes"] = notes_body
    ok, out = call(token, API + "/edits/%s/tracks/%s" % (edit, track),
                   method="PUT", body={"track": track, "releases": [release]})
    if not ok:
        sys.exit("piste refusee : " + why(out))
    ok, out, aLaMain = commit(token, edit)
    if not ok:
        sys.exit("validation refusee : " + why(out))
    print("✔ version %s promue sur la piste %s" % (version, track))
    if aLaMain:
        print("   ⚠ deposee SANS demande de revue : un rejet est encore ouvert.")
        print("     Envoi a faire depuis la console, une fois la violation corrigee :")
        print("     Publication > Apercu de la publication > Envoyer les modifications")



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--brut", action="store_true",
                    help="la reponse ENTIERE des pistes, sans resume")
    ap.add_argument("--next-version", action="store_true",
                    help="affiche le prochain versionCode libre, et rien d'autre")
    ap.add_argument("--listing", action="store_true", help="pousse la fiche et ses images")
    ap.add_argument("--details", action="store_true", help="coordonnees de contact")
    ap.add_argument("--promote", metavar="VERSIONCODE", help="promeut une version deja envoyee")
    ap.add_argument("--upload", metavar="AAB")
    ap.add_argument("--notes", action="store_true",
                    help="reecrit les notes de version d'une piste deja publiee")
    ap.add_argument("--track", default="internal")
    ap.add_argument("--notes-dir", default=os.path.join(STORE_DIR, "whatsnew"))
    args = ap.parse_args()

    token = access_token()
    if args.brut:
        # ⚠️ UN RESUME CACHE CE QU'ON N'A PAS PENSE A REGARDER. Des testeurs ne
        # recevaient rien alors que la piste portait la derniere version en
        # « completed » : la raison ne pouvait etre que dans un champ que le
        # resume n'affichait pas — ciblage par pays, fraction d'utilisateurs, ou
        # une seconde version sur la meme piste. On lit donc tout.
        ok, edit = call(token, API + "/edits", method="POST", body={})
        if not ok:
            sys.exit("acces refuse : " + why(edit))
        ok2, tracks = call(token, API + "/edits/%s/tracks" % edit["id"])
        print(json.dumps(tracks, indent=2, ensure_ascii=False))
        return

    if args.next_version:
        print(prochain(token))
    elif args.upload:
        upload(token, args.upload, args.track, args.notes_dir)
    elif args.listing:
        listing(token)
    elif args.details:
        details(token)
    elif args.promote:
        promote(token, args.promote, args.track)
    elif args.notes:
        renotes(token, args.track, args.notes_dir)
    else:
        check(token)


if __name__ == "__main__":
    main()
