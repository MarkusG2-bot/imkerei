// Sperrzonen (Bienenseuchen, v. a. Amerikanische Faulbrut): selbst eintragen, auf der Karte zeigen, vor Standplätzen und Wanderungen warnen.
// Eine öffentliche, maschinenlesbare Liste gibt es nicht – die Zonen erlassen die Bezirkshauptmannschaften per Verordnung.
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

const SPERR_QUELLEN = [
  ['Oberösterreich', 'https://bzv-ooe.at/labor/faulbrut-sperrgebiete/'],
  ['Tirol', 'https://tirolerimkerverband.at/referate-imker-landesverband-tirol/gesundheit-imker-bienen-landesverband-tirol/sperrgebiete-faulbrut.html'],
  ['Kärnten', 'https://www.imkerschule.org/sperrgebiete/'],
  ['VIS – deine Standorte mit Seuchenzonen', VIS_LINK],
];
// „Aufgehoben am“ zählt nicht mehr dazu: ab diesem Tag gilt die Zone nicht mehr
const zoneAktiv = z => (!z.von || z.von <= heute()) && (!z.bis || z.bis > heute());
const aktiveZonen = () => db.sperrzonen.filter(z => zoneAktiv(z) && z.lat != null && z.lon != null);
const abstandKm = (a, b) => Math.hypot((a.lat - b.lat) * 111.32, (a.lon - b.lon) * 111.32 * Math.cos(a.lat * Math.PI / 180));
const zonenAm = s => hatKoord(s) ? aktiveZonen().filter(z => abstandKm(s, z) <= (z.radius || 3)) : [];

// Für die Hinweise in der Übersicht
function sperrHinweise() {
  const h = [];
  for (const s of db.standorte) for (const z of zonenAm(s))
    h.push(['rot', `Standplatz ${esc(s.name)} liegt in der Sperrzone ${esc(z.name)}${z.bis ? ` (bis ${fmtD(z.bis)})` : ''}: keine Völker hinaus verbringen, Meldepflicht bei der BH beachten.`]);
  return h;
}
// Vor dem Umstellen eines Volkes
function wanderWarnung(vonId, nachId) {
  const von = standort(vonId), nach = standort(nachId), t = [];
  if (von) for (const z of zonenAm(von)) t.push(`Der bisherige Standplatz ${von.name} liegt in der Sperrzone ${z.name} – Völker dürfen dort nicht hinaus verbracht werden.`);
  if (nach) for (const z of zonenAm(nach)) t.push(`Der neue Standplatz ${nach.name} liegt in der Sperrzone ${z.name} – Hineinbringen nur mit Bewilligung der Bezirkshauptmannschaft.`);
  return t;
}

// Auf der Standplatz-Karte
let sperrModus = false;
function sperrKreise() {
  if (!karte || !window.L) return;
  for (const z of aktiveZonen()) L.circle([z.lat, z.lon], { radius: (z.radius || 3) * 1000, color: '#c0392b', weight: 2, fillColor: '#c0392b', fillOpacity: 0.12 }).addTo(karte)
    .bindPopup(`<b>Sperrzone ${esc(z.name)}</b><br>${zahl(z.radius || 3)} km · seit ${fmtD(z.von)}${z.bis ? ' · bis ' + fmtD(z.bis) : ''}${z.gz ? '<br>' + esc(z.gz) : ''}`);
}
function sperrEintragen() {
  sperrModus = !sperrModus;
  const h = $('#kartenhinweis'); if (h) h.textContent = sperrModus ? 'Tippe auf die Karte an den Ausbruchsort (Mittelpunkt der Sperrzone). Vorher kannst du mit „Ort suchen“ hinfahren.' : '';
  const b = $('#sperr-knopf'); if (b) b.classList.toggle('haupt', sperrModus);
}
function sperrListeHtml() {
  const zonen = [...db.sperrzonen].sort((a, b) => (zoneAktiv(b) - zoneAktiv(a)) || (b.von || '').localeCompare(a.von || ''));
  return `<h3>Sperrzonen</h3><p class="leise klein-t">Die Bezirkshauptmannschaften legen Sperrzonen per Verordnung fest, meist 3 km um den Ausbruchsort. Eine öffentliche Datenquelle zum automatischen Abrufen gibt es nicht – trag die Zonen hier ein (Knopf „⚠ Sperrzone“ über der Karte), dann zeigt die App sie als rote Kreise und warnt bei Standplätzen und Wanderungen.</p>` +
    (zonen.length ? tabelle(['Ort', 'Radius', 'Gilt', 'Geschäftszahl / Behörde', 'Status', ''], zonen.map(z => [`<b>${esc(z.name)}</b>${z.notiz ? `<div class="leise klein-t">${esc(z.notiz)}</div>` : ''}`,
      zahl(z.radius || 3) + ' km', `${fmtD(z.von)} – ${z.bis ? fmtD(z.bis) : 'offen'}`, esc(z.gz) + (z.link ? ` <a href="${esc(z.link)}" target="_blank" rel="noopener">Verordnung</a>` : ''),
      zoneAktiv(z) ? marke('aktiv', 'rot') : marke(z.von > heute() ? 'kommt' : 'aufgehoben'),
      `<div class="zeile">${zoneAktiv(z) ? `<button class="klein" onclick="sperrAufheben('${z.id}')">Aufgehoben</button>` : ''}<button class="klein" onclick="bearbeiten('sperrzonen','${z.id}')">✎</button></div>`])) : '<p class="leer">Keine Sperrzonen eingetragen.</p>') +
    `<p class="klein-t">Aktuelle Listen: ${SPERR_QUELLEN.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join(' · ')} · andere Bundesländer: Verordnungen der Bezirkshauptmannschaft bzw. Landesverband für Bienenzucht.</p>`;
}
function sperrAufheben(id) { const z = db.sperrzonen.find(x => x.id === id); z.bis = heute(); speichern(); render(); }
