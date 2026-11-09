// Standplatz suchen: für beliebige Punkte Trachtpotenzial (AMA INVEKOS), Boden, Wald, Dürreindex und Trachtkarte (OpenStreetMap)
// laden und bis zu 3 Punkte vergleichen – ohne Satellit, ohne Anmeldung, ohne Kontingent.
// Wird vor app.js geladen, nutzt Hilfsfunktionen anderer Dateien erst zur Laufzeit. Speichert nichts in db.

const SU_MAX = 3;
// Einträge { nr, name, lat, lon, r, laeuft, fehler, ergebnis, stand, trachtkarte }; nr bleibt fest (Ziel #su-tracht-<nr>), der Index verschiebt sich
let suPunkte = [], suNr = 0, suEingabe = { lat: '', lon: '', r: '' }, suSicht = null, suAufPunkt = false;   // suSicht: Ausschnitt der Karte über das Neuzeichnen hinweg
const suZahl = v => parseFloat(String(v ?? '').replace(',', '.'));   // Komma oder Punkt; leer → NaN
const suRadius = r => Math.min(3, Math.max(1, suZahl(r) || 3));   // wie der Flugradius der App: höchstens 3 km
const suNeu = () => { if (ansicht === 'suche') zeigeSuche(); };

// Hängt einen Punkt an (der älteste fällt bei mehr als SU_MAX weg), rechnet ihn und liefert seinen Index
async function suPunkt(lat, lon, r) {
  const p = { nr: ++suNr, name: `Suchpunkt ${suNr}`, lat: +(+lat).toFixed(5), lon: +(+lon).toFixed(5), r: suRadius(r), laeuft: true, fehler: null, ergebnis: null };
  suPunkte.push(p); if (suPunkte.length > SU_MAX) suPunkte.shift();
  suAufPunkt = true;   // Karte beim nächsten Zeichnen auf den neuen Punkt
  suNeu();
  await suRechnen(suPunkte.indexOf(p));
  suNeu();
  return suPunkte.indexOf(p);
}
// Wie potenzial(), aber für einen Punkt ohne id: Felder, Landschaftselemente, Trockenheit, Boden, Wald – nur in den Punkt geschrieben
async function suRechnen(i) {
  const p = suPunkte[i]; if (!p) return;
  Object.assign(p, { laeuft: true, fehler: null, ergebnis: null });
  const stand = t => { p.stand = t; const el = $(`#su-stand-${p.nr}`); if (el) el.textContent = t; };
  try {
    stand('Suche die neuesten Felddaten …');
    const jahr = await invekosNeuestes();
    if (!jahr) throw new Error('Felddaten der AMA nicht erreichbar – keine Internetverbindung?');
    const [felder, wetter] = await Promise.all([felderHolen(p, jahr, p.r, stand), trockenheitHolen(p, +jahr).catch(() => null)]);
    stand('Lade Landschaftselemente …');
    const lse = await lseHolen(p, jahr, p.r, felder.nektarFlaechen);
    if (lse.length) { felder.kulturen[LSE_NAME] = lse.reduce((a, n) => a + n.ha, 0); felder.nektarFlaechen.push(...lse); }
    stand('Lade Boden und Wald …');
    const [boden, wald] = await Promise.all([bodenHolen(felder.nektarFlaechen).catch(() => null), waldHolen(p.lat, p.lon, p.r).catch(() => null)]);
    const { zeilen, rest, min, max, schaetzung } = potRechnen(p, felder, wetter, p.r);
    p.ergebnis = { jahr, min, max, schaetzung, wald, boden, wetter, zeilen, rest, flaechen: felder.nektarFlaechen };
  } catch (e) { p.fehler = suFehlerText(e); }
  finally { p.laeuft = false; }
}
// Netzfehler des Browsers („Failed to fetch“, „NetworkError“, „Load failed“) und Zeitgrenze auf Deutsch; andere TypeErrors sind Programmfehler und zeigen ihren Text
function suFehlerText(e) {
  if (/Failed to fetch|NetworkError|Load failed/i.test(e?.message)) return 'Keine Verbindung – bitte später nochmal';
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'Keine Antwort in der Zeit – bitte später nochmal';
  return e?.message || String(e);
}
// Grobe Grenzen Österreichs: nur dort gibt es AMA-Felddaten
const suInOesterreich = (lat, lon) => lat >= 46.3 && lat <= 49.1 && lon >= 9.5 && lon <= 17.2;
function suOrtHinweis(p) {
  if (suInOesterreich(p.lat, p.lon)) return '';
  return `<p class="klein-t rot-t">Liegt außerhalb Österreichs – Felddaten der AMA gibt es nur für Österreich.${suInOesterreich(p.lon, p.lat) ? ' Breite und Länge vertauscht?' : ''}</p>`;
}
// Solange der Punkt rechnet, kein zweiter Lauf; Lade-Zeile sofort zeigen
async function suNeuRechnen(i) {
  const p = suPunkte[i]; if (!p || p.laeuft) return;
  Object.assign(p, { laeuft: true, fehler: null, ergebnis: null, stand: '' });
  suNeu(); await suRechnen(suPunkte.indexOf(p)); suNeu();
}
function suEntfernen(i) { suPunkte.splice(i, 1); suNeu(); }
function suPruefen() {
  const lat = suZahl($('#su-lat').value), lon = suZahl($('#su-lon').value);
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return alert('Bitte Breite und Länge eingeben (z. B. 47,72 und 16,04) oder auf die Karte klicken.');
  // Doppelklick: derselbe Punkt (gleiche Koordinaten und gleicher Radius) wird nicht nochmal angelegt
  const r = suRadius($('#su-r').value), da = suPunkte.find(p => p.lat === +lat.toFixed(5) && p.lon === +lon.toFixed(5) && p.r === r);
  if (da) { if (da.fehler) suNeuRechnen(suPunkte.indexOf(da)); return; }
  suPunkt(lat, lon, r);
}
// Übernimmt Koordinaten ins Standplatz-Formular; der Flugradius gilt für alle Standplätze, daher nur nach Rückfrage.
// Nach dem Speichern geht es zur Seite Standplätze.
function suAnlegen(i) {
  const p = suPunkte[i]; if (!p) return;
  if (p.r !== flugradius() && confirm(`Flugradius für alle Standplätze auf ${zahl(p.r)} km setzen?`)) radiusSetzen(p.r);
  bearbeiten('standorte', null, { lat: p.lat, lon: p.lon, typ: 'Heimstand' }, () => gehe('standorte'));
}

