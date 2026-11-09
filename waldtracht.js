// Waldtracht über den Stockwaage-Server: Kachel im Potenzial (Wetter-Ampel, erkannte Phasen), Antworten, Stockkarte, Aufgabe, Ernte.
// Nur mit Anmeldung, Freigabe „Satellit“ und Stufe Pro (wie der Satellit). Wird nach satellit.js und stufe.js geladen und nutzt
// swAbruf, quelleCache, satAktiv, satStufeFehlt, satTag, schloss sowie die Helfer aus app.js erst zur Laufzeit.

const WT_STUNDE = 36e5;
const WT_NADEL_MIN = 20;              // Nadelwald im Flugradius in % (Server: nadelwald_min)
const WT_HINWEIS = 'Waldtracht-Erkennung gibt es mit Anmeldung am Stockwaage-Server und Freigabe „Satellit“ (Stockwaage → Daten teilen)';
const WT_SCHLOSS = 'Waldtracht: Erkennung aus der Stockwaage, Wetter-Ampel und Bestätigen';
const WT_ERFAHRUNG = 'Erfahrungsregel der Waldtrachtbeobachter, nicht geprüft';
const WT_QUELLE = 'Wetter: GeoSphere Austria (CC BY 4.0)';
const WT_ERTRAG_FREIGABE = 'Freigabe Ertragsdaten nötig – die Ernte ist am Handy gespeichert, an den Server ging keine Menge (Stockwaage → Daten teilen)';
const WT_ANTWORT = { ja: 'Ja, Waldtracht', nein: 'Nein', andere: 'Andere Tracht', melezitose_ja: 'Ja, Melezitose', melezitose_nein: 'Nein' };

const wtSchluessel = (sid, jahr) => 'imkerei-wt-' + sid + '-' + jahr;
// Letzter Fehler je Standplatz und Jahr ({ text, stufe }) – stufe aus einer 402-Antwort → Schloss statt Text (wie swFehlerVon)
let wtFehler = {};

// Antwort von GET …/waldtracht oder null. Zwischenspeicher 1 h; scheitert der Abruf (kein Netz), gilt die letzte Antwort gleich welchen Alters.
async function wtHolen(sid, jahr) {
  if (!satAktiv()) return null;
  await satStufeAuffrischen();
  if (satStufeFehlt()) return null;                          // Stufe bekannt ohne Pro: gar nicht erst fragen
  const start = satWiderrufe, k = wtSchluessel(sid, jahr);
  try {
    const d = await quelleCache(k, WT_STUNDE, () => swAbruf(`/api/app/standplatz/${encodeURIComponent(sid)}/waldtracht?jahr=${jahr}`));
    delete wtFehler[k];
    return d || null;
  } catch (e) {
    wtFehler[k] = { text: e.message, stufe: e.stufe || null };
    if (/Freigabe/.test(e.message)) satGesperrt(start);
    return null;
  }
}
// Nur aus dem Zwischenspeicher, gleich welchen Alters
function wtLetzt(sid, jahr) {
  try { return JSON.parse(localStorage.getItem(wtSchluessel(sid, jahr)))?.d || null; } catch { return null; }
}
// Phase aus dem Zwischenspeicher (alle Jahre des Standplatzes): { k, eintrag, p } oder null
function wtPhaseSuchen(sid, id) {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith('imkerei-wt-' + sid + '-')) continue;
    try { const eintrag = JSON.parse(localStorage.getItem(k)), p = eintrag?.d?.phasen?.find(x => x.id === id); if (p) return { k, eintrag, p }; } catch {}
  }
  return null;
}
// Neue Werte einer Phase in den Zwischenspeicher zurückschreiben (Alter bleibt) → die zusammengeführte Phase
function wtPhaseMerken(sid, id, neu) {
  const f = wtPhaseSuchen(sid, id);
  if (!f) return { id, ...neu };
  Object.assign(f.p, neu);
  try { localStorage.setItem(f.k, JSON.stringify(f.eintrag)); } catch {}
  return f.p;
}
// Potenzial-Kachel neu zeichnen, wenn sie gerade diesen Standplatz zeigt (ertrag.js); sonst false
function wtNeuZeigen(sid) {
  if (typeof potNachladen !== 'function' || typeof potLetzt === 'undefined' || potLetzt?.sid !== sid) return false;
  return potNachladen(potLauf, 'wt', wtLetzt(sid, potLetzt.jahr));
}
const wtStandort = sid => db.standorte.find(o => o.id === sid);

