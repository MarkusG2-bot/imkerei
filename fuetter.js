// Fütterung: Futtermenge je Volk mitzählen, Rest bis zum Ziel der Saison, „Füttern ganzer Stand“ mit der Stockwaage
// • db.fuetterungen: {volkId, datum, kg (Futter wie gewogen), mischung, lagerId, zustand 'vorgebucht'|'gebucht',
//   quelle 'Waage'|'eingegeben', plan (vorgebuchte kg), rundeId, waage (Waagen-Nr. am Stand)}
// • db.fuetterRunden: ein „Füttern ganzer Stand“: {stand, standortId, start/fertig/ende (Unix s), modus 'knopf'|'waage', geschirr}
// • Lager: bei Zuckerwasser geht der Zucker ab (kg × Anteil), bei Fertigfutter die Menge selbst (Bewegung mit fuetterungId)
// • Stockwaage: Befehl „fuettern“ (14) mit Bitmaske der Waagen; Modus „waage“ = Master erkennt den Sprung selbst,
//   Modus „knopf“ = Bearbeitung 2 h, „Fertig gefüttert“ verengt sofort. Gemessen wird „letzte Messung vorher“ zu „nachher“.
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

const FU_MISCH = ['Zuckerwasser 3:2', 'Zuckerwasser 1:1', 'Fertigfutter'];
let fuS = null, fuGeprueft = {};

function fuEinst() {
  return Object.assign({ ziel: 15, fertig: 72, erkennung: false, takt: 10, mischung: 'Zuckerwasser 3:2', lagerId: '' }, db.einstellungen.fuetter || {});
}
// Zuckeranteil der Mischung (0–1)
function fuAnteil(m) {
  if (m === 'Zuckerwasser 1:1') return 0.5;
  if (m === 'Fertigfutter') return (fuEinst().fertig || 72) / 100;
  return 0.6;
}
const fuZucker = f => (f.kg || 0) * fuAnteil(f.mischung);
// Futtersaison: 1. Juli bis 30. Juni (Frühjahrsfütterung zählt zum Winter davor)
function fuSaison(datum) { const [j, m] = String(datum).split('-').map(Number); return m >= 7 ? j : j - 1; }
const fuSaisonText = j => `${j}/${String(j + 1).slice(2)}`;
const fuDerSaison = (volkId, j = fuSaison(heute())) => db.fuetterungen.filter(f => f.volkId === volkId && fuSaison(f.datum) === j);
const fuGefuettert = (volkId, j) => fuDerSaison(volkId, j).filter(f => f.zustand === 'gebucht').reduce((s, f) => s + fuZucker(f), 0);
const fuZiel = v => v.futterZiel ?? fuEinst().ziel;
const fuRest = v => Math.max(0, fuZiel(v) - fuGefuettert(v.id));
// Rest in kg Futter der Mischung, auf 0,5 kg gerundet
const fuRestFutter = (v, m) => Math.ceil(fuRest(v) / fuAnteil(m) * 2) / 2;
function fuRestText(v, m = fuEinst().mischung) {
  const r = fuRest(v);
  return r <= 0.05 ? 'Ziel erreicht' : `noch ${zahl(r, 1)} kg Zucker = ${zahl(fuRestFutter(v, m), 1)} kg ${m === 'Fertigfutter' ? 'Fertigfutter' : 'Sirup ' + m.slice(-3)}`;
}

// Lager nachführen (nach Anlegen/Ändern; vorgebucht bucht noch nichts ab)
function fuLager(f) {
  bewegungenZurueck('fuetterungId', f.id);
  const l = f.zustand === 'gebucht' && f.lagerId && lagerArt(f.lagerId);
  if (!l) return;
  const menge = f.mischung === 'Fertigfutter' ? f.kg : fuZucker(f);
  lagerBewegen(l, -+menge.toFixed(3), `Fütterung ${volk(f.volkId)?.name || ''}`.trim(), f.datum, { fuetterungId: f.id });
  mindestWarnung([l]);
}
const fuLagerOpts = () => [...db.lager].filter(l => l.kategorie === 'Futter' || l.einheit === 'kg')
  .sort((a, b) => (b.kategorie === 'Futter') - (a.kategorie === 'Futter')).map(l => [l.id, `${l.name} (${zahl(l.menge, 1)} ${l.einheit})`]);

