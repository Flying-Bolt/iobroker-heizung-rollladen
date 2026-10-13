#!/usr/bin/env python3
# Generator fuer das vis-2-Projekt "Schwiegereltern" (View "Raeume"), 01.10.2026, Claude.
# Erzeugt vis-views.json. Regeln fuer Bindungen: keine ':' und '#' in Formeln (nur in der
# Variablendefinition), keine Entities, keine geschweiften Klammern ausser Bindungen.
import json, sys, re

P = "0_userdata.0.Schwiegereltern."
FONT = "'Roboto Condensed','Arial Narrow',Arial,sans-serif"

def B(*parts):
    """Bindung {a:oid;b:oid;formel} bzw. {oid}"""
    return "{" + ";".join(parts) + "}"
def V(var, oid):
    return var + ":" + oid
def f1(v):
    return v + ".toFixed(1).replace('.',',')"
def tcol(v):
    return (v + "<18&&'dodgerblue'||" + v + "<20&&'deepskyblue'||" + v + "<22&&'mediumseagreen'||" +
            v + "<24&&'gold'||" + v + "<26&&'orange'||'tomato'")

ROOMS = [
    dict(id="Wohnzimmer", name="Wohnzimmer", accent="#f2a93b", x=30, devices=[
        dict(name="Wandthermostat", typ="HmIP-WTH-2", adr="00AB0000000007"),
        dict(name="Heizkörperthermostat", typ="HmIP-eTRV-B-2", adr="00AB0000000008"),
        dict(name="Fensterkontakt", typ="HmIP-SWDM-2", adr="00AB0000000009")],
        window="00AB0000000009", wlabel="Terrassentür", wkind="door", has_humidity=True),
    dict(id="Kueche", name="Küche", accent="#4c9be8", x=550, devices=[
        dict(name="Heizkörperthermostat", typ="HmIP-eTRV-B-2", adr="00AB0000000010"),
        dict(name="Fensterkontakt", typ="HmIP-SWDO-2", adr="00AB0000000011")],
        window="00AB0000000011", wlabel="Fenster", wkind="window", has_humidity=False),
    dict(id="Keller", name="Keller", accent="#b07be0", x=1070, devices=[
        dict(name="Thermostat Flur", typ="HmIP-eTRV-2", adr="00AB0000000012")],
        window=None, wlabel="Fenster", wkind="window", has_humidity=False),
]
ALL_DEVICES = [d["adr"] for r in ROOMS for d in r["devices"]]
WINDOWS = [r["window"] for r in ROOMS]

FLOORS = [   # Geschosse wie bei main#Raumklima (04.10.2026, von Besitzer bestaetigt: Wohnzimmer + Kueche im EG, Keller im UG)
    dict(name="Erdgeschoss", accent="#f2a93b", rooms=["Wohnzimmer", "Kueche"]),
    dict(name="Untergeschoss", accent="#3ddc84", rooms=["Keller"]),
]
def floor_band(f):
    rs = f["rooms"]
    ist = [V(chr(97 + i), P + r + ".Ist") for i, r in enumerate(rs)]
    nm = [chr(97 + i) for i in range(len(rs))]
    summe = "+".join("(%s>0&&%s||0)" % (n, n) for n in nm)
    anzahl = "+".join("(%s>0)" % n for n in nm)
    mean = B(*(ist + ["((%s)/Math.max(1,%s)).toFixed(1).replace('.',',')" % (summe, anzahl)]))
    wo = [V(chr(97 + i), P + r + ".Fenster_Gruppe") for i, r in enumerate(rs)]
    cnt = "+".join("(%s==1?1:0)" % n for n in nm)
    nopen = B(*(wo + [cnt]))
    opencol = B(*(wo + ["(%s)>0&&'tomato'||'#8a96a0'" % cnt]))
    return ('<div style="position:relative;width:1540px;height:44px;font-family:%s;color:#ffffff;">'
            '<div style="position:absolute;left:0;top:4px;width:7px;height:34px;border-radius:3px;background:%s;"></div>'
            '<div style="position:absolute;left:22px;top:2px;font-size:30px;font-weight:700;letter-spacing:3px;">%s</div>'
            '<div style="position:absolute;right:0;top:12px;font-size:16px;color:#9aa5ad;">Ø <b style="color:#e9eef2;">%s °C</b> · %d %s'
            ' · <span style="color:%s;">%s offen</span></div>'
            '<div style="position:absolute;left:0;top:42px;width:1540px;height:2px;background:linear-gradient(90deg,%s,rgba(255,255,255,0));"></div>'
            '</div>' % (FONT, f["accent"], f["name"].upper(), mean, len(rs), "Raum" if len(rs) == 1 else "Räume", opencol, nopen, f["accent"]))

