# Anleitung für Claude Code: dieses Repository in ioBroker einbauen

Diese Datei richtet sich an **Claude Code** (oder einen anderen Agenten mit Shell-Zugriff), den ein Mensch bittet:
„Baue dieses Repository in mein ioBroker ein.“ Lies zuerst `README.md` und `docs/PROGRAMMLOGIK.md`. Arbeite **in kleinen, einzeln geprüften Schritten**,
frage vor jedem Schritt, der etwas Laufendes verändert, und halte dich an die Regeln in Abschnitt 1.

## 1 Regeln (vor allem anderen)

1. **Produktivsystem.** Das ioBroker-System steuert eine Heizung und Rollläden. Starte ioBroker, den Javascript-Adapter, die CCU oder den Rechner **nie** ohne ausdrückliche Zustimmung neu.
2. **Erst sichern, dann ändern.** Vor jedem Schreiben in ein vorhandenes Objekt oder Projekt eine Sicherung ziehen (Befehle unten) und deren Pfad nennen.
3. **Erst lesen, dann schreiben.** Alle Skripte schreiben anfangs **nichts** an die CCU: Heizung bleibt gesperrt (Schloss), Rollläden laufen als Simulation, solange `AKTOR` leer ist.
   Echte Schaltbefehle erst nach einem Test mit dem Menschen und seiner ausdrücklichen Freigabe.
4. **Keine Geheimnisse in Dateien oder im Chat.** Passwörter, Telegram-Chat-IDs und Zugangsdaten nicht in das Repository, nicht in Commit-Texte, nicht in Protokolle schreiben.
   Zugang zum ioBroker-Rechner nur über das, was der Mensch bereitstellt (eigene SSH-Schlüssel oder eine Passwortdatei mit Rechten `600`, die er nennt).
5. **Veröffentlichen nur auf Anweisung.** Dieses Repository enthält Platzhalter (siehe Abschnitt 3). Echte Gerätenummern/IPs niemals in ein öffentliches Repository übernehmen.
6. **Belegen statt behaupten.** Melde jeden Schritt mit dem tatsächlichen Ergebnis (Befehlsausgabe, Datenpunktwert). Was nicht getestet wurde, als „nicht getestet“ kennzeichnen.

## 2 Voraussetzungen prüfen

Frage den Menschen nach den Eckdaten und prüfe sie selbst, bevor du etwas installierst:

| Frage / Prüfung | Befehl / Hinweis |
|---|---|
| Zugang zum ioBroker-Rechner? | `ssh <benutzer>@<rechner> 'iobroker status'` (oder lokal) – ioBroker läuft |
| Javascript-Adapter installiert und aktiv? | `iobroker list instances \| grep javascript` – Instanz `javascript.0` mit `enabled` |
| vis-2 installiert? | `iobroker list instances \| grep vis-2` |
| CCU3 / RaspberryMatic erreichbar? | siehe unten (Python-Test) |
| Telegram-Adapter (nur für den Thermostat-Wächter)? | `iobroker list instances \| grep telegram` |
| Node.js zum Syntaxprüfen der Skripte? | `node --version` (auf dem ioBroker-Rechner vorhanden) |
| Python 3 auf dem Arbeitsrechner (für die Generatoren)? | `python3 --version` |
| Zeitzone des ioBroker-Rechners richtig? | `timedatectl` – sonst laufen Zeitplan und 09:00-Erinnerung falsch |

**CCU-Test (nur lesend):**
```bash
python3 - <<'EOF'
import xmlrpc.client as x
ccu = "192.168.1.20"      # <- Adresse der CCU eintragen
geraete = x.ServerProxy(f"http://{ccu}:2010/").listDevices()
print(len(geraete), "Geräte/Kanäle (Port 2010)")
print([d["ADDRESS"] for d in geraete if ":" not in d["ADDRESS"]][:10])
g = x.ServerProxy(f"http://{ccu}:9292/groups")
print(sorted(g.system.listMethods())[:5])          # antwortet Port 9292 /groups?
EOF
```
Antwortet Port 2010 oder 9292 nicht: In der CCU unter *Einstellungen → Systemsteuerung → Firewall* XML-RPC (und ggf. Remote-ReGa) für die Adresse des ioBroker-Rechners freigeben („eingeschränkt“, nicht „offen“) – **das darf nur der Mensch bestätigen**.

