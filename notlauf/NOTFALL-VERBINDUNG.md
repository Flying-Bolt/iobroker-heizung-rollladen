# Wenn die Verbindung abreißt

**Notfallblatt für den Ausfall des VPN-Tunnels zwischen den beiden Häusern.**
Geschrieben für Menschen ohne Technikkenntnisse. Stand: 9. November 2026.

> **Kurz gesagt: Sie müssen nichts tun.**
> Die Heizung läuft weiter, weil jedes Thermostat sein Wochenprogramm selbst gespeichert hat.
> Die Rollläden fahren weiter, weil die Steuerzentrale vor Ort nach einer halben Stunde selbst
> übernimmt. Was ausfällt, ist die Anzeige und die Fernbedienung.

---

## Was ist dieser Tunnel überhaupt?

Die Technik steht in zwei Häusern. Im entfernten Haus hängen Thermostate und Rollladenmotoren
an einer kleinen Steuerzentrale, der **CCU3**. Im eigenen Haus steht der Rechner mit **ioBroker**,
auf dem die Bedienoberfläche läuft.

Damit beide miteinander reden können, bauen die zwei Internet-Router eine feste, verschlüsselte
Leitung zwischen den Häusern auf. Das ist der **Tunnel** (Fachwort: VPN). Er läuft über das normale
Internet, aber alles darin ist abgeschirmt, als wären beide Häuser ein einziges Netzwerk.

Fällt bei einem der beiden das Internet aus, zieht jemand einen Router vom Strom oder gibt es eine
Störung beim Anbieter — dann ist der Tunnel weg. Die Geräte in beiden Häusern laufen weiter, sie
wissen nur nichts mehr voneinander.

## Woran merke ich, dass der Tunnel weg ist?

* Die Raumkarten zeigen **alte Werte** — die Temperatur ändert sich über Stunden nicht mehr.
* Auf der Übersichtsseite steht bei der Kachel der entfernten CCU3 **nicht erreichbar**.
* Knöpfe in der Rollladen-Ansicht bewirken nichts mehr.

Ein einzelner alter Wert heißt noch nichts — Batteriegeräte melden sich nur alle paar Minuten.
Stimmt aber *keine* Angabe mehr, und das seit über einer halben Stunde, ist der Tunnel weg.

## Was läuft weiter, was nicht

| | Was | Warum |
|---|---|---|
| **läuft weiter** | Heizung | Jedes Thermostat hat sein Wochenprogramm im eigenen Speicher: 19 °C bis 7 Uhr, 21,5 °C von 7 bis 22 Uhr, danach wieder 19 °C. Das läuft im Gerät ab. |
| **läuft weiter** | Rollläden | Bleiben die Anweisungen länger als **30 Minuten** aus, übernimmt die Steuerzentrale vor Ort. Sie prüft **alle 15 Minuten** und holt fällige Fahrten bis **90 Minuten** nach der Sollzeit nach. |
| **läuft weiter** | Fenster und Licht | Fensterkontakte schalten das Thermostat weiterhin herunter, das Treppenlicht läuft über ein Programm in der Zentrale. |
| **fällt aus** | Ansicht aus der Ferne | Die Raumkarten frieren auf dem letzten Wert ein. |
| **fällt aus** | Fernbedienung | Temperatur ändern, Rollladen fahren, Zeiten verstellen: aus der Ferne nicht mehr möglich. |
| **eingeschränkt** | Sonnenzeiten | Die Rollladenzeiten folgen Sonnenauf- und ‑untergang. Die Zentrale rechnet das nicht selbst — sie benutzt weiter die zuletzt übermittelten Zeiten. Pro Woche verschieben die sich um 10 bis 20 Minuten. |

## Muss ich sofort etwas tun?

**Nein.** Die Anlage ist für diesen Fall gebaut. Sie können abwarten, bis die Verbindung von allein
zurückkommt — bei einer Internetstörung ist das meist nach Minuten bis wenigen Stunden der Fall.

Handeln müssen Sie nur, wenn der Ausfall **länger als etwa eine Woche** dauert. Dann laufen die
Rollladenzeiten merklich aus dem Takt, weil die Sonnenzeiten nicht mehr nachgeführt werden.

> ### ⚠ Thermostate auf Handbetrieb folgen dem Wochenprogramm nicht
>
> Dreht jemand am Rädchen, wechselt das Thermostat auf „Manuell“ und hält seinen Wert dauerhaft —
> auch die Nachtabsenkung entfällt dann. Bei einem Tunnelausfall bleibt das so. Das ist kein Fehler,
> nur gut zu wissen: diese Räume heizen rund um die Uhr auf den eingestellten Wert.
>
> *Stand 9.11.2026: drei der sechs Räume standen auf Handbetrieb.*

## Ich möchte etwas ändern — wie geht das ohne Tunnel?

Ohne Tunnel kommen Sie nur **vor Ort** an die Technik. Es gibt keinen Weg von außen; das ist Absicht,
sonst käme auch jemand anderes hinein.

