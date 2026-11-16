'use strict';
// ============================================================================
// Schwiegereltern_Rollladen  (02.10.2026, Claude) -- elf Aktoren im Betrieb (Stand 01.11.2026: + Dachfenster rechts/links 2. OG), ohne AKTOR-Eintrag laeuft ein Raum als Dummy
// Rollladensteuerung fuer das Haus der Schwiegereltern (CCU3 192.168.1.99) mit ZEITPLAN: je Rollladen EINMAL pro Tag hoch
// und EINMAL runter, Uhrzeiten in der View einstellbar. Datenpunkte: 0_userdata.0.Rollladen_Schwiegereltern.<Raum>.*
//   Position 0..100 % (0 = zu, 100 = ganz offen, wie LEVEL der HmIP-Rollladenaktoren), Ziel, Fahrt (-1 zu, 0 steht, 1 auf), Status
//   Auto (Zeitplan an/aus), Hoch_Min / Runter_Min (Minuten seit Mitternacht), Hoch_Text / Runter_Text (HH:MM), Naechste, Heute
// Befehle (nur nach Entsperren, 60 s): Befehl = auf | zu | stopp | z0 z25 z50 z75 z100 | auto_an | auto_aus | sonne_an | sonne_aus | sonne_hoch_an | sonne_hoch_aus;
//   Hoch_Schritt / Runter_Schritt = Minuten-Aenderung (+5, -30 ...); Allgemein.Alle_Befehl = auf | zu | stopp
// OHNE Eintrag in AKTOR wird die Fahrt SIMULIERT (30 s). Mit Eintrag werden Befehle ueber XML-RPC an den echten Aktor gesendet
// (Port 2010 der CCU3, nicht ueber ioBroker-Objekte) und dessen Position gelesen. Der Weg "echter Aktor" ist im Betrieb erprobt (HmIP-BROLL/-BROLL-2, Kanal 4 = SHUTTER_VIRTUAL_RECEIVER).
//   AKTOR = { 'Wohnzimmer': { adr: '<Geraeteadresse>:<Kanal mit LEVEL>' } }   (Kanal mit finde_level.py ermitteln)
// RUNTER BEI SONNENUNTERGANG (08.11.2026): Runter_Sonne = true koppelt die Runter-Zeit an den Sonnenuntergang
//   (Runter_Min wird dann taeglich aus SUNSET_DP + Runter_Versatz berechnet). Zeitplan, Anzeige und der
//   Notlauf-Plan der CCU lesen weiterhin nur Runter_Min und bleiben darum unveraendert.
// HOCH BEI SONNENAUFGANG (09.11.2026): Hoch_Sonne = true koppelt die Hoch-Zeit an den Sonnenaufgang
//   (Hoch_Min aus SUNRISE_DP + Hoch_Versatz). GRENZEN Hoch_Frueh / Hoch_Spaet begrenzen das Ergebnis,
//   weil der Sonnenaufgang im Juni um 05:15 und Ende Dezember erst um 08:15 liegt; voreingestellt
//   06:30 bis 08:00, je Raum ueber Hoch_Frueh_Schritt / Hoch_Spaet_Schritt verstellbar.
// Der Zeitplan laeuft HIER (ioBroker-Rechner), nicht in der CCU: faellt der Tunnel oder ioBroker-Rechner zur Zeit aus, wird innerhalb von 60 Minuten nachgeholt.
// ============================================================================
const P = '0_userdata.0.Rollladen_Schwiegereltern.';
const CCU = 'http://192.168.1.99:2010/';
const SUNSET_DP = 'followthesun.0.short term.today.sunset_time';      // Sonnenuntergang heute als Zeitstempel; der Adapter followthesun setzt ihn taeglich um 00:00:31
const SUNRISE_DP = 'followthesun.0.short term.today.sunrise_time';    // Sonnenaufgang heute, gleiche Quelle und gleicher Takt
const ROOMS = [
    { id: 'Wohnzimmer', name: 'Wohnzimmer' },
    { id: 'Terrasse', name: 'Terrassentür' },
    { id: 'Kueche', name: 'Küche' },
    { id: 'Schlafzimmer', name: 'Schlafzimmerfenster' },
    { id: 'Balkontuer', name: 'Schlafzimmer Balkontür' },
    { id: 'Bad', name: 'Bad 1. OG' },
    { id: 'Kinderzimmer', name: 'Kinderzimmer 1. OG' },
    { id: 'Buegelzimmer', name: 'Bügelzimmer Balkontür' },
    { id: 'Buegelzimmerfenster', name: 'Bügelzimmerfenster' },
    { id: 'Dachfenster_rechts', name: 'Dachfenster rechts 2. OG' },
    { id: 'Dachfenster_links', name: 'Dachfenster links 2. OG' }
];
const AKTOR = {
    // 'Wohnzimmer': { adr: '00AB0000000001:4' },
    'Wohnzimmer': { adr: '00AB0000000002:4' },      // HmIP-BROLL-2, Wohnzimmerfenster (angelernt 03.10.2026; Funk schwach, -94 dBm)
    'Terrasse': { adr: '00AB0000000003:4' },      // HmIP-BROLL-2, Terrassentuer Wohnzimmer (angelernt 03.10.2026; Funk schwach, -95 dBm)
    'Kueche': { adr: '00AB0000000004:4' },      // HmIP-BROLL-2, Kuechenfenster (angelernt 03.10.2026; Funk gut, -74 dBm)
    'Bad': { adr: '00AB0000000005:4' },      // HmIP-BROLL, Badezimmer 1. OG (angelernt 03.10.2026; Kanal 4 = SHUTTER_VIRTUAL_RECEIVER)
    'Schlafzimmer': { adr: '00AB0000000006:4' },      // HmIP-BROLL-2, Schlafzimmer 1. OG (angelernt 09.10.2026; Funk schwach, -94 dBm; ersetzt den Dummy-Raum Keller)
    'Balkontuer': { adr: '00AB0000000041:4' },      // HmIP-BROLL-2, Schlafzimmer Balkontuer 1. OG (angelernt 17.10.2026; Funk schwach, -89 dBm; Laufzeit 90/90 noch nicht eingemessen)
    'Kinderzimmer': { adr: '00AB0000000042:4' },      // HmIP-BROLL-2, Kinderzimmer 1. OG (angelernt 17.10.2026; Funk -84 dBm)
    'Buegelzimmer': { adr: '00AB0000000043:4' },      // HmIP-BROLL-2, Buegelzimmer Balkontuer 1. OG (angelernt 24.10.2026; Funk SEHR schwach -95 dBm; Laufzeit 90/90 noch nicht eingemessen)
    'Buegelzimmerfenster': { adr: '00AB0000000052:4' },      // HmIP-BROLL-2, Buegelzimmer Fenster 1. OG (angelernt 31.10.2026; Funk -83 dBm; Laufzeit 90/90 Werk, bewusst nicht eingemessen)
    'Dachfenster_rechts': { adr: '00AB0000000053:4' },      // HmIP-BROLL-2, Dachfenster rechts 2. OG (angelernt 01.11.2026; Funk SEHR schwach -97 dBm; Laufzeit 90/90 Werk, nicht eingemessen)
    'Dachfenster_links': { adr: '00AB0000000054:4' },      // HmIP-BROLL-2, Dachfenster links 2. OG (angelernt 01.11.2026; Funk schwach -90 dBm; Laufzeit 90/90 Werk, nicht eingemessen)
};
const FAHRZEIT_S = 30, SCHRITT = 100 / FAHRZEIT_S, NACHHOL_MIN = 60, ENTSPERR_MS = 60000, MAXPROT = 40;
const WIEDERHOL_MIN = 5;     // 16.11.2026: Minuten zwischen zwei Versuchen, wenn die CCU den Befehl ablehnt (UNREACH)
// 16.11.2026: Funkguete je Aktor. RSSI steht im WARTUNGSkanal (:0), nicht im Fahrkanal (:4), darum eine eigene
// Abfrage. Zwei Richtungen: RSSI_DEVICE = wie gut das Geraet die Zentrale hoert, RSSI_PEER = umgekehrt.
// Angezeigt wird der SCHLECHTERE der beiden -- eine Funkstrecke ist nur so gut wie ihre schwaechere Richtung.
const FUNK_TAKT_MS = 900000, FUNK_START_MS = 30000;     // alle 15 Minuten, erstmals 30 s nach dem Start
const FUNK_GUT = -80, FUNK_MITTEL = -90;                // >= -80 gruen, -80 bis -90 gelb, darunter rot
const FUNK_MIN = -120, FUNK_MAX = -20;                  // alles ausserhalb ist keine Messung (HmIP liefert dann 0)
const letzteAenderung = {}, letzteAbfrage = {};
let entsperrTimer = null, protokoll = [];
const simuliert = r => !AKTOR[r.id];
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const heuteStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const get = async id => (await getStateAsync(id)).val;

