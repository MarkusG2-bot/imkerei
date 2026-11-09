// Stufe Normal / Pro / Waage / Max: was der Stockwaage-Server zuletzt über dieses Konto gesagt hat.
// Der Server entscheidet (auch mit HTTP 402); die App merkt sich nur seine Antwort, zeigt sie oben neben der Version und erklärt Schlösser.
// Gespeichert eigen im Browser (nicht in db): imkerei-stufe = { jetzt, bis, quelle, rueckfall_waage, hinweis_ablauf, lizenz, t, konto }.
// Frisch bis 1 h (danach fragt swLaden neu), brauchbar bis 7 Tage ohne Server, danach gilt Normal. Ohne Anmeldung immer Normal.
// Liegt t in der Zukunft (Handy-Uhr zurückgestellt): nicht frisch, mehr als 7 Tage voraus veraltet.
// Wird nach stockwaage.js und satellit.js geladen (vor anpassen.js); stockwaage.js ruft stufe* nur zur Laufzeit, stufe.js nutzt swKonto, esc, $, heute, swSeite, gehe nur zur Laufzeit.

const STUFE_SPEICHER = 'imkerei-stufe', STUFE_FRISCH_MS = 3600e3, STUFE_GUELTIG_MS = 7 * 864e5;
const STUFE_NAMEN = { normal: 'Normal', pro: 'Pro', waage: 'Waage', max: 'Max' };

// Zu welchem Konto die gespeicherte Stufe gehört – nach einer Anmeldung mit anderem Benutzer zählt die alte nicht
function stufeKonto() { const k = swKonto(); return `${k.server || ''} ${k.benutzer || ''}`; }
function stufeGespeichert() {
  if (!swKonto().token) return null;
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STUFE_SPEICHER)); } catch { s = null; }
  return s && s.jetzt && s.t && s.konto === stufeKonto() ? s : null;
}
// Alter der gemerkten Antwort; negativ = t liegt in der Zukunft (Handy-Uhr zurückgestellt)
function stufeAlter(s) { return Date.now() - s.t; }
function stufeStand() {
  if (!swKonto().token) return { jetzt: 'normal' };
  const s = stufeGespeichert();
  if (!s) return { jetzt: 'normal' };
  const alter = stufeAlter(s);
  if (alter > STUFE_GUELTIG_MS || alter < -STUFE_GUELTIG_MS) return { jetzt: 'normal', veraltet: true };
  return s;
}
function stufeMerken(stufe, lizenz = null) {
  if (!stufe || !stufe.jetzt) return;                                // älterer Server ohne Stufen: nichts merken
  const { veraltet, ...rest } = stufe;
  try { localStorage.setItem(STUFE_SPEICHER, JSON.stringify({ ...rest, lizenz: lizenz ?? stufe.lizenz ?? null, t: Date.now(), konto: stufeKonto() })); } catch { /* Speicher voll: Anzeige bleibt alt */ }
}
// t in der Zukunft gilt nicht als frisch – swLaden fragt dann neu (sonst hinge die Anzeige, bis die Uhr aufholt)
function stufeFrisch() { const s = stufeGespeichert(); if (!s) return false; const alter = stufeAlter(s); return alter >= 0 && alter < STUFE_FRISCH_MS; }

