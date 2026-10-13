'use strict';
// ============================================================================
// Schwiegereltern_CCU  (01.10.2026, Claude)
// Phase 1 Bedienung (01.10.2026): Soll +/-0,5, Auto/Manuell, Boost, Profil 1-3 -- NUR nach Entsperren (Schloss, 10 s),
// mit Grenzen (8-26 Grad), Ratenbegrenzung und Protokoll; Gesamtschalter Allgemein.Bedienung_erlaubt.
// Lesen: die Heizungsgruppen (virtuelle
// Geraete, XML-RPC Port 9292 /groups) der CCU3 bei den Schwiegereltern und stellt
// sie fuer die vis-2-View "Schwiegereltern" bereit. Geraetedaten (Thermostate,
// Fensterkontakte) kommen direkt aus hm-rpc.1.
//   - alle 60 s : VALUES der Gruppen (Soll, Ist, Feuchte, Ventil, Modus ...)
//   - alle 10 min: MASTER der Gruppen (Wochenprofile P1..P6)
//   - jede Minute: Tagesprofil-Grafik (SVG) mit "jetzt"-Markierung
// Datenpunkte: 0_userdata.0.Schwiegereltern.<Raum>.*  und  ...Allgemein.*
// ============================================================================
const CCU_GROUPS = 'http://192.168.1.99:9292/groups';
const CCU_DEVICES = 'http://192.168.1.99:2010/';
const P = '0_userdata.0.Schwiegereltern.';
const ROOMS = [
    { id: 'Wohnzimmer', name: 'Wohnzimmer', group: 'INT0000001' },
    { id: 'Kueche',     name: 'Küche',      group: 'INT0000002' },
    { id: 'Keller',     name: 'Keller',     device: '00AB0000000012' }   // ohne Heizungsgruppe: Werte direkt vom Heizkoerperthermostat
];
// Quelle eines Raums: Heizungsgruppe (Port 9292) oder, wenn es keine gibt, das Thermostat selbst (Port 2010)
function quelle(r) { return r.group ? { url: CCU_GROUPS, addr: r.group + ':1' } : { url: CCU_DEVICES, addr: r.device + ':1' }; }
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const DEVICES = [
    { adr: '00AB0000000008', typ: 'HmIP-eTRV-B-2' },
    { adr: '00AB0000000010', typ: 'HmIP-eTRV-B-2' },
    { adr: '00AB0000000009', typ: 'HmIP-SWDM-2', fenster: true },
    { adr: '00AB0000000011', typ: 'HmIP-SWDO-2', fenster: true },   // Kuechen-Fensterkontakt, getauscht 12.10.2026 (alt: 00AB0000000016 HmIP-SWDM-2)
    { adr: '00AB0000000012', typ: 'HmIP-eTRV-2' },
    { adr: '00AB0000000007', typ: 'HmIP-WTH-2' }
];
const master = {};          // Raum -> geparstes MASTER (Profile)
let fehlerZaehler = 0;

// ---------- XML-RPC (minimal, nur lesend) ----------
function rpcCall(url, method, params) {
    const body = '<?xml version="1.0"?><methodCall><methodName>' + method + '</methodName><params>' +
        params.map(p => '<param><value><string>' + p + '</string></value></param>').join('') + '</params></methodCall>';
    return new Promise((resolve, reject) => {
        httpPost(url, body, { timeout: 20000, headers: { 'Content-Type': 'text/xml' } }, (err, res) => {
            if (err) return reject(new Error(String(err)));
            const txt = res && res.data !== undefined ? String(res.data) : '';
            if (!txt || txt.indexOf('<methodResponse>') < 0) return reject(new Error('Antwort ohne methodResponse: ' + txt.slice(0, 120)));
            if (txt.indexOf('<fault>') >= 0) return reject(new Error('XML-RPC Fault: ' + txt.slice(0, 200)));
            resolve(txt);
        });
    });
}
function parseStruct(xml) {
    const out = {};
    const re = /<member>\s*<name>([^<]+)<\/name>\s*<value>\s*<(\w+)>([^<]*)<\/\2>\s*<\/value>\s*<\/member>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const t = m[2], v = m[3];
        if (t === 'boolean') out[m[1]] = v === '1';
        else if (t === 'double' || t === 'i4' || t === 'int') out[m[1]] = Number(v);
        else out[m[1]] = v;
    }
    return out;
}

