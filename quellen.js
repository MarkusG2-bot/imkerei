// Gemeinsame Datenquellen: Zwischenspeicher, Abfragebremse, Abruf mit Zeitgrenze, GeoSphere-Sperre.
// Wird vor ertrag.js geladen, nutzt Hilfsfunktionen anderer Dateien erst zur Laufzeit. Kein DOM.

const GS = 'https://dataset.api.hub.geosphere.at/v1/timeseries/';
const GS_SPERRE = 'imkerei-gs-sperre';

function k3(lat, lon) { return `${(+lat).toFixed(3)},${(+lon).toFixed(3)}`; }

// Eintrag { t, d }: frisch → d, sonst neu laden; scheitert das Laden, gilt der alte Eintrag gleich welchen Alters.
async function quelleCache(key, maxAlter, lader) {
  let alt = null;
  try { alt = JSON.parse(localStorage.getItem(key)); } catch (e) {}
  if (alt && Date.now() - alt.t < maxAlter) return alt.d;
  try {
    const d = await lader();
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
    return d;
  } catch (e) {
    if (alt) return alt.d;
    throw e;
  }
}

// Gleitendes Fenster: höchstens 4 Starts je 1000 ms, Reihenfolge wie Aufruf.
let bremseStarts = [], bremseKette = Promise.resolve();
function bremse() {
  const dran = bremseKette.then(async () => {
    if (bremseStarts.length >= 4) {
      const warten = bremseStarts[bremseStarts.length - 4] + 1000 - Date.now();
      if (warten > 0) await new Promise(r => setTimeout(r, warten));
    }
    bremseStarts = [...bremseStarts.slice(-3), Date.now()];
  });
  bremseKette = dran;
  return dran;
}

async function quelleAbruf(url, art = 'json') {
  await bremse();
  let antwort;
  try { antwort = await fetch(url, { signal: AbortSignal.timeout(20000) }); }
  catch (e) { throw Object.assign(new Error(`Keine Verbindung: ${url}`), { status: 0 }); }
  if (!antwort.ok) throw Object.assign(new Error(`Abruf fehlgeschlagen (${antwort.status}): ${url}`), { status: antwort.status });
  return art === 'arrayBuffer' ? antwort.arrayBuffer() : antwort.json();
}

// GeoSphere: nach 429 oder Netzfehler eine Stunde lang nicht mehr fragen.
async function gsAbruf(pfad) {
  let sperre = 0;
  try { sperre = +localStorage.getItem(GS_SPERRE) || 0; } catch (e) {}
  if (sperre > Date.now()) throw Object.assign(new Error('GeoSphere gesperrt bis ' + new Date(sperre).toLocaleTimeString()), { status: 429 });
  try { return await quelleAbruf(GS + pfad); }
  catch (e) {
    if (e.status === 429 || e.status === 0) try { localStorage.setItem(GS_SPERRE, String(Date.now() + 3600e3)); } catch (x) {}
    throw e;
  }
}

// GeoSphere-Zeitreihe (geojson) → { zeiten, p: { TN: [...], ... } }
function gsReihe(json) {
  const p = json.features[0].properties.parameters;
  return { zeiten: json.timestamps, p: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.data])) };
}

// SPARTACUS-Tageswerte (1 km-Raster) seit 1. Jänner bis gestern: { datum: [tn, tx, rr] }, außerhalb Österreichs null.
async function gsTage(lat, lon) {
  const jahr = new Date().getFullYear(), gestern = iso(new Date(Date.now() - 864e5));
  if (gestern < `${jahr}-01-01`) return null;
  return quelleCache(`imkerei-gs-${k3(lat, lon)}-${jahr}`, 864e5, async () => {
    const r = gsReihe(await gsAbruf(`historical/spartacus-v2-1d-1km?lat_lon=${lat},${lon}&parameters=TN,TX,RR&start=${jahr}-01-01&end=${gestern}&output_format=geojson`));
    const tage = {};
    r.zeiten.forEach((z, i) => { const tn = r.p.TN?.[i], tx = r.p.TX?.[i]; if (tn != null && tx != null) tage[z.slice(0, 10)] = [tn, tx, r.p.RR?.[i] ?? null]; });
    return Object.keys(tage).length ? tage : null;
  });
}

