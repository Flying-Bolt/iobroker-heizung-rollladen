'use strict';
// ============================================================================
// Heizung.Thermostat_Waechter  (12.10.2026, Claude)
// Ueberwacht alle Homematic-IP-Heizkoerperthermostate (HmIP-eTRV*) beider CCUs:
//   Haus-CCU (hm-rpc.0): je Geraet 1.VALVE_STATE, 1.LEVEL, 0.LOW_BAT, 0.UNREACH, 0.CONFIG_PENDING
//   Schwiegereltern (hm-rpc.1 kennt VALVE_STATE nicht): Werte aus dem Skript Schwiegereltern_CCU
//     (0_userdata.0.Schwiegereltern.<Raum>.Ventilzustand/Ventil, Geraete.<adr>.UNREACH/LOW_BAT)
// Nur lesend an den Geraeten. Schreibt NUR unter 0_userdata.0.Heizung.* (fuer vis-2) und ins Log.
// VALVE_STATE (aus common.states des Adapters belegt): 0 STATE_NOT_AVAILABLE, 1 RUN_TO_START, 2 WAIT_FOR_ADAPTION,
//   3 ADAPTION_IN_PROGRESS, 4 ADAPTION_DONE (= einziger OK-Wert), 5 TOO_TIGHT, 6 ADJUSTMENT_TOO_BIG,
//   7 ADJUSTMENT_TOO_SMALL, 8 ERROR_POSITION.
// Benachrichtigung: per Telegram an alle eingetragenen Empfänger (telegram.0, chatIds siehe TELEGRAM_CHATS; seit 12.10.2026) bei neuem Fehler, bei Entwarnung und taeglich 09:00 als Erinnerung.
// vis-2: Seite fertig als HTML in 0_userdata.0.Heizung.Seite (View main#Thermostate), Sammel-Banner in 0_userdata.0.Heizung.Banner (leer wenn alles OK).
// ============================================================================
const P = '0_userdata.0.Heizung.';
const TELEGRAM_CHATS = ['CHAT_ID_1', 'CHAT_ID_2', 'CHAT_ID_3'];  // Besitzer, Empfänger 2, Empfänger 3 (alle drei im telegram.0-Nutzerverzeichnis, 12.10.2026)
const NOTIFY = function (text) { TELEGRAM_CHATS.forEach(function (id) { try { sendTo('telegram.0', 'send', { text: text, chatId: id }); } catch (e) { log('Telegram an ' + id + ' fehlgeschlagen: ' + e.message, 'warn'); } }); };
const GRACE_MIN = 30;                // Adaptions-Zwischenzustaende 1/3 und UNREACH zaehlen erst nach so vielen Minuten als Fehler
const PRUEF_INTERVALL_MIN = 5;       // zusaetzlich zur Reaktion auf Aenderungen (fuer die Karenzzeiten)

