// Arbeitszeit: Start/Stopp am Stand, Einträge mit Stundenlohn bewerten.
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

const TAETIGKEITEN = ['Durchsicht', 'Füttern', 'Behandlung', 'Honigraum / Zargen', 'Ernte', 'Schleudern & Abfüllen', 'Wandern', 'Ableger / Königinnen', 'Wachs & Rähmchen', 'Verkauf', 'Sonstiges'];
const lohn = () => db.einstellungen.stundenlohn ?? null;
// Datum/Uhrzeit für <input type="datetime-local"> und zurück
const lokal = ms => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
const dauerText = min => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')} h`;
const zeitWert = a => a.minuten / 60 * (a.lohn ?? lohn() ?? 0);

// ---------- Stoppuhr ----------
function uhrStart(standortId) {
  if (db.einstellungen.uhr) return;
  db.einstellungen.uhr = { start: Date.now(), standortId: standortId ?? (db.standorte.length === 1 ? db.standorte[0].id : '') };
  speichern(); render();
}
function uhrStopp() {
  const u = db.einstellungen.uhr; if (!u) return;
  zeitFormular(null, { standortId: u.standortId, start: lokal(u.start), ende: lokal(Date.now()), taetigkeit: 'Durchsicht' }, true);
}
function uhrVerwerfen() {
  if (!confirm('Laufende Zeitmessung verwerfen? Die Zeit wird nicht gebucht.')) return;
  delete db.einstellungen.uhr; speichern(); render();
}
function uhrLeiste() {
  const el = $('#uhr'), u = db.einstellungen.uhr; if (!el) return;
  el.innerHTML = !u ? '' : `<div class="uhr-leiste">⏱ <b id="uhr-zeit">${dauerText((Date.now() - u.start) / 6e4)}</b>
    <span class="uhr-ort">${u.standortId ? 'am ' + sName(u.standortId) : 'Arbeitszeit läuft'} · seit ${new Date(u.start).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</span>
    <button class="klein" title="Verwerfen" onclick="uhrVerwerfen()">✕</button><button class="klein haupt" onclick="uhrStopp()">■ Beenden</button></div>`;
}
setInterval(() => { const u = db.einstellungen.uhr, el = document.getElementById('uhr-zeit'); if (u && el) el.textContent = dauerText((Date.now() - u.start) / 6e4); }, 15000);
// Karte für die Übersicht
function uhrKarte() {
  const u = db.einstellungen.uhr;
  if (u) return `<div class="karte" style="margin-bottom:12px"><h4>⏱ Arbeitszeit läuft</h4>${u.standortId ? 'am ' + sName(u.standortId) + ' · ' : ''}seit ${new Date(u.start).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
    <div class="zeile" style="margin-top:8px"><button class="haupt" onclick="uhrStopp()">■ Beenden und buchen</button></div></div>`;
  return `<div class="karte" style="margin-bottom:12px"><h4>⏱ Arbeitszeit</h4><div class="zeile">
    <select id="uhr-ort" style="width:auto;flex:1"><option value="">– ohne Standplatz –</option>${db.standorte.map(s => `<option value="${s.id}" ${db.standorte.length === 1 ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    <button class="haupt" onclick="uhrStart($('#uhr-ort').value)">▶ Start</button></div></div>`;
}

// ---------- Einträge ----------
function zeitFormular(id, vorgabe = {}, vonUhr = false) {
  const alt = id && db.arbeitszeiten.find(a => a.id === id);
  const felder = [
    { k: 'standortId', label: 'Standplatz', typ: 'select', opts: [['', '–'], ...optS()] },
    { k: 'taetigkeit', label: 'Tätigkeit', liste: liste('taetigkeiten') },
    { k: 'start', label: 'Beginn', typ: 'datetime-local', req: 1 },
    { k: 'ende', label: 'Ende', typ: 'datetime-local', req: 1 },
    { k: 'volkId', label: 'Volk', typ: 'select', opts: [['', '–'], ...optV()] },
    { k: 'pause', label: 'Pause (Minuten)', typ: 'number', step: 1, min: 0 },
    { k: 'notiz', label: 'Notiz', typ: 'textarea', breit: 1 }];
  const werte = alt ? { ...alt, ...vorgabe } : { start: lokal(Date.now() - 36e5), ende: lokal(Date.now()), ...vorgabe };
  formular(alt ? 'Arbeitszeit bearbeiten' : vonUhr ? 'Arbeitszeit buchen' : 'Arbeitszeit eintragen', felder, werte, w => {
    const minuten = Math.round((new Date(w.ende) - new Date(w.start)) / 6e4) - (w.pause || 0);
    if (!(minuten > 0)) { alert('Das Ende muss nach dem Beginn liegen.'); return zeitFormular(id, w, vonUhr); }
    if (minuten > 14 * 60 && !confirm(`Das sind ${dauerText(minuten)} – stimmt das?`)) return zeitFormular(id, w, vonUhr);
    const e = { ...w, minuten, datum: w.start.slice(0, 10) };
    if (alt) Object.assign(alt, e); else db.arbeitszeiten.push({ id: uid(), lohn: lohn(), ...e });
    if (vonUhr) delete db.einstellungen.uhr;
    speichern(); render();
  }, alt && (() => { db.arbeitszeiten = db.arbeitszeiten.filter(a => a.id !== id); speichern(); render(); }));
}
function lohnSetzen(v) { db.einstellungen.stundenlohn = reZahl(v); speichern(); render(); }

// ---------- Ansicht ----------
let zeitJahr = null;
function zeigeArbeit() {
  const jahre = [...new Set([heute().slice(0, 4), ...db.arbeitszeiten.map(a => a.datum.slice(0, 4))])].sort().reverse();
  const jahr = jahre.includes(zeitJahr) ? zeitJahr : jahre[0], az = db.arbeitszeiten.filter(a => a.datum.startsWith(jahr));
  const min = az.reduce((s, a) => s + a.minuten, 0), wert = az.reduce((s, a) => s + zeitWert(a), 0), voelker = db.voelker.filter(v => v.status !== 'aufgelöst').length;
  const gruppe = f => { const g = {}; for (const a of az) { const k = f(a) || '–'; g[k] = (g[k] || 0) + a.minuten; } return Object.entries(g).sort((a, b) => b[1] - a[1]); };
  const balken = liste => liste.map(([k, m]) => `<div class="klein-t">${esc(k)}: <b>${dauerText(m)}</b></div><div class="balken"><i style="width:${min ? m / min * 100 : 0}%"></i></div>`).join('') || '<span class="leise klein-t">keine Einträge</span>';
  const u = db.einstellungen.uhr;
  main().innerHTML = kopf('Arbeitszeit', `<select style="width:auto" onchange="zeitJahr=this.value;render()">${jahre.map(j => `<option ${j === jahr ? 'selected' : ''}>${j}</option>`).join('')}</select>
      <button onclick="zeitFormular()">+ Eintrag</button>${u ? '<button class="haupt" onclick="uhrStopp()">■ Beenden</button>' : ''}`) +
    (u ? '' : uhrKarte()) +
    `<div class="raster">
      <div class="karte kachel"><b>${dauerText(min)}</b>Arbeitszeit ${jahr}</div>
      <div class="karte kachel"><b>${lohn() != null ? euro(wert) : '–'}</b>Wert der Arbeit ${jahr}</div>
      <div class="karte kachel"><b>${voelker ? dauerText(min / voelker) : '–'}</b>je Volk</div>
      <div class="karte kachel"><label class="klein-t">Stundenlohn (€)<input type="number" min="0" step="0.5" value="${lohn() ?? ''}" placeholder="z. B. 15" onchange="lohnSetzen(this.value)"></label></div></div>
    <p class="leise klein-t">Der Stundenlohn wird mit jedem Eintrag gespeichert – eine spätere Änderung gilt nur für neue Einträge. Die Arbeitszeit ist kein Geldfluss; unter Finanzen steht sie getrennt als „Ergebnis inkl. Arbeitszeit“.</p>
    <div class="raster" style="margin-top:12px"><div class="karte"><h4>Nach Standplatz</h4>${balken(gruppe(a => standort(a.standortId)?.name))}</div><div class="karte"><h4>Nach Tätigkeit</h4>${balken(gruppe(a => a.taetigkeit))}</div></div>
    <h3>Einträge ${jahr}</h3>` +
    tabelle(['Datum', 'Zeit', 'Dauer', 'Standplatz', 'Tätigkeit', 'Wert', ''], [...az].sort((a, b) => b.start.localeCompare(a.start)).map(a => [fmtD(a.datum), `${a.start.slice(11)}–${a.ende.slice(11)}`, dauerText(a.minuten),
      sName(a.standortId), esc(a.taetigkeit) + (a.volkId ? ` <span class="leise klein-t">${vName(a.volkId)}</span>` : '') + (a.notiz ? `<div class="leise klein-t">${esc(a.notiz)}</div>` : ''),
      a.lohn != null || lohn() != null ? euro(zeitWert(a)) : '–', `<button class="klein" onclick="zeitFormular('${a.id}')">✎</button>`]));
}
