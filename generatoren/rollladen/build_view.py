#!/usr/bin/env python3
# Generator fuer die View "Rollladen" im Projekt "Schwiegereltern" (Dummy mit Zeitplan), 02.10.2026, Claude.
# Aufruf: build_view.py <ausgabe.json>     -> {"widgets": {...}, "sizey": n}
import json, sys
P = "0_userdata.0.Rollladen_Schwiegereltern."
FONT = "'Roboto Condensed','Arial Narrow',Arial,sans-serif"
LABEL = "font-size:12px;letter-spacing:1.6px;color:#7f8b95;"
rooms = json.load(open("raeume.json", encoding="utf-8"))
def B(*parts): return "{" + ";".join(parts) + "}"
def V(var, oid): return var + ":" + oid
ENT = P + "Allgemein.Entsperrt"
OP = B(V("e", ENT), "e&&1||0.38")                       # Knoepfe blass, solange gesperrt

def btn(left, top, w, label, oid, val, bg, fs=15, hh=34):
    v = ("'%s'" % val) if isinstance(val, str) else str(val)
    return ('<div onclick="vis.setValue(\'%s\',%s)" style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx;line-height:%dpx;text-align:center;border-radius:8px;'
            'border:1px solid rgba(255,255,255,0.2);background:%s;color:#e9eef2;font-size:%dpx;font-weight:700;cursor:pointer;user-select:none;opacity:%s;">%s</div>'
            % (oid, v, left, top, w, hh, hh, bg, fs, OP, label))

def root(inner, h, rund, rand):
    return ('<div style="position:relative;width:500px;height:%dpx;box-sizing:border-box;font-family:%s;color:#e9eef2;background:#161b20;%sborder-radius:%s;overflow:hidden;">%s</div>'
            % (h, FONT, rand, rund, inner))

def teil_bedienung(r):
    pid = P + r["id"] + "."
    pos, fa, st, si = pid + "Position", pid + "Fahrt", pid + "Status", pid + "Simuliert"
    zl = pid + "Ziel"
    o = ['<div style="position:absolute;left:0;top:0;width:500px;height:6px;background:%s;"></div>' % r["accent"],
         '<div style="position:absolute;left:24px;top:20px;font-size:32px;font-weight:700;letter-spacing:0.5px;">%s</div>' % r["name"]]
    chip = B(V("s", si), "s&&'DUMMY'||'LIVE'"); chipc = B(V("s", si), "s&&'orange'||'limegreen'")
    o.append('<div style="position:absolute;right:24px;top:26px;padding:4px 14px;border-radius:15px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.2);font-size:14px;font-weight:700;color:%s;">%s</div>' % (chipc, chip))
    h = B(V("p", pos), "((100-Math.max(0,Math.min(100,p)))/100*130).toFixed(1)")
    hy = B(V("p", pos), "(10+(100-Math.max(0,Math.min(100,p)))/100*130-5).toFixed(1)")
    pat = "sl_" + r["id"]
    o.append('<svg style="position:absolute;left:22px;top:76px;" width="124" height="156" viewBox="0 0 124 156">'
             '<defs><pattern id="%s" width="100" height="10" patternUnits="userSpaceOnUse"><rect width="100" height="8" fill="#8b97a1"/><rect y="8" width="100" height="2" fill="#4f5963"/></pattern>'
             '<linearGradient id="gl_%s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5a7e"/><stop offset="1" stop-color="#16324a"/></linearGradient></defs>'
             '<rect x="4" y="4" width="116" height="146" rx="5" fill="#1f262c" stroke="#56616a" stroke-width="4"/>'
             '<rect x="10" y="10" width="104" height="134" fill="url(#gl_%s)"/><rect x="12" y="10" width="100" height="%s" fill="url(#%s)"/>'
             '<rect x="10" y="%s" width="104" height="6" rx="2" fill="#aab4bd"/></svg>' % (pat, r["id"], r["id"], h, pat, hy))
    pcol = B(V("p", pos), "p>=95&&'mediumseagreen'||p<=5&&'#8a96a0'||'gold'")
    ptxt = B(V("p", pos), "p>=95&&'ganz offen'||p<=5&&'geschlossen'||'teilweise offen'")
    o.append('<div style="position:absolute;left:170px;top:70px;%s">POSITION</div>' % LABEL)
    o.append('<div style="position:absolute;left:170px;top:84px;font-size:56px;font-weight:700;line-height:62px;color:%s;">%s<span style="font-size:24px;color:#9aa5ad;"> %%</span></div>' % (pcol, B(V("p", pos), "Math.round(p)")))
    o.append('<div style="position:absolute;left:170px;top:146px;font-size:15px;color:#cfd6dc;">%s</div>' % ptxt)
    o.append('<div style="position:absolute;left:170px;top:168px;font-size:14px;font-weight:700;color:#9aa5ad;">%s</div>' % B(V("s", st), V("z", zl), V("f", fa), "s+(f!=0&&(' · Ziel '+z+' %')||'')"))
    bf = pid + "Befehl"
    o.append(btn(170, 192, 100, "▲ Auf", bf, "auf", "rgba(61,220,132,0.22)"))
    o.append(btn(276, 192, 100, "■ Stopp", bf, "stopp", "rgba(242,193,78,0.22)"))
    o.append(btn(382, 192, 100, "▼ Zu", bf, "zu", "rgba(76,155,232,0.25)"))
    for i, pz in enumerate((0, 25, 50, 75, 100)):
        bg = B(V("z", zl), "z==%d&&'rgba(76,195,138,0.38)'||'rgba(255,255,255,0.08)'" % pz)
        o.append(btn(170 + i * 63, 232, 58, "%d %%" % pz, bf, "z%d" % pz, bg, 13, 28))
    return root("".join(o), 272, "18px 18px 0 0", "border:1px solid #2b333b;border-bottom:none;")

