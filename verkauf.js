// Honig: Abfüllung (Honig + leere Gläser → volle Gläser) und Verkauf (volle Gläser → Einnahme).
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

const lagerArt = id => db.lager.find(l => l.id === id);
const istHonig = l => l.kategorie === 'Honig';
const istGlasware = l => istHonig(l) && einheitNorm(l.einheit) === 'stk';
const istLoseware = l => istHonig(l) && ['kg', 'g'].includes(einheitNorm(l.einheit));
function lagerBewegen(l, menge, grund, datum, extra) {
  l.menge = +((l.menge || 0) + menge).toFixed(3);
  db.bewegungen.push({ id: uid(), lagerId: l.id, datum, menge, grund, ...extra });
}
function bewegungenZurueck(feld, id) {
  for (const b of db.bewegungen.filter(b => b[feld] === id)) { const l = lagerArt(b.lagerId); if (l) l.menge = +((l.menge || 0) - b.menge).toFixed(3); }
  db.bewegungen = db.bewegungen.filter(b => b[feld] !== id);
}
// Abzüge je Artikel zusammenzählen und mit dem Bestand vergleichen
function fehlmengen(abzug) {
  const summe = new Map();
  for (const [l, m] of abzug) summe.set(l, (summe.get(l) || 0) + m);
  return [...summe].filter(([l, m]) => m > (l.menge || 0) + 1e-9).map(([l, m]) => `${l.name}: ${zahl(m, 2)} ${l.einheit} gebraucht, ${zahl(l.menge, 2)} vorhanden`);
}
function mindestWarnung(artikel) {
  const knapp = [...new Set(artikel)].filter(l => l.mindest != null && l.menge <= l.mindest);
  if (knapp.length) alert('Mindestbestand erreicht:\n' + knapp.map(l => `${l.name}: noch ${zahl(l.menge, 2)} ${l.einheit} (Mindest ${zahl(l.mindest, 2)})`).join('\n'));
}
const auswahl = (liste, wert, leer) => (leer ? `<option value="">${esc(leer)}</option>` : '') +
  liste.map(l => `<option value="${l.id}" ${l.id === wert ? 'selected' : ''}>${esc(l.name)} (${zahl(l.menge, 2)} ${esc(l.einheit)})</option>`).join('');

// ---------- Ernte ins Lager ----------
// Lagerartikel je Produkt und Sorte; eine einmal gewählte Zuordnung bleibt auch nach Umbenennen erhalten
function ernteArtikel(e) {
  const name = e.produkt === 'Honig' ? `${e.sorte || 'Honig'} lose` : e.produkt === 'Wachs' ? 'Bienenwachs' : e.produkt;
  const kategorie = e.produkt === 'Honig' ? 'Honig' : e.produkt === 'Wachs' ? 'Wachs' : 'Sonstiges', zuord = db.einstellungen.ernteLager ??= {}, key = reNorm(name);
  let l = lagerArt(zuord[key]);
  if (!l || !['kg', 'g'].includes(einheitNorm(l.einheit))) l = db.lager.find(x => reNorm(x.name) === key && ['kg', 'g'].includes(einheitNorm(x.einheit)));
  if (!l) db.lager.push(l = { id: uid(), name, kategorie, menge: 0, einheit: 'kg' });
  zuord[key] = l.id;
  return l;
}
// Beim Bearbeiten wird die alte Buchung zurückgenommen und neu gebucht
function ernteLagern(e) {
  bewegungenZurueck('ernteId', e.id);
  if (!e.insLager || !(e.kg > 0)) return;
  const l = ernteArtikel(e);
  lagerBewegen(l, umrechnen(e.kg, 'kg', l.einheit) ?? e.kg, 'Ernte' + (e.los ? ' · Los ' + e.los : ''), e.datum, { ernteId: e.id });
}