### Heizung

1. **Am einfachsten: direkt am Thermostat.** Am Heizkörper am Rädchen drehen. Der neue Wert gilt
   sofort. Das Gerät wechselt damit auf Handbetrieb.
2. **Zurück auf das Wochenprogramm** mit der `Auto`-Taste am Thermostat.
3. **Wochenzeiten ändern** geht nur über die Steuerzentrale: vor Ort ins dortige WLAN, im Browser
   die Adresse der CCU3 aufrufen, dann *Einstellungen → Systemsteuerung → Heizungsprofile*.

### Rollläden

1. **Fahren:** Der Schalter an der Wand geht immer. Er ist direkt mit dem Motor verdrahtet.
2. **Schaltzeiten ändern:** ohne Tunnel *nicht sinnvoll*. Die Zeiten liegen in der Zentrale als eine
   einzige lange Zeichenkette aus Gerätenummern und Minutenwerten — nichts zum Bearbeiten von Hand.
   Sobald der Tunnel zurück ist, überschreibt ioBroker sie ohnehin wieder. **Also warten.**
3. **Wenn es dringend ist** und ein Rollladen über Tage falsch fahren würde: in der Zentrale das
   Programm `Rollladen Notlauf` abschalten (*Programme und Verknüpfungen* → Haken bei „Aktiv“ weg).
   Dann fährt nichts mehr automatisch. **Diesen Haken unbedingt wieder setzen**, sobald der Tunnel
   zurück ist — sonst fehlt beim nächsten Ausfall die Absicherung, ohne dass es jemand merkt.

## Der Tunnel ist wieder da — was jetzt?

Das meiste erledigt sich von selbst. Nichts anstoßen, nichts neu starten.

| Was | Passiert von allein | Wann |
|---|---|---|
| Raumwerte in der Ansicht | Temperaturen und Fensterzustände kommen zurück | 1–5 Min. |
| Lebenszeichen an die Zentrale | ioBroker meldet sich; die Zentrale hört auf, ersatzweise zu fahren | alle 5 Min. |
| Sonnenzeiten | werden neu berechnet und übergeben | alle 5 Min. |
| Versäumte Rollladenfahrt | wird nachgeholt, wenn die Sollzeit < 60 Minuten zurückliegt | sofort |
| Heizung | nichts zu tun — sie lief ja durch | — |

### Diese fünf Punkte danach einmal durchgehen

- [ ] Raumkarten zeigen wieder **frische** Temperaturen (Uhrzeit auf der Karte prüfen)
- [ ] Alle Rollläden stehen so, wie sie zur Tageszeit stehen sollen — sonst von Hand richten
- [ ] Falls jemand den Notlauf abgeschaltet hat: Haken bei „Aktiv“ **wieder gesetzt**
- [ ] Falls jemand ein Thermostat verstellt hat: wieder auf „Auto“, wenn es dem Plan folgen soll
- [ ] Auf der Übersichtsseite ist die Kachel der entfernten CCU3 wieder grün

## Woran man erkennt, dass die Absicherung wirklich arbeitet

Die Zentrale schreibt bei **jedem** Durchlauf einen Satz mit Datum und Uhrzeit mit — auch dann,
wenn sie nichts zu tun hatte. Steht dort ein Zeitstempel, der höchstens 15 Minuten alt ist,
arbeitet die Absicherung:

```
09.11.2026 12:00 | ioBroker lebt (1 min), nichts zu tun
```

Bei einem Ausfall stünde dort statt dessen, wie lange ioBroker schon stumm ist und welche Rollläden
die Zentrale ersatzweise gefahren hat. Nachsehen: in der Zentrale unter *Einstellungen →
Systemvariablen* beim Eintrag `Rollladen_Notlauf`.

**Bleibt der Zeitstempel stehen**, läuft das Programm nicht — *oder* in der Zentrale steckt eine
alte Skriptfassung ohne diese Statuszeile. Genau das war vom 24. bis 31. Oktober 2026 der Fall und
blieb eine Woche unbemerkt. Siehe [`ANLEITUNG.md`](ANLEITUNG.md).

## Zahlen auf einen Blick

| Was | Wert |
|---|---|
| Wartezeit, bis die Zentrale übernimmt | 30 Minuten |
| Prüftakt der Zentrale | alle 15 Minuten |
| Fahrten werden nachgeholt bis | 90 Minuten nach Sollzeit |
| Lebenszeichen von ioBroker | alle 5 Minuten |
| Heizprofil (Mo–So) | 19 °C · 7–22 Uhr 21,5 °C · 19 °C |

---

**Nicht abgedeckt:** Fällt der *Strom* im entfernten Haus aus, gilt dieses Blatt nicht — dann steht
auch die Steuerzentrale, und Rollläden wie Heizungsregelung ruhen, bis der Strom zurück ist. Die
Thermostate halten dabei ihre Ventilstellung und nehmen das Wochenprogramm danach selbst wieder auf.