LABEL = "font-size:12px;letter-spacing:1.6px;color:#7f8b95;"
SH = 146   # Platz fuer den Shelly-Block (130 + 16) unter den Kacheln, Raumkarten rutschen nach unten (04.10.2026)
DY = 128   # Platz fuer den Bedienblock zwischen Fenster und Heizprofil

def card(r):
    pid = P + r["id"] + "."
    o = []
    w, h = 500, 736 + DY
    o.append('<div style="position:absolute;left:0;top:0;width:500px;height:6px;background:%s;"></div>' % r["accent"])
    # Titel + Betriebsart
    o.append('<div style="position:absolute;left:24px;top:20px;font-size:32px;font-weight:700;letter-spacing:0.5px;">%s</div>' % r["name"])
    chipcol = B(V("m", pid + "Betriebsart"), "m=='Automatik'&&'lightgreen'||m=='Manuell'&&'gold'||'orange'")
    o.append('<div style="position:absolute;right:24px;top:26px;padding:5px 14px;border-radius:15px;background:rgba(255,255,255,0.07);'
             'border:1px solid rgba(255,255,255,0.2);font-size:15px;font-weight:700;color:%s;">%s</div>' % (chipcol, B(pid + "Betriebsart")))
    # Tacho
    ist = B(V("t", pid + "Ist"), f1("t"))
    arc = B(V("t", pid + "Ist"), "Math.max(0,Math.min(75,(t-10)/20*75)).toFixed(1)")
    col = B(V("t", pid + "Ist"), tcol("t"))
    comfort = B(V("t", pid + "Ist"), "t<18&&'kalt'||t<20&&'kühl'||t<22&&'behaglich'||t<24&&'angenehm'||t<26&&'warm'||'heiß'")
    rot = B(V("s", pid + "Soll"), "((Math.max(10,Math.min(30,s))-10)/20-0.5)*270")
    o.append('<svg style="position:absolute;left:8px;top:72px;" width="256" height="256" viewBox="0 0 250 250">'
             '<circle cx="125" cy="125" r="100" fill="none" stroke="#252c33" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="75 25" transform="rotate(135 125 125)"/>'
             '<circle cx="125" cy="125" r="100" fill="none" stroke="%s" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="%s 100" transform="rotate(135 125 125)"/>'
             '<g transform="rotate(%s 125 125)"><rect x="120" y="9" width="10" height="34" rx="3" fill="#ffffff"/></g>'
             '<text x="125" y="128" text-anchor="middle" font-size="62" font-weight="700" fill="#ffffff" font-family="%s">%s</text>'
             '<text x="125" y="158" text-anchor="middle" font-size="17" fill="#9aa5ad" font-family="%s">°C  Raumtemperatur</text>'
             '<text x="125" y="206" text-anchor="middle" font-size="22" font-weight="700" fill="%s" font-family="%s">%s</text>'
             '<text x="52" y="226" text-anchor="middle" font-size="12" fill="#6d7780" font-family="%s">10°</text>'
             '<text x="198" y="226" text-anchor="middle" font-size="12" fill="#6d7780" font-family="%s">30°</text>'
             '</svg>' % (col, arc, rot, FONT, ist, FONT, col, FONT, comfort, FONT, FONT))
    # Metriken rechts
    soll = B(V("s", pid + "Soll"), f1("s"))
    profil_jetzt = B(V("p", pid + "Soll_laut_Profil"), f1("p"))
    o.append('<div style="position:absolute;left:276px;top:80px;%s">SOLL</div>' % LABEL)
    o.append('<div style="position:absolute;left:276px;top:96px;font-size:46px;font-weight:700;line-height:50px;">%s<span style="font-size:22px;color:#9aa5ad;"> °C</span></div>' % soll)
    o.append('<div style="position:absolute;left:276px;top:150px;font-size:14px;color:#9aa5ad;">laut Profil jetzt <b style="color:#e9eef2;">%s °C</b></div>' % profil_jetzt)
    if r["has_humidity"]:
        feuchte = B(V("f", pid + "Feuchte"), "f>0&&(f+' %')||'kein Sensor'")
        fbar = B(V("f", pid + "Feuchte"), "Math.max(0,Math.min(100,f))")
    else:
        feuchte = "kein Sensor"
        fbar = "0"
    o.append('<div style="position:absolute;left:276px;top:186px;%s">LUFTFEUCHTE</div>' % LABEL)
    o.append('<div style="position:absolute;left:276px;top:202px;font-size:24px;font-weight:700;">%s</div>' % feuchte)
    o.append('<div style="position:absolute;left:276px;top:236px;width:200px;height:6px;border-radius:3px;background:#252c33;">'
             '<div style="width:%s%%;height:6px;border-radius:3px;background:deepskyblue;"></div></div>' % fbar)
    vent = B(V("v", pid + "Ventil"), "v")
    ventw = B(V("v", pid + "Ventil"), "Math.max(0,Math.min(100,v))")
    venttxt = B(V("v", pid + "Ventil"), "v>0&&(v+' % geöffnet')||'Ventil zu – heizt nicht'")
    o.append('<div style="position:absolute;left:276px;top:262px;%s">HEIZKÖRPER-VENTIL</div>' % LABEL)
    o.append('<div style="position:absolute;left:276px;top:280px;width:200px;height:10px;border-radius:5px;background:#252c33;">'
             '<div style="width:%s%%;height:10px;border-radius:5px;background:orangered;"></div></div>' % ventw)
    o.append('<div style="position:absolute;left:276px;top:296px;font-size:14px;color:#cfd6dc;">%s</div>' % venttxt)
    # Fenster
    if r["window"] is None:
        gw0 = B(V("g", pid + "Fenster_Gruppe"), "g==1&&'offen'||'zu'")
        o.append('<div style="position:absolute;left:20px;top:340px;width:460px;height:104px;border-radius:14px;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);"></div>')
        o.append('<svg style="position:absolute;left:34px;top:350px;" width="86" height="84" viewBox="0 0 86 84">'
                 '<rect x="6" y="6" width="74" height="72" rx="5" fill="#1f262c" stroke="#56616a" stroke-width="5" stroke-dasharray="9 6"/>'
                 '<rect x="14" y="14" width="26" height="56" fill="#252c33"/><rect x="46" y="14" width="26" height="56" fill="#252c33"/>'
                 '<line x1="43" y1="14" x2="43" y2="70" stroke="#56616a" stroke-width="3"/></svg>')
        o.append('<div style="position:absolute;left:132px;top:356px;%s">FENSTER</div>' % LABEL)
        o.append('<div style="position:absolute;left:132px;top:374px;font-size:26px;font-weight:700;color:#8a96a0;">Kein Fensterkontakt</div>')
        o.append('<div style="position:absolute;left:132px;top:410px;font-size:13px;color:#9aa5ad;">Das Thermostat meldet: Fenster <b style="color:#cfd6dc;">%s</b></div>' % gw0)
        o.append('<div style="position:absolute;left:132px;top:427px;font-size:13px;color:#6d7780;">In diesem Raum ist kein Kontakt angelernt.</div>')
        wst = None
    else:
        wst = r["window"]
    if wst is not None:
        wid = P + "Geraete." + (wst or "none") + ".STATE"
        open_op = B(V("w", wid), "w==1&&1||0")
        closed_op = B(V("w", wid), "w==1&&0||1")
        wl = r["wlabel"]
        wtxt = B(V("w", wid), "w==1&&'%s OFFEN'||'%s geschlossen'" % (wl, wl))
        is_door = r["wkind"] == "door"
        wcol = B(V("w", wid), "w==1&&'tomato'||'mediumseagreen'")
        gw = B(V("g", pid + "Fenster_Gruppe"), "g==1&&'offen'||'zu'")
        o.append('<div style="position:absolute;left:20px;top:340px;width:460px;height:104px;border-radius:14px;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);"></div>')
        if is_door:
            door_svg = ('<svg style="position:absolute;left:34px;top:350px;" width="86" height="84" viewBox="0 0 86 84">'
                        '<g opacity="%s"><rect x="14" y="4" width="58" height="76" rx="4" fill="#1f262c" stroke="#3ddc84" stroke-width="5"/>'
                        '<rect x="22" y="12" width="42" height="42" fill="#2a4f3b"/><rect x="22" y="60" width="42" height="12" fill="#2a4f3b"/>'
                        '<circle cx="60" cy="58" r="3.5" fill="#3ddc84"/></g>'
                        '<g opacity="%s"><rect x="14" y="4" width="58" height="76" rx="4" fill="#1f262c" stroke="#ff5a4d" stroke-width="5"/>'
                        '<polygon points="20,10 44,2 44,82 20,74" fill="#ff8a80" opacity="0.9"/><circle cx="40" cy="48" r="3" fill="#5a2a27"/>'
                        '<line x1="14" y1="42" x2="4" y2="42" stroke="#ff5a4d" stroke-width="4" stroke-linecap="round"/></g></svg>' % (closed_op, open_op))
            o.append(door_svg)
        else:
            o.append('<svg style="position:absolute;left:34px;top:350px;" width="86" height="84" viewBox="0 0 86 84">'
                     '<g opacity="%s"><rect x="6" y="6" width="74" height="72" rx="5" fill="#1f262c" stroke="#3ddc84" stroke-width="5"/>'
                     '<rect x="14" y="14" width="26" height="56" fill="#2a4f3b"/><rect x="46" y="14" width="26" height="56" fill="#2a4f3b"/>'
                     '<line x1="43" y1="14" x2="43" y2="70" stroke="#3ddc84" stroke-width="3"/></g>'
                     '<g opacity="%s"><rect x="6" y="6" width="74" height="72" rx="5" fill="#1f262c" stroke="#ff5a4d" stroke-width="5"/>'
                     '<rect x="46" y="14" width="26" height="56" fill="#5a2a27"/>'
                     '<polygon points="14,14 36,4 36,76 14,70" fill="#ff8a80" opacity="0.9"/>'
                     '<line x1="10" y1="42" x2="2" y2="42" stroke="#ff5a4d" stroke-width="4" stroke-linecap="round"/></g>'
                     '</svg>' % (closed_op, open_op))
        o.append('<div style="position:absolute;left:132px;top:356px;%s">%s</div>' % (LABEL, wl.upper()))
        o.append('<div style="position:absolute;left:132px;top:374px;font-size:26px;white-space:nowrap;font-weight:700;color:%s;">%s</div>' % (wcol, wtxt))
        o.append('<div style="position:absolute;left:132px;top:410px;font-size:13px;color:#9aa5ad;">Heizungsgruppe meldet: %s <b style="color:#cfd6dc;">%s</b></div>' % ("Tür" if is_door else "Fenster", gw))
        hint = B(V("w", wid), V("g", pid + "Fenster_Gruppe"), "w==1&&g==0&&'Hinweis: Heizung weiß nichts von der offenen %s'||''" % ("Tür" if is_door else "Fenster"))
        o.append('<div style="position:absolute;left:132px;top:427px;font-size:13px;font-weight:700;color:orange;">%s</div>' % hint)
    # Bedienung (Phase 1): Schloss, Soll +/-, Betriebsart, Boost, Profil, Status
    ent = P + "Allgemein.Entsperrt"
    stp = pid + "Stellen."
    op = B(V("e", ent), "e&&1||0.38")
    def sbtn(left, top, w, label, oid, val, bg, fs=16):
        v = ("'%s'" % val) if isinstance(val, str) else str(val)
        return ('<div onclick="vis.setValue(\'%s\',%s)" style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:34px;line-height:34px;text-align:center;'
                'border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:%s;color:#e9eef2;font-size:%dpx;font-weight:700;cursor:pointer;'
                'user-select:none;opacity:%s;">%s</div>' % (oid, v, left, top, w, bg, fs, op, label))
    modebg = lambda code: B(V("m", pid + "Modus_Code"), "m==%d&&'rgba(76,195,138,0.38)'||'rgba(255,255,255,0.08)'" % code)
    profbg = lambda n: B(V("n", pid + "Profil"), "n==%d&&'rgba(76,195,138,0.38)'||'rgba(255,255,255,0.08)'" % n)
    plain = "rgba(255,255,255,0.08)"
    o.append('<div style="position:absolute;left:20px;top:%dpx;width:460px;height:%dpx;border-radius:14px;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);"></div>' % (456, DY - 12))
    o.append('<div style="position:absolute;left:34px;top:466px;%s">BEDIENUNG</div>' % LABEL)
    lockbg = B(V("e", ent), "e&&'rgba(61,220,132,0.3)'||'rgba(255,255,255,0.1)'")
    locktxt = B(V("e", ent), "e&&'🔓 entsperrt (10 s)'||'🔒 Entsperren'")
    o.append('<div onclick="vis.setValue(\'%s\',true)" style="position:absolute;right:34px;top:460px;width:150px;height:26px;line-height:26px;text-align:center;border-radius:13px;'
             'border:1px solid rgba(255,255,255,0.25);background:%s;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;user-select:none;">%s</div>' % (ent, lockbg, locktxt))
    sx = stp + "Soll_Schritt"; bf = stp + "Befehl"
    o.append(sbtn(34, 494, 44, "−", sx, -0.5, plain, 22))
    o.append(sbtn(84, 494, 44, "+", sx, 0.5, plain, 22))
    o.append(sbtn(140, 494, 74, "Auto", bf, "auto", modebg(0), 15))
    o.append(sbtn(220, 494, 84, "Manuell", bf, "manuell", modebg(1), 15))
    o.append(sbtn(310, 494, 94, "Boost 5 min", bf, "boost", plain, 14))
    o.append('<div style="position:absolute;left:34px;top:540px;font-size:13px;line-height:34px;color:#9aa5ad;">Profil</div>')
    for i, n in enumerate((1, 2, 3)):
        o.append(sbtn(84 + i * 50, 536, 44, str(n), bf, "profil%d" % n, profbg(n), 15))
    o.append('<div style="position:absolute;left:250px;top:536px;width:218px;height:34px;font-size:12px;line-height:16px;color:#cfd6dc;overflow:hidden;">%s</div>' % B(stp + "Status"))
    # Heizprofil heute
    pt = B(V("d", pid + "Profil_Tag"), "d")
    pn = B(V("n", pid + "Profil"), "n")
    o.append('<div style="position:absolute;left:24px;top:%dpx;%s">HEIZPROFIL HEUTE</div>' % (462 + DY, LABEL))
    o.append('<div style="position:absolute;right:24px;top:%dpx;font-size:14px;color:#cfd6dc;">%s · Profil %s</div>' % (460 + DY, pt, pn))
    o.append('<div style="position:absolute;left:20px;top:%dpx;width:460px;">%s</div>' % (482 + DY, B(pid + "Timeline_SVG")))
    # Geraete
    o.append('<div style="position:absolute;left:24px;top:%dpx;%s">GERÄTE</div>' % (590 + DY, LABEL))
    y = 614 + DY
    for d in r["devices"]:
        a = P + "Geraete." + d["adr"] + "."
        dot = B(V("u", a + "UNREACH"), "u&&'tomato'||'limegreen'")
        bat = B(V("v", a + "OPERATING_VOLTAGE"), f1("v"))
        bst = a + "Batterie_Status"
        batbg = B(V("s", bst), "s==2&&'rgba(238,44,44,0.34)'||s==1&&'rgba(242,193,78,0.30)'||s==0&&'rgba(61,220,132,0.22)'||'rgba(255,255,255,0.08)'")
        batcol = B(V("s", bst), "s==2&&'tomato'||s==1&&'gold'||s==0&&'limegreen'||'lightgray'")
        battxt = B(V("s", bst), "s==2&&'● leer'||s==1&&'● schwach'||s==0&&'● Batterie'||'● Batterie'")
        dbm = B(V("r", a + "RSSI_DEVICE"), "r")
        def bar(th):
            return B(V("r", a + "RSSI_DEVICE"), "r>" + str(th) + "&&1||0.18")
        o.append('<div style="position:absolute;left:20px;top:%dpx;width:460px;height:32px;font-size:14px;">'
                 '<span style="position:absolute;left:4px;top:8px;width:10px;height:10px;border-radius:5px;background:%s;"></span>'
                 '<span style="position:absolute;left:24px;top:2px;font-weight:700;line-height:17px;color:#e9eef2;">%s</span>'
                 '<span style="position:absolute;left:24px;top:19px;font-size:10px;line-height:12px;color:#6d7780;">%s</span>'
                 '<span style="position:absolute;left:196px;top:3px;line-height:20px;padding:0 9px;border-radius:11px;background:%s;color:%s;font-weight:700;">%s %s V</span>'
                 '<svg style="position:absolute;left:358px;top:7px;" width="30" height="18" viewBox="0 0 30 18">'
                 '<rect x="0" y="12" width="5" height="6" fill="#cfd6dc" opacity="%s"/><rect x="8" y="8" width="5" height="10" fill="#cfd6dc" opacity="%s"/>'
                 '<rect x="16" y="4" width="5" height="14" fill="#cfd6dc" opacity="%s"/><rect x="24" y="0" width="5" height="18" fill="#cfd6dc" opacity="%s"/></svg>'
                 '<span style="position:absolute;left:392px;top:5px;line-height:18px;color:#9aa5ad;">%s dBm</span></div>'
                 % (y, dot, d["name"], d["typ"] + " · " + d["adr"], batbg, batcol, battxt, bat, bar(-95), bar(-88), bar(-80), bar(-70), dbm))
        y += 38
    # In drei uebereinanderliegende Abschnitte teilen (zu viele Bindungen in einem Widget werden nicht mehr aufgeloest)
    bounds = [0, 450, 586, h]
    parts = []
    for i in range(3):
        y0, y1 = bounds[i], bounds[i + 1]
        inner = []
        for it in o:
            m = re.search(r"top:(\d+)px", it)
            y = int(m.group(1)) if m else 0
            if (y0 <= y < y1) or (i == 2 and y >= y1):
                inner.append(re.sub(r"top:(\d+)px", lambda mm: "top:%dpx" % (int(mm.group(1)) - y0), it, count=1))
        radius = "18px 18px 0 0" if i == 0 else "0 0 18px 18px" if i == 2 else "0"
        borders = "border:1px solid #2b333b;" + ("border-bottom:none;" if i == 0 else "border-top:none;border-bottom:none;" if i == 1 else "border-top:none;")
        root = ('<div style="position:relative;width:500px;height:%dpx;box-sizing:border-box;font-family:%s;color:#e9eef2;background:#161b20;%sborder-radius:%s;'
                'overflow:hidden;">' % (y1 - y0, FONT, borders, radius))
        parts.append((y0, y1, root + "".join(inner) + "</div>"))
    return parts