// ---------- Übersicht ----------
function zeigeVerkauf() {
  const jahr = heute().slice(0, 4), honig = db.lager.filter(istHonig), vs = db.verkaeufe.filter(v => v.datum.startsWith(jahr));
  const glaeser = db.lager.filter(istGlasware).reduce((s, l) => s + (l.menge || 0), 0);
  main().innerHTML = kopf('Verkauf', `<button onclick="abfuellen()">🫙 Abfüllen</button><button class="haupt" onclick="verkaufen()" ${honig.length ? '' : 'disabled'}>💶 Verkauf buchen</button>`) +
    `<div class="raster">
      <div class="karte kachel"><b>${zahl(glaeser, 0)}</b>volle Gläser auf Lager</div>
      <div class="karte kachel"><b>${zahl(vs.reduce((s, v) => s + v.pos.reduce((a, p) => a + p.anzahl, 0), 0), 0)}</b>verkauft ${jahr}</div>
      <div class="karte kachel"><b>${euro(vs.reduce((s, v) => s + v.betrag, 0))}</b>Verkaufserlöse ${jahr}</div></div>
    <h3>Honig im Lager</h3>` +
    (honig.length ? tabelle(['Sorte', 'Bestand', 'Mindest', 'Verkaufspreis', 'Haltbar bis', ''], honig.map(l => [
      `<b>${esc(l.name)}</b>${l.los ? `<div class="leise klein-t">Los ${esc(l.los)}</div>` : ''}`,
      marke(`${zahl(l.menge, 2)} ${l.einheit || ''}`, l.mindest != null && l.menge <= l.mindest ? 'rot' : 'gruen'),
      l.mindest != null ? zahl(l.mindest, 2) : '–', l.vpreis != null ? euro(l.vpreis) : '–', fmtD(l.mhd),
      `<div class="zeile"><button class="klein" onclick="verkaufen('${l.id}')">Verkaufen</button><button class="klein" onclick="bearbeiten('lager','${l.id}')">✎</button></div>`]))
      : '<p class="leer">Noch kein Honig im Lager. Über „Abfüllen“ werden leere Gläser zu vollen Gläsern.</p>') +
    '<p class="leise klein-t">Mindestbestand und Verkaufspreis je Sorte über ✎ einstellen. Unter dem Mindestbestand erscheint ein Hinweis in der Übersicht.</p>' +
    '<h3>Verkäufe</h3>' + tabelle(['Datum', 'Kunde', 'Ware', 'Betrag', ''], [...db.verkaeufe].sort(nachDatum).map(v => [fmtD(v.datum), esc(v.kunde) || '–',
      esc(v.pos.map(p => `${zahl(p.anzahl, 2)}× ${p.name} à ${euro(p.preis)}`).join(', ')), `<b>${euro(v.betrag)}</b>`,
      `<button class="klein gefahr" onclick="verkaufLoeschen('${v.id}')">Löschen</button>`])) +
    '<h3>Abfüllungen</h3>' + tabelle(['Datum', 'Sorte', 'Gläser', 'Honig', 'Los', 'Haltbar bis', ''], [...db.abfuellungen].sort(nachDatum).map(a => [fmtD(a.datum), esc(a.name),
      zahl(a.anzahl, 0) + (a.glasG ? ` × ${zahl(a.glasG, 0)} g` : ''), a.honigKg != null ? zahl(a.honigKg, 2) + ' kg' : '–', esc(a.los) || '–', fmtD(a.mhd),
      `<button class="klein gefahr" onclick="abfuellungLoeschen('${a.id}')">Löschen</button>`]));
}