def teil_zeitplan(r):
    pid = P + r["id"] + "."
    bf = pid + "Befehl"
    auto = pid + "Auto"
    o = ['<div style="position:absolute;left:24px;top:6px;%s">ZEITPLAN · EINMAL HOCH, EINMAL RUNTER</div>' % LABEL]
    o.append('<div style="position:absolute;left:24px;top:36px;font-size:15px;line-height:34px;color:#cfd6dc;">Automatik</div>')
    an = B(V("a", auto), "a&&'rgba(61,220,132,0.38)'||'rgba(255,255,255,0.08)'")
    aus = B(V("a", auto), "a&&'rgba(255,255,255,0.08)'||'rgba(238,108,77,0.38)'")
    o.append(btn(120, 36, 70, "AN", bf, "auto_an", an, 15))
    o.append(btn(196, 36, 70, "AUS", bf, "auto_aus", aus, 15))
    for art, y, sym in (("Hoch", 84, "▲ HOCH"), ("Runter", 132, "▼ RUNTER")):
        o.append('<div style="position:absolute;left:24px;top:%dpx;font-size:13px;letter-spacing:1px;line-height:40px;color:#9aa5ad;">%s</div>' % (y, sym))
        o.append('<div style="position:absolute;left:112px;top:%dpx;font-size:36px;font-weight:700;line-height:40px;">%s</div>' % (y, B(pid + art + "_Text")))
        sx = pid + art + "_Schritt"
        for i, (lab, d) in enumerate((("−30", -30), ("−5", -5), ("+5", 5), ("+30", 30))):
            o.append(btn(228 + i * 64, y + 3, 58, lab, sx, d, "rgba(255,255,255,0.08)", 14))
    o.append('<div style="position:absolute;left:24px;top:184px;font-size:14px;color:#cfd6dc;">%s</div>' % B(pid + "Heute"))
    o.append('<div style="position:absolute;left:24px;top:206px;font-size:14px;font-weight:700;color:gold;">%s</div>' % B(pid + "Naechste"))
    o.append('<div style="position:absolute;left:24px;top:230px;width:452px;font-size:12px;color:#9aa5ad;white-space:nowrap;overflow:hidden;">%s</div>' % B(pid + "Meldung"))
    return root("".join(o), 252, "0 0 18px 18px", "border:1px solid #2b333b;border-top:none;")

def header():
    G = P + "Allgemein."
    dm = B(V("d", G + "Dummy"), "d&&'TEILWEISE DUMMY – Rollläden ohne Aktor (Kennzeichen DUMMY) werden nur simuliert'||'LIVE – echte Rollladenaktoren'")
    dc = B(V("d", G + "Dummy"), "d&&'orange'||'limegreen'")
    return ('<div style="position:relative;width:1540px;height:92px;font-family:%s;color:#ffffff;">'
            '<div style="position:absolute;left:0;top:10px;font-size:46px;font-weight:700;letter-spacing:1px;">Rollladen</div>'
            '<div style="position:absolute;left:2px;top:62px;font-size:17px;color:#8a96a0;letter-spacing:0.5px;">Haus der Schwiegereltern · Zeitplan: je Rollladen einmal am Tag hoch und einmal runter</div>'
            '<a href="/vis-2/index.html?Schwiegereltern#Raeume" style="position:absolute;right:0;top:70px;font-size:14px;color:#4c9be8;text-decoration:none;">‹ Raumklima</a>'
            '<div style="position:absolute;left:0;top:90px;width:1540px;height:2px;background:linear-gradient(90deg,#f2a93b,#4c9be8,#b07be0,rgba(176,123,224,0));"></div></div>' % (FONT,))

def tile(label, value, caption, valcol="#ffffff", extra=""):
    return ('<div style="position:relative;width:370px;height:108px;font-family:%s;color:#e9eef2;background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
            '<div style="position:absolute;left:20px;top:14px;%s">%s</div>'
            '<div style="position:absolute;left:20px;top:30px;font-size:46px;font-weight:700;line-height:54px;color:%s;">%s</div>'
            '<div style="position:absolute;left:20px;top:84px;font-size:13px;color:#8a96a0;">%s</div>%s</div>' % (FONT, LABEL, label, valcol, value, caption, extra))