async function init() {
    for (const r of ROOMS) {
        for (const [id, type, role, name, def, wr] of [
            ['Position', 'number', 'level.blind', 'Position in % (0 zu, 100 offen)', 100, false],
            ['Ziel', 'number', 'level.blind', 'Zielposition in %', 100, false],
            ['Befehl', 'string', 'text', 'Befehl: auf, zu, stopp, z0..z100, auto_an, auto_aus', '', true],
            ['Fahrt', 'number', 'value', 'Fahrt: -1 zu, 0 steht, 1 auf', 0, false],
            ['Status', 'string', 'text', 'Status als Text', 'steht', false],
            ['Simuliert', 'boolean', 'indicator', 'true = Dummy (kein Aktor angeschlossen)', true, false],
            ['Auto', 'boolean', 'indicator', 'Zeitplan aktiv', false, false],
            ['Hoch_Min', 'number', 'value', 'Hochfahren um (Minuten seit Mitternacht)', 450, false],
            ['Runter_Min', 'number', 'value', 'Runterfahren um (Minuten seit Mitternacht)', 1200, false],
            ['Hoch_Text', 'string', 'text', 'Hochfahren um (HH:MM)', '07:30', false],
            ['Runter_Text', 'string', 'text', 'Runterfahren um (HH:MM)', '20:00', false],
            ['Hoch_Sonne', 'boolean', 'indicator', 'Hochfahren bei Sonnenaufgang statt zur festen Uhrzeit', false, false],
            ['Hoch_Versatz', 'number', 'value', 'Versatz zum Sonnenaufgang in Minuten (negativ = vorher)', 0, false],
            ['Hoch_Quelle', 'string', 'text', 'Woher die Hoch-Zeit kommt', 'feste Uhrzeit', false],
            ['Hoch_Frueh', 'number', 'value', 'Grenze: nicht vor dieser Uhrzeit hochfahren (Minuten seit Mitternacht)', 390, false],
            ['Hoch_Spaet', 'number', 'value', 'Grenze: nicht nach dieser Uhrzeit hochfahren (Minuten seit Mitternacht)', 480, false],
            ['Hoch_Frueh_Text', 'string', 'text', 'Grenze nicht vor (HH:MM)', '06:30', false],
            ['Hoch_Spaet_Text', 'string', 'text', 'Grenze nicht nach (HH:MM)', '08:00', false],
            ['Hoch_Frueh_Schritt', 'number', 'value', 'Befehl: Grenze "nicht vor" um n Minuten aendern', 0, true],
            ['Hoch_Spaet_Schritt', 'number', 'value', 'Befehl: Grenze "nicht nach" um n Minuten aendern', 0, true],
            ['Runter_Sonne', 'boolean', 'indicator', 'Runterfahren bei Sonnenuntergang statt zur festen Uhrzeit', false, false],
            ['Runter_Versatz', 'number', 'value', 'Versatz zum Sonnenuntergang in Minuten (negativ = vorher)', 0, false],
            ['Runter_Quelle', 'string', 'text', 'Woher die Runter-Zeit kommt', 'feste Uhrzeit', false],
            ['Hoch_Schritt', 'number', 'value', 'Befehl: Hochfahrzeit um n Minuten aendern', 0, true],
            ['Runter_Schritt', 'number', 'value', 'Befehl: Runterfahrzeit um n Minuten aendern', 0, true],
            ['Letzte_Hoch', 'string', 'text', 'Datum des letzten Hochfahrens (Zeitplan)', '', false],
            ['Letzte_Runter', 'string', 'text', 'Datum des letzten Runterfahrens (Zeitplan)', '', false],
            ['Naechste', 'string', 'text', 'Naechste geplante Aktion', 'Automatik aus', false],
            ['Heute', 'string', 'text', 'Was heute vom Zeitplan erledigt ist', '', false],
            ['Meldung', 'string', 'text', 'Ergebnis des letzten Befehls', 'Bereit', false],
            ['Funk_dBm', 'number', 'value', 'Funkguete: der schlechtere der beiden Werte in dBm (0 = keine Messung)', 0, false],
            ['Funk_Geraet', 'number', 'value', 'Funk: wie gut das Geraet die Zentrale hoert (RSSI_DEVICE, dBm)', 0, false],
            ['Funk_Zentrale', 'number', 'value', 'Funk: wie gut die Zentrale das Geraet hoert (RSSI_PEER, dBm)', 0, false],
            ['Funk_Stand', 'string', 'text', 'Funk: Uhrzeit der letzten gelungenen Messung', '', false]
        ]) {
            const full = P + r.id + '.' + id;
            if (!existsState(full)) await createStateAsync(full, def, { name: r.name + ': ' + name, type, role, read: true, write: wr });
        }
        await setStateAsync(P + r.id + '.Simuliert', simuliert(r), true);
        await setStateAsync(P + r.id + '.Hoch_Text', hhmm(Number(await get(P + r.id + '.Hoch_Min'))), true);
        await setStateAsync(P + r.id + '.Runter_Text', hhmm(Number(await get(P + r.id + '.Runter_Min'))), true);
        await setStateAsync(P + r.id + '.Hoch_Frueh_Text', hhmm(Number(await get(P + r.id + '.Hoch_Frueh'))), true);
        await setStateAsync(P + r.id + '.Hoch_Spaet_Text', hhmm(Number(await get(P + r.id + '.Hoch_Spaet'))), true);
    }
    for (const [id, type, def, name, wr] of [
        ['Allgemein.Alle_Befehl', 'string', '', 'Befehl an alle Rollladen: auf, zu, stopp', true],
        ['Allgemein.Entsperrt', 'boolean', false, 'Bedienung entsperrt (faellt nach 60 s zurueck)', true],
        ['Allgemein.Dummy', 'boolean', true, 'true = mindestens ein Rollladen wird nur simuliert', false],
        ['Allgemein.Offen', 'number', 0, 'Rollladen mit Position >= 95 %', false], ['Allgemein.Zu', 'number', 0, 'Rollladen mit Position <= 5 %', false],
        ['Allgemein.Fahrend', 'number', 0, 'Rollladen in Fahrt', false], ['Allgemein.Anzahl', 'number', 0, 'Anzahl Rollladen', false],
        ['Allgemein.Auto_Anzahl', 'number', 0, 'Rollladen mit aktivem Zeitplan', false],
        ['Allgemein.Protokoll_JSON', 'string', '[]', 'Protokoll', false], ['Allgemein.Protokoll_HTML', 'string', '', 'Protokoll fuer die View', false]
    ]) {
        if (!existsState(P + id)) await createStateAsync(P + id, def, { name, type, role: type === 'boolean' ? 'switch' : type === 'string' ? 'text' : 'value', read: true, write: wr });
    }
    await setStateAsync(P + 'Allgemein.Entsperrt', false, true);
    await setStateAsync(P + 'Allgemein.Anzahl', ROOMS.length, true);
}

