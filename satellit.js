// Satellit über den Stockwaage-Server: Standplätze melden, Auswertung je Standplatz und Jahr abholen (mit Zwischenspeicher).
// Nur mit Anmeldung am Stockwaage-Server und Freigabe „satellit“. Wird nach stockwaage.js geladen, nutzt swKonto/swAbruf/quelleCache zur Laufzeit.
// Datenschutz: Koordinaten gehen nur an den Server, wenn die Freigabe „satellit“ bekannt aktiv ist (geprüft höchstens einmal je Stunde).

const SAT_SPEICHER = 'imkerei-sat';   // { t, sig, status, frei, veraltet, ft, anker } – t: letzte Meldung, ft: Freigabe zuletzt bekannt, veraltet: nur ältere Fassung erteilt, anker: { id: [lat, lon, r] }
const SAT_HINWEIS = 'Satellitenwerte gibt es mit Anmeldung am Stockwaage-Server und Freigabe „Satellit“ (Stockwaage → Daten teilen)';
const SAT_NEUE_FASSUNG = 'Die Freigabe „Satellit“ hat eine neue Fassung – bitte unter Stockwaage → Daten teilen neu bestätigen';
const SAT_LUECKE = 10;                // Tage ohne Aufnahme bis zum Hinweis
const SAT_STUNDE = 36e5;
const SAT_VERSCHOBEN_M = 500;         // wie der Server: weiter weg vom Anker → Geschichte neu
const satR = r => Math.min(5, Math.max(1, r));   // gemeldeter Radius, der Server begrenzt ebenso

function satStand() { try { return JSON.parse(localStorage.getItem(SAT_SPEICHER)) || {}; } catch { return {}; } }
// Zählt Widerrufe (satVergessen); ein Abruf, der vorher begann, schreibt danach nichts mehr zurück
let satWiderrufe = 0;
function satSchreiben(neu, start) {
  if (start !== satWiderrufe) return false;
  try { localStorage.setItem(SAT_SPEICHER, JSON.stringify(neu)); } catch {}
  return true;
}
// gesperrt (403): gemerktes veraltet bleibt, damit weiter „neue Fassung – bitte neu bestätigen“ steht
const satGesperrt = start => satSchreiben({ frei: false, ...(satStand().veraltet ? { veraltet: true } : {}), ft: Date.now() }, start);

function satAktiv() { return !!swKonto().token && satStand().frei !== false; }
// Hinweis statt Kachel: angemeldet, aber nur einer älteren Fassung zugestimmt → um neue Bestätigung bitten
// Angemeldet, aber die Stufe reicht nicht für den Satellit (Pro; eigener Server und noch unbekannte Stufe: kein Schloss, swStufeFrei)
function satStufeFehlt() { return !!swKonto().token && !swStufeFrei('pro'); }
// Rückgabe ist HTML (Schloss), alle Teile sind feste Texte
function satHinweis() {
  if (satStufeFehlt()) return `${schloss('pro', 'Satellit: Blühfenster, Mahd und Wiesenfaktor an deinen Standplätzen')} Satellit gibt es ab Stufe Pro`;
  return swKonto().token && satStand().veraltet ? SAT_NEUE_FASSUNG : SAT_HINWEIS;
}

// Freigabe „satellit“ aktiv? Gemerkt 1 h; sonst GET /api/app/freigaben (ohne Koordinaten). Fehler → false (nichts senden).
// veraltet (Server meldet: zuletzt einer älteren Fassung zugestimmt) gilt nicht als frei
// Nicht frische Stufe zuerst beim Server auffrischen (stufe.js; Fix-Runde 2) – sonst sperrte eine 7 Tage alte Stufe den Satellit trotz Netz
const satStufeAuffrischen = () => (typeof stufeAuffrischen === 'function' ? stufeAuffrischen() : false);
async function satFrei(start) {
  await satStufeAuffrischen();
  const s = satStand();
  if (typeof s.frei === 'boolean' && Date.now() - (s.ft || 0) < SAT_STUNDE) return s.frei;
  try {
    const f = (await swAbruf('/api/app/freigaben')).freigaben?.find(f => f.stufe === 'satellit');
    const frei = !!f?.aktiv, veraltet = !frei && !!f?.veraltet;
    if (start !== satWiderrufe) return false;   // inzwischen abgemeldet oder widerrufen
    satSchreiben({ ...satStand(), frei, veraltet, ft: Date.now() }, start);
    return frei && satStand().frei !== false;
  } catch { return false; }
}