const THERMOSTATE = [
    // key, Anzeigename, Standort, Datenpunkte
    { key: 'Haus_Abstellraum',  name: 'Abstellraum',      ort: 'Haus', adr: '00AB0000000021' },
    { key: 'Haus_Gaeste',       name: 'Gäste',            ort: 'Haus', adr: '00AB0000000027' },
    { key: 'Haus_Bad',          name: 'Bad',              ort: 'Haus', adr: '00AB0000000040' },
    { key: 'Haus_Buero',        name: 'Büro',             ort: 'Haus', adr: '00AB0000000037' },
    { key: 'Haus_Gym',          name: 'Gym',              ort: 'Haus', adr: '00AB0000000038' },
    { key: 'Haus_Eingang',      name: 'Eingang',          ort: 'Haus', adr: '00AB0000000018' },
    { key: 'Haus_Kueche',       name: 'Küche',            ort: 'Haus', adr: '00AB0000000032' },
    { key: 'Haus_Wohnzimmer_1', name: 'Wohnzimmer 1',     ort: 'Haus', adr: '00AB0000000024' },
    { key: 'Haus_Wohnzimmer_2', name: 'Wohnzimmer 2',     ort: 'Haus', adr: '00AB0000000022' },
    { key: 'Haus_Keller',       name: 'Keller',           ort: 'Haus', adr: '00AB0000000019' },
    { key: 'SW_Wohnzimmer',     name: 'Wohnzimmer (Schwiegereltern)', ort: 'Schwiegereltern', raum: 'Wohnzimmer', adr: '00AB0000000008' },
    { key: 'SW_Kueche',         name: 'Küche (Schwiegereltern)',      ort: 'Schwiegereltern', raum: 'Kueche',     adr: '00AB0000000010' },
    { key: 'SW_Keller',         name: 'Keller (Schwiegereltern)',     ort: 'Schwiegereltern', raum: 'Keller',     adr: '00AB0000000012' }
];
for (const t of THERMOSTATE) {
    if (t.ort === 'Haus') {
        const b = 'hm-rpc.0.' + t.adr + '.';
        t.oid = { vs: b + '1.VALVE_STATE', level: b + '1.LEVEL', ist: b + '1.ACTUAL_TEMPERATURE', soll: b + '1.SET_POINT_TEMPERATURE',
                  lowbat: b + '0.LOW_BAT', unreach: b + '0.UNREACH', confpend: b + '0.CONFIG_PENDING' };
    } else {
        const r = '0_userdata.0.Schwiegereltern.' + t.raum + '.', g = '0_userdata.0.Schwiegereltern.Geraete.' + t.adr + '.';
        t.oid = { vs: r + 'Ventilzustand', level: r + 'Ventil', ist: r + 'Ist', soll: r + 'Soll', lowbat: g + 'LOW_BAT', unreach: g + 'UNREACH', confpend: null };
    }
}

// Klartext und Einstufung je VALVE_STATE: [Text deutsch, Farbe, sofort Fehler?]
const VS = {
    0: ['Status nicht verfügbar',        'orange', false],
    1: ['Adapterlauf steht an',          'orange', false],
    2: ['Adapterlauf fehlt',             'orange', true],
    3: ['Adapterlauf läuft',             'orange', false],
    4: ['OK',                            'green',  false],
    5: ['Ventil schwergängig',           'red',    true],
    6: ['Ventilhub zu groß',             'red',    true],
    7: ['Ventilhub zu klein',            'red',    true],
    8: ['Ventilposition fehlerhaft',     'red',    true]
};
const VS_NAME = ['STATE_NOT_AVAILABLE', 'RUN_TO_START', 'WAIT_FOR_ADAPTION', 'ADAPTION_IN_PROGRESS', 'ADAPTION_DONE', 'TOO_TIGHT', 'ADJUSTMENT_TOO_BIG', 'ADJUSTMENT_TOO_SMALL', 'ERROR_POSITION'];

const seit = {};         // key -> { vs: ts, unreach: ts }  Zeitpunkt, seit dem der Zustand besteht
const letzteMeldung = {}; // key -> Text der letzten Meldung (nur bei Aenderung loggen)
let timer = null;

function val(oid) { if (!oid) return undefined; const s = getState(oid); return s && s.val !== null ? s.val : undefined; }