// Gemessene Futtermenge aus den Rohwerten der Waage (zeit s, gewicht_g): letzte Messung vor dem Start →
// Knopf: erste Messung nach „Fertig gefüttert“; Waage: höchster der ersten 3 Werte ab dem Sprung (≥ 0,5 kg).
// Rückgabe kg (0,1) abzüglich Futtergeschirr, oder null (noch keine Messung / keine Zunahme)
function fuGemessen(werte, r) {
  const w = werte.filter(x => x.gewicht_g != null).sort((a, b) => a.zeit - b.zeit);
  const vor = w.filter(x => x.zeit < r.start).pop();
  if (!vor) return null;
  let nach;
  if (r.fertig) nach = w.find(x => x.zeit > r.fertig)?.gewicht_g;
  else {
    const i = w.findIndex(x => x.zeit >= r.start && x.gewicht_g - vor.gewicht_g >= 500);
    if (i >= 0) nach = Math.max(...w.slice(i, i + 3).map(x => x.gewicht_g));
  }
  if (nach == null) return null;
  const kg = Math.round(((nach - vor.gewicht_g) / 1000 - (r.geschirr || 0)) * 10) / 10;
  return kg >= 0.2 ? kg : null;
}

// ---------- Stockkarte ----------
function fuKarte(v) {
  const j = fuSaison(heute()), fs = fuDerSaison(v.id, j).sort(nachDatum), vor = fs.filter(f => f.zustand === 'vorgebucht');
  const futter = fs.filter(f => f.zustand === 'gebucht').reduce((s, f) => s + (f.kg || 0), 0);
  return `<h3>Fütterung ${fuSaisonText(j)}</h3><div class="karte">
      Gefüttert: <b>${zahl(futter, 1)} kg Futter</b> = ${zahl(fuGefuettert(v.id, j), 1)} kg Zucker · Ziel ${zahl(fuZiel(v), 1)} kg Zucker ·
      ${marke(fuRestText(v), fuRest(v) <= 0.05 ? 'gruen' : 'gelb')}${vor.length ? ` · vorgebucht ${zahl(vor.reduce((s, f) => s + (f.kg || 0), 0), 1)} kg` : ''}
      <div class="zeile" style="margin-top:6px"><button class="klein" onclick="bearbeiten('fuetterungen',null,{volkId:'${v.id}'})">+ Fütterung</button>
        <button class="klein" onclick="fuZielSetzen('${v.id}')">Ziel ändern</button></div></div>` +
    (fs.length ? tabelle(['Datum', 'Futter', 'Mischung', 'Zucker', 'Zustand', ''], fs.map(f => [fmtD(f.datum), zahl(f.kg, 1) + ' kg', esc(f.mischung),
      zahl(fuZucker(f), 1) + ' kg', f.zustand === 'gebucht' ? marke(f.quelle === 'Waage' ? 'Waage' : 'gebucht', 'gruen') : marke('vorgebucht', 'gelb'),
      `<button class="klein" onclick="bearbeiten('fuetterungen','${f.id}')">✎</button>`])) : '');
}
function fuZielSetzen(id) {
  const v = volk(id), w = prompt(`Ziel für ${v.name} in kg Zucker je Saison (leer = Standard ${zahl(fuEinst().ziel, 1)} kg):`, v.futterZiel ?? '');
  if (w === null) return;
  const n = parseFloat(String(w).replace(',', '.'));
  if (w.trim() === '') delete v.futterZiel; else if (n >= 0) v.futterZiel = n; else return;
  speichern(); render();
}

// ---------- Füttern ganzer Stand (Stockwaage → Stand) ----------
function fuStart(stand) {
  fuS = { stand, standortId: db.standorte.find(o => o.waageStand === stand)?.id || null };
  swAnsicht = 'fuettern'; swStopp(); render();
}
const fuVoelker = () => db.voelker.filter(v => v.status !== 'aufgelöst' && ((fuS.stand && v.waage?.stand === fuS.stand) || (fuS.standortId && v.standortId === fuS.standortId)))
  .sort((a, b) => (a.waage?.nr ?? 99) - (b.waage?.nr ?? 99) || a.name.localeCompare(b.name));
const fuOffen = () => db.fuetterRunden.filter(r => !r.ende && (r.stand ? r.stand === fuS.stand : r.standortId === fuS.standortId)).pop();
const fuDerRunde = r => db.fuetterungen.filter(f => f.rundeId === r.id);
const fuMaske = fs => fs.filter(f => f.waage).reduce((m, f) => m | (1 << f.waage), 0);
async function fuBefehl(art, volkNr, wert, text) {
  if (!fuS.stand) return;
  try { await swAbruf(`/api/app/stand/${fuS.stand}/befehl`, { method: 'POST', body: JSON.stringify({ art, volk: volkNr, wert, text }) }); }
  catch (e) { swFehler = e.message; }
}