**Heizgruppen und ihre Mitglieder** ermitteln (Haus mit mehreren Räumen):
* Die Gruppen heißen `INT0000001`, `INT0000002`, … Prüfen: `g.getParamset("INT0000001:1","VALUES")` (Port 9292) liefert `ACTUAL_TEMPERATURE`, `SET_POINT_TEMPERATURE`, `WINDOW_STATE` …
* Namen und Mitglieder: auf der CCU in `/usr/local/etc/config/groups.gson` oder in der WebUI (*Einstellungen → Geräte → Heizungsgruppen*). Die Zuordnung Gruppe ↔ Raumname **mit dem Menschen bestätigen**.
* Geräteadressen (14 Zeichen, z. B. `00AB0000000001`) und Typen aus `listDevices()` (`ADDRESS`, `TYPE`); Fensterkontakte `HmIP-SWDO*`/`HmIP-SWDM*`, Thermostate `HmIP-eTRV*`, Wandthermostat `HmIP-WTH*`, Rollladenaktoren `HmIP-BROLL*`.

## 3 Platzhalter im Repository – das musst du ersetzen

| Platzhalter | Bedeutung | Ersetzen durch |
|---|---|---|
| `192.168.1.10`, `192.168.1.20`, `192.168.1.99` | CCU-/Rechneradressen | Adresse der eigenen CCU(s) (in `skripte/*.js` und in `generatoren/**`) |
| `00AB0000000001` … `00AB0000000040` | Geräteadressen | echte Adressen (14 Zeichen, **in allen Dateien einheitlich**) |
| `INT0000001` … | Heizgruppen | die eigenen Gruppen |
| `CHAT_ID_1`, `CHAT_ID_2`, `CHAT_ID_3` | Telegram-Chat-IDs | echte IDs des Menschen (aus dem `telegram.0`-Nutzerverzeichnis) |
| Raumnamen (Wohnzimmer, Küche, Keller …), `Schwiegereltern` | Beispiel | eigene Räume; der Name `Schwiegereltern` steckt im Datenpunkt-Präfix und im vis-2-Projektnamen |

**Suche nach Resten** nach dem Ersetzen: `grep -rn "00AB0000\|192\.168\.1\.\(10\|20\|99\)\|CHAT_ID" skripte generatoren views` → muss leer sein (in der **Arbeitskopie**, nicht im Repository!).
Arbeite in einer **Kopie** des Repositories (`cp -r`), damit das Original sauber bleibt.

**Präfix wählen:** Die Skripte und Generatoren benutzen `0_userdata.0.Schwiegereltern.` (Heizung), `0_userdata.0.Schwiegereltern_Karten.`, `0_userdata.0.Rollladen_Schwiegereltern.`,
`0_userdata.0.Batterien.`, `0_userdata.0.Heizung.`. Du kannst sie behalten (einfach) oder **überall** gleich umbenennen (Skript `P`, Generatoren, `heizung_karten.js`: Regex im `on({id: /^0_userdata…/})`
und `KP`). Teil-Umbenennungen führen zu leeren Views.

## 4 Installationsreihenfolge