async function anlegen() {
    const defs = [
        ['ThermostatFehler',     'boolean', 'indicator.alarm', 'true, sobald ein Thermostat nicht OK ist',          false],
        ['ThermostatFehlerText', 'string',  'text',            'Klartext, z. B. "Bad: Adapterlauf fehlt, Büro: Batterie schwach"', ''],
        ['AnzahlFehler',         'number',  'value',           'Anzahl Thermostate mit Fehler/Warnung',               0],
        ['AnzahlThermostate',    'number',  'value',           'Anzahl überwachter Thermostate',                      0],
        ['Stand',                'string',  'text',            'Zeitpunkt der letzten Prüfung',                       ''],
        ['Seite',                'string',  'html',            'Fertige HTML-Seite für die View main#Thermostate',    ''],
        ['Banner',               'string',  'html',            'Sammel-Hinweis als HTML (leer, wenn alles OK) – in jede View einbaubar', ''],
        ['TelegramTest',         'boolean', 'button',          'Auf true setzen: sendet eine Test-Nachricht per Telegram', false]
    ];
    for (const [id, type, role, name, def] of defs)
        if (!existsState(P + id)) await createStateAsync(P + id, def, { name: 'Heizung: ' + name, type, role, read: true, write: id === 'TelegramTest' });
    for (const t of THERMOSTATE) {
        const base = P + t.key + '.';
        for (const [id, type, role, unit, name, def] of [
            ['Name',        'string',  'text',           '',  'Anzeigename', t.name],
            ['Status',      'string',  'text',           '',  'Status im Klartext (OK, Adapterlauf fehlt, ...)', ''],
            ['Statuscode',  'number',  'value',          '',  'VALVE_STATE (4 = OK)', -1],
            ['Farbe',       'string',  'text',           '',  'green / orange / red', 'orange'],
            ['OK',          'boolean', 'indicator',      '',  'true = Ventilstatus OK, erreichbar, Batterie in Ordnung', false],
            ['Ventil',      'number',  'value.valve',    '%', 'Ventilöffnung (LEVEL)', 0],
            ['Ist',         'number',  'value.temperature', '°C', 'Isttemperatur', 0],
            ['Soll',        'number',  'value.temperature', '°C', 'Solltemperatur', 0],
            ['Batterie',    'boolean', 'indicator.lowbat', '', 'true = Batterie schwach (LOW_BAT)', false],
            ['Erreichbar',  'boolean', 'indicator.reachable', '', 'false = nicht erreichbar (UNREACH)', true],
            ['Standort',    'string',  'text',           '',  'Haus oder Schwiegereltern', t.ort]
        ]) {
            if (!existsState(base + id)) await createStateAsync(base + id, def, { name: t.name + ': ' + name, type, role, unit: unit || undefined, read: true, write: false });
        }
        await setStateAsync(base + 'Name', t.name, true); await setStateAsync(base + 'Standort', t.ort, true);
    }
    await setStateAsync(P + 'AnzahlThermostate', THERMOSTATE.length, true);
}