// ---------- Datenpunkte anlegen ----------
const DEFS = [
    ['Soll',            'number',  'level.temperature', '°C',  'Solltemperatur (Gruppe)'],
    ['Ist',             'number',  'value.temperature', '°C',  'Isttemperatur (Gruppe)'],
    ['Feuchte',         'number',  'value.humidity',    '%',   'Luftfeuchte (Gruppe, 0 = kein Sensor)'],
    ['Ventil',          'number',  'value',             '%',   'Ventilstellung'],
    ['Ventilzustand',   'number',  'value',             '',    'VALVE_STATE (4 = in Ordnung)'],
    ['Fenster_Gruppe',  'number',  'value',             '',    'WINDOW_STATE der Gruppe (0 zu, 1 offen)'],
    ['Modus_Code',      'number',  'value',             '',    'CONTROL_MODE (0 Auto, 1 Manuell, 2 Abwesend, 3 Boost)'],
    ['Sollmodus_Code',  'number',  'value',             '',    'SET_POINT_MODE (0 Auto, 1 Manuell, 2 Abwesend)'],
    ['Betriebsart',     'string',  'text',              '',    'Betriebsart als Text'],
    ['Profil',          'number',  'value',             '',    'Aktives Wochenprofil 1-6'],
    ['Boost',           'boolean', 'indicator',         '',    'Boost aktiv'],
    ['Party',           'boolean', 'indicator',         '',    'Party/Abwesend aktiv'],
    ['Frostschutz',     'boolean', 'indicator',         '',    'Frostschutz aktiv'],
    ['Heizen_Kuehlen',  'number',  'value',             '',    '0 Heizen, 1 Kuehlen'],
    ['Heizt',           'boolean', 'indicator',         '',    'Ventil offen (Heizung arbeitet)'],
    ['Soll_laut_Profil','number',  'value.temperature', '°C',  'Solltemperatur laut Wochenprofil jetzt'],
    ['Profil_Tag',      'string',  'text',              '',    'Wochentag des angezeigten Profils'],
    ['Profil_JSON',     'string',  'json',              '',    'Segmente des heutigen Profils [{von,bis,temp}]'],
    ['Timeline_SVG',    'string',  'html',              '',    'Tagesprofil als SVG fuer die View']
];
async function init() {
    for (const r of ROOMS) {
        for (const [id, type, role, unit, name] of DEFS) {
            const full = P + r.id + '.' + id;
            if (!existsState(full)) {
                const def = type === 'number' ? 0 : type === 'boolean' ? false : '';
                await createStateAsync(full, def, { name: r.name + ': ' + name, type, role, unit, read: true, write: false });
            }
        }
    }
    for (const d of DEVICES) {
        const base = P + 'Geraete.' + d.adr + '.';
        const defs = [['UNREACH', 'boolean', 'indicator.unreach', 'nicht erreichbar', false], ['LOW_BAT', 'boolean', 'indicator.lowbat', 'Batterie schwach', false],
                      ['OPERATING_VOLTAGE', 'number', 'value.voltage', 'Batteriespannung V', 0], ['RSSI_DEVICE', 'number', 'value.rssi', 'Empfang dBm', 0]];
        defs.push(['Batterie_Status', 'number', 'value', 'Batterieampel (0 gruen, 1 gelb, 2 rot, -1 unbekannt)', -1]);
        if (d.fenster) defs.push(['STATE', 'number', 'value', 'Fensterkontakt (0 zu, 1 offen)', 0]);
        for (const [id, type, role, name, def] of defs) {
            if (!existsState(base + id)) await createStateAsync(base + id, def, { name: d.typ + ' ' + d.adr + ': ' + name, type, role, read: true, write: false });
        }
    }
    for (const r of ROOMS) {
        for (const [id, type, role, name, def, wr] of [
            ['Stellen.Soll_Schritt', 'number', 'value', 'Befehl: Soll um +0,5 / -0,5 aendern', 0, true],
            ['Stellen.Soll_Ziel',    'number', 'value', 'Befehl: Soll direkt auf diesen Wert (Regler per Maus)', 0, true],
            ['Stellen.Befehl',       'string', 'text',  'Befehl: auto, manuell, boost, profil1-3', '', true],
            ['Stellen.Wunsch',       'number', 'value.temperature', 'Gewuenschte Solltemperatur (noch nicht gesendet)', 0, false],
            ['Stellen.Status',       'string', 'text',  'Ergebnis des letzten Befehls', 'Bereit', false]
        ]) {
            if (!existsState(P + r.id + '.' + id)) await createStateAsync(P + r.id + '.' + id, def, { name: r.name + ': ' + name, type, role, read: true, write: wr });
        }
    }
    for (const [id, type, role, name, def, wr] of [
        ['Allgemein.Entsperrt',          'boolean', 'switch',    'Bedienung entsperrt (faellt nach 10 s zurueck)', false, true],
        ['Allgemein.Bedienung_erlaubt',  'boolean', 'switch',    'Gesamtschalter: Bedienung grundsaetzlich erlaubt', true, true],
        ['Allgemein.Protokoll_JSON',     'string',  'json',      'Protokoll der Bedienungen', '[]', false],
        ['Allgemein.Protokoll_HTML',     'string',  'html',      'Protokoll fuer die View', '', false]
    ]) {
        if (!existsState(P + id)) await createStateAsync(P + id, def, { name, type, role, read: true, write: wr });
    }
    await setStateAsync(P + 'Allgemein.Entsperrt', false, true);   // nach jedem Start gesperrt
    for (const [id, type, role, name, def] of [
        ['Allgemein.Aktualisiert', 'string',  'text',      'Letzte erfolgreiche Abfrage der CCU3', ''],
        ['Allgemein.Verbindung',   'boolean', 'indicator', 'CCU3 (Schwiegereltern) per XML-RPC erreichbar', false],
        ['Allgemein.Fehler',       'string',  'text',      'Letzte Fehlermeldung', ''],
        ['Allgemein.Fenster_offen','number',  'value',     'Anzahl offener Fenster (Fensterkontakte)', 0],
        ['Allgemein.Batterie_gelb','number',  'value',     'Geraete mit gelber Batterieampel', 0],
        ['Allgemein.Batterie_rot', 'number',  'value',     'Geraete mit roter Batterieampel', 0]
    ]) {
        if (!existsState(P + id)) await createStateAsync(P + id, def, { name, type, role, read: true, write: false });
    }
}

