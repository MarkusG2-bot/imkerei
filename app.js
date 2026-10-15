// ---------- Daten ----------
const VERSION = '1.1.0'; // wird beim Update gesetzt, muss zu CACHE in sw.js passen
const KEY = 'imkerei-db-v1';
const leer = () => ({ standorte: [], voelker: [], durchsichten: [], behandlungen: [], ernten: [], lager: [], bewegungen: [], aufgaben: [], wanderungen: [], varroa: [], vorschlaege: {}, einstellungen: {}, visBestaetigt: {}, buchungen: [], investitionen: [], beobachtungen: [], rechnungen: [], verkaeufe: [], abfuellungen: [], arbeitszeiten: [], sperrzonen: [] });
let db = laden();
function laden() { try { return uebernehmen(Object.assign(leer(), JSON.parse(localStorage.getItem(KEY)) || {})); } catch { return leer(); } }
// Ältere Datenstände anpassen: Trachtkarte lag früher im Textfeld „Trachtangebot“ (tracht)
function uebernehmen(d) {
  for (const s of d.standorte) if (s.tracht && typeof s.tracht === 'object') { s.trachtkarte = s.tracht; s.tracht = ''; }
  return d;
}
function speichern() { localStorage.setItem(KEY, JSON.stringify(db)); statusSpiegeln(); }
// Auszug für den Service Worker, damit er im Hintergrund fällige Arbeiten melden kann
function statusSpiegeln() {
  if (!window.caches) return Promise.resolve();
  return statusSchreiben('daten', { push: !!db.einstellungen.push,
    standorte: db.standorte.filter(hatKoord).map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, beuten: beutenAm(s), k: standortFaktor(beobAm(s)).k })),
    aufgaben: db.aufgaben.filter(a => !a.erledigt && a.faellig).map(a => ({ id: a.id, titel: a.titel, faellig: a.faellig })),
    vis: { aus: !!db.einstellungen.visAus, ohneBestaetigung: !!db.einstellungen.visOhneBestaetigung, bestaetigt: db.visBestaetigt,
      voelker: db.voelker.filter(v => v.status !== 'aufgelöst').length, standorte: db.standorte.length } }).catch(() => {});
}
// VIS-Meldung: Karte mit Zahlen je Standplatz, Link zur Anmeldung und Bestätigung
function visKarte() {
  const f = visFenster(heute());
  if (!f || db.einstellungen.visAus || db.visBestaetigt[f.id]) return '';
  const aktiv = db.voelker.filter(v => v.status !== 'aufgelöst');
  return `<div class="karte" style="border-color:var(--honig);margin-bottom:12px"><h4>VIS-Meldung fällig</h4>Stichtag ${f.stichtag}, zu melden bis ${f.frist}.
    <div class="klein-t" style="margin:6px 0">${db.standorte.map(s => `${esc(s.name)}${s.regnr ? ` (${esc(s.regnr)})` : ''}: <b>${aktiv.filter(v => v.standortId === s.id).length}</b> Völker`).join('<br>') || 'Noch keine Standplätze eingetragen.'}
      <br>Gesamt: <b>${aktiv.length}</b> Völker (aktueller Stand in der App)</div>
    <div class="zeile"><a class="btn haupt" href="${VIS_LINK}" target="_blank" rel="noopener">Zum VIS anmelden</a><button onclick="visErledigt('${f.id}')">Meldung erledigt</button></div></div>`;
}
function visErledigt(id) { db.visBestaetigt[id] = heute(); speichern(); render(); }