// ---------- HTML fuer vis-2 (nur Inline-Styles, keine geschachtelten Klammern -> vis-2-Bindungsparser) ----------
const FONT = "'Roboto Condensed','Arial Narrow',Arial,sans-serif";
const FARBE = { green: '#3ddc84', orange: '#f2a93b', red: '#ff5a4d' };
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function f1(v) { return v === undefined || v === null || isNaN(Number(v)) ? '–' : (Math.round(Number(v) * 10) / 10).toFixed(1).replace('.', ','); }
function renderBanner(fehler) {
    if (!fehler.length) return '';
    return '<div style="font-family:' + FONT + ';box-sizing:border-box;width:100%;padding:12px 20px;border-radius:12px;background:#3a1519;border:2px solid ' + FARBE.red + ';color:#ffffff;font-size:20px;font-weight:700;">'
        + '⚠ Heizung: ' + fehler.length + (fehler.length === 1 ? ' Thermostat braucht' : ' Thermostate brauchen') + ' Aufmerksamkeit'
        + '<div style="font-size:16px;font-weight:400;color:#f4c7c2;margin-top:4px;">' + esc(fehler.join(' · ')) + '</div></div>';
}
function karte(i, x, y) {
    const c = FARBE[i.farbe] || FARBE.orange; const bat = i.lb;
    const lv = i.level === null ? 0 : Math.max(0, Math.min(100, i.level));
    return '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:370px;height:176px;border-radius:16px;background:linear-gradient(160deg,#1b2127,#12161a);border:1px solid #2b333b;box-shadow:0 6px 18px rgba(0,0,0,0.4);overflow:hidden;">'
        + '<div style="position:absolute;left:0;top:0;width:370px;height:6px;background:' + c + ';"></div>'
        + '<div style="position:absolute;left:18px;top:18px;width:300px;font-size:24px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(i.t.name.replace(' (Schwiegereltern)', '')) + '</div>'
        + '<div style="position:absolute;right:16px;top:20px;font-size:22px;opacity:' + (bat ? '1' : '0.18') + ';color:' + (bat ? FARBE.red : '#9aa5ad') + ';" title="Batterie">' + (bat ? '🪫' : '🔋') + '</div>'
        + '<div style="position:absolute;left:18px;top:56px;width:334px;font-size:22px;font-weight:700;color:' + c + ';">● ' + esc(i.text) + '</div>'
        + '<div style="position:absolute;left:18px;top:92px;font-size:12px;letter-spacing:1.4px;color:#7f8b95;">IST</div>'
        + '<div style="position:absolute;left:18px;top:106px;font-size:34px;font-weight:700;line-height:38px;">' + f1(i.ist) + '<span style="font-size:16px;color:#9aa5ad;"> °C</span></div>'
        + '<div style="position:absolute;left:140px;top:92px;font-size:12px;letter-spacing:1.4px;color:#7f8b95;">SOLL</div>'
        + '<div style="position:absolute;left:140px;top:106px;font-size:34px;font-weight:700;line-height:38px;color:#cfd6dc;">' + f1(i.soll) + '<span style="font-size:16px;color:#9aa5ad;"> °C</span></div>'
        + '<div style="position:absolute;left:262px;top:92px;font-size:12px;letter-spacing:1.4px;color:#7f8b95;">VENTIL</div>'
        + '<div style="position:absolute;left:262px;top:106px;font-size:34px;font-weight:700;line-height:38px;color:#cfd6dc;">' + (i.level === null ? '–' : i.level) + '<span style="font-size:16px;color:#9aa5ad;"> %</span></div>'
        + '<div style="position:absolute;left:18px;top:154px;width:334px;height:6px;border-radius:3px;background:#252c33;"><div style="width:' + lv + '%;height:6px;border-radius:3px;background:' + c + ';"></div></div>'
        + '</div>';
}
function renderSeite(infos, fehler, stand) {
    const n = infos.length, gut = infos.filter(i => i.ok).length;
    const o = [];
    o.push('<div style="position:relative;width:1540px;height:1040px;font-family:' + FONT + ';color:#e9eef2;">');
    o.push('<div style="position:absolute;left:0;top:10px;font-size:46px;font-weight:700;letter-spacing:1px;">Heizkörper-Thermostate</div>');
    o.push('<div style="position:absolute;left:2px;top:62px;font-size:17px;color:#8a96a0;letter-spacing:0.5px;">Adapterstatus, Batterie und Erreichbarkeit · Haus und Schwiegereltern</div>');
    o.push('<div style="position:absolute;right:0;top:50px;font-size:14px;color:#8a96a0;">Stand ' + esc(stand) + '</div>');
    o.push('<div style="position:absolute;left:0;top:90px;width:1540px;height:2px;background:linear-gradient(90deg,#f2a93b,#ff5a4d,#b07be0,rgba(176,123,224,0));"></div>');
    const bc = fehler.length ? FARBE.red : FARBE.green;
    o.push('<div style="position:absolute;left:0;top:108px;width:1540px;box-sizing:border-box;padding:12px 20px;border-radius:12px;background:' + (fehler.length ? '#3a1519' : '#12261a') + ';border:2px solid ' + bc + ';font-size:22px;font-weight:700;">'
        + (fehler.length ? '⚠ ' + fehler.length + (fehler.length === 1 ? ' Thermostat braucht' : ' Thermostate brauchen') + ' Aufmerksamkeit<div style="font-size:16px;font-weight:400;color:#f4c7c2;margin-top:4px;">' + esc(fehler.join(' · ')) + '</div>'
                         : '<span style="color:' + FARBE.green + ';">●</span> Alle ' + n + ' Thermostate in Ordnung <span style="font-size:15px;font-weight:400;color:#8a96a0;">(' + gut + ' von ' + n + ' OK)</span>') + '</div>');
    const gruppen = [['HAUS', infos.filter(i => i.t.ort === 'Haus')], ['SCHWIEGERELTERN', infos.filter(i => i.t.ort !== 'Haus')]];
    let y = fehler.length ? 210 : 190;
    for (const [titel, liste] of gruppen) {
        o.push('<div style="position:absolute;left:0;top:' + y + 'px;font-size:18px;letter-spacing:4px;color:#aeb9c3;">' + titel + ' · ' + liste.length + ' Thermostate</div>');
        y += 36;
        liste.forEach((i, k) => { o.push(karte(i, (k % 4) * 390, y + Math.floor(k / 4) * 196)); });
        y += Math.ceil(liste.length / 4) * 196 + 24;
    }
    o.push('<div style="position:absolute;left:0;top:' + (y + 6) + 'px;width:1540px;border-top:1px solid #232d36;padding-top:12px;font-size:13px;color:#6f7b86;line-height:19px;">'
        + '<span style="color:' + FARBE.green + ';">● grün</span> = Adapterlauf abgeschlossen (OK) · <span style="color:' + FARBE.orange + ';">● orange</span> = Adapterlauf fehlt, steht an oder läuft; kurzer Funkausfall · <span style="color:' + FARBE.red + ';">● rot</span> = Ventil schwergängig/Hub/Position fehlerhaft oder nicht erreichbar. '
        + 'Batterie-Symbol rot = Batterie schwach. Meldung per Telegram bei neuem Fehler und täglich 09:00 als Erinnerung; Adapterlauf-Zwischenzustände und Funkausfälle zählen erst nach 30 Minuten. Schwiegereltern-Werte sind Raumwerte der CCU (ein Wert je Raum).</div>');
    o.push('</div>');
    return o.join('');
}