// ---------- Verkauf ----------
let vkKopf = {}, vkPos = [];
function verkaufen(id) {
  const honig = db.lager.filter(istHonig), l = (id && lagerArt(id)) || honig[0];
  if (!l) return alert('Es ist noch kein Honig im Lager.');
  vkKopf = { datum: heute(), kunde: '' };
  vkPos = [{ lagerId: l.id, anzahl: 1, preis: l.vpreis ?? null }];
  verkaufZeigen(); $('#dlg').showModal();
}
const vkSumme = () => vkPos.reduce((s, p) => s + (p.anzahl || 0) * (p.preis || 0), 0);
function vkWare(i, id) { vkPos[i].lagerId = id; vkPos[i].preis = lagerArt(id)?.vpreis ?? null; verkaufZeigen(); }
function vkPlus() {
  const l = db.lager.filter(istHonig).find(l => !vkPos.some(p => p.lagerId === l.id)) || db.lager.find(istHonig);
  vkPos.push({ lagerId: l.id, anzahl: 1, preis: l.vpreis ?? null }); verkaufZeigen();
}
function verkaufZeigen() {
  const honig = db.lager.filter(istHonig), dlg = $('#dlg');
  dlg.innerHTML = `<form><h2>Verkauf buchen</h2><div class="felder">
      <label>Datum *<input type="date" required value="${vkKopf.datum}" onchange="vkKopf.datum=this.value"></label>
      <label>Kunde<input value="${esc(vkKopf.kunde)}" oninput="vkKopf.kunde=this.value"></label></div>
    ${vkPos.map((p, i) => `<div class="vk-zeile">
      <label class="vk-ware">Sorte<select onchange="vkWare(${i},this.value)">${auswahl(honig, p.lagerId)}</select></label>
      <label>Anzahl (${esc(lagerArt(p.lagerId)?.einheit)})<input type="number" min="0" step="any" required value="${p.anzahl ?? ''}" oninput="vkPos[${i}].anzahl=reZahl(this.value);$('#vk-summe').textContent=euro(vkSumme())"></label>
      <label>Preis je ${esc(lagerArt(p.lagerId)?.einheit)} (€)<input type="number" min="0" step="0.01" required value="${p.preis ?? ''}" oninput="vkPos[${i}].preis=reZahl(this.value);$('#vk-summe').textContent=euro(vkSumme())"></label>
      ${vkPos.length > 1 ? `<button type="button" class="klein gefahr" title="Sorte entfernen" onclick="vkPos.splice(${i},1);verkaufZeigen()">✕</button>` : '<span></span>'}</div>`).join('')}
    <div class="zeile" style="margin-top:10px"><button type="button" class="klein" onclick="vkPlus()">+ weitere Sorte</button><span style="flex:1"></span>Summe <b id="vk-summe">${euro(vkSumme())}</b></div>
    <p class="leise klein-t">Die Gläser werden vom Lager abgezogen, der Betrag wird als Einnahme „Honigverkauf“ unter Finanzen gebucht.</p>
    <div class="btns"><span class="platz"></span><button type="button" onclick="$('#dlg').close()">Abbrechen</button><button class="haupt">Verkauf buchen</button></div></form>`;
  dlg.querySelector('form').onsubmit = e => { e.preventDefault(); verkaufBuchen(); };
}
function verkaufBuchen() {
  const pos = vkPos.filter(p => p.anzahl > 0 && lagerArt(p.lagerId));
  if (!pos.length) return alert('Bitte eine Anzahl eintragen.');
  const fehl = fehlmengen(pos.map(p => [lagerArt(p.lagerId), p.anzahl]));
  if (fehl.length && !confirm('Zu wenig im Lager:\n' + fehl.join('\n') + '\n\nTrotzdem buchen?')) return;
  const id = uid(), datum = vkKopf.datum || heute(), kunde = vkKopf.kunde.trim(), betrag = +pos.reduce((s, p) => s + p.anzahl * p.preis, 0).toFixed(2);
  const ware = pos.map(p => `${zahl(p.anzahl, 2)}× ${lagerArt(p.lagerId).name}`).join(', ');
  for (const p of pos) {
    const l = lagerArt(p.lagerId);
    lagerBewegen(l, -p.anzahl, 'Verkauf' + (kunde ? ' · ' + kunde : ''), datum, { verkaufId: id });
    if (l.vpreis == null) l.vpreis = p.preis; // erster Preis wird als Verkaufspreis vorgeschlagen
  }
  if (betrag > 0) db.buchungen.push({ id: uid(), datum, art: 'Einnahme', betrag, kategorie: 'Honigverkauf', text: ware + (kunde ? ' · ' + kunde : ''), verkaufId: id });
  db.verkaeufe.push({ id, datum, kunde, betrag, pos: pos.map(p => ({ lagerId: p.lagerId, name: lagerArt(p.lagerId).name, anzahl: p.anzahl, preis: p.preis })) });
  $('#dlg').close(); speichern(); render();
  mindestWarnung(pos.map(p => lagerArt(p.lagerId)));
}
function verkaufLoeschen(id) {
  if (!confirm('Verkauf löschen? Die Gläser kommen zurück ins Lager und die Einnahme wird entfernt.')) return;
  bewegungenZurueck('verkaufId', id);
  db.buchungen = db.buchungen.filter(b => b.verkaufId !== id);
  db.verkaeufe = db.verkaeufe.filter(v => v.id !== id);
  speichern(); render();
}