def placeholder():
    return ('<div style="position:relative;width:500px;height:190px;font-family:%s;color:#6d7780;box-sizing:border-box;'
            'border:2px dashed #2f3942;border-radius:18px;background:rgba(255,255,255,0.015);">'
            '<div style="position:absolute;left:28px;top:18px;font-size:64px;line-height:70px;color:#2f3942;">+</div>'
            '<div style="position:absolute;left:28px;top:96px;font-size:26px;font-weight:700;color:#8a96a0;">Weitere Räume</div>'
            '<div style="position:absolute;left:28px;top:130px;font-size:15px;">folgen am Wochenende</div>'
            '</div>' % FONT)

def protokoll(width=1040):
    leer = B(P + "Allgemein.Protokoll_HTML")   # direkte Bindung (eine Formel um HTML-Text liefert 0)
    return ('<div style="position:relative;width:%dpx;height:190px;font-family:%s;color:#cfd6dc;box-sizing:border-box;'
            'background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
            '<div style="position:absolute;left:22px;top:14px;%s">LETZTE BEDIENUNGEN</div>'
            '<div style="position:absolute;left:22px;top:38px;width:%dpx;">%s</div></div>' % (width, FONT, LABEL, width - 40, leer))

def header():
    on = B(V("v", P + "Allgemein.Verbindung"), "v&&'● CCU3 online'||'● CCU3 nicht erreichbar'")
    oncol = B(V("v", P + "Allgemein.Verbindung"), "v&&'limegreen'||'tomato'")
    return ('<div style="position:relative;width:1540px;height:92px;font-family:%s;color:#ffffff;">'
            '<div style="position:absolute;left:0;top:10px;font-size:46px;font-weight:700;letter-spacing:1px;">Raumklima</div>'
            '<div style="position:absolute;left:2px;top:62px;font-size:17px;color:#8a96a0;letter-spacing:0.5px;">Haus der Schwiegereltern · Heizung, Temperatur und Fenster aller Räume</div>'
            '<div style="position:absolute;right:0;top:18px;font-size:19px;font-weight:700;color:%s;">%s</div>'
            '<div style="position:absolute;right:0;top:50px;font-size:14px;color:#8a96a0;">Stand %s · HomeMatic IP über WireGuard</div>'
            '<a href="/vis-2/index.html?main#Dashboard" style="position:absolute;right:0;top:70px;font-size:13px;color:#4c9be8;text-decoration:none;">‹ zur Haupt-Visualisierung</a>'
            '<a href="/vis-2/index.html?main#Batterie" style="position:absolute;right:190px;top:70px;font-size:13px;color:#4c9be8;text-decoration:none;">Batterien ›</a>'
            '<a href="/vis-2/index.html?Schwiegereltern#Rollladen" style="position:absolute;right:274px;top:70px;font-size:13px;color:#4c9be8;text-decoration:none;">Rollladen ›</a>'
            '<div style="position:absolute;left:0;top:90px;width:1540px;height:2px;background:linear-gradient(90deg,#f2a93b,#4c9be8,rgba(76,155,232,0));"></div>'
            '</div>' % (FONT, oncol, on, B(P + "Allgemein.Aktualisiert")))