### Schritt 1: Heizung lesend (`skripte/heizung_ccu.js`)
1. Kopfkonfiguration anpassen: `CCU_GROUPS`, `CCU_DEVICES`, `ROOMS`, `DEVICES` (siehe `PROGRAMMLOGIK.md` 2.1). Räume ohne Gruppe: `device:` statt `group:`.
2. Syntax prüfen: Datei auf den ioBroker-Rechner kopieren, dort `node --check <datei>`.
3. Skript **anlegen** (Objekt existiert noch nicht) – zuerst Hülle, dann Quelltext (das Objekt-JSON darf **kein** `=` im Quelltext enthalten, daher der zweite Befehl):
   ```bash
   iobroker object set script.js.Heizung_CCU '{"type":"script","common":{"name":"Heizung_CCU","engineType":"Javascript/js","engine":"system.adapter.javascript.0","enabled":false,"source":"//"},"native":{}}'
   iobroker object set script.js.Heizung_CCU "common.source=$(cat /pfad/heizung_ccu.js)"
   ```
   (Beides ist am Livesystem erprobt.) Bei **bestehenden** Skripten vorher sichern: `iobroker object get script.js.<Name> > <Name>-vor-<Datum>.json`.
4. Erst jetzt aktivieren: `iobroker object set script.js.Heizung_CCU common.enabled=true` (das startet das Skript, nur dieses; **kein** Neustart des Adapters).
5. Prüfen (nach ~1 Minute): `iobroker state getValue 0_userdata.0.Schwiegereltern.Allgemein.Verbindung` → `true`; je Raum `…<Raum>.Ist`, `.Soll`, `.Betriebsart` plausibel gegen die CCU-WebUI vergleichen; `…Allgemein.Fehler` leer; Log: `tail -n 100 /opt/iobroker/log/iobroker.current.log | grep Heizung_CCU`.
6. **Berichte dem Menschen**, welche Werte gelesen wurden. Schreiben ist noch gesperrt (`Allgemein.Entsperrt=false`).

### Schritt 2: Views erzeugen und einspielen
1. In vis-2 ein **Projekt** anlegen (der Mensch macht das im Editor: *Projekt* → *Neues Projekt*, z. B. `Schwiegereltern`) – eine leere `vis-views.json` genügt.
   Hat der Mensch schon ein Projekt (z. B. `main`), kannst du die Views dort einfügen (`view_einfuegen.py`).
2. `generatoren/heizung/build_schwiegereltern.py`: Liste `ROOMS` (Räume, Geräte, Fensterkontakt `window=`, `wlabel`, `wkind='door'|'window'`) und `FLOORS` (Geschosse) anpassen.
   Raumnamen sollten **bis etwa 24 Zeichen** haben (sonst bricht die Fensterzeile).
3. `generatoren/rollladen/raeume.json` anpassen (`id`, `name`, `accent`); `generatoren/batterie/geraete.beispiel.json` kopieren und anpassen (nur **batteriebetriebene** Geräte).
4. Bauen: `cd generatoren && python3 bauen.py` → `generatoren/ausgabe/` mit `vis-views.json`, `heizung_karten.js`, `rollladen_zeitplan.js`, `batterien_uebersicht.js`, `batterie_view.json`.
   Hinweis: `bauen.py` nimmt `batterie/geraete.beispiel.json`; trage dort die eigene Datei ein oder benenne sie um.
5. **Bestehende View sichern**, dann einspielen:
   ```bash
   iobroker file read vis-2.0/<Projekt>/vis-views.json /tmp/<Projekt>-views-vorher.json     # Sicherung (Pfad merken)
   # nur wenn die Projektdatei neu/leer ist ODER die Views ersetzt werden sollen:
   iobroker file write generatoren/ausgabe/vis-views.json vis-2.0/<Projekt>/vis-views.json
   # in ein bestehendes Projekt einfügen (Views Räume/Rollladen/Batterie/Thermostate), ohne Vorhandenes anzutasten:
   python3 generatoren/view_einfuegen.py /tmp/<Projekt>-views-vorher.json generatoren/ausgabe/batterie_view.json Batterie /tmp/neu.json
   iobroker file write /tmp/neu.json vis-2.0/<Projekt>/vis-views.json
   ```
   **Projektdateien niemals mit `cp` in den Dateiordner von ioBroker kopieren, immer `iobroker file write`.** Danach den vis-2-Editor im Browser neu laden (offene Editoren überschreiben sonst die Datei).
   Kontrolle: Anzahl Widgets/Views der Datei gegen die Erwartung vergleichen (`python3 -c "import json;d=json.load(open('/tmp/neu.json'));print([k for k in d if k!='___settings'])"`).
