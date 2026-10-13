#!/usr/bin/env python3
# Spielt die vom Generator erzeugte View "Raeume" samt Karten-Vorlagen r01.. ein (04.10.2026, Claude).
# Aufruf: deploy_raeume.py <gen.json> <Anzahl gebundener Widgets>. Sichert vorher View + Karten-Skript im aktuellen Ordner.
import json, re, subprocess, sys, time
gen, erwartet = sys.argv[1], int(sys.argv[2]); PW = "~/passwortdatei.txt"; stamp = time.strftime("%Y%m%d-%H%M%S")
def ssh(c): return subprocess.run(["sshpass","-f",PW,"ssh","pi@192.168.1.99",c],capture_output=True,text=True).stdout
def scp(*f): subprocess.run(["sshpass","-f",PW,"scp","-q",*f,"pi@192.168.1.99:/tmp/"],check=True)
karten = ssh("iobroker object get script.js.Schwiegereltern_Karten --pretty")
t = ssh("cd /tmp && iobroker file read vis-2.0/Schwiegereltern/vis-views.json /tmp/sw-lesen.json >/dev/null 2>&1; cat /tmp/sw-lesen.json"); live = json.loads(t[t.index("{"):])
open("vis-views_schwiegereltern_vor-%s.json" % stamp,"w",encoding="utf-8").write(json.dumps(live,indent=2,ensure_ascii=False)); open("Schwiegereltern_Karten-skript-vor-%s.json" % stamp,"w",encoding="utf-8").write(karten)
src = json.loads(karten)["common"]["source"]; m = re.search(r'const TEMPLATES = (\{.*\});\nconst cache', src, re.S); T = json.loads(m.group(1))
new = json.load(open(gen))["Raeume"]; KP = "0_userdata.0.Schwiegereltern_Karten."; tr = {}; n = 0
for wid, w in sorted(new["widgets"].items()):
    h = w["data"].get("html")
    if h is None or "{" not in h or h.startswith("{0_userdata.0.Schwiegereltern_Shelly"): continue
    n += 1; k = "r%02d" % n; tr[k] = h; w["data"]["html"] = "{%s%s}" % (KP, k); w["data"]["bindings"] = ["html"]
assert n == erwartet, n
T2 = dict(sorted(({k: v for k, v in T.items() if k[0] == "l"} | tr).items())); live["Raeume"] = new
json.dump(live, open("/tmp/sw-stufe.json","w",encoding="utf-8"), indent=2, ensure_ascii=False)
open("/tmp/karten_neu.js","w",encoding="utf-8").write(src[:m.start(1)] + json.dumps(T2, ensure_ascii=False) + src[m.end(1):])
scp("/tmp/karten_neu.js", "/tmp/sw-stufe.json")
print(ssh('chmod 644 /tmp/sw-stufe.json /tmp/karten_neu.js; node --check /tmp/karten_neu.js && iobroker object set script.js.Schwiegereltern_Karten "common.source=$(cat /tmp/karten_neu.js)" && iobroker file write /tmp/sw-stufe.json vis-2.0/Schwiegereltern/vis-views.json 2>&1 | tail -1; rm -f /tmp/karten_neu.js /tmp/sw-stufe.json'))