// Höchstens einmal je Stunde; geänderte Liste → sofort. erzwingen nur nach ausdrücklichem Erlauben (swFreigabe).
async function satMelden(erzwingen = false) {
  if (!swKonto().token) return null;
  await satStufeAuffrischen();
  if (satStufeFehlt()) return null;   // Hauptserver, Stufe bekannt ohne Pro: gar nicht anfragen (der Server sagte nur 402)
  const start = satWiderrufe;
  if (!erzwingen && !(await satFrei(start))) return null;
  if (start !== satWiderrufe) return null;
  const r = satR(flugradius()), jahr = new Date().getFullYear();
  const liste = db.standorte.filter(hatKoord).map(s => satEintrag(s, r, jahr));
  // Signatur ohne wald: ein neuer Waldkarten-Wert allein löst keine Meldung aus (kommt mit der nächsten)
  const sig = JSON.stringify(liste.map(({ wald, ...x }) => x)), alt = satStand();
  if (!erzwingen && alt.sig === sig && Array.isArray(alt.status) && Date.now() - alt.t < SAT_STUNDE) return alt.status;
  try {
    const j = await swAbruf('/api/app/standplaetze', { method: 'POST', body: JSON.stringify({ standplaetze: liste }) });
    const status = Array.isArray(j.standplaetze) ? j.standplaetze : [];
    const warnung = satStandWarnungen(liste, status);
    return satSchreiben({ t: Date.now(), sig, status, frei: true, ft: Date.now(), anker: satAnkerNeu(liste), ...(Object.keys(warnung).length ? { warnung } : {}) }, start) ? status : null;
  } catch (e) {
    if (/Freigabe/.test(e.message)) satGesperrt(start);
    return null;
  }
}

// Ein Standplatz der Meldung; dazu für die Waldtracht (Spec 3.1): Waagen-Stand, Waldanteil, Beobachtung des Jahres, Höhe.
// Nur gültige Werte, sonst lehnt der Server die ganze Liste ab (400). Felder ohne Wert fehlen (wald) bzw. sind null (hoehe).
function satEintrag(s, r, jahr) {
  const e = { id: s.id, lat: s.lat, lon: s.lon, r };
  if (typeof s.waageStand === 'string' && /^[0-9a-f]{8}$/i.test(s.waageStand)) e.stand = s.waageStand;
  const wald = satWald(s);
  if (wald) e.wald = wald;
  const b = typeof wtBeobachtungZusammenfassung === 'function' ? wtBeobachtungZusammenfassung(s.id, jahr) : null;
  if (b) e.beobachtung = b;
  e.hoehe = typeof s.hoehe === 'number' && isFinite(s.hoehe) ? s.hoehe : null;
  return e;
}
// Waldanteil im Flugradius aus dem Zwischenspeicher der Waldkarte (quellen.js waldHolen, Anteile 0–1) → Prozent { anteil, nadel } | null.
// Nur lesen, gleich welchen Alters – kein eigener Abruf
function satWald(s) {
  try {
    const d = JSON.parse(localStorage.getItem(`imkerei-wald-${k3(s.lat, s.lon)}-${flugradius()}`))?.d;
    const p = x => typeof x === 'number' && isFinite(x) ? Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10 : null;
    return d && p(d.anteil) != null ? { anteil: p(d.anteil), nadel: p(d.nadel) } : null;
  } catch { return null; }
}
// Ein Stand darf am Server nur bei einem Standplatz stehen (der jüngere gewinnt). Liefert der Server für einen Standplatz einen anderen
// (oder keinen) Stand als gesendet → { id: Name des anderen Standplatzes mit derselben Waage | '' }. Ohne Feld stand (alter Server) nichts.
function satStandWarnungen(liste, status) {
  const warnung = {};
  for (const e of liste) {
    const x = status.find(y => y.id === e.id);
    if (!e.stand || !x || !('stand' in x) || String(x.stand || '').toUpperCase() === e.stand.toUpperCase()) continue;
    const andere = db.standorte.find(o => o.id !== e.id && String(o.waageStand || '').toUpperCase() === e.stand.toUpperCase());
    warnung[e.id] = andere ? andere.name || 'ohne Namen' : '';
  }
  return warnung;
}
// Warnung zum Waagen-Stand aus der letzten Meldung als Text oder ''
function satStandWarnung(sid) {
  const w = satStand().warnung?.[sid];
  if (w == null) return '';
  return w ? `Diese Waage ist auch bei Standplatz „${w}“ eingetragen – der Server nimmt den jüngeren.`
    : 'Der Server hat die Waage diesem Standplatz nicht zugeordnet – sie gehört nicht zu deinem Konto oder steht bei einem anderen Standplatz.';
}