// ---------- Abfüllung ----------
let af = {};
const plusJahre = (d, n) => `${+d.slice(0, 4) + n}${d.slice(4)}`;
function abfuellen() {
  const ziel = db.lager.find(istGlasware), gd = db.lager.filter(l => l.kategorie === 'Gläser & Deckel');
  const glas = gd.find(l => /glas|gläs/i.test(l.name)) || gd[0];
  af = { datum: heute(), zielId: ziel?.id || 'neu', neuName: '', vpreis: null, mindest: null, anzahl: null, glasG: ziel?.glasG || 500,
    honigId: db.lager.find(istLoseware)?.id || '', glaeserId: glas?.id || '',
    deckelId: glas && /deckel/i.test(glas.name) ? '' : gd.find(l => /deckel/i.test(l.name))?.id || '',
    etikettId: db.lager.find(l => l.kategorie === 'Etiketten')?.id || '', los: '', mhd: plusJahre(heute(), 2) };
  abfuellZeigen(); $('#dlg').showModal();
}
function afZiel(v) { af.zielId = v; af.glasG = lagerArt(v)?.glasG || af.glasG; abfuellZeigen(); }
const afKg = () => af.anzahl > 0 && af.glasG > 0 ? +(af.anzahl * af.glasG / 1000).toFixed(3) : null;
function abfuellZeigen() {
  const dlg = $('#dlg'), neu = af.zielId === 'neu' || !lagerArt(af.zielId), gd = db.lager.filter(l => l.kategorie === 'Gläser & Deckel');
  const feld = (k, label, typ = 'text', extra = '') => `<label>${label}<input type="${typ}" value="${esc(af[k] ?? '')}" ${extra} oninput="af.${k}=${typ === 'number' ? 'reZahl(this.value)' : 'this.value'}${k === 'anzahl' || k === 'glasG' ? ';afMenge()' : ''}"></label>`;
  dlg.innerHTML = `<form><h2>Honig abfüllen</h2><div class="felder">
      <label>Datum *<input type="date" required value="${af.datum}" onchange="af.datum=this.value;af.mhd=plusJahre(this.value,2);abfuellZeigen()"></label>
      <label>Volle Gläser buchen auf<select onchange="afZiel(this.value)"><option value="neu" ${neu ? 'selected' : ''}>＋ Neue Sorte</option>${auswahl(db.lager.filter(istGlasware), af.zielId)}</select></label>
      ${neu ? `<label class="breit">Name der Sorte *<input required placeholder="z. B. Blütenhonig 500 g" value="${esc(af.neuName)}" oninput="af.neuName=this.value"></label>
        ${feld('vpreis', 'Verkaufspreis je Glas (€)', 'number', 'min="0" step="0.01"')}${feld('mindest', 'Mindestbestand (Gläser)', 'number', 'min="0" step="1"')}` : ''}
      ${feld('anzahl', 'Anzahl Gläser *', 'number', 'min="1" step="1" required')}${feld('glasG', 'Inhalt je Glas (g)', 'number', 'min="1" step="1"')}
      ${feld('los', 'Los-Nr.')}<label>Haltbar bis<input type="date" value="${af.mhd}" onchange="af.mhd=this.value"></label></div>
    <h3>Vom Lager abziehen</h3><div class="felder">
      <label class="breit">Honig (lose)<select onchange="af.honigId=this.value;afMenge()">${auswahl(db.lager.filter(istLoseware), af.honigId, '– nicht abziehen –')}</select><span class="klein-t" id="af-kg"></span></label>
      <label>Leere Gläser<select onchange="af.glaeserId=this.value">${auswahl(gd, af.glaeserId, '– nicht abziehen –')}</select></label>
      <label>Deckel<select onchange="af.deckelId=this.value">${auswahl(gd, af.deckelId, '– nicht abziehen –')}</select></label>
      <label>Etiketten<select onchange="af.etikettId=this.value">${auswahl(db.lager.filter(l => l.kategorie === 'Etiketten'), af.etikettId, '– nicht abziehen –')}</select></label></div>
    <p class="leise klein-t">Gläser, Deckel und Etiketten werden je Glas abgezogen, der lose Honig nach Inhalt. Lose Honigvorräte im Lager unter Kategorie „Honig“ mit Einheit kg führen.</p>
    <div class="btns"><span class="platz"></span><button type="button" onclick="$('#dlg').close()">Abbrechen</button><button class="haupt">Abfüllung buchen</button></div></form>`;
  dlg.querySelector('form').onsubmit = e => { e.preventDefault(); abfuellBuchen(); };
  afMenge();
}
function afMenge() {
  const el = $('#af-kg'), kg = afKg(); if (!el) return;
  el.textContent = af.honigId && kg != null ? `Es werden ${zahl(kg, 2)} kg abgezogen.` : '';
}
function abfuellBuchen() {
  const n = af.anzahl, kg = afKg(), neu = af.zielId === 'neu' || !lagerArt(af.zielId);
  if (!(n > 0)) return alert('Bitte die Anzahl der Gläser eintragen.');
  if (neu && !af.neuName.trim()) return alert('Bitte einen Namen für die neue Sorte eintragen.');
  const honig = lagerArt(af.honigId), abzug = [];
  if (honig) abzug.push([honig, umrechnen(kg, 'kg', honig.einheit) ?? kg]);
  for (const id of [af.glaeserId, af.deckelId, af.etikettId]) { const l = lagerArt(id); if (l) abzug.push([l, n]); }
  const fehl = fehlmengen(abzug);
  if (fehl.length && !confirm('Zu wenig im Lager:\n' + fehl.join('\n') + '\n\nTrotzdem buchen?')) return;
  const id = uid(), datum = af.datum || heute();
  let ziel = lagerArt(af.zielId);
  if (neu) db.lager.push(ziel = { id: uid(), name: af.neuName.trim(), kategorie: 'Honig', einheit: 'Stk', menge: 0, vpreis: af.vpreis, mindest: af.mindest });
  // Ältere Gläser laufen zuerst ab: frühestes Haltbarkeitsdatum behalten, solange noch Bestand da ist
  if (af.mhd && !(ziel.menge > 0 && ziel.mhd && ziel.mhd < af.mhd)) ziel.mhd = af.mhd;
  if (af.los) ziel.los = af.los;
  if (af.glasG) ziel.glasG = af.glasG;
  lagerBewegen(ziel, n, 'Abfüllung' + (af.los ? ' · Los ' + af.los : ''), datum, { abfuellungId: id });
  for (const [l, m] of abzug) lagerBewegen(l, -m, 'Abfüllung ' + ziel.name, datum, { abfuellungId: id });
  db.abfuellungen.push({ id, datum, zielId: ziel.id, name: ziel.name, anzahl: n, glasG: af.glasG, honigKg: honig ? kg : null, los: af.los, mhd: af.mhd });
  $('#dlg').close(); speichern(); render();
  mindestWarnung(abzug.map(([l]) => l));
}
function abfuellungLoeschen(id) {
  const a = db.abfuellungen.find(x => x.id === id), ziel = lagerArt(a.zielId);
  const fehlt = ziel && a.anzahl > (ziel.menge || 0) ? `\n\nAchtung: Es sind nur noch ${zahl(ziel.menge, 0)} Gläser auf Lager – der Bestand von „${ziel.name}“ wird danach negativ, weil schon Gläser aus dieser Abfüllung verkauft wurden.` : '';
  if (!confirm('Abfüllung löschen? Die vollen Gläser werden wieder abgezogen, Honig, Gläser, Deckel und Etiketten kommen zurück ins Lager.' + fehlt)) return;
  bewegungenZurueck('abfuellungId', id);
  db.abfuellungen = db.abfuellungen.filter(a => a.id !== id);
  speichern(); render();
}
