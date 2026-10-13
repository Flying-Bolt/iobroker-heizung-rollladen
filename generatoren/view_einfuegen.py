#!/usr/bin/env python3
"""Fuegt eine View in eine vis-views.json (vis-2-Projekt) ein, ohne bestehende Views zu veraendern.

Aufruf:  view_einfuegen.py <projekt_vis-views.json> <ansicht.json> <ViewName> <ausgabe.json>
  projekt_vis-views.json  Inhalt des Projekts, vorher mit `iobroker file read vis-2.0/<Projekt>/vis-views.json <datei>` geholt
  ansicht.json            ../views/*.json (voller View-Export) ODER ausgabe/batterie_view.json (Generator: nur widgets + sizey)
  ViewName                Name der neuen View (Anker in der Adresse: ...?<Projekt>#<ViewName>)
Widget-IDs (wNNNNN) muessen im ganzen Projekt eindeutig sein: kollidierende IDs werden neu vergeben.
Existiert die View schon, wird abgebrochen (erst von Hand entfernen oder anderen Namen waehlen).
"""
import json, re, sys
proj_p, ans_p, name, out_p = sys.argv[1:5]
t = open(proj_p, encoding="utf-8").read(); proj = json.loads(t[t.index("{"):])
ans = json.load(open(ans_p, encoding="utf-8"))
if name in proj: sys.exit("ABBRUCH: View '%s' existiert schon im Projekt" % name)
vorhanden = set()
for k, v in proj.items():
    if k != "___settings" and isinstance(v, dict): vorhanden |= set(v.get("widgets", {}))
hoechste = max([int(re.sub(r"\D", "", w) or 0) for w in vorhanden] + [0])
neu = {}; umbenannt = 0
for wid, w in ans["widgets"].items():
    if wid in vorhanden or wid in neu:
        hoechste += 1; wid = "w%05d" % hoechste; umbenannt += 1
    neu[wid] = w
if "settings" in ans: einst = ans["settings"]
else:   # Einstellungen einer bestehenden View uebernehmen, nur die Hoehe anpassen
    quelle = next(v for k, v in proj.items() if k != "___settings" and isinstance(v, dict) and "settings" in v)
    einst = json.loads(json.dumps(quelle["settings"])); einst["sizey"] = str(ans.get("sizey", einst.get("sizey", 1000)))
proj[name] = {"settings": einst, "widgets": neu, "name": name, "filterList": [], "activeWidgets": []}
json.dump(proj, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("View '%s' eingefuegt: %d Widgets (%d umnummeriert), Projekt hat jetzt %d Views" % (name, len(neu), umbenannt, sum(1 for k in proj if k != "___settings")))