// ---------- Teure Änderungen (Geschichte neu am Server) nur nach Rückfrage ----------
// Anker je Standplatz wie am Server: Ort und größter Radius seit der letzten neuen Geschichte. Ohne gemerkten Anker: die zuletzt gemeldete Liste.
function satAnker() {
  const s = satStand();
  if (s.anker) return s.anker;
  try { return Object.fromEntries(JSON.parse(s.sig || '[]').map(x => [x.id, [x.lat, x.lon, x.r]])); } catch { return {}; }
}
// Abstand in Metern, gleichabständige Näherung wie am Server
function satAbstandM(lat1, lon1, lat2, lon2) {
  return Math.hypot((lon2 - lon1) * 111320 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180), (lat2 - lat1) * 111320);
}
// Neuer Anker nach einer Meldung: bleibt bei ≤ 500 m und nicht größerem Radius, sonst neu (Server: Geschichte neu)
function satAnkerNeu(liste) {
  const alt = satAnker();
  return Object.fromEntries(liste.map(s => {
    const a = alt[s.id];
    return [s.id, a && s.r <= a[2] && satAbstandM(a[0], a[1], s.lat, s.lon) <= SAT_VERSCHOBEN_M ? a : [s.lat, s.lon, s.r]];
  }));
}
// true = ändern; fragt nur, wenn der Server für gemeldete, nicht wartende Standplätze die Geschichte neu holen würde
function satKostenOk(r, sid, lat, lon) {
  if (!satAktiv()) return true;
  const anker = satAnker(), status = satStand().status || [], rs = satR(r);
  const gemeldet = db.standorte.filter(s => hatKoord(s) && anker[s.id] && status.find(x => x.id === s.id)?.status !== 'wartet');
  const neu = gemeldet.filter(s => {
    const [aLat, aLon, aR] = anker[s.id], [la, lo] = s.id === sid ? [lat, lon] : [s.lat, s.lon];
    return rs > aR || satAbstandM(aLat, aLon, la, lo) > SAT_VERSCHOBEN_M;
  });
  if (!neu.length) return true;
  const wen = neu.length === 1 ? `„${neu[0].name || 'Standplatz'}“` : neu.length === gemeldet.length ? 'alle Standplätze' : neu.map(s => `„${s.name || 'Standplatz'}“`).join(', ');
  return confirm(`Die Satellitenwerte für ${wen} werden gelöscht und neu geholt – das kostet Kontingent und dauert einige Nächte. Deine Bestätigungen (Raps ja/nein) gehen dabei verloren. Trotzdem ändern?`);
}
function satRadiusOk(r) { return satKostenOk(r); }
function satOrtOk(s, lat, lon) { return satKostenOk(flugradius(), s.id, lat, lon); }

