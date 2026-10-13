#!/usr/bin/env python3
# Ladezeit-Umbau Schwiegereltern-View (03.10.2026, Claude): jedes HTML-Widget mit Bindungen bekommt EINE Bindung auf
# 0_userdata.0.Schwiegereltern_Karten.<kNN>; das Skript Schwiegereltern_Karten rendert die Vorlagen selbst.
# Aufruf: build_karten.py <views_ein.json> <views_aus.json> <skript_aus.js>
#   views_ein = Inhalt von vis-2.0/Schwiegereltern/vis-views.json (laufend ODER frisch generiert); Views Raeume + Rollladen werden umgebaut.
import json, sys, re
ein, aus, jsout = sys.argv[1:4]
t = open(ein, encoding="utf-8").read(); d = json.loads(t[t.index("{"):])
KP = "0_userdata.0.Schwiegereltern_Karten."
tpl = {}; nb = 0; zahl = {}
for view, pre in (("Raeume", "r"), ("Rollladen", "l")):
    n = 0
    for wid, w in sorted(d[view]["widgets"].items()):
        h = w["data"].get("html")
        if h is None or "{" not in h or h.startswith("{" + KP): continue
        n += 1; key = "%s%02d" % (pre, n)
        tpl[key] = h; nb += len(re.findall(r"\{[^{}]*\}", h))
        w["data"]["html"] = "{%s%s}" % (KP, key); w["data"]["bindings"] = ["html"]
    zahl[view] = n
from sw_nav import add_nav; add_nav(d)   # Navigationsleiste (04.10.2026)
json.dump(d, open(aus, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
js = open("karten_vorlage.js", encoding="utf-8").read().replace("/*TEMPLATES*/{}", json.dumps(tpl, ensure_ascii=False))
open(jsout, "w", encoding="utf-8").write(js)
print("Vorlagen:", len(tpl), zahl, "| Bindungen ins Skript verlagert:", nb)
