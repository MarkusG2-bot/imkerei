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
const nektarGruppe = name => NEKTAR.find(g => g[2](String(name).toUpperCase()));

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
// Alle Schläge, deren Mitte im Flugradius liegt; liefert Fläche je Kulturart und die Nektarflächen für die Karte
async function felderHolen(s, jahr, r, info) {
  const id = await invekosId(jahr); if (!id) throw new Error('Für ' + jahr + ' gibt es noch keine Felddaten');
  const dLat = r / 111.32, kx = Math.cos(s.lat * Math.PI / 180), dLon = dLat / kx;
  const bbox = [s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat].map(x => x.toFixed(5)).join(',');
  let url = `${INVEKOS}/collections/${encodeURIComponent(id)}/items?bbox=${bbox}&limit=1000&f=json`, seite = 0;
  const kulturen = {}, nektarFlaechen = [];
  while (url && seite < 60) {
    const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json(); seite++;
    info(`Lade Felder ${jahr} … ${zahl(Math.min(seite * 1000, j.numberMatched || seite * 1000), 0)}${j.numberMatched ? ' von ' + zahl(j.numberMatched, 0) : ''}`);
    for (const f of j.features) {
      const g = f.geometry; if (!g) continue;
      const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
      const x = ring.reduce((a, p) => a + p[0], 0) / ring.length, y = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      if (((y - s.lat) * 111.32) ** 2 + ((x - s.lon) * 111.32 * kx) ** 2 > r * r) continue;
      const name = f.properties.snar_bezeichnung || 'unbekannt', ha = f.properties.sl_flaeche_brutto_ha || 0;
      kulturen[name] = (kulturen[name] || 0) + ha;
      const gr = nektarGruppe(name); if (gr && nektarWert(gr)[1] > 0) nektarFlaechen.push({ g, gruppe: gr[1], name, ha });
    }
    url = j.links?.find(l => l.rel === 'next')?.href;
  }
  return { kulturen, nektarFlaechen };
}