// Freigabe-Stand unbekannt → einmal fragen (ohne Koordinaten); bekannt (auch älter) → nicht fragen, damit offline der Zwischenspeicher gilt
async function satPruefen() {
  if (satAktiv() && typeof satStand().frei !== 'boolean') await satFrei(satWiderrufe);
  return satAktiv();
}

async function satHolen(sid, jahr) {
  if (!satAktiv()) return null;
  await satStufeAuffrischen();
  if (satStufeFehlt()) return null;
  const start = satWiderrufe, schluessel = 'imkerei-sat-' + sid + '-' + jahr;
  // Antwort ohne Auswertung nur 1 h merken, damit die ersten Werte nach dem Nachtlauf bald kommen
  try { const alt = JSON.parse(localStorage.getItem(schluessel)); if (alt && !alt.d?.stand && Date.now() - alt.t >= SAT_STUNDE) localStorage.removeItem(schluessel); } catch {}
  try {
    const d = await quelleCache(schluessel, 864e5,
      () => swAbruf(`/api/app/standplatz/${encodeURIComponent(sid)}/satellit?jahr=${jahr}`));
    return d && d.stand ? d : null;
  } catch (e) {
    if (/Freigabe/.test(e.message)) satGesperrt(start);
    return null;
  }
}

// Nur aus dem Zwischenspeicher, gleich welchen Alters
function satLetzt(sid, jahr) {
  try { const d = JSON.parse(localStorage.getItem('imkerei-sat-' + sid + '-' + jahr))?.d; return d && d.stand ? d : null; } catch { return null; }
}

