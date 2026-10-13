// ============================================================================
// Schwiegereltern_Karten  (03.10.2026, Claude)
// Rendert die Bindungen der Views Schwiegereltern#Raeume und #Rollladen selbst (vorher 180 + 166 Bindungen, bis 33 je Widget,
// ~25 s Ladezeit). Jetzt hat jedes Widget eine Bindung auf 0_userdata.0.Schwiegereltern_Karten.<kNN>, hier steht das fertige HTML.
// OHNE LAUFENDES SKRIPT BLEIBEN DIE KARTEN LEER. Syntax der Vorlagen wie bei vis:
//   {var:oid;var2:oid2;ausdruck}  oder  {oid}.   Neu rendern bei jeder Aenderung eines beteiligten Datenpunkts.
// ============================================================================
const KP = '0_userdata.0.Schwiegereltern_Karten.';
const TEMPLATES = /*TEMPLATES*/{};
const cache = {};          // kNN -> {text, teile:[{lit}|{vars:[[name,oid]], fn}|{oid}]}
const abh = {};            // oid -> [kNN]
const dirty = new Set();
let timer = null;

function parse(key, html) {
    const teile = [];
    let pos = 0;
    html.replace(/\{([^{}]*)\}/g, (m, inner, idx) => {
        if (idx > pos) teile.push({ lit: html.slice(pos, idx) });
        pos = idx + m.length;
        const parts = inner.split(';');
        if (parts.length === 1 && parts[0].indexOf(':') < 0) {
            teile.push({ oid: parts[0] }); (abh[parts[0]] = abh[parts[0]] || []).push(key);
        } else {
            const vars = [];
            let expr = null;
            for (const p of parts) {
                const mm = /^(\w+):(.+)$/.exec(p);
                if (mm && expr === null) vars.push([mm[1], mm[2]]); else expr = (expr === null ? '' : expr + ';') + p;
            }
            let fn = null;
            try { fn = new Function(...vars.map(v => v[0]), 'return (' + expr + ');'); } catch (e) { log(key + ': Formel ' + expr + ' -> ' + e.message, 'warn'); }
            teile.push({ vars, fn });
            for (const v of vars) (abh[v[1]] = abh[v[1]] || []).push(key);
        }
        return m;
    });
    if (pos < html.length) teile.push({ lit: html.slice(pos) });
    return teile;
}
function wert(oid) { const s = getState(oid); return s && s.val !== null ? s.val : undefined; }
function render(key) {
    let out = '';
    for (const t of cache[key]) {
        if (t.lit !== undefined) out += t.lit;
        else if (t.oid) { const v = wert(t.oid); out += v === undefined ? '' : String(v); }
        else if (t.fn) {
            try { const r = t.fn(...t.vars.map(v => wert(v[1]))); out += (r === undefined || r === null) ? '' : String(r); } catch (e) { /* Wert fehlt noch */ }
        }
    }
    return out;
}
async function schreibe() {
    timer = null;
    const keys = [...dirty]; dirty.clear();
    for (const k of keys) {
        const neu = render(k);
        const alt = getState(KP + k);
        if (!alt || alt.val !== neu) await setStateAsync(KP + k, neu, true);
    }
}
(async () => {
    for (const k of Object.keys(TEMPLATES)) {
        if (!existsState(KP + k)) await createStateAsync(KP + k, '', { name: 'Karte ' + k + ' (fertiges HTML fuer die View)', type: 'string', role: 'html', read: true, write: false });
        cache[k] = parse(k, TEMPLATES[k]);
        dirty.add(k);
    }
    // ein einziges Abonnement per Muster (statt 243 einzelner); gefiltert wird ueber abh
    on({ id: /^0_userdata\.0\.(Schwiegereltern|Rollladen_Schwiegereltern)\./, change: 'any' }, obj => {
        const ks = abh[obj.id];
        if (!ks) return;
        for (const k of ks) dirty.add(k);
        if (!timer) timer = setTimeout(schreibe, 300);
    });
    await schreibe();
    log('Schwiegereltern_Karten: ' + Object.keys(TEMPLATES).length + ' Karten, ' + Object.keys(abh).length + ' Datenpunkte');
})();
