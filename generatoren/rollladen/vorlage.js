'use strict';
// ============================================================================
// Schwiegereltern_Rollladen  (02.10.2026, Claude) (Dummy-Modus ohne Aktor, mit Aktor echte Fahrt)
// Rollladensteuerung fuer das Haus der Schwiegereltern (CCU3 192.168.1.99) mit ZEITPLAN: je Rollladen EINMAL pro Tag hoch
// und EINMAL runter, Uhrzeiten in der View einstellbar. Datenpunkte: 0_userdata.0.Rollladen_Schwiegereltern.<Raum>.*
//   Position 0..100 % (0 = zu, 100 = ganz offen, wie LEVEL der HmIP-Rollladenaktoren), Ziel, Fahrt (-1 zu, 0 steht, 1 auf), Status
//   Auto (Zeitplan an/aus), Hoch_Min / Runter_Min (Minuten seit Mitternacht), Hoch_Text / Runter_Text (HH:MM), Naechste, Heute
// Befehle (nur nach Entsperren, 60 s): Befehl = auf | zu | stopp | z0 z25 z50 z75 z100 | auto_an | auto_aus;
//   Hoch_Schritt / Runter_Schritt = Minuten-Aenderung (+5, -30 ...); Allgemein.Alle_Befehl = auf | zu | stopp
// OHNE Eintrag in AKTOR wird die Fahrt SIMULIERT (30 s). Mit Eintrag werden Befehle ueber XML-RPC an den echten Aktor gesendet
// (Port 2010 der CCU3, nicht ueber ioBroker-Objekte) und dessen Position gelesen. Der Weg "echter Aktor" ist im Betrieb erprobt (HmIP-BROLL/-BROLL-2, Kanal 4 = SHUTTER_VIRTUAL_RECEIVER).
//   AKTOR = { 'Wohnzimmer': { adr: '<Geraeteadresse>:<Kanal mit LEVEL>' } }   (Kanal mit finde_level.py ermitteln)
// Der Zeitplan laeuft HIER (ioBroker-Rechner), nicht in der CCU: faellt der Tunnel oder ioBroker-Rechner zur Zeit aus, wird innerhalb von 60 Minuten nachgeholt.
// ============================================================================
const P = '0_userdata.0.Rollladen_Schwiegereltern.';
const CCU = 'http://192.168.1.99:2010/';
const ROOMS = /*ROOMS*/;
const AKTOR = {
    // 'Wohnzimmer': { adr: '00AB0000000001:4' },
    'Wohnzimmer': { adr: '00AB0000000002:4' },      // HmIP-BROLL-2, Wohnzimmerfenster (angelernt 03.10.2026; Funk schwach, -94 dBm)
    'Terrasse': { adr: '00AB0000000003:4' },      // HmIP-BROLL-2, Terrassentuer Wohnzimmer (angelernt 03.10.2026; Funk schwach, -95 dBm)
    'Kueche': { adr: '00AB0000000004:4' },      // HmIP-BROLL-2, Kuechenfenster (angelernt 03.10.2026; Funk gut, -74 dBm)
    'Bad': { adr: '00AB0000000005:4' },      // HmIP-BROLL, Badezimmer 1. OG (angelernt 03.10.2026; Kanal 4 = SHUTTER_VIRTUAL_RECEIVER)
    'Schlafzimmer': { adr: '00AB0000000006:4', max: 75 },      // HmIP-BROLL-2, Schlafzimmer 1. OG (angelernt 09.10.2026; Funk schwach, -94 dBm; ersetzt den Dummy-Raum Keller)
};
const FAHRZEIT_S = 30, SCHRITT = 100 / FAHRZEIT_S, NACHHOL_MIN = 60, ENTSPERR_MS = 60000, MAXPROT = 40;
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
            ['Hoch_Schritt', 'number', 'value', 'Befehl: Hochfahrzeit um n Minuten aendern', 0, true],
            ['Runter_Schritt', 'number', 'value', 'Befehl: Runterfahrzeit um n Minuten aendern', 0, true],
            ['Letzte_Hoch', 'string', 'text', 'Datum des letzten Hochfahrens (Zeitplan)', '', false],
            ['Letzte_Runter', 'string', 'text', 'Datum des letzten Runterfahrens (Zeitplan)', '', false],
            ['Naechste', 'string', 'text', 'Naechste geplante Aktion', 'Automatik aus', false],
            ['Heute', 'string', 'text', 'Was heute vom Zeitplan erledigt ist', '', false],
            ['Meldung', 'string', 'text', 'Ergebnis des letzten Befehls', 'Bereit', false]
        ]) {
            const full = P + r.id + '.' + id;
            if (!existsState(full)) await createStateAsync(full, def, { name: r.name + ': ' + name, type, role, read: true, write: wr });
        }
        await setStateAsync(P + r.id + '.Simuliert', simuliert(r), true);
        await setStateAsync(P + r.id + '.Hoch_Text', hhmm(Number(await get(P + r.id + '.Hoch_Min'))), true);
        await setStateAsync(P + r.id + '.Runter_Text', hhmm(Number(await get(P + r.id + '.Runter_Min'))), true);
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