def tile(label, value, caption, valcol="#ffffff", capcol="#8a96a0"):
    return ('<div style="position:relative;width:370px;height:108px;font-family:%s;color:#e9eef2;'
            'background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
            '<div style="position:absolute;left:20px;top:14px;%s">%s</div>'
            '<div style="position:absolute;left:20px;top:30px;font-size:46px;font-weight:700;line-height:54px;color:%s;">%s</div>'
            '<div style="position:absolute;left:20px;top:84px;font-size:13px;font-weight:700;color:%s;">%s</div></div>'
            % (FONT, LABEL, label, valcol, value, capcol, caption))

def tiles():
    out = []
    n = B(V("n", P + "Allgemein.Fenster_offen"), "n")
    ncol = B(V("n", P + "Allgemein.Fenster_offen"), "n>0&&'tomato'||'mediumseagreen'")
    out.append(tile("FENSTER / TÜREN OFFEN", n, "Terrassentür (Wohnzimmer) und Küchenfenster", ncol))
    a = V("a", P + "Wohnzimmer.Ist"); b = V("b", P + "Kueche.Ist"); c = V("c", P + "Keller.Ist")
    mean = B(a, b, c, "((a+b+c)/3).toFixed(1).replace('.',',')")
    out.append(tile("Ø RAUMTEMPERATUR", mean + '<span style="font-size:24px;color:#9aa5ad;"> °C</span>', "Mittel aus Wohnzimmer, Küche und Keller", "#ffffff"))
    va = V("a", P + "Wohnzimmer.Ventil"); vb = V("b", P + "Kueche.Ventil"); vc = V("c", P + "Keller.Ventil")
    heiz = B(va, vb, vc, "(a>0)+(b>0)+(c>0)")
    heizcol = B(va, vb, vc, "(a>0)+(b>0)+(c>0)>0&&'orangered'||'lightgray'")
    out.append(tile("HEIZUNG AKTIV", heiz + '<span style="font-size:24px;color:#9aa5ad;"> von 3 Räumen</span>', "Ventil in mindestens einem Heizkörper offen", heizcol))
    un = [V(chr(97 + i), P + "Geraete." + adr + ".UNREACH") for i, adr in enumerate(ALL_DEVICES)]
    names_un = [chr(97 + i) for i in range(len(ALL_DEVICES))]
    ok = B(*(un + ["%d-%s" % (len(ALL_DEVICES), "-".join(names_un))]))
    rot = V("r", P + "Allgemein.Batterie_rot"); gelb = V("y", P + "Allgemein.Batterie_gelb")
    batt = B(rot, gelb, "r>0&&(r+' Batterie rot'+(y>0&&(', '+y+' gelb')||''))||y>0&&(y+' Batterie gelb')||'alle Batterien grün'")
    battcol = B(rot, gelb, "r>0&&'tomato'||y>0&&'gold'||'limegreen'")
    out.append(tile("GERÄTE ERREICHBAR", ok + '<span style="font-size:24px;color:#9aa5ad;"> von %d</span>' % len(ALL_DEVICES), batt, "#ffffff", battcol))
    return out