6. **Kartenskript** (`heizung_karten.js`) wie in Schritt 1 anlegen und aktivieren. Prüfen: `iobroker state getValue 0_userdata.0.Schwiegereltern_Karten.k01` liefert HTML. **Ohne dieses Skript bleiben die Karten leer.**
7. View im Browser öffnen: `http://<ioBroker>:8082/vis-2/index.html?<Projekt>#Raeume`. Sichtprüfung mit dem Menschen (oder per Headless-Chrome mit `generatoren/heizung/cdp_steps.py`: nach `Page.navigate` ~14–30 s warten, sonst nur Ladekreis).

### Schritt 3: Bedienung testen (nur mit Freigabe)
Mit dem Menschen vereinbaren, an welchem **unkritischen** Raum getestet wird. Reihenfolge: (1) Schloss geschlossen: ein Klick auf „+“ muss mit „Nicht ausgeführt: gesperrt“ abgelehnt werden (Protokoll prüfen, Sollwert unverändert);
(2) entsperren, **einmal** „+“ → nach ~3 s wird gesendet, `Stellen.Status` zeigt „Gesendet …“, nach ~4 s zeigt `Soll` den neuen Wert; (3) Soll zurückstellen, Auto/Manuell, Boost jeweils einzeln.
Nach dem Test den ursprünglichen Zustand herstellen und melden.

### Schritt 4: Rollladen (zuerst Simulation!)
1. `skripte/rollladen_zeitplan.js` (oder `ausgabe/rollladen_zeitplan.js`): `ROOMS` setzen, `AKTOR` **leer lassen** → alle Räume simulieren. Anlegen/aktivieren wie Schritt 1; View `Rollladen` einspielen (Schritt 2).
2. Zeitplan in der Simulation testen: Auto an, Zeit auf „jetzt + 2 min“, beobachten (`Naechste`, `Heute`, Protokoll).
3. **Echter Aktor – nur mit Freigabe und ein Raum nach dem anderen:** Kanal mit `LEVEL` ermitteln (`getParamsetDescription("<adr>:<k>","VALUES")` enthält `LEVEL`; bei HmIP-BROLL Kanal 4), `AKTOR` eintragen (`{ adr:'<adr>:4' }`, optional `max:75`), Skript speichern (startet automatisch neu).
   Der Mensch muss **vor Ort** sein oder die Fahrt sicher beobachten. Erst „stopp“-Weg testen, dann kleine Fahrt (z. B. `z75`), dann ganz auf/zu. Eingemessene Endlagen und Fahrzeit nicht annehmen – prüfen.

### Schritt 5: Batterie-Ampel
`ausgabe/batterien_uebersicht.js` anlegen/aktivieren, View `batterie_view.json` einfügen (`view_einfuegen.py`). Prüfen: `iobroker state getValue 0_userdata.0.Batterien.Allgemein.Gesamt` entspricht der Zahl der Geräte.
Die Panels der View heißen im Generator fest `Haus` und `Schwiegereltern` (`build_batterie_view.py`, Funktion `panel(...)`): bei anderen Zentralennamen dort anpassen.