// ---------- Niederschlag: letzte 6 Monate gegenüber den Vorjahren ----------
async function niederschlag(s) {
  const key = 'imkerei-nd-' + s.lat.toFixed(3) + ',' + s.lon.toFixed(3), c = JSON.parse(localStorage.getItem(key) || 'null');
  if (c && Date.now() - c.t < 864e5) return c.d;
  const ende = iso(new Date(Date.now() - 6 * 864e5));
  const j = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${s.lat}&longitude=${s.lon}&start_date=2010-01-01&end_date=${ende}&daily=precipitation_sum&timezone=auto`)).json();
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

// ---------- Berechnung und Anzeige ----------
let potEbene = null;
const ernteAm = (s, jahr) => db.ernten.filter(e => e.produkt === 'Honig' && e.datum?.startsWith(jahr) && (e.standortId || volk(e.volkId)?.standortId) === s.id).reduce((a, e) => a + (e.kg || 0), 0);
async function potenzial(sid, jahr) {
  const s = standort(sid), info = $('#tracht-info'), r = flugradius();
  if (!s || !hatKoord(s)) return;
  const meldung = t => { const el = $('#pot-info'); if (el) el.textContent = t; };
  info.innerHTML = '<div class="karte" style="margin-bottom:12px"><h4>Trachtpotenzial ' + esc(s.name) + '</h4><div class="leise" id="pot-info">Suche die neuesten Felddaten …</div></div>';
  const jahre = invekosJahre();
  jahr = String(jahr || await invekosNeuestes() || '');
  if (!jahr) return info.innerHTML = '<p class="leer">Die Felddaten der AMA sind gerade nicht erreichbar (keine Internetverbindung?).</p>';
  let felder, wetter;
  try {
    [felder, wetter] = await Promise.all([felderHolen(s, jahr, r, meldung), niederschlag(s).then(d => trockenheit(d, +jahr)).catch(() => null)]);
  } catch (e) { return info.innerHTML = `<p class="leer">Felder konnten nicht geladen werden (${esc(e.message)}). Bei großem Flugradius dauert es länger – später nochmal versuchen.</p>`; }
  if (!$('#tracht-info')) return;
  // Gruppensummen
  const gruppen = {}, rest = {};
  for (const [name, ha] of Object.entries(felder.kulturen)) {
    const g = nektarGruppe(name), [lo, hi] = g ? nektarWert(g) : [0, 0];
    if (!g || hi <= 0) { rest[name] = (rest[name] || 0) + ha; continue; }
    const x = gruppen[g[0]] ??= { g, ha: 0, namen: new Set() }; x.ha += ha; x.namen.add(name);
  }
  const zeilen = Object.values(gruppen).map(x => { const [lo, hi] = nektarWert(x.g); return { ...x, lo, hi, min: x.ha * lo, max: x.ha * hi }; }).sort((a, b) => b.max - a.max);
  const f = wetter?.faktor ?? 1, min = zeilen.reduce((a, z) => a + z.min, 0) * f, max = zeilen.reduce((a, z) => a + z.max, 0) * f, mitte = (min + max) / 2;
  const voelker = db.voelker.filter(v => v.standortId === s.id && v.status !== 'aufgelöst').length;
  (s.potenzial ??= {})[jahr] = { min: Math.round(min), max: Math.round(max), faktor: +f.toFixed(2), radius: r, datum: heute() }; speichern();
  // Abgleich mit den eigenen Ernten an diesem Standplatz
  const vergleich = Object.entries(s.potenzial).map(([j, p]) => ({ j, p, kg: ernteAm(s, j) })).filter(x => x.kg > 0).sort((a, b) => b.j.localeCompare(a.j));
  const anteile = vergleich.map(x => x.kg / ((x.p.min + x.p.max) / 2)), erfahrung = anteile.length ? anteile.reduce((a, b) => a + b, 0) / anteile.length : null;
  // Nektarflächen auf der Karte
  potEbene?.remove(); potEbene = null;
  if (karte && window.L) {
    potEbene = L.layerGroup(felder.nektarFlaechen.map(n => L.geoJSON(n.g, { style: { stroke: false, fillColor: '#e0a100', fillOpacity: 0.55 } }).bindTooltip(`${esc(n.name)} · ${zahl(n.ha, 2)} ha`))).addTo(karte);
    karte.fitBounds(L.latLng(s.lat, s.lon).toBounds(r * 2000 + 400));
  }
  const restHa = Object.values(rest).reduce((a, b) => a + b, 0), restTop = Object.entries(rest).sort((a, b) => b[1] - a[1]).slice(0, 6);
  info.innerHTML = `<div class="karte" style="margin-bottom:12px"><div class="kopf" style="margin-bottom:6px"><h4 style="margin:0">Trachtpotenzial ${esc(s.name)} · ${zahl(r)} km</h4>
      <select style="width:auto" onchange="potenzial('${s.id}',this.value)">${jahre.map(j => `<option ${j === jahr ? 'selected' : ''}>${j}</option>`).join('')}</select></div>
    <div class="raster">
      <div class="karte kachel"><b>${zahl(min, 0)}–${zahl(max, 0)} kg</b>Honigpotenzial im Flugradius</div>
      <div class="karte kachel"><b>${voelker ? zahl(min / voelker, 0) + '–' + zahl(max / voelker, 0) + ' kg' : '–'}</b>rechnerisch je Volk (${voelker} am Stand, fremde Völker im Umkreis nicht abgezogen)</div>
      ${erfahrung != null ? `<div class="karte kachel"><b>${zahl(mitte * erfahrung / Math.max(1, voelker), 0)} kg</b>je Volk nach deiner Erfahrung (${zahl(erfahrung * 100, 0)} % des Potenzials)</div>` : ''}</div>
    ${wetter ? `<ul class="hinweise" style="margin-top:10px"><li class="${wetter.anteil < 0.7 ? 'rot' : wetter.anteil < 0.9 ? '' : 'gruen'}">Niederschlag ${fmtD(wetter.von)} bis ${fmtD(wetter.bis)}: <b>${zahl(wetter.jetzt, 0)} mm</b> = <b>${zahl(wetter.anteil * 100, 0)} %</b> des Mittels der ${wetter.jahre} Jahre davor (${zahl(wetter.mittel, 0)} mm) → Nektarfaktor <b>${zahl(wetter.faktor, 2)}</b>${wetter.anteil < 0.7 ? ' – deutlich zu trocken' : wetter.anteil > 1.2 ? ' – nasser als üblich' : ''}.</li></ul>`
      : '<p class="leise klein-t">Niederschlagsdaten nicht erreichbar – ohne Trockenheitsfaktor gerechnet.</p>'}
    <h4 style="margin-top:12px">Trachtflächen laut AMA ${jahr}</h4>` +
    tabelle(['Tracht', 'Fläche', 'Blüte', 'Richtwert', 'Potenzial'], zeilen.map(z => [`<b>${esc(z.g[1])}</b><div class="leise klein-t">${esc([...z.namen].join(', ').toLowerCase())}</div>`, zahl(z.ha, 1) + ' ha',
      z.g[5][0] === z.g[5][1] ? MONAT[z.g[5][0]] : `${MONAT[z.g[5][0]]}–${MONAT[z.g[5][1]]}`, `${z.lo}–${z.hi} kg/ha`, `${zahl(z.min * f, 0)}–${zahl(z.max * f, 0)} kg`])) +
    `<p class="klein-t">Ohne nennenswerten Nektar: ${zahl(restHa, 0)} ha${restTop.length ? ` (${restTop.map(([n, ha]) => `${n.toLowerCase()} ${zahl(ha, 0)} ha`).join(', ')} …)` : ''}. Auf der Karte sind die Trachtflächen gelb markiert.</p>
    ${vergleich.length ? '<h4>Abgleich mit deinen Ernten an diesem Standplatz</h4>' + tabelle(['Jahr', 'Potenzial', 'Deine Ernte', 'Anteil'], vergleich.map((x, i) => [x.j, `${zahl(x.p.min, 0)}–${zahl(x.p.max, 0)} kg`, zahl(x.kg, 1) + ' kg', zahl(anteile[i] * 100, 0) + ' %']))
      : '<p class="leise klein-t">Sobald Honigernten mit diesem Standplatz eingetragen sind, vergleicht die App sie mit dem Potenzial des jeweiligen Jahres (Jahr oben wählen und berechnen) und schätzt daraus deinen Ertrag.</p>'}
    <p class="leise klein-t">So ist gerechnet: Fläche je Kultur × Honig-Richtwert je Hektar × Nektarfaktor aus dem Niederschlag. Die Richtwerte sind Faustzahlen aus der Literatur und schwanken stark nach Sorte, Boden und Jahr – unter ⚙ Anpassen kannst du sie ändern. Das Potenzial ist die Menge, die die Flächen bestenfalls liefern; was die Völker selbst brauchen und was fremde Völker holen, ist nicht abgezogen. Wald (Honigtau), Gärten und Straßenbäume sind nicht enthalten – dafür die Trachtkarte. Felddaten: AMA, INVEKOS Schläge ${jahr} (CC BY 4.0); Wetter: Open-Meteo.</p></div>`;
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