// Zahl mit Vorzeichen: −0,8 · +1,25 · 0,0 (Minuszeichen, Dezimalkomma, + nur über null)
function vzZahl(v, stellen = 1) {
  const r = +(+v).toFixed(stellen);
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(stellen).replace('.', ',');
}

// Quellenangaben für die Fußzeilen (Lizenzen laut Anbieter)
const QUELLEN = 'Wetter: GeoSphere Austria (CC BY 4.0), Open-Meteo; Boden: eBOD, BFW (CC BY 3.0 AT); Wald: Copernicus HRL, EEA; Felder: AMA INVEKOS';
// Woher die Wärmesumme kommt; ohne quelle (alter Zwischenspeicher) war es Open-Meteo
function waermeQuelleText(d) {
  return `Wärmesumme: ${d.quelle || 'Open-Meteo'}${d.versatz != null ? `, mit Stationsabgleich ${vzZahl(d.versatz)} °C` : ''}`;
}

// Dürreindex SPEI (WINFORE, 1 km-Raster): letzter Tag mit SPEI90 in den 7 Tagen bis zum Stichtag, sonst null.
async function gsSpei(lat, lon, stichtag) {
  return quelleCache(`imkerei-spei-${k3(lat, lon)}-${stichtag}`, 864e5, async () => {
    const start = iso(new Date(new Date(stichtag + 'T12:00').getTime() - 6 * 864e5));
    const r = gsReihe(await gsAbruf(`historical/winfore-v2-1d-1km?lat_lon=${lat},${lon}&parameters=SPEI30,SPEI90,SPEI365&start=${start}&end=${stichtag}&output_format=geojson`));
    for (let i = r.zeiten.length - 1; i >= 0; i--) if (r.p.SPEI90?.[i] != null)
      return { datum: r.zeiten[i].slice(0, 10), spei30: r.p.SPEI30?.[i] ?? null, spei90: r.p.SPEI90[i], spei365: r.p.SPEI365?.[i] ?? null };
    return null;
  });
}

// GeoSphere-Stundenvorhersage (AROME 1 km), Parameternamen laut Metadaten des Dienstes.
const NWP_PARAM = { t: '2t', regen: 'tp', u: '10u', v: '10v', boe: '10fg', strahlung: 'ssrd', sonne: 'sund' };

// Stunden [{ zeit: 'YYYY-MM-DDTHH' (Ortszeit Wien, Ende der Stunde), t, regen, wind, boe, strahlung, sonne }], ohne Werte null.
async function gsStunden(lat, lon) {
  return quelleCache(`imkerei-nwp-${k3(lat, lon)}`, 3 * 3600e3, async () => {
    const r = gsReihe(await gsAbruf(`forecast/nwp-v2-1h-1km?lat_lon=${lat},${lon}&parameters=${Object.values(NWP_PARAM).join(',')}&output_format=geojson`));
    const w = (k, i) => r.p[NWP_PARAM[k]]?.[i] ?? null;
    const stunden = r.zeiten.map((z, i) => {
      const u = w('u', i), v = w('v', i);
      return { zeit: new Date(z).toLocaleString('sv', { timeZone: 'Europe/Vienna' }).slice(0, 13).replace(' ', 'T'),
        t: w('t', i), regen: w('regen', i), wind: u == null || v == null ? null : Math.round(Math.hypot(u, v) * 10) / 10,
        boe: w('boe', i), strahlung: w('strahlung', i), sonne: w('sonne', i) };
    });
    return stunden.length ? stunden : null;
  });
}

// ---------- Messwerte der Stockwaage am Stand (Server-Übersicht, zeit in ms) ----------
const UMSCHWUNG = 'Wetterumschwung, Durchsicht heute früh erledigen';   // bei Druckabfall über 3 hPa in 3 h