// ---------- Fahren ----------
async function setzeFahrt(r, f) {
    if ((await get(P + r.id + '.Fahrt')) !== f) { await setStateAsync(P + r.id + '.Fahrt', f, true); await setStateAsync(P + r.id + '.Status', f > 0 ? 'fährt auf' : f < 0 ? 'fährt zu' : 'steht', true); }
}
async function setzeZiel(r, wert, quelle) {
    const z = Math.max(0, Math.min((AKTOR[r.id] && AKTOR[r.id].max) || 100, Math.round(Number(wert))));      // max = Obergrenze je Rollladen (Schlafzimmer 75 %, Besitzer 10.10.2026)
    await setStateAsync(P + r.id + '.Ziel', z, true);
    if (!simuliert(r)) { try { await aktorLevel(r, z); letzteAenderung[r.id] = Date.now(); } catch (e) { await meldung(r, 'Fehler: ' + e.message); await logge(r.name, quelle + ': ' + e.message, false); return false; } }
    return true;
}
async function fahre(r, b, quelle) {
    if (b === 'auf') return setzeZiel(r, 100, quelle);
    if (b === 'zu') return setzeZiel(r, 0, quelle);
    if (/^z(0|25|50|75|100)$/.test(b)) return setzeZiel(r, Number(b.slice(1)), quelle);
    if (b === 'stopp') {
        await setStateAsync(P + r.id + '.Ziel', Math.round(Number(await get(P + r.id + '.Position'))), true);
        if (!simuliert(r)) { try { await aktorStop(r); } catch (e) { await meldung(r, 'Fehler: ' + e.message); return false; } }
        return true;
    }
    return false;
}
const BEFEHLTEXT = { auf: 'hochgefahren', zu: 'runtergefahren', stopp: 'angehalten', z0: 'auf 0 % gefahren', z25: 'auf 25 % gefahren', z50: 'auf 50 % gefahren', z75: 'auf 75 % gefahren', z100: 'auf 100 % gefahren' };

// ---------- Zeitplan ----------
async function zeitSchritt(r, art, delta) {
    if (await gesperrt()) { await meldung(r, 'Nicht ausgeführt: gesperrt – erst Entsperren'); await logge(r.name, art + '-Zeit ändern abgelehnt (gesperrt)', false); return; }
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
    const erledigt = d => String(d).startsWith(h);
    const stat = (done, t) => done === h ? '✓ ' + hhmm(t) : done === h + '*' ? 'übersprungen (' + hhmm(t) + ' schon vorbei)' : n < t ? 'ausstehend ' + hhmm(t) : 'nicht ausgeführt';
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
                if (!String(await get(P + r.id + '.' + key)).startsWith(h) && n >= t && n <= t + NACHHOL_MIN) {
                    await setStateAsync(P + r.id + '.' + key, h, true);       // vorher markieren: nur einmal je Tag
                    const ok = await fahre(r, bef, 'Zeitplan');
                    const verspaetet = n - t > 2 ? ' (nachgeholt, geplant ' + hhmm(t) + ')' : '';
                    await meldung(r, ok ? 'Zeitplan: ' + BEFEHLTEXT[bef] + ' ' + hhmm(n) : 'Zeitplan: Fehler');
                    if (ok) await logge(r.name, 'Zeitplan: ' + BEFEHLTEXT[bef] + verspaetet, true);
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
    await pruefeZeitplan();
    setInterval(takt, 1000);
    setInterval(pruefeZeitplan, 20000);
    log('Schwiegereltern_Rollladen gestartet (' + ROOMS.length + ' Rollladen, ' + ROOMS.filter(simuliert).length + ' simuliert, Zeitplan: einmal hoch, einmal runter)', 'info');
})();