// ---------- Batterieampel (02.10.2026) ----------
// 0 gruen, 1 gelb, 2 rot, -1 unbekannt. Rot: die CCU meldet LOW_BAT oder weniger als 1,10 V je Zelle;
// gelb: weniger als 1,25 V je Zelle. Zellen je Typ: Fensterkontakt HmIP-SWDO 1, Tuerschloss HmIP-DLD 3, sonst 2.
function zellen(typ) { const t = String(typ).toUpperCase(); if (t.indexOf('SWDO') >= 0) return 1; if (t.indexOf('DLD') >= 0) return 3; return 2; }
function batterieStatus(typ, volt, low) {
    if (low) return 2;
    if (!(volt > 0)) return -1;
    const pz = volt / zellen(typ);
    return pz < 1.1 ? 2 : pz < 1.25 ? 1 : 0;
}

// ---------- Hilfen ----------
function betriebsart(v) {
    if (v.BOOST_MODE) return 'Boost';
    if (v.PARTY_MODE) return 'Abwesend/Party';
    if (v.FROST_PROTECTION) return 'Frostschutz';
    return Number(v.SET_POINT_MODE) === 0 ? 'Automatik' : 'Manuell';
}
function farbe(t) {
    if (t <= 8) return '#3b6fd4';
    if (t <= 15) return '#4c9be8';
    if (t <= 18) return '#36b8c8';
    if (t <= 20) return '#4cc38a';
    if (t <= 22) return '#8fd16a';
    if (t <= 24) return '#f2c14e';
    return '#ee6c4d';
}
function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }

// Segmente des aktiven Profils fuer heute
function segmenteHeute(r, profilNr) {
    const m = master[r.id];
    if (!m) return null;
    const wd = WEEKDAYS[new Date().getDay()];
    const segs = [];
    let von = 0;
    for (let k = 1; k <= 13; k++) {
        const end = m['P' + profilNr + '_ENDTIME_' + wd + '_' + k];
        const temp = m['P' + profilNr + '_TEMPERATURE_' + wd + '_' + k];
        if (end === undefined || temp === undefined) break;
        if (end > von) segs.push({ von, bis: Math.min(end, 1440), temp });
        von = end;
        if (end >= 1440) break;
    }
    return segs.length ? segs : null;
}

function zeichneTimeline(r, segs, profilNr) {
    const W = 460, H = 92, x0 = 6, x1 = 454, y = 24, h = 34;
    const X = min => x0 + (x1 - x0) * min / 1440;
    const jetzt = new Date();
    const nowMin = jetzt.getHours() * 60 + jetzt.getMinutes();
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" font-family="Roboto Condensed,Arial Narrow,Arial,sans-serif">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="10" fill="#14171a"/>';
    segs.forEach(sg => {
        const xa = X(sg.von), xb = X(sg.bis), w = xb - xa;
        s += '<rect x="' + xa.toFixed(1) + '" y="' + y + '" width="' + Math.max(0, w - 1.5).toFixed(1) + '" height="' + h + '" rx="4" fill="' + farbe(sg.temp) + '" opacity="0.92"/>';
        if (w > 34) s += '<text x="' + (xa + w / 2).toFixed(1) + '" y="' + (y + h / 2 + 5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#0b0d0f">' + String(sg.temp).replace('.', ',') + '°</text>';
    });
    for (let hh = 0; hh <= 24; hh += 3) {
        const xx = X(hh * 60);
        s += '<line x1="' + xx.toFixed(1) + '" y1="' + (y + h + 3) + '" x2="' + xx.toFixed(1) + '" y2="' + (y + h + 9) + '" stroke="#6d7780" stroke-width="1"/>';
        s += '<text x="' + xx.toFixed(1) + '" y="' + (y + h + 23) + '" text-anchor="middle" font-size="11" fill="#9aa5ad">' + hh + '</text>';
    }
    const xn = X(nowMin);
    s += '<line x1="' + xn.toFixed(1) + '" y1="' + (y - 4) + '" x2="' + xn.toFixed(1) + '" y2="' + (y + h + 6) + '" stroke="#ffffff" stroke-width="2.5"/>';
    s += '<polygon points="' + (xn - 5).toFixed(1) + ',' + (y - 11) + ' ' + (xn + 5).toFixed(1) + ',' + (y - 11) + ' ' + xn.toFixed(1) + ',' + (y - 3) + '" fill="#ffffff"/>';
    const lx = Math.min(Math.max(xn, 36), W - 36);
    s += '<text x="' + lx.toFixed(1) + '" y="10" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff">jetzt ' + hhmm(nowMin) + '</text>';
    s += '</svg>';
    return s;
}

async function aktualisiereProfil(r) {
    const v = (await getStateAsync(P + r.id + '.Profil')).val || 1;
    const segs = segmenteHeute(r, v);
    if (!segs) return;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const cur = segs.find(sg => nowMin >= sg.von && nowMin < sg.bis) || segs[segs.length - 1];
    await setStateAsync(P + r.id + '.Soll_laut_Profil', cur.temp, true);
    await setStateAsync(P + r.id + '.Profil_Tag', WEEKDAYS_DE[new Date().getDay()], true);
    await setStateAsync(P + r.id + '.Profil_JSON', JSON.stringify(segs), true);
    await setStateAsync(P + r.id + '.Timeline_SVG', zeichneTimeline(r, segs, v), true);
}

// ---------- Abfragen ----------
async function pollValues() {
    try {
        for (const r of ROOMS) {
            const q = quelle(r);
            const v = parseStruct(await rpcCall(q.url, 'getParamset', [q.addr, 'VALUES']));
            if (v.ACTUAL_TEMPERATURE === undefined) throw new Error('keine Werte fuer ' + q.addr);
            await setStateAsync(P + r.id + '.Soll', v.SET_POINT_TEMPERATURE, true);
            await setStateAsync(P + r.id + '.Ist', v.ACTUAL_TEMPERATURE, true);
            await setStateAsync(P + r.id + '.Feuchte', v.HUMIDITY || 0, true); // seit 06.10.2026 neuer Wandthermostat HmIP-WTH-2 im Wohnzimmer
            await setStateAsync(P + r.id + '.Ventil', Math.round((v.LEVEL || 0) * 100), true);
            await setStateAsync(P + r.id + '.Ventilzustand', v.VALVE_STATE, true);
            await setStateAsync(P + r.id + '.Fenster_Gruppe', v.WINDOW_STATE || 0, true);
            await setStateAsync(P + r.id + '.Modus_Code', v.BOOST_MODE ? 3 : (Number(v.SET_POINT_MODE) === 0 ? 0 : 1), true); // seit 06.10.2026 aus SET_POINT_MODE/BOOST_MODE (CONTROL_MODE der Gruppe bleibt bei manuell auf 0)
            await setStateAsync(P + r.id + '.Sollmodus_Code', v.SET_POINT_MODE, true);
            await setStateAsync(P + r.id + '.Betriebsart', betriebsart(v), true);
            await setStateAsync(P + r.id + '.Profil', v.ACTIVE_PROFILE, true);
            await setStateAsync(P + r.id + '.Boost', !!v.BOOST_MODE, true);
            await setStateAsync(P + r.id + '.Party', !!v.PARTY_MODE, true);
            await setStateAsync(P + r.id + '.Frostschutz', !!v.FROST_PROTECTION, true);
            await setStateAsync(P + r.id + '.Heizen_Kuehlen', v.HEATING_COOLING || 0, true);
            await setStateAsync(P + r.id + '.Heizt', (v.LEVEL || 0) > 0, true);
            await aktualisiereProfil(r);
        }
        const jetzt = new Date();
        await setStateAsync(P + 'Allgemein.Aktualisiert', jetzt.toLocaleString('de-DE'), true);
        await setStateAsync(P + 'Allgemein.Verbindung', true, true);
        if (fehlerZaehler > 0) { await setStateAsync(P + 'Allgemein.Fehler', '', true); fehlerZaehler = 0; }
    } catch (e) {
        fehlerZaehler++;
        await setStateAsync(P + 'Allgemein.Verbindung', false, true);
        await setStateAsync(P + 'Allgemein.Fehler', new Date().toLocaleString('de-DE') + ': ' + e.message, true);
        if (fehlerZaehler === 1 || fehlerZaehler % 30 === 0) log('Schwiegereltern_CCU: Abfrage der CCU3 fehlgeschlagen (' + fehlerZaehler + 'x): ' + e.message, 'warn');
    }
}
async function pollMaster() {
    try {
        for (const r of ROOMS) {
            const q = quelle(r);
            const m = parseStruct(await rpcCall(q.url, 'getParamset', [q.addr, 'MASTER']));
            if (Object.keys(m).length < 100) throw new Error('MASTER unvollstaendig fuer ' + q.addr);
            master[r.id] = m;
            await aktualisiereProfil(r);
        }
    } catch (e) {
        log('Schwiegereltern_CCU: MASTER (Wochenprofile) nicht lesbar: ' + e.message, 'warn');
    }
}
async function pollDevices() {
    let ok = 0;
    for (const d of DEVICES) {
        try {
            const base = P + 'Geraete.' + d.adr + '.';
            const v0 = parseStruct(await rpcCall(CCU_DEVICES, 'getParamset', [d.adr + ':0', 'VALUES']));
            if (v0.UNREACH === undefined) throw new Error('keine Werte');
            await setStateAsync(base + 'UNREACH', !!v0.UNREACH, true);
            await setStateAsync(base + 'LOW_BAT', !!v0.LOW_BAT, true);
            if (v0.OPERATING_VOLTAGE !== undefined) await setStateAsync(base + 'OPERATING_VOLTAGE', v0.OPERATING_VOLTAGE, true);
            if (v0.RSSI_DEVICE !== undefined) await setStateAsync(base + 'RSSI_DEVICE', v0.RSSI_DEVICE, true);
            await setStateAsync(base + 'Batterie_Status', batterieStatus(d.typ, v0.OPERATING_VOLTAGE, !!v0.LOW_BAT), true);
            if (d.fenster) {
                const v1 = parseStruct(await rpcCall(CCU_DEVICES, 'getParamset', [d.adr + ':1', 'VALUES']));
                if (v1.STATE !== undefined) await setStateAsync(base + 'STATE', v1.STATE ? 1 : 0, true);
            }
            ok++;
        } catch (e) {
            log('Schwiegereltern_CCU: Geraet ' + d.adr + ' nicht lesbar: ' + e.message, 'warn');
        }
    }
    await zaehleFenster();
    let gelb = 0, rot = 0;
    for (const d of DEVICES) { const s = await getStateAsync(P + 'Geraete.' + d.adr + '.Batterie_Status'); if (s && s.val === 1) gelb++; if (s && s.val === 2) rot++; }
    await setStateAsync(P + 'Allgemein.Batterie_gelb', gelb, true);
    await setStateAsync(P + 'Allgemein.Batterie_rot', rot, true);
    return ok;
}
async function zaehleFenster() {
    const ids = DEVICES.filter(d => d.fenster).map(d => P + 'Geraete.' + d.adr + '.STATE');
    let n = 0;
    for (const id of ids) { const s = await getStateAsync(id); if (s && Number(s.val) === 1) n++; }
    await setStateAsync(P + 'Allgemein.Fenster_offen', n, true);
}

// ===================== Bedienung =====================
const SOLL_MIN = 8, SOLL_MAX = 26, SOLL_SCHRITT = 0.5;
const SENDE_VERZOEGERUNG_MS = 3000, ENTSPERR_MS = 10000, MAX_BEFEHLE_10MIN = 20;
const pend = {};          // Raum -> { soll, timer }  (noch nicht gesendeter Sollwunsch)
const sendeLog = {};      // Raum -> Zeitstempel der letzten Schreibzugriffe
let entsperrTimer = null;
let protokollListe = [];

function fmt1(x) { return Number(x).toFixed(1).replace('.', ','); }
function uhrzeit() { return new Date().toLocaleTimeString('de-DE'); }

function rpcSetValue(url, addr, key, typ, val) {
    const v = typ === 'double' ? '<double>' + Number(val).toFixed(1) + '</double>'
            : typ === 'boolean' ? '<boolean>' + (val ? 1 : 0) + '</boolean>'
            : '<i4>' + Math.round(val) + '</i4>';
    const body = '<?xml version="1.0"?><methodCall><methodName>setValue</methodName><params>' +
        '<param><value><string>' + addr + '</string></value></param>' +
        '<param><value><string>' + key + '</string></value></param>' +
        '<param><value>' + v + '</value></param></params></methodCall>';
    return new Promise((resolve, reject) => {
        httpPost(url, body, { timeout: 20000, headers: { 'Content-Type': 'text/xml' } }, (err, res) => {
            if (err) return reject(new Error(String(err)));
            const txt = res && res.data !== undefined ? String(res.data) : '';
            if (txt.indexOf('<fault>') >= 0) return reject(new Error('CCU lehnt ab: ' + txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160)));
            if (txt.indexOf('<methodResponse>') < 0) return reject(new Error('keine Antwort der CCU'));
            resolve(txt);
        });
    });
}
async function schreibeProtokollHtml() {
    const html = protokollListe.slice(0, 6).map(e =>
        '<div style="font-size:14px;line-height:23px;color:#cfd6dc;white-space:nowrap;"><span style="color:#6d7780;">' + e.z + '</span>  <span style="color:' +
        (e.ok ? 'limegreen' : 'tomato') + ';">●</span>  <b>' + e.raum + '</b> · ' + e.text + '</div>').join('');
    await setStateAsync(P + 'Allgemein.Protokoll_HTML', html, true);
}
async function protokolliere(raum, text, ok) {
    protokollListe.unshift({ z: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }), raum, text, ok });
    protokollListe = protokollListe.slice(0, 40);
    await setStateAsync(P + 'Allgemein.Protokoll_JSON', JSON.stringify(protokollListe), true);
    await schreibeProtokollHtml();
    log('Schwiegereltern_CCU Bedienung: ' + raum + ': ' + text + (ok ? '' : ' (nicht ausgefuehrt)'), ok ? 'info' : 'warn');
}
async function sperrGrund() {
    if (!(await getStateAsync(P + 'Allgemein.Bedienung_erlaubt')).val) return 'Bedienung ist abgeschaltet';
    if (!(await getStateAsync(P + 'Allgemein.Entsperrt')).val) return 'gesperrt: erst das Schloss entsperren';
    if (!(await getStateAsync(P + 'Allgemein.Verbindung')).val) return 'CCU3 nicht erreichbar';
    return null;
}
function rateOk(raum) {
    const jetzt = Date.now();
    sendeLog[raum] = (sendeLog[raum] || []).filter(t => jetzt - t < 600000);
    if (sendeLog[raum].length >= MAX_BEFEHLE_10MIN) return false;
    sendeLog[raum].push(jetzt);
    return true;
}
async function status(r, text) { await setStateAsync(P + r.id + '.Stellen.Status', text, true); }

