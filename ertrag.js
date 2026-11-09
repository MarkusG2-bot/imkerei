// Trachtpotenzial: Felder im Flugradius (AMA INVEKOS) × Honig-Richtwerte je Hektar × Trockenheitsfaktor,
// abgeglichen mit den eigenen Ernten am Standplatz. Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

const INVEKOS = 'https://gis.lfrz.gv.at/api/geodata/i009501/ogc/features/v1';
// Gruppen: Muster auf die AMA-Kulturbezeichnung, Honig-Richtwert kg/ha (von–bis), Blütemonate. Reihenfolge zählt (erster Treffer).
const NEKTAR = [
  ['robinie', 'Robinie', n => /ROBINIE/.test(n) && !/OHNE ROBINIE/.test(n), 200, 600, [5, 6]],
  ['raps', 'Raps / Rübsen', n => /RAPS|RÜBSEN/.test(n), 30, 100, [4, 5]],
  ['sonnenblume', 'Sonnenblume', n => /SONNENBLUME/.test(n), 10, 40, [7, 8]],
  ['kuerbis', 'Kürbis', n => /KÜRBIS/.test(n), 10, 40, [6, 8]],
  ['phacelia', 'Phacelia', n => /PHACELIA/.test(n), 150, 500, [6, 8]],
  ['buchweizen', 'Buchweizen', n => /BUCHWEIZEN/.test(n), 50, 150, [7, 8]],
  ['senf', 'Senf, Ölrettich, Leindotter', n => /SENF|ÖLRETTICH|LEINDOTTER/.test(n), 20, 80, [5, 9]],
  ['kleegras', 'Kleegras', n => /KLEEGRAS/.test(n), 10, 40, [5, 9]],
  ['klee', 'Klee', n => /KLEE/.test(n), 30, 100, [5, 9]],
  ['luzerne', 'Luzerne', n => /LUZERNE/.test(n), 20, 80, [6, 8]],
  ['esparsette', 'Esparsette', n => /ESPARSETTE/.test(n), 100, 200, [5, 6]],
  ['feldfutter', 'Feldfutter (Gräser)', n => /FELDFUTTER|ACKERGRAS|WEIDELGRAS|FUTTERGRAS/.test(n), 0, 0, [5, 9]],
  ['ackerbohne', 'Ackerbohne', n => /ACKERBOHNE|PFERDEBOHNE/.test(n), 10, 30, [5, 6]],
  ['soja', 'Sojabohne', n => /SOJA/.test(n), 0, 10, [7, 7]],
  ['lein', 'Lein', n => /LEIN/.test(n), 5, 20, [6, 7]],
  ['heil', 'Heil- und Gewürzpflanzen', n => /HEILPFLANZE|GEWÜRZ|MARIENDISTEL|KORIANDER|FENCHEL|KÜMMEL|LAVENDEL/.test(n), 10, 50, [6, 8]],
  ['kastanie', 'Edelkastanie', n => /EDELKASTANIE/.test(n), 50, 150, [6, 7]],
  ['obst', 'Obst', n => /ÄPFEL|BIRNEN|KIRSCHEN|ZWETSCHKEN|PFLAUMEN|MARILLEN|PFIRSICHE|OBST/.test(n), 20, 50, [4, 5]],
  ['beeren', 'Strauchbeeren', n => /STRAUCHBEEREN|HIMBEER|BROMBEER|HOLUNDER|APFELBEERE|ARONIA/.test(n), 50, 150, [5, 7]],
  ['hecke', 'Hecken und Feldgehölze', n => /HECKE|FELDGEHÖLZ|GEBÜSCH|UFERGEHÖLZ/.test(n), 20, 80, [4, 6]],
  ['brache', 'Brachen und Blühflächen', n => /BRACHE|BLÜHFLÄCHE|BIODIVERSITÄT/.test(n), 10, 50, [5, 9]],
  ['wiese_ext', 'Extensive Wiesen und Hutweiden', n => /EINMÄHDIG|HUTWEIDE|STREUWIESE|BERGMÄHDER|ALM/.test(n), 10, 40, [5, 7]],
  ['wiese_2', 'Wiesen mit zwei Nutzungen', n => /ZWEI NUTZUNGEN/.test(n), 5, 20, [5, 6]],
  ['wiese_int', 'Intensive Wiesen und Weiden', n => /DREI UND MEHR|WECHSELWIESE|DAUERWEIDE|ACKERWEIDE/.test(n), 0, 5, [4, 5]],
];
const MONAT = ['', 'Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
// Eigene Richtwerte (unter Anpassen) gehen vor
const nektarWert = g => db.einstellungen.nektar?.[g[0]] || [g[3], g[4]];
// AMA-Codes (snar_code) gehen vor dem Namen; am Dienst bestätigt (Raum Ternitz und Semmering, INVEKOS 2025_2)
const SNAR_CODES = { 359: 'hecke', 360: 'hecke', 701: 'wiese_ext', 707: 'wiese_ext', 715: 'wiese_int', 716: 'wiese_2', 717: 'wiese_int', 721: 'brache', 771: 'brache', 992: 'wiese_ext' };
function nektarGruppe(name, code) {
  const k = SNAR_CODES[code];
  return k ? NEKTAR.find(g => g[0] === k) : NEKTAR.find(g => g[2](String(name).toUpperCase()));
}

// ---------- Felder aus INVEKOS ----------
// Die Liste der Datensätze (/collections) darf der Browser nicht lesen, die Felder selbst schon.
// Deshalb je Jahr die möglichen Namen probieren: ab 2022 erst die Winterrevision (_2), dann den Sommerstand (_1).
const invekosIds = {}, INVEKOS_AB = 2015;
const invekosJahre = () => Array.from({ length: +heute().slice(0, 4) - INVEKOS_AB + 1 }, (_, i) => String(+heute().slice(0, 4) - i));
async function invekosId(jahr) {
  if (jahr in invekosIds) return invekosIds[jahr];
  for (const n of +jahr >= 2022 ? [`${jahr}_2`, `${jahr}_1`] : [jahr]) {
    const id = `i009501:invekos_schlaege_${n}_polygon`;
    try { if ((await fetch(`${INVEKOS}/collections/${encodeURIComponent(id)}/items?limit=1&f=json`)).ok) return invekosIds[jahr] = id; } catch { /* gibt es nicht */ }
  }
  return invekosIds[jahr] = null;
}
// Neuestes Jahr mit Felddaten
async function invekosNeuestes() { for (const j of invekosJahre()) if (await invekosId(j)) return j; return null; }
// Mittel der Punkte des ersten Außenrings → [lon, lat]
function mitte(g) {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
  return [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
}
// Fläche in ha aus der Geometrie (Gauß'sche Flächenformel in km, Löcher abgezogen, MultiPolygon summiert)
function flaecheHa(g) {
  const kx = 111.32 * Math.cos(mitte(g)[1] * Math.PI / 180);
  const ringKm2 = ring => Math.abs(ring.reduce((a, p, i) => { const q = ring[(i + 1) % ring.length]; return a + p[0] * kx * q[1] * 111.32 - q[0] * kx * p[1] * 111.32; }, 0)) / 2;
  const polygone = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polygone.reduce((a, [aussen, ...loecher]) => a + ringKm2(aussen) - loecher.reduce((b, l) => b + ringKm2(l), 0), 0) * 100;
}
// Alle Seiten einer INVEKOS-Collection im Rechteck (der Dienst liefert höchstens 100 je Seite); zeit = Zeitgrenze je Seite in ms
async function invekosItems(id, bbox, beiSeite, { zeit } = {}) {
  let url = `${INVEKOS}/collections/${encodeURIComponent(id)}/items?bbox=${bbox}&limit=1000&f=json`, seite = 0;
  while (url && seite < 60) {
    const res = await fetch(url, zeit ? { signal: AbortSignal.timeout(zeit) } : undefined); if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
    const j = await res.json(); seite++;
    beiSeite(j.features || [], seite, j.numberMatched);
    url = j.links?.find(l => l.rel === 'next')?.href;
  }
}
// Alle Schläge, deren Mitte im Flugradius liegt; liefert Fläche je Kulturart, den AMA-Code je Kulturart und die Nektarflächen für die Karte
async function felderHolen(s, jahr, r, info) {
  const id = await invekosId(jahr); if (!id) throw new Error('Für ' + jahr + ' gibt es noch keine Felddaten');
  const dLat = r / 111.32, kx = Math.cos(s.lat * Math.PI / 180), dLon = dLat / kx;
  const bbox = [s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat].map(x => x.toFixed(5)).join(',');
  const kulturen = {}, codes = {}, nektarFlaechen = [];
  let geladen = 0;
  await invekosItems(id, bbox, (features, seite, gesamt) => {
    geladen += features.length;
    info(`Lade Felder ${jahr} … ${zahl(geladen, 0)}${gesamt ? ' von ' + zahl(gesamt, 0) : ''}`);
    for (const f of features) {
      const g = f.geometry; if (!g) continue;
      const [x, y] = mitte(g);
      if (((y - s.lat) * 111.32) ** 2 + ((x - s.lon) * 111.32 * kx) ** 2 > r * r) continue;
      const name = f.properties.snar_bezeichnung || 'unbekannt', ha = f.properties.sl_flaeche_brutto_ha || 0, code = f.properties.snar_code ?? null;
      kulturen[name] = (kulturen[name] || 0) + ha;
      if (code != null) codes[name] = code;
      const gr = nektarGruppe(name, code); if (gr && nektarWert(gr)[1] > 0) nektarFlaechen.push({ g, gruppe: gr[1], key: gr[0], name, ha, code });
    }
  });
  return { kulturen, codes, nektarFlaechen };
}
// Landschaftselemente (Hecken, Feldgehölze) aus den INVEKOS-Referenzen; der Dienst filtert ref_art nicht, die Fläche steht dort als 0
const LSE_NAME = 'LANDSCHAFTSELEMENT HECKE / FELDGEHÖLZ';
async function lseHolen(s, jahr, r, nektarFlaechen) {
  try {
    const id = (await invekosId(jahr))?.replace('schlaege', 'referenzen'), gr = nektarGruppe(LSE_NAME);
    if (!id || !(nektarWert(gr)[1] > 0)) return [];
    const dLat = r / 111.32, kx = Math.cos(s.lat * Math.PI / 180), dLon = dLat / kx;
    const bbox = [s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat].map(x => x.toFixed(5)).join(',');
    // Schon als Schlag mit Code 359/360 gemeldete Hecken nicht doppelt zählen
    const hecken = nektarFlaechen.filter(n => n.code === 359 || n.code === 360).map(n => n.g.type === 'Polygon' ? [n.g.coordinates] : n.g.coordinates);
    const liste = [];
    await invekosItems(id, bbox, features => {
      for (const f of features) {
        const g = f.geometry; if (!g || f.properties.ref_art !== 'LSE_FL') continue;
        const m = mitte(g);
        if (((m[1] - s.lat) * 111.32) ** 2 + ((m[0] - s.lon) * 111.32 * kx) ** 2 > r * r) continue;
        if (hecken.some(polygone => polygone.some(ringe => punktInRingen(m, ringe)))) continue;
        liste.push({ g, gruppe: gr[1], key: gr[0], name: LSE_NAME, ha: flaecheHa(g), code: null });
      }
    }, { zeit: 20000 });
    return liste;
  } catch { return []; }
}

// ---------- Niederschlag: letzte 6 Monate gegenüber den Vorjahren ----------
async function niederschlag(s) {
  const key = 'imkerei-nd-' + s.lat.toFixed(3) + ',' + s.lon.toFixed(3), c = JSON.parse(localStorage.getItem(key) || 'null');
  if (c && Date.now() - c.t < 864e5) return c.d;
  const ende = iso(new Date(Date.now() - 6 * 864e5));
  const j = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${s.lat}&longitude=${s.lon}&start_date=2010-01-01&end_date=${ende}&daily=precipitation_sum&timezone=auto`, { signal: AbortSignal.timeout(20000) })).json();
  const d = { time: j.daily.time, p: j.daily.precipitation_sum };
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { /* Speicher voll: ohne Zwischenspeicher weiter */ }
  return d;
}
// Laufendes Jahr: die letzten 180 Tage bis heute. Frühere Jahre: 180 Tage bis Ende August (die Tracht-Saison).
function trockenheit(d, jahr) {
  const letzter = d.time[d.time.length - 1], bis = jahr === +heute().slice(0, 4) ? letzter : `${jahr}-08-31` < letzter ? `${jahr}-08-31` : letzter;
  const fenster = k => { const e = new Date(bis); e.setFullYear(e.getFullYear() - k); const a = new Date(e.getTime() - 179 * 864e5); return [iso(a), iso(e)]; };
  const summe = ([a, e]) => { let s = 0, n = 0; d.time.forEach((t, i) => { if (t >= a && t <= e && d.p[i] != null) { s += d.p[i]; n++; } }); return n > 170 ? s : null; };
  const jetzt = summe(fenster(0)), frueher = [];
  for (let k = 1; k <= 10; k++) { const v = summe(fenster(k)); if (v != null) frueher.push(v); }
  if (jetzt == null || frueher.length < 3) return null;
  const mittel = frueher.reduce((a, b) => a + b, 0) / frueher.length, anteil = jetzt / mittel;
  // Faustregel: Nektar geht bei Trockenheit zurück. 100 % Regen → Faktor 1, 50 % → 0,65, Untergrenze 0,3, nasser als üblich höchstens 1,15
  const faktor = Math.min(1.15, Math.max(0.3, 0.3 + 0.7 * anteil));
  return { von: fenster(0)[0], bis, jetzt, mittel, anteil, faktor, jahre: frueher.length };
}

// ---------- Dürreindex SPEI (90 Tage) als Nektarfaktor, sonst die Regenrechnung ----------
function speiFaktor(spei) { return spei >= 0 ? Math.min(1.15, 1 + 0.15 * spei) : spei >= -2 ? 1 + 0.25 * spei : Math.max(0.3, 0.5 + 0.2 * (spei + 2)); }
function speiStufe(spei) { return spei >= 1 ? 'nass' : spei > -1 ? 'normal' : spei > -1.5 ? 'trocken' : spei >= -2 ? 'sehr trocken' : 'extrem trocken'; }
function speiText(w) { return `Dürreindex SPEI 90 Tage: ${vzZahl(w.spei90)} (${speiStufe(w.spei90)}) → Nektarfaktor ${w.faktor.toFixed(2).replace('.', ',')}; Quelle GeoSphere WINFORE`; }
// Stichtag: laufendes Jahr gestern, frühere Jahre der 31. August (Ende der Tracht-Saison)
async function trockenheitHolen(s, jahr) {
  const stichtag = jahr === +heute().slice(0, 4) ? iso(new Date(Date.now() - 864e5)) : `${jahr}-08-31`;
  const w = await gsSpei(s.lat, s.lon, stichtag).catch(() => null);
  if (w) return { art: 'spei', ...w, faktor: speiFaktor(w.spei90) };
  const t = trockenheit(await niederschlag(s), jahr);
  return t ? { art: 'regen', ...t } : null;
}

// ---------- Boden-Wasserspeicher (eBOD) verändert den Trockenheitsfaktor je Fläche ----------
// Wenig Speicher verstärkt die Trockenheit (× 1,3), viel Speicher puffert sie (× 0,7); in nassen Jahren (f ≥ 1) bleibt f
const BODEN_GEWICHT = { gering: 1.3, mittel: 1, hoch: 0.7 };
function bodenFaktor(f, klasse) { return f >= 1 ? f : Math.max(0.3, 1 - (1 - f) * (BODEN_GEWICHT[klasse] ?? 1)); }
// Flächengewichtetes Mittel über die Flächen einer Trachtgruppe; Fläche ohne Bodenangabe zählt als mittel, keine Fläche → f
function gruppenFaktor(flaechen, key, f) {
  let ha = 0, summe = 0;
  for (const n of flaechen) if (n.key === key) { ha += n.ha; summe += n.ha * bodenFaktor(f, n.boden ?? 'mittel'); }
  return ha > 0 ? summe / ha : f;
}
// Setzt n.boden je Fläche (an ihrer Mitte nachgeschlagen) und liefert die Anteile nach Hektar; Bodenkarte nicht erreichbar → alle mittel, null
async function bodenHolen(flaechen) {
  const kacheln = new Map(), ha = { gering: 0, mittel: 0, hoch: 0 };
  try {
    const klassen = await Promise.all(flaechen.map(n => { const [lon, lat] = mitte(n.g); return bodenAmPunkt(lat, lon, kacheln).then(bodenKlasse); }));
    flaechen.forEach((n, i) => n.boden = klassen[i]);
  } catch {
    for (const n of flaechen) n.boden = 'mittel';
    return null;
  }
  for (const n of flaechen) ha[n.boden] += n.ha;
  const summe = ha.gering + ha.mittel + ha.hoch;
  return summe > 0 ? { gering: ha.gering / summe, mittel: ha.mittel / summe, hoch: ha.hoch / summe } : { gering: 0, mittel: 0, hoch: 0 };
}
function bodenText(b) {
  if (!b) return 'Bodenkarte nicht erreichbar';
  const p = x => Math.round(x * 100) + ' %';
  return `Boden-Wasserspeicher im Flugradius: ${p(b.gering)} gering, ${p(b.mittel)} mittel, ${p(b.hoch)} hoch (eBOD, BFW)`;
}
function waldText(w) {
  const p = x => Math.round(x * 100) + ' %';
  return `Wald im Flugradius: ${p(w.anteil)}${w.nadel === null ? '' : `, davon ${p(w.nadel)} Nadelwald – Waldtracht (Honigtau) möglich, nicht vorhersagbar`} (EEA Copernicus 2018)`;
}

// ---------- Felder auf der Karte ----------
const FELD_STIL = { weight: 1, color: '#8a6d00', opacity: 0.9, fillColor: '#e0a100', fillOpacity: 0.55 };
const FELD_GEWAEHLT = { weight: 3, color: '#3d2a00', opacity: 1 };
// „WINTERRAPS“ → „Winterraps“
const kulturName = name => name ? name.charAt(0) + name.slice(1).toLowerCase() : 'Unbekannt';
// Kurzname für die Beschriftung im Feld: erstes Wort, höchstens 16 Zeichen
function kulturKurz(name) {
  if (name === LSE_NAME) return 'Hecke';
  const w = kulturName((name || '').split(/[\s,(/]+/).find(Boolean) || name);
  return w.length > 16 ? w.slice(0, 15) + '…' : w;
}
// Text der Zeile unter der Karte (reiner Text, nicht HTML)
function feldInfoText(n) { return `${kulturName(n.name)} · ${zahl(n.ha, 2)} ha${n.boden ? ` · Boden: ${n.boden}` : ''}`; }
// Kulturname im Feld erst ab Zoomstufe 15 und nur für Felder ab 0,5 ha – sonst zu voll
const feldNameZeigen = (zoom, ha) => zoom >= 15 && ha >= 0.5;
let potNamen = null, feldGewaehlt = null;
// Welche Namen gerade gezeigt werden: Zoom und Größe passen, Feldmitte im sichtbaren Ausschnitt (liste: [tooltip, ha, [lat, lon]])
const feldNamenImAusschnitt = (liste, bounds, zoom) => liste.filter(([, ha, p]) => feldNameZeigen(zoom, ha) && bounds.contains(p));
function feldNamen() {
  if (!potNamen || !karte) return;
  const zeigen = new Set(feldNamenImAusschnitt(potNamen.liste, karte.getBounds(), karte.getZoom()).map(e => e[0]));
  for (const [t] of potNamen.liste) { const an = zeigen.has(t); if (an && !potNamen.hasLayer(t)) potNamen.addLayer(t); else if (!an && potNamen.hasLayer(t)) potNamen.removeLayer(t); }
}
// Zeichnet die Nektarflächen neu (dünner Rand, Antippen → Zeile unter der Karte, Namen ab Zoom 15) und zoomt auf den Flugkreis
function feldEbene(s, flaechen, r) {
  potEbene?.remove(); potNamen?.remove(); feldGewaehlt = null;
  const namen = [];
  potEbene = L.layerGroup(flaechen.map(n => {
    const lage = L.geoJSON(n.g, { style: FELD_STIL }).bindTooltip(() => esc(feldInfoText(n)), { sticky: true });
    lage.on('click', () => feldWaehlen(lage, n));
    if (feldNameZeigen(99, n.ha)) { const [lon, lat] = mitte(n.g); namen.push([L.tooltip({ permanent: true, direction: 'center', className: 'feld-name', interactive: false }).setLatLng([lat, lon]).setContent(esc(kulturKurz(n.name))), n.ha, [lat, lon]]); }
    return lage;
  })).addTo(karte);
  potNamen = L.layerGroup().addTo(karte); potNamen.liste = namen;
  karte.off('zoomend moveend', feldNamen).on('zoomend moveend', feldNamen);
  karte.fitBounds(L.latLng(s.lat, s.lon).toBounds(r * 2000), { maxZoom: 15 });
  feldNamen();
  const fi = $('#feld-info'); if (fi) { fi.hidden = false; fi.textContent = 'Gelbes Feld antippen: Kultur, Fläche und Boden erscheinen hier.'; }
}
function feldWaehlen(lage, n) {
  feldGewaehlt?.setStyle(FELD_STIL);
  feldGewaehlt = lage; lage.setStyle(FELD_GEWAEHLT); lage.bringToFront();
  const fi = $('#feld-info'); if (fi) { fi.hidden = false; fi.textContent = feldInfoText(n); }
}

// ---------- Berechnung und Anzeige ----------
let potEbene = null;
// Laufzähler: Nachgeladenes (Boden, Wald) gilt nur, solange kein neuer Lauf (anderer Standplatz oder anderes Jahr) gestartet ist
// und die Potenzial-Karte noch zu sehen ist (nicht von einer anderen Seite ersetzt; die Trachtkarte hat ihre eigene Kachel)
let potLauf = 0;
function potNachladen(lauf, feld, wert) {
  if (lauf !== potLauf || !$('#pot-karte')) return false;
  potLetzt[feld] = wert; potZeigen(false);
  return true;
}
const ernteAm = (s, jahr) => db.ernten.filter(e => e.produkt === 'Honig' && e.datum?.startsWith(jahr) && (e.standortId || volk(e.volkId)?.standortId) === s.id).reduce((a, e) => a + (e.kg || 0), 0);
async function potenzial(sid, jahr) {
  const lauf = ++potLauf, s = standort(sid), info = $('#tracht-info'), r = flugradius();
  if (!s || !hatKoord(s)) return;
  const tk = $('#tracht-karte'); if (tk) tk.innerHTML = trachtKachel(s);
  const meldung = t => { const el = lauf === potLauf && $('#pot-info'); if (el) el.textContent = t; };
  info.innerHTML = '<div class="karte" style="margin-bottom:12px"><h4>Trachtpotenzial ' + esc(s.name) + '</h4><div class="leise" id="pot-info">Suche die neuesten Felddaten …</div></div>';
  const jahre = invekosJahre();
  jahr = String(jahr || await invekosNeuestes() || '');
  if (lauf !== potLauf) return;   // inzwischen neuer Lauf: nichts mehr anzeigen
  if (!jahr) return info.innerHTML = '<p class="leer">Die Felddaten der AMA sind gerade nicht erreichbar (keine Internetverbindung?).</p>';
  let felder, wetter;
  try {
    [felder, wetter] = await Promise.all([felderHolen(s, jahr, r, meldung), trockenheitHolen(s, +jahr).catch(() => null)]);
  } catch (e) { if (lauf !== potLauf) return; return info.innerHTML = `<p class="leer">Felder konnten nicht geladen werden (${esc(e.message)}). Bei großem Flugradius dauert es länger – später nochmal versuchen.</p>`; }
  if (lauf !== potLauf) return;
  meldung('Lade Landschaftselemente …');
  const lse = await lseHolen(s, jahr, r, felder.nektarFlaechen);
  if (lauf !== potLauf) return;
  if (lse.length) { felder.kulturen[LSE_NAME] = lse.reduce((a, n) => a + n.ha, 0); felder.nektarFlaechen.push(...lse); }
  // Satellit: zuerst der letzte Stand aus dem Zwischenspeicher (gleich welchen Alters), dann frisch vom Server
  const satDa = typeof satAktiv === 'function' && satAktiv();
  // Waldtracht (waldtracht.js) genauso: letzter Stand sofort, dann frisch (1 h Zwischenspeicher)
  const mitWt = satDa && typeof wtHolen === 'function';
  potLetzt = { sid, jahr, r, felder, wetter, jahre, sat: satDa ? satLetzt(sid, jahr) : null, wt: mitWt ? wtLetzt(sid, jahr) : null };
  potZeigen(true);
  // Stand der Freigabe unbekannt: erst fragen; ist sie aus, gleich neu zeichnen (Hinweis statt Kachel)
  const frei = satDa ? satPruefen() : null;
  if (frei) frei.then(an => an ? satHolen(sid, jahr) : null)
    .then(a => (a || potLetzt?.sat || !satAktiv()) && potNachladen(lauf, 'sat', a));
  // Waldtracht: immer neu zeichnen – ohne Antwort zeigt die Kachel Hinweis, Schloss oder Fehler
  if (frei && mitWt) frei.then(an => an ? wtHolen(sid, jahr) : null).then(d => potNachladen(lauf, 'wt', d));
  bodenHolen(felder.nektarFlaechen).then(b => potNachladen(lauf, 'boden', b));
  waldHolen(s.lat, s.lon, r).catch(() => null).then(w => potNachladen(lauf, 'wald', w));
}
// Völkerdichte Österreich: rund 456.000 Völker (2021, BMLUK) auf 83.879 km² ≈ 5,4 Völker je km²; unter Anpassen änderbar
const voelkerdichte = () => db.einstellungen.voelkerdichte ?? 5.4;
function umkreisSetzen(v) {
  const s = standort(potLetzt.sid), n = reZahl(v);
  if (n > 0) s.voelkerUmkreis = Math.round(n); else delete s.voelkerUmkreis;
  speichern(); potZeigen(false);
}
// Rechnet mit den zuletzt geladenen Feldern; neueKarte = Trachtflächen neu einzeichnen
let potLetzt = null;
// Reiner Rechenkern (kein Speichern, kein DOM) – auch für Punkte ohne Standplatz (ohne s.id: keine eigenen Völker).
// sat (Satellit-Auswertung): Wiesen- und Futter-Gruppen mit Faktor in sat.wiesenfaktor (ab 2 Jahren) → fb × wf; rest = Kulturen ohne nennenswerten Nektar
function potRechnen(s, felder, wetter, r, sat = null) {
  const gruppen = {}, rest = {};
  for (const [name, ha] of Object.entries(felder.kulturen)) {
    const g = nektarGruppe(name, felder.codes?.[name]), [lo, hi] = g ? nektarWert(g) : [0, 0];
    if (!g || hi <= 0) { rest[name] = (rest[name] || 0) + ha; continue; }
    const x = gruppen[g[0]] ??= { g, ha: 0, namen: new Set() }; x.ha += ha; x.namen.add(name);
  }
  // Nektarfaktor je Gruppe: Trockenheit, je Fläche angepasst an den Boden-Wasserspeicher
  const f = wetter?.faktor ?? 1;
  const zeilen = Object.values(gruppen).map(x => {
    const [lo, hi] = nektarWert(x.g), z = { ...x, lo, hi, min: x.ha * lo, max: x.ha * hi, fb: gruppenFaktor(felder.nektarFlaechen, x.g[0], f) };
    const wf = sat?.wiesenfaktor?.[x.g[0]]?.faktor;   // Wiesen- bzw. Futterfaktor (Spec 8b), der Server liefert ihn nur für Mahd-Gruppen mit Nektar
    if (typeof wf === 'number') { z.fb *= wf; z.wf = wf; }
    return z;
  }).sort((a, b) => b.max - a.max);
  const min = zeilen.reduce((a, z) => a + z.min * z.fb, 0), max = zeilen.reduce((a, z) => a + z.max * z.fb, 0);
  // E13: flächengewichtetes Mittel der angewandten Wiesen- und Futterfaktoren
  const mitWf = zeilen.filter(z => z.wf != null), wfHa = mitWf.reduce((a, z) => a + z.ha, 0);
  const wiesenfaktor = wfHa > 0 ? Math.round(mitWf.reduce((a, z) => a + z.ha * z.wf, 0) / wfHa * 100) / 100 : null;
  const voelker = s.id ? db.voelker.filter(v => v.standortId === s.id && v.status !== 'aufgelöst').length : 0;
  // Alle Völker im Flugradius (deine eingeschlossen): eigene Angabe oder Schätzung aus der Völkerdichte
  const schaetzung = Math.round(voelkerdichte() * Math.PI * r * r), umkreis = Math.max(voelker, s.voelkerUmkreis ?? schaetzung, 1);
  return { zeilen, rest, min, max, f, voelker, schaetzung, umkreis, wiesenfaktor };
}
// Kachel unter dem Potenzial: gespeicherte Trachtkarte oder Knopf zum Laden (OpenStreetMap). Braucht trachtInfo aus zusatz.js (zur Laufzeit).
function trachtKachel(s) {
  const knopf = text => `<button class="klein" onclick="trachtkarte('${s.id}')">${text}</button>`;
  return s.trachtkarte ? trachtInfo(s, `<div class="zeile" style="margin-top:6px">${knopf('Trachtkarte neu laden')}</div>`)
    : `<div class="karte" style="margin-bottom:12px"><h4>Trachtkarte ${esc(s.name)}</h4><p class="leise klein-t">Flächenanteile aus OpenStreetMap im Flugradius</p>${knopf('Trachtkarte laden')}</div>`;
}
function potZeigen(neueKarte) {
  const { sid, jahr, r, felder, wetter, jahre, boden, wald, sat = null, wt = null } = potLetzt, s = standort(sid), info = $('#tracht-info');
  if (!s || !info) return;
  const { zeilen, rest, min, max, f, voelker, schaetzung, umkreis, wiesenfaktor } = potRechnen(s, felder, wetter, r, sat), mitte = (min + max) / 2;
  (s.potenzial ??= {})[jahr] = { min: Math.round(min), max: Math.round(max), faktor: +f.toFixed(2), spei: wetter?.art === 'spei' ? Math.round(wetter.spei90 * 10) / 10 : null, radius: r, datum: heute(), wiesenfaktor }; speichern();
  // Satellit: echtes Blühfenster der Gelb-Gruppen, Wiesenzeilen (Faktor oder vorläufig); ohne Anmeldung einmal der Hinweis
  // (satHinweis ist HTML aus festen Texten, bei fehlender Stufe Pro mit Schloss – deshalb hier ohne esc)
  const SAT_GELB = ['raps', 'sonnenblume', 'phacelia'], mitSat = typeof satAktiv === 'function';
  const fenster = g => SAT_GELB.includes(g) ? sat?.bluete?.find(b => b.gruppe === g && b.hoehepunkt) : null;
  // Wiesen: „Wiesen: …“ mit dem Gruppennamen dahinter; Futter-Gruppen mit ihrem Namen vorn (Futterfaktor)
  const wiesen = zeilen.filter(z => sat?.wiesenfaktor?.[z.g[0]]).map(z => z.g[0].startsWith('wiese')
    ? `<li>${wiesenText(sat.wiesenfaktor[z.g[0]])} <span class="leise klein-t">(${esc(z.g[1])})</span></li>` : `<li>${wiesenText(sat.wiesenfaktor[z.g[0]], esc(z.g[1]))}</li>`);
  // Spec 8e: Äcker im Jahr ohne AMA-Liste (Vermutung des Servers) – Sommerkulturen zählen mit 0 kg/ha, bis die AMA-Liste kommt
  const acker = sat?.acker_vermutung, vermutet = '<span class="leise klein-t">(Satellit, vermutet)</span>';
  // Wintergetreide ohne die als Raps vermuteten Äcker (die stehen schon als Raps im Potenzial), nie unter 0
  const winter = Math.max(0, (acker?.wintergetreide_ha || 0) - (acker?.raps_vermutet_ha || 0));
  const hinweise = [...wiesen,
    ...(acker?.sommerkultur_ha > 0 ? [`<li>Sommerkulturen: ${zahl(acker.sommerkultur_ha, 1)} ha – Art erst mit der AMA-Liste ${vermutet}</li>`] : []),
    ...(winter >= 0.05 ? [`<li>Wintergetreide: ${zahl(winter, 1)} ha ${vermutet}</li>`] : [])];
  const blueteText = z => { const b = fenster(z.g[0]); return b ? `${satFensterText(b)}<div class="leise klein-t">Satellit${b.vermutet ? ', vermutet' : ''}</div>`
    : z.g[5][0] === z.g[5][1] ? MONAT[z.g[5][0]] : `${MONAT[z.g[5][0]]}–${MONAT[z.g[5][1]]}`; };
  // Abgleich mit den eigenen Ernten an diesem Standplatz
  const vergleich = Object.entries(s.potenzial).map(([j, p]) => ({ j, p, kg: ernteAm(s, j) })).filter(x => x.kg > 0).sort((a, b) => b.j.localeCompare(a.j));
  const anteile = vergleich.map(x => x.kg / ((x.p.min + x.p.max) / 2)), erfahrung = anteile.length ? anteile.reduce((a, b) => a + b, 0) / anteile.length : null;
  // Nektarflächen auf der Karte: dünner Rand, Antippen zeigt die Feld-Info unter der Karte, ab Zoom 15 Kulturname im Feld
  if (neueKarte && karte && window.L) feldEbene(s, felder.nektarFlaechen, r);
  const restHa = Object.values(rest).reduce((a, b) => a + b, 0), restTop = Object.entries(rest).sort((a, b) => b[1] - a[1]).slice(0, 6);
  info.innerHTML = `<div class="karte" id="pot-karte" style="margin-bottom:12px"><div class="kopf" style="margin-bottom:6px"><h4 style="margin:0">Trachtpotenzial ${esc(s.name)} · ${zahl(r)} km</h4>
      <select style="width:auto" onchange="potenzial('${sid}',this.value)">${jahre.map(j => `<option ${j === jahr ? 'selected' : ''}>${j}</option>`).join('')}</select></div>
    <div class="raster">
      <div class="karte kachel"><b>${zahl(min, 0)}–${zahl(max, 0)} kg</b>Honigpotenzial im Flugradius</div>
      <div class="karte kachel"><b>${zahl(min / umkreis, 0)}–${zahl(max / umkreis, 0)} kg</b>je Volk, geteilt auf ${zahl(umkreis, 0)} Völker im Umkreis (davon ${voelker} deine)
        <label class="klein-t" style="display:flex;gap:6px;align-items:center;margin-top:6px">Völker im Umkreis <input type="number" min="1" step="1" value="${s.voelkerUmkreis ?? ''}" placeholder="${schaetzung}" onchange="umkreisSetzen(this.value)" style="width:80px"></label>
        <span class="leise klein-t">${s.voelkerUmkreis ? 'deine Angabe' : `Schätzung aus ${zahl(voelkerdichte())} Völkern je km² – trag die Zahl ein, wenn du sie z. B. von der Ortsgruppe kennst`}</span></div>
      ${erfahrung != null ? `<div class="karte kachel"><b>${zahl(mitte * erfahrung / Math.max(1, voelker), 0)} kg</b>je Volk nach deiner Erfahrung (${zahl(erfahrung * 100, 0)} % des Potenzials)</div>` : ''}</div>
    ${wetter?.art === 'spei' ? `<ul class="hinweise" style="margin-top:10px"><li class="${/sehr|extrem/.test(speiStufe(wetter.spei90)) ? 'rot' : speiStufe(wetter.spei90) === 'trocken' ? '' : 'gruen'}">${speiText(wetter)} <span class="leise klein-t">(30 Tage: ${wetter.spei30 == null ? '–' : vzZahl(wetter.spei30)} · 365 Tage: ${wetter.spei365 == null ? '–' : vzZahl(wetter.spei365)}, Stand ${fmtD(wetter.datum)})</span></li></ul>`
      : wetter ? `<ul class="hinweise" style="margin-top:10px"><li class="${wetter.anteil < 0.7 ? 'rot' : wetter.anteil < 0.9 ? '' : 'gruen'}">Niederschlag ${fmtD(wetter.von)} bis ${fmtD(wetter.bis)}: <b>${zahl(wetter.jetzt, 0)} mm</b> = <b>${zahl(wetter.anteil * 100, 0)} %</b> des Mittels der ${wetter.jahre} Jahre davor (${zahl(wetter.mittel, 0)} mm) → Nektarfaktor <b>${zahl(wetter.faktor, 2)}</b>${wetter.anteil < 0.7 ? ' – deutlich zu trocken' : wetter.anteil > 1.2 ? ' – nasser als üblich' : ''}.</li></ul>`
      : '<p class="leise klein-t">Weder Dürreindex noch Niederschlagsdaten erreichbar – ohne Trockenheitsfaktor gerechnet.</p>'}
    <h4 style="margin-top:12px">Trachtflächen laut AMA ${jahr}</h4>` +
    tabelle(['Tracht', 'Fläche', 'Blüte', 'Richtwert', 'Potenzial'], zeilen.map(z => [`<b>${esc(z.g[1])}</b><div class="leise klein-t">${esc([...z.namen].join(', ').toLowerCase())}</div>`, zahl(z.ha, 1) + ' ha',
      blueteText(z), `${z.lo}–${z.hi} kg/ha`, `${zahl(z.min * z.fb, 0)}–${zahl(z.max * z.fb, 0)} kg`])) +
    `${hinweise.length ? `<ul class="hinweise" style="margin-top:10px">${hinweise.join('')}</ul>` : ''}
    ${mitSat ? (satAktiv() && !satStufeFehlt() ? satKachel(sat, sid, r) : `<p class="leise klein-t">${satHinweis()}.</p>`) : ''}
    ${typeof wtKachel === 'function' ? wtKachel(s, jahr, wald, wt) : ''}
    ${felder.nektarFlaechen.length ? `<p class="leise klein-t">${boden === undefined ? 'Bodenkarte wird geladen …' : bodenText(boden)}</p>` : ''}
    ${wald ? `<p class="leise klein-t">${waldText(wald)}</p>` : ''}
    <p class="klein-t">Ohne nennenswerten Nektar: ${zahl(restHa, 0)} ha${restTop.length ? ` (${restTop.map(([n, ha]) => `${n.toLowerCase()} ${zahl(ha, 0)} ha`).join(', ')} …)` : ''}. Auf der Karte sind die Trachtflächen gelb markiert.</p>
    ${swTracht(s, jahr)}${vergleich.length ? '<h4>Abgleich mit deinen Ernten an diesem Standplatz</h4>' + tabelle(['Jahr', 'Potenzial', 'Deine Ernte', 'Anteil'], vergleich.map((x, i) => [x.j, `${zahl(x.p.min, 0)}–${zahl(x.p.max, 0)} kg`, zahl(x.kg, 1) + ' kg', zahl(anteile[i] * 100, 0) + ' %']))
      : '<p class="leise klein-t">Sobald Honigernten mit diesem Standplatz eingetragen sind, vergleicht die App sie mit dem Potenzial des jeweiligen Jahres (Jahr oben wählen und berechnen) und schätzt daraus deinen Ertrag.</p>'}
    <p class="leise klein-t">So ist gerechnet: Fläche je Kultur × Honig-Richtwert je Hektar × Nektarfaktor aus der Trockenheit (Dürreindex SPEI, sonst Niederschlag), je Fläche angepasst an den Wasserspeicher des Bodens. Die Richtwerte sind Faustzahlen aus der Literatur und schwanken stark nach Sorte, Boden und Jahr – unter ⚙ Anpassen kannst du sie ändern. Das Potenzial ist die Menge, die die Flächen bestenfalls liefern; was die Völker selbst brauchen und was fremde Völker holen, ist nicht abgezogen. Wald (Honigtau), Gärten und Straßenbäume sind nicht enthalten${wald ? ' – der Waldanteil steht oben nur zur Einordnung, dazu die Trachtkarte' : ''}. INVEKOS Schläge ${jahr} (CC BY 4.0). ${QUELLEN}.${sat ? ' ' + satQuelle(sat) + '.' : ''}</p></div>`;
}

// ---------- Richtwerte unter „Anpassen“ ----------
function nektarSetzen(k, i, v) {
  const g = NEKTAR.find(x => x[0] === k), w = [...nektarWert(g)]; w[i] = Math.max(0, reZahl(v) ?? 0);
  if (w[1] < w[0]) w[1] = w[0];
  (db.einstellungen.nektar ??= {})[k] = w; speichern(); render();
}
function nektarHtml() {
  return `<div class="karte"><h4>Honig-Richtwerte je Hektar (Trachtpotenzial)</h4>${NEKTAR.map(g => { const [lo, hi] = nektarWert(g), eigen = db.einstellungen.nektar?.[g[0]]; return `<div class="ord-zeile">
      <span style="flex:1">${esc(g[1])}${eigen ? ' <span class="leise klein-t">· eigener Wert</span>' : ''}</span>
      <input type="number" min="0" step="5" value="${lo}" style="width:68px" onchange="nektarSetzen('${g[0]}',0,this.value)">–<input type="number" min="0" step="5" value="${hi}" style="width:68px" onchange="nektarSetzen('${g[0]}',1,this.value)"> kg</div>`; }).join('')}
    ${db.einstellungen.nektar ? '<button class="klein" style="margin-top:8px" onclick="delete db.einstellungen.nektar;speichern();render()">Ursprüngliche Richtwerte</button>' : ''}</div>`;
}