// ---------- Protokoll ----------
async function logge(raum, text, ok) {
    protokoll.unshift({ z: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }), raum, text, ok });
    protokoll = protokoll.slice(0, MAXPROT);
    await setStateAsync(P + 'Allgemein.Protokoll_JSON', JSON.stringify(protokoll), true);
    const html = protokoll.slice(0, 6).map(e => '<div style="font-size:14px;line-height:23px;color:#cfd6dc;white-space:nowrap;"><span style="color:#6d7780;">' + e.z + '</span>  <span style="color:' +
        (e.ok ? 'limegreen' : 'tomato') + ';">●</span>  <b>' + e.raum + '</b> · ' + e.text + '</div>').join('');
    await setStateAsync(P + 'Allgemein.Protokoll_HTML', html || '<div style="font-size:14px;color:#6d7780;">noch keine Aktion</div>', true);
    log('Schwiegereltern_Rollladen: ' + raum + ': ' + text + (ok ? '' : ' (nicht ausgefuehrt)'), ok ? 'info' : 'warn');
}
async function meldung(r, text) { await setStateAsync(P + r.id + '.Meldung', text, true); }
async function gesperrt() { return !(await get(P + 'Allgemein.Entsperrt')); }

// ---------- XML-RPC fuer echte Aktoren (im Betrieb erprobt) ----------
function rpc(method, params) {
    const body = '<?xml version="1.0"?><methodCall><methodName>' + method + '</methodName><params>' + params.map(p => '<param><value>' + p + '</value></param>').join('') + '</params></methodCall>';
    return new Promise((resolve, reject) => {
        httpPost(CCU, body, { timeout: 15000, headers: { 'Content-Type': 'text/xml' } }, (err, res) => {
            if (err) return reject(new Error(String(err)));
            const txt = res && res.data !== undefined ? String(res.data) : '';
            if (txt.indexOf('<fault>') >= 0) return reject(new Error('CCU lehnt ab: ' + txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140)));
            if (txt.indexOf('<methodResponse>') < 0) return reject(new Error('keine Antwort der CCU'));
            resolve(txt);
        });
    });
}
const S = s => '<string>' + s + '</string>';
async function aktorLevel(r, z) { await rpc('setValue', [S(AKTOR[r.id].adr), S('LEVEL'), '<double>' + (z / 100).toFixed(2) + '</double>']); }
async function aktorStop(r) {      // HmIP-BROLL hat keinen STOP-Parameter: dann LEVEL = aktuelle Position setzen (haelt den Antrieb dort an)
    try { await rpc('setValue', [S(AKTOR[r.id].adr), S('STOP'), '<boolean>1</boolean>']); }
    catch (e) {
        const pos = await aktorLesen(r);
        if (pos === null) throw e;
        await aktorLevel(r, pos);
    }
}
async function aktorLesen(r) {
    const txt = await rpc('getParamset', [S(AKTOR[r.id].adr), S('VALUES')]);
    const m = /<name>LEVEL<\/name>\s*<value>\s*<double>([^<]+)<\/double>/.exec(txt);
    return m ? Math.round(Number(m[1]) * 100) : null;
}