// Stufe beim Server auffrischen, wenn sie nicht frisch ist (angemeldet) – nicht nur auf der Stockwaage-Seite: sonst gälte ein Pro-Kunde,
// der nur Ertrag/Potenzial nutzt, nach 7 Tagen als Normal und bekäme trotz Netz keinen Satellit. Fehler still (ohne Netz bleibt die
// gemerkte Stufe, 401 meldet swAbruf ab wie bisher); gleichzeitige Aufrufe teilen sich eine Anfrage. → true, wenn sich die Stufe geändert hat
let stufeLaeuft = null;
function stufeZeichen() {
  const s = stufeStand();
  return JSON.stringify([s.jetzt, s.bis ?? null, !!s.veraltet, s.lizenz ? s.lizenz.art ?? true : null, !!stufeGespeichert(), !!s.rueckfall_waage, !!s.hinweis_ablauf]);
}
// Nach einem Fehlschlag (kein Netz, Server weg) 5 Minuten Ruhe, sonst wartet jede Satellit-Abfrage offline bis zu 20 s auf „ich“
let stufePauseBis = 0;
async function stufeAuffrischen() {
  if (!swKonto().token || stufeFrisch() || Date.now() < stufePauseBis) return false;
  if (stufeLaeuft) return stufeLaeuft;
  const vorher = stufeZeichen();
  stufeLaeuft = (async () => {
    try { const j = await swAbruf('/api/app/ich'); stufeMerken(j.stufe, j.lizenz); stufePauseBis = 0; } catch { stufePauseBis = Date.now() + 5 * 60e3; }
    return stufeZeichen() !== vorher;
  })().finally(() => { stufeLaeuft = null; });
  return stufeLaeuft;
}
// Beim App-Start (app.js nach dem ersten render): auffrischen ohne zu warten, neu zeichnen nur bei geänderter Stufe
function stufeStart() {
  return stufeAuffrischen().then(neu => { if (neu) render(); }).catch(() => {});
}

// Nur für die Anzeige (Rang nach E3): max deckt alles, normal wird von allem gedeckt
function stufeDeckt(noetig, jetzt = stufeStand().jetzt) { return noetig === 'normal' || jetzt === 'max' || jetzt === noetig; }
function stufeName(s) { return STUFE_NAMEN[s] || 'Normal'; }
// 3.12. im laufenden Jahr, sonst 8.11.2027
function stufeDatum(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';   // kein Datum vom Server: kein „bis“
  const [j, m, t] = d.split('-').map(Number);
  return `${t}.${m}.${String(j) === heute().slice(0, 4) ? '' : j}`;
}
function stufeText(s = stufeStand()) {
  const n = stufeName(s.jetzt);
  if (s.lizenz) return `${n} · eigener Server`;
  const bis = s.jetzt !== 'normal' ? stufeDatum(s.bis) : '';
  return bis ? `${n} bis ${bis}` : n;
}
function stufeAnzeigen() {
  const el = $('#stufe-kopf');
  if (el) el.textContent = stufeText(stufeStand());
}

// Schloss-Marke an einer Funktion, die eine höhere Stufe braucht; Antippen erklärt die Wege
function schloss(noetig, was = '') {
  return `<span class="schloss-marke" role="button" title="Braucht die Stufe ${stufeName(noetig)}" onclick="stufeHinweis(${esc(JSON.stringify(String(noetig)))},${esc(JSON.stringify(String(was)))})">🔒 <span class="schloss">${stufeName(noetig)}</span></span>`;
}
function stufeHinweis(noetig, was = '') {
  const dlg = $('#dlg'), n = stufeName(noetig);
  const wege = [noetig === 'pro' ? 'registrieren – 30 Tage Pro zum Probieren' : '', 'Stockwaage koppeln – 1 Jahr Max inklusive', 'Betreiber fragen'].filter(Boolean);
  const jetzt = stufeText(stufeStand());                             // „Pro bis 8.12.“ endet schon mit Punkt
  dlg.innerHTML = `<h2>🔒 Stufe ${n}</h2>${was ? `<p>${esc(was)}</p>` : ''}
    <p>Dafür braucht es die Stufe <b>${n}</b>. Jetzt: ${esc(jetzt)}${jetzt.endsWith('.') ? '' : '.'}</p>
    <p class="klein-t leise">So kommst du dazu:</p><ul>${wege.map(w => `<li>${w}</li>`).join('')}</ul>
    <div class="btns"><span class="platz"></span><button onclick="$('#dlg').close()">Schließen</button>
      <button class="haupt" onclick="$('#dlg').close();swSeite('konto');gehe('stockwaage')">Zu Konto &amp; Stufe</button></div>`;
  dlg.showModal();
}