def footer():
    chips = [("#3b6fd4", "kalt unter 18°"), ("#36b8c8", "kühl 18–20°"), ("#4cc38a", "behaglich 20–22°"), ("#f2c14e", "warm 22–24°"), ("#ee6c4d", "heiß über 24°")]
    s = ['<div style="position:relative;width:1540px;height:34px;font-family:%s;font-size:13px;color:#7f8b95;">' % FONT]
    x = 0
    for c, t in chips:
        s.append('<span style="position:absolute;left:%dpx;top:4px;"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:%s;margin-right:6px;vertical-align:-2px;"></span>%s</span>' % (x, c, t))
        x += 160
    s.append('<span style="position:absolute;right:0;top:4px;">Quelle: CCU3 192.168.1.99 · Geräte live · Gruppen alle 60 s · Profile alle 10 min · Bedienung hinter Schloss, Soll 8–26 °C</span></div>')
    return "".join(s)

def widget(html, left, top, width, height, z=1):
    return {
        "tpl": "tplHtml",
        "data": {"g_fixed": True, "g_visibility": False, "g_css_font_text": False, "g_css_background": False,
                 "g_css_shadow_padding": False, "g_css_border": False, "g_gestures": False, "g_signals": False,
                 "g_last_change": False, "visibility-cond": "==", "visibility-val": 1, "visibility-groups-action": "hide",
                 "html": html, "bindings": ["html"]},
        "style": {"left": "%dpx" % left, "top": "%dpx" % top, "width": "%dpx" % width, "height": "%dpx" % height,
                  "z-index": str(z), "bindings": []},
        "widgetSet": "basic"
    }