// ---------- Funkguete (16.11.2026) ----------
function rssiWert(txt, name) {
    const m = new RegExp('<name>' + name + '<\\/name>\\s*<value>\\s*<i4>(-?\\d+)<\\/i4>').exec(txt);
    if (!m) return null;
    const v = Number(m[1]);
    return (v >= FUNK_MIN && v <= FUNK_MAX) ? v : null;      // 0 oder 128 heisst "unbekannt", nicht "sehr gut"
}
async function funkLesen() {
    let gelesen = 0, stumm = 0;
    for (const r of ROOMS) {
        if (!AKTOR[r.id]) continue;                           // Dummy-Raum: kein Geraet, keine Funkguete
        try {
            const adr0 = AKTOR[r.id].adr.split(':')[0] + ':0';    // Wartungskanal
            const txt = await rpc('getParamset', [S(adr0), S('VALUES')]);
            const dev = rssiWert(txt, 'RSSI_DEVICE'), peer = rssiWert(txt, 'RSSI_PEER');
            const beide = [dev, peer].filter(v => v !== null);
            if (!beide.length) { stumm++; continue; }             // antwortet, meldet aber keinen Pegel
            await setStateAsync(P + r.id + '.Funk_Geraet', dev === null ? 0 : dev, true);
            await setStateAsync(P + r.id + '.Funk_Zentrale', peer === null ? 0 : peer, true);
            await setStateAsync(P + r.id + '.Funk_dBm', Math.min(...beide), true);
            await setStateAsync(P + r.id + '.Funk_Stand', new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), true);
            gelesen++;
        } catch (e) {
            stumm++;                                          // nicht erreichbar: alten Wert stehen lassen, Stand verraet das Alter
        }
        await new Promise(res => setTimeout(res, 150));        // die CCU nicht fluten
    }
    if (!gelesen) log('Rollladen: Funkguete nicht lesbar (' + stumm + ' Geraete stumm)', 'warn');
}


// ---------- Notlauf-Absicherung in der CCU (25.10.2026, Auftrag Besitzer: Variante C) ----------
// Der Zeitplan laeuft weiterhin HIER. Faellt dieser Rechner oder der Tunnel aus, uebernimmt ein
// Programm IN der CCU. Damit es weiss, ob hier noch jemand lebt und wann gefahren werden soll,
// schreibt dieses Skript zwei Systemvariablen der CCU:
//   Rollladen_Lebenszeichen  Minuten seit Mitternacht des letzten Lebenszeichens (alle 5 min)
//   Rollladen_Plan           "<adresse:kanal>|<hoch_min>|<runter_min>;..." je Raum mit Automatik
// Bleibt das Lebenszeichen laenger als NOTLAUF_VERZUG Minuten alt, faehrt die CCU selbst.
const REGA = 'http://192.168.1.99:8181/tclrega.exe';
const NOTLAUF_TAKT_MS = 300000;      // 5 Minuten
let letzterPlan = null;

function rega(skript) {
    return new Promise((resolve, reject) => {
        httpPost(REGA, skript, { timeout: 15000 }, (err, res) => {
            if (err) return reject(new Error(String(err)));
            resolve(String((res && res.data) || '').replace(/<xml>[\s\S]*/, ''));
        });
    });
}

async function notlaufPflegen() {
    try {
        const teile = [];
        for (const r of ROOMS) {
            if (!AKTOR[r.id]) continue;                       // Dummy-Raum: nichts zu fahren
            if (!(await get(P + r.id + '.Auto'))) continue;    // Automatik aus: auch im Notlauf nicht
            teile.push(AKTOR[r.id].adr + '|' + (await get(P + r.id + '.Hoch_Min')) + '|' + (await get(P + r.id + '.Runter_Min')));
        }
        const plan = teile.join(';');
        if (plan !== letzterPlan) {
            await rega('dom.GetObject(ID_SYSTEM_VARIABLES).Get("Rollladen_Plan").State("' + plan + '");');
            letzterPlan = plan;
            log('Rollladen: Notlauf-Plan an die CCU uebergeben (' + teile.length + ' Raeume)', 'info');
        }
        await rega('dom.GetObject(ID_SYSTEM_VARIABLES).Get("Rollladen_Lebenszeichen").State(' + nowMin() + ');');
    } catch (e) {
        // Tunnel oder CCU nicht erreichbar -- genau dann soll die CCU ohnehin selbst uebernehmen
        log('Rollladen: Lebenszeichen an die CCU nicht moeglich (' + e.message + ')', 'warn');
    }
}