### Schritt 6: Thermostat-Wächter
1. `skripte/thermostat_waechter.js`: `THERMOSTATE` auf die eigenen Thermostate (`ort:'Haus'` = Adapter `hm-rpc.<n>`; die Instanznummer in `'hm-rpc.0.'` prüfen!). Nur eine CCU: Einträge mit `ort:'Schwiegereltern'` löschen und die Gruppierung in `renderSeite` (`gruppen`) anpassen.
2. `TELEGRAM_CHATS` mit echten IDs füllen (oder `NOTIFY` leeren, um ohne Telegram zu arbeiten). Anlegen, aktivieren, dann Datenpunkt `0_userdata.0.Heizung.TelegramTest` auf `true` setzen und den Menschen bitten, den Eingang zu bestätigen.
3. View `views/thermostate.json` per `view_einfuegen.py` in ein Projekt einfügen; optional das Banner (`0_userdata.0.Heizung.Banner`, HTML-Widget mit `{0_userdata.0.Heizung.Banner}`) in eine Hauptansicht setzen.

## 5 Rücknahme
* Skript abschalten: `iobroker object set script.js.<Name> common.enabled=false`. Wiederherstellen: gesicherte Objekt-JSON mit `iobroker object set script.js.<Name> "$(cat sicherung.json)"` (ersetzt das ganze Objekt) – oder `common.source` aus der Sicherung neu setzen.
* View: gesicherte `vis-views.json` mit `iobroker file write <sicherung> vis-2.0/<Projekt>/vis-views.json` zurückspielen, vis-2-Editor neu laden.
* Die Datenpunkte unter `0_userdata.0.…` können stehen bleiben (löschen nur auf Wunsch: `iobroker object del '0_userdata.0.Schwiegereltern.*'` – vorher prüfen, was darunter liegt).
* Die CCU wird vom Paket nur an den in `PROGRAMMLOGIK.md` Abschnitt 9 genannten Stellen geschrieben; Sollwerte/Modi können über die CCU-WebUI oder App zurückgestellt werden.

## 6 Bekannte Fallen
* **`iobroker object set` mit JSON ersetzt das ganze Objekt;** Quelltext mit `=` gehört nicht in dieses JSON → `common.source=$(cat datei)` benutzen.
* **vis-2-Bindungen:** höchstens etwa 15 je Widget, sonst Ladezeiten im Minutenbereich; die Karten-Technik löst das. Keine `:`/`#` in Formeln, Farben als Namen.
* **Aktualisierung der View:** vis-2-Editor schließen/neu laden nach dem Schreiben, sonst überschreibt er.
* **Auto/Manuell:** `CONTROL_MODE` der Gruppe ist unbrauchbar; `SET_POINT_MODE` und `BOOST_MODE` verwenden (bereits so im Skript).
* **Fenster-offen-Verhalten:** Das Thermostat stellt nach dem Schließen den **vorigen** Wert wieder her – stand es vorher auf Manuell, bleibt es auf Manuell.
* **Funkschwache Fensterkontakte/Wandthermostate** (UNREACH) können „Fenster offen“ in der Gruppe festhalten.
* **ReGa-Skripte (CCU)**: verkettete Methodenaufrufe in einer Zeile lassen das ganze Skript kommentarlos scheitern.
* **Zeitzone/NTP** des ioBroker-Rechners prüfen.

## 7 Abnahme-Checkliste (dem Menschen melden)
- [ ] `Heizung_CCU` läuft, `Verbindung=true`, Werte stimmen mit der CCU überein
- [ ] Karten-Skript läuft, View `Raeume` zeigt Werte (Sichtprüfung)
- [ ] Schloss lehnt im gesperrten Zustand ab; ein getesteter Soll-Befehl kam an
- [ ] Rollladen: Simulation getestet; echte Aktoren nur mit Freigabe getestet (welche?)
- [ ] Batterie-Ampel: Anzahl Geräte stimmt
- [ ] Wächter: Telegram-Test bestätigt (oder bewusst abgeschaltet)
- [ ] Sicherungen vor jeder Änderung angelegt, Pfade genannt
- [ ] Keine Geheimnisse in Dateien/Protokollen
