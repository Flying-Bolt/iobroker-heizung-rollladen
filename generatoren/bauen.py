#!/usr/bin/env python3
"""Baut alle Ausgabedateien in ./ausgabe/ (ein Aufruf: python3 bauen.py).

Eingaben (zum Anpassen):
  heizung/build_schwiegereltern.py   Raumliste ROOMS (Gruppen, Geraete, Fensterkontakte, Geschosse) -> View "Raeume"
  rollladen/raeume.json              Rollladenraeume (Aktor, Kanal, Zeiten, Grenzen) -> View "Rollladen" und Skript
  batterie/geraete.json              Batteriegeraete je Zentrale (Kopie von geraete.beispiel.json anlegen und anpassen; sonst gilt das Beispiel)
Ausgabe:
  ausgabe/vis-views.json             vis-2-Projekt mit den Views Raeume + Rollladen (Karten-Bindungen, Navigationsleiste)
  ausgabe/heizung_karten.js          Skript, das die Kartenvorlagen rendert
  ausgabe/rollladen_zeitplan.js      Rollladen-Skript
  ausgabe/batterien_uebersicht.js    Batterie-Skript
  ausgabe/batterie_view.json         View "Batterie" (fuer ein beliebiges Projekt, z. B. main)
Die Skripte heizung_ccu.js und thermostat_waechter.js werden NICHT erzeugt, sie stehen fertig in ../skripte/ und werden von Hand angepasst.
"""
import json, os, shutil, subprocess, sys
HIER = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HIER, "ausgabe"); os.makedirs(OUT, exist_ok=True)
def lauf(ordner, *args):
    r = subprocess.run([sys.executable, *args], cwd=os.path.join(HIER, ordner), capture_output=True, text=True)
    print(r.stdout.strip()); 
    if r.returncode: sys.exit("FEHLER in %s %s:\n%s" % (ordner, args, r.stderr))
tmp = os.path.join(OUT, "_tmp"); os.makedirs(tmp, exist_ok=True)
raeume = os.path.join(tmp, "raeume.json"); roll = os.path.join(tmp, "rollladen_view.json"); proj = os.path.join(tmp, "projekt.json")
lauf("heizung", "build_schwiegereltern.py", raeume)
lauf("rollladen", "build_view.py", roll)
lauf("rollladen", "build_script.py")
shutil.move(os.path.join(HIER, "rollladen", "schwiegereltern_rollladen.js"), os.path.join(OUT, "rollladen_zeitplan.js"))
d = json.load(open(raeume, encoding="utf-8")); r = json.load(open(roll, encoding="utf-8"))
einst = json.loads(json.dumps(d["Raeume"]["settings"])); einst["sizey"] = str(r["sizey"])
d["Rollladen"] = {"settings": einst, "widgets": r["widgets"], "name": "Rollladen", "filterList": [], "activeWidgets": []}
json.dump(d, open(proj, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
lauf("heizung", "build_karten.py", proj, os.path.join(OUT, "vis-views.json"), os.path.join(OUT, "heizung_karten.js"))
geraete = "geraete.json" if os.path.exists(os.path.join(HIER, "batterie", "geraete.json")) else "geraete.beispiel.json"   # eigene Liste hat Vorrang
lauf("batterie", "build_batterien_script.py", geraete, os.path.join(OUT, "batterien_uebersicht.js"))
lauf("batterie", "build_batterie_view.py", os.path.join(OUT, "batterie_view.json"), "1")
shutil.rmtree(tmp); print("fertig:", sorted(os.listdir(OUT)))