// Luftdruckänderung in 3 h (hPa, 0,1), nur mit Vergleichswert 2,5–4,5 h davor, sonst null.
function druckTendenz(w, vor3h) {
  if (w?.luftdruck_hpa == null || vor3h?.luftdruck_hpa == null || w.zeit == null || vor3h.zeit == null) return null;
  const abstand = w.zeit - vor3h.zeit;
  if (abstand < 2.5 * 3600e3 || abstand > 4.5 * 3600e3) return null;
  return Math.round((w.luftdruck_hpa - vor3h.luftdruck_hpa) * 10) / 10;
}

// Frische Messwerte (höchstens 3 h alt) aus der Übersicht: { temp, feuchte, wind, boe (km/h), regen, tendenz, zeit } oder null.
function standMesswerte(u, jetzt = Date.now()) {
  const frisch = x => x?.zeit != null && jetzt - x.zeit <= 3 * 3600e3, kmh = ms => Math.round(ms * 36) / 10;
  const m = { tendenz: null }, zeiten = [], b = u?.bericht, w = u?.wetter;
  if (frisch(b)) {
    if (b.aussen_temp_c != null) m.temp = b.aussen_temp_c;
    if (b.aussen_feuchte_pct != null) m.feuchte = b.aussen_feuchte_pct;
    if (m.temp != null || m.feuchte != null) zeiten.push(b.zeit);
  }
  if (frisch(w)) {
    if (w.wind_ms != null) m.wind = kmh(w.wind_ms);
    if (w.boe_ms != null) m.boe = kmh(w.boe_ms);
    if (w.regen_heute_mm != null) m.regen = w.regen_heute_mm;
    m.tendenz = druckTendenz(w, u.wetter_vor3h);
    if (m.wind != null || m.boe != null || m.regen != null || m.tendenz != null) zeiten.push(w.zeit);
  }
  if (!zeiten.length) return null;
  m.zeit = Math.max(...zeiten);
  return m;
}

// Tag fürs Flugwetter: gemessene Temperatur, Wind und Regen ersetzen die Vorhersage.
function flugMitMessung(t, m) {
  if (!m) return t;
  const n = { ...t };
  if (m.temp != null) n.tmax = m.temp;
  if (m.wind != null) n.wind = m.wind;
  if (m.regen != null) n.regen = m.regen;
  return n;
}

// Stationsabgleich: mittlere Abweichung Waage-Station − 1 km-Raster (°C, 0,1, höchstens ±3), ab 3 gemeinsamen Tagen, sonst null.
function stationsVersatz(gs, tage) {
  if (!gs || !tage?.length) return null;
  const d = [];
  for (const x of tage) {
    const r = gs[x.tag], st = x.t_min != null && x.t_max != null ? (x.t_min + x.t_max) / 2 : x.t_mittel;
    if (r && st != null) d.push(st - (r[0] + r[1]) / 2);
  }
  if (d.length < 3) return null;
  const v = Math.round(d.reduce((a, b) => a + b, 0) / d.length * 10) / 10;
  return Math.max(-3, Math.min(3, v));
}

// Punkt [x, y] in einem Polygon aus Ringen (Außenring und Löcher): gerade/ungerade-Regel über alle Kanten.
function punktInRingen([x, y], ringe) {
  let drin = false;
  for (const ring of ringe)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) drin = !drin;
    }
  return drin;
}

