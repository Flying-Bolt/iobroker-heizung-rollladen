'use strict';
// ============================================================================
// Batterien_Uebersicht (02.10.2026, Claude)
// Batterieampel aller batteriebetriebenen Geraete BEIDER CCU3 (Haus 192.168.1.99, Schwiegereltern 192.168.1.99).
// Liest je Geraet Kanal 0 (OPERATING_VOLTAGE, LOW_BAT, UNREACH, RSSI_DEVICE) per XML-RPC (nur lesend), alle 5 Minuten.
// Ampel: ROT = die Zentrale meldet LOW_BAT oder weniger als 1,10 V je Zelle; GELB = weniger als 1,25 V je Zelle; GRUEN sonst.
// Zellen je Typ: Fensterkontakt HmIP-SWDO 1, Tuerschloss HmIP-DLD 3, alle anderen 2 (Heizkoerperthermostate, Wandthermostate, Melder).
// Die Geraeteliste ist feststehend (aus der Erhebung vom 02.10.2026); ein neues Batteriegeraet muss in CCUS ergaenzt werden.
// Letzte Meldung je Geraet: Zeitstempel von OPERATING_VOLTAGE per ReGa (Port 8181, nur lesend), 1 Aufruf je Zentrale (12.10.2026).
//   Farbe der Spalte (nur Hinweis, nicht Ampel): bis 6 h grau, 6-24 h gelb, ueber 24 h rot.
// Datenpunkte: 0_userdata.0.Batterien.<Haus|Schwiegereltern>.* und ...Allgemein.*   (HTML-Tabellen fuer die View "Batterie")
// ============================================================================
const P = '0_userdata.0.Batterien.';
const CCUS = [
 {
  "id": "Haus",
  "host": "192.168.1.99",
  "geraete": [
   {
    "adr": "00AB0000000017",
    "typ": "HmIP-WTH-B-2",
    "ort": "Wohnzimmer",
    "bez": "Wandthermostat"
   },
   {
    "adr": "00AB0000000018",
    "typ": "HmIP-eTRV-B-2 R4M",
    "ort": "Eingang",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000015",
    "typ": "HmIP-DLD",
    "ort": "Haustür",
    "bez": "Türschloss"
   },
   {
    "adr": "00AB0000000019",
    "typ": "HmIP-eTRV-C",
    "ort": "Keller",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000020",
    "typ": "HMIP-SWDO",
    "ort": "Gäste",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000021",
    "typ": "HmIP-eTRV-2",
    "ort": "Abstellraum",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000022",
    "typ": "HmIP-eTRV-2",
    "ort": "Wohnzimmer",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000023",
    "typ": "HMIP-SWDO",
    "ort": "Bad",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000024",
    "typ": "HmIP-eTRV-2",
    "ort": "Wohnzimmer",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000025",
    "typ": "HMIP-SWDO",
    "ort": "Abstellraum",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000026",
    "typ": "HMIP-SWDO",
    "ort": "Eingang",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000027",
    "typ": "HmIP-eTRV-2",
    "ort": "Gäste",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000028",
    "typ": "HMIP-SWDO",
    "ort": "Küche",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000029",
    "typ": "HMIP-SWDO",
    "ort": "Wohnzimmer",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000030",
    "typ": "HMIP-SWDO",
    "ort": "Gym",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000031",
    "typ": "HmIP-STHD",
    "ort": "Keller",
    "bez": "Wandthermostat"
   },
   {
    "adr": "00AB0000000032",
    "typ": "HmIP-eTRV-C",
    "ort": "Küche",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000033",
    "typ": "HMIP-SWDO",
    "ort": "Gäste",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000014",
    "typ": "HmIP-SMI55-2",
    "ort": "Flur 2",
    "bez": "Bewegungsmelder"
   },
   {
    "adr": "00AB0000000034",
    "typ": "HmIP-STH",
    "ort": "Bad",
    "bez": "Wandthermostat"
   },
   {
    "adr": "00AB0000000035",
    "typ": "HMIP-SWDO",
    "ort": "Büro",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000036",
    "typ": "HMIP-SWDO",
    "ort": "Keller",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000037",
    "typ": "HmIP-eTRV-2",
    "ort": "Büro",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000038",
    "typ": "HmIP-eTRV-2",
    "ort": "Gym",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000039",
    "typ": "HMIP-SWDO",
    "ort": "Wohnzimmer",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000013",
    "typ": "HmIP-SMI55-2",
    "ort": "Flur 1",
    "bez": "Bewegungsmelder"
   },
   {
    "adr": "00AB0000000040",
    "typ": "HmIP-eTRV-2",
    "ort": "Bad",
    "bez": "Heizkörperthermostat"
   }
  ]
 },
 {
  "id": "Schwiegereltern",
  "host": "192.168.1.99",
  "geraete": [
   {
    "adr": "00AB0000000012",
    "typ": "HmIP-eTRV-2 I9F",
    "ort": "Keller",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000007",
    "typ": "HmIP-WTH-2",
    "ort": "Wohnzimmer",
    "bez": "Wandthermostat"
   },
   {
    "adr": "00AB0000000010",
    "typ": "HmIP-eTRV-B-2 R4M",
    "ort": "Küche",
    "bez": "Heizkörperthermostat"
   },
   {
    "adr": "00AB0000000009",
    "typ": "HmIP-SWDM-2",
    "ort": "Wohnzimmer",
    "bez": "Fensterkontakt (Terrassentür)"
   },
   {
    "adr": "00AB0000000011",
    "typ": "HmIP-SWDO-2",
    "ort": "Küche",
    "bez": "Fensterkontakt"
   },
   {
    "adr": "00AB0000000008",
    "typ": "HmIP-eTRV-B-2 R4M",
    "ort": "Wohnzimmer",
    "bez": "Heizkörperthermostat"
   }
  ]
 }
];
function zellen(typ) { const t = String(typ).toUpperCase(); if (t.indexOf('SWDO') >= 0) return 1; if (t.indexOf('DLD') >= 0) return 3; return 2; }
function batterieStatus(typ, volt, low) {
    if (low) return 2;
    if (!(volt > 0)) return -1;
    const pz = volt / zellen(typ);
    return pz < 1.1 ? 2 : pz < 1.25 ? 1 : 0;
}
function rpcGet(host, adr) {
    const body = '<?xml version="1.0"?><methodCall><methodName>getParamset</methodName><params><param><value><string>' + adr +
        ':0</string></value></param><param><value><string>VALUES</string></value></param></params></methodCall>';
    return new Promise((resolve, reject) => {
        httpPost('http://' + host + ':2010/', body, { timeout: 15000, headers: { 'Content-Type': 'text/xml' } }, (err, res) => {
            if (err) return reject(new Error(String(err)));
            const txt = res && res.data !== undefined ? String(res.data) : '';
            if (txt.indexOf('<methodResponse>') < 0 || txt.indexOf('<fault>') >= 0) return reject(new Error('keine gueltige Antwort fuer ' + adr));
            const out = {}; const re = /<member>\s*<name>([^<]+)<\/name>\s*<value>\s*<(\w+)>([^<]*)<\/\2>/g; let m;
            while ((m = re.exec(txt)) !== null) out[m[1]] = m[2] === 'boolean' ? m[3] === '1' : (m[2] === 'double' || m[2] === 'i4' || m[2] === 'int') ? Number(m[3]) : m[3];
            resolve(out);
        });
    });
}
function regaZeiten(host, adrs) {
    const sc = 'string l="' + adrs.join(',') + '"; string a; foreach(a, l.Split(",")){ object o=dom.GetObject("HmIP-RF."#a#":0.OPERATING_VOLTAGE"); if(o){WriteLine(a#"|"#o.Timestamp());}else{WriteLine(a#"|-");} }';
    return new Promise(resolve => {
        httpPost('http://' + host + ':8181/tclrega.exe', sc, { timeout: 20000 }, (err, res) => {
            const out = {};
            if (!err && res && res.data !== undefined) String(res.data).split(/\r?\n/).forEach(l => { const m = /^([0-9A-Fa-f]{14})\|(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/.exec(l.trim()); if (m) out[m[1]] = m[2]; });
            resolve(out);
        });
    });
}
function meldung(ts) {
    if (!ts) return '<span style="color:#6d7780;">–</span>';
    const d = new Date(ts.replace(' ', 'T')); const h = (Date.now() - d.getTime()) / 3600000;
    const c = h > 24 ? 'tomato' : h > 6 ? 'gold' : '#9aa5ad';
    const p = n => (n < 10 ? '0' : '') + n;
    return '<span style="color:' + c + ';">' + p(d.getDate()) + '.' + p(d.getMonth() + 1) + '. ' + p(d.getHours()) + ':' + p(d.getMinutes()) + '</span>';
}
const FARBE = { '0': 'limegreen', '1': 'gold', '2': 'tomato', '-1': '#6d7780' };
const TEXT = { '0': 'in Ordnung', '1': 'bald wechseln', '2': 'wechseln', '-1': 'unbekannt' };
const f1 = v => (v > 0 ? Number(v).toFixed(1).replace('.', ',') + ' V' : '–');

function tabelle(zeilen) {
    const kopf = 'font-size:11px;letter-spacing:1.4px;color:#7f8b95;padding:6px 8px;text-align:left;border-bottom:1px solid #2b333b;';
    let h = '<table style="width:100%;border-collapse:collapse;font-family:\'Roboto Condensed\',\'Arial Narrow\',Arial,sans-serif;font-size:14px;color:#e9eef2;">' +
        '<tr><th style="' + kopf + 'width:150px;">STATUS</th><th style="' + kopf + '">GERÄT</th><th style="' + kopf + 'width:120px;">ORT</th><th style="' + kopf +
        'width:70px;text-align:right;">SPANNUNG</th><th style="' + kopf + 'width:70px;text-align:right;">EMPFANG</th><th style="' + kopf + 'width:100px;text-align:right;">LETZTE MELDUNG</th></tr>';
    zeilen.forEach(z => {
        const c = FARBE[String(z.s)];
        h += '<tr style="border-bottom:1px solid #1d242a;">' +
            '<td style="padding:5px 8px;white-space:nowrap;"><span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:' + c + ';margin-right:8px;vertical-align:-1px;"></span><b style="color:' + c + ';">' + TEXT[String(z.s)] + '</b></td>' +
            '<td style="padding:5px 8px;"><b>' + z.bez + '</b>' + (z.unreach ? ' <span style="color:tomato;font-size:12px;">· nicht erreichbar</span>' : '') +
            '<br><span style="font-size:11px;color:#6d7780;">' + z.typ + ' · ' + z.adr + '</span></td>' +
            '<td style="padding:5px 8px;">' + z.ort + '</td>' +
            '<td style="padding:5px 8px;text-align:right;white-space:nowrap;">' + f1(z.v) + '</td>' +
            '<td style="padding:5px 8px;text-align:right;color:#9aa5ad;white-space:nowrap;">' + (z.rssi !== undefined && z.rssi < 0 ? z.rssi + ' dBm' : '–') + '</td>' +
            '<td style="padding:5px 8px;text-align:right;white-space:nowrap;">' + meldung(z.ts) + '</td></tr>';
    });
    return h + '</table>';
}
async function init() {
    for (const c of CCUS) {
        for (const [id, type, name, def] of [['Tabelle_HTML', 'string', 'HTML-Tabelle der Batterieampel', ''], ['Gesamt', 'number', 'Geraete mit Batterie', 0],
            ['Gruen', 'number', 'Ampel gruen', 0], ['Gelb', 'number', 'Ampel gelb', 0], ['Rot', 'number', 'Ampel rot', 0], ['Unbekannt', 'number', 'Ampel unbekannt', 0], ['Unerreichbar', 'number', 'Geraete nicht erreichbar', 0]]) {
            if (!existsState(P + c.id + '.' + id)) await createStateAsync(P + c.id + '.' + id, def, { name: c.id + ': ' + name, type, role: type === 'string' ? 'html' : 'value', read: true, write: false });
        }
    }
    for (const [id, type, name, def] of [['Gesamt', 'number', 'Geraete mit Batterie (beide Zentralen)', 0], ['Gruen', 'number', 'gruen gesamt', 0], ['Gelb', 'number', 'gelb gesamt', 0],
        ['Rot', 'number', 'rot gesamt', 0], ['Aktualisiert', 'string', 'letzte Abfrage', ''], ['Fehler', 'string', 'letzte Fehlermeldung', '']]) {
        if (!existsState(P + 'Allgemein.' + id)) await createStateAsync(P + 'Allgemein.' + id, def, { name: name, type, role: 'value', read: true, write: false });
    }
}
async function abfrage() {
    const summe = { n: 0, g: 0, y: 0, r: 0 };
    const fehler = [];
    for (const c of CCUS) {
        const zeilen = [];
        const zeiten = await regaZeiten(c.host, c.geraete.map(x => x.adr));
        if (!Object.keys(zeiten).length) fehler.push(c.id + ': keine Zeitstempel (ReGa)');
        for (const g of c.geraete) {
            try {
                const v = await rpcGet(c.host, g.adr);
                zeilen.push({ adr: g.adr, typ: g.typ, ort: g.ort, bez: g.bez, v: v.OPERATING_VOLTAGE, s: batterieStatus(g.typ, v.OPERATING_VOLTAGE, !!v.LOW_BAT), unreach: !!v.UNREACH, rssi: v.RSSI_DEVICE, ts: zeiten[g.adr] });
            } catch (e) {
                zeilen.push({ adr: g.adr, typ: g.typ, ort: g.ort, bez: g.bez, v: 0, s: -1, unreach: true });
                fehler.push(c.id + ' ' + g.adr + ': ' + e.message);
            }
        }
        zeilen.sort((a, b) => (b.s - a.s) || ((a.v / zellen(a.typ)) - (b.v / zellen(b.typ))) || a.ort.localeCompare(b.ort));
        const n = z => zeilen.filter(x => x.s === z).length;
        await setStateAsync(P + c.id + '.Tabelle_HTML', tabelle(zeilen), true);
        await setStateAsync(P + c.id + '.Gesamt', zeilen.length, true);
        await setStateAsync(P + c.id + '.Gruen', n(0), true);
        await setStateAsync(P + c.id + '.Gelb', n(1), true);
        await setStateAsync(P + c.id + '.Rot', n(2), true);
        await setStateAsync(P + c.id + '.Unbekannt', n(-1), true);
        await setStateAsync(P + c.id + '.Unerreichbar', zeilen.filter(x => x.unreach).length, true);
        summe.n += zeilen.length; summe.g += n(0); summe.y += n(1); summe.r += n(2);
    }
    await setStateAsync(P + 'Allgemein.Gesamt', summe.n, true);
    await setStateAsync(P + 'Allgemein.Gruen', summe.g, true);
    await setStateAsync(P + 'Allgemein.Gelb', summe.y, true);
    await setStateAsync(P + 'Allgemein.Rot', summe.r, true);
    await setStateAsync(P + 'Allgemein.Aktualisiert', new Date().toLocaleString('de-DE'), true);
    await setStateAsync(P + 'Allgemein.Fehler', fehler.join(' | ').slice(0, 400), true);
    if (summe.r > 0) log('Batterien_Uebersicht: ' + summe.r + ' Geraet(e) mit roter Batterieampel', 'warn');
    if (fehler.length) log('Batterien_Uebersicht: ' + fehler.length + ' Geraet(e) nicht lesbar: ' + fehler[0], 'warn');
}
(async () => {
    await init();
    await abfrage();
    schedule('2,7,12,17,22,27,32,37,42,47,52,57 * * * *', abfrage);
    log('Batterien_Uebersicht gestartet: ' + CCUS.map(c => c.id + ' ' + c.geraete.length).join(', ') + ' Geraete', 'info');
})();