# Hinweise für Claude Code

Dieses Repository enthält ioBroker-Skripte (Javascript-Adapter), vis-2-Views und Python-Generatoren für Heizung, Rollläden, Thermostat-Wächter und Batterie-Ampel (HomeMatic IP / CCU3).

**Wenn du gebeten wirst, es in ioBroker einzubauen:** lies zuerst `docs/CLAUDE-CODE-ANLEITUNG.md` (Regeln, Reihenfolge, Befehle, Rücknahme) und `docs/PROGRAMMLOGIK.md` (wie alles funktioniert).

Kurzregeln:
- Produktivsystem: nichts neu starten, vor jeder Änderung sichern, Schritt für Schritt und mit Ergebnis melden.
- Alle Gerätenummern, IP-Adressen und Chat-IDs im Repository sind **Platzhalter**; arbeite in einer Kopie und trage die echten Werte nur dort ein. Nie echte Werte in ein öffentliches Repository übernehmen.
- Bedienung ist standardmäßig gesperrt, Rollläden laufen ohne `AKTOR`-Eintrag nur als Simulation. Echte Schaltbefehle nur mit ausdrücklicher Freigabe des Menschen.
- Skripte nicht ändern, ohne `node --check` auf dem ioBroker-Rechner; View-Projektdateien nur über `iobroker file write` schreiben.
- Dokumentation und Kommentare sind deutsch; antworte dem Menschen auf Deutsch, wenn er Deutsch schreibt.