// ---------- Fahren ----------
async function setzeFahrt(r, f) {
    if ((await get(P + r.id + '.Fahrt')) !== f) { await setStateAsync(P + r.id + '.Fahrt', f, true); await setStateAsync(P + r.id + '.Status', f > 0 ? 'fährt auf' : f < 0 ? 'fährt zu' : 'steht', true); }
}
async function setzeZiel(r, wert, quelle, still) {
    const z = Math.max(0, Math.min((AKTOR[r.id] && AKTOR[r.id].max) || 100, Math.round(Number(wert))));      // max = Obergrenze je Rollladen (derzeit keine gesetzt; Schlafzimmer-Grenze 75 % am 24.10.2026 auf des Besitzers Wunsch aufgehoben)
    await setStateAsync(P + r.id + '.Ziel', z, true);
    if (!simuliert(r)) { try { await aktorLevel(r, z); letzteAenderung[r.id] = Date.now(); } catch (e) { await meldung(r, 'Fehler: ' + e.message); if (!still) await logge(r.name, quelle + ': ' + e.message, false); return false; } }   // still = Wiederholversuch, nicht erneut protokollieren
    return true;
}
async function fahre(r, b, quelle, still) {
    if (b === 'auf') return setzeZiel(r, 100, quelle, still);
    if (b === 'zu') return setzeZiel(r, 0, quelle, still);
    if (/^z(0|25|50|75|100)$/.test(b)) return setzeZiel(r, Number(b.slice(1)), quelle, still);
    if (b === 'stopp') {
        await setStateAsync(P + r.id + '.Ziel', Math.round(Number(await get(P + r.id + '.Position'))), true);
        if (!simuliert(r)) { try { await aktorStop(r); } catch (e) { await meldung(r, 'Fehler: ' + e.message); return false; } }
        return true;
    }
    return false;
}
const BEFEHLTEXT = { auf: 'hochgefahren', zu: 'runtergefahren', stopp: 'angehalten', z0: 'auf 0 % gefahren', z25: 'auf 25 % gefahren', z50: 'auf 50 % gefahren', z75: 'auf 75 % gefahren', z100: 'auf 100 % gefahren' };

// ---------- Zeitplan ----------
// ---------- Hoch- und Runterfahren nach der Sonne (08./09.11.2026, Auftrag Besitzer) ----------
// Anlass: die feste Zeit 20:00 stammte aus dem Oktober. Am 08.11. ging die Sonne um 16:45 unter, die beiden
// Dachfenster im 2. OG standen darum zwei Stunden unnoetig offen (die uebrigen Raeume werden von Hand bedient
// und fielen nicht auf). Statt einer neuen festen Zeit, die im Juni wieder falsch waere, wird Runter_Min bei
// Runter_Sonne = true taeglich neu berechnet. sonnenZeiten() laeuft beim Start und alle 5 Minuten, holt den
// Mitternachtswechsel also selbst nach.
// Am 09.11.2026 kam das Hochfahren dazu. Dort ist eine reine Sonnenzeit nicht brauchbar: Ende Juni waere
// das 05:15, Ende Dezember 08:15. Darum begrenzen Hoch_Frueh / Hoch_Spaet das Ergebnis (voreingestellt
// 06:30 bis 08:00). Wird gegrenzt, nennt Hoch_Quelle hinter einem Pfeil die tatsaechliche Zeit.
async function sonnenMin(dp) {
    let v = null;
    try { const st = await getStateAsync(dp); v = st && st.val; } catch (e) { v = null; }
    if (!v) return null;
    const d = new Date(Number(v));
    if (isNaN(d.getTime())) return null;
    const t = new Date();                              // veralteten Wert nicht verwenden (Adapter steht): lieber die alte Zeit behalten
    if (d.getFullYear() !== t.getFullYear() || d.getMonth() !== t.getMonth() || d.getDate() !== t.getDate()) return null;
    return d.getHours() * 60 + d.getMinutes();
}
function versatzText(v) { return v === 0 ? '' : (v > 0 ? ' +' : ' \u2212') + Math.abs(v) + ' min'; }
async function sonnenZeiten() {
    const sa = await sonnenMin(SUNRISE_DP), su = await sonnenMin(SUNSET_DP);
    for (const r of ROOMS) {
        await sonnenZeitRaum(r, 'Hoch', sa, 'Sonnenaufgang');
        await sonnenZeitRaum(r, 'Runter', su, 'Sonnenuntergang');
    }
}
// Rechnet EINE Zeit (Hoch oder Runter) eines Raums aus der Sonnenzeit. Geschrieben wird nur <art>_Min --
// Zeitplan, Anzeige und Notlauf-Plan der CCU lesen weiterhin ausschliesslich diesen Wert.
async function sonnenZeitRaum(r, art, s, wort) {
    const p = P + r.id + '.' + art;
    if (!(await get(p + '_Sonne'))) { await setStateAsync(p + '_Quelle', 'feste Uhrzeit', true); return; }
    if (s === null) { await setStateAsync(p + '_Quelle', wort + ' \u2013 Wert fehlt, letzte Zeit bleibt', true); return; }
    const v = Math.round(Number(await get(p + '_Versatz')) || 0);
    let neu = (((s + v) % 1440) + 1440) % 1440;
    let gegrenzt = false;
    if (art === 'Hoch') {                                  // Grenzen gibt es nur beim Hochfahren (Besitzer 09.11.2026)
        const fr0 = Number(await get(p + '_Frueh')), sp0 = Number(await get(p + '_Spaet'));
        const fr = isNaN(fr0) ? 0 : Math.round(fr0), sp = isNaN(sp0) ? 1439 : Math.round(sp0);
        if (fr <= sp) {                                    // widerspruechliche Grenzen lieber uebergehen als falsch fahren
            if (neu < fr) { neu = fr; gegrenzt = true; }
            else if (neu > sp) { neu = sp; gegrenzt = true; }
        }
    }
    if (Number(await get(p + '_Min')) !== neu) {
        await setStateAsync(p + '_Min', neu, true);
        await setStateAsync(p + '_Text', hhmm(neu), true);
        await aktualisiereText(r);
    }
    await setStateAsync(p + '_Quelle', wort + ' ' + hhmm(s) + versatzText(v) + (gegrenzt ? ' \u2192 ' + hhmm(neu) : ''), true);
}
async function sonneUmschalten(r, art, an) {
    const wort = art === 'Hoch' ? 'Sonnenaufgang' : 'Sonnenuntergang';
    const was = art === 'Hoch' ? 'Hochfahren' : 'Runterfahren';
    await setStateAsync(P + r.id + '.' + art + '_Sonne', an, true);
    await sonnenZeiten();
    const z = hhmm(Number(await get(P + r.id + '.' + art + '_Min')));
    await meldung(r, an ? art + ' bei ' + wort + ' (heute ' + z + ')' : art + ' zur festen Uhrzeit ' + z);
    await logge(r.name, an ? was + ' an den ' + wort + ' gekoppelt (heute ' + z + ')' : was + ' auf feste Uhrzeit ' + z, true);
    await aktualisiereText(r);
}
// Grenzen des Hochfahrens verstellen. Eine Grenze darf die andere nicht ueberholen, sonst waere unklar,
// welche gilt -- der Versuch wird abgelehnt und gemeldet statt stillschweigend verworfen.
async function grenzeSchritt(r, welche, delta) {
    if (await gesperrt()) { await meldung(r, 'Nicht ausgeführt: gesperrt \u2013 erst Entsperren'); await logge(r.name, 'Grenze ändern abgelehnt (gesperrt)', false); return; }
    const id = P + r.id + '.Hoch_' + welche;
    const neu = Math.max(0, Math.min(1439, Math.round(Number(await get(id))) + Math.round(Number(delta))));
    const fr = welche === 'Frueh' ? neu : Math.round(Number(await get(P + r.id + '.Hoch_Frueh')));
    const sp = welche === 'Spaet' ? neu : Math.round(Number(await get(P + r.id + '.Hoch_Spaet')));
    if (fr > sp) { await meldung(r, 'Nicht ausgeführt: "nicht vor" darf nicht hinter "nicht nach" liegen'); return; }
    await setStateAsync(id, neu, true);
    await setStateAsync(id + '_Text', hhmm(neu), true);
    await sonnenZeiten();
    const z = hhmm(Number(await get(P + r.id + '.Hoch_Min')));
    await meldung(r, (welche === 'Frueh' ? 'Hoch nicht vor ' : 'Hoch nicht nach ') + hhmm(neu) + ' \u2013 heute ' + z);
    await logge(r.name, (welche === 'Frueh' ? 'Grenze nicht vor ' : 'Grenze nicht nach ') + hhmm(neu) + ' (heute hoch ' + z + ')', true);
    await aktualisiereText(r);
}