widgets = {}
n = 1
def add(html, l, t, w, h, z=1):
    global n
    widgets["w%05d" % n] = widget(html, l, t, w, h, z); n += 1

add(header(), 30, 14, 1540, 92)
for i, t in enumerate(tiles()):
    add(t, 30 + i * 390, 124, 370, 108)
add("{0_userdata.0.Schwiegereltern_Shelly.HTML}", 30, 252, 1540, 130)   # Shelly H&T (04.10.2026), Skript Schwiegereltern_Shelly
CARD_X = [30, 550, 1070]
BYID = {r["id"]: r for r in ROOMS}
y = 252 + SH
for f in FLOORS:
    add(floor_band(f), 30, y, 1540, 44)
    y += 54
    for k, rid in enumerate(f["rooms"]):
        r = dict(BYID[rid]); r["accent"] = f["accent"]
        for y0, y1, html in card(r):
            add(html, CARD_X[k], y + y0, 500, y1 - y0)
    if f["name"] == "Erdgeschoss":
        add(placeholder(), 1070, y, 500, 190)
    if f["name"] == "Untergeschoss":
        add(protokoll(1020), 550, y, 1020, 190)
    y += 736 + DY + 28
add(footer(), 30, y, 1540, 34)
SIZEY = y + 34 + 30

view = {
    "settings": {"style": {"background_class": "", "background": "#0b0e11", "color": "#e9eef2"},
                 "theme": "redmond", "sizex": "1600", "sizey": str(SIZEY), "gridSize": "", "useBackground": True, "snapType": None},
    "widgets": widgets, "name": "Raeume", "filterList": [], "activeWidgets": []
}
proj = {"___settings": {"reloadOnSleep": 1800, "reconnectInterval": 10000, "darkReloadScreen": False,
                        "destroyViewsAfter": 30, "statesDebounceTime": ""}, "Raeume": view}
out = sys.argv[1] if len(sys.argv) > 1 else "vis-views_schwiegereltern.json"
open(out, "w", encoding="utf-8").write(json.dumps(proj, indent=2, ensure_ascii=False))
print("geschrieben:", out, "Widgets:", len(widgets), "Groesse:", len(json.dumps(proj)))