// ---------- Anzeige-Bausteine (Potenzial) ----------
const SAT_FRAGE = { raps: ['Raps blüht hier', 'kein Raps'], sonnenblume: ['Sonnenblumen blühen hier', 'keine Sonnenblumen'], phacelia: ['Phacelia blüht hier', 'keine Phacelia'] };
const satKomma = x => x.toFixed(2).replace('.', ',');
const satJahre = n => `${n} Jahr${n === 1 ? '' : 'e'}`;
function satTag(d) { return d ? `${+d.slice(8, 10)}.${+d.slice(5, 7)}.` : '–'; }
// „24.4.–12.5., Höhepunkt 3.5. ±2“; ohne Ende „ab 24.4., …“
function satFensterText(b) {
  const hp = `Höhepunkt ${satTag(b.hoehepunkt)}${b.plusminus != null ? ' ±' + b.plusminus : ''}`;
  return !b.beginn ? hp : b.ende ? `${satTag(b.beginn)}–${satTag(b.ende)}, ${hp}` : `ab ${satTag(b.beginn)}, ${hp}`;
}
// Mahd-Gruppen außer den Wiesen (Spec 8b), Reihenfolge in der Kachel
const SAT_FUTTER = ['klee', 'kleegras', 'luzerne', 'esparsette', 'feldfutter'];
const satName = g => (typeof NEKTAR !== 'undefined' && NEKTAR.find(x => x[0] === g)?.[1]) || g;
// Faktor da → eingerechnet; nur vorläufig (weniger als 2 Jahre) → angezeigt, nicht eingerechnet. name: Futter-Gruppe (Futterfaktor), sonst Wiesen
function wiesenText(w, name = 'Wiesen') {
  const statt = w.theoretisch ? ` statt ${w.theoretisch}` : '';
  if (w.faktor != null) return `${name}: mittlere Blühdauer ${w.bluehtage_mittel} Tage${statt} (Satellit, ${satJahre(w.jahre)}) → × ${satKomma(w.faktor)}`;
  return `${name}: mittlere Blühdauer ${w.bluehtage_mittel} Tage${statt} (Satellit, vorläufig aus ${satJahre(w.jahre)}) → ${w.vorlaeufig != null ? `× ${satKomma(w.vorlaeufig)}, ` : ''}noch nicht eingerechnet`;
}
// Letzter Punkt der Mahdkurve, dazu erster und mittlerer Schnitt; „teils Radar“, wenn ein Schnitt (mit) aus Sentinel-1 stammt;
// unsicher_ha: erste Schnitte nur aus Radar, noch ohne Nachkontrolle. name: Mahd-Gruppe (sonst die Wiesen zusammen)
function mahdText(m, name) {
  const p = m?.kurve?.at(-1);
  if (!p) return name ? `${name}: noch kein Schnitt erkannt` : 'noch kein Schnitt auf den Wiesen erkannt';
  const dazu = [m.erster && `erster Schnitt ${satTag(m.erster)}`, m.mittel && `Mitte ${satTag(m.mittel)}`, m.s1 && 'teils Radar'].filter(Boolean).join(', ');
  const unsicher = m.unsicher_ha > 0 ? ` – davon ${zahl(m.unsicher_ha, 1)} ha (unsicher)` : '';
  return `${name ? name + ': ' : ''}am ${satTag(p[0])} waren ${Math.round(p[1] * 100)} % ${name ? '' : 'der Wiesen '}geschnitten${dazu ? ` (${dazu})` : ''}${unsicher}`;
}
// Umbruch (Spec 8a): Feld zählt ab dem Tag im Jahr nicht mehr
function umbruchText(u, name = 'Wiese') { return `Umbruch erkannt am ${satTag(u.datum)} (${zahl(u.ha, 1)} ha, zählt nicht mehr als ${name})`; }
// Verworfene Radar-Schnitte; praezisierung_regen (S2-Schnitt gilt, nur das Radar-Datum fiel weg) zählt nicht dazu
function verworfenText(v) {
  const n = (v?.regen || 0) + (v?.blattgruen || 0);
  if (!n) return '';
  return `${n} Radar-Hinweis${n === 1 ? '' : 'e'} verworfen (${[v.regen && 'Regen', v.blattgruen && 'Blattgrün unverändert'].filter(Boolean).join(' / ')})`;
}
function satQuelle(a) {
  const regen = a?.regen ? ` · Regen: Open-Meteo (CC BY 4.0)${a.regen_waage ? ' und deine Waage' : ''}` : '';
  return 'Satellit: Copernicus Sentinel-2' + (/Sentinel-1/.test(a?.quelle || '') ? ' und Sentinel-1' : '') + regen;
}
// Zeilen der Kachel zur Mahd: Wiesen zusammen (mahd.alle), dann jede Futter-Gruppe mit Namen; Umbrüche als eigene Zeilen
function mahdZeilen(mahd) {
  const gruppen = mahd?.gruppen || {}, wiesen = Object.entries(gruppen).filter(([g]) => g.startsWith('wiese')).map(([, m]) => m);
  const vermerk = v => { const t = verworfenText(v); return t ? ` <span class="leise klein-t">· ${t}</span>` : ''; };
  const zeilen = [];
  if (mahd?.alle) {
    const v = { regen: 0, blattgruen: 0 }, umbruch = new Map();
    for (const m of wiesen) {
      v.regen += m.verworfen?.regen || 0; v.blattgruen += m.verworfen?.blattgruen || 0;
      for (const u of m.umbruch || []) umbruch.set(u.datum, (umbruch.get(u.datum) || 0) + (u.ha || 0));
    }
    zeilen.push(`<li>${mahdText(mahd.alle)}${vermerk(v)}</li>`,
      ...[...umbruch].sort((a, b) => a[0].localeCompare(b[0])).map(([datum, ha]) => `<li>${umbruchText({ datum, ha })}</li>`));
  }
  for (const g of SAT_FUTTER) {
    const m = gruppen[g];
    if (!m) continue;
    const name = esc(satName(g));
    zeilen.push(`<li>${mahdText(m, name)}${vermerk(m.verworfen)}</li>`, ...(m.umbruch || []).map(u => `<li>${umbruchText(u, name)}</li>`));
  }
  return zeilen;
}