// ---------- Texte ----------
// „24.6.–12.7.“, im selben Monat „12.–20.5.“, ohne Ende „seit 24.6.“
function wtZeitraum(von, bis) {
  if (!bis) return 'seit ' + satTag(von);
  return von.slice(0, 7) === bis.slice(0, 7) ? `${+von.slice(8, 10)}.–${satTag(bis)}` : `${satTag(von)}–${satTag(bis)}`;
}
// Gruppe aus dem Grund des Servers: „Raps bis 10.6.“ / „Sonnenblume blüht“ → „Raps“ / „Sonnenblume“
const wtGruppe = grund => (grund || '').replace(/^teilweise\s+/, '').replace(/\s+(bis\s.*|blüht.*)$/, '').trim() || 'Blüte';
const wtWald = p => p.zuordnung === 'wald' || p.zuordnung === 'wald_ungeprueft';
function wtPhaseText(p) {
  const kg = zahl(p.kg_je_volk, 1), masse = p.massentracht ? ' (Massentracht)' : '';
  if (wtWald(p)) return p.bis ? `Waldtracht ${wtZeitraum(p.von, p.bis)}, ${kg} kg je Volk${masse}` : `Waldtracht seit ${satTag(p.von)}, bisher ${kg} kg je Volk${masse}`;
  const zunahme = `Zunahme ${wtZeitraum(p.von, p.bis)}`;
  if (p.zuordnung === 'bluete') return `${zunahme}: ${wtGruppe(p.zuordnung_grund)} blüht – keine Waldtracht`;
  if (p.zuordnung === 'wiese') return `${zunahme}: ${p.zuordnung_grund || 'Wiesen ungemäht'} – keine Waldtracht`;
  return `${zunahme}: Zu wenig Nadelwald im Flugradius für Waldtracht`;
}