async function pruefen() {
    timer = null;
    const jetzt = Date.now(); const fehler = []; const infos = []; let n = 0;
    for (const t of THERMOSTATE) {
        const o = t.oid, base = P + t.key + '.';
        const vsRaw = val(o.vs), vs = vsRaw === undefined ? -1 : Number(vsRaw);
        const un = val(o.unreach) === true, lb = val(o.lowbat) === true, cp = val(o.confpend) === true;
        let level = val(o.level); if (level !== undefined && t.ort === 'Haus' && level <= 1.0) level = level * 100;
        const s = seit[t.key] = seit[t.key] || {};
        if (vs !== 4 && vs !== -1) { if (!s.vs || s.vsCode !== vs) { s.vs = jetzt; s.vsCode = vs; } } else { s.vs = null; s.vsCode = null; }
        if (un) { if (!s.un) s.un = jetzt; } else s.un = null;

        let text, farbe, istFehler = false; const probleme = [];
        if (vs === -1) { text = 'Status unbekannt'; farbe = 'orange'; }
        else {
            const [tx, fb, sofort] = VS[vs] || ['Unbekannter Status ' + vs, 'red', true];
            text = tx; farbe = fb;
            if (vs !== 4) {
                const minuten = (jetzt - s.vs) / 60000;
                if (sofort || minuten >= GRACE_MIN) { istFehler = true; probleme.push(tx + ' (' + (VS_NAME[vs] || vs) + ')'); }
            }
        }
        if (un) {
            const minuten = (jetzt - s.un) / 60000;
            if (minuten >= GRACE_MIN) { istFehler = true; probleme.push('nicht erreichbar'); farbe = 'red'; text = 'Nicht erreichbar'; }
            else if (farbe === 'green') { farbe = 'orange'; text = 'kurz nicht erreichbar'; }
        }
        if (lb) { istFehler = true; probleme.push('Batterie schwach'); }
        if (cp) probleme.push('Konfiguration ausstehend');   // nur Hinweis, kein Fehler (kommt nach Aenderungen kurz vor)
        const ok = vs === 4 && !un && !lb;
        n++;
        if (istFehler) fehler.push(t.name + ': ' + probleme.join(', '));
        infos.push({ t, text, farbe, ok, lb, un, istFehler, level: level === undefined ? null : Math.round(Number(level)), ist: val(o.ist), soll: val(o.soll) });

        const set = async (id, v) => { const a = getState(base + id); if (!a || a.val !== v) await setStateAsync(base + id, v, true); };
        await set('Status', text + (lb ? ' · Batterie schwach' : '')); await set('Statuscode', vs); await set('Farbe', farbe); await set('OK', ok);
        await set('Batterie', lb); await set('Erreichbar', !un);
        if (level !== undefined) await set('Ventil', Math.round(Number(level)));
        const ist = val(o.ist), soll = val(o.soll);
        if (ist !== undefined) await set('Ist', Math.round(Number(ist) * 10) / 10);
        if (soll !== undefined) await set('Soll', Math.round(Number(soll) * 10) / 10);

        const meldung = istFehler ? probleme.join(', ') : '';
        if (meldung !== (letzteMeldung[t.key] || '')) {
            if (meldung) {
                log('Thermostat ' + t.name + ' (' + t.adr + '): ' + meldung, 'warn');
                if (NOTIFY) { try { NOTIFY('⚠️ Heizung – ' + t.name + ': ' + meldung); } catch (e) { log('Benachrichtigung fehlgeschlagen: ' + e.message, 'warn'); } }
            } else if (letzteMeldung[t.key]) {
                log('Thermostat ' + t.name + ' (' + t.adr + '): wieder in Ordnung', 'info');
                if (NOTIFY) { try { NOTIFY('✅ Heizung – ' + t.name + ': wieder in Ordnung'); } catch (e) { /* ignorieren */ } }
            }
            letzteMeldung[t.key] = meldung;
        }
    }
    const txt = fehler.join(', ');
    const a = getState(P + 'ThermostatFehlerText');
    if (!a || a.val !== txt) await setStateAsync(P + 'ThermostatFehlerText', txt, true);
    await setStateAsync(P + 'ThermostatFehler', fehler.length > 0, true);
    await setStateAsync(P + 'AnzahlFehler', fehler.length, true);
    const stand = new Date().toLocaleString('de-DE');
    await setStateAsync(P + 'Stand', stand, true);
    const seite = renderSeite(infos, fehler, stand);
    const sa = getState(P + 'Seite'); if (!sa || sa.val !== seite) await setStateAsync(P + 'Seite', seite, true);
    const banner = renderBanner(fehler);
    const ba = getState(P + 'Banner'); if (!ba || ba.val !== banner) await setStateAsync(P + 'Banner', banner, true);
}
function planen() { if (!timer) timer = setTimeout(pruefen, 1500); }

