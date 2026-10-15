// Zusatzfunktionen: Finanzen, Bestandsbuch-PDF, Trachtkarte, Blühbeobachtungen, Verlaufskurven, Spracheingabe.
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

// ---------- Finanzen ----------
let finJahr = null;
const euro = n => Number(n || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
// Lineare Abschreibung in ganzen Jahren ab dem Anschaffungsjahr
const afa = (inv, jahr) => { const start = +inv.datum.slice(0, 4); return jahr >= start && jahr < start + inv.jahre ? inv.betrag / inv.jahre : 0; };
const restwert = (inv, jahr) => { const start = +inv.datum.slice(0, 4); return jahr < start ? inv.betrag : Math.max(0, inv.betrag - inv.betrag / inv.jahre * Math.min(inv.jahre, jahr - start + 1)); };

function zeigeFinanzen() {
  const jahre = [...new Set([heute().slice(0, 4), ...db.buchungen.map(b => b.datum.slice(0, 4)), ...db.investitionen.map(i => i.datum.slice(0, 4))])].sort().reverse();
  const jahr = jahre.includes(finJahr) ? finJahr : jahre[0], bs = db.buchungen.filter(b => b.datum.startsWith(jahr));
  const summe = art => bs.filter(b => b.art === art).reduce((s, b) => s + (b.betrag || 0), 0);
  const ein = summe('Einnahme'), aus = summe('Ausgabe'), abschr = db.investitionen.reduce((s, i) => s + afa(i, +jahr), 0), ergebnis = ein - aus - abschr;
  const voelker = db.voelker.filter(v => v.status !== 'aufgelöst').length, honig = db.ernten.filter(e => e.produkt === 'Honig' && e.datum?.startsWith(jahr)).reduce((s, e) => s + (e.kg || 0), 0);
  const gruppen = art => { const g = {}; for (const b of bs.filter(b => b.art === art)) g[b.kategorie || 'Sonstiges'] = (g[b.kategorie || 'Sonstiges'] || 0) + b.betrag; return Object.entries(g).sort((a, b) => b[1] - a[1]); };
  const balken = (liste, gesamt) => liste.map(([k, v]) => `<div class="klein-t">${esc(k)}: <b>${euro(v)}</b></div><div class="balken"><i style="width:${gesamt ? v / gesamt * 100 : 0}%"></i></div>`).join('') || '<span class="leise klein-t">keine Buchungen</span>';
  main().innerHTML = kopf('Finanzen', `<select style="width:auto" onchange="finJahr=this.value;render()">${jahre.map(j => `<option ${j === jahr ? 'selected' : ''}>${j}</option>`).join('')}</select>
      <button onclick="bearbeiten('investitionen')">+ Investition</button><button class="haupt" onclick="bearbeiten('buchungen')">+ Buchung</button>`) +
    `<div class="raster">
      <div class="karte kachel"><b>${euro(ein)}</b>Einnahmen ${jahr}</div>
      <div class="karte kachel"><b>${euro(aus)}</b>Ausgaben ${jahr}</div>
      <div class="karte kachel"><b>${euro(abschr)}</b>Abschreibung Investitionen</div>
      <div class="karte kachel"><b style="color:var(--${ergebnis >= 0 ? 'gruen' : 'rot'})">${euro(ergebnis)}</b>Ergebnis ${jahr}</div></div>
    <div class="karte" style="margin-top:12px">Kosten je Volk: <b>${voelker ? euro((aus + abschr) / voelker) : '–'}</b> · Ergebnis je Volk: <b>${voelker ? euro(ergebnis / voelker) : '–'}</b>
      · Kosten je kg Honig: <b>${honig ? euro((aus + abschr) / honig) : '–'}</b><div class="leise klein-t">Gerechnet mit ${voelker} aktuellen Völkern und ${zahl(honig)} kg Honigernte ${jahr}. Kosten = Ausgaben + Abschreibung.</div></div>
    ${(() => { // Eigene Arbeitszeit als Wert, nicht als Geldfluss
      const az = db.arbeitszeiten.filter(a => a.datum.startsWith(jahr)); if (!az.length) return '';
      const min = az.reduce((s, a) => s + a.minuten, 0), wert = az.reduce((s, a) => s + zeitWert(a), 0);
      return `<div class="karte klick" style="margin-top:12px" onclick="gehe('arbeit')">Arbeitszeit ${jahr}: <b>${dauerText(min)}</b>${lohn() != null || az.some(a => a.lohn != null) ? ` · Wert <b>${euro(wert)}</b> · Ergebnis inkl. Arbeitszeit: <b style="color:var(--${ergebnis - wert >= 0 ? 'gruen' : 'rot'})">${euro(ergebnis - wert)}</b>
        · Kosten je kg Honig inkl. Arbeit: <b>${honig ? euro((aus + abschr + wert) / honig) : '–'}</b>` : ' · <span class="leise">Stundenlohn unter Arbeitszeit eintragen, dann wird sie hier bewertet.</span>'}</div>`; })()}
    <div class="raster" style="margin-top:12px"><div class="karte"><h4>Einnahmen nach Kategorie</h4>${balken(gruppen('Einnahme'), ein)}</div><div class="karte"><h4>Ausgaben nach Kategorie</h4>${balken(gruppen('Ausgabe'), aus)}</div></div>
    <h3>Buchungen ${jahr}</h3>` +
    tabelle(['Datum', 'Art', 'Kategorie', 'Beschreibung', 'Betrag', ''], [...bs].sort(nachDatum).map(b => [fmtD(b.datum), marke(b.art, b.art === 'Einnahme' ? 'gruen' : 'gelb'), esc(b.kategorie), esc(b.text),
      `<b>${b.art === 'Ausgabe' ? '−' : ''}${euro(b.betrag)}</b>`, `<button class="klein" onclick="bearbeiten('buchungen','${b.id}')">✎</button>`])) +
    '<h3>Investitionen (über mehrere Jahre verteilt)</h3>' +
    tabelle(['Anschaffung', 'Datum', 'Betrag', 'Nutzungsdauer', 'pro Jahr', `Anteil ${jahr}`, `Restwert Ende ${jahr}`, ''], [...db.investitionen].sort(nachDatum).map(i => [`<b>${esc(i.name)}</b>${i.notiz ? `<div class="leise klein-t">${esc(i.notiz)}</div>` : ''}`,
      fmtD(i.datum), euro(i.betrag), `${i.jahre} Jahre`, euro(i.betrag / i.jahre), euro(afa(i, +jahr)), euro(restwert(i, +jahr)), `<button class="klein" onclick="bearbeiten('investitionen','${i.id}')">✎</button>`])) +
    '<p class="leise klein-t">Investitionen werden gleichmäßig über die Nutzungsdauer verteilt, beginnend im Anschaffungsjahr. Das ist eine einfache betriebliche Übersicht, keine steuerliche Berechnung.</p>';
}

// ---------- Bestandsbuch als PDF (über den Druckdialog „Als PDF speichern") ----------
function bestandsbuchPdf() {
  const jahre = [...new Set(db.behandlungen.map(b => b.datum.slice(0, 4)))].sort().reverse();
  formular('Bestandsbuch als PDF', [{ k: 'jahr', label: 'Zeitraum', typ: 'select', opts: [['', 'alle Jahre'], ...jahre] }, { k: 'nr', label: 'LFBIS- / VIS-Nummer' }, { k: 'name', label: 'Imker / Betrieb', breit: 1 }, { k: 'adresse', label: 'Adresse', breit: 1 }],
    { jahr: jahre[0] || '', ...db.einstellungen.betrieb }, w => {
      db.einstellungen.betrieb = { name: w.name, nr: w.nr, adresse: w.adresse }; speichern();
      const zeilen = db.behandlungen.filter(b => !w.jahr || b.datum.startsWith(w.jahr)).sort((a, b) => a.datum.localeCompare(b.datum));
      $('#druck').innerHTML = `<h1>Bestandsbuch Bienen ${esc(w.jahr)}</h1>
        <p><b>${esc(w.name)}</b>${w.adresse ? ' · ' + esc(w.adresse) : ''}${w.nr ? ' · Betriebsnummer ' + esc(w.nr) : ''}</p>
        <table><thead><tr>${['Nr.', 'Beginn', 'Ende', 'Volk', 'Standplatz', 'Arzneimittel / Verfahren', 'Menge / Dosierung', 'Charge', 'Wartezeit', 'Anwender', 'Bemerkung'].map(k => `<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${zeilen.map((b, i) => { const s = standort(volk(b.volkId)?.standortId); return `<tr>${[i + 1, fmtD(b.datum), b.ende ? fmtD(b.ende) : '', vName(b.volkId), esc(s?.name ?? '') + (s?.regnr ? ` (${esc(s.regnr)})` : ''),
          esc(b.mittel), esc(b.menge), esc(b.charge), b.wartezeit != null ? b.wartezeit + ' Tage' : '', esc(b.anwender), esc(b.notiz)].map(c => `<td>${c}</td>`).join('')}</tr>`; }).join('') || '<tr><td colspan="11">Keine Behandlungen im gewählten Zeitraum.</td></tr>'}</tbody></table>
        <p class="unterschrift">Erstellt am ${fmtD(heute())} · Unterschrift: ______________________________</p>`;
      setTimeout(() => window.print(), 100);
    });
}

// ---------- Verlaufskurven je Volk ----------
function kurve(titel, punkte, farbe, einheit, abNull) {
  punkte = punkte.filter(p => p.wert != null && p.datum).sort((a, b) => a.datum.localeCompare(b.datum));
  if (punkte.length < 2) return '';
  const t = p => new Date(p.datum).getTime(), t0 = t(punkte[0]), t1 = t(punkte[punkte.length - 1]), werte = punkte.map(p => p.wert);
  let lo = abNull ? 0 : Math.min(...werte), hi = Math.max(...werte); if (hi === lo) hi = lo + 1;
  const xy = p => [(12 + (t(p) - t0) / (t1 - t0 || 1) * 276).toFixed(1), (92 - (p.wert - lo) / (hi - lo) * 72).toFixed(1)];
  return `<div class="karte"><h4>${titel}</h4><svg viewBox="0 0 300 112" style="width:100%">
    <line x1="12" x2="288" y1="92" y2="92" stroke="#e6dcc4"/><line x1="12" x2="288" y1="20" y2="20" stroke="#e6dcc4" stroke-dasharray="3 3"/>
    <polyline fill="none" stroke="${farbe}" stroke-width="2" points="${punkte.map(p => xy(p).join(',')).join(' ')}"/>
    ${punkte.map(p => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="2.6" fill="${farbe}"><title>${fmtD(p.datum)}: ${zahl(p.wert)} ${einheit}</title></circle>`; }).join('')}
    <text x="12" y="14" font-size="9" fill="#7a6f5a">${zahl(hi)} ${einheit}</text><text x="12" y="88" font-size="9" fill="#7a6f5a">${zahl(lo)}</text>
    <text x="12" y="106" font-size="9" fill="#7a6f5a">${fmtD(punkte[0].datum)}</text><text x="288" y="106" font-size="9" fill="#7a6f5a" text-anchor="end">${fmtD(punkte[punkte.length - 1].datum)}</text></svg>
    <div class="klein-t">Zuletzt: <b>${zahl(werte[werte.length - 1])} ${einheit}</b></div></div>`;
}
function kurvenHtml(id) {
  const ds = db.durchsichten.filter(d => d.volkId === id), reihe = k => ds.map(d => ({ datum: d.datum, wert: d[k] }));
  const html = kurve('Gewicht', reihe('gewicht'), '#a87400', 'kg') +
    kurve('Varroa', [...reihe('varroa'), ...db.varroa.filter(z => z.volkId === id).map(z => ({ datum: z.datum, wert: z.proTag }))], '#c0392b', 'Milben/Tag', true) +
    kurve('Volksstärke', reihe('gassen'), '#3d8b40', 'Wabengassen', true) + kurve('Brut', reihe('brutwaben'), '#2563eb', 'Brutwaben', true);
  return '<h3>Verlauf</h3>' + (html ? `<div class="raster">${html}</div>` : '<p class="leer">Kurven für Gewicht, Varroa, Volksstärke und Brut erscheinen ab zwei Messwerten.</p>');
}

// ---------- Spracheingabe bei der Durchsicht ----------
const ZAHLWORT = { null: 0, ein: 1, eins: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
// Erkennt Werte aus gesprochenem Text, z. B. „Stifte gesehen, sechs Brutwaben, Futter knapp, Varroa drei"
function sprachParse(text) {
  const zw = x => x in ZAHLWORT ? ZAHLWORT[x] : parseFloat(x), Z = `(\\d+(?:\\.\\d+)?|${Object.keys(ZAHLWORT).join('|')})`;
  const s = ' ' + text.toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(new RegExp(`${Z} komma ${Z}`, 'g'), (m, a, b) => `${zw(a)}.${zw(b)}`) + ' ';
  const num = (...muster) => { for (const re of muster) { const m = s.match(new RegExp(re.replace('#', Z))); if (m) return zw(m[1]); } };
  const w = {};
  if (/weisellos|keine königin/.test(s)) w.weisel = 'weisellos'; else if (/(königin|weisel) (wurde )?gesehen/.test(s)) w.weisel = 'Königin gesehen'; else if (/stifte|eier gesehen/.test(s)) w.weisel = 'Stifte gesehen';
  if (/keine (weisel|schwarm)?zellen/.test(s)) w.zellen = 'keine'; else if (/zellen? (sind )?verdeckelt|verdeckelte (weisel|schwarm)?zellen?/.test(s)) w.zellen = 'verdeckelt';
  else if (/zellen? (sind )?bestiftet|bestiftete (weisel|schwarm)?zellen?/.test(s)) w.zellen = 'bestiftet'; else if (/spielnäpfchen/.test(s)) w.zellen = 'Spielnäpfchen';
  const futter = s.match(/futter (ist )?(reichlich|ausreichend|knapp|kritisch)/); if (futter) w.futter = futter[2];
  const werte = { brutwaben: num('# brutwaben', 'brutwaben #'), gassen: num('# (waben)?gassen', 'gassen #'), sanftmut: num('sanftmut #'), varroa: num('varroa #', '# milben'), gewicht: num('gewicht #', '# (kilo|kg)') };
  for (const [k, v] of Object.entries(werte)) if (v != null && !isNaN(v)) w[k] = v;
  return w;
}
function sprachLeiste() {
  const form = $('#dlg form'), leiste = document.createElement('div'), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  leiste.innerHTML = `<div class="zeile"><button type="button" id="sp-mic" ${SR ? '' : 'disabled'}>🎤 Diktieren</button><button type="button" id="sp-notiz">Werte aus Notiz übernehmen</button></div>
    <div class="leise klein-t" id="sp-info" style="margin:6px 0 10px">Sag z. B.: „Stifte gesehen, sechs Brutwaben, acht Gassen, Futter knapp, Varroa drei, Gewicht 32 Komma 5“.</div>`;
  form.querySelector('.felder').before(leiste);
  const namen = Object.fromEntries(DEF.durchsichten.felder().map(f => [f.k, f.label.split(' (')[0]]));
  const anwenden = text => {
    const w = sprachParse(text);
    for (const [k, v] of Object.entries(w)) form.elements[k].value = v;
    $('#sp-info').textContent = Object.keys(w).length ? 'Erkannt: ' + Object.entries(w).map(([k, v]) => `${namen[k]} ${v}`).join(', ') : 'Keine Werte erkannt – der Text steht in der Notiz.';
  };
  $('#sp-notiz').onclick = () => anwenden(form.elements.notiz.value);
  if (!SR) return;
  $('#sp-mic').onclick = () => {
    const r = new SR(); r.lang = 'de-AT';
    $('#sp-info').textContent = 'Ich höre zu …';
    r.onresult = e => { const text = [...e.results].map(x => x[0].transcript).join(' '); form.elements.notiz.value = (form.elements.notiz.value + ' ' + text).trim(); anwenden(text); };
    r.onerror = e => { $('#sp-info').textContent = e.error === 'network' ? 'Die Spracherkennung braucht Internet. Ohne Empfang: mit dem Mikrofon der Handy-Tastatur ins Notizfeld diktieren und „Werte aus Notiz übernehmen“ tippen.'
      : e.error === 'not-allowed' ? 'Das Mikrofon ist für diese Seite nicht erlaubt.' : 'Nichts verstanden – bitte nochmal.'; };
    r.start();
  };
}

// ---------- Eigene Blühbeobachtungen ----------
const beobAm = s => db.beobachtungen.filter(b => b.standortId === s.id);
function trachtTabelle(s, d) {
  const f = standortFaktor(beobAm(s)), monat = +heute().slice(5, 7);
  return tabelle(['Trachtpflanze', 'Wert', 'Blühbeginn ab', 'Stand', 'Eigene Beobachtung'], TRACHTEN.map(([name, von, bis, wert], i) => {
    const start = f.je[name] ?? von * f.k, ende = start + (bis - von) * f.k, b = beobAm(s).filter(b => b.pflanze === name).sort(nachDatum)[0];
    return [name, wert, `GTS ${zahl(start, 0)}${Math.round(start) !== von ? ` <span class="leise klein-t">(Richtwert ${von})</span>` : ''}`,
      d.gts < start ? marke(`in ca. ${zahl(start - d.gts, 0)} Gradtagen`) : d.gts <= ende && monat < 11 ? marke('blüht voraussichtlich', 'gruen') : marke('vorbei'),
      `${b ? `<span class="klein-t">${fmtD(b.datum)} (GTS ${zahl(b.gts, 0)})</span> ` : ''}<button class="klein" onclick="beobachten('${s.id}',${i})">Blühbeginn eintragen</button>`];
  })) + (f.n ? `<p class="klein-t">Aus ${f.n} beobachteten Pflanzen: Dieser Standplatz blüht bei <b>${zahl(f.k * 100, 0)} %</b> der Richtwert-Wärmesumme, also ${f.k < 1 ? 'früher' : 'später'} als der Richtwert. Trachtkalender, Arbeiten und Benachrichtigungen sind darauf angepasst.</p>` : '');
}
function beobachten(sid, i) {
  const s = standort(sid), name = TRACHTEN[i][0], jahr = heute().slice(0, 4), gleiche = b => b.standortId === sid && b.pflanze === name && b.datum.startsWith(jahr);
  const alt = db.beobachtungen.find(gleiche);
  formular(`Blühbeginn ${name}`, [{ k: 'datum', label: 'Erste offene Blüten am', typ: 'date', req: 1, breit: 1 }], { datum: alt?.datum || heute() }, async w => {
    const d = await wetter(s).catch(() => null), tagNr = Math.round((new Date(w.datum) - new Date(jahr + '-01-01')) / 864e5);
    if (!d) return alert('Wetterdaten nicht erreichbar – bitte mit Internetverbindung eintragen.');
    if (!w.datum.startsWith(jahr) || w.datum > heute() || d.verlauf[tagNr] == null) return alert('Das Datum muss im laufenden Jahr liegen und darf nicht in der Zukunft sein.');
    db.beobachtungen = db.beobachtungen.filter(b => !gleiche(b));
    db.beobachtungen.push({ id: uid(), standortId: sid, pflanze: name, datum: w.datum, gts: d.verlauf[tagNr] }); speichern(); render();
  }, alt && (() => { db.beobachtungen = db.beobachtungen.filter(b => !gleiche(b)); speichern(); render(); }));
}

// ---------- Trachtkarte: Flächennutzung im Flugradius aus OpenStreetMap ----------
// Flugradius in km, unter Standplätze einstellbar (0,5–10 km)
const flugradius = () => db.einstellungen.flugradius || 3;
function radiusSetzen(v) { db.einstellungen.flugradius = Math.min(10, Math.max(0.5, reZahl(v) || 3)); speichern(); render(); }
const TRACHTFLAECHEN = [
  ['Raps (kartiert)', '#f2d200', t => t.crop === 'rapeseed'],
  ['Obst', '#e2557a', t => t.landuse === 'orchard'],
  ['Wald', '#2f7d32', t => t.landuse === 'forest' || t.natural === 'wood'],
  ['Wiese / Grünland', '#8bc34a', t => t.landuse === 'meadow' || t.natural === 'grassland'],
  ['Heide / Gebüsch', '#9c6ab5', t => t.natural === 'heath' || t.natural === 'scrub'],
  ['Weingarten', '#7b3f8c', t => t.landuse === 'vineyard'],
  ['Acker', '#d9b36c', t => t.landuse === 'farmland'],
  ['Siedlung / Gärten', '#9e9e9e', t => t.landuse === 'residential' || t.landuse === 'allotments'],
];
// Setzt die Teilstücke einer Relation zu geschlossenen Ringen zusammen
function ringeVerbinden(teile) {
  const offen = teile.map(t => t.slice()), ringe = [], gleich = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (offen.length) {
    let ring = offen.pop(), weiter = true;
    while (weiter && !gleich(ring[0], ring[ring.length - 1])) {
      weiter = false;
      for (let i = 0; i < offen.length; i++) {
        const t = offen[i], ende = ring[ring.length - 1];
        if (gleich(t[0], ende)) ring = ring.concat(t.slice(1)); else if (gleich(t[t.length - 1], ende)) ring = ring.concat(t.slice(0, -1).reverse()); else continue;
        offen.splice(i, 1); weiter = true; break;
      }
    }
    if (ring.length > 3) ringe.push(ring);
  }
  return ringe;
}
const imRing = (lat, lon, r) => { let innen = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][0] > lat) !== (r[j][0] > lat) && lon < (r[j][1] - r[i][1]) * (lat - r[i][0]) / (r[j][0] - r[i][0]) + r[i][1]) innen = !innen; return innen; };
let trachtEbene = null;
async function trachtkarte(sid) {
  const s = standort(sid), info = $('#tracht-info');
  if (!karte || !hatKoord(s)) return;
  info.innerHTML = '<p class="leise">Lade Flächendaten aus OpenStreetMap … das kann bis zu einer halben Minute dauern.</p>';
  const r = flugradius(), um = `(around:${r * 1000},${s.lat},${s.lon})`, lu = '"landuse"~"^(forest|orchard|meadow|farmland|vineyard|residential|allotments)$"', na = '"natural"~"^(wood|grassland|heath|scrub)$"';
  let els;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(`[out:json][timeout:40];(way[${lu}]${um};way[${na}]${um};relation[${lu}]${um};relation[${na}]${um};);out geom;`) });
    if (!r.ok) throw new Error(r.status);
    els = (await r.json()).elements;
  } catch { info.innerHTML = '<p class="leer">Die Kartendaten sind gerade nicht erreichbar. Bitte später nochmal versuchen.</p>'; return; }
  if (!karte || !$('#tracht-info')) return;
  const flaechen = [];
  for (const e of els) {
    const kat = TRACHTFLAECHEN.findIndex(k => k[2](e.tags || {}));
    if (kat < 0) continue;
    const pkt = g => g.map(p => [p.lat, p.lon]);
    const ringe = e.type === 'way' ? [pkt(e.geometry || [])] : ringeVerbinden((e.members || []).filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => pkt(m.geometry)));
    for (const ring of ringe) if (ring.length > 3) flaechen.push({ kat, ring, n: Math.max(...ring.map(p => p[0])), s: Math.min(...ring.map(p => p[0])), o: Math.max(...ring.map(p => p[1])), w: Math.min(...ring.map(p => p[1])) });
  }
  // Flächenanteile: Raster mit 30 Punkten je Radius (bei 3 km alle 100 m), je Punkt die erste zutreffende Kategorie
  const dLat = r * 1000 / 30 / 111320, dLon = dLat / Math.cos(s.lat * Math.PI / 180), treffer = TRACHTFLAECHEN.map(() => 0); let punkte = 0;
  for (let y = -30; y <= 30; y++) for (let x = -30; x <= 30; x++) {
    if (x * x + y * y > 900) continue;
    const lat = s.lat + y * dLat, lon = s.lon + x * dLon; let beste = 99; punkte++;
    for (const f of flaechen) if (f.kat < beste && lat <= f.n && lat >= f.s && lon <= f.o && lon >= f.w && imRing(lat, lon, f.ring)) beste = f.kat;
    if (beste < 99) treffer[beste]++;
  }
  trachtEbene?.remove();
  trachtEbene = L.layerGroup(flaechen.map(f => L.polygon(f.ring, { stroke: false, fillColor: TRACHTFLAECHEN[f.kat][1], fillOpacity: 0.5, interactive: false }))).addTo(karte);
  karte.fitBounds(L.latLng(s.lat, s.lon).toBounds(r * 2000 + 400));
  s.trachtkarte = { datum: heute(), radius: r, anteile: treffer.map(t => +(t / punkte * 100).toFixed(1)) }; speichern();
  info.innerHTML = trachtInfo(s);
}
function trachtInfo(s) {
  const t = s.trachtkarte, r = t.radius || 3, ha = Math.PI * r * r * 100, rest = Math.max(0, 100 - t.anteile.reduce((a, b) => a + b, 0));
  return `<div class="karte" style="margin-bottom:12px"><h4>Trachtkarte ${esc(s.name)} – Flächen im Flugradius ${zahl(r)} km</h4>
    ${TRACHTFLAECHEN.map(([name, farbe], i) => [name, farbe, t.anteile[i]]).filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]).map(([name, farbe, p]) => `<div class="klein-t"><span class="punkt" style="background:${farbe}"></span> ${name}: <b>${zahl(p)} %</b> · ca. ${zahl(p / 100 * ha, 0)} ha</div><div class="balken"><i style="width:${p}%;background:${farbe}"></i></div>`).join('')}
    <div class="klein-t leise" style="margin-top:6px">Nicht zugeordnet: ${zahl(rest)} %. Stand ${fmtD(t.datum)}, Quelle OpenStreetMap.</div>
    <p class="klein-t">Raps wechselt jedes Jahr das Feld und ist in diesen Kartendaten fast nie erfasst. Was genau auf den Äckern steht, zeigt „🍯 Potenzial“ mit den Felddaten der AMA.</p></div>`;
}