// ---------- Anzeige ----------
// Ampel: grün nur bei günstigem Wetter-Rahmen UND Läusen (wenige/viele) im Jahr, sonst bei günstig gelb mit Läuse-Text (Spec 5)
function wtAmpelHtml(a) {
  if (!a) return '';
  const laeuse = a.laeuse === 'wenige' || a.laeuse === 'viele';
  const farbe = a.stufe === 'guenstig' ? (laeuse ? 'g' : 'o') : a.stufe === 'offen' ? 'o' : a.stufe === 'unguenstig' ? 'r' : '';
  const text = a.stufe === 'guenstig' ? (laeuse ? 'Wetter-Rahmen günstig' : 'Wetter-Rahmen günstig – Läuse am Baum prüfen') : a.text || 'Noch zu wenige Monate für die Ampel';
  const kreis = (f, gross) => `<span class="ampel-punkt${gross ? ' gross' : ''}${f ? ' ampel-' + f : ''}"></span>`;
  // Punkt: ja grün, nein rot, vorläufig (Starkregen vor dem 15.7.) gelb, noch offen grau
  const punkte = (a.punkte || []).map(p => `<li>${kreis(p.wert == null ? '' : p.vorlaeufig ? 'o' : p.wert ? 'g' : 'r')} ${esc(p.name)} ${p.wert === true ? '✓' : p.wert === false ? '✗' : 'offen'}${p.vorlaeufig && p.wert != null ? ' (bisher)' : ''}</li>`);
  return `<p style="margin:4px 0">${kreis(farbe, true)} <b>${esc(text)}</b></p>${punkte.length ? `<ul class="ampel-liste klein-t">${punkte.join('')}</ul>` : ''}
    <p class="leise klein-t">${esc(a.hinweis || WT_ERFAHRUNG)}</p>`;
}
// Eine Phase: Wald (auch ungeprüft) mit Grund, Antwort-Knöpfen (änderbar), Ernte-Knopf nach „Ja“ und Melezitose-Zeile;
// Blüte, Wiese, kein Wald nur klein ohne Knöpfe
function wtPhaseHtml(p, sid) {
  if (!wtWald(p)) return `<li class="leise klein-t">${esc(wtPhaseText(p))}</li>`;
  const knopf = (antwort, aktiv) => `<button class="klein${aktiv ? ' haupt' : ''}" onclick="wtAntwort('${esc(sid)}',${+p.id},'${antwort}')">${WT_ANTWORT[antwort]}</button>`;
  const ernte = sorte => `<button class="klein" onclick="wtErnte('${esc(sid)}',${+p.id},'${sorte}')">In Ernte übernehmen</button>`;
  const grund = p.zuordnung_grund || (p.zuordnung === 'wald_ungeprueft' ? 'Wald (ungeprüft – keine Satellitenwerte)' : '');
  const deine = (a, t) => a ? `<div class="leise klein-t">Deine Antwort: ${WT_ANTWORT[a] || esc(a)}${t ? ' – ' + esc(t) : ''}</div>` : '';
  const mel = !p.melezitose_tag ? '' : `<div style="margin-top:6px">Zementhonig-Verdacht seit ${satTag(p.melezitose_tag)}${p.melezitose_kg != null ? ` (${zahl(p.melezitose_kg, 1)} kg)` : ''} – jetzt schleudern prüfen
      ${deine(p.melezitose_antwort)}
      <div class="zeile" style="margin-top:4px">${knopf('melezitose_ja', p.melezitose_antwort === 'melezitose_ja')} ${knopf('melezitose_nein', p.melezitose_antwort === 'melezitose_nein')}${p.melezitose_antwort === 'melezitose_ja' ? ' ' + ernte('Melezitosehonig') : ''}</div></div>`;
  return `<li class="${p.antwort === 'ja' ? 'gruen' : ''}"><b>${esc(wtPhaseText(p))}</b>${grund ? ` <span class="leise klein-t">· ${esc(grund)}</span>` : ''}
    ${deine(p.antwort, p.antwort === 'andere' ? p.antwort_text : '')}${p.ernte_kg != null ? `<div class="leise klein-t">Ernte gemeldet: ${zahl(p.ernte_kg, 1)} kg</div>` : ''}
    <div class="zeile" style="margin-top:4px">${knopf('ja', p.antwort === 'ja')} ${knopf('nein', p.antwort === 'nein')} ${knopf('andere', p.antwort === 'andere')}${p.antwort === 'ja' ? ' ' + ernte('Waldhonig') : ''}</div>${mel}</li>`;
}
// Kachel „Waldtracht“ unter der Satellit-Kachel. wald: Waldanteil der App (EEA, Anteile 0–1) – nur, wenn der Server den Nadelwald nicht kennt.
// a: Antwort des Servers (Standard: letzter Stand aus dem Zwischenspeicher)
function wtKachel(s, jahr, wald, a = wtLetzt(s.id, jahr)) {
  if (!satAktiv()) return `<p class="leise klein-t">${WT_HINWEIS}.</p>`;
  if (satStufeFehlt()) return `<p class="leise klein-t">${schloss('pro', WT_SCHLOSS)} Waldtracht gibt es ab Stufe Pro.</p>`;
  // Waage bei zwei Standplätzen oder vom Server nicht zugeordnet (letzte Standplatz-Meldung, satellit.js)
  const w = typeof satStandWarnung === 'function' ? satStandWarnung(s.id) : '', warnung = w ? `<ul class="hinweise"><li>${esc(w)}</li></ul>` : '';
  const f = wtFehler[wtSchluessel(s.id, jahr)];
  if (!a) {
    if (f?.stufe === 'lizenz') return `${warnung}<ul class="hinweise"><li>${esc(f.text)}</li></ul>`;
    if (f?.stufe) return `${warnung}<p class="leise klein-t">${schloss(f.stufe, WT_SCHLOSS)} ${esc(f.text)}</p>`;
    return `${warnung}<p class="leise klein-t">Waldtracht: ${f ? esc(f.text) : 'Werte werden geladen …'}</p>`;
  }
  const min = a.nadelwald_min ?? WT_NADEL_MIN;
  const nadel = a.nadelwald ?? (wald?.anteil != null && wald?.nadel != null ? wald.anteil * wald.nadel * 100 : null);
  if (nadel != null && nadel < min) return `${warnung}<p class="leise klein-t">Zu wenig Nadelwald im Flugradius für Waldtracht (${zahl(nadel, 0)} %, ab ${zahl(min, 0)} %).</p>`;
  const phasen = a.phasen || [];
  const inhalt = phasen.length ? `<ul class="hinweise">${phasen.map(p => wtPhaseHtml(p, s.id)).join('')}</ul>`
    : !a.stand ? '<p class="leise klein-t">Erkennung braucht eine Stockwaage am Standplatz.</p>'
    : '<p class="leise klein-t">Noch keine Tracht erkannt.</p>';
  const fuss = [nadel != null ? `Nadelwald im Flugradius ${zahl(nadel, 0)} %` : '', a.wetter_stand ? `Wetter bis ${satTag(a.wetter_stand)}` : '', esc(a.quelle || WT_QUELLE)].filter(Boolean);
  // Grün braucht Läuse im Jahr: die eigene Beobachtung am Handy zählt sofort, sonst die, die der Server schon kennt
  const laeuse = wtBeobachtungZusammenfassung(s.id, a.jahr ?? jahr)?.laeuse;
  const ampel = a.ampel && laeuse ? { ...a.ampel, laeuse } : a.ampel;
  return `${warnung}<div class="karte" style="margin:12px 0"><h4>Waldtracht ${esc(a.jahr ?? jahr)}</h4>${wtAmpelHtml(ampel)}${inhalt}
    <p class="leise klein-t">${fuss.join(' · ')}</p></div>`;
}

