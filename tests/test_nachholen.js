// Prüfstand für den Rollladen-Zeitplan (16.11.2026).
//
// Aufruf:  node tests/test_nachholen.js skripte/rollladen_zeitplan.js
//
// Schneidet die Funktion pruefeZeitplan aus dem Quelltext heraus und lässt sie mit Attrappen
// laufen -- ohne ioBroker, ohne CCU und ohne einen Rollladen zu bewegen. Geprüft wird das
// Verhalten, das sich nicht auf Zuruf erzeugen lässt: ein Fahrbefehl, den die Zentrale wegen
// schwachem Funk ablehnt (UNREACH). Erwartet wird, dass die Fahrt NICHT als erledigt gilt,
// sondern im Nachholfenster wiederholt wird -- gedrosselt, und ab dem zweiten Versuch still.
//
// Die Attrappen ersetzen get/setStateAsync (eine Map), fahre (gibt fahrErfolg zurück und
// merkt sich das still-Flag), meldung/logge (sammeln Text) sowie heuteStr/nowMin (feste Zeit).
// Dadurch läuft ein ganzer Tag in Millisekunden ab.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const anfang = src.indexOf('async function pruefeZeitplan() {');
const ende = src.indexOf('\n}', anfang) + 2;
const koerper = src.slice(anfang, ende);
if (anfang < 0) { console.error('Funktion nicht gefunden'); process.exit(1); }

const P = '0_userdata.0.Rollladen_Schwiegereltern.';
const ROOMS = [{ id: 'Buegelzimmer', name: 'Bügelzimmer Balkontür' }];
const NACHHOL_MIN = 60, WIEDERHOL_MIN = 5;
const BEFEHLTEXT = { auf: 'hochgefahren', zu: 'runtergefahren' };
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const HEUTE = '2026-11-16';

let states, jetzt, fahrErfolg, protokoll, meldungen, stillFlags;
const heuteStr = () => HEUTE;
const nowMin = () => jetzt;
const get = async id => states[id];
const setStateAsync = async (id, v) => { states[id] = v; };
const fahre = async (r, b, quelle, still) => { stillFlags.push(!!still); return fahrErfolg; };
const meldung = async (r, t) => meldungen.push(t);
const logge = async (raum, t, ok) => protokoll.push(t);
const aktualisiereText = async () => {};

const pruefeZeitplan = new Function('P','ROOMS','NACHHOL_MIN','WIEDERHOL_MIN','BEFEHLTEXT','hhmm',
  'heuteStr','nowMin','get','setStateAsync','fahre','meldung','logge','aktualisiereText',
  koerper + '; return pruefeZeitplan;')(P,ROOMS,NACHHOL_MIN,WIEDERHOL_MIN,BEFEHLTEXT,hhmm,
  heuteStr,nowMin,get,setStateAsync,fahre,meldung,logge,aktualisiereText);

function neu(marke) {
  states = { [P+'Buegelzimmer.Auto']: true, [P+'Buegelzimmer.Hoch_Min']: 450,
             [P+'Buegelzimmer.Runter_Min']: 994, [P+'Buegelzimmer.Letzte_Hoch']: marke,
             [P+'Buegelzimmer.Letzte_Runter']: '2026-11-15' };
  protokoll = []; meldungen = []; stillFlags = [];
}
const marke = () => states[P+'Buegelzimmer.Letzte_Hoch'];
let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log((ok ? '  OK  ' : ' FEHL ') + name + '  ist=' + JSON.stringify(ist) + (ok ? '' : '  soll=' + JSON.stringify(soll)));
}

(async () => {
  console.log('A) 07:30, Fahrt gelingt');
  neu(''); jetzt = 450; fahrErfolg = true; await pruefeZeitplan();
  pruefe('Marke = heute', marke(), HEUTE);
  pruefe('ein Protokolleintrag', protokoll, ['Zeitplan: hochgefahren']);
  pruefe('nicht still', stillFlags, [false]);

  console.log('B) 07:30, CCU lehnt ab');
  neu(''); jetzt = 450; fahrErfolg = false; await pruefeZeitplan();
  pruefe('Marke = Fehlstempel', marke(), HEUTE + '!450/1');
  pruefe('kein Erfolgseintrag', protokoll, []);
  pruefe('Meldung an den Raum', meldungen.length, 1);

  console.log('C) 07:31, Drosselung greift');
  jetzt = 451; await pruefeZeitplan();
  pruefe('kein zweiter Versuch', stillFlags.length, 1);
  pruefe('Marke unverändert', marke(), HEUTE + '!450/1');

  console.log('D) 07:35, zweiter Versuch, scheitert wieder');
  jetzt = 455; await pruefeZeitplan();
  pruefe('zweiter Versuch gefahren', stillFlags.length, 2);
  pruefe('zweiter Versuch still', stillFlags[1], true);
  pruefe('Marke zählt weiter', marke(), HEUTE + '!455/2');

  console.log('E) 07:42, dritter Versuch gelingt (wie am 16.11. von Hand)');
  jetzt = 462; fahrErfolg = true; await pruefeZeitplan();
  pruefe('Marke = erledigt', marke(), HEUTE);
  pruefe('Protokoll nennt Versuch + Nachholen', protokoll, ['Zeitplan: hochgefahren (nachgeholt, geplant 07:30) (3. Versuch)']);

  console.log('F) 08:31, Nachholfenster zu');
  neu(HEUTE + '!450/5'); jetzt = 511; fahrErfolg = true; await pruefeZeitplan();
  pruefe('kein Versuch mehr', stillFlags, []);
  pruefe('Marke bleibt Fehlstempel', marke(), HEUTE + '!450/5');

  console.log('G) schon erledigt');
  neu(HEUTE); jetzt = 460; await pruefeZeitplan();
  pruefe('keine zweite Fahrt', stillFlags, []);

  console.log('H) übersprungen-Marke (Auto nachträglich eingeschaltet)');
  neu(HEUTE + '*'); jetzt = 460; await pruefeZeitplan();
  pruefe('keine Fahrt', stillFlags, []);

  console.log(fehler === 0 ? '\nAlle Prüfungen bestanden.' : '\n' + fehler + ' Prüfung(en) fehlgeschlagen.');
  process.exit(fehler === 0 ? 0 : 1);
})();
