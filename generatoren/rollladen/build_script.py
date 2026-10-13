#!/usr/bin/env python3
# Erzeugt schwiegereltern_rollladen.js (02.10.2026, Claude)
import json
r = json.load(open("raeume.json", encoding="utf-8"))
ROOMS = "[\n" + ",\n".join("    { id: '%s', name: '%s' }" % (x["id"], x["name"]) for x in r) + "\n]"
js = open("vorlage.js", encoding="utf-8").read().replace("/*ROOMS*/", ROOMS)
open("schwiegereltern_rollladen.js", "w", encoding="utf-8").write(js)
print("geschrieben:", len(js), "Zeichen,", len(r), "Raeume")