// ---------- Antworten ----------
// Sendet sofort und schreibt den Zwischenspeicher zurück. „ja“: Stockkarte jedes Volks am Stand und Aufgabe „Waldhonig prüfen“.
async function wtAntwort(sid, id, antwort, text) {
  if (antwort === 'andere' && text == null) {
    text = prompt('Welche Tracht war es? (z. B. Linde, Edelkastanie)', '');
    if (text == null) return;                                // abgebrochen: nichts senden
  }
  text = typeof text === 'string' ? text.trim() : '';
  let j;
  try {
    j = await swAbruf(`/api/app/standplatz/${encodeURIComponent(sid)}/waldtracht/antwort`,
      { method: 'POST', body: JSON.stringify({ phase_id: id, antwort, ...(text ? { text } : {}) }) });
  } catch (e) { alert(e.message); return; }
  const p = wtPhaseMerken(sid, id, j.phase || (antwort.startsWith('melezitose_') ? { melezitose_antwort: antwort } : { antwort, antwort_text: text || null }));
  const s = wtStandort(sid);
  if (antwort === 'ja' && s && p.von) { wtStockkarte(s, p); wtAufgabe(s, p); speichern(); }
  wtNeuZeigen(sid);
}
// Je Volk mit Waage an diesem Stand ein Eintrag der Waage (zählt nicht als Durchsicht), gekennzeichnet mit wtPhase = Phasen-id;
// schon da (auch wenn der Server Beginn oder Ende verschoben hat) → Datum und Notiz aktualisieren statt neu anlegen
function wtStockkarte(s, p) {
  if (!s.waageStand) return 0;
  const notiz = 'Waldtracht ab ' + fmtD(p.von) + (p.bis ? ' bis ' + fmtD(p.bis) : '');
  let neu = 0;
  for (const v of db.voelker.filter(v => v.waage?.stand === s.waageStand && v.status !== 'aufgelöst')) {
    const da = db.durchsichten.find(d => d.volkId === v.id && d.quelle === 'waage' && d.wtPhase === p.id);
    if (da) { da.datum = p.von; da.notiz = notiz; continue; }
    db.durchsichten.push({ id: uid(), volkId: v.id, datum: p.von, notiz, quelle: 'waage', wtPhase: p.id });
    neu++;
  }
  return neu;
}
// Einmal je Standplatz und Phasen-id (Feld wtPhase „<sid>:<id>“ in der Aufgabe), Muster swErnteAufgabe
function wtAufgabe(s, p) {
  const kennung = s.id + ':' + p.id;
  if (db.aufgaben.some(a => a.wtPhase === kennung)) return;
  db.aufgaben.push({ id: uid(), wtPhase: kennung, titel: `Waldhonig prüfen – ${s.name || 'Standplatz'}`, faellig: heute(), standortId: s.id, volkId: '',
    notiz: `Die Waagen zeigen Waldtracht ${wtZeitraum(p.von, p.bis)} (${p.bis ? '' : 'bisher '}${zahl(p.kg_je_volk, 1)} kg je Volk). Honigräume ansehen, Reife prüfen.` });
}

