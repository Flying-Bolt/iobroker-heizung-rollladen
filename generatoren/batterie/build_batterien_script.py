#!/usr/bin/env python3
# Erzeugt batterien_uebersicht.js aus einer Geraeteliste.
# Aufruf: build_batterien_script.py <geraete.json> <ausgabe.js>
# geraete.json: [{"id": "Haus", "host": "<CCU-IP>", "geraete": [{"adr": "<14 Zeichen>", "typ": "HmIP-eTRV-2", "ort": "Bad", "bez": "Heizkoerperthermostat"}, ...]}, ...]
# Nur batteriebetriebene Geraete eintragen (Netzgeraete haben keinen LOW_BAT-Wert). Beispiel: geraete.beispiel.json
import json, sys
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
js = open("batterien_vorlage.js", encoding="utf-8").read().replace("/*CONFIG*/", json.dumps(cfg, ensure_ascii=False, indent=1))
open(sys.argv[2], "w", encoding="utf-8").write(js)
print("geschrieben:", sys.argv[2], len(js), "Zeichen,", sum(len(c["geraete"]) for c in cfg), "Geraete in", len(cfg), "Zentralen")
