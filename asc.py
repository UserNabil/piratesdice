#!/usr/bin/env python3
"""asc.py — le strict necessaire pour parler a App Store Connect.

Une cle d'API ne s'utilise pas telle quelle : elle SIGNE un jeton de courte duree
(ES256), et c'est le jeton qu'on presente. D'ou ce fichier, plutot qu'un `curl`
par appel.

    PD_ASC_KEY_ID   l'identifiant de la cle (le XXXX de AuthKey_XXXX.p8)
    PD_ASC_ISSUER   l'emetteur, lu dans Users and Access > Integrations

Usage :
    python3 asc.py get /v1/apps?filter[bundleId]=com.nabil.piratesdice
    python3 asc.py post /v1/appStoreVersionSubmissions '{"data": …}'
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt

BASE = "https://api.appstoreconnect.apple.com"
CLES = [os.path.expanduser("~/.appstoreconnect/private"),
        os.path.expanduser("~/.appstoreconnect/private_keys")]


def jeton():
    key_id = os.environ.get("PD_ASC_KEY_ID")
    issuer = os.environ.get("PD_ASC_ISSUER")
    if not key_id or not issuer:
        sys.exit("PD_ASC_KEY_ID ou PD_ASC_ISSUER absent.")
    for dossier in CLES:
        chemin = os.path.join(dossier, "AuthKey_%s.p8" % key_id)
        if os.path.isfile(chemin):
            break
    else:
        sys.exit("cle AuthKey_%s.p8 introuvable dans %s" % (key_id, " ni ".join(CLES)))
    secret = open(chemin).read()
    # 20 minutes : Apple refuse au-dela, et un jeton long ne sert a rien ici.
    return jwt.encode({"iss": issuer, "iat": int(time.time()),
                       "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"},
                      secret, algorithm="ES256", headers={"kid": key_id, "typ": "JWT"})


def appel(methode, chemin, corps=None):
    req = urllib.request.Request(
        BASE + chemin, method=methode,
        data=json.dumps(corps).encode() if corps is not None else None,
        headers={"Authorization": "Bearer " + jeton(),
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            brut = r.read()
            return json.loads(brut) if brut else {"status": r.status}
    except urllib.error.HTTPError as err:
        # ⚠️ Apple met la RAISON dans le corps de l'erreur, jamais dans le code.
        # L'avaler, c'est transformer « il manque une capture » en « 409 ».
        detail = err.read().decode(errors="replace")
        raise SystemExit("HTTP %d sur %s\n%s" % (err.code, chemin, detail))


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    methode, chemin = sys.argv[1].upper(), sys.argv[2]
    corps = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
    print(json.dumps(appel(methode, chemin, corps), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