(async () => {
    await anlegen();
    const ids = [];
    for (const t of THERMOSTATE) for (const k of ['vs', 'level', 'lowbat', 'unreach', 'confpend']) if (t.oid[k]) ids.push(t.oid[k]);
    for (const id of ids) on({ id, change: 'any' }, planen);
    await pruefen();
    schedule('*/' + PRUEF_INTERVALL_MIN + ' * * * *', pruefen);
    schedule('0 9 * * *', () => {          // taegliche Erinnerung, solange ein Fehler besteht
        const t = getState(P + 'ThermostatFehlerText'), f = getState(P + 'ThermostatFehler');
        if (f && f.val === true) { try { NOTIFY('⚠️ Heizung (Erinnerung): ' + t.val); } catch (e) { log('Erinnerung fehlgeschlagen: ' + e.message, 'warn'); } }
    });
    on({ id: P + 'TelegramTest', change: 'any', ack: false }, async obj => {
        if (obj.state.val !== true) return;
        try { NOTIFY('🤖 Thermostat-Wächter: Test – Telegram-Meldungen sind eingerichtet (' + THERMOSTATE.length + ' Thermostate überwacht).'); log('Telegram-Test gesendet'); } catch (e) { log('Telegram-Test fehlgeschlagen: ' + e.message, 'warn'); }
        await setStateAsync(P + 'TelegramTest', false, true);
    });
    const fb = getState(P + 'AnzahlFehler').val;
    log('Thermostat_Waechter gestartet: ' + THERMOSTATE.length + ' Thermostate, ' + fb + ' mit Fehler/Warnung' + ' (Telegram an ' + TELEGRAM_CHATS.length + ' Empfaenger)');
})();