async function zeitSchritt(r, art, delta) {
    if (await gesperrt()) { await meldung(r, 'Nicht ausgeführt: gesperrt – erst Entsperren'); await logge(r.name, art + '-Zeit ändern abgelehnt (gesperrt)', false); return; }
    if (await get(P + r.id + '.' + art + '_Sonne')) {      // an die Sonne gekoppelt: die +/- Knoepfe verschieben den Versatz, nicht die Uhrzeit
        const wort = art === 'Hoch' ? 'Sonnenaufgang' : 'Sonnenuntergang';
        const v = Math.max(-180, Math.min(180, Math.round(Number(await get(P + r.id + '.' + art + '_Versatz')) || 0) + Math.round(Number(delta))));
        await setStateAsync(P + r.id + '.' + art + '_Versatz', v, true);
        await sonnenZeiten();
        const z = hhmm(Number(await get(P + r.id + '.' + art + '_Min')));
        await meldung(r, art + ' ' + (v === 0 ? 'genau zum ' + wort : Math.abs(v) + ' min ' + (v > 0 ? 'nach' : 'vor') + ' ' + wort) + ' = heute ' + z);
        await aktualisiereText(r);
        return;
    }
    const id = P + r.id + '.' + art + '_Min';
    const neu = (((Number(await get(id)) + Math.round(Number(delta))) % 1440) + 1440) % 1440;
    await setStateAsync(id, neu, true);
    await setStateAsync(P + r.id + '.' + art + '_Text', hhmm(neu), true);
    await meldung(r, art + ' um ' + hhmm(neu) + ' eingestellt');
    await aktualisiereText(r);
}
async function autoUmschalten(r, an) {
    await setStateAsync(P + r.id + '.Auto', an, true);
    if (an) {                        // heute schon vorbeigegangene Zeiten nicht sofort nachholen
        const h = heuteStr(), n = nowMin();
        if (n > Number(await get(P + r.id + '.Hoch_Min'))) await setStateAsync(P + r.id + '.Letzte_Hoch', h + '*', true);       // '*' = uebersprungen
        if (n > Number(await get(P + r.id + '.Runter_Min'))) await setStateAsync(P + r.id + '.Letzte_Runter', h + '*', true);
    }
    await meldung(r, an ? 'Zeitplan eingeschaltet' : 'Zeitplan ausgeschaltet');
    await logge(r.name, an ? 'Zeitplan eingeschaltet (hoch ' + hhmm(Number(await get(P + r.id + '.Hoch_Min'))) + ', runter ' + hhmm(Number(await get(P + r.id + '.Runter_Min'))) + ')' : 'Zeitplan ausgeschaltet', true);
    await aktualisiereText(r);
    await zaehle();
}
async function aktualisiereText(r) {
    const auto = !!(await get(P + r.id + '.Auto')), h = heuteStr(), n = nowMin();
    const hm = Number(await get(P + r.id + '.Hoch_Min')), rm = Number(await get(P + r.id + '.Runter_Min'));
    const lh = await get(P + r.id + '.Letzte_Hoch'), lr = await get(P + r.id + '.Letzte_Runter');
    const erledigt = d => String(d).startsWith(h) && String(d).indexOf('!') < 0;     // '!' = Versuch fehlgeschlagen, also NICHT erledigt
    const stat = (done, t) => String(done).startsWith(h + '!')
        ? (n <= t + NACHHOL_MIN ? 'Funkfehler ' + hhmm(t) + ', Wiederholung läuft' : 'nicht ausgeführt (Funkfehler ' + hhmm(t) + ')')
        : done === h ? '✓ ' + hhmm(t) : done === h + '*' ? 'übersprungen (' + hhmm(t) + ' schon vorbei)' : n < t ? 'ausstehend ' + hhmm(t) : 'nicht ausgeführt';
    await setStateAsync(P + r.id + '.Heute', auto ? '▲ ' + stat(lh, hm) + '  ·  ▼ ' + stat(lr, rm) : 'Zeitplan aus', true);
    if (!auto) { await setStateAsync(P + r.id + '.Naechste', 'Zeitplan ist aus', true); return; }
    const kand = [];
    for (const [art, tm, last] of [['Hoch', hm, lh], ['Runter', rm, lr]]) {
        const heuteOffen = !erledigt(last) && n <= tm;                    // heute noch nicht erledigt und noch nicht vorbei
        kand.push({ art, t: tm, d: heuteOffen ? tm - n : tm - n + 1440, morgen: !heuteOffen });
    }
    kand.sort((a, b) => a.d - b.d);
    const k = kand[0];
    await setStateAsync(P + r.id + '.Naechste', 'Nächste Aktion: ' + k.art + ' um ' + hhmm(k.t) + (k.morgen ? ' morgen' : ' heute') + ' – in ' + (k.d >= 60 ? Math.floor(k.d / 60) + ' h ' : '') + (k.d % 60) + ' min', true);
}
async function pruefeZeitplan() {
    const h = heuteStr(), n = nowMin();
    for (const r of ROOMS) {
        if (await get(P + r.id + '.Auto')) {
            for (const [art, bef, key] of [['Hoch', 'auf', 'Letzte_Hoch'], ['Runter', 'zu', 'Letzte_Runter']]) {
                const t = Number(await get(P + r.id + '.' + art + '_Min'));
                // Markierung: '<datum>' = gefahren, '<datum>*' = uebersprungen, '<datum>!<minute>/<versuch>' = Versuch
                // fehlgeschlagen (16.11.2026). Beim Fehlschlag wird NICHT auf erledigt gesetzt, sonst faellt die
                // Fahrt fuer den ganzen Tag aus -- genau das passierte am 16.11.2026 um 07:30 (Funk, UNREACH).
                const letzte = String(await get(P + r.id + '.' + key));
                const fehl = letzte.startsWith(h + '!');
                if ((letzte.startsWith(h) && !fehl) || n < t || n > t + NACHHOL_MIN) continue;
                let versuch = 1;
                if (fehl) {
                    const teile = (letzte.split('!')[1] || '0/0').split('/');
                    if (n - Number(teile[0]) < WIEDERHOL_MIN) continue;       // noch zu frueh fuer den naechsten Versuch
                    versuch = Number(teile[1]) + 1;
                }
                await setStateAsync(P + r.id + '.' + key, h, true);           // Laufsperre: keine zweite Fahrt im naechsten Takt
                const ok = await fahre(r, bef, 'Zeitplan', versuch > 1);      // ab dem 2. Versuch still, sonst laeuft das Protokoll voll
                if (ok) {
                    const verspaetet = n - t > 2 ? ' (nachgeholt, geplant ' + hhmm(t) + ')' : '';
                    await meldung(r, 'Zeitplan: ' + BEFEHLTEXT[bef] + ' ' + hhmm(n));
                    await logge(r.name, 'Zeitplan: ' + BEFEHLTEXT[bef] + verspaetet + (versuch > 1 ? ' (' + versuch + '. Versuch)' : ''), true);
                } else {
                    await setStateAsync(P + r.id + '.' + key, h + '!' + n + '/' + versuch, true);
                    await meldung(r, 'Zeitplan: Fehler (' + versuch + '. Versuch) \u2013 Wiederholung in ' + WIEDERHOL_MIN + ' min');
                }
            }
        }
        await aktualisiereText(r);
    }
}

