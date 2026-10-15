// Anpassen: Menü und Übersicht ordnen bzw. ausblenden, eigene Auswahllisten pflegen.
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

// ---------- Auswahllisten ----------
// fest = wird von der App selbst gebraucht (Abfüllung, Verkauf, Rechnung …) und lässt sich nicht umbenennen oder löschen
const LISTEN = {
  lagerKat: { titel: 'Lager-Kategorien', std: () => KATEGORIEN, fest: ['Honig', 'Gläser & Deckel', 'Etiketten', 'Futter', 'Wachs', 'Sonstiges'],
    benutzt: k => db.lager.filter(l => l.kategorie === k).length, umbenennen: (alt, neu) => db.lager.forEach(l => { if (l.kategorie === alt) l.kategorie = neu; }), ersatz: 'Sonstiges' },
  buchKat: { titel: 'Finanz-Kategorien', std: () => BUCH_KAT, fest: ['Honigverkauf', 'Futter', 'Behandlungsmittel', 'Gläser & Etiketten', 'Material', 'Sonstiges'],
    benutzt: k => db.buchungen.filter(b => b.kategorie === k).length, umbenennen: (alt, neu) => db.buchungen.forEach(b => { if (b.kategorie === alt) b.kategorie = neu; }) },
  sorten: { titel: 'Honigsorten', std: () => SORTEN },
  mittel: { titel: 'Behandlungsmittel / Verfahren', std: () => MITTEL },
  taetigkeiten: { titel: 'Tätigkeiten (Arbeitszeit)', std: () => TAETIGKEITEN,
    benutzt: k => db.arbeitszeiten.filter(a => a.taetigkeit === k).length, umbenennen: (alt, neu) => db.arbeitszeiten.forEach(a => { if (a.taetigkeit === alt) a.taetigkeit = neu; }) },
};
const liste = k => db.einstellungen.listen?.[k] || LISTEN[k].std();
function listeAendern(k, fn) { const l = [...liste(k)]; fn(l); (db.einstellungen.listen ??= {})[k] = l; speichern(); render(); }
function listeNeu(k) {
  const w = $('#neu-' + k).value.trim(); if (!w) return;
  if (liste(k).includes(w)) return alert(`„${w}“ gibt es schon.`);
  listeAendern(k, l => l.push(w));
}
function listeUmbenennen(k, i) {
  const alt = liste(k)[i], neu = prompt('Neuer Name:', alt)?.trim();
  if (!neu || neu === alt) return;
  if (liste(k).includes(neu)) return alert(`„${neu}“ gibt es schon.`);
  LISTEN[k].umbenennen?.(alt, neu); // vorhandene Einträge ziehen mit
  listeAendern(k, l => { l[i] = neu; });
}
function listeLoeschen(k, i) {
  const L = LISTEN[k], w = liste(k)[i], n = L.benutzt?.(w) || 0;
  if (!confirm(n ? `„${w}“ wird ${n}-mal verwendet. ${L.ersatz ? `Diese Einträge kommen nach „${L.ersatz}“.` : 'Die Einträge behalten ihren Namen, er wird nur nicht mehr zur Auswahl angeboten.'} Löschen?` : `„${w}“ löschen?`)) return;
  if (n && L.ersatz) L.umbenennen(w, L.ersatz);
  listeAendern(k, l => l.splice(i, 1));
}
const listeSchieben = (k, i, d) => listeAendern(k, l => { [l[i], l[i + d]] = [l[i + d], l[i]]; });
function listeStandard(k) {
  if (!confirm('Liste auf die ursprünglichen Einträge zurücksetzen? Eigene Einträge verschwinden aus der Auswahl, bereits gespeicherte Daten bleiben.')) return;
  if (k === 'lagerKat') for (const l of db.lager) if (!KATEGORIEN.includes(l.kategorie)) l.kategorie = 'Sonstiges';
  delete db.einstellungen.listen?.[k]; speichern(); render();
}
function listeHtml(k) {
  const L = LISTEN[k], werte = liste(k);
  return `<div class="karte"><h4>${L.titel}</h4>${werte.map((w, i) => { const fest = L.fest?.includes(w), n = L.benutzt?.(w); return `<div class="ord-zeile">
      <span>${esc(w)}${fest ? ' <span class="leise klein-t">· fest</span>' : ''}${n ? ` <span class="leise klein-t">· ${n}×</span>` : ''}</span><span style="flex:1"></span>
      ${fest ? '' : `<button class="klein" title="Umbenennen" onclick="listeUmbenennen('${k}',${i})">✎</button><button class="klein gefahr" title="Löschen" onclick="listeLoeschen('${k}',${i})">✕</button>`}
      <button class="klein" ${i ? '' : 'disabled'} onclick="listeSchieben('${k}',${i},-1)">▲</button><button class="klein" ${i < werte.length - 1 ? '' : 'disabled'} onclick="listeSchieben('${k}',${i},1)">▼</button></div>`; }).join('')}
    <div class="zeile" style="margin-top:8px"><input id="neu-${k}" placeholder="Neuer Eintrag" style="flex:1;width:auto" onkeydown="if(event.key==='Enter')listeNeu('${k}')"><button onclick="listeNeu('${k}')">+ Hinzufügen</button></div>
    ${db.einstellungen.listen?.[k] ? `<button class="klein" style="margin-top:8px" onclick="listeStandard('${k}')">Ursprüngliche Liste</button>` : ''}</div>`;
}