function fuStandSeite() {
  const e = fuEinst(), vs = fuVoelker(), r = fuOffen(), name = fuS.stand ? swName((swStaende || []).find(x => x.stand === fuS.stand) || { stand: fuS.stand }) : sName(fuS.standortId);
  const zur = `<button onclick="swStandOeffnen('${fuS.stand}')">← Zurück</button>`;
  const einst = `<details class="karte" style="margin-top:12px"><summary>⚙ Einstellungen Fütterung</summary><div class="felder" style="margin-top:8px">
      <label>Ziel je Volk und Saison (kg Zucker)<input id="fu-ziel" type="number" step="0.5" min="0" value="${e.ziel}"></label>
      <label>Zuckeranteil Fertigfutter (%)<input id="fu-fertig" type="number" step="1" min="1" max="100" value="${e.fertig}"></label>
      <label>Messtakt beim Füttern<select id="fu-takt">${[[5, '5 min'], [10, '10 min'], [15, '15 min'], [0, 'nicht ändern']].map(([w, t]) => `<option value="${w}" ${w === e.takt ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="zeile"><input id="fu-erk" type="checkbox" ${e.erkennung ? 'checked' : ''}> Erkennung durch die Waage (Schieber schließt von selbst)</label>
    </div><button class="klein" onclick="fuEinstSpeichern()">Speichern</button>
    <div class="klein-t leise">Ohne Erkennung gehen die Waagen beim Vorbuchen 2 h in Bearbeitung; „Fertig gefüttert“ schließt die Schieber.
      Mit Erkennung schließt der Schieber, sobald die Waage bei diesem Volk 0,5 kg mehr sieht (12 h lang). Genaue Gewichte je Volk
      kommen mit „📶 Verbinden“ zum Server.</div></details>`;
  if (r) {
    const fs = fuDerRunde(r), vor = fs.filter(f => f.zustand === 'vorgebucht');
    if (r.stand && vor.some(f => f.waage) && Date.now() - (fuGeprueft[r.id] || 0) > 60000) setTimeout(() => fuMessen(r.id), 0);
    main().innerHTML = kopf(`🍯 Füttern · ${esc(name)}`, zur + (r.stand ? `<button onclick="swVerbindenStart('${r.stand}')">📶 Verbinden</button>` : '')) +
      (swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : '') +
      `<div class="karte">Vorgebucht ${new Date(r.start * 1000).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        · ${r.modus === 'waage' ? 'Erkennung durch die Waage' : 'Knopf „Fertig gefüttert“'}${r.geschirr ? ` · Futtergeschirr ${zahl(r.geschirr, 1)} kg wird abgezogen` : ''}
        ${r.fertig ? ` · fertig ${new Date(r.fertig * 1000).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}` : ''}
        <div class="klein-t leise">Die Waage-Spalte füllt sich, sobald die Messungen nach dem Füttern am Server sind (📶 Verbinden). Vor dem Buchen kannst du jede Menge ändern.</div></div>` +
      tabelle(['Volk', 'Waage', 'Vorgebucht', 'Waage misst', 'Buchen (kg)'], fs.map(f => [esc(volk(f.volkId)?.name || '?'), f.waage ? 'Nr. ' + f.waage : '–',
        zahl(f.plan, 1) + ' kg', f.zustand === 'gebucht' ? marke('gebucht', 'gruen') : f.gemessen != null ? '<b>' + zahl(f.gemessen, 1) + ' kg</b>' : f.waage ? '<span class="leise">wartet …</span>' : '–',
        f.zustand === 'gebucht' ? zahl(f.kg, 1) : `<input id="fu-b-${f.id}" type="number" step="0.1" min="0" style="width:80px" value="${f.gemessen ?? f.plan}">`])) +
      `<div class="zeile" style="margin-top:10px">${!r.fertig ? `<button class="haupt" onclick="fuFertig('${r.id}')">✔ Fertig gefüttert</button>` : ''}
        ${vor.length ? `<button ${r.fertig || r.modus === 'waage' ? 'class="haupt"' : ''} onclick="fuBuchen('${r.id}')">Mengen buchen</button>` : ''}
        ${r.stand && vor.some(f => f.waage) ? `<button onclick="fuGeprueft={};fuMessen('${r.id}')">Waage prüfen</button>` : ''}
        <button class="gefahr" onclick="fuAbbrechen('${r.id}')">Abbrechen</button></div>` + einst;
    return;
  }
  const lager = fuLagerOpts(), m = e.mischung;
  main().innerHTML = kopf(`🍯 Füttern ganzer Stand · ${esc(name)}`, zur) + (swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : '') +
    (vs.length ? `<div class="karte"><div class="felder">
        <label>Futter<select id="fu-misch" onchange="fuMischung(this.value)">${FU_MISCH.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label>Aus dem Lager<select id="fu-lager"><option value="">– nicht abbuchen –</option>${lager.map(([id, t]) => `<option value="${id}" ${id === e.lagerId ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label>Futtergeschirr neu aufgesetzt (kg abziehen)<input id="fu-geschirr" type="number" step="0.1" min="0" value="0"></label>
        <label>Gleiche Menge für alle (kg)<span class="zeile"><input id="fu-alle" type="number" step="0.5" min="0" style="width:90px">
          <button type="button" class="klein" onclick="fuAlle()">Übernehmen</button></span></label></div>
        <div class="klein-t leise">Vorgeschlagen ist der Rest bis zum Ziel (${zahl(e.ziel, 1)} kg Zucker je Volk und Saison). 0 = dieses Volk nicht füttern.
          Bei Zuckerwasser wird der Zucker abgebucht, bei Fertigfutter die Menge.</div></div>` +
      tabelle(['Volk', 'Waage', 'Gefüttert (Zucker)', 'Rest', 'Menge (kg Futter)'], vs.map(v => [esc(v.name), v.waage?.stand === fuS.stand ? 'Nr. ' + v.waage.nr : '–',
        zahl(fuGefuettert(v.id), 1) + ' kg', esc(fuRestText(v, m)),
        `<input id="fu-m-${v.id}" class="fu-menge" type="number" step="0.5" min="0" style="width:80px" value="${fuRestFutter(v, m)}">`])) +
      `<div class="zeile" style="margin-top:10px"><button class="haupt" onclick="fuVorbuchen()">Vorbuchen${fuS.stand ? ' und Waagen vorbereiten' : ''}</button></div>`
      : '<div class="karte">Keine Völker zugeordnet. Zuerst am Stand jeder Waage ein Volk zuordnen.</div>') + einst;
}
function fuEinstSpeichern() {
  db.einstellungen.fuetter = { ...fuEinst(), ziel: Math.max(0, Number($('#fu-ziel').value) || 0), fertig: Math.min(100, Math.max(1, Number($('#fu-fertig').value) || 72)),
    takt: Number($('#fu-takt').value), erkennung: $('#fu-erk').checked };
  speichern(); render();
}
function fuMischung(m) {
  db.einstellungen.fuetter = { ...fuEinst(), mischung: m };
  for (const v of fuVoelker()) { const el = $(`#fu-m-${v.id}`); if (el) el.value = fuRestFutter(v, m); }
  speichern();
}
function fuAlle() { const w = $('#fu-alle').value; document.querySelectorAll('.fu-menge').forEach(el => { el.value = w; }); }

async function fuVorbuchen() {
  const e = fuEinst(), mischung = $('#fu-misch').value, lagerId = $('#fu-lager').value, geschirr = Math.max(0, Number($('#fu-geschirr').value) || 0);
  const r = { id: uid(), stand: fuS.stand || null, standortId: fuS.standortId, start: Math.floor(Date.now() / 1000), modus: e.erkennung ? 'waage' : 'knopf', geschirr, takt: e.takt };
  const fs = fuVoelker().map(v => ({ v, kg: Math.round((Number($(`#fu-m-${v.id}`)?.value) || 0) * 10) / 10 })).filter(x => x.kg > 0)
    .map(({ v, kg }) => ({ id: uid(), volkId: v.id, datum: heute(), kg, plan: kg, mischung, lagerId, zustand: 'vorgebucht', quelle: 'eingegeben', rundeId: r.id,
      waage: fuS.stand && v.waage?.stand === fuS.stand ? v.waage.nr : null }));
  if (!fs.length) return alert('Bei keinem Volk ist eine Menge eingetragen.');
  db.einstellungen.fuetter = { ...e, mischung, lagerId };
  db.fuetterRunden.push(r); db.fuetterungen.push(...fs); speichern();
  swFehler = '';
  const maske = fuMaske(fs);
  if (maske) {
    if (e.takt) await fuBefehl('takt', 0, e.takt, `Füttern: Messtakt ${e.takt} min`);
    if (r.modus === 'waage') await fuBefehl('fuettern', 1, maske, 'Füttern: Waage erkennt die Fütterung');
    else await fuBefehl('bearbeitung', 0, 120, 'Füttern: Stand 2 h in Bearbeitung');
  }
  render();
}
async function fuFertig(rid) {
  const r = db.fuetterRunden.find(x => x.id === rid);
  r.fertig = Math.floor(Date.now() / 1000); speichern(); swFehler = '';
  const maske = fuMaske(fuDerRunde(r).filter(f => f.zustand === 'vorgebucht'));
  if (maske) {
    await fuBefehl('fuettern', 0, maske, 'Gefüttert – Schieber verengen');
    if (r.modus === 'knopf') await fuBefehl('bearbeitung', 0, 0, 'Füttern fertig: Bearbeitung beenden');
  }
  fuGeprueft = {}; render();
}
// Messwerte vom Server holen und je Volk die Zunahme eintragen (gebucht wird erst mit „Mengen buchen“)
async function fuMessen(rid) {
  const r = db.fuetterRunden.find(x => x.id === rid);
  if (!r?.stand) return;
  fuGeprueft[rid] = Date.now();
  const bis = Math.floor(Date.now() / 1000);
  try {
    for (const f of fuDerRunde(r).filter(x => x.zustand === 'vorgebucht' && x.waage)) {
      const w = (await swAbruf(`/api/app/stand/${r.stand}/verlauf?volk=${f.waage}&von=${r.start - 6 * 3600}&bis=${bis}&stufe=roh`)).werte;
      const kg = fuGemessen(w, r);
      if (kg != null) f.gemessen = kg;
    }
    speichern(); swFehler = '';
  } catch (e) { swFehler = e.message; }
  if (ansicht === 'stockwaage' && swAnsicht === 'fuettern') render();
}
async function fuBuchen(rid) {
  const r = db.fuetterRunden.find(x => x.id === rid), vor = fuDerRunde(r).filter(f => f.zustand === 'vorgebucht');
  const werte = vor.map(f => [f, Math.round((Number($(`#fu-b-${f.id}`)?.value) || 0) * 10) / 10]);
  const ohne = werte.filter(([f]) => f.waage && f.gemessen == null).length;
  if (ohne && !confirm(`Bei ${ohne} ${ohne === 1 ? 'Volk' : 'Völkern'} hat die Waage noch nichts gemessen. Trotzdem die eingetragene Menge buchen?`)) return;
  const abzug = werte.filter(([f, kg]) => kg > 0 && f.lagerId && lagerArt(f.lagerId))
    .map(([f, kg]) => [lagerArt(f.lagerId), f.mischung === 'Fertigfutter' ? kg : kg * fuAnteil(f.mischung)]);
  const fehlt = fehlmengen(abzug);
  if (fehlt.length && !confirm('Im Lager reicht es nicht:\n' + fehlt.join('\n') + '\nTrotzdem buchen?')) return;
  for (const [f, kg] of werte) {
    if (kg <= 0) { db.fuetterungen = db.fuetterungen.filter(x => x.id !== f.id); continue; }   // nicht gefüttert
    Object.assign(f, { kg, zustand: 'gebucht', quelle: f.gemessen != null && kg === f.gemessen ? 'Waage' : 'eingegeben', datum: heute() });
    fuLager(f);
  }
  r.ende = Math.floor(Date.now() / 1000); speichern();
  if (r.stand && r.takt) await fuBefehl('takt', 0, 0, 'Füttern gebucht: Messtakt automatisch');
  swStandOeffnen(r.stand);
}
async function fuAbbrechen(rid) {
  const r = db.fuetterRunden.find(x => x.id === rid);
  if (!confirm('Fütterung abbrechen? Die vorgebuchten Mengen werden gelöscht (schon gebuchte bleiben).')) return;
  db.fuetterungen = db.fuetterungen.filter(f => !(f.rundeId === rid && f.zustand === 'vorgebucht'));
  r.ende = Math.floor(Date.now() / 1000); speichern();
  if (r.stand) {
    if (r.takt) await fuBefehl('takt', 0, 0, 'Füttern abgebrochen: Messtakt automatisch');
    if (r.modus === 'knopf' && !r.fertig) await fuBefehl('bearbeitung', 0, 0, 'Füttern abgebrochen: Bearbeitung beenden');
  }
  render();
}