// ---------- Vector-Tiles (Mapbox-Format, Protobuf) – kleiner eigener Leser, nur was die Bodenkarte braucht ----------
// → { layer: { extent, features: [{ typ, props, ringe: [[[x, y], …], …] }] } }; y zählt in der Kachel von oben
function mvtLesen(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = new TextDecoder();
  let pos = 0;
  // Varint arithmetisch (Bit-Operatoren rechnen nur mit 32 Bit)
  const varint = () => { let n = 0, f = 1, b; do { b = bytes[pos++]; n += (b & 127) * f; f *= 128; } while (b >= 128); return n; };
  const zz = n => n % 2 ? -(n + 1) / 2 : n / 2;
  // Felder von a bis e: je(nr, wert) – Drahttyp 0 Zahl, 1/5 Position der 8/4 Byte, 2 [anfang, ende]; je darf pos verschieben
  const felder = (a, e, je) => {
    pos = a;
    while (pos < e) {
      const k = varint(), nr = Math.floor(k / 8), typ = k % 8;
      if (typ === 0) je(nr, varint(), typ);
      else if (typ === 1) { pos += 8; je(nr, pos - 8, typ); }
      else if (typ === 5) { pos += 4; je(nr, pos - 4, typ); }
      else if (typ === 2) { const l = varint(), anf = pos, ende = pos + l; je(nr, [anf, ende], typ); pos = ende; }
      else throw new Error('Vector-Tile: unbekannter Drahttyp ' + typ);
    }
  };
  const gepackt = ([a, e]) => { const z = []; pos = a; while (pos < e) z.push(varint()); return z; };
  const wert = ([a, e]) => { let w = null;
    felder(a, e, (nr, v) => { w = nr === 1 ? text.decode(bytes.subarray(v[0], v[1])) : nr === 2 ? dv.getFloat32(v, true) : nr === 3 ? dv.getFloat64(v, true)
      : nr === 4 || nr === 5 ? v : nr === 6 ? zz(v) : nr === 7 ? v === 1 : w; });
    return w; };
  const ringeAus = g => { const ringe = []; let x = 0, y = 0, ring = null;
    for (let i = 0; i < g.length;) {
      const id = g[i] % 8, n = Math.floor(g[i++] / 8);
      if (id === 7) { ring = null; continue; }
      for (let j = 0; j < n; j++) {
        x += zz(g[i++]); y += zz(g[i++]);
        if (id === 1) ringe.push(ring = [[x, y]]); else ring?.push([x, y]);
      }
    }
    return ringe; };
  const tile = {};
  felder(0, bytes.length, (nr, v) => {
    if (nr !== 3) return;
    const layer = { name: '', extent: 4096, roh: [], keys: [], werte: [] };
    felder(v[0], v[1], (ln, lv) => {
      if (ln === 1) layer.name = text.decode(bytes.subarray(lv[0], lv[1]));
      else if (ln === 2) { const f = { typ: 0, tags: [], ringe: [] };
        felder(lv[0], lv[1], (fn, fv) => { if (fn === 2) f.tags = gepackt(fv); else if (fn === 3) f.typ = fv; else if (fn === 4) f.ringe = ringeAus(gepackt(fv)); });
        layer.roh.push(f); }
      else if (ln === 3) layer.keys.push(text.decode(bytes.subarray(lv[0], lv[1])));
      else if (ln === 4) layer.werte.push(wert(lv));
      else if (ln === 5) layer.extent = lv;
    });
    tile[layer.name] = { extent: layer.extent, features: layer.roh.map(f => {
      const props = {}; for (let i = 0; i + 1 < f.tags.length; i += 2) props[layer.keys[f.tags[i]]] = layer.werte[f.tags[i + 1]];
      return { typ: f.typ, props, ringe: f.ringe }; }) };
  });
  return tile;
}

// Web-Mercator-Kachel zu einem Punkt; px/py = Lage in der Kachel 0…1 (py von oben)
function kachelVon(lat, lon, z) {
  const n = 2 ** z, b = lat * Math.PI / 180, fx = (lon + 180) / 360 * n, fy = (1 - Math.log(Math.tan(b) + 1 / Math.cos(b)) / Math.PI) / 2 * n;
  const x = Math.floor(fx), y = Math.floor(fy);
  return { x, y, px: fx - x, py: fy - y };
}