// ---------- Ernte ----------
// Ernte-Formular mit Vorschlag (kg je Volk × Völker am Standplatz, änderbar); nach dem Speichern geht die Menge an den Server
function wtErnte(sid, id, sorte) {
  const p = wtPhaseSuchen(sid, id)?.p;
  if (!p) { alert('Die Waldtracht-Werte fehlen am Handy – bitte Potenzial neu laden.'); return; }
  // Vorschlag kg je Volk × Völker am Standplatz; ohne eingetragene Völker nur kg je Volk
  const voelker = db.voelker.filter(v => v.standortId === sid && v.status !== 'aufgelöst').length;
  const kg = Math.round((p.kg_je_volk || 0) * (voelker || 1) * 10) / 10, jeVolk = `${zahl(p.kg_je_volk, 1)} kg je Volk`;
  const rechnung = voelker ? `${jeVolk} × ${voelker} ${voelker === 1 ? 'Volk' : 'Völker'}` : 'keine Völker am Standplatz eingetragen';
  bearbeiten('ernten', null, { produkt: 'Honig', sorte, standortId: sid, kg, datum: heute(),
    notiz: `${sorte} – Waldtracht ${wtZeitraum(p.von, p.bis)} laut Waage (${rechnung})` },
  e => wtErnteMelden(sid, id, e.kg));
}
async function wtErnteMelden(sid, id, kg) {
  if (!wtNeuZeigen(sid)) render();
  if (typeof kg !== 'number' || !isFinite(kg) || kg < 0) return;
  try {
    const j = await swAbruf(`/api/app/standplatz/${encodeURIComponent(sid)}/waldtracht/ernte`, { method: 'POST', body: JSON.stringify({ phase_id: id, kg }) });
    wtPhaseMerken(sid, id, { ernte_kg: j.ernte_kg ?? kg });
    wtNeuZeigen(sid);
  } catch (e) { alert(e.fehler === 'freigabe' || e.status === 403 ? WT_ERTRAG_FREIGABE : e.message); }   // 403 ohne Freigabe „Ertragsdaten“ – am Feld erkannt
}

// ---------- Beobachtungen am Baum (Spec 6.3) ----------
// db.waldbeobachtungen: { id, standortId, datum, laeuse, baum, ameisen, tropfen, kolonien, notiz } – bleiben am Handy,
// nur die Zusammenfassung des Jahres geht mit der Standplatz-Meldung an den Server (satEintrag)
const WT_LAEUSE = [['', '– nicht geschaut'], ['keine', 'keine'], ['wenige', 'wenige'], ['viele', 'viele']];
const WT_BAUM = [['', 'weiß nicht'], ['fichte', 'Fichte'], ['tanne', 'Tanne']];
// Drei Stufen, damit „nicht geschaut“ (null) eine frühere Angabe nicht überschreibt; alte Einträge mit true/false bleiben gültig
const WT_JANEIN = [['', '– nicht geschaut'], ['ja', 'ja'], ['nein', 'nein']];
const wtJaNein = w => w === 'ja' || w === true ? true : w === 'nein' || w === false ? false : null;
const WT_FELDER = { laeuse: ['keine', 'wenige', 'viele'], baum: ['fichte', 'tanne'], ameisen: 'bool', tropfen: 'bool', kolonien: 'bool' };

