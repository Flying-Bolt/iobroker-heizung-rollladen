# Programmlogik im Detail

Diese Datei beschreibt, **was jedes Skript wann tut und warum**. Sie ist nach dem Stand der Skripte in `skripte/` geschrieben
(Zeilenangaben sind Orientierung, keine Garantie). Wer das Paket in ein eigenes Haus übertragen will, sollte sie vor dem Anpassen lesen.

Inhalt: [1 Gesamtbild](#1-gesamtbild) · [2 Heizung](#2-heizung-heizung_ccujs) · [3 Karten-Renderer](#3-karten-renderer-heizung_kartenjs) ·
[4 Rollladen](#4-rollladen-rollladen_zeitplanjs) · [5 Thermostat-Wächter](#5-thermostat-wächter-thermostat_waechterjs) ·
[6 Batterie-Ampel](#6-batterie-ampel-batterien_uebersichtjs) · [7 Zeitsteuerung (Cron)](#7-zeitsteuerung-cron-und-timer) ·
[8 Generatoren](#8-generatoren) · [9 Sicherheitsmodell](#9-sicherheitsmodell-der-bedienung) · [10 Datenpunkt-Übersicht](#10-datenpunkt-übersicht)

---

## 1 Gesamtbild

```
 HmIP-Geräte ──Funk──► CCU3 / RaspberryMatic
                          │  XML-RPC  Port 2010  (Geräte:  getParamset / setValue)
                          │  XML-RPC  Port 9292  (Heizgruppen "INT…": nur über /groups)
                          ▼
 ┌──────────────── ioBroker, Adapter "javascript" ────────────────┐
 │ heizung_ccu.js        liest Gruppen/Geräte, schreibt Befehle   │──► 0_userdata.0.<Heizung>.*
 │ rollladen_zeitplan.js Zeitplan + Fahrbefehle                    │──► 0_userdata.0.Rollladen_*.*
 │ batterien_uebersicht.js Batterieampel                           │──► 0_userdata.0.Batterien.*
 │ thermostat_waechter.js Fehlerüberwachung + Telegram             │──► 0_userdata.0.Heizung.*
 │ heizung_karten.js     rendert fertiges HTML je View-Widget      │──► 0_userdata.0.<Heizung>_Karten.kNN
 └─────────────────────────────────────────────────────────────────┘
                          │ Datenpunkte (Bindungen)
                          ▼
                     vis-2 Views  (Räume, Rollladen, Thermostate, Batterie)
```

**Warum direkt an die CCU statt über den Adapter `hm-rpc`?** Die Heizgruppen (virtuelle Geräte `INT0000001`, …) liefert `hm-rpc` nicht.
Sie sind nur über den Port 9292 (`/groups`) lesbar und schreibbar. Dort liegen der Sollwert, der Modus, das Wochenprofil und das
Fenster-Signal **für alle Thermostate eines Raums gemeinsam**. Das Skript schreibt deshalb an die Gruppe, und die CCU verteilt an die Geräte.
Geräte (Batterie, Erreichbarkeit, Fensterkontakt) liest `heizung_ccu.js` ebenfalls direkt (Port 2010), damit die Skripte auch dann funktionieren,
wenn die Zentrale nicht (oder noch nicht) als `hm-rpc`-Instanz angebunden ist. Der Thermostat-Wächter nutzt dagegen die `hm-rpc`-Datenpunkte der Haus-CCU
(siehe 5) – das ist die einzige Stelle, an der `hm-rpc` gebraucht wird.

**Grundmuster aller Skripte:**
1. Beim Start `init()`: fehlende Datenpunkte unter `0_userdata.0.…` anlegen (`createStateAsync`, nur wenn `existsState` falsch).
2. Erste Abfrage sofort, danach zyklisch (siehe Abschnitt 7).
3. Ergebnisse als **fertige, einfache Datenpunkte** ablegen (Zahlen, Texte, HTML). Die View rechnet fast nichts selbst.
4. Befehle kommen als **Schreibzugriff auf einen Datenpunkt mit `ack=false`** (`on({id, ack:false, change:'any'}, …)`), werden geprüft, ausgeführt
   und **protokolliert**. Die View schreibt nur diese „Befehls-Datenpunkte“, nie direkt an die CCU.

---

## 2 Heizung (`heizung_ccu.js`)

### 2.1 Konfiguration (Kopf des Skripts)
| Konstante | Bedeutung |
|---|---|
| `CCU_GROUPS`, `CCU_DEVICES` | URLs der CCU: Port 9292 `/groups` und Port 2010 |
| `P` | Präfix der Datenpunkte, z. B. `0_userdata.0.Schwiegereltern.` (die View-Generatoren benutzen dasselbe Präfix) |
| `ROOMS` | je Raum `id` (Datenpunktname ohne Umlaute), `name` (Anzeige), `group` (z. B. `INT0000001`) **oder** `device` (Thermostat-Adresse, wenn der Raum keine Heizgruppe hat) |
| `DEVICES` | alle Geräte mit Adresse, Typ und `fenster:true` bei Fensterkontakten |
| `SOLL_MIN/MAX/SCHRITT` | 8 / 26 / 0,5 °C |
| `SENDE_VERZOEGERUNG_MS` | 3000: Sammelzeit für mehrere Klicks |
| `ENTSPERR_MS` | 10000: so lange bleibt das Schloss offen |
| `MAX_BEFEHLE_10MIN` | 20 Schreibbefehle je Raum und 10 Minuten |

**Quelle eines Raums (`quelle(r)`):** hat der Raum eine Gruppe, wird `INT…:1` auf Port 9292 gelesen/geschrieben, sonst das Thermostat `<adr>:1` auf Port 2010.
Das ermöglicht Räume ohne Gruppe (z. B. Keller mit nur einem Thermostat).

### 2.2 XML-RPC von Hand
`rpcCall()` und `rpcSetValue()` bauen den XML-Text selbst und senden ihn mit `httpPost`. `parseStruct()` liest die Antwort mit einem regulären Ausdruck
(`<member><name>…</name><value><TYP>…</TYP></value></member>`) und wandelt `boolean` (`1/0`), `double`, `i4`, `int` in Zahlen/Wahrheitswerte.
Eine Antwort ohne `<methodResponse>` oder mit `<fault>` wird zum Fehler (Zeitüberschreitung 20 s). Es gibt **keine Abhängigkeit** von einer XML-RPC-Bibliothek.

### 2.3 Abfragen
| Funktion | Takt | Liest | Schreibt |
|---|---|---|---|
| `pollValues()` | `schedule('*/1 * * * *')` (jede Minute) und 4 s nach jedem Befehl | `VALUES` der Gruppe/des Thermostats | je Raum `Soll, Ist, Feuchte, Ventil, Ventilzustand, Fenster_Gruppe, Modus_Code, Sollmodus_Code, Betriebsart, Profil, Boost, Party, Frostschutz, Heizen_Kuehlen, Heizt`; `Allgemein.Aktualisiert/Verbindung/Fehler` |
| `pollDevices()` | `setInterval(30000)` | je Gerät Kanal `:0` (`UNREACH, LOW_BAT, OPERATING_VOLTAGE, RSSI_DEVICE`), bei Kontakten Kanal `:1` (`STATE`) | `Geraete.<adr>.*`, `Batterie_Status`, `Allgemein.Fenster_offen/Batterie_gelb/Batterie_rot` |
| `pollMaster()` | `schedule('3,13,23,33,43,53 * * * *')` (alle 10 min) | `MASTER` der Gruppe = Wochenprofile (`P1_…`–`P6_…`) | intern `master[raum]`, danach `aktualisiereProfil()` |

**Fehlerbehandlung von `pollValues()`:** Jeder Fehler (CCU nicht erreichbar, leere Antwort) erhöht `fehlerZaehler`, setzt `Allgemein.Verbindung=false` und
`Allgemein.Fehler` auf Zeit + Text. Ins Log (Warnung) kommt nur der **erste** Fehler und danach jeder 30. – so füllt ein Ausfall das Log nicht.
Beim nächsten Erfolg werden Zähler und Text zurückgesetzt. **Solange `Verbindung=false` ist, lehnt die Bedienung jeden Befehl ab** (siehe `sperrGrund`).

**Wichtig – Auto/Manuell:** `Modus_Code` wird aus `BOOST_MODE` und `SET_POINT_MODE` berechnet:
`Boost → 3`, `SET_POINT_MODE == 0 → 0 (Automatik)`, sonst `1 (Manuell)`. `CONTROL_MODE` ist ungeeignet: Heizgruppen melden ihn nicht, er bliebe 0
und der „Auto“-Knopf würde immer leuchten. `Sollmodus_Code` enthält den rohen `SET_POINT_MODE` (0 Auto, 1 Manuell, 2 Abwesend).
`betriebsart(v)` liefert den Text mit der Rangfolge **Boost > Abwesend/Party > Frostschutz > Automatik/Manuell**.

### 2.4 Das Tagesprofil (`segmenteHeute`, `aktualisiereProfil`, `zeichneTimeline`)
Das MASTER-Paket enthält je Profil `P<n>_ENDTIME_<WOCHENTAG>_<k>` (Minuten seit Mitternacht, Ende des k-ten Abschnitts) und
`P<n>_TEMPERATURE_<WOCHENTAG>_<k>` für k = 1…13. Der Algorithmus:

```
von = 0
für k = 1 … 13:
    end  = ENDTIME[k];  temp = TEMPERATURE[k]
    wenn eines fehlt: Abbruch
    wenn end > von: Abschnitt {von, bis=min(end,1440), temp} merken
    von = end
    wenn end >= 1440: Abbruch          # letzter Abschnitt reicht bis Mitternacht
```
`aktualisiereProfil` wählt das **aktive** Profil (Datenpunkt `Profil`), bestimmt den Abschnitt, der die aktuelle Minute enthält (`nowMin`),
und schreibt `Soll_laut_Profil`, `Profil_Tag` (deutscher Wochentag), `Profil_JSON` und `Timeline_SVG`. `zeichneTimeline` baut daraus ein SVG
(460 × 92): je Abschnitt ein Rechteck mit der Farbe nach `farbe(temp)` (≤ 8 blau … > 22 °C orange/rot), Beschriftung nur wenn der Abschnitt breiter als 34 px ist,
Stundenmarken alle 3 h und eine „jetzt“-Marke. Das SVG wird **jede Minute** neu erzeugt (weil `pollValues` es aufruft), damit die Marke wandert.
Die Profil-Auswahl 1–3 in der View ändert nur `ACTIVE_PROFILE`; die Profile selbst werden **nicht** vom Skript verändert (nur in der CCU/App).

### 2.5 Batterieampel je Gerät (`batterieStatus`)
`LOW_BAT` → rot (2). Sonst Spannung je Zelle = `OPERATING_VOLTAGE / zellen(typ)`; `zellen`: `SWDO` 1, `DLD` 3, alles andere 2.
< 1,10 V je Zelle → rot, < 1,25 V → gelb (1), sonst grün (0); ohne Spannungswert −1 (unbekannt).
Warum je Zelle? Ein Fensterkontakt mit einer Zelle meldet 1,3 V und ist gesund, ein Thermostat mit zwei Zellen bei 1,3 V dagegen fast leer.

### 2.6 Bedienung
Alle Befehle laufen durch dieselben Stufen:

```
Schreibzugriff (ack=false) auf  <Raum>.Stellen.Soll_Schritt | Soll_Ziel | Befehl
  → sperrGrund():  Bedienung_erlaubt == false → "Bedienung ist abgeschaltet"
                   Entsperrt == false          → "gesperrt: erst das Schloss entsperren"
                   Verbindung == false         → "CCU3 nicht erreichbar"
  → Grenzen/Rundung (nur Sollwert)
  → rateOk(raum): höchstens 20 Befehle je Raum in 600 s (gleitendes Fenster)
  → rpcSetValue() an Gruppe/Thermostat
  → status()/protokolliere()   (Stellen.Status, Protokoll_JSON/HTML, Log)
  → 4 s später pollValues()    (die View zeigt den tatsächlich gemeldeten Wert)
```

* **Soll ± 0,5 (`sollSchritt`):** Vorzeichen des Werts bestimmt die Richtung. Basis ist der **noch nicht gesendete Wunsch** (`pend[raum]`), falls vorhanden,
  sonst der gemeldete Soll. Ergebnis: auf 8…26 °C begrenzt, auf 0,5 gerundet (`Math.round(x*2)/2`). Jeder weitere Klick **ersetzt** den Timer; erst 3 s nach dem
  letzten Klick wird **einmal** gesendet (`sendeSoll`). So erzeugt „fünfmal +“ einen einzigen Funkbefehl. Wird die Grenze erreicht, steht „Grenze erreicht“ im Status.
* **Soll direkt (`sollZiel`):** für den Tacho-Regler (Ring klicken/ziehen). Gleiche Regeln, nur mit Zielwert statt Schritt; ungültige Werte (`!isFinite`) werden abgelehnt.
* **`befehl(raum, name)`:** Tabelle `BEFEHLE`: `auto`/`manuell` setzen `CONTROL_MODE` 0/1, `boost` setzt `BOOST_MODE=true` (die CCU beendet Boost nach 5 Minuten selbst),
  `profil1…3` setzen `ACTIVE_PROFILE`. Unbekannte Namen werden abgelehnt.
* **Schloss (`Allgemein.Entsperrt`):** Setzen auf `true` startet einen 10-s-Timer, danach springt es auf `false`. Nach **jedem Skriptstart** ist es `false`.
  `Bedienung_erlaubt` ist ein dauerhafter Hauptschalter (nur von Hand setzbar), Standard `true`.
* **Protokoll:** die letzten 40 Einträge in `Protokoll_JSON`, die letzten 6 als HTML. Überlebt Skript-Neustarts (beim Start wird `Protokoll_JSON` zurückgelesen).

---

## 3 Karten-Renderer (`heizung_karten.js`)

**Problem:** vis-2 wertet jede Bindung `{…}` bei jeder Datenpunktänderung neu aus. Eine Raumkarte hatte bis zu 33 Bindungen; die View brauchte 25–75 s zum Laden.

**Lösung:** Jedes HTML-Widget hat nur **eine** Bindung auf `0_userdata.0.<Projekt>_Karten.kNN`. Das Skript hält die **Vorlagen** (`TEMPLATES`, vom Generator eingesetzt,
Syntax wie bei vis-2) und schreibt das **fertige HTML** in `kNN`.

* **`parse(key, html)`** zerlegt eine Vorlage in Teile: reiner Text, einfacher Datenpunkt `{oid}` oder Formel `{a:oid1;b:oid2;ausdruck}`. Die Formel wird mit
  `new Function('a','b', 'return (ausdruck);')` einmal kompiliert. Gleichzeitig entsteht die Abhängigkeitstabelle `abh[oid] → [kNN…]`.
* **`render(key)`** setzt die Teile mit den aktuellen Werten (`getState`) zusammen. Fehlt ein Wert oder wirft die Formel, bleibt die Stelle leer (der Wert kommt kurz danach).
* **Ein einziges Abonnement** `on({id: /^0_userdata\.0\.(…)\./, change:'any'})` für alle Datenpunkte der Projekte; gefiltert wird über `abh`. Betroffene Karten kommen in die Menge `dirty`.
* **Entprellung:** 300 ms nach der ersten Änderung werden alle `dirty`-Karten gerendert und **nur geschrieben, wenn sich der Text geändert hat**.
* Beim Start werden alle Karten einmal gerendert. **Ohne laufendes Skript bleiben die Karten leer** – deshalb gehört das Skript zur Pflicht-Installation.
* **Regeln für Vorlagen** (Parser-Grenzen von vis-2): kein `:` und `#` in Formeln außer in der Variablendefinition, keine freien geschweiften Klammern, Farben in Formeln als **Namen**
  (`limegreen`, `tomato` …), keine Entities.

---

## 4 Rollladen (`rollladen_zeitplan.js`)

### 4.1 Modell
Je Rollladen (`ROOMS`) gibt es Datenpunkte unter `0_userdata.0.Rollladen_<Projekt>.<id>.*`:
`Position` (0 = zu … 100 = ganz offen, wie `LEVEL` der Aktoren), `Ziel`, `Fahrt` (−1 zu, 0 steht, +1 auf), `Status`, `Simuliert`, `Auto`, `Hoch_Min`/`Runter_Min`
(Minuten seit Mitternacht, Standard 450 = 07:30 und 1200 = 20:00), `Hoch_Text`/`Runter_Text`, `Letzte_Hoch`/`Letzte_Runter`, `Naechste`, `Heute`, `Meldung`, dazu die Befehlspunkte
`Befehl`, `Hoch_Schritt`, `Runter_Schritt`.

**Simulation oder echter Aktor:** `simuliert(r) = !AKTOR[r.id]`. Räume ohne Eintrag in `AKTOR` fahren als **Dummy** (30 s von 0 auf 100 %, 1-s-Takt).
Mit Eintrag `{adr:'<Gerät>:<Kanal>', max:75}` gehen die Befehle per `setValue(adr,'LEVEL', Ziel/100)` an die CCU; `max` ist eine Obergrenze je Rollladen
(z. B. Schlafzimmer 75 %). Den Kanal mit `LEVEL` bei einem HmIP-BROLL liefert der `SHUTTER_VIRTUAL_RECEIVER` (Kanal 4); der Kanal muss je Gerät geprüft werden.

### 4.2 Fahren (`fahre`, `setzeZiel`)
`auf → Ziel 100`, `zu → 0`, `z0/z25/z50/z75/z100 → Ziel n`, `stopp → Ziel = aktuelle Position` und beim echten Aktor `STOP`. Das Ziel wird auf `0…max` begrenzt und gerundet.
HmIP-BROLL kennt keinen `STOP`-Parameter: `aktorStop` versucht zuerst `STOP`; schlägt das fehl, liest es die Position und setzt `LEVEL` auf genau diesen Wert (hält den Antrieb dort an).

### 4.3 Positions-Takt (`takt`, jede Sekunde)
* **Simuliert:** pro Sekunde `SCHRITT = 100/30` % in Richtung Ziel; `Fahrt` und `Status` ("fährt auf/zu", "steht") werden nachgeführt.
* **Echter Aktor:** die Position wird per `getParamset(…,'VALUES')` gelesen – **alle 3 s**, solange in den letzten 120 s ein Befehl gesendet wurde, sonst alle 30 s.
  `Fahrt` ergibt sich aus der Positionsänderung (steigt → +1, fällt → −1, gleich → 0). Bleibt die Position gleich, endet der „unterwegs“-Zustand.

### 4.4 Zeitplan (`pruefeZeitplan`, alle 20 s)
Pro Rollladen mit `Auto = true` und für `Hoch` (Befehl `auf`, Marker `Letzte_Hoch`) und `Runter` (`zu`, `Letzte_Runter`):

```
t = <Art>_Min
wenn  Marker beginnt NICHT mit heutigem Datum
und   jetzt >= t  und  jetzt <= t + NACHHOL_MIN (60)
dann: Marker = heutiges Datum            # ZUERST markieren: höchstens einmal je Tag
      fahre(raum, befehl, 'Zeitplan')
      protokollieren ("nachgeholt, geplant HH:MM" wenn mehr als 2 min zu spät)
```
* **Nachholen:** War ioBroker zur Schaltzeit aus (Neustart, Ausfall), wird innerhalb von 60 Minuten nachgeholt, danach nicht mehr.
* **Beim Einschalten (`autoUmschalten(an)`)** werden heute schon vergangene Zeiten **nicht** nachgeholt: der Marker wird `<Datum>*` ("übersprungen") gesetzt.
* **Zeit ändern (`zeitSchritt`):** `±n` Minuten, Ergebnis modulo 1440 (`((x % 1440) + 1440) % 1440`), also mit Überlauf über Mitternacht. Nur im entsperrten Zustand.
* **Anzeigetexte (`aktualisiereText`):** `Heute` zeigt je Art `✓ HH:MM` (erledigt), `übersprungen (… schon vorbei)`, `ausstehend HH:MM` oder `nicht ausgeführt`.
  `Naechste` berechnet für Hoch und Runter die Minuten bis zum nächsten Auftreten (heute, wenn noch offen und nicht vorbei, sonst morgen = +1440) und nimmt das Kleinere.
* Es gibt **bewusst nur eine Hoch- und eine Runterzeit je Tag** (kein Wochenprogramm, keine Astro-Zeiten).

### 4.5 Bedienung
Befehle sind nur im **entsperrten** Zustand erlaubt (Schloss **60 s**, Konstante `ENTSPERR_MS`).
`Allgemein.Alle_Befehl` (`auf`/`zu`/`stopp`) fährt alle Rollläden. Jeder Befehl wird in `Protokoll_JSON/HTML` festgehalten. `Befehl` wird nach der Auswertung sofort wieder geleert.
`zaehle()` füllt die Kennzahlen (`Offen` ≥ 95 %, `Zu` ≤ 5 %, `Fahrend`, `Auto_Anzahl`, `Dummy`).

---

## 5 Thermostat-Wächter (`thermostat_waechter.js`)

**Aufgabe:** Fehler an den Heizkörper-Thermostaten **melden**, bevor man sie friert: Ventil nicht angepasst, schwergängig, Batterie schwach, Funk weg.
Das Skript ist **nur lesend** an den Geräten.

**Eingänge je Thermostat (`THERMOSTATE[i].oid`):**
* Haus-CCU (Adapter `hm-rpc.0`): `1.VALVE_STATE`, `1.LEVEL`, `1.ACTUAL_TEMPERATURE`, `1.SET_POINT_TEMPERATURE`, `0.LOW_BAT`, `0.UNREACH`, `0.CONFIG_PENDING`.
* Zweite CCU (nur über die Datenpunkte von `heizung_ccu.js`, weil dort `hm-rpc` `VALVE_STATE` nicht liefert).
  Wer nur **eine** CCU hat, trägt nur Einträge mit `ort:'Haus'` ein.

**`VALVE_STATE`** (Gerätestatus des Ventilantriebs) wird so eingestuft (`VS`):
| Code | Name | Text | Farbe | sofort Fehler? |
|---|---|---|---|---|
| 0 | STATE_NOT_AVAILABLE | Status nicht verfügbar | orange | nein |
| 1 | RUN_TO_START | Adapterlauf steht an | orange | nein |
| 2 | WAIT_FOR_ADAPTION | Adapterlauf fehlt | orange | **ja** |
| 3 | ADAPTION_IN_PROGRESS | Adapterlauf läuft | orange | nein |
| 4 | ADAPTION_DONE | OK | grün | – |
| 5 | TOO_TIGHT | Ventil schwergängig | rot | **ja** |
| 6 | ADJUSTMENT_TOO_BIG | Ventilhub zu groß | rot | **ja** |
| 7 | ADJUSTMENT_TOO_SMALL | Ventilhub zu klein | rot | **ja** |
| 8 | ERROR_POSITION | Ventilposition fehlerhaft | rot | **ja** |

**Entscheidungslogik `pruefen()` je Thermostat:**
```
seit[key].vs   = Zeitpunkt, seit dem der aktuelle Nicht-OK-Code besteht (Reset bei Codewechsel oder OK)
seit[key].un   = Zeitpunkt, seit dem UNREACH besteht
Fehler, wenn  (vs != 4) UND (sofort-Code ODER seit >= GRACE_MIN=30 min)
              ODER UNREACH seit >= 30 min          → "nicht erreichbar", rot
              ODER LOW_BAT                          → "Batterie schwach"
Hinweis (kein Fehler): CONFIG_PENDING                → "Konfiguration ausstehend"
OK = (vs == 4) && !UNREACH && !LOW_BAT
```
Die **Karenzzeit** (30 min) verhindert Fehlalarme: Adapterlauf-Zwischenzustände (1, 3) und kurze Funkausfälle sind nach Änderungen normal.

**Benachrichtigung:** Für jeden Thermostat wird der Meldetext (Probleme, durch Komma getrennt) mit dem **zuletzt gemeldeten** verglichen (`letzteMeldung[key]`).
Nur bei **Änderung** wird gesendet: neuer Fehler → `⚠️ Heizung – <Name>: <Problem>`, Entwarnung → `✅ … wieder in Ordnung`. Dazu täglich um **09:00** eine Erinnerung,
solange `ThermostatFehler` wahr ist. Versand: `sendTo('telegram.0','send',{text, chatId})` an alle `TELEGRAM_CHATS`; ein Fehler bei einem Empfänger blockiert die anderen nicht.
Test: Datenpunkt `0_userdata.0.Heizung.TelegramTest` auf `true` setzen.

**Ausgaben:** je Thermostat `Status, Statuscode, Farbe, OK, Ventil, Ist, Soll, Batterie, Erreichbar, Standort, Name` (nur bei Änderung geschrieben), gesamt `ThermostatFehler,
ThermostatFehlerText, AnzahlFehler, AnzahlThermostate, Stand`, außerdem **`Seite`** (die komplette View als HTML, `renderSeite`) und **`Banner`**
(`renderBanner`, leer wenn alles in Ordnung – kann in jede beliebige View eingebaut werden).

**Auslöser:** Änderung eines der überwachten Datenpunkte (`on({id, change:'any'}, planen)`; `planen` fasst mit 1,5 s Verzögerung zusammen) **und** alle 5 Minuten
(`schedule('*/5 * * * *')`, nötig, damit die Karenzzeiten ablaufen, auch wenn sich nichts ändert).

---

## 6 Batterie-Ampel (`batterien_uebersicht.js`)

Erzeugt aus `generatoren/batterie/batterien_vorlage.js` mit der Geräteliste `CCUS` (Zentralen mit `host`, darunter Geräte `{adr, typ, ort, bez}`).
Alle **5 Minuten** (`2,7,12,…,57`) wird je Gerät Kanal `:0` per XML-RPC gelesen (`rpcGet`) und mit `batterieStatus` bewertet (gleiche Regel wie 2.5).
Ein nicht lesbares Gerät wird als „unbekannt“ (−1) und „nicht erreichbar“ eingetragen, der Fehlertext landet in `Allgemein.Fehler` und gekürzt im Log.
Die Tabellenzeilen werden **absteigend nach Dringlichkeit** sortiert: erst Status (rot vor gelb vor grün), dann niedrigste Spannung je Zelle, dann Ort.
Je Zentrale entstehen `Tabelle_HTML` (fertige HTML-Tabelle), `Gesamt/Gruen/Gelb/Rot/Unbekannt/Unerreichbar`, dazu die Summen unter `Allgemein.*`.
Bei roter Ampel wird eine Warnung ins Log geschrieben.
**Die Geräteliste ist fest**: ein neues Batteriegerät muss in `geraete.json` ergänzt und das Skript neu erzeugt werden (`bauen.py`).

---

## 7 Zeitsteuerung (Cron und Timer)

**Es ist kein Cron-Eintrag auf dem Betriebssystem nötig.** Alle zeitgesteuerten Abläufe laufen **im ioBroker-Javascript-Adapter**:
`schedule('<Cron-Ausdruck>', fn)` (Cron-Syntax des Adapters, 5 Felder) und `setInterval`/`setTimeout`.

| Skript | Auslöser | Zweck |
|---|---|---|
| `heizung_ccu.js` | `schedule('*/1 * * * *')` | Gruppenwerte, Profilgrafik |
| | `setInterval(30 s)` | Geräte (Batterie, Funk, Fensterkontakte) |
| | `schedule('3,13,23,33,43,53 * * * *')` | Wochenprofile (MASTER) |
| | `setTimeout(3 s)` | Sollwert nach der Sammelzeit senden |
| | `setTimeout(10 s)` | Schloss wieder schließen |
| | `setTimeout(4 s)` | nach einem Befehl neu lesen |
| `rollladen_zeitplan.js` | `setInterval(1 s)` | Position (Simulation oder Aktor lesen) |
| | `setInterval(20 s)` | Zeitplan prüfen |
| | `setTimeout(60 s)` | Schloss wieder schließen |
| `thermostat_waechter.js` | `schedule('*/5 * * * *')` | Karenzzeiten auswerten |
| | `schedule('0 9 * * *')` | tägliche Erinnerung per Telegram |
| | Datenpunkt-Änderung + 1,5 s | sofortige Auswertung |
| `batterien_uebersicht.js` | `schedule('2,7,…,57 * * * *')` | Batterien lesen |
| `heizung_karten.js` | Datenpunkt-Änderung + 300 ms | Karten neu rendern |

**Zeitzone:** Die Skripte benutzen die lokale Uhrzeit des ioBroker-Rechners (`new Date()`). Stellen Sie die Zeitzone des Betriebssystems richtig ein (`timedatectl`),
sonst laufen Zeitplan und 09:00-Erinnerung falsch.
**Neustarts:** Die Skripte halten den Zustand in Datenpunkten (`Letzte_Hoch`, `Protokoll_JSON`, …), nicht im Speicher – ein Neustart verliert nichts außer ausstehenden Sendetimern (Sollwunsch, Schloss).
Nach jedem Start ist die Bedienung **gesperrt**.

---

## 8 Generatoren

Ein Aufruf erzeugt alles: `python3 generatoren/bauen.py` → `generatoren/ausgabe/`.

| Schritt | Programm | Eingabe | Ausgabe |
|---|---|---|---|
| 1 | `heizung/build_schwiegereltern.py` | Liste `ROOMS`, `FLOORS` im Programm | View „Räume“ als Projekt-JSON (Karten mit Bindungen) |
| 2 | `rollladen/build_view.py` | `rollladen/raeume.json` | View „Rollladen“ |
| 3 | `rollladen/build_script.py` | `raeume.json`, `vorlage.js` | `rollladen_zeitplan.js` (Raumliste in `/*ROOMS*/` eingesetzt) |
| 4 | `bauen.py` (Zusammenführung) | beide Views | ein Projekt mit den Views `Raeume` und `Rollladen` |
| 5 | `heizung/build_karten.py` | Projekt | **Ladezeit-Umbau:** jedes Widget mit Bindungen erhält die eine Bindung `…_Karten.kNN`, die Vorlagen kommen in `heizung_karten.js` (`/*TEMPLATES*/`), Navigationsleiste (`sw_nav.py`) wird ergänzt |
| 6 | `batterie/build_batterien_script.py` | `geraete.json` | `batterien_uebersicht.js` |
| 7 | `batterie/build_batterie_view.py` | – | View „Batterie“ (Widget-Nummern ab 1; `view_einfuegen.py` nummeriert um) |

`view_einfuegen.py` fügt eine View in ein vorhandenes Projekt ein (Kollisionen von Widget-IDs werden behoben).
`heizung/deploy_raeume.py` und `heizung/cdp_steps.py` sind **Werkzeuge der ursprünglichen Installation** (Einspielen über SSH auf einen bestimmten Rechner bzw. Screenshots per Chrome);
sie enthalten Platzhalter und müssen angepasst werden – in der Regel genügen die Befehle aus `docs/CLAUDE-CODE-ANLEITUNG.md`.

**Erzeugte Raumkarte (Orientierung, Höhen in px):** Kopfzeile mit Name und Betriebsart, Tacho (Kreisbogen `pathLength=100`, `stroke-dasharray`, Marker für den Sollwert),
Sollwert/Profil/Feuchte/Ventil rechts, Fenster-/Türzeile ab 356, Bedienblock, Profil-Grafik, Geräteliste. Der Kreisbogen ist für 10–30 °C ausgelegt
(Bogenlänge `(Ist−10)/20·75`). Die Farbskala: unter 18° blau, 18–20° hellblau, 20–22° grün, 22–24° gelb, 24–26° orange, darüber rot.

**View „Thermostate“ hat keinen Generator:** Sie ist **ein einziges HTML-Widget**, das an `0_userdata.0.Heizung.Seite` hängt (das Skript baut die Seite). Die View-Datei `views/thermostate.json` kann unverändert importiert werden.

---

## 9 Sicherheitsmodell der Bedienung

Die vis-2-Views haben **keine Anmeldung**. Wer die Adresse erreicht, kann bedienen. Schutz in drei Schichten, alle **im Skript**, nicht in der View:
1. **Schloss:** Befehle nur nach „Entsperren“ (Heizung 10 s, Rollladen 60 s); nach jedem Start gesperrt.
2. **Grenzen:** Soll 8–26 °C, Rollladen `0…max`; Schrittweite 0,5 °C.
3. **Ratenbegrenzung:** höchstens 20 Heiz-Befehle je Raum in 10 Minuten (schützt Funkbudget/Duty Cycle und Batterien).
Dazu der **Hauptschalter** `Allgemein.Bedienung_erlaubt`. Wer die Views im Internet erreichbar macht, muss zusätzlich vorschalten (Reverse-Proxy mit Anmeldung, VPN).
Die CCU selbst wird nur an den dokumentierten Stellen geschrieben: `SET_POINT_TEMPERATURE`, `CONTROL_MODE`, `BOOST_MODE`, `ACTIVE_PROFILE` (Gruppe), `LEVEL`/`STOP` (Rollladen).

---

## 10 Datenpunkt-Übersicht

| Bereich | Präfix | Wichtigste Punkte |
|---|---|---|
| Heizung | `0_userdata.0.<Heizung>.<Raum>.*` | `Soll, Ist, Ventil, Betriebsart, Modus_Code, Sollmodus_Code, Fenster_Gruppe, Profil, Soll_laut_Profil, Timeline_SVG, Stellen.Soll_Schritt/Soll_Ziel/Befehl/Status` |
| | `…Geraete.<adr>.*` | `UNREACH, LOW_BAT, OPERATING_VOLTAGE, RSSI_DEVICE, Batterie_Status, STATE` |
| | `…Allgemein.*` | `Entsperrt, Bedienung_erlaubt, Verbindung, Fehler, Aktualisiert, Fenster_offen, Batterie_gelb/rot, Protokoll_*` |
| Karten | `0_userdata.0.<Heizung>_Karten.kNN` | fertiges HTML je Widget |
| Rollladen | `0_userdata.0.Rollladen_<Projekt>.<Raum>.*` | `Position, Ziel, Fahrt, Auto, Hoch_Min, Runter_Min, Befehl, Naechste, Heute` |
| Batterie | `0_userdata.0.Batterien.<Zentrale>.*` | `Tabelle_HTML, Gesamt, Gruen, Gelb, Rot` |
| Wächter | `0_userdata.0.Heizung.*` | `ThermostatFehler(Text), AnzahlFehler, Seite, Banner, TelegramTest, <key>.*` |

Die Präfixe stehen **als Konstante `P` oben im jeweiligen Skript** und **als Text in den Generatoren** (`P = "0_userdata.0.Schwiegereltern."` usw.). Wer sie ändert,
muss Skript **und** Generator anpassen und die Views neu bauen.