async function sendeSoll(r) {
    const p = pend[r.id];
    if (!p) return;
    delete pend[r.id];
    const q = quelle(r);
    try {
        if (!rateOk(r.id)) throw new Error('zu viele Befehle in 10 Minuten');
        await rpcSetValue(q.url, q.addr, 'SET_POINT_TEMPERATURE', 'double', p.soll);
        await status(r, 'Gesendet ' + uhrzeit() + ': Soll ' + fmt1(p.soll) + ' °C');
        await protokolliere(r.name, 'Soll auf ' + fmt1(p.soll) + ' °C gesetzt', true);
    } catch (e) {
        await status(r, 'Fehler: ' + e.message);
        await protokolliere(r.name, 'Soll ' + fmt1(p.soll) + ' °C: ' + e.message, false);
    }
    setTimeout(pollValues, 4000);
}
async function sollSchritt(r, wert) {
    const grund = await sperrGrund();
    if (grund) { await status(r, 'Nicht ausgeführt: ' + grund); await protokolliere(r.name, 'Soll-Schritt abgelehnt (' + grund + ')', false); return; }
    const delta = Number(wert) > 0 ? SOLL_SCHRITT : -SOLL_SCHRITT;
    const basis = pend[r.id] ? pend[r.id].soll : Number((await getStateAsync(P + r.id + '.Soll')).val);
    const neu = Math.round(Math.min(SOLL_MAX, Math.max(SOLL_MIN, basis + delta)) * 2) / 2;
    if (neu === basis) { await status(r, 'Grenze erreicht (' + SOLL_MIN + ' bis ' + SOLL_MAX + ' °C)'); return; }
    if (pend[r.id]) clearTimeout(pend[r.id].timer);
    pend[r.id] = { soll: neu, timer: setTimeout(() => { sendeSoll(r); }, SENDE_VERZOEGERUNG_MS) };
    await setStateAsync(P + r.id + '.Stellen.Wunsch', neu, true);
    await status(r, 'Wunsch ' + fmt1(neu) + ' °C, wird in 3 s gesendet');
}
async function sollZiel(r, wert) {
    const grund = await sperrGrund();
    if (grund) { await status(r, 'Nicht ausgeführt: ' + grund); await protokolliere(r.name, 'Soll-Ziel abgelehnt (' + grund + ')', false); return; }
    const ziel = Number(wert);
    if (!isFinite(ziel)) { await status(r, 'Ungültiger Zielwert'); return; }
    const neu = Math.round(Math.min(SOLL_MAX, Math.max(SOLL_MIN, ziel)) * 2) / 2;
    const basis = pend[r.id] ? pend[r.id].soll : Number((await getStateAsync(P + r.id + '.Soll')).val);
    if (neu === basis) { await status(r, 'Soll ist bereits ' + fmt1(neu) + ' °C'); return; }
    if (pend[r.id]) clearTimeout(pend[r.id].timer);
    pend[r.id] = { soll: neu, timer: setTimeout(() => { sendeSoll(r); }, SENDE_VERZOEGERUNG_MS) };
    await setStateAsync(P + r.id + '.Stellen.Wunsch', neu, true);
    await status(r, 'Wunsch ' + fmt1(neu) + ' °C (Regler), wird in 3 s gesendet');
}
const BEFEHLE = {
    auto:    { key: 'CONTROL_MODE', typ: 'int',     val: 0,    text: 'zurück auf Automatik (Wochenprofil)' },
    manuell: { key: 'CONTROL_MODE', typ: 'int',     val: 1,    text: 'auf dauerhaft Manuell gestellt' },
    boost:   { key: 'BOOST_MODE',   typ: 'boolean', val: true, text: 'Boost gestartet (5 Minuten)' },
    profil1: { key: 'ACTIVE_PROFILE', typ: 'int',   val: 1,    text: 'Wochenprofil 1 gewählt' },
    profil2: { key: 'ACTIVE_PROFILE', typ: 'int',   val: 2,    text: 'Wochenprofil 2 gewählt' },
    profil3: { key: 'ACTIVE_PROFILE', typ: 'int',   val: 3,    text: 'Wochenprofil 3 gewählt' }
};
async function befehl(r, name) {
    const b = BEFEHLE[String(name)];
    if (!b) { await status(r, 'Unbekannter Befehl: ' + String(name).slice(0, 20)); return; }
    const grund = await sperrGrund();
    if (grund) { await status(r, 'Nicht ausgeführt: ' + grund); await protokolliere(r.name, String(name) + ' abgelehnt (' + grund + ')', false); return; }
    const q = quelle(r);
    try {
        if (!rateOk(r.id)) throw new Error('zu viele Befehle in 10 Minuten');
        await rpcSetValue(q.url, q.addr, b.key, b.typ === 'double' ? 'double' : b.typ === 'boolean' ? 'boolean' : 'int', b.val);
        await status(r, 'Gesendet ' + uhrzeit() + ': ' + b.text);
        await protokolliere(r.name, b.text, true);
    } catch (e) {
        await status(r, 'Fehler: ' + e.message);
        await protokolliere(r.name, String(name) + ': ' + e.message, false);
    }
    setTimeout(pollValues, 4000);
}
function richteBedienungEin() {
    for (const r of ROOMS) {
        on({ id: P + r.id + '.Stellen.Soll_Schritt', ack: false, change: 'any' }, o => { sollSchritt(r, o.state.val); });
        on({ id: P + r.id + '.Stellen.Soll_Ziel',    ack: false, change: 'any' }, o => { sollZiel(r, o.state.val); });
        on({ id: P + r.id + '.Stellen.Befehl',       ack: false, change: 'any' }, o => { befehl(r, o.state.val); });
    }
    on({ id: P + 'Allgemein.Entsperrt', ack: false, change: 'any' }, async o => {
        if (o.state.val === true) {
            await setStateAsync(P + 'Allgemein.Entsperrt', true, true);
            if (entsperrTimer) clearTimeout(entsperrTimer);
            entsperrTimer = setTimeout(() => { setState(P + 'Allgemein.Entsperrt', false, true); }, ENTSPERR_MS);
        } else {
            if (entsperrTimer) clearTimeout(entsperrTimer);
            await setStateAsync(P + 'Allgemein.Entsperrt', false, true);
        }
    });
}

(async () => {
    await init();
    try { protokollListe = JSON.parse((await getStateAsync(P + 'Allgemein.Protokoll_JSON')).val || '[]'); } catch (e) { protokollListe = []; }
    if (protokollListe.length) await schreibeProtokollHtml();
    if (!protokollListe.length) await setStateAsync(P + 'Allgemein.Protokoll_HTML', '<div style="font-size:14px;line-height:23px;color:#6d7780;">noch keine Bedienung</div>', true);
    await pollMaster();
    await pollValues();
    await pollDevices();
    schedule('*/1 * * * *', pollValues);
    setInterval(pollDevices, 30000);
    schedule('3,13,23,33,43,53 * * * *', pollMaster);
    richteBedienungEin();
    log('Schwiegereltern_CCU gestartet (Bedienung gesperrt bis entsperrt): ' + ROOMS.map(r => r.group || r.device).join(', '), 'info');
})();