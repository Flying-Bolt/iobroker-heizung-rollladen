# Rollladen-Notlauf: das Programm in der CCU anlegen

Alles andere ist fertig und erprobt. Es fehlt nur noch der **Taktgeber** in der CCU — ein
Programm, das `notlauf.rega` regelmäßig aufruft. Programme lassen sich auf der CCU3 mit
Original-Firmware **nicht per Skript erzeugen** (`dom.CreateObject(OT_PROGRAM)` bricht stumm
ab), deshalb diese vier Handgriffe in der Oberfläche:

1. **CCU-Oberfläche öffnen**: http://192.168.1.99 → *Programme und Verknüpfungen* →
   *Programme & Zentralenverknüpfung* → **Neu**
2. **Name**: `Rollladen Notlauf`
3. **Bedingung: Wenn...** → *Zeitsteuerung* → **alle 15 Minuten**
   (genauer: Zeitmodul, Intervall 15 Minuten, ganztägig)

   > **Achtung, hier ging es am 24.10.2026 schief:** Das Intervall allein genügt nicht — die
   > Zeitsteuerung hat zusätzlich eine **Zeitspanne**, und die stand auf 30 Minuten ab 14:56 Uhr.
   > Das Programm lief dadurch nur zwei- bis dreimal am Tag statt alle 15 Minuten, ohne dass man
   > es der Programmliste ansah. In der Objektdatenbank sind das die Felder `period` (900 s) und
   > **`calduration`** (muss **86400** sein) sowie `time` (muss **00:00** sein).
   > Nachgezogen am 31.10.2026, Handbuch Kap. 12.7.
4. **Aktivität: Dann...** → *Skript* → den Inhalt von `notlauf.rega` einfügen → **OK** →
   **Speichern**

## Prüfen, ob es läuft

In der Programmliste steht hinter dem Programm die letzte Ausführung. Außerdem:

```bash
# Lebenszeichen künstlich altern lassen (zwei Stunden)
curl -s --data-binary 'object o = dom.GetObject(ID_SYSTEM_VARIABLES).Get("Rollladen_Lebenszeichen"); o.State(o.Value() - 120);' \
     http://192.168.1.99:8181/tclrega.exe
# ... höchstens 15 Minuten warten, dann:
curl -s --data-binary 'WriteLine(dom.GetObject(ID_SYSTEM_VARIABLES).Get("Rollladen_Notlauf").Value());' \
     http://192.168.1.99:8181/tclrega.exe | sed 's/<xml>.*//'
```

**Einfacher und ohne jede Fahrt:** Die Variable `Rollladen_Notlauf` wird bei **jedem** Lauf
beschrieben. Steht dort ein Zeitstempel, der höchstens 15 Minuten alt ist, arbeitet der Notlauf.
Bleibt er stehen, läuft das Programm nicht — **oder in der CCU steckt eine alte Skriptfassung
ohne diese Statuszeile** (genau das war von 24.10. bis 31.10.2026 der Fall). Deshalb: nach jeder
Änderung an `notlauf.rega` prüfen, was wirklich in der CCU steht, nicht nur was in der Datei steht.

Der ioBroker schreibt das echte Lebenszeichen ohnehin alle fünf Minuten wieder — der Test
korrigiert sich also von selbst. **Fährt der Rollladen dabei?** Nur, wenn gerade ein Fahrfenster
offen ist (bis 90 Minuten nach 07:30 bzw. 20:00). Außerhalb passiert nichts.

## Wie das Ganze zusammenspielt

| Teil | wo | Aufgabe |
|---|---|---|
| `Schwiegereltern_Rollladen` | ioBroker auf ioBroker-Rechner | fährt wie bisher, schreibt alle 5 min `Rollladen_Lebenszeichen` und bei Änderung `Rollladen_Plan` |
| `Rollladen_Plan` | CCU-Variable | `<adresse:kanal>\|<hoch_min>\|<runter_min>;…` je Raum mit Automatik |
| `notlauf.rega` | CCU-Programm | springt ein, wenn das Lebenszeichen älter als 30 min ist |
| `Rollladen_Notlauf` | CCU-Variable | Protokoll der letzten Ersatzfahrt |

Der Notlauf ist **zustandslos**: Er merkt sich nicht, ob heute schon gefahren wurde, sondern
sieht die Position des Aktors an. Steht der Rollladen schon richtig, passiert nichts.