// ---------- Reihenfolge und Sichtbarkeit (Menü, Übersicht) ----------
const ORDNUNGEN = {
  menue: { titel: 'Menü oben', teile: () => ANSICHTEN.map(([k, label]) => ({ k, label, fest: ['einstellungen', 'daten'].includes(k) })) },
  start: { titel: 'Übersicht', teile: () => START_TEILE },
};
// Einträge in gespeicherter Reihenfolge; neu hinzugekommene hinten, mit ihrer Voreinstellung (an/aus)
function geordnet(key, mitAus) {
  const teile = ORDNUNGEN[key].teile(), c = db.einstellungen.ordnung?.[key] || {}, reihe = c.reihe || [], bekannt = c.bekannt || [];
  const pos = t => reihe.includes(t.k) ? reihe.indexOf(t.k) : 1000 + teile.indexOf(t);
  const alle = [...teile].sort((a, b) => pos(a) - pos(b)).map(t => ({ ...t, an: !!t.fest || (bekannt.includes(t.k) ? !(c.aus || []).includes(t.k) : !t.aus) }));
  return mitAus ? alle : alle.filter(t => t.an);
}
function ordnungAendern(key, fn) {
  const alle = geordnet(key, true), c = { reihe: alle.map(t => t.k), aus: alle.filter(t => !t.an).map(t => t.k), bekannt: alle.map(t => t.k) };
  fn(c); (db.einstellungen.ordnung ??= {})[key] = c; speichern(); render();
}
const ordnungAn = (key, k, an) => ordnungAendern(key, c => { c.aus = an ? c.aus.filter(x => x !== k) : [...c.aus, k]; });
const ordnungSchieben = (key, i, d) => ordnungAendern(key, c => { [c.reihe[i], c.reihe[i + d]] = [c.reihe[i + d], c.reihe[i]]; });
function ordnungStandard(key) { if (db.einstellungen.ordnung) delete db.einstellungen.ordnung[key]; speichern(); render(); }
function ordnungHtml(key) {
  const alle = geordnet(key, true);
  return `<div class="karte"><h4>${ORDNUNGEN[key].titel}</h4>${alle.map((t, i) => `<div class="ord-zeile">
      <label class="check" style="margin:0"><input type="checkbox" ${t.an ? 'checked' : ''} ${t.fest ? 'disabled' : ''} onchange="ordnungAn('${key}','${t.k}',this.checked)"> ${esc(t.label)}${t.fest ? ' <span class="leise klein-t">· immer sichtbar</span>' : ''}</label><span style="flex:1"></span>
      <button class="klein" ${i ? '' : 'disabled'} onclick="ordnungSchieben('${key}',${i},-1)">▲</button><button class="klein" ${i < alle.length - 1 ? '' : 'disabled'} onclick="ordnungSchieben('${key}',${i},1)">▼</button></div>`).join('')}
    ${db.einstellungen.ordnung?.[key] ? `<button class="klein" style="margin-top:8px" onclick="ordnungStandard('${key}')">Ursprüngliche Einstellung</button>` : ''}</div>`;
}

// ---------- Ansicht ----------
function zeigeEinstellungen() {
  main().innerHTML = kopf('Anpassen') +
    '<p class="leise klein-t">Häkchen = wird angezeigt, ▲▼ = Reihenfolge. Die Einstellungen gelten für dieses Gerät und sind in der Daten-Sicherung enthalten.</p>' +
    `<div class="raster">${ordnungHtml('menue')}${ordnungHtml('start')}</div>
    <h3>Auswahllisten</h3><p class="leise klein-t">Diese Einträge stehen in den Formularen zur Auswahl. Umbenennen ändert auch alle gespeicherten Einträge mit diesem Namen. „fest“ braucht die App selbst (z. B. Abfüllung und Verkauf), diese Einträge lassen sich nur verschieben.</p>
    <div class="raster">${Object.keys(LISTEN).map(listeHtml).join('')}</div>
    <h3>Weitere Einstellungen</h3><div class="raster">
      <div class="karte"><label class="klein-t">Flugradius auf der Karte (km)<input type="number" min="0.5" max="10" step="0.5" value="${flugradius()}" onchange="radiusSetzen(this.value)"></label></div>
      <div class="karte"><label class="klein-t">Völkerdichte für das Trachtpotenzial (Völker je km²)<input type="number" min="0" step="0.1" value="${voelkerdichte()}" onchange="db.einstellungen.voelkerdichte=reZahl(this.value)??5.4;speichern();render()"></label>
        <div class="leise klein-t">Österreich-Schnitt: rund 456.000 Völker auf 83.879 km² ≈ 5,4. Wird verwendet, solange beim Standplatz keine eigene Zahl eingetragen ist.</div></div>
      <div class="karte"><label class="klein-t">Stundenlohn für die Arbeitszeit (€)<input type="number" min="0" step="0.5" value="${lohn() ?? ''}" onchange="lohnSetzen(this.value)"></label></div></div>
    <div class="raster" style="margin-top:12px">${nektarHtml()}</div>`;
}