// ---------- Befehle ----------
async function befehl(r, b) {
    b = String(b); await setStateAsync(P + r.id + '.Befehl', '', true);
    if (!b) return;
    if (await gesperrt()) { await meldung(r, 'Nicht ausgeführt: gesperrt – erst Entsperren'); await logge(r.name, b + ' abgelehnt (gesperrt)', false); return; }
    if (b === 'auto_an') return autoUmschalten(r, true);
    if (b === 'auto_aus') return autoUmschalten(r, false);
    if (b === 'sonne_an') return sonneUmschalten(r, 'Runter', true);
    if (b === 'sonne_aus') return sonneUmschalten(r, 'Runter', false);
    if (b === 'sonne_hoch_an') return sonneUmschalten(r, 'Hoch', true);
    if (b === 'sonne_hoch_aus') return sonneUmschalten(r, 'Hoch', false);
    if (!BEFEHLTEXT[b]) { await meldung(r, 'Unbekannter Befehl'); return; }
    const ok = await fahre(r, b, 'Bedienung');
    if (ok) { await meldung(r, 'Gesendet ' + new Date().toLocaleTimeString('de-DE') + ': ' + BEFEHLTEXT[b]); await logge(r.name, BEFEHLTEXT[b], true); }
}
async function zaehle() {
    let offen = 0, zu = 0, fahrend = 0, dummy = false, auto = 0;
    for (const r of ROOMS) {
        const pos = Number(await get(P + r.id + '.Position'));
        if (pos >= 95) offen++; if (pos <= 5) zu++;
        if ((await get(P + r.id + '.Fahrt')) !== 0) fahrend++;
        if (simuliert(r)) dummy = true;
        if (await get(P + r.id + '.Auto')) auto++;
    }
    await setStateAsync(P + 'Allgemein.Offen', offen, true); await setStateAsync(P + 'Allgemein.Zu', zu, true);
    await setStateAsync(P + 'Allgemein.Fahrend', fahrend, true); await setStateAsync(P + 'Allgemein.Dummy', dummy, true);
    await setStateAsync(P + 'Allgemein.Auto_Anzahl', auto, true);
}
async function takt() {      // jede Sekunde
    for (const r of ROOMS) {
        let pos = Number(await get(P + r.id + '.Position'));
        if (simuliert(r)) {
            const z = Number(await get(P + r.id + '.Ziel'));
            if (Math.abs(z - pos) > 0.05) {
                const dir = z > pos ? 1 : -1;
                pos = Math.round((dir > 0 ? Math.min(z, pos + SCHRITT) : Math.max(z, pos - SCHRITT)) * 10) / 10;
                await setStateAsync(P + r.id + '.Position', pos, true);
                await setzeFahrt(r, Math.abs(z - pos) > 0.05 ? dir : 0);
            } else if ((await get(P + r.id + '.Fahrt')) !== 0) await setzeFahrt(r, 0);
        } else {                                  // echter Aktor: Position lesen (3 s in Fahrt, sonst 30 s)
            const jetzt = Date.now(), unterwegs = letzteAenderung[r.id] && jetzt - letzteAenderung[r.id] < 120000;
            if (jetzt - (letzteAbfrage[r.id] || 0) > (unterwegs ? 3000 : 30000)) {
                letzteAbfrage[r.id] = jetzt;
                try {
                    const neu = await aktorLesen(r);
                    if (neu !== null) { const alt = pos; await setStateAsync(P + r.id + '.Position', neu, true); await setzeFahrt(r, neu > alt ? 1 : neu < alt ? -1 : 0); if (neu === alt && unterwegs) letzteAenderung[r.id] = 0; }
                } catch (e) { /* naechster Versuch */ }
            }
        }
    }
    await zaehle();
}
(async () => {
    await init();
    try { protokoll = JSON.parse((await get(P + 'Allgemein.Protokoll_JSON')) || '[]'); } catch (e) { protokoll = []; }
    for (const r of ROOMS) {
        on({ id: P + r.id + '.Befehl', ack: false, change: 'any' }, o => { befehl(r, o.state.val); });
        on({ id: P + r.id + '.Hoch_Schritt', ack: false, change: 'any' }, o => { zeitSchritt(r, 'Hoch', o.state.val); });
        on({ id: P + r.id + '.Hoch_Frueh_Schritt', ack: false, change: 'any' }, o => { grenzeSchritt(r, 'Frueh', o.state.val); });
        on({ id: P + r.id + '.Hoch_Spaet_Schritt', ack: false, change: 'any' }, o => { grenzeSchritt(r, 'Spaet', o.state.val); });
        on({ id: P + r.id + '.Runter_Schritt', ack: false, change: 'any' }, o => { zeitSchritt(r, 'Runter', o.state.val); });
    }
    on({ id: P + 'Allgemein.Alle_Befehl', ack: false, change: 'any' }, async o => {
        const b = String(o.state.val); await setStateAsync(P + 'Allgemein.Alle_Befehl', '', true);
        if (!['auf', 'zu', 'stopp'].includes(b)) return;
        if (await gesperrt()) { await logge('Alle', b + ' abgelehnt (gesperrt)', false); return; }
        for (const r of ROOMS) { if (await fahre(r, b, 'Bedienung')) await meldung(r, 'Gesendet ' + new Date().toLocaleTimeString('de-DE') + ': ' + BEFEHLTEXT[b]); }
        await logge('Alle', BEFEHLTEXT[b], true);
    });
    on({ id: P + 'Allgemein.Entsperrt', ack: false, change: 'any' }, async o => {
        if (entsperrTimer) clearTimeout(entsperrTimer);
        if (o.state.val === true) { await setStateAsync(P + 'Allgemein.Entsperrt', true, true); entsperrTimer = setTimeout(() => { setState(P + 'Allgemein.Entsperrt', false, true); }, ENTSPERR_MS); }
        else await setStateAsync(P + 'Allgemein.Entsperrt', false, true);
    });
    if (!protokoll.length) await setStateAsync(P + 'Allgemein.Protokoll_HTML', '<div style="font-size:14px;color:#6d7780;">noch keine Aktion</div>', true);
    await sonnenZeiten();                    // Hoch- und Runter-Zeiten der gekoppelten Raeume auf heute setzen, BEVOR der Zeitplan das erste Mal prueft
    await pruefeZeitplan();
    setInterval(sonnenZeiten, 300000);       // alle 5 Minuten: holt den Mitternachtswechsel nach, auch wenn das Skript dabei stand
    setInterval(takt, 1000);
    setInterval(pruefeZeitplan, 20000);
setInterval(notlaufPflegen, NOTLAUF_TAKT_MS);
setTimeout(funkLesen, FUNK_START_MS);
setInterval(funkLesen, FUNK_TAKT_MS);
notlaufPflegen();
    log('Schwiegereltern_Rollladen gestartet (' + ROOMS.length + ' Rollladen, ' + ROOMS.filter(simuliert).length + ' simuliert, Zeitplan: einmal hoch, einmal runter)', 'info');
})();