// Bestätigung „Raps blüht hier“ / „kein Raps“: Server lernt daraus, danach frisch holen und neu rechnen
async function satBestaetigen(sid, gruppe, jahr, stimmt) {
  try {
    await swAbruf(`/api/app/standplatz/${encodeURIComponent(sid)}/satellit/bestaetigen`, { method: 'POST', body: JSON.stringify({ gruppe, jahr, stimmt }) });
  } catch (e) { alert(e.message); return; }
  localStorage.removeItem('imkerei-sat-' + sid + '-' + jahr);
  potenzial(sid, String(jahr));
}

// Ohne Auswertung: kurz, warum (nur „wartet“, „Fehler“ und „noch keine Werte“ – „geschichte“ springt in der Saison kurz)
// eintrag: Status des Standplatzes vom Server; „wartet“ mit grund „probe“ = in der Probezeit nur 1 Standplatz (Spec 3a)
function satOhneText(eintrag) {
  if (eintrag?.status === 'wartet') return eintrag.grund === 'probe' ? 'Satellit: In der Probezeit 1 Standplatz – mit Pro alle' : 'Satellit: wartet – höchstens 3 Standplätze mit Satellit';
  return eintrag?.status === 'fehler' ? 'Satellitenwerte gerade nicht abrufbar' : '';
}
// Kachel „Satellit“ unter der Trachttabelle; ohne Anmeldung/Freigabe und ohne Auswertung leer.
// r: Flugradius der App – weicht der Kreis am Server ab (höchstens 5 km), steht er dabei, damit die Hektar zur Tabelle passen
function satKachel(a, sid, r) {
  if (!a) {
    if (!satAktiv()) return '';
    const st = (satStand().status || []).find(x => x.id === sid);
    return `<p class="leise klein-t">${satOhneText(st) || 'Satellitenwerte werden vorbereitet – erste Werte nach der nächsten Nacht'}.</p>`;
  }
  const rSat = a.r_km ?? (r != null ? satR(r) : null), kreis = rSat != null && r != null && rSat !== r ? ` · im Satellitenkreis ${zahl(rSat)} km` : '';
  const knopf = (g, stimmt, text) => `<button class="klein" onclick="satBestaetigen('${esc(sid)}','${g}',${a.jahr},${stimmt})">${esc(text)}</button>`;
  const knoepfe = (...k) => `<div class="zeile" style="margin-top:4px">${k.join(' ')}</div>`;
  // Knöpfe nur bei vermuteten Feldern (Jahr ohne AMA-Jahrgang); die eigene Aussage lässt sich jederzeit umkehren
  const zeilen = (a.bluete || []).filter(b => b.hoehepunkt).map(b => {
    const frage = b.vermutet && SAT_FRAGE[b.gruppe];
    const vermerk = b.bestaetigt ? 'von dir bestätigt' : b.vermutet ? `vermutet – die AMA-Felder für ${a.jahr} fehlen noch` : '';
    return `<li><b>${esc(satName(b.gruppe))}</b> (${zahl(b.ha, 1)} ha): ${satFensterText(b)}${vermerk ? ` <span class="leise klein-t">· ${vermerk}</span>` : ''}
      ${!frage ? '' : b.bestaetigt ? knoepfe(knopf(b.gruppe, false, 'doch ' + frage[1])) : knoepfe(knopf(b.gruppe, true, frage[0]), knopf(b.gruppe, false, frage[1]))}</li>`;
  });
  for (const g of a.abgelehnt || []) {
    const frage = SAT_FRAGE[g];
    if (frage) zeilen.push(`<li><b>${esc(satName(g))}</b>: <span class="leise klein-t">von dir als ${esc(frage[1])} gemeldet</span>
      ${knoepfe(knopf(g, true, frage[0].replace(/ hier$/, ' doch hier')))}</li>`);
  }
  zeilen.push(...mahdZeilen(a.mahd));
  if (a.obst?.hoehepunkt) zeilen.push(`<li><b>Obstblüte</b> (${zahl(a.obst.ha, 1)} ha): ${satFensterText(a.obst)} <span class="leise klein-t">· Versuch – noch unbestätigt</span></li>`);
  const st = a.stand || {};
  const stand = !st.letzter_tag ? 'noch keine brauchbare Aufnahme' : st.luecke_tage >= SAT_LUECKE ? `keine Aufnahme seit ${satTag(st.letzter_tag)}` : `Stand ${satTag(st.letzter_tag)}`;
  return `<div class="karte" style="margin:12px 0"><h4>Satellit ${a.jahr ?? ''}${kreis}</h4>${zeilen.length ? `<ul class="hinweise">${zeilen.join('')}</ul>` : '<p class="leise klein-t">Noch keine Blüte und kein Schnitt erkannt.</p>'}
    <p class="leise klein-t">${stand} · ${satQuelle(a)}</p></div>`;
}