// eBOD (BFW): Bodenform am Punkt → Code der nutzbaren Feldkapazität 1–5, kein Treffer oder Kachel fehlt (404) null; sonst nicht ladbar → Fehler.
// kacheln: Map je Lauf, merkt das Versprechen, damit jede Kachel nur einmal geladen wird
const EBOD = 'https://bodenkarte.at/data/bodenkarte-tiles/';
async function bodenAmPunkt(lat, lon, kacheln) {
  const k = kachelVon(lat, lon, 13), pfad = `13/${k.x}/${k.y}`;
  if (!kacheln.has(pfad)) kacheln.set(pfad, quelleAbruf(`${EBOD}${pfad}.pbf`, 'arrayBuffer').then(b => mvtLesen(new Uint8Array(b)).bodenform_mpoly || null,
    e => { if (e.status === 404) return null; throw e; }));
  const l = await kacheln.get(pfad);
  if (!l) return null;
  const p = [k.px * l.extent, k.py * l.extent], f = l.features.find(f => punktInRingen(p, f.ringe));
  const c = f?.props.nutzbare_feldkapazitaet;
  return c == null ? null : Number(c);
}
// Code 1–2 sehr gering/gering (< 140 mm), 3 mittel, 4–5 hoch/sehr hoch (> 220 mm); unbekannt → mittel
function bodenKlasse(code) { const c = Number(code); return c === 1 || c === 2 ? 'gering' : c === 4 || c === 5 ? 'hoch' : 'mittel'; }

// ---------- EEA Copernicus Waldkarte 2018 (Kronendichte und Blatttyp, 10 m Raster) ----------
const EEA = 'https://image.discomap.eea.europa.eu/arcgis/rest/services/GioLandPublic/';
// 37 Punkte im Sechseckgitter mit Abstand r/3: Mitte zuerst, dann Ringe 1–3 (6 / 12 / 18); km → Grad über 111,32 und cos(Breite)
function sechseckRaster(lat, lon, r) {
  const d = r / 3, cos = Math.cos(lat * Math.PI / 180), p = [[lat, lon]];
  for (let k = 1; k <= 3; k++)
    for (let q = -k; q <= k; q++)
      for (let s = -k; s <= k; s++) {
        if (Math.max(Math.abs(q), Math.abs(s), Math.abs(q + s)) !== k) continue;
        const x = d * (q + s / 2), y = d * s * Math.sqrt(3) / 2;
        p.push([lat + y / 111.32, lon + x / (111.32 * cos)]);
      }
  return p;
}
// → { anteil, nadel, gueltig } | null (unter 20 gültigen Punkten, obwohl alle geantwortet haben); Wald = Kronendichte ≥ 30 %
// Fehler statt null, wenn kein Punkt antwortet oder unter 20 gültig sind und Abrufe fehlten – sonst stünde 30 Tage „kein Wald“ im Speicher
async function waldHolen(lat, lon, r) {
  return quelleCache(`imkerei-wald-${k3(lat, lon)}-${r}`, 30 * 864e5, async () => {
    const wert = (dienst, [la, lo]) => quelleAbruf(`${EEA}${dienst}/ImageServer/identify?geometry=${encodeURIComponent(JSON.stringify({ x: lo, y: la, spatialReference: { wkid: 4326 } }))}`
      + '&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json').then(j => j?.error || j?.value == null ? null : String(j.value), () => null);   // ArcGIS meldet Fehler auch mit HTTP 200
    const punkte = await Promise.all(sechseckRaster(lat, lon, r).map(p => Promise.all([wert('HRL_TreeCoverDensity_2018', p), wert('HRL_DominantLeafType2018', p)])));
    if (punkte.every(([dichte, typ]) => dichte === null && typ === null)) throw new Error('EEA-Waldkarte nicht erreichbar');
    let gueltig = 0, wald = 0, laub = 0, nadel = 0;
    for (const [dichte, typ] of punkte) {
      if (!/^\d{1,3}$/.test(dichte) || +dichte > 100) continue;   // NoData, 255, Fehler: unbekannt
      gueltig++;
      if (+dichte < 30) continue;
      wald++;
      if (typ === '1') laub++; else if (typ === '2') nadel++;
    }
    if (gueltig < 20 && punkte.some(([dichte]) => dichte === null)) throw new Error('EEA-Waldkarte nur teilweise erreichbar');
    if (gueltig < 20) return null;
    return { anteil: wald / gueltig, nadel: laub + nadel ? nadel / (laub + nadel) : null, gueltig };
  });
}