const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtD = d => d ? d.split('-').reverse().join('.') : '–';
const zahl = (n, st = 1) => n == null ? '–' : Number(n).toLocaleString('de-AT', { maximumFractionDigits: st });
const nachDatum = (a, b) => (b.datum || '').localeCompare(a.datum || '');
const standort = id => db.standorte.find(s => s.id === id);
const volk = id => db.voelker.find(v => v.id === id);
const sName = id => esc(standort(id)?.name ?? '–');
const vName = id => id ? esc(volk(id)?.name ?? '(gelöscht)') : '–';
const marke = (text, farbe = '') => `<span class="marke ${farbe}">${esc(text)}</span>`;
const tabelle = (kopf, zeilen) => zeilen.length
  ? `<div class="tw"><table><thead><tr>${kopf.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${zeilen.map(z => `<tr>${z.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  : '<p class="leer">Noch keine Einträge.</p>';

// Internationale Jahresfarben der Königinnenzeichnung
const JAHRESFARBE = [['blau', '#2563eb'], ['weiß', '#fff'], ['gelb', '#facc15'], ['rot', '#dc2626'], ['grün', '#16a34a']];
function koeniginPunkt(jahr) {
  if (!jahr) return '';
  const [name, farbe] = JAHRESFARBE[jahr % 5];
  return `<span class="punkt" style="background:${farbe}" title="Jahresfarbe ${name}"></span> ${jahr}`;
}

// ---------- Formulare ----------
const optS = () => db.standorte.map(s => [s.id, s.name]);
const optV = () => db.voelker.filter(v => v.status !== 'aufgelöst').map(v => [v.id, v.name]);
const KATEGORIEN = ['Honig', 'Gläser & Deckel', 'Etiketten', 'Futter', 'Rähmchen & Mittelwände', 'Beutenteile', 'Behandlungsmittel', 'Werkzeug & Schutz', 'Wachs', 'Sonstiges'];
const MITTEL = ['Ameisensäure 60 %', 'Ameisensäure 85 %', 'Oxalsäure träufeln', 'Oxalsäure verdampfen', 'Oxalsäure sprühen', 'Milchsäure 15 %', 'Thymol (Apiguard/Thymovar)', 'Drohnenbrutentnahme', 'Totale Brutentnahme', 'Bannwabenverfahren'];
const SORTEN = ['Blütenhonig', 'Waldhonig', 'Rapshonig', 'Lindenhonig', 'Akazienhonig', 'Kastanienhonig', 'Löwenzahnhonig', 'Cremehonig'];
const BUCH_KAT = ['Honigverkauf', 'Wachs / Propolis', 'Völkerverkauf', 'Förderung', 'Futter', 'Behandlungsmittel', 'Gläser & Etiketten', 'Material', 'Königinnen / Völker', 'Fahrtkosten', 'Versicherung / Beiträge', 'Sonstiges'];
// Die Listen oben sind die Voreinstellung; was angezeigt wird, kommt aus liste(…) (unter „Anpassen“ änderbar)

const DEF = {
  standorte: { titel: 'Standplatz', felder: () => [
    { k: 'name', label: 'Name', req: 1, breit: 1 },
    { k: 'lat', label: 'Breitengrad', typ: 'number', step: 'any' },
    { k: 'lon', label: 'Längengrad', typ: 'number', step: 'any' },
    { k: 'typ', label: 'Art', typ: 'select', opts: ['Heimstand', 'Wanderstand', 'Ablegerstand', 'Belegstelle'] },
    { k: 'regnr', label: 'Registrierungsnr. (VIS/LFBIS)' },
    { k: 'besitzer', label: 'Grundeigentümer / Kontakt' },
    { k: 'tracht', label: 'Trachtangebot' },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  voelker: { titel: 'Volk', neu: () => ({ status: 'aktiv', beute: 'Zander', rasse: 'Carnica' }), felder: () => [
    { k: 'name', label: 'Name / Nummer', req: 1 },
    { k: 'standortId', label: 'Standplatz', typ: 'select', opts: [['', '–'], ...optS()] },
    { k: 'status', label: 'Status', typ: 'select', opts: ['aktiv', 'Ableger', 'Schwarm', 'aufgelöst'] },
    { k: 'beute', label: 'Beutensystem', typ: 'select', opts: BEUTEN },
    { k: 'koeniginJahr', label: 'Königin Schlupfjahr', typ: 'number', step: 1 },
    { k: 'rasse', label: 'Rasse', typ: 'select', opts: ['Carnica', 'Buckfast', 'Dunkle Biene', 'Ligustica', 'Sonstige'] },
    { k: 'koeniginHerkunft', label: 'Herkunft / Zuchtlinie' },
    { k: 'gezeichnet', label: 'Königin gezeichnet', typ: 'checkbox' },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  durchsichten: { titel: 'Durchsicht', neu: () => ({ datum: heute(), weisel: 'Stifte gesehen', futter: 'ausreichend', zellen: 'keine' }), felder: () => [
    { k: 'volkId', label: 'Volk', typ: 'select', opts: optV(), req: 1 },
    { k: 'datum', label: 'Datum', typ: 'date', req: 1 },
    { k: 'weisel', label: 'Weiselrichtigkeit', typ: 'select', opts: ['Königin gesehen', 'Stifte gesehen', 'unklar', 'weisellos'] },
    { k: 'zellen', label: 'Weiselzellen', typ: 'select', opts: ['keine', 'Spielnäpfchen', 'bestiftet', 'verdeckelt'] },
    { k: 'brutwaben', label: 'Brutwaben', typ: 'number', step: 0.5 },
    { k: 'gassen', label: 'Besetzte Wabengassen', typ: 'number', step: 1 },
    { k: 'futter', label: 'Futtervorrat', typ: 'select', opts: ['reichlich', 'ausreichend', 'knapp', 'kritisch'] },
    { k: 'sanftmut', label: 'Sanftmut (1 sehr gut – 4 schlecht)', typ: 'number', step: 1, min: 1, max: 4 },
    { k: 'varroa', label: 'Varroa (Milben/Tag, Windel)', typ: 'number', step: 0.1 },
    { k: 'gewicht', label: 'Gewicht (kg)', typ: 'number', step: 0.1 },
    { k: 'massnahmen', label: 'Maßnahmen', breit: 1 },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  behandlungen: { titel: 'Behandlung', neu: () => ({ datum: heute() }), felder: () => [
    { k: 'volkId', label: 'Volk', typ: 'select', opts: optV(), req: 1 },
    { k: 'datum', label: 'Beginn', typ: 'date', req: 1 },
    { k: 'mittel', label: 'Mittel / Verfahren', req: 1, liste: liste('mittel') },
    { k: 'menge', label: 'Menge / Dosierung' },
    { k: 'charge', label: 'Chargennummer' },
    { k: 'ende', label: 'Ende', typ: 'date' },
    { k: 'wartezeit', label: 'Wartezeit (Tage)', typ: 'number', step: 1 },
    { k: 'anwender', label: 'Anwender' },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  ernten: { titel: 'Ernte', neu: () => ({ datum: heute(), produkt: 'Honig', insLager: true }), nachher: ernteLagern, geloescht: id => bewegungenZurueck('ernteId', id), felder: () => [
    { k: 'datum', label: 'Datum', typ: 'date', req: 1 },
    { k: 'produkt', label: 'Produkt', typ: 'select', opts: ['Honig', 'Wachs', 'Propolis', 'Pollen', 'Gelée Royale'] },
    { k: 'volkId', label: 'Volk', typ: 'select', opts: [['', '– mehrere / ganzer Stand –'], ...optV()] },
    { k: 'standortId', label: 'Standplatz', typ: 'select', opts: [['', '–'], ...optS()] },
    { k: 'kg', label: 'Menge (kg)', typ: 'number', step: 0.01, req: 1 },
    { k: 'sorte', label: 'Sorte', liste: liste('sorten') },
    { k: 'wasser', label: 'Wassergehalt (%)', typ: 'number', step: 0.1 },
    { k: 'los', label: 'Los-/Chargennr.' },
    { k: 'insLager', label: 'Menge ins Lager buchen', typ: 'checkbox' },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  lager: { titel: 'Lagerartikel', neu: () => ({ kategorie: 'Sonstiges', menge: 0, einheit: 'Stk' }), felder: () => [
    { k: 'name', label: 'Artikel', req: 1, breit: 1 },
    { k: 'kategorie', label: 'Kategorie', typ: 'select', opts: liste('lagerKat') },
    { k: 'ort', label: 'Lagerort' },
    { k: 'menge', label: 'Bestand', typ: 'number', step: 'any', req: 1 },
    { k: 'einheit', label: 'Einheit', liste: ['Stk', 'kg', 'g', 'l', 'ml', 'Karton', 'Rolle'] },
    { k: 'mindest', label: 'Mindestbestand', typ: 'number', step: 'any' },
    { k: 'preis', label: 'Stückpreis (€)', typ: 'number', step: 0.01 },
    { k: 'vpreis', label: 'Verkaufspreis (€)', typ: 'number', step: 0.01, min: 0 },
    { k: 'mhd', label: 'Haltbar bis', typ: 'date' },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  buchungen: { titel: 'Buchung', neu: () => ({ datum: heute(), art: 'Ausgabe' }), felder: () => [
    { k: 'datum', label: 'Datum', typ: 'date', req: 1 },
    { k: 'art', label: 'Art', typ: 'select', opts: ['Ausgabe', 'Einnahme'] },
    { k: 'betrag', label: 'Betrag (€)', typ: 'number', step: 0.01, min: 0, req: 1 },
    { k: 'kategorie', label: 'Kategorie', liste: liste('buchKat') },
    { k: 'text', label: 'Beschreibung', breit: 1 }] },
  investitionen: { titel: 'Investition', neu: () => ({ datum: heute(), jahre: 10 }), felder: () => [
    { k: 'name', label: 'Anschaffung (z. B. Schleuder)', req: 1, breit: 1 },
    { k: 'datum', label: 'Anschaffungsdatum', typ: 'date', req: 1 },
    { k: 'betrag', label: 'Betrag (€)', typ: 'number', step: 0.01, min: 0, req: 1 },
    { k: 'jahre', label: 'Nutzungsdauer (Jahre)', typ: 'number', step: 1, min: 1, req: 1 },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  sperrzonen: { titel: 'Sperrzone', neu: () => ({ radius: 3, von: heute() }), felder: () => [
    { k: 'name', label: 'Ort / Bezeichnung', req: 1, breit: 1 },
    { k: 'lat', label: 'Breitengrad', typ: 'number', step: 'any', req: 1 },
    { k: 'lon', label: 'Längengrad', typ: 'number', step: 'any', req: 1 },
    { k: 'radius', label: 'Radius (km)', typ: 'number', step: 0.5, min: 0.5, req: 1 },
    { k: 'von', label: 'Gilt ab', typ: 'date' },
    { k: 'bis', label: 'Aufgehoben am', typ: 'date' },
    { k: 'gz', label: 'Geschäftszahl / Behörde' },
    { k: 'link', label: 'Link zur Verordnung', breit: 1 },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
  aufgaben: { titel: 'Aufgabe', neu: () => ({ faellig: heute() }), felder: () => [
    { k: 'titel', label: 'Aufgabe', req: 1, breit: 1 },
    { k: 'faellig', label: 'Fällig am', typ: 'date' },
    { k: 'volkId', label: 'Volk', typ: 'select', opts: [['', '–'], ...optV()] },
    { k: 'standortId', label: 'Standplatz', typ: 'select', opts: [['', '–'], ...optS()] },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }] },
};

function feldHtml(f, wert) {
  const attr = `name="${f.k}" ${f.req ? 'required' : ''}`;
  const w = esc(wert ?? '');
  let el;
  if (f.typ === 'select') el = `<select ${attr}>${f.opts.map(o => Array.isArray(o) ? o : [o, o]).map(([v, l]) => `<option value="${esc(v)}" ${String(wert ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (f.typ === 'textarea') el = `<textarea ${attr} rows="2">${w}</textarea>`;
  else if (f.typ === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.k}" ${wert ? 'checked' : ''}> ${esc(f.label)}</label>`;
  else {
    const liste = f.liste ? `list="dl-${f.k}"` : '';
    const grenzen = ['step', 'min', 'max'].filter(a => f[a] != null).map(a => `${a}="${f[a]}"`).join(' ');
    el = `<input type="${f.typ || 'text'}" ${attr} ${liste} ${grenzen} value="${w}">`;
    if (f.liste) el += `<datalist id="dl-${f.k}">${f.liste.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
  }
  return `<label class="${f.breit ? 'breit' : ''}">${esc(f.label)}${f.req ? ' *' : ''}${el}</label>`;
}

function formular(titel, felder, werte, onSave, onDelete) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form><h2>${esc(titel)}</h2><div class="felder">${felder.map(f => feldHtml(f, werte[f.k])).join('')}</div>
    <div class="btns">${onDelete ? '<button type="button" class="gefahr" id="f-del">Löschen</button>' : ''}<span class="platz"></span>
    <button type="button" id="f-ab">Abbrechen</button><button class="haupt">Speichern</button></div></form>`;
  const form = dlg.querySelector('form');
  $('#f-ab').onclick = () => dlg.close();
  if (onDelete) $('#f-del').onclick = () => { if (confirm('Wirklich löschen?')) { dlg.close(); onDelete(); } };
  form.onsubmit = e => {
    e.preventDefault();
    const w = {};
    for (const f of felder) {
      const el = form.elements[f.k];
      w[f.k] = f.typ === 'checkbox' ? el.checked : f.typ === 'number' ? (el.value === '' ? null : parseFloat(el.value)) : el.value.trim();
    }
    dlg.close();
    onSave(w);
  };
  dlg.showModal();
}

function bearbeiten(typ, id, vorgabe = {}) {
  const def = DEF[typ];
  const alt = id && db[typ].find(x => x.id === id);
  formular(alt ? `${def.titel} bearbeiten` : `${def.titel} eintragen`, def.felder(), alt || { ...def.neu?.(), ...vorgabe },
    w => { const e = alt ? Object.assign(alt, w) : { id: uid(), ...w }; if (!alt) db[typ].push(e); def.nachher?.(e); speichern(); render(); },
    alt && (() => { db[typ] = db[typ].filter(x => x.id !== id); def.geloescht?.(id); speichern(); if (typ === 'voelker') detailVolk = null; render(); }));
  if (typ === 'durchsichten') sprachLeiste();
}

// ---------- Navigation ----------
const ANSICHTEN = [['start', 'Übersicht'], ['standorte', 'Standplätze'], ['voelker', 'Stockführung'], ['behandlungen', 'Bestandsbuch'], ['varroa', 'Varroa-Zähler'], ['ernten', 'Ernte'], ['lager', 'Lager'], ['verkauf', 'Verkauf'], ['finanzen', 'Finanzen'], ['vegetation', 'Vegetation & Wetter'], ['aufgaben', 'Aufgaben'], ['arbeit', 'Arbeitszeit'], ['daten', 'Daten'], ['einstellungen', '⚙ Anpassen']];
let ansicht = 'start', detailVolk = null, vegId = null, karte = null;
function gehe(a) { ansicht = a; detailVolk = null; render(); scrollTo(0, 0); }
function render() {
  // Menü in der unter „Anpassen“ gewählten Reihenfolge; die offene Seite bleibt sichtbar, auch wenn sie ausgeblendet ist
  $('#nav').innerHTML = geordnet('menue', true).filter(t => t.an || t.k === ansicht).map(t => `<button class="${t.k === ansicht ? 'aktiv' : ''}" onclick="gehe('${t.k}')">${t.label}</button>`).join('');
  uhrLeiste();
  if (karte) { karte.remove(); karte = null; }
  ({ start: zeigeStart, standorte: zeigeStandorte, voelker: zeigeVoelker, behandlungen: zeigeBehandlungen, varroa: zeigeVarroa, ernten: zeigeErnten, lager: zeigeLager, verkauf: zeigeVerkauf, finanzen: zeigeFinanzen,
    vegetation: zeigeVegetation, aufgaben: zeigeAufgaben, arbeit: zeigeArbeit, daten: zeigeDaten, einstellungen: zeigeEinstellungen })[ansicht]();
}
const main = () => $('#main');
const kopf = (titel, knoepfe = '') => `<div class="kopf"><h2>${titel}</h2><div class="zeile">${knoepfe}</div></div>`;

// ---------- Auswertung je Volk ----------
const letzteDurchsicht = id => db.durchsichten.filter(d => d.volkId === id).sort(nachDatum)[0];
// Richtwerte natürlicher Milbenfall pro Tag
const varroaFarbe = n => n == null ? '' : n < 5 ? 'gruen' : n < 10 ? 'gelb' : 'rot';
// Jüngster Milbenfall aus Durchsicht oder Foto-Zählung
const letzteVarroa = id => [...db.durchsichten.filter(d => d.volkId === id && d.varroa != null).map(d => ({ datum: d.datum, wert: d.varroa })),
  ...db.varroa.filter(z => z.volkId === id).map(z => ({ datum: z.datum, wert: z.proTag }))].sort(nachDatum)[0];
function volkHinweise(v) {
  const h = [], d = letzteDurchsicht(v.id), mv = letzteVarroa(v.id);
  if (mv?.wert >= 10) h.push(['rot', `Varroa ${zahl(mv.wert)}/Tag`]);
  else if (mv?.wert >= 5) h.push(['gelb', `Varroa ${zahl(mv.wert)}/Tag`]);
  if (!d) return [['gelb', 'noch keine Durchsicht'], ...h];
  if (d.weisel === 'weisellos') h.push(['rot', 'weisellos']);
  if (d.weisel === 'unklar') h.push(['gelb', 'Weisel unklar']);
  if (d.zellen === 'bestiftet' || d.zellen === 'verdeckelt') h.push(['rot', 'Schwarmstimmung']);
  if (d.futter === 'kritisch') h.push(['rot', 'Futter kritisch']);
  if (d.futter === 'knapp') h.push(['gelb', 'Futter knapp']);
  const monat = new Date().getMonth() + 1, tage = Math.floor((Date.now() - new Date(d.datum)) / 864e5);
  if (monat >= 4 && monat <= 8 && tage > 14) h.push(['gelb', `${tage} Tage ohne Durchsicht`]);
  return h;
}
function alleHinweise() {
  const h = [], t = heute();
  for (const a of db.aufgaben.filter(a => !a.erledigt && a.faellig && a.faellig <= t)) h.push([a.faellig < t ? 'rot' : 'gelb', `Aufgabe ${a.faellig < t ? 'überfällig' : 'heute'}: ${esc(a.titel)}`]);
  for (const v of db.voelker.filter(v => v.status !== 'aufgelöst')) for (const [f, text] of volkHinweise(v)) h.push([f, `${esc(v.name)}: ${text}`]);
  for (const b of db.behandlungen) {
    if (!b.wartezeit) continue;
    const frei = iso(new Date(new Date(b.ende || b.datum).getTime() + b.wartezeit * 864e5));
    if (frei >= t) h.push(['gelb', `${vName(b.volkId)}: Wartezeit ${esc(b.mittel)} bis ${fmtD(frei)}`]);
  }
  h.push(...sperrHinweise());
  for (const l of db.lager) {
    if (l.mindest != null && l.menge <= l.mindest) h.push(['gelb', `Lager: ${esc(l.name)} unter Mindestbestand (${zahl(l.menge, 2)} ${esc(l.einheit)})`]);
    if (l.mhd && l.mhd <= iso(new Date(Date.now() + 30 * 864e5))) h.push([l.mhd < t ? 'rot' : 'gelb', `Lager: ${esc(l.name)} haltbar bis ${fmtD(l.mhd)}`]);
  }
  return h.sort((a, b) => (a[0] === 'rot' ? 0 : 1) - (b[0] === 'rot' ? 0 : 1));
}

// ---------- Übersicht ----------
// Bausteine der Übersicht; Reihenfolge und Sichtbarkeit unter „Anpassen“ (aus: 1 = anfangs ausgeblendet)
const jahrJetzt = () => heute().slice(0, 4), aktiveVoelker = () => db.voelker.filter(v => v.status !== 'aufgelöst');
const kachel = (ziel, wert, text) => `<div class="karte kachel klick" onclick="gehe('${ziel}')"><b>${wert}</b>${text}</div>`;
const START_TEILE = [
  { k: 'standorte', label: 'Kachel Standplätze', kachel: () => kachel('standorte', db.standorte.length, 'Standplätze') },
  { k: 'voelker', label: 'Kachel Völker', kachel: () => kachel('voelker', aktiveVoelker().length, 'Völker') },
  { k: 'honig', label: 'Kachel Honigernte', kachel: () => { const j = jahrJetzt(), n = aktiveVoelker().length, kg = db.ernten.filter(e => e.produkt === 'Honig' && e.datum?.startsWith(j)).reduce((s, e) => s + (e.kg || 0), 0);
    return kachel('ernten', zahl(kg) + ' kg', `Honig ${j}${n ? ` · ⌀ ${zahl(kg / n)} kg/Volk` : ''}`); } },
  { k: 'aufgaben', label: 'Kachel offene Aufgaben', kachel: () => kachel('aufgaben', db.aufgaben.filter(a => !a.erledigt).length, 'offene Aufgaben') },
  { k: 'glaeser', label: 'Kachel volle Gläser', aus: 1, kachel: () => kachel('verkauf', zahl(db.lager.filter(istGlasware).reduce((s, l) => s + (l.menge || 0), 0), 0), 'volle Gläser auf Lager') },
  { k: 'einnahmen', label: 'Kachel Einnahmen', aus: 1, kachel: () => kachel('finanzen', euro(db.buchungen.filter(b => b.art === 'Einnahme' && b.datum.startsWith(jahrJetzt())).reduce((s, b) => s + b.betrag, 0)), 'Einnahmen ' + jahrJetzt()) },
  { k: 'arbeitszeit', label: 'Kachel Arbeitszeit', aus: 1, kachel: () => kachel('arbeit', dauerText(db.arbeitszeiten.filter(a => a.datum.startsWith(jahrJetzt())).reduce((s, a) => s + a.minuten, 0)), 'Arbeitszeit ' + jahrJetzt()) },
  { k: 'lagerwert', label: 'Kachel Lagerwert', aus: 1, kachel: () => kachel('lager', euro(db.lager.reduce((s, l) => s + (l.menge || 0) * (l.preis || 0), 0)), 'Lagerwert') },
  { k: 'uhr', label: 'Arbeitszeit Start/Stopp', html: () => uhrKarte() },
  { k: 'hinweise', label: 'Hinweise', html: () => { const h = alleHinweise();
    return `<h3>Hinweise</h3>${h.length ? `<ul class="hinweise">${h.map(([f, t]) => `<li class="${f}">${t}</li>`).join('')}</ul>` : '<ul class="hinweise"><li class="gruen">Alles in Ordnung – keine offenen Hinweise.</li></ul>'}`; } },
  { k: 'wetter', label: 'Wetter am Stand', html: () => `<h3>Wetter am Stand</h3><div id="start-wetter" class="leise">${db.standorte.some(hatKoord) ? 'Lade …' : 'Trage einen Standplatz mit Koordinaten ein, um Wetter und Vegetationsstand zu sehen.'}</div>` },
];
function zeigeStart() {
  // Aufeinanderfolgende Kacheln kommen in ein gemeinsames Raster
  let html = '', reihe = [];
  const raus = () => { if (reihe.length) html += `<div class="raster" style="margin-bottom:12px">${reihe.join('')}</div>`; reihe = []; };
  for (const t of geordnet('start')) { if (t.kachel) reihe.push(t.kachel()); else { raus(); html += t.html(); } }
  raus();
  main().innerHTML = kopf('Übersicht', '<button class="klein" onclick="gehe(\'einstellungen\')">⚙ Anpassen</button>') + visKarte() + html;
  const s = $('#start-wetter') && db.standorte.find(hatKoord);
  if (s) wetter(s).then(d => {
    const el = $('#start-wetter'); if (!el) return;
    const t = d.tage.find(x => x.datum === heute()) || d.tage[0], f = flug(t), p = phase(d.gts, heute());
    el.className = 'karte klick'; el.onclick = () => gehe('vegetation');
    el.innerHTML = `<h4>${esc(s.name)}: ${wetterText(d.jetzt.code)} ${zahl(d.jetzt.temp)} °C</h4>Flugwetter heute: ${marke(f[1], f[0])} · Grünlandtemperatursumme ${zahl(d.gts, 0)} · ${esc(p.name)}`;
  }).catch(() => { const el = $('#start-wetter'); if (el) el.textContent = 'Wetterdaten nicht erreichbar (keine Internetverbindung?).'; });
}

// ---------- Standplätze ----------
const hatKoord = s => s.lat != null && s.lon != null;
const beutenAm = s => [...new Set(db.voelker.filter(v => v.standortId === s.id && v.status !== 'aufgelöst').map(v => v.beute))];
function zeigeStandorte() {
  main().innerHTML = kopf('Standplätze', `<button class="haupt" onclick="bearbeiten('standorte')">+ Standplatz</button>`) +
    `<div class="zeile" style="margin-bottom:8px"><input id="ortsuche" placeholder="Ort suchen …" style="max-width:240px"><button onclick="ortSuchen()">Suchen</button><button onclick="gps()">📍 Mein Standort</button><button id="sperr-knopf" onclick="sperrEintragen()">⚠ Sperrzone</button>
     <label class="klein-t" style="display:flex;gap:6px;align-items:center">Flugradius <input type="number" min="0.5" max="10" step="0.5" value="${flugradius()}" onchange="radiusSetzen(this.value)" style="width:72px"> km</label>
     <span class="leise klein-t" id="kartenhinweis">Klick auf die Karte trägt dort einen neuen Standplatz ein. Marker lassen sich verschieben. Kreis = ${zahl(flugradius())} km Flugradius.</span></div>
    <div id="karte"></div><div id="tracht-info"></div>` +
    (aktiveZonen().length ? `<ul class="hinweise" style="margin-bottom:12px">${sperrHinweise().map(([f, t]) => `<li class="${f}">${t}</li>`).join('') || `<li>${aktiveZonen().length} aktive Sperrzone(n) eingetragen – keiner deiner Standplätze liegt darin.</li>`}</ul>` : '') +
    tabelle(['Name', 'Art', 'Völker', 'Koordinaten', 'Reg.-Nr.', 'Tracht', ''], db.standorte.map(s => [
      `<b>${esc(s.name)}</b>${s.notiz ? `<div class="leise klein-t">${esc(s.notiz)}</div>` : ''}`, esc(s.typ),
      db.voelker.filter(v => v.standortId === s.id && v.status !== 'aufgelöst').length,
      hatKoord(s) ? `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}` : marke('fehlen', 'gelb'), esc(s.regnr), esc(s.tracht),
      `<div class="zeile">${db.einstellungen.uhr ? '' : `<button class="klein" title="Arbeitszeit an diesem Stand starten" onclick="uhrStart('${s.id}')">⏱ Start</button>`}${hatKoord(s) ? `<button class="klein" onclick="trachtkarte('${s.id}')">Trachtkarte</button><button class="klein" onclick="potenzial('${s.id}')">🍯 Potenzial</button>` : ''}<button class="klein" onclick="bearbeiten('standorte','${s.id}')">Bearbeiten</button></div>`])) + sperrListeHtml();
  $('#ortsuche').onkeydown = e => { if (e.key === 'Enter') ortSuchen(); };
  if (!window.L) { $('#karte').outerHTML = '<p class="leer">Karte nicht verfügbar (keine Internetverbindung). Koordinaten können von Hand eingetragen werden.</p>'; return; }
  karte = L.map('karte').setView([47.6, 14.1], 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(karte);
  const punkte = [];
  for (const s of db.standorte.filter(hatKoord)) {
    const n = db.voelker.filter(v => v.standortId === s.id && v.status !== 'aufgelöst').length;
    const kreis = L.circle([s.lat, s.lon], { radius: flugradius() * 1000, color: '#e0a100', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(karte);
    const m = L.marker([s.lat, s.lon], { draggable: true }).addTo(karte).bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.typ)} · ${n} Völker`);
    m.on('dragend', () => { const p = m.getLatLng(); s.lat = +p.lat.toFixed(5); s.lon = +p.lng.toFixed(5); kreis.setLatLng(p); speichern(); });
    punkte.push([s.lat, s.lon]);
  }
  if (punkte.length) karte.fitBounds(punkte, { maxZoom: 13, padding: [40, 40] });
  sperrKreise();
  karte.on('click', e => {
    const lat = +e.latlng.lat.toFixed(5), lon = +e.latlng.lng.toFixed(5);
    if (sperrModus) { sperrModus = false; bearbeiten('sperrzonen', null, { lat, lon }); } else bearbeiten('standorte', null, { lat, lon, typ: 'Heimstand' });
  });
}
async function ortSuchen() {
  const q = $('#ortsuche').value.trim(); if (!q || !karte) return;
  try {
    const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(q)}`)).json();
    const o = r.results?.[0];
    if (!o) { $('#kartenhinweis').textContent = `„${q}“ nicht gefunden.`; return; }
    karte.setView([o.latitude, o.longitude], 14);
    $('#kartenhinweis').textContent = `${o.name}${o.admin1 ? ', ' + o.admin1 : ''} – jetzt auf die Karte klicken, um den Standplatz einzutragen.`;
  } catch { $('#kartenhinweis').textContent = 'Ortssuche nicht erreichbar.'; }
}
function gps() {
  if (!navigator.geolocation) return alert('Standortbestimmung wird von diesem Browser nicht unterstützt.');
  navigator.geolocation.getCurrentPosition(
    p => bearbeiten('standorte', null, { lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), typ: 'Heimstand' }),
    () => alert('Standort konnte nicht bestimmt werden. Bitte Freigabe im Browser erlauben.'), { enableHighAccuracy: true, timeout: 15000 });
}

// ---------- Stockführung ----------
function zeigeVoelker() {
  if (detailVolk && volk(detailVolk)) return zeigeVolk(volk(detailVolk));
  const gruppen = [...db.standorte, { id: '', name: 'Ohne Standplatz' }];
  main().innerHTML = kopf('Stockführung', `<button onclick="bearbeiten('durchsichten')" ${db.voelker.length ? '' : 'disabled'}>+ Durchsicht</button><button class="haupt" onclick="bearbeiten('voelker')">+ Volk</button>`) +
    (db.voelker.length ? '' : '<p class="leer">Noch keine Völker eingetragen.</p>') +
    gruppen.map(g => {
      const vs = db.voelker.filter(v => (v.standortId || '') === g.id || (g.id === '' && v.standortId && !standort(v.standortId)));
      if (!vs.length) return '';
      return `<h3>${esc(g.name)}</h3><div class="raster">${vs.map(v => {
        const d = letzteDurchsicht(v.id), h = v.status === 'aufgelöst' ? [] : volkHinweise(v);
        return `<div class="karte klick" onclick="detailVolk='${v.id}';render()"><h4>${esc(v.name)} ${v.status !== 'aktiv' ? marke(v.status) : ''}</h4>
          <div class="klein-t">${esc(v.beute)} · ${esc(v.rasse)} ${koeniginPunkt(v.koeniginJahr)}</div>
          <div class="leise klein-t">Letzte Durchsicht: ${d ? fmtD(d.datum) : '–'}</div>
          <div style="margin-top:6px">${h.length ? h.map(([f, t]) => marke(t, f)).join(' ') : v.status === 'aufgelöst' ? '' : marke('in Ordnung', 'gruen')}</div></div>`;
      }).join('')}</div>`;
    }).join('');
}
function zeigeVolk(v) {
  const id = v.id, ds = db.durchsichten.filter(d => d.volkId === id).sort(nachDatum);
  const honig = db.ernten.filter(e => e.volkId === id && e.produkt === 'Honig').reduce((s, e) => s + (e.kg || 0), 0);
  main().innerHTML = kopf(`<button class="klein" onclick="detailVolk=null;render()">←</button> Stockkarte ${esc(v.name)}`,
    `<button class="haupt" onclick="bearbeiten('durchsichten',null,{volkId:'${id}'})">+ Durchsicht</button><button onclick="bearbeiten('behandlungen',null,{volkId:'${id}'})">+ Behandlung</button>
     <button onclick="bearbeiten('ernten',null,{volkId:'${id}',standortId:'${v.standortId || ''}'})">+ Ernte</button><button onclick="vzVolk='${id}';gehe('varroa')">📷 Varroa zählen</button><button onclick="wandern('${id}')">Umstellen</button><button onclick="bearbeiten('voelker','${id}')">Bearbeiten</button>`) +
    `<div class="karte"><b>${sName(v.standortId)}</b> · ${esc(v.beute)} · Status ${esc(v.status)}<br>
      Königin: ${koeniginPunkt(v.koeniginJahr) || '–'} · ${esc(v.rasse)}${v.koeniginHerkunft ? ' · ' + esc(v.koeniginHerkunft) : ''}${v.gezeichnet ? ' · gezeichnet' : ''}<br>
      Honigertrag gesamt: ${zahl(honig)} kg ${volkHinweise(v).map(([f, t]) => marke(t, f)).join(' ')}${v.notiz ? `<div class="leise">${esc(v.notiz)}</div>` : ''}</div>
    ${kurvenHtml(id)}<h3>Durchsichten</h3>` +
    tabelle(['Datum', 'Weisel', 'Zellen', 'Brut', 'Gassen', 'Futter', 'Sanftmut', 'Varroa/Tag', 'kg', 'Maßnahmen / Notiz', ''], ds.map(d => [
      fmtD(d.datum), marke(d.weisel, d.weisel === 'weisellos' ? 'rot' : d.weisel === 'unklar' ? 'gelb' : 'gruen'), esc(d.zellen), zahl(d.brutwaben), zahl(d.gassen), esc(d.futter), zahl(d.sanftmut),
      d.varroa == null ? '–' : marke(zahl(d.varroa), varroaFarbe(d.varroa)), zahl(d.gewicht), esc([d.massnahmen, d.notiz].filter(Boolean).join(' – ')),
      `<button class="klein" onclick="bearbeiten('durchsichten','${d.id}')">✎</button>`])) +
    (db.varroa.some(z => z.volkId === id) ? '<h3>Varroa-Zählungen (Foto)</h3>' + vzTabelle(db.varroa.filter(z => z.volkId === id)) : '') +
    '<h3>Behandlungen</h3>' + tabelle(['Beginn', 'Mittel', 'Menge', 'Ende', ''], db.behandlungen.filter(b => b.volkId === id).sort(nachDatum).map(b => [fmtD(b.datum), esc(b.mittel), esc(b.menge), fmtD(b.ende), `<button class="klein" onclick="bearbeiten('behandlungen','${b.id}')">✎</button>`])) +
    '<h3>Ernten</h3>' + tabelle(['Datum', 'Produkt', 'Sorte', 'kg', ''], db.ernten.filter(e => e.volkId === id).sort(nachDatum).map(e => [fmtD(e.datum), esc(e.produkt), esc(e.sorte), zahl(e.kg, 2), `<button class="klein" onclick="bearbeiten('ernten','${e.id}')">✎</button>`])) +
    '<h3>Wanderungen</h3>' + tabelle(['Datum', 'Von', 'Nach', 'Grund'], db.wanderungen.filter(w => w.volkId === id).sort(nachDatum).map(w => [fmtD(w.datum), sName(w.von), sName(w.nach), esc(w.grund)]));
}
function wandern(id) {
  const v = volk(id);
  formular(`${v.name} umstellen`, [{ k: 'datum', label: 'Datum', typ: 'date', req: 1 }, { k: 'nach', label: 'Neuer Standplatz', typ: 'select', opts: optS(), req: 1 }, { k: 'grund', label: 'Grund / Tracht', breit: 1 }],
    { datum: heute() }, w => { const warn = wanderWarnung(v.standortId, w.nach); if (warn.length && !confirm(warn.join('\n\n') + '\n\nTrotzdem umstellen?')) return; db.wanderungen.push({ id: uid(), volkId: id, von: v.standortId, ...w }); v.standortId = w.nach; speichern(); render(); });
}

// ---------- Varroa-Zähler (Foto der Windel) ----------
let vz = null, vzVolk = '', vzZoom = 1;
function bildOp(modus, fn) {
  return new Promise((ok, fehler) => {
    const auf = indexedDB.open('imkerei-bilder', 1);
    auf.onupgradeneeded = () => auf.result.createObjectStore('bilder');
    auf.onerror = () => fehler(auf.error);
    auf.onsuccess = () => { const tx = auf.result.transaction('bilder', modus), rq = fn(tx.objectStore('bilder')); tx.oncomplete = () => ok(rq.result); tx.onerror = () => fehler(tx.error); };
  });
}
const vzTabelle = liste => tabelle(['Datum', 'Volk', 'Milben', 'Tage', 'pro Tag', ''], [...liste].sort(nachDatum).map(z => [fmtD(z.datum), vName(z.volkId), z.anzahl, z.tage, marke(zahl(z.proTag), varroaFarbe(z.proTag)),
  `<div class="zeile"><button class="klein" onclick="vzBild('${z.id}')">Bild</button><button class="klein gefahr" onclick="vzLoeschen('${z.id}')">Löschen</button></div>`]));

function zeigeVarroa() {
  const vs = optV();
  main().innerHTML = kopf('Varroa-Zähler') + (!vs.length ? '<p class="leer">Trage zuerst ein Volk ein.</p>' : `<div class="karte"><div class="formraster">
      <label>Volk<select id="vz-volk" onchange="vzVolk=this.value">${vs.map(([id, n]) => `<option value="${id}" ${id === vzVolk ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>Datum<input type="date" id="vz-datum" value="${heute()}"></label>
      <label>Windel lag (Tage)<input type="number" id="vz-tage" value="3" min="1" step="1" oninput="vzStand()"></label>
      <label>Bildbreite zeigt ca. (cm)<input type="number" id="vz-breite" value="30" min="5" step="1" onchange="vzNeu()"></label>
      <label>Empfindlichkeit<input type="range" id="vz-emp" min="1" max="9" value="5" onchange="vzNeu()"></label></div>
    <div class="zeile" style="margin-top:10px"><label class="btn haupt">📷 Foto der Windel<input type="file" accept="image/*" hidden onchange="vzLaden(this.files[0])"></label>
      <span class="leise klein-t">Helle Windel, senkrecht von oben, scharf und ohne Schatten fotografieren. Je kleiner der Ausschnitt, desto genauer.</span></div></div>
    <div id="vz-bereich"></div>`) + (db.varroa.length ? '<h3>Gespeicherte Zählungen</h3>' + vzTabelle(db.varroa) : '') +
    `<h3>Trainingsdaten für ein eigenes Erkennungsmodell</h3><div class="karte">Jede gespeicherte Zählung wird mit Originalfoto und deinen korrigierten Markierungen als Trainingsbeispiel abgelegt.
      <div style="margin:8px 0"><b>${vzTraining().length} Bilder</b> · ${vzTraining().reduce((s, z) => s + z.marken.length, 0)} markierte Milben · ${vzTraining().reduce((s, z) => s + z.entfernt.length, 0)} korrigierte Fehlerkennungen</div>
      <div class="balken"><i style="width:${Math.min(100, vzTraining().length / 2)}%"></i></div><p class="leise klein-t">Richtwert für ein erstes brauchbares Modell: etwa 200 Bilder von verschiedenen Tagen, Völkern und Lichtverhältnissen.</p>
      <button onclick="vzExport()" ${vzTraining().length ? '' : 'disabled'}>Trainingsdaten exportieren (ZIP)</button></div>`;
  if (vz && vs.length) vzZeigen();
}
async function vzLaden(datei) {
  if (!datei) return;
  let bild;
  try { bild = await createImageBitmap(datei); } catch { return alert('Das Bild konnte nicht gelesen werden.'); }
  const f = Math.min(1, 2400 / Math.max(bild.width, bild.height)), c = document.createElement('canvas');
  c.width = Math.round(bild.width * f); c.height = Math.round(bild.height * f);
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  vz = { bild: c, marken: [] }; vzZoom = 1;
  vzNeu();
}
function vzNeu() { if (!vz) return; vzErkennen(); vzZeigen(); }

// Sucht dunkle, rotbraune, ovale Flecken in Milbengröße (ca. 1,1 × 1,6 mm)
function vzErkennen() {
  const c = vz.bild, w = c.width, h = c.height, px = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const pxmm = vz.pxmm = w / ((+$('#vz-breite').value || 30) * 10), schwelle = 0.45 + (+$('#vz-emp').value) * 0.04;
  // Lokale Hintergrundhelligkeit aus stark verkleinertem Bild
  const k = Math.max(8, Math.round(pxmm * 6)), bw = Math.ceil(w / k), bh = Math.ceil(h / k), kc = document.createElement('canvas');
  kc.width = bw; kc.height = bh; kc.getContext('2d').drawImage(c, 0, 0, bw, bh);
  const bg = kc.getContext('2d').getImageData(0, 0, bw, bh).data, maske = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2], j = (Math.min(bh - 1, y / k | 0) * bw + Math.min(bw - 1, x / k | 0)) * 4;
    if (r > 40 && r > g * 1.1 && r > b * 1.25 && r * 2 + g * 3 + b < (bg[j] * 2 + bg[j + 1] * 3 + bg[j + 2]) * schwelle) maske[y * w + x] = 1;
  }
  const soll = 1.38 * pxmm * pxmm, stapel = [];
  vz.marken = []; vz.zuKlein = soll < 12;
  for (let start = 0; start < w * h; start++) {
    if (maske[start] !== 1) continue;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    maske[start] = 2; stapel.push(start);
    while (stapel.length) {
      const p = stapel.pop(), x = p % w, y = (p - x) / w;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, q = ny * w + nx;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && maske[q] === 1) { maske[q] = 2; stapel.push(q); }
      }
    }
    if (n < soll * 0.35 || n > soll * 2.5) continue;
    const mx = sx / n, my = sy / n, a = sxx / n - mx * mx, b = syy / n - my * my, ab = sxy / n - mx * my;
    const wurzel = Math.sqrt((a - b) ** 2 + 4 * ab * ab), l1 = (a + b + wurzel) / 2, l2 = (a + b - wurzel) / 2;
    if (l2 <= 0) continue;
    const gestreckt = Math.sqrt(l1 / l2), fuellung = n / (4 * Math.PI * Math.sqrt(l1 * l2)); // 1 = gefüllte Ellipse
    if (gestreckt <= 2.3 && fuellung >= 0.8 && n / ((x1 - x0 + 1) * (y1 - y0 + 1)) >= 0.45) vz.marken.push({ x: mx, y: my, auto: true });
  }
  vz.auto = vz.marken.length; vz.entfernt = [];
}
const vzRadius = () => Math.max(vz.pxmm * 1.8, vz.bild.width / 140);
function vzMalen(ctx) {
  ctx.drawImage(vz.bild, 0, 0);
  ctx.lineWidth = Math.max(2, vz.bild.width / 500); ctx.strokeStyle = '#00e5ff';
  for (const m of vz.marken) { ctx.beginPath(); ctx.arc(m.x, m.y, vzRadius(), 0, 7); ctx.stroke(); }
}
function vzStand() {
  if (!vz || !$('#vz-stand')) return;
  const n = vz.marken.length, tage = Math.max(1, +$('#vz-tage').value || 1), proTag = n / tage;
  $('#vz-stand').innerHTML = `<b>${n} Milben</b> in ${tage} Tagen = ${marke(zahl(proTag) + ' pro Tag', varroaFarbe(proTag))} <span class="leise klein-t">(automatisch erkannt: ${vz.auto})</span>`;
}
function vzZeigen() {
  const c = vz.bild;
  $('#vz-bereich').innerHTML = `<div class="karte" style="margin-top:12px"><div class="kopf"><div id="vz-stand"></div>
      <div class="zeile">${[1, 2, 4].map(z => `<button class="klein" onclick="vzZoom=${z};$('#vz-canvas').style.width='${z * 100}%'">${z}×</button>`).join('')}
      <button onclick="vz=null;render()">Verwerfen</button><button class="haupt" onclick="vzSpeichern()">Speichern</button></div></div>
    ${vz.zuKlein ? '<ul class="hinweise"><li class="rot">Die Milben sind in diesem Foto zu klein für eine sichere Erkennung. Näher herangehen oder die Bildbreite korrigieren.</li></ul>' : ''}
    <p class="leise klein-t">Auf das Bild tippen: Kreis antippen entfernt einen falschen Treffer, freie Stelle antippen ergänzt eine Milbe.</p>
    <div class="vz-rahmen"><canvas id="vz-canvas" width="${c.width}" height="${c.height}" style="width:${vzZoom * 100}%"></canvas></div></div>`;
  const cv = $('#vz-canvas'), ctx = cv.getContext('2d');
  vzMalen(ctx); vzStand();
  cv.onclick = e => {
    const f = c.width / cv.clientWidth, x = e.offsetX * f, y = e.offsetY * f, r = vzRadius() * 1.3;
    const i = vz.marken.findIndex(m => (m.x - x) ** 2 + (m.y - y) ** 2 < r * r);
    // Weggetippte automatische Treffer bleiben als Fehlerkennung für das Training erhalten
    if (i >= 0) { const [weg] = vz.marken.splice(i, 1); if (weg.auto) vz.entfernt.push(weg); } else vz.marken.push({ x, y });
    vzMalen(ctx); vzStand();
  };
}
async function vzSpeichern() {
  const c = vz.bild, n = vz.marken.length, tage = Math.max(1, +$('#vz-tage').value || 1), proTag = +(n / tage).toFixed(2);
  const volkId = $('#vz-volk').value, datum = $('#vz-datum').value || heute(), id = uid();
  // Bild mit Markierungen und Beschriftung
  const balken = Math.round(c.width / 28), aus = document.createElement('canvas'); aus.width = c.width; aus.height = Math.round(c.height + balken * 1.6);
  const ctx = aus.getContext('2d'); vzMalen(ctx);
  ctx.fillStyle = '#2b2416'; ctx.fillRect(0, c.height, c.width, balken * 1.6);
  ctx.fillStyle = '#fff'; ctx.font = `${balken}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
  ctx.fillText(`${volk(volkId)?.name} · ${fmtD(datum)} · ${n} Milben in ${tage} Tagen = ${zahl(proTag)}/Tag`, balken / 2, c.height + balken * 0.8, c.width - balken);
  const blob = await new Promise(ok => aus.toBlob(ok, 'image/jpeg', 0.85));
  // Unmarkiertes Original + Positionen = Trainingsbeispiel für ein eigenes Erkennungsmodell
  const roh = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9)), norm = m => ({ x: +(m.x / c.width).toFixed(5), y: +(m.y / c.height).toFixed(5), auto: !!m.auto });
  let training = true;
  try { await bildOp('readwrite', s => { s.put(roh, id + '-roh'); return s.put(blob, id); }); }
  catch { training = false; if (!confirm('Das Bild konnte nicht gespeichert werden (Speicher voll?). Zählung trotzdem ohne Bild speichern?')) return; }
  db.varroa.push({ id, volkId, datum, tage, anzahl: n, proTag, ...(training && { w: c.width, h: c.height, pxmm: +vz.pxmm.toFixed(3), marken: vz.marken.map(norm), entfernt: vz.entfernt.map(norm) }) }); speichern();
  vz = null; render();
}
async function vzBild(id) {
  const z = db.varroa.find(x => x.id === id), blob = await bildOp('readonly', s => s.get(id)).catch(() => null), dlg = $('#dlg');
  if (!blob) return alert('Zu dieser Zählung ist kein Bild gespeichert.');
  const url = URL.createObjectURL(blob);
  dlg.innerHTML = `<img src="${url}" style="width:100%;border-radius:8px" alt="Windel mit markierten Milben"><div class="btns"><span class="platz"></span>
    <a class="btn" href="${url}" download="varroa-${esc(volk(z.volkId)?.name ?? 'volk')}-${z.datum}.jpg">Herunterladen</a><button onclick="$('#dlg').close()">Schließen</button></div>`;
  dlg.onclose = () => { URL.revokeObjectURL(url); dlg.onclose = null; };
  dlg.showModal();
}
function vzLoeschen(id) {
  if (!confirm('Zählung und Bild löschen?')) return;
  db.varroa = db.varroa.filter(z => z.id !== id); speichern(); bildOp('readwrite', s => { s.delete(id + '-roh'); return s.delete(id); }).catch(() => {}); render();
}

// ZIP ohne Kompression (JPEGs sind bereits komprimiert)
const CRC_T = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function zip(dateien) {
  const enc = new TextEncoder(), teile = [], zentral = [];
  let pos = 0;
  for (const d of dateien) {
    const name = enc.encode(d.name), len = d.daten.length;
    let crc = ~0; for (let i = 0; i < len; i++) crc = CRC_T[(crc ^ d.daten[i]) & 255] ^ (crc >>> 8); crc = ~crc >>> 0;
    const lok = new DataView(new ArrayBuffer(30)), zen = new DataView(new ArrayBuffer(46));
    lok.setUint32(0, 0x04034b50, true); lok.setUint16(4, 20, true); lok.setUint16(6, 0x800, true); lok.setUint16(12, 0x21, true);
    lok.setUint32(14, crc, true); lok.setUint32(18, len, true); lok.setUint32(22, len, true); lok.setUint16(26, name.length, true);
    zen.setUint32(0, 0x02014b50, true); zen.setUint16(4, 20, true); zen.setUint16(6, 20, true); zen.setUint16(8, 0x800, true); zen.setUint16(14, 0x21, true);
    zen.setUint32(16, crc, true); zen.setUint32(20, len, true); zen.setUint32(24, len, true); zen.setUint16(28, name.length, true); zen.setUint32(42, pos, true);
    teile.push(lok, name, d.daten); zentral.push(zen, name); pos += 30 + name.length + len;
  }
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, zentral.reduce((s, t) => s + t.byteLength, 0), true); ende.setUint32(16, pos, true);
  return new Blob([...teile, ...zentral, ende], { type: 'application/zip' });
}
const vzTraining = () => db.varroa.filter(z => z.marken);
// Datensatz im YOLO-Format: images/, labels/ (Klasse x y Breite Höhe, normiert), data.yaml
async function vzExport() {
  const enc = new TextEncoder(), dateien = [], anmerkungen = [];
  for (const z of vzTraining()) {
    const roh = await bildOp('readonly', s => s.get(z.id + '-roh')).catch(() => null);
    if (!roh) continue;
    const seite = Math.max(2.4 * z.pxmm, 8), bw = (seite / z.w).toFixed(5), bh = (seite / z.h).toFixed(5);
    dateien.push({ name: `images/${z.id}.jpg`, daten: new Uint8Array(await roh.arrayBuffer()) },
      { name: `labels/${z.id}.txt`, daten: enc.encode(z.marken.map(m => `0 ${m.x} ${m.y} ${bw} ${bh}`).join('\n')) });
    anmerkungen.push({ bild: `${z.id}.jpg`, datum: z.datum, breite: z.w, hoehe: z.h, pixelProMm: z.pxmm, milben: z.marken, fehlerkennungen: z.entfernt });
  }
  if (!dateien.length) return alert('Noch keine Trainingsbilder vorhanden.');
  dateien.push({ name: 'data.yaml', daten: enc.encode('path: .\ntrain: images\nval: images\nnames:\n  0: varroa\n') },
    { name: 'anmerkungen.json', daten: enc.encode(JSON.stringify(anmerkungen, null, 1)) },
    { name: 'LIESMICH.txt', daten: enc.encode('Varroa-Trainingsdaten aus der Imkerei-App\n\nimages/  unmarkierte Originalfotos der Windel\nlabels/  je Bild eine Zeile pro Milbe im YOLO-Format: Klasse x y Breite Höhe (0..1)\nanmerkungen.json  alle Positionen; "auto" = von der App erkannt und bestätigt, sonst von Hand ergänzt;\n                  "fehlerkennungen" = von der App markiert, von Hand entfernt (keine Milbe)\ndata.yaml  Datensatzbeschreibung für das Training (vor dem Training einen Teil der Bilder als val abtrennen)\n') });
  herunterladen(`varroa-training-${heute()}.zip`, zip(dateien), 'application/zip');
}

// ---------- Bestandsbuch & Ernte ----------
function zeigeBehandlungen() {
  main().innerHTML = kopf('Bestandsbuch', `<button onclick="bestandsbuchPdf()">PDF / Drucken</button><button onclick="csvBehandlungen()">CSV exportieren</button><button class="haupt" onclick="bearbeiten('behandlungen')" ${db.voelker.length ? '' : 'disabled'}>+ Behandlung</button>`) +
    '<p class="leise klein-t">Dokumentation der Anwendung von Tierarzneimitteln und biotechnischen Verfahren je Volk.</p>' +
    tabelle(['Beginn', 'Volk', 'Standplatz', 'Mittel / Verfahren', 'Menge', 'Charge', 'Ende', 'Wartezeit', 'Anwender', ''], [...db.behandlungen].sort(nachDatum).map(b => [
      fmtD(b.datum), vName(b.volkId), sName(volk(b.volkId)?.standortId), esc(b.mittel), esc(b.menge), esc(b.charge), fmtD(b.ende), b.wartezeit != null ? `${b.wartezeit} T.` : '–', esc(b.anwender),
      `<button class="klein" onclick="bearbeiten('behandlungen','${b.id}')">✎</button>`]));
}
function zeigeErnten() {
  const proJahr = {};
  for (const e of db.ernten.filter(e => e.produkt === 'Honig')) proJahr[e.datum.slice(0, 4)] = (proJahr[e.datum.slice(0, 4)] || 0) + (e.kg || 0);
  const max = Math.max(1, ...Object.values(proJahr));
  main().innerHTML = kopf('Ernte', `<button class="haupt" onclick="bearbeiten('ernten')">+ Ernte</button>`) +
    '<p class="leise klein-t">Neue Ernten werden ins Lager gebucht, Honig je Sorte als loser Honig in kg (z. B. „Waldhonig lose“). Von dort wird beim Abfüllen abgezogen.</p>' +
    (Object.keys(proJahr).length ? `<div class="karte" style="margin-bottom:12px">${Object.entries(proJahr).sort().reverse().map(([j, kg]) => `<div class="klein-t">${j}: <b>${zahl(kg)} kg</b> Honig</div><div class="balken"><i style="width:${kg / max * 100}%"></i></div>`).join('')}</div>` : '') +
    tabelle(['Datum', 'Produkt', 'Sorte', 'kg', 'Wasser', 'Volk', 'Standplatz', 'Los', ''], [...db.ernten].sort(nachDatum).map(e => [
      fmtD(e.datum), esc(e.produkt), esc(e.sorte), zahl(e.kg, 2), e.wasser != null ? marke(zahl(e.wasser) + ' %', e.wasser > 18 ? 'rot' : 'gruen') : '–', vName(e.volkId), sName(e.standortId), esc(e.los),
      `<button class="klein" onclick="bearbeiten('ernten','${e.id}')">✎</button>`]));
}

// ---------- Lager ----------
function zeigeLager() {
  const wert = db.lager.reduce((s, l) => s + (l.menge || 0) * (l.preis || 0), 0);
  main().innerHTML = kopf('Lager', `<label class="btn">📄 Rechnung erfassen<input type="file" accept="application/pdf,image/*" hidden onchange="reLaden(this.files[0]);this.value=''"></label><button class="haupt" onclick="bearbeiten('lager')">+ Artikel</button>`) +
    `<div id="re-bereich">${reHtml()}</div>` + (db.lager.length ? `<p class="leise klein-t">${db.lager.length} Artikel · Lagerwert ${zahl(wert, 2)} €</p>` : '') +
    // Eigene Kategorien in eigener Reihenfolge; Artikel mit einer Kategorie, die nicht in der Liste steht, kommen hinten dazu
    [...new Set([...liste('lagerKat'), ...db.lager.map(l => l.kategorie || 'Sonstiges')])].map(k => {
      const ls = db.lager.filter(l => (l.kategorie || 'Sonstiges') === k); if (!ls.length) return '';
      return `<h3>${k}</h3>` + tabelle(['Artikel', 'Bestand', 'Mindest', 'Lagerort', 'Haltbar bis', ''], ls.map(l => [
        `<b>${esc(l.name)}</b>${l.notiz ? `<div class="leise klein-t">${esc(l.notiz)}</div>` : ''}`,
        marke(`${zahl(l.menge, 2)} ${l.einheit || ''}`, l.mindest != null && l.menge <= l.mindest ? 'rot' : 'gruen'), l.mindest != null ? zahl(l.mindest, 2) : '–', esc(l.ort), fmtD(l.mhd),
        `<div class="zeile"><button class="klein" onclick="buchen('${l.id}',1)">+ Zugang</button><button class="klein" onclick="buchen('${l.id}',-1)">− Abgang</button><button class="klein" onclick="bearbeiten('lager','${l.id}')">✎</button></div>`]));
    }).join('') + (db.lager.length ? '' : '<p class="leer">Noch keine Artikel im Lager.</p>') +
    (db.bewegungen.length ? '<h3>Letzte Lagerbewegungen</h3>' + tabelle(['Datum', 'Artikel', 'Menge', 'Grund'], [...db.bewegungen].sort(nachDatum).slice(0, 15).map(b => [fmtD(b.datum), esc(db.lager.find(l => l.id === b.lagerId)?.name ?? '(gelöscht)'), (b.menge > 0 ? '+' : '') + zahl(b.menge, 2), esc(b.grund)])) : '') + reListe();
}
function buchen(id, vz) {
  const l = db.lager.find(x => x.id === id);
  formular(`${vz > 0 ? 'Zugang' : 'Abgang'}: ${l.name}`, [{ k: 'menge', label: `Menge (${l.einheit || ''})`, typ: 'number', step: 'any', min: 0, req: 1 }, { k: 'datum', label: 'Datum', typ: 'date', req: 1 }, { k: 'grund', label: 'Grund', breit: 1, liste: ['Einkauf', 'Verkauf', 'Verbrauch', 'Ernte', 'Eigenbedarf', 'Schwund', 'Inventur'] }],
    { datum: heute() }, w => { l.menge = +((l.menge || 0) + vz * w.menge).toFixed(3); db.bewegungen.push({ id: uid(), lagerId: id, ...w, menge: vz * w.menge }); speichern(); render(); });
}

// ---------- Aufgaben ----------
function zeigeAufgaben() {
  const t = heute(), sort = (a, b) => (a.faellig || '9').localeCompare(b.faellig || '9');
  const zeile = a => [`<input type="checkbox" ${a.erledigt ? 'checked' : ''} onchange="abhaken('${a.id}')">`, `${a.erledigt ? '<s>' : ''}${esc(a.titel)}${a.erledigt ? '</s>' : ''}${a.notiz ? `<div class="leise klein-t">${esc(a.notiz)}</div>` : ''}`,
    a.faellig ? marke(fmtD(a.faellig), a.erledigt ? '' : a.faellig < t ? 'rot' : a.faellig === t ? 'gelb' : '') : '–', vName(a.volkId), sName(a.standortId), `<button class="klein" onclick="bearbeiten('aufgaben','${a.id}')">✎</button>`];
  const an = db.einstellungen.push && window.Notification?.permission === 'granted';
  main().innerHTML = kopf('Aufgaben', `<button class="haupt" onclick="bearbeiten('aufgaben')">+ Aufgabe</button>`) +
    `<div class="karte" style="margin-bottom:12px"><div class="kopf" style="margin:0"><div><b>Benachrichtigungen</b> ${marke(an ? 'ein' : 'aus', an ? 'gruen' : '')}
      <div class="leise klein-t">Meldet fällige Aufgaben und den Beginn wichtiger Arbeiten (z. B. Kirschblüte → Honigraum aufsetzen) mit dem besten Tag laut Wettervorhersage.</div>
      ${an ? `<div class="leise klein-t">${db.einstellungen.hintergrund ? 'Auf diesem Gerät prüft die App auch im Hintergrund, etwa einmal täglich.' : 'Auf diesem Gerät erscheinen die Meldungen beim Öffnen der App. Die Hintergrundprüfung gibt es nur in der installierten App unter Android/Chrome.'}</div>` : ''}</div>
      <button onclick="pushUmschalten()">${an ? 'Ausschalten' : 'Einschalten'}</button></div>
      <label class="check"><input type="checkbox" ${db.einstellungen.visAus ? '' : 'checked'} onchange="db.einstellungen.visAus=!this.checked;speichern();render()"> An die VIS-Meldung erinnern (ab den Stichtagen 30.4. und 31.10.)</label>
      <label class="check"><input type="checkbox" ${db.einstellungen.visOhneBestaetigung ? '' : 'checked'} ${db.einstellungen.visAus ? 'disabled' : ''} onchange="db.einstellungen.visOhneBestaetigung=!this.checked;speichern()"> VIS-Meldung muss in der App bestätigt werden – bis dahin täglich erinnern</label></div>
    ${visKarte()}<div id="vorschlaege"></div>` +
    tabelle(['', 'Aufgabe', 'Fällig', 'Volk', 'Standplatz', ''], db.aufgaben.filter(a => !a.erledigt).sort(sort).map(zeile)) +
    (db.aufgaben.some(a => a.erledigt) ? '<h3>Erledigt</h3>' + tabelle(['', 'Aufgabe', 'Fällig', 'Volk', 'Standplatz', ''], db.aufgaben.filter(a => a.erledigt).sort(sort).reverse().slice(0, 20).map(zeile)) : '');
  ladeVorschlaege();
}
// Fällige Arbeiten je Standplatz und Beutentyp, abgestimmt auf die Wettervorhersage
let vorschlagListe = [];
async function ladeVorschlaege() {
  const liste = [];
  for (const s of db.standorte.filter(hatKoord)) {
    const gruppen = new Map(beutenAm(s).map(b => [beuteGruppe(b), b]));
    if (!gruppen.size) continue;
    let d; try { d = await wetter(s); } catch { continue; }
    for (const [gruppe, beute] of gruppen) for (const m of meilensteine(beute, d, heute(), standortFaktor(beobAm(s)).k)) {
      const key = hinweisKey(heute(), s.id, gruppe, m);
      if (m.stand === 'jetzt' && !db.vorschlaege[key] && !liste.some(v => v.key === key)) liste.push({ key, s, m, beute: m.allgemein ? 'alle Beuten' : beute });
    }
  }
  vorschlagListe = liste;
  const el = $('#vorschlaege'); if (!el || ansicht !== 'aufgaben') return;
  el.innerHTML = !liste.length ? '' : '<h3>Vorschläge aus Vegetation und Wetter</h3>' + liste.map((v, i) => `<div class="karte" style="margin-bottom:8px">
    <h4>${esc(v.m.titel)} <span class="leise klein-t">${esc(v.s.name)} · ${esc(v.beute)}</span></h4><div class="klein-t">${esc(v.m.pflanze)} – ${esc(v.m.text)}</div>
    ${v.m.empf ? `<div><b>${esc(v.m.empf.text)}</b></div>` : ''}
    <div class="zeile" style="margin-top:8px"><button class="haupt klein" onclick="vorschlag(${i},1)">Als Aufgabe übernehmen</button><button class="klein" onclick="vorschlag(${i},0)">Ausblenden</button></div></div>`).join('') + '<h3>Meine Aufgaben</h3>';
}
function vorschlag(i, uebernehmen) {
  const v = vorschlagListe[i];
  db.vorschlaege[v.key] = 1;
  if (uebernehmen) db.aufgaben.push({ id: uid(), titel: v.m.titel, faellig: v.m.empf?.datum || heute(), standortId: v.s.id, volkId: '', notiz: v.m.text + (v.m.empf ? ' ' + v.m.empf.text : '') });
  speichern(); render();
}
async function pushUmschalten() {
  if (db.einstellungen.push && window.Notification?.permission === 'granted') { db.einstellungen.push = false; speichern(); return render(); }
  if (!('Notification' in window) || !navigator.serviceWorker) return alert('Dieser Browser unterstützt keine Benachrichtigungen. Am iPhone muss die App zuerst zum Home-Bildschirm hinzugefügt werden.');
  if (await Notification.requestPermission() !== 'granted') return alert('Benachrichtigungen wurden nicht erlaubt. Bitte in den Browser-Einstellungen für diese Seite freigeben.');
  const reg = await navigator.serviceWorker.ready;
  db.einstellungen.push = true; db.einstellungen.hintergrund = false;
  try { await reg.periodicSync.register('imkerei-check', { minInterval: 12 * 3600e3 }); db.einstellungen.hintergrund = true; } catch { /* nur installierte App unter Android/Chrome */ }
  speichern(); render(); meldeJetzt();
}
async function meldeJetzt() {
  if (!db.einstellungen.push || window.Notification?.permission !== 'granted' || !navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.ready;
  await statusSpiegeln();
  benachrichtige(h => reg.showNotification(h.titel, meldungOptionen(h))).catch(() => {});
}
function abhaken(id) { const a = db.aufgaben.find(x => x.id === id); a.erledigt = !a.erledigt; speichern(); render(); }

// ---------- Vegetation & Wetter (Open-Meteo, ortsbezogen) ----------
async function wetter(s) {
  const ck = 'imkerei-wx-' + s.id, c = JSON.parse(localStorage.getItem(ck) || 'null');
  if (c && c.v === 2 && Date.now() - c.t < 3600e3 && c.lat === s.lat && c.lon === s.lon) return c.d;
  const d = await holeWetter(s.lat, s.lon);
  localStorage.setItem(ck, JSON.stringify({ v: 2, t: Date.now(), lat: s.lat, lon: s.lon, d }));
  return d;
}

let vegBeute = null;
function arbeitenHtml(s, d) {
  const da = beutenAm(s), beute = BEUTEN.includes(vegBeute) ? vegBeute : da[0] || 'Zander', farbe = { jetzt: 'gruen', kommt: 'gelb', vorbei: '' };
  return `<div class="kopf" style="margin-top:20px"><h3 style="margin:0">Wichtige Arbeiten im Jahreslauf</h3>
      <select style="width:auto" onchange="vegBeute=this.value;render()">${BEUTEN.map(b => `<option value="${b}" ${b === beute ? 'selected' : ''}>${b}${da.includes(b) ? ' ●' : ''}</option>`).join('')}</select></div>` +
    tabelle(['Arbeit', 'Zeigerpflanze / Zeitpunkt', 'Stand'], meilensteine(beute, d, heute(), standortFaktor(beobAm(s)).k).map(m => [
      `<b>${esc(m.titel)}</b><div class="klein-t ${m.stand === 'jetzt' ? '' : 'leise'}">${esc(m.text)}</div>`, esc(m.pflanze),
      marke(m.stand === 'jetzt' ? 'jetzt fällig' : m.stand === 'kommt' ? m.wann : 'vorbei', farbe[m.stand]) + (m.empf ? `<div class="klein-t">${esc(m.empf.text)}</div>` : '')])) +
    '<p class="leise klein-t">● = Beutentyp steht an diesem Standplatz. Zeitpunkte sind Richtwerte aus Wärmesumme und Wettervorhersage – die eigene Beobachtung am Volk geht vor.</p>';
}

async function zeigeVegetation() {
  const mit = db.standorte.filter(hatKoord);
  if (!mit.length) { main().innerHTML = kopf('Vegetation & Wetter') + '<p class="leer">Trage zuerst einen Standplatz mit Koordinaten ein – die Daten werden für genau diesen Ort abgerufen.</p><button class="haupt" onclick="gehe(\'standorte\')">Zu den Standplätzen</button>'; return; }
  const s = mit.find(x => x.id === vegId) || mit[0];
  main().innerHTML = kopf('Vegetation & Wetter', `<select onchange="vegId=this.value;render()">${mit.map(x => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`) + '<div id="veg" class="leise">Lade aktuelle Daten …</div>';
  let d;
  try { d = await wetter(s); } catch { if ($('#veg')) $('#veg').textContent = 'Daten konnten nicht geladen werden (keine Internetverbindung?).'; return; }
  if (ansicht !== 'vegetation' || !$('#veg')) return;
  const p = phase(d.gts, heute()), monat = +heute().slice(5, 7);
  const max = Math.max(250, ...d.verlauf), n = d.verlauf.length, y = v => 190 - v / max * 180;
  const pollen = d.pollen && Object.entries(POLLEN).map(([k, name]) => [name, d.pollen[k]]).filter(([, v]) => v > 0);
  $('#veg').className = '';
  $('#veg').innerHTML = `<div class="raster">
      <div class="karte"><div class="leise klein-t">Aktuell</div><h4>${wetterText(d.jetzt.code)} ${zahl(d.jetzt.temp)} °C</h4>Luftfeuchte ${zahl(d.jetzt.feuchte, 0)} % · Wind ${zahl(d.jetzt.wind, 0)} km/h</div>
      <div class="karte"><div class="leise klein-t">Grünlandtemperatursumme</div><h4>${zahl(d.gts, 0)}</h4>${d.beginn ? `Vegetationsbeginn (200) am ${fmtD(d.beginn)}` : `noch ${zahl(200 - d.gts, 0)} bis Vegetationsbeginn`}${d.fehlend ? `<div class="leise klein-t">${d.fehlend} Tage ohne Messwert</div>` : ''}</div>
      <div class="karte"><div class="leise klein-t">Phänologische Jahreszeit</div><h4>${esc(p.name)}</h4><span class="klein-t">Zeigerpflanzen: ${esc(p.zeiger)}</span></div></div>
    <ul class="hinweise" style="margin-top:12px"><li class="gruen"><b>Am Bienenstand jetzt:</b> ${esc(p.tipp)}</li></ul>
    ${arbeitenHtml(s, d)}
    <h3>Flugwetter – 7 Tage</h3><div class="tage">${d.tage.map(t => { const f = flug(t); return `<div class="karte"><div class="klein-t">${new Date(t.datum).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'numeric' })}</div><div class="gross">${wetterText(t.code).split(' ')[0]}</div>
      <b>${zahl(t.tmax, 0)}°</b> / ${zahl(t.tmin, 0)}°<div class="leise klein-t">${zahl(t.regen)} mm · ${zahl(t.wind, 0)} km/h</div>${marke(f[1], f[0])}</div>`; }).join('')}</div>
    <h3>Trachtkalender (Schätzung für diesen Ort)</h3>` +
    trachtTabelle(s, d) +
    `<p class="leise klein-t">Blühfenster sind Richtwerte aus der Wärmesumme. Trage den Blühbeginn ein, den du am Stand siehst – die App passt Kalender und Arbeiten dann an diesen Standplatz an.</p>
    <h3>Pollenflug aktuell</h3>${!d.pollen ? '<p class="leer">Keine Pollendaten verfügbar.</p>' : pollen.length ? `<div class="zeile">${pollen.map(([name, v]) => marke(`${name}: ${zahl(v)} Körner/m³`, v > 50 ? 'rot' : v > 10 ? 'gelb' : 'gruen')).join('')}</div>` : '<p class="leer">Derzeit kein messbarer Pollenflug (Erle, Birke, Gräser, Beifuß, Ragweed).</p>'}
    <h3>Verlauf der Grünlandtemperatursumme ${heute().slice(0, 4)}</h3>
    <svg class="diagramm" viewBox="0 0 ${Math.max(n, 2)} 200" preserveAspectRatio="none"><line x1="0" x2="${n}" y1="${y(200)}" y2="${y(200)}" stroke="#3d8b40" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
      <polyline fill="none" stroke="#e0a100" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${d.verlauf.map((v, i) => `${i},${y(v).toFixed(1)}`).join(' ')}"/></svg>
    <p class="leise klein-t">Gestrichelt: Schwelle 200 (Vegetationsbeginn). Wetterdaten: Open-Meteo, Standort ${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}.</p>`;
}

// ---------- Daten ----------
function herunterladen(name, text, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: typ })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function csvBehandlungen() {
  const z = [['Beginn', 'Volk', 'Standplatz', 'Mittel', 'Menge', 'Charge', 'Ende', 'Wartezeit (Tage)', 'Anwender', 'Notiz'],
    ...[...db.behandlungen].sort(nachDatum).map(b => [fmtD(b.datum), volk(b.volkId)?.name, standort(volk(b.volkId)?.standortId)?.name, b.mittel, b.menge, b.charge, b.ende ? fmtD(b.ende) : '', b.wartezeit, b.anwender, b.notiz])];
  herunterladen(`bestandsbuch-${heute()}.csv`, '﻿' + z.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv');
}
function zeigeDaten() {
  main().innerHTML = kopf('Daten') + `<div class="karte"><p>Alle Einträge werden nur in diesem Browser auf diesem Gerät gespeichert. Sichere sie regelmäßig als Datei. Die Fotos der Varroa-Zählungen und die Dateien erfasster Rechnungen sind in der Sicherung nicht enthalten – lade sie bei Bedarf einzeln herunter.</p>
    <div class="zeile"><button class="haupt" onclick="herunterladen('imkerei-sicherung-${heute()}.json', JSON.stringify(db, null, 1), 'application/json')">Sicherung herunterladen</button>
    <label class="btn">Sicherung einspielen <input type="file" accept=".json" hidden onchange="einspielen(this.files[0])"></label></div></div>
    <p class="leise klein-t">${Object.entries(db).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}: ${v.length}`).join(' · ')}</p>`;
}
async function einspielen(datei) {
  if (!datei) return;
  try {
    const neu = JSON.parse(await datei.text());
    if (!Array.isArray(neu.voelker) || !Array.isArray(neu.standorte)) throw new Error();
    if (!confirm('Die aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) return;
    db = uebernehmen(Object.assign(leer(), neu)); speichern(); gehe('start');
  } catch { alert('Diese Datei ist keine gültige Imkerei-Sicherung.'); }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.(); // Browser bitten, die Daten nicht automatisch zu löschen
$('header h1').insertAdjacentHTML('beforeend', ` <small class="version">v${VERSION}</small>`);
render();
statusSpiegeln(); meldeJetzt();
