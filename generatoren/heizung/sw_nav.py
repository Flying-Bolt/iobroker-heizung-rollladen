# Navigationsleiste fuer das Projekt Schwiegereltern (04.10.2026, Claude): gleiche Liste wie die Leiste in "main",
# plus die eigenen Views. Verweise per <a href> (Navigationsknoepfe koennen nur Views desselben Projekts oeffnen).
# Idempotent: add_nav(d) tut nichts, wenn Widget NAVID schon in der View steht.
import json
from urllib.parse import quote
NAVID = "w00090"; H = 44   # Hoehe, um die alles nach unten rutscht
EIGEN = [("Räume", "Schwiegereltern", "Raeume"), ("Rollladen", "Schwiegereltern", "Rollladen")]
GRUPPEN = [  # Farbleiste wie in main
  ("#f5a623", [("Power","Energy_Consumption"),("Energy","E3DC"),("E&K","E&K"),("Prog","Prognosen"),("Lade","Ladesteuerung")]),
  ("#4c9be8", [("Heizung","Heizung_Boiler"),("HMU","HMU"),("Schema","Heizung"),("Klima","Raumklima"),("Therm","Thermostate"),("Pool","Pool"),("Bunker","Bunker"),("Present","Present")]),
  ("#5cc46a", [("Graph","Dashboard"),("Monitor","Monitor"),("Value","Value"),("Meter","AI"),("KASPA","kaspa"),("Wind","Wind")]),
  ("#b07be0", [("Batt","Batterie"),("Backup","Sicherungen"),("USV","USV"),("WEB","Dashboard")]),
]
def html(aktiv):
    n = len(EIGEN) + sum(len(g[1]) for g in GRUPPEN); w = 1540; gap = 4; extra = 10
    bw = (w - 16 - gap * (n - 1) - extra * len(GRUPPEN)) / n
    x = 8; out = []
    def knopf(text, href, farbe, akt):
        nonlocal x
        bg = "linear-gradient(#f04040,#c91d1d)" if akt else "linear-gradient(#2a2a2a,#171717)"
        bd = "#ff7a7a" if akt else "#4a4a4a"
        st = ("position:absolute;left:%.1fpx;top:3px;width:%.1fpx;height:22px;box-sizing:border-box;border:1px solid %s;"
              "border-bottom:3px solid %s;border-radius:6px;background:%s;color:%s;font-family:'Roboto Condensed','Arial Narrow',Arial,sans-serif;"
              "font-size:12px;line-height:18px;text-align:center;text-decoration:none;%s") % (x, bw, bd, farbe if not akt else "#ff7a7a", bg, "#fff" if akt else "#e8f0f8", "font-weight:700;" if akt else "")
        out.append('<a href="%s" style="%s" onmouseover="this.style.borderColor=\'#ee2b2b\'" onmouseout="this.style.borderColor=\'%s\'">%s</a>' % (href, st, bd, text.replace("&", "&amp;")))
        x += bw + gap
    for t, proj, view in EIGEN:
        knopf(t, "/vis-2/index.html?%s#%s" % (proj, quote(view)), "#ff7ab6", view == aktiv)
    x += extra - gap
    for farbe, liste in GRUPPEN:
        for t, view in liste: knopf(t, "/vis-2/index.html?main#%s" % quote(view), farbe, False)
        x += extra
    return ('<div style="position:relative;width:%dpx;height:28px;box-sizing:border-box;border:1px solid #3d3d3d;border-radius:8px;'
            'background:linear-gradient(#1b1b1b,#0a0a0a);box-shadow:inset 0 1px 0 #333,0 2px 6px rgba(0,0,0,0.5)">%s</div>') % (w, "".join(out))
def add_nav(d):
    for view in ("Raeume", "Rollladen"):
        v = d[view]
        if NAVID in v["widgets"]: v["widgets"][NAVID]["data"]["html"] = html(view); continue
        for w in v["widgets"].values(): w["style"]["top"] = "%dpx" % (int(float(w["style"]["top"][:-2])) + H)
        v["settings"]["sizey"] = str(int(v["settings"]["sizey"]) + H)
        v["widgets"][NAVID] = {"tpl": "tplHtml", "data": {"html": html(view), "bindings": [], "g_fixed": True}, "style": {"left": "30px", "top": "8px", "width": "1540px", "height": "28px", "z-index": "5"}, "widgetSet": "basic"}
    return d
