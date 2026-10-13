#!/usr/bin/env python3
# Erzeugt batterien_uebersicht.js: Batterieampel aller batteriebetriebenen Geraete beider CCU3 (02.10.2026, Claude)
import json
haus = json.load(open("../Haus-Raumklima/haus-raeume.json", encoding="utf-8"))
roh = json.load(open("batt-geraete-erhebung-20261002.json", encoding="utf-8"))
ORT = {}   # Adresse -> (Ort, Bezeichnung)
for f in haus["floors"]:
    for r in f["rooms"]:
        for d in r["devices"]:
            ORT[d["adr"]] = (r["name"], d["name"])
ORT["00AB0000000013"] = ("Flur 1", "Bewegungsmelder")
ORT["00AB0000000014"] = ("Flur 2", "Bewegungsmelder")
ORT["00AB0000000015"] = ("Haustür", "Türschloss")
SW = {"00AB0000000009": ("Wohnzimmer", "Fensterkontakt (Terrassentür)"), "00AB0000000016": ("Küche", "Fensterkontakt"),
      "00AB0000000017": ("Wohnzimmer", "Wandthermostat"), "00AB0000000008": ("Wohnzimmer", "Heizkörperthermostat"),
      "00AB0000000010": ("Küche", "Heizkörperthermostat"), "00AB0000000012": ("Keller", "Heizkörperthermostat")}
cfg = []
for name, host, key in (("Haus", "192.168.1.99", "Haus"), ("Schwiegereltern", "192.168.1.99", "Schwiegereltern")):
    geraete = []
    for adr, typ, hat_lowbat, *_ in roh[key]:
        if not hat_lowbat: continue                       # netzbetrieben: kein LOW_BAT-Wert
        ort, bez = (SW if name == "Schwiegereltern" else ORT).get(adr, ("?", "Gerät"))
        geraete.append({"adr": adr, "typ": typ, "ort": ort, "bez": bez})
    cfg.append({"id": name, "host": host, "geraete": geraete})
    print(name, len(geraete), "batteriebetriebene Geräte,", sum(1 for g in geraete if g["ort"] == "?"), "ohne Ort")
json.dump(cfg, open("batterien-geraete.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
js = open("batterien_vorlage.js", encoding="utf-8").read().replace("/*CONFIG*/", json.dumps(cfg, ensure_ascii=False, indent=1))
open("batterien_uebersicht.js", "w", encoding="utf-8").write(js)
print("geschrieben:", len(js), "Zeichen")