// ---------- Trachtkarte eines Suchpunkts ----------
const suKnopf = (text, code, art = 'klein') => `<button class="${art}" onclick="${code}">${text}</button>`;
function suTrachtHtml(p) {
  if (p.trachtLaedt) return '<p class="leise tracht-laden">Lade Flächendaten aus OpenStreetMap … das kann bis zu einer halben Minute dauern.</p>';
  return p.trachtkarte ? trachtInfo(p, `<div class="zeile" style="margin-top:6px">${suKnopf('Trachtkarte neu laden', `suTracht(${p.nr})`)}</div>`) : suKnopf('Trachtkarte laden', `suTracht(${p.nr})`);
}
async function suTracht(nr) {
  const p = suPunkte.find(x => x.nr === nr); if (!p) return;
  const ziel = `#su-tracht-${nr}`, vorher = p.trachtkarte, meiner = p.trachtLauf = (p.trachtLauf || 0) + 1;
  p.trachtLaedt = true;
  await trachtkarte(null, p, p.r, ziel, `suTracht(${nr})`);
  if (meiner !== p.trachtLauf) return;   // derselbe Punkt wurde inzwischen neu angestoßen
  p.trachtLaedt = false;
  const el = suPunkte.includes(p) && $(ziel);
  if (!el || p.trachtkarte !== vorher) return;   // geladen: trachtkarte hat die Kachel samt Knopf gezeichnet
  // Nicht geladen: von einer anderen Trachtkarte überholt (Lade-Anzeige steht noch) oder Fehlermeldung – Knopf wieder anbieten
  el.innerHTML = el.innerHTML.includes('tracht-laden') ? `<p class="leise klein-t">Abgebrochen – inzwischen wurde eine andere Trachtkarte geladen.</p>${suKnopf('Trachtkarte laden', `suTracht(${nr})`)}`
    : el.innerHTML + suKnopf('Nochmal versuchen', `suTracht(${nr})`);
}