// Nadelwald im Flugradius in % aus der Waldkarte am Handy (satWald, nur Zwischenspeicher) oder null (unbekannt)
function wtNadel(s) {
  const w = hatKoord(s) ? satWald(s) : null;
  return w && w.anteil != null && w.nadel != null ? w.anteil * w.nadel / 100 : null;
}
// Knopf in der Standplatz-Liste – dort, wo die Waldtracht-Kachel kommt (angemeldet, Freigabe, Pro) und der Nadelwald nicht bekannt zu klein ist
function wtBeobachtungKnopf(s) {
  if (!hatKoord(s) || !satAktiv() || satStufeFehlt()) return '';
  const nadel = wtNadel(s);
  if (nadel != null && nadel < WT_NADEL_MIN) return '';
  return `<button class="klein" title="Läuse, Ameisen, Honigtau am Baum eintragen" onclick="wtBeobachtung('${esc(s.id)}')">🌲 Beobachtung</button>`;
}
function wtBeobachtung(sid) {
  const s = wtStandort(sid);
  if (!s) return;
  formular(`Beobachtung am Baum – ${s.name || 'Standplatz'}`, [
    { k: 'laeuse', label: 'Läuse gefunden', typ: 'select', opts: WT_LAEUSE },
    { k: 'baum', label: 'Baum', typ: 'select', opts: WT_BAUM },
    { k: 'ameisen', label: 'Ameisenstraßen', typ: 'select', opts: WT_JANEIN },
    { k: 'tropfen', label: 'Honigtautropfen / Glanz auf den Nadeln', typ: 'select', opts: WT_JANEIN },
    { k: 'kolonien', label: 'Schwarze Kolonien am Stamm (Zementhonig-Verdacht)', typ: 'select', opts: WT_JANEIN },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }], {}, w => wtBeobachtungSpeichern(sid, w));
}
// Speichert mit Datum heute, meldet gleich an den Server (Signatur ändert sich) und verwirft die Waldtracht-Antwort des Jahres,
// damit die Ampel beim nächsten Laden die Läuse kennt (vor und nach der Meldung, falls inzwischen jemand lädt)
function wtBeobachtungSpeichern(sid, w) {
  const b = { id: uid(), standortId: sid, datum: heute(), laeuse: WT_FELDER.laeuse.includes(w.laeuse) ? w.laeuse : null,
    baum: WT_FELDER.baum.includes(w.baum) ? w.baum : null, ameisen: wtJaNein(w.ameisen), tropfen: wtJaNein(w.tropfen), kolonien: wtJaNein(w.kolonien), notiz: w.notiz || '' };
  (db.waldbeobachtungen ??= []).push(b);
  speichern();
  const weg = () => { try { localStorage.removeItem(wtSchluessel(sid, b.datum.slice(0, 4))); } catch {} };
  weg();
  if (typeof satMelden === 'function') satMelden().catch(() => null).then(weg);
  render();
  return b;
}
// Je Feld der letzte gültige Wert ≠ null im Jahr (nach Datum, bei gleichem Datum der später eingetragene); keine Beobachtung → null
function wtBeobachtungZusammenfassung(sid, jahr) {
  const j = String(jahr);
  const liste = (db.waldbeobachtungen || []).filter(b => b.standortId === sid && typeof b.datum === 'string' && b.datum.slice(0, 4) === j)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (!liste.length) return null;
  const z = {};
  for (const [k, erlaubt] of Object.entries(WT_FELDER))
    z[k] = liste.reduce((w, b) => (erlaubt === 'bool' ? typeof b[k] === 'boolean' : erlaubt.includes(b[k])) ? b[k] : w, null);
  z.jahr = +j;
  return z;
}

// ---------- Erinnerung „Zweige auf Läuse prüfen“ ----------
// Je Standplatz mit Waage und Nadelwald ≥ 20 % (Waldkarte am Handy) am 25.4. und am 10.12.; angelegt ab 14 Tage vorher (bis 30 Tage danach,
// falls die App so lange zu war), einmal je Jahr und Termin – Merker db.einstellungen.wtErinnert[sid] = ['2026-04-25', …], auch nach Löschen der Aufgabe.
// Abschaltbar unter ⚙ Anpassen (einstellungen.wtErinnerung). Rückgabe: Zahl neuer Aufgaben
const WT_ERINNERUNG = ['04-25', '12-10'];
const wtTagPlus = (d, n) => new Date(Date.parse(d + 'T00:00Z') + n * 864e5).toISOString().slice(0, 10);
function wtErinnerungen() {
  if (db.einstellungen.wtErinnerung === false) return 0;
  const tag = heute(), jahr = +tag.slice(0, 4);
  // Termine dieses Jahres und der 10.12. des Vorjahres (Nachhol-Fenster reicht bis 9.1.); Merker je Terminjahr
  const termine = [`${jahr - 1}-${WT_ERINNERUNG[1]}`, ...WT_ERINNERUNG.map(mt => `${jahr}-${mt}`)];
  let neu = 0;
  for (const s of db.standorte) {
    if (!s.waageStand) continue;
    const nadel = wtNadel(s);
    if (nadel == null || nadel < WT_NADEL_MIN) continue;
    for (const termin of termine) {
      if (tag < wtTagPlus(termin, -14) || tag > wtTagPlus(termin, 30)) continue;
      const merker = ((db.einstellungen.wtErinnert ??= {})[s.id] ??= []);
      if (merker.includes(termin)) continue;
      merker.push(termin);
      db.aufgaben.push({ id: uid(), titel: `Zweige auf Läuse prüfen – ${s.name || 'Standplatz'}`, faellig: termin, standortId: s.id, volkId: '', wtErinnerung: termin,
        notiz: 'Ein paar Fichten- und Tannenzweige am Waldrand abklopfen (z. B. über ein helles Tuch): Läuse? Ameisenstraßen? Honigtau-Glanz? Danach unter Standplätze → 🌲 Beobachtung eintragen.' });
      neu++;
    }
  }
  if (neu) speichern();
  return neu;
}