// ---------- Anzeige-Bausteine (Vegetation & Wetter) ----------
// Kachel „Grün im Flugradius“: NDVI 1.4.–30.9., dieses Jahr grün, Vorjahr grau gestrichelt; ohne Werte leer
function satVegKachel(a, vorjahr) {
  const tag = d => (Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(+d.slice(0, 4), 3, 1)) / 864e5;
  const punkte = x => (x?.vegetation || []).filter(([d, v]) => typeof v === 'number' && isFinite(v) && tag(d) >= 0 && tag(d) <= 182)
    .map(([d, v]) => `${tag(d)},${(100 - Math.max(0, Math.min(1, v)) * 100).toFixed(1)}`);
  const jahre = [[a, '#3d8b40', ''], [vorjahr, '#999', ' stroke-dasharray="4 3"']].map(([x, farbe, strich]) => ({ x, farbe, strich, p: punkte(x) })).filter(j => j.p.length);
  if (!jahre.length) return '';
  const jahrVon = x => x.jahr ?? x.vegetation[0][0].slice(0, 4);
  const linien = jahre.map(j => `<polyline fill="none" stroke="${j.farbe}" stroke-width="2.5"${j.strich} vector-effect="non-scaling-stroke" points="${j.p.join(' ')}"/>`).join('');
  const legende = jahre.map(j => `<span style="color:${j.farbe}">${j.strich ? '- -' : '—'} ${jahrVon(j.x)}</span>`).join(' · ');
  return `<div class="karte" style="margin:12px 0"><h4>Grün im Flugradius</h4>
    <svg class="diagramm" viewBox="0 0 183 100" preserveAspectRatio="none"><line x1="0" x2="183" y1="50" y2="50" stroke="#ccc" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>${linien}</svg>
    <div class="leise klein-t" style="display:flex;justify-content:space-between"><span>1.4.</span><span>1.6.</span><span>1.8.</span><span>30.9.</span></div>
    <p class="leise klein-t">${legende} · NDVI 0–1 (Linie 0,5) · Satellit: Copernicus Sentinel-2</p></div>`;
}
// Zusatz bei Raps-Meilensteinen: Rapsbeginn dieses Jahres aus der zuletzt geholten Auswertung
function rapsHinweis(s, m) {
  if (!/Raps/.test(m?.pflanze || '')) return '';
  const b = (satLetzt(s.id, heute().slice(0, 4))?.bluete || []).find(x => x.gruppe === 'raps' && x.beginn);
  return b ? ` · laut Satellit seit ${satTag(b.beginn)}` : '';
}

// widerruf: Zustand „frei: false“ merken (nichts mehr senden); sonst (Abmelden, Konto gelöscht) alles weg, Zustand unbekannt.
// Die Waldtracht-Antworten (imkerei-wt-*) kommen vom selben Server und gehen mit
function satVergessen(widerruf = true) {
  satWiderrufe++;
  const weg = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === SAT_SPEICHER || k?.startsWith('imkerei-sat-') || k?.startsWith('imkerei-wt-')) weg.push(k); }
  for (const k of weg) localStorage.removeItem(k);
  if (widerruf) try { localStorage.setItem(SAT_SPEICHER, JSON.stringify({ frei: false, ft: Date.now() })); } catch {}
}