// ---------- Anzeige ----------
function suDuerre(w) {
  if (w?.art === 'spei') return speiText(w);
  if (w) return `Niederschlag ${fmtD(w.von)} bis ${fmtD(w.bis)}: ${zahl(w.anteil * 100, 0)} % des Mittels der ${w.jahre} Jahre davor → Nektarfaktor ${zahl(w.faktor, 2)}`;
  return 'Weder Dürreindex noch Niederschlagsdaten erreichbar – ohne Trockenheitsfaktor gerechnet.';
}
function suKachelHtml(p, i) {
  const e = p.ergebnis, umkreis = Math.max(e?.schaetzung ?? 1, 1);
  const inhalt = p.laeuft ? `<p class="leise" id="su-stand-${p.nr}">${esc(p.stand || 'Rechne …')}</p>`
    : p.fehler ? `<p class="leer">Konnte nicht gerechnet werden (${esc(p.fehler)}). Bei großem Flugradius dauert es länger – „Neu rechnen“ versuchen.</p>`
    : `<div class="raster">
        <div class="karte kachel"><b>${zahl(e.min, 0)}–${zahl(e.max, 0)} kg</b>Honigpotenzial im Flugradius (AMA ${e.jahr})</div>
        <div class="karte kachel"><b>${zahl(e.min / umkreis, 0)}–${zahl(e.max / umkreis, 0)} kg</b>je Volk, geteilt auf ${zahl(umkreis, 0)} Völker im Umkreis (geschätzt aus ${zahl(voelkerdichte())} je km²)</div></div>` +
      tabelle(['Tracht', 'Fläche', 'Blüte', 'Potenzial'], e.zeilen.map(z => [`<b>${esc(z.g[1])}</b>`, zahl(z.ha, 1) + ' ha',
        z.g[5][0] === z.g[5][1] ? MONAT[z.g[5][0]] : `${MONAT[z.g[5][0]]}–${MONAT[z.g[5][1]]}`, `${zahl(z.min * z.fb, 0)}–${zahl(z.max * z.fb, 0)} kg`])) +
      `<p class="leise klein-t">${!e.boden || e.boden.gering + e.boden.mittel + e.boden.hoch > 0 ? bodenText(e.boden) : 'Keine Trachtflächen – Boden nicht nachgeschlagen'}</p>
      <p class="leise klein-t">${e.wald ? waldText(e.wald) : 'Waldkarte nicht erreichbar'}</p>
      <p class="leise klein-t">${suDuerre(e.wetter)}</p>`;
  return `<div class="karte" style="margin-bottom:12px"><h4>${esc(p.name)} · ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} · ${zahl(p.r)} km</h4>${suOrtHinweis(p)}${inhalt}
    <div id="su-tracht-${p.nr}" style="margin-top:8px">${suTrachtHtml(p)}</div>
    <div class="zeile" style="margin-top:8px">${suKnopf('Als Standplatz anlegen', `suAnlegen(${i})`, 'haupt')}${p.fehler ? suKnopf('Neu rechnen', `suNeuRechnen(${i})`) : ''}${suKnopf('Entfernen', `suEntfernen(${i})`)}</div></div>`;
}
// Vergleich: Spalten = Punkte
function suVergleichHtml(punkte) {
  const pz = x => Math.round(x * 100) + ' %', w = (p, f) => p.ergebnis ? f(p.ergebnis) : p.laeuft ? '…' : '–';
  return tabelle(['', ...punkte.map(p => esc(p.name))], [
    ['Potenzial', ...punkte.map(p => w(p, e => `${zahl(e.min, 0)}–${zahl(e.max, 0)} kg`))],
    ['Wald', ...punkte.map(p => w(p, e => e.wald ? pz(e.wald.anteil) : '–'))],
    ['Boden gering/mittel/hoch', ...punkte.map(p => w(p, e => e.boden ? `${pz(e.boden.gering)} / ${pz(e.boden.mittel)} / ${pz(e.boden.hoch)}` : '–'))],
    ['Völker im Umkreis (geschätzt)', ...punkte.map(p => w(p, e => zahl(e.schaetzung, 0)))],
  ]);
}
function zeigeSuche() {
  if (karte) { if (!suAufPunkt) suSicht = [karte.getCenter(), karte.getZoom()]; karte.remove(); karte = null; }
  const r = suEingabe.r || suRadius(flugradius());
  main().innerHTML = kopf('Standplatz suchen', `<button class="klein" onclick="gehe('standorte')">← Standplätze</button>`) +
    `<div class="zeile" style="margin-bottom:8px">
      <label class="klein-t" style="display:flex;gap:6px;align-items:center">Breite <input id="su-lat" inputmode="decimal" value="${esc(suEingabe.lat)}" oninput="suEingabe.lat=this.value" placeholder="47,72" style="width:96px"></label>
      <label class="klein-t" style="display:flex;gap:6px;align-items:center">Länge <input id="su-lon" inputmode="decimal" value="${esc(suEingabe.lon)}" oninput="suEingabe.lon=this.value" placeholder="16,04" style="width:96px"></label>
      <label class="klein-t" style="display:flex;gap:6px;align-items:center">Flugradius <input id="su-r" type="number" min="1" max="3" step="0.5" value="${esc(r)}" oninput="suEingabe.r=this.value" style="width:72px"> km</label>
      <button class="haupt" onclick="suPruefen()">Punkt prüfen</button></div>
    <p class="leise klein-t">Klick auf die Karte setzt Breite und Länge. Gerechnet wird wie bei 🍯 Potenzial (AMA-Felder, Boden, Wald, Dürreindex), ohne Satellit und ohne Anmeldung. Nichts davon wird gespeichert; bis zu ${SU_MAX} Punkte stehen nebeneinander.</p>
    <div id="karte"></div>` +
    (suPunkte.length ? suPunkte.map(suKachelHtml).join('') + `<h4>Vergleich</h4>${suVergleichHtml(suPunkte)}`
      : '<p class="leer">Noch kein Punkt geprüft.</p>') +
    `<p class="leise klein-t">Richtwerte wie unter 🍯 Potenzial, Völker im Umkreis geschätzt aus der Völkerdichte. ${QUELLEN}; Trachtkarte: OpenStreetMap.</p>`;
  if (!window.L) { $('#karte').outerHTML = '<p class="leer">Karte nicht verfügbar (keine Internetverbindung). Koordinaten oben von Hand eintragen.</p>'; return; }
  karte = L.map('karte');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(karte);
  for (const p of suPunkte) {
    L.circle([p.lat, p.lon], { radius: p.r * 1000, color: '#e0a100', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(karte);
    L.marker([p.lat, p.lon]).addTo(karte).bindTooltip(p.name);
    for (const n of p.ergebnis?.flaechen || []) L.geoJSON(n.g, { style: { stroke: false, fillColor: '#e0a100', fillOpacity: 0.55 } }).bindTooltip(`${esc(n.name)} · ${zahl(n.ha, 2)} ha`).addTo(karte);
  }
  const letzter = suPunkte[suPunkte.length - 1];
  if (suAufPunkt && letzter) { karte.setView([letzter.lat, letzter.lon], 12); suAufPunkt = false; }
  else if (suSicht) karte.setView(...suSicht); else if (letzter) karte.setView([letzter.lat, letzter.lon], 12); else karte.setView([47.6, 14.1], 7);
  karte.on('click', e => {
    suEingabe.lat = $('#su-lat').value = String(+e.latlng.lat.toFixed(5)).replace('.', ',');
    suEingabe.lon = $('#su-lon').value = String(+e.latlng.lng.toFixed(5)).replace('.', ',');
  });
}