def tiles():
    G = P + "Allgemein."
    n = B(V("n", G + "Anzahl"), "n")
    out = [tile("GANZ OFFEN", B(V("o", G + "Offen"), "o") + '<span style="font-size:24px;color:#9aa5ad;"> von %s</span>' % n, "Position 95 % und mehr", "mediumseagreen"),
           tile("IN FAHRT", B(V("f", G + "Fahrend"), "f"), "Rollläden, die gerade fahren", B(V("f", G + "Fahrend"), "f>0&&'gold'||'#ffffff'"))]
    def ab(left, label, val, bg):
        return btn(left, 50, 104, label, G + "Alle_Befehl", val, bg, 16, 40)
    out.append('<div style="position:relative;width:370px;height:108px;font-family:%s;color:#e9eef2;background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
               '<div style="position:absolute;left:20px;top:14px;%s">ALLE ROLLLÄDEN</div>%s</div>'
               % (FONT, LABEL, ab(20, "▲ Alle auf", "auf", "rgba(61,220,132,0.22)") + ab(132, "■ Stopp", "stopp", "rgba(242,193,78,0.22)") + ab(244, "▼ Alle zu", "zu", "rgba(76,155,232,0.25)")))
    lockbg = B(V("e", ENT), "e&&'rgba(61,220,132,0.3)'||'rgba(255,255,255,0.1)'")
    locktxt = B(V("e", ENT), "e&&'🔓 entsperrt (60 s)'||'🔒 Entsperren'")
    sch = ('<div onclick="vis.setValue(\'%s\',true)" style="position:absolute;left:20px;top:34px;width:200px;height:34px;line-height:34px;text-align:center;border-radius:17px;border:1px solid rgba(255,255,255,0.25);'
           'background:%s;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer;user-select:none;">%s</div>'
           '<div style="position:absolute;left:20px;top:78px;font-size:13px;color:#8a96a0;">Zeitplan aktiv bei %s von %s Rollläden</div>' % (ENT, lockbg, locktxt, B(V("a", G + "Auto_Anzahl"), "a"), n))
    out.append('<div style="position:relative;width:370px;height:108px;font-family:%s;color:#e9eef2;background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
               '<div style="position:absolute;left:20px;top:12px;%s">SCHLOSS</div>%s</div>' % (FONT, LABEL, sch))
    return out

def protokoll():
    return ('<div style="position:relative;width:1540px;height:170px;font-family:%s;color:#cfd6dc;box-sizing:border-box;background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
            '<div style="position:absolute;left:22px;top:14px;%s">LETZTE AKTIONEN</div><div style="position:absolute;left:22px;top:38px;width:1500px;">%s</div></div>'
            % (FONT, LABEL, B(P + "Allgemein.Protokoll_HTML")))

def footer():
    return ('<div style="position:relative;width:1540px;height:34px;font-family:%s;font-size:13px;color:#7f8b95;">'
            '<span style="position:absolute;left:0;top:4px;">Rollläden mit Kennzeichen LIVE fahren den echten Aktor, die mit DUMMY werden simuliert (30 s von zu bis offen). Aktoren trägt man im Skript Schwiegereltern_Rollladen in der Tabelle AKTOR ein, neue Räume in raeume.json. '
            'Der Zeitplan läuft auf ioBroker-Rechner: bei Ausfall zur Schaltzeit wird bis 60 Minuten später nachgeholt.</span></div>' % FONT)

def widget(html, left, top, width, height):
    return {"tpl": "tplHtml",
            "data": {"g_fixed": True, "g_visibility": False, "g_css_font_text": False, "g_css_background": False, "g_css_shadow_padding": False, "g_css_border": False,
                     "g_gestures": False, "g_signals": False, "g_last_change": False, "visibility-cond": "==", "visibility-val": 1, "visibility-groups-action": "hide",
                     "html": html, "bindings": ["html"]},
            "style": {"left": "%dpx" % left, "top": "%dpx" % top, "width": "%dpx" % width, "height": "%dpx" % height, "z-index": "1", "bindings": []},
            "widgetSet": "basic"}

if __name__ == "__main__":
    out = sys.argv[1]; widgets = {}; n = [1]
    def add(html, l, t, w, h):
        widgets["w%05d" % n[0]] = widget(html, l, t, w, h); n[0] += 1
    add(header(), 30, 14, 1540, 92)
    for i, t in enumerate(tiles()): add(t, 30 + i * 390, 124, 370, 108)
    X = [30, 550, 1070]
    ZEILEN = (len(rooms) + 2) // 3; ZH = 272 + 252 + 16          # 3 Karten je Zeile, weitere Zeilen darunter
    for i, r in enumerate(rooms):
        yy = 252 + (i // 3) * ZH
        add(teil_bedienung(r), X[i % 3], yy, 500, 272)
        add(teil_zeitplan(r), X[i % 3], yy + 272, 500, 252)
    y = 252 + (ZEILEN - 1) * ZH + 272 + 252 + 28
    add(protokoll(), 30, y, 1540, 170); y += 170 + 16
    add(footer(), 30, y, 1540, 34)
    json.dump({"widgets": widgets, "sizey": y + 34 + 30}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("Rollladen (Schwiegereltern):", len(widgets), "Widgets, sizey", y + 64)
