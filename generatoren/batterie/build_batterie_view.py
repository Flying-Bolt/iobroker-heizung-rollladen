#!/usr/bin/env python3
# Generator fuer die vis-2-View "Batterie" (Projekt main), 02.10.2026, Claude.
# Aufruf: build_batterie_view.py <ausgabe.json> <erste_widget_nummer>
import json, sys
P = "0_userdata.0.Batterien."
FONT = "'Roboto Condensed','Arial Narrow',Arial,sans-serif"
LABEL = "font-size:12px;letter-spacing:1.6px;color:#7f8b95;"
def B(*parts): return "{" + ";".join(parts) + "}"
def V(var, oid): return var + ":" + oid

def header():
    return ('<div style="position:relative;width:1540px;height:92px;font-family:%s;color:#ffffff;">'
            '<div style="position:absolute;left:0;top:10px;font-size:46px;font-weight:700;letter-spacing:1px;">Batterien</div>'
            '<div style="position:absolute;left:2px;top:62px;font-size:17px;color:#8a96a0;letter-spacing:0.5px;">Batteriestatus aller batteriebetriebenen Geräte · Haus-CCU3 und CCU3 der Schwiegereltern</div>'
            '<div style="position:absolute;right:0;top:22px;font-size:14px;color:#8a96a0;">Stand %s · alle 5 Minuten</div>'
            '<a href="/vis-2/index.html?main#Raumklima" style="position:absolute;right:0;top:70px;font-size:14px;color:#4c9be8;text-decoration:none;">‹ Raumklima</a>'
            '<div style="position:absolute;left:0;top:90px;width:1540px;height:2px;background:linear-gradient(90deg,#3ddc84,#f2c14e,#ee6c4d,rgba(238,108,77,0));"></div></div>'
            % (FONT, B(P + "Allgemein.Aktualisiert")))

def tile(label, oid, caption, col):
    return ('<div style="position:relative;width:370px;height:108px;font-family:%s;color:#e9eef2;background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">'
            '<div style="position:absolute;left:20px;top:14px;%s">%s</div>'
            '<div style="position:absolute;left:20px;top:30px;font-size:46px;font-weight:700;line-height:54px;color:%s;">%s</div>'
            '<div style="position:absolute;left:20px;top:84px;font-size:13px;color:#8a96a0;">%s</div></div>' % (FONT, LABEL, label, col, B(oid), caption))

def legende():
    pt = lambda c, t: '<span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:%s;margin:0 6px 0 0;vertical-align:-1px;"></span>%s' % (c, t)
    return ('<div style="position:relative;width:1540px;height:56px;font-family:%s;color:#cfd6dc;box-sizing:border-box;background:#161b20;border:1px solid #2b333b;border-radius:14px;font-size:14px;">'
            '<div style="position:absolute;left:20px;top:8px;line-height:20px;">%s &nbsp; <span style="color:#8a96a0;">in Ordnung</span> &nbsp;&nbsp;&nbsp; %s &nbsp; <span style="color:#8a96a0;">bald wechseln: unter 1,25 V je Zelle</span> &nbsp;&nbsp;&nbsp; %s &nbsp; <span style="color:#8a96a0;">wechseln: die Zentrale meldet LOW_BAT oder unter 1,10 V je Zelle</span></div>'
            '<div style="position:absolute;left:20px;top:30px;font-size:12px;color:#6d7780;">Zellen je Typ: Fensterkontakt HmIP-SWDO 1 Zelle, Türschloss HmIP-DLD 3 Zellen, alle anderen (Thermostate, Melder, Fensterkontakt SWDM) 2 Zellen bzw. 3-V-Zelle. Netzbetriebene Geräte (Steckdosen, Access Points) haben keinen Batteriewert und fehlen hier.</div></div>'
            % (FONT, pt("limegreen", "<b style=\"color:limegreen;\">grün</b>"), pt("gold", "<b style=\"color:gold;\">gelb</b>"), pt("tomato", "<b style=\"color:tomato;\">rot</b>")))

def panel(ccu, titel, w):
    G = P + ccu + "."
    kopf = B(V("n", G + "Gesamt"), V("r", G + "Rot"), V("y", G + "Gelb"), "n+' Geräte · '+r+' rot · '+y+' gelb'")
    kc = B(V("r", G + "Rot"), V("y", G + "Gelb"), "r>0&&'tomato'||y>0&&'gold'||'limegreen'")
    return ('<div style="position:relative;width:%dpx;font-family:%s;color:#e9eef2;box-sizing:border-box;background:#161b20;border:1px solid #2b333b;border-radius:18px;overflow:hidden;">'
            '<div style="padding:16px 20px 8px 20px;"><span style="font-size:26px;font-weight:700;letter-spacing:1px;">%s</span>'
            '<span style="float:right;font-size:16px;font-weight:700;color:%s;margin-top:6px;">%s</span></div>'
            '<div style="padding:0 12px 14px 12px;">%s</div></div>' % (w, FONT, titel, kc, kopf, B(G + "Tabelle_HTML")))

def widget(html, left, top, width, height):
    return {"tpl": "tplHtml",
            "data": {"g_fixed": True, "g_visibility": False, "g_css_font_text": False, "g_css_background": False, "g_css_shadow_padding": False, "g_css_border": False,
                     "g_gestures": False, "g_signals": False, "g_last_change": False, "visibility-cond": "==", "visibility-val": 1, "visibility-groups-action": "hide",
                     "html": html, "bindings": ["html"]},
            "style": {"left": "%dpx" % left, "top": "%dpx" % top, "width": "%dpx" % width, "height": "%dpx" % height, "z-index": "1", "bindings": []},
            "widgetSet": "basic"}

if __name__ == "__main__":
    out = sys.argv[1]; n = int(sys.argv[2]); widgets = {}
    def add(html, l, t, w, h):
        global n
        widgets["w%05d" % n] = widget(html, l, t, w, h); n += 1
    add(header(), 30, 64, 1540, 92)
    G = P + "Allgemein."
    tiles = [("GERÄTE MIT BATTERIE", G + "Gesamt", "beide Zentralen zusammen", "#ffffff"), ("GRÜN", G + "Gruen", "in Ordnung", "limegreen"),
             ("GELB", G + "Gelb", "bald wechseln", "gold"), ("ROT", G + "Rot", "jetzt wechseln", "tomato")]
    for i, (l, o, c, col) in enumerate(tiles): add(tile(l, o, c, col), 30 + i * 390, 176, 370, 108)
    add(legende(), 30, 304, 1540, 56)
    add(panel("Haus", "HAUS-CCU3", 770), 30, 380, 770, 1480)
    add(panel("Schwiegereltern", "SCHWIEGERELTERN-CCU3", 770), 820, 380, 770, 520)
    json.dump({"widgets": widgets, "sizey": 380 + 1480 + 40}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("Batterie:", len(widgets), "Widgets")
