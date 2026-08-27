#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import sys
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
sys.path.insert(0, RACINE)

import asc                                  # noqa: E402  (le jeton ES256)

BUNDLE = "com.nabil.piratesdice"
SOURCE = os.path.join(RACINE, "store", "captures")

# Le format Apple, et le dossier de captures qui lui correspond.
FORMATS = {
    "APP_IPHONE_67": "apple67",
    "APP_IPAD_PRO_3GEN_129": "ipad129",
}

# La langue de la fiche, et le dossier de captures qui lui correspond.
LANGUES = {"en-US": "en", "fr-FR": "fr", "es-ES": "es", "ar-SA": "ar"}


def api(chemin, methode="GET", corps=None):
    url = "https://api.appstoreconnect.apple.com" + chemin
    data = json.dumps(corps).encode() if corps is not None else None
    req = urllib.request.Request(url, data=data, method=methode)
    req.add_header("Authorization", "Bearer " + asc.jeton())
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            brut = r.read()
            return json.loads(brut) if brut else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        raise SystemExit("HTTP %d sur %s\n%s" % (e.code, chemin, detail))


def deposer(url, methode, entetes, octets):
    req = urllib.request.Request(url, data=octets, method=methode)
    for h in entetes:
        req.add_header(h["name"], h["value"])
    with urllib.request.urlopen(req) as r:
        r.read()


def jeu_de_captures(loc_id, format_apple):
    """Le jeu existant pour ce format, ou un jeu neuf. Vide dans les deux cas."""
    d = api("/v1/appStoreVersionLocalizations/%s/appScreenshotSets" % loc_id)
    for s in d.get("data", []):
        if s["attributes"]["screenshotDisplayType"] == format_apple:
            for img in api("/v1/appScreenshotSets/%s/appScreenshots" % s["id"]).get("data", []):
                api("/v1/appScreenshots/%s" % img["id"], "DELETE")
            return s["id"], "vide"
    neuf = api("/v1/appScreenshotSets", "POST", {
        "data": {
            "type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": format_apple},
            "relationships": {"appStoreVersionLocalization": {
                "data": {"type": "appStoreVersionLocalizations", "id": loc_id}}},
        }})
    return neuf["data"]["id"], "cree"


def poser(set_id, chemin, rang):
    octets = open(chemin, "rb").read()
    reserve = api("/v1/appScreenshots", "POST", {
        "data": {
            "type": "appScreenshots",
            "attributes": {"fileName": os.path.basename(chemin),
                           "fileSize": len(octets)},
            "relationships": {"appScreenshotSet": {
                "data": {"type": "appScreenshotSets", "id": set_id}}},
        }})
    ident = reserve["data"]["id"]
    try:
        for op in reserve["data"]["attributes"]["uploadOperations"]:
            morceau = octets[op["offset"]:op["offset"] + op["length"]]
            deposer(op["url"], op["method"], op.get("requestHeaders", []), morceau)
        api("/v1/appScreenshots/%s" % ident, "PATCH", {
            "data": {"type": "appScreenshots", "id": ident,
                     "attributes": {"uploaded": True,
                                    "sourceFileChecksum": hashlib.md5(octets).hexdigest()}}})
    except Exception:
        api("/v1/appScreenshots/%s" % ident, "DELETE")   # jamais de reserve orpheline
        raise
    return ident


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langues", nargs="*", default=sorted(LANGUES))
    ap.add_argument("--formats", nargs="*", default=sorted(FORMATS))
    args = ap.parse_args()

    app = api("/v1/apps?filter[bundleId]=" + BUNDLE)["data"][0]["id"]
    versions = api("/v1/apps/%s/appStoreVersions?limit=1" % app)["data"]
    if not versions:
        sys.exit("aucune version dans App Store Connect")
    version = versions[0]
    print("version %s (%s)" % (version["attributes"]["versionString"],
                               version["attributes"]["appStoreState"]))

    locs = {l["attributes"]["locale"]: l["id"] for l in
            api("/v1/appStoreVersions/%s/appStoreVersionLocalizations" % version["id"])["data"]}

    for langue in args.langues:
        if langue not in locs:
            print("  %-6s absente de la fiche" % langue)
            continue
        for format_apple in args.formats:
            dossier = os.path.join(SOURCE, LANGUES[langue], FORMATS[format_apple])
            if not os.path.isdir(dossier):
                print("  %-6s %-24s captures absentes (%s)"
                      % (langue, format_apple, os.path.relpath(dossier, RACINE)))
                continue
            images = sorted(n for n in os.listdir(dossier) if n.endswith(".png"))
            set_id, etat = jeu_de_captures(locs[langue], format_apple)
            for rang, nom in enumerate(images):
                poser(set_id, os.path.join(dossier, nom), rang)
            print("  %-6s %-24s %d capture(s) (%s)"
                  % (langue, format_apple, len(images), etat))
    print("\nfait. Les captures sont posees sur la version, pas encore soumises.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
