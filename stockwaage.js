// Stockwaage: Verbindung zum Stockwaage-Server (Projekt Claud_Work/Stockwaage, server/server.js)
// • Waage einrichten (Kopplungscode, Einrichtungs-WLAN am Master) und Stand verbinden (Fortschritt, Bluetooth-Abholung)
// • Stand: Völker mit Gewicht, Zuordnung Waagen-Nummer ↔ Volk der Stockführung, Standplatz, Ereignisse, Befehle
// • Ereignis-Videos der Übersichts- und Fluglochkamera (▶ beim Ereignis und beim Volk)
// • Einstellungen: Varroa-Aufnahme (Serie/durchgehend), Schwarmvorhersage über den Summton (Empfindlichkeit, Dauerbetrieb)
// • Mess-/Sendetakt (mit Grenze der Sendezeit), Waage kalibrieren mit Prüfgewicht, Firmware-Update
// • Verlauf je Volk, Waagen-Karte in der Stockkarte, Ereignis → Stockführung, Push-Meldungen
// • Arbeitszeit-Start → Bearbeitungsmodus am Stand; gemessene Zunahme im Trachtpotenzial
// • Konten mit Benutzername, Daten teilen (Einwilligungen je Stufe), Karte der Stände, Konto, Betreiber-Seite
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.
// Server-Adresse und Anmeldung liegen bewusst NICHT in db (nicht in der JSON-Sicherung), sondern eigen im Browser.
// Zuordnungen liegen in db (sind Teil der Imkerei-Daten): volk.waage = {stand, nr}, standort.waageStand.

const SW_KONTO = 'imkerei-stockwaage';
let swAnsicht = 'liste', swStaende = null, swFehler = '', swEin = null, swVerb = null, swTimer = null;
let swStandAktiv = null, swStandDaten = null, swVolkAktiv = null, swVolkTage = 30, swVolkDaten = null;
const SW_ARTEN = { 1: 'Schwarm', 2: 'Bewegung', 3: 'Umsturz', 4: 'Räuberei-Verdacht', 5: 'Slave fehlt', 6: 'Akku', 7: 'Lastabwurf',
  8: 'Gewichtssprung (Eingriff?)', 9: 'Brut-Temperatur', 10: 'Volk still', 11: 'Diebstahl (Waage leer)', 12: 'Eingriff erkannt',
  13: 'Flugbeginn ungewöhnlich', 14: 'Tageszunahme ungewöhnlich', 15: 'Nachtabnahme ungewöhnlich', 16: 'Innentemperatur ungewöhnlich',
  17: 'Summen ungewöhnlich', 18: 'Funk-Knoten fehlt', 19: 'Speicherkarte fast voll', 20: 'Schwarmstimmung (Summton)' };
const SW_BLE = { dienst: '5f6d0001-5a3c-4b8e-9c1a-7c2d3e4f5a6b', info: '5f6d0002-5a3c-4b8e-9c1a-7c2d3e4f5a6b', anfrage: '5f6d0003-5a3c-4b8e-9c1a-7c2d3e4f5a6b',
  daten: '5f6d0004-5a3c-4b8e-9c1a-7c2d3e4f5a6b', status: '5f6d0005-5a3c-4b8e-9c1a-7c2d3e4f5a6b', best: '5f6d0006-5a3c-4b8e-9c1a-7c2d3e4f5a6b' };

const swKonto = () => { try { return JSON.parse(localStorage.getItem(SW_KONTO)) || {}; } catch { return {}; } };
const swKontoSetzen = k => localStorage.setItem(SW_KONTO, JSON.stringify(k));

async function swAbruf(pfad, opt = {}) {
  const k = swKonto(), h = { 'Content-Type': 'application/json', ...(opt.kopf || {}) };
  if (k.token) h.Authorization = 'Bearer ' + k.token;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  let r;
  try { r = await fetch(k.server + pfad, { ...opt, headers: h, signal: ctl.signal }); }
  catch { throw new Error('Server nicht erreichbar – Internet am Handy? Läuft der Server am PC?'); }
  finally { clearTimeout(t); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && pfad !== '/api/anmelden') { swKontoSetzen({ server: k.server, benutzer: k.benutzer }); throw new Error('Anmeldung abgelaufen – bitte neu anmelden.'); }
  if (!r.ok || !j.ok) throw new Error(j.fehler || `Server antwortet ${r.status}`);
  return j;
}

function swStopp() { clearInterval(swTimer); swTimer = null; }
// Läuft nur, solange die Seite Stockwaage offen ist
function swAlle(ms, fn) {
  swStopp();
  swTimer = setInterval(() => { if (ansicht !== 'stockwaage') return swStopp(); fn(); }, ms);
}
const swVor = ms => { if (!ms) return 'nie'; const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} min` : m < 1440 ? `vor ${Math.round(m / 60)} h` : `vor ${Math.round(m / 1440)} Tagen`; };
const swName = s => esc(s.name || 'Stand ' + s.stand);
const swZurueck = (wohin = 'liste') => `<button onclick="swAnsicht='${wohin}';swStaende=null;render()">← Zurück</button>`;
const swDatum = unix => new Date(unix * 1000).toISOString();
const swVolkVon = (stand, nr) => db.voelker.find(v => v.waage?.stand === stand && v.waage?.nr === nr);

// ---------- Seite ----------
function zeigeStockwaage() {
  const k = swKonto();
  if (!k.token) return swAnmeldeSeite(k);
  if (swAnsicht === 'einrichten') return swEinrichtenSeite();
  if (swAnsicht === 'verbinden') return swVerbindenSeite();
  if (swAnsicht === 'stand') return swStandSeite();
  if (swAnsicht === 'volk') return swVolkSeite();
  if (swAnsicht === 'kalib') return swKalibSeite();
  if (swAnsicht === 'teilen') return swTeilenSeite();
  if (swAnsicht === 'karte') return swKarteSeite();
  if (swAnsicht === 'konto') return swKontoSeite();
  if (swAnsicht === 'betrieb') return swBetriebSeite();
  swStopp();
  main().innerHTML = kopf('Stockwaage', `<button class="haupt" onclick="swEinrichtenStart()">＋ Waage einrichten</button>
      <button onclick="swVerbindenStart()">📶 Stand verbinden</button><button onclick="swPush()">🔔 Meldungen</button>
      <button onclick="swSeite('teilen')">🔒 Daten teilen</button><button onclick="swSeite('karte')">🗺 Karte</button>
      <button onclick="swSeite('konto')">👤 Konto</button>${k.konto?.rolle === 'betreiber' ? `<button onclick="swSeite('betrieb')">🛠 Betrieb</button>` : ''}`) +
    (swFehler ? `<ul class="hinweise"><li class="rot">${esc(swFehler)}</li></ul>` : '') +
    (swStaende == null ? '<p class="leise">Lade …</p>' : swStaende.length === 0
      ? '<div class="karte">Noch keine Waage eingerichtet. Mit „＋ Waage einrichten“ beginnen.</div>'
      : `<div class="raster">${swStaende.map(s => `<div class="karte" style="cursor:pointer" onclick="swStandOeffnen('${s.stand}')"><h4>${swName(s)}</h4>
          <div class="klein-t leise">Stand ${esc(s.stand)}${s.firmware ? ' · Firmware ' + esc(s.firmware) : ''}</div>
          <div style="margin-top:6px">Funk: <b>${swVor(s.letzter_funk)}</b> · hochgeladen: <b>${swVor(s.letzter_upload)}</b></div>
          <div class="klein-t">${zahl(s.messungen)} Messwerte von ${s.voelker} ${s.voelker === 1 ? 'Volk' : 'Völkern'}${s.letzte_messung ? ' · jüngster ' + fmtD(swDatum(s.letzte_messung).slice(0, 10)) : ''}</div>
        </div>`).join('')}</div>`) +
    `<p class="leise klein-t" style="margin-top:16px">Server: ${esc(k.server)}${k.konto ? ' · angemeldet als ' + esc(k.konto.benutzer) : ''} · <a href="#" onclick="swAbmelden();return false">abmelden</a>
      · <a href="${esc(k.server)}/markieren" target="_blank" rel="noopener">Varroa-Bilder markieren</a></p>`;
  if (swStaende == null) swLaden();
}
async function swLaden() {
  try {
    if (!swKonto().konto) { const k = swKonto(); swKontoSetzen({ ...k, konto: (await swAbruf('/api/app/ich')).konto }); }  // Anmeldung aus 1.1
    swStaende = (await swAbruf('/api/app/staende')).staende; swFehler = '';
  }
  catch (e) { swStaende = swStaende || []; swFehler = e.message; }
  if (ansicht === 'stockwaage') render();
}

function swAnmeldeSeite(k) {
  main().innerHTML = kopf('Stockwaage') + `<div class="karte" style="max-width:480px">
      <h4>Mit dem Stockwaage-Server verbinden</h4>
      <p class="klein-t leise">Einmal je Handy. Die Adresse ist die des Servers (eigener PC über Tailscale Funnel oder die Web-Adresse
        des Anbieters). Benutzername und Passwort: bei der Installation festgelegt oder vom Betreiber erhalten.</p>
      <label>Server-Adresse<input id="sw-server" value="${esc(k.server || '')}" placeholder="https://…"></label>
      <label>Benutzername<input id="sw-benutzer" value="${esc(k.benutzer || '')}" autocomplete="username" autocapitalize="none"></label>
      <label>Passwort <input id="sw-pw" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')swAnmelden()"></label>
      ${swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : ''}
      <p class="klein-t leise">Mit der Anmeldung gilt die <a href="#" onclick="swDatenschutz();return false">Datenschutzerklärung</a> des Servers.</p>
      <button class="haupt" style="margin-top:10px" onclick="swAnmelden()">Anmelden</button></div>`;
}
async function swAnmelden() {
  const server = $('#sw-server').value.trim().replace(/\/+$/, ''), pw = $('#sw-pw').value, benutzer = $('#sw-benutzer').value.trim();
  if (!/^https?:\/\//.test(server)) { swFehler = 'Server-Adresse beginnt mit https://'; return render(); }
  swKontoSetzen({ server, benutzer });
  try {
    const j = await swAbruf('/api/anmelden', { method: 'POST', body: JSON.stringify({ benutzer: benutzer || null, passwort: pw }) });
    swKontoSetzen({ server, benutzer, token: j.token, konto: j.konto }); swFehler = ''; swStaende = null; swAnsicht = 'liste';
  } catch (e) { swFehler = e.message; }
  render();
}
function swAbmelden() {
  if (!confirm('Vom Stockwaage-Server abmelden? Die Daten am Server bleiben.')) return;
  const k = swKonto();
  swAbruf('/api/app/abmelden', { method: 'POST' }).catch(() => {});
  swKontoSetzen({ server: k.server, benutzer: k.benutzer }); swStaende = null; swAnsicht = 'liste'; render();
}

// ---------- Waage einrichten ----------
function swEinrichtenStart() {
  swEin = { schritt: 1, name: db.standorte.length === 1 ? db.standorte[0].name : '', code: null, ablauf: 0, start: Date.now() };
  swAnsicht = 'einrichten'; render();
}
async function swCodeHolen() {
  swEin.name = $('#sw-name').value.trim();
  try {
    const j = await swAbruf('/api/app/kopplungscode', { method: 'POST', body: JSON.stringify({ name: swEin.name }) });
    Object.assign(swEin, { code: j.code, ablauf: j.ablauf, schritt: 2, start: Date.now() }); swFehler = '';
  } catch (e) { swFehler = e.message; }
  render();
}
function swEinrichtenSeite() {
  const e = swEin, zurueck = swZurueck();
  if (e.schritt === 1) {
    swStopp();
    main().innerHTML = kopf('Waage einrichten', zurueck) + `<div class="karte" style="max-width:520px">
      <h4>1 · Name für die Waage bzw. den Stand</h4>
      <label>Name<input id="sw-name" value="${esc(e.name)}" placeholder="z. B. Stand Hausgarten" list="sw-orte"></label>
      <datalist id="sw-orte">${db.standorte.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
      ${swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : ''}
      <button class="haupt" style="margin-top:10px" onclick="swCodeHolen()">Kopplungscode holen</button></div>`;
    return;
  }
  const rest = Math.max(0, Math.round((e.ablauf - Date.now()) / 6e4));
  main().innerHTML = kopf('Waage einrichten', zurueck) + (e.schritt === 3
    ? `<div class="karte" style="max-width:520px"><h4>✓ Waage verbunden</h4><p><b>${swName(e.stand)}</b> (Stand ${esc(e.stand.stand)}) ist mit dem Server gekoppelt.</p>
        <p class="klein-t leise">Ab jetzt lädt der Master die Messwerte selbst hoch, sobald dein Handy-Hotspot in der Nähe ist.
        Unter dem Stand die Waagen-Nummern deinen Völkern zuordnen.</p>
        <button class="haupt" onclick="swStandOeffnen('${e.stand.stand}')">Zum Stand</button></div>`
    : `<div class="karte" style="max-width:520px">
      <h4>2 · Kopplungscode</h4>
      <div style="font-size:40px;font-weight:700;letter-spacing:6px;text-align:center;margin:8px 0">${e.code.slice(0, 3)} ${e.code.slice(3)}</div>
      <div class="klein-t leise" style="text-align:center">gilt noch ${rest} min, nur einmal</div>
      <h4 style="margin-top:16px">3 · Am Master</h4>
      <ol class="klein-t" style="padding-left:20px;line-height:1.6">
        <li><b>Taster 6 Sekunden halten</b>, bis die LED schnell blinkt.</li>
        <li>Am Handy das WLAN <b>„Stockwaage-…“</b> wählen. Die Einrichtungsseite öffnet sich von selbst (sonst im Browser <b>192.168.4.1</b> aufrufen).</li>
        <li>Dort eintragen: <b>Name und Passwort deines Handy-Hotspots</b>, den <b>Kopplungscode</b> oben und – falls leer – die Server-Adresse <b>${esc(swKonto().server)}</b>. Speichern.</li>
        <li>Das WLAN „Stockwaage-…“ verlassen und den <b>Handy-Hotspot einschalten</b>.<br>
          <span class="leise">iPhone: Einstellungen → Persönlicher Hotspot → „Zugriff für andere erlauben“ und <b>„Kompatibilität maximieren“</b> ein.
          Android: Hotspot-Band <b>2,4 GHz</b>.</span></li>
        <li>Zurück in diese App – sie meldet sich, sobald die Waage verbunden ist (1–3 min).</li>
      </ol>
      <p class="klein-t">⏳ Warte auf die Waage … <span class="leise">(prüft alle 10 s)</span></p>
      ${swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : ''}</div>`);
  if (e.schritt === 2 && !swTimer) swAlle(10000, swEinrichtenPruefen);
}
async function swEinrichtenPruefen() {
  try {
    const st = (await swAbruf('/api/app/staende')).staende;
    // neu gekoppelt: Gerät, das seit dem Code-Holen angelegt bzw. neu gekoppelt wurde
    const neu = st.find(s => s.angelegt >= swEin.start - 1000 && (s.name || '') === swEin.name)
      || (await Promise.all(st.map(async s => ({ s, n: await swAbruf(`/api/app/stand/${s.stand}/neu?seit=${swEin.start}`) }))))
        .find(x => x.n.gekoppelt >= swEin.start)?.s;
    swFehler = '';
    if (neu) { swStopp(); swEin.schritt = 3; swEin.stand = neu; swStaende = null; }
  } catch (e) { swFehler = e.message; }
  if (Date.now() > swEin.ablauf) { swStopp(); swFehler = 'Der Code ist abgelaufen – zurück und einen neuen holen.'; }
  if (ansicht === 'stockwaage' && swAnsicht === 'einrichten') render();
}

// ---------- Stand verbinden (Handy-Hotspot oder Bluetooth) ----------
async function swVerbindenStart(stand) {
  if (!swStaende) try { swStaende = (await swAbruf('/api/app/staende')).staende; } catch (e) { swFehler = e.message; return render(); }
  if (!swStaende.length) { swFehler = 'Noch keine Waage eingerichtet.'; return render(); }
  swVerb = { stand: stand || (swStaende.length === 1 ? swStaende[0].stand : null), start: Date.now(), uploads: 0, neu: 0, zuletzt: null, ble: '' };
  swAnsicht = 'verbinden'; render();
}
function swVerbindenSeite() {
  const v = swVerb, s = swStaende.find(x => x.stand === v.stand);
  if (!s) {
    swStopp();
    main().innerHTML = kopf('Stand verbinden', swZurueck()) + `<div class="karte" style="max-width:520px"><h4>Welcher Stand?</h4>
      ${swStaende.map(x => `<button style="display:block;width:100%;margin-top:8px" onclick="swVerb.stand='${x.stand}';swVerb.start=Date.now();render()">${swName(x)}</button>`).join('')}</div>`;
    return;
  }
  const minuten = Math.round((Date.now() - v.start) / 6e4), bt = 'bluetooth' in navigator;
  main().innerHTML = kopf('Stand verbinden', swZurueck()) + `<div class="karte" style="max-width:520px">
      <h4>${swName(s)}</h4>
      <ol class="klein-t" style="padding-left:20px;line-height:1.6">
        <li><b>Handy-Hotspot einschalten</b> (2,4 GHz; iPhone: „Kompatibilität maximieren“).</li>
        <li>Für sofort: <b>Taster am Master kurz drücken</b>. Sonst meldet sich der Master spätestens mit der nächsten Viertelstunde.</li>
        <li>Hotspot eingeschaltet lassen, bis hier „fertig“ steht.</li>
      </ol>
      <div class="raster" style="margin-top:10px">
        <div class="karte kachel"><b>${zahl(v.neu)}</b>neue Messwerte</div>
        <div class="karte kachel"><b>${v.uploads}</b>Pakete angekommen</div>
      </div>
      <p class="klein-t" style="margin-top:10px">${v.zuletzt
        ? (Date.now() - v.zuletzt > 60000 ? `✓ <b>fertig</b> – letztes Paket ${swVor(v.zuletzt)}. Hotspot kann aus.` : `📶 Master lädt hoch … letztes Paket ${swVor(v.zuletzt)}`)
        : `⏳ Warte auf den Master … (seit ${minuten} min, prüft alle 10 s)`}</p>
      <p class="klein-t leise">Zuletzt vor diesem Besuch: ${swVor(s.letzter_upload)}</p>
      ${swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : ''}</div>
    <div class="karte" style="max-width:520px;margin-top:12px"><h4>Kein Hotspot möglich? Über Bluetooth abholen</h4>
      <p class="klein-t leise">Findet der Master nach einem kurzen Tastendruck 1 min lang keinen Hotspot, wartet er 10 min auf Bluetooth.
      ${bt ? '' : 'Dieser Browser kann kein Bluetooth – am iPhone mit der App „Bluefy“ öffnen, am Android mit Chrome.'}</p>
      <button ${bt ? '' : 'disabled'} onclick="swBluetooth('${s.stand}')">🔵 Über Bluetooth abholen</button>
      ${v.ble ? `<p class="klein-t" style="margin-top:8px">${esc(v.ble)}</p>` : ''}</div>`;
  if (!swTimer) swAlle(10000, swVerbindenPruefen);
}
async function swVerbindenPruefen() {
  try {
    const n = await swAbruf(`/api/app/stand/${swVerb.stand}/neu?seit=${swVerb.start}`);
    Object.assign(swVerb, { uploads: n.uploads, neu: n.neu, zuletzt: n.zuletzt }); swFehler = '';
  } catch (e) { swFehler = e.message; }
  if (Date.now() - swVerb.start > 20 * 6e4) swStopp();      // nach 20 min nicht mehr nachfragen
  if (ansicht === 'stockwaage' && swAnsicht === 'verbinden') render();
}

// CRC32 wie zlib (gleich wie Master und Server)
const swCrcTafel = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function swCrc32(bytes) { let c = 0xFFFFFFFF; for (const b of bytes) c = swCrcTafel[(c ^ b) & 0xFF] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0); }

// Rohdaten per Bluetooth vom Master holen und zum Server weiterreichen; der Server unterschreibt, der Master prüft
async function swBluetooth(stand) {
  const melde = t => { swVerb.ble = t; if (swAnsicht === 'verbinden') render(); };
  let gerät;
  try {
    gerät = await navigator.bluetooth.requestDevice({ filters: [{ services: [SW_BLE.dienst] }] });
    melde('Verbinde …');
    const g = await gerät.gatt.connect(), d = await g.getPrimaryService(SW_BLE.dienst);
    const c = { info: await d.getCharacteristic(SW_BLE.info), anfrage: await d.getCharacteristic(SW_BLE.anfrage),
      daten: await d.getCharacteristic(SW_BLE.daten), status: await d.getCharacteristic(SW_BLE.status), best: await d.getCharacteristic(SW_BLE.best) };
    const text = async ch => new TextDecoder().decode(await ch.readValue());
    const info = Object.fromEntries((await text(c.info)).split(';').map(x => x.split('=')));
    if (info.stand !== stand) throw new Error(`Das ist Stand ${info.stand}, nicht ${stand}.`);
    let teile = [], ende = null, ok = null;
    c.daten.addEventListener('characteristicvaluechanged', e => teile.push(new Uint8Array(e.target.value.buffer.slice(0))));
    c.status.addEventListener('characteristicvaluechanged', e => { const t = new TextDecoder().decode(e.target.value); if (t.startsWith('ENDE')) ende = t; else ok = t; });
    await c.daten.startNotifications(); await c.status.startNotifications();
    const warte = async (f, ms) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 50)); return f(); };
    let gesamt = 0;
    for (const datei of ['roh', 'sensor']) {
      let pos = Number(info[datei + 'pos']) || 0;
      const groesse = Number(info[datei]) || 0;
      while (pos < groesse) {
        teile = []; ende = null;
        await c.anfrage.writeValue(new TextEncoder().encode(`${datei};${pos};8192`));
        if (!await warte(() => ende, 30000)) throw new Error('Master antwortet nicht');
        const [, laenge, crc] = ende.split(';');
        const stueck = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
        let o = 0; for (const t of teile) { stueck.set(t, o); o += t.length; }
        if (stueck.length !== Number(laenge) || swCrc32(stueck).toString(16).padStart(8, '0').toUpperCase() !== crc.toUpperCase()) continue;   // nochmal
        if (!stueck.length) break;
        const j = await swAbruf(`/api/app/stand/${stand}/rohdaten?datei=${datei}&von=${pos}&crc=${crc}`, { method: 'POST', body: stueck, kopf: { 'Content-Type': 'text/csv' } });
        ok = null;
        await c.best.writeValue(new TextEncoder().encode(`${datei};${j.bis};${j.quittung}`));
        await warte(() => ok, 10000);
        if (ok !== 'OK') throw new Error('Master lehnt die Bestätigung ab (' + ok + ')');
        pos = j.bis; gesamt += j.neu;
        melde(`📥 ${datei === 'roh' ? 'Völker' : 'Funk-Knoten'}: ${zahl(pos)} von ${zahl(groesse)} Byte · ${zahl(gesamt)} neue Werte`);
      }
    }
    melde(`✓ Fertig – ${zahl(gesamt)} neue Werte über Bluetooth.`);
  } catch (e) { melde('Bluetooth: ' + e.message); }
  finally { try { gerät?.gatt.disconnect(); } catch {} }
}

// ---------- Stand ----------
function swStandOeffnen(stand) { swStandAktiv = stand; swStandDaten = null; swAnsicht = 'stand'; swStopp(); render(); swStandLaden(); }
async function swStandLaden() {
  try {
    swStandDaten = (await swAbruf(`/api/app/stand/${swStandAktiv}/uebersicht`));
    swStandDaten.befehle = (await swAbruf(`/api/app/stand/${swStandAktiv}/befehle`)).befehle;
    swStandDaten.fw = await swAbruf(`/api/app/stand/${swStandAktiv}/firmware`).catch(() => null);
    swStandDaten.pakete = (await swAbruf('/api/app/firmware').catch(() => ({ firmware: [] }))).firmware;
    swFehler = '';
  }
  catch (e) { swFehler = e.message; swStandDaten = swStandDaten || { voelker: [], ereignisse: [], befehle: [] }; }
  if (ansicht === 'stockwaage' && swAnsicht === 'stand') render();
}
function swStandSeite() {
  const s = (swStaende || []).find(x => x.stand === swStandAktiv) || { stand: swStandAktiv };
  const d = swStandDaten, platz = db.standorte.find(o => o.waageStand === swStandAktiv);
  if (!d) { main().innerHTML = kopf(swName(s), swZurueck()) + '<p class="leise">Lade …</p>'; return; }
  const b = d.bericht, w = d.wetter;
  const optVolk = nr => `<select onchange="swZuordnen('${s.stand}',${nr},this.value)"><option value="">– Volk wählen –</option>${db.voelker.filter(v => v.status !== 'aufgelöst')
    .map(v => `<option value="${v.id}" ${v.waage?.stand === s.stand && v.waage?.nr === nr ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>`;
  const offen = (d.befehle || []).filter(x => !x.erledigt);
  main().innerHTML = kopf(swName(s), `${swZurueck()}<button onclick="swVerbindenStart('${s.stand}')">📶 Verbinden</button>
      <button onclick="swBefehl('bearbeitung',0,120,'Stand 2 h in Bearbeitung')">🛠 Bearbeitung 2 h</button>
      <button onclick="swBefehlFragen()">⚙ Befehl</button>`) +
    (swFehler ? `<ul class="hinweise"><li class="rot">${esc(swFehler)}</li></ul>` : '') +
    `<div class="raster">
      <div class="karte kachel"><b>${b?.gesamt_kg != null ? zahl(b.gesamt_kg, 1) + ' kg' : '–'}</b>Stand gesamt${b ? ' · ' + swVor(b.zeit) : ''}</div>
      <div class="karte kachel"><b>${b?.median_heute_kg != null ? (b.median_heute_kg > 0 ? '+' : '') + zahl(b.median_heute_kg, 2) + ' kg' : '–'}</b>heute je Volk (Mittel)${b?.voelker_im_flug != null ? ` · ${b.voelker_im_flug} fliegen` : ''}</div>
      <div class="karte kachel"><b>${b?.aussen_temp_c != null ? zahl(b.aussen_temp_c, 1) + ' °C' : '–'}</b>außen${b?.aussen_feuchte_pct != null ? ` · ${b.aussen_feuchte_pct} %` : ''}</div>
      <div class="karte kachel"><b>${b?.akku_v != null ? zahl(b.akku_v, 2) + ' V' : '–'}</b>Akku${b?.status?.lastabwurf ? ' · <span class="rot-t">Lastabwurf</span>' : ''}${b?.status?.bearbeitung ? ' · in Bearbeitung' : ''}</div>
      ${w ? `<div class="karte kachel"><b>${w.wind_ms != null ? zahl(w.wind_ms, 1) + ' m/s' : '–'}</b>Wind${w.richtung_grad != null ? ' aus ' + w.richtung_grad + '°' : ''} · Regen heute ${zahl(w.regen_heute_mm ?? 0, 1)} mm</div>` : ''}
    </div>
    <div class="karte" style="margin-top:12px"><label>Standplatz in der App
      <select onchange="swPlatz('${s.stand}',this.value)"><option value="">– keiner –</option>${db.standorte.map(o => `<option value="${o.id}" ${platz?.id === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
      <div class="klein-t leise">Mit Standplatz: Arbeitszeit-Start schaltet den Bearbeitungsmodus ein; das Trachtpotenzial zeigt die gemessene Zunahme.</div></div>
    ${swTaktKarte(d)}
    ${swEinstellKarte(d)}
    <h3>Völker</h3>` +
    tabelle(['Waage', 'Volk', 'Gewicht', 'Heute', 'Innen', 'Varroa', 'Messung', ''], d.voelker.map(v => [
      '<b>' + v.volk + '</b>' + (v.volk === 1 ? ' <span class="leise klein-t">Master</span>' : ''), optVolk(v.volk),
      v.gewicht_g != null ? zahl(v.gewicht_g / 1000, 1) + ' kg' : '–',
      v.heute_kg != null ? marke((v.heute_kg > 0 ? '+' : '') + zahl(v.heute_kg, 2) + ' kg', v.heute_kg < -0.8 ? 'rot' : v.heute_kg > 0.3 ? 'gruen' : '') : '–',
      v.t_innen != null ? zahl(v.t_innen, 1) + ' °C' : '–', v.bienen ? zahl(v.varroa / v.bienen * 1000, 1) + ' ‰' : '–',
      swVor(v.zeit * 1000), `<button class="klein" title="Verlauf" onclick="swVolkOeffnen('${s.stand}',${v.volk})">📈</button>
        <button class="klein" title="Kalibrieren" onclick="swKalibStart('${s.stand}',${v.volk})">⚖</button>`])) +
    '<h3>Ereignisse (3 Tage)</h3>' + swEreignisTabelle(d.ereignisse, s.stand) +
    (offen.length ? '<h3>Offene Befehle</h3>' + tabelle(['Seit', 'Befehl', 'Weg'], offen.map(x => [swVor(x.angelegt), esc(x.text || swBefehlText(x)), x.downlink ? 'Funk' : x.abgeholt ? 'abgeholt' : 'wartet auf Abgleich'])) : '') +
    swFirmwareKarte(d) +
    (d.status ? `<p class="leise klein-t">Gerät: Firmware ${esc(d.status.firmware)} · SF ${d.status.spreizfaktor ?? '–'} · SD ${d.status.sd_belegt_pct ?? '–'} % · Handy-Abgleich vor ${d.status.tage_seit_abgleich ?? '–'} Tagen</p>` : '');
}
const swBefehlText = x => ({ 1: x.wert ? `Bearbeitung ${x.wert} min` : 'Bearbeitung beenden', 2: x.wert ? `Messtakt ${x.wert} min` : 'Messtakt automatisch', 3: ['Kameras aus', 'Kameras an', 'Kameras automatisch'][x.wert],
  4: 'Tara', 5: 'Schwelle', 6: 'Neustart', 7: x.wert ? `Sendetakt ${x.wert} min` : 'Sendetakt automatisch',
  8: x.wert ? `Kalibrieren mit ${zahl(x.wert / 1000, 2)} kg` : 'Kalibrieren: Bezug',
  9: x.wert ? 'Varroa: durchgehend bei Flugbetrieb' : 'Varroa: Serie alle 5 min', 10: `Update starten (Paket ${x.wert})` })[x.art] + (x.volk && x.art !== 5 ? ` (Volk ${x.volk})` : '');

// ---------- Kameras und Schwarmvorhersage ----------
// Varroa-Kamera: Serie alle 5 min oder bei Flugbetrieb durchgehend (Befehl VARROA, ganzer Stand).
// Schwarmstimmung: der Master vergleicht den Summton (400–600 Hz) mit dem gelernten Normalwert des Volks; ist er mehrere
// Runden deutlich höher, meldet er „Schwarm in den nächsten Stunden möglich“ und schaltet das Volk in den Dauerbetrieb
// (jede Minute wiegen, Fluglochkamera durchgehend) – Empfindlichkeit und Dauer hier einstellbar (Schwellen 7 und 8).
const SW_TON = [[0, 'aus'], [130, 'empfindlich (+30 %)'], [150, 'normal (+50 %)'], [180, 'vorsichtig (+80 %)']];
function swLetzterWert(d, art, volk, standard) {     // zuletzt eingestellter Wert (neuester Befehl dieser Art)
  const b = (d.befehle || []).filter(x => x.art === art && (volk == null || x.volk === volk)).sort((a, b) => b.angelegt - a.angelegt)[0];
  return b ? { wert: b.wert, offen: !b.erledigt } : { wert: standard, offen: false };
}
function swEinstellKarte(d) {
  const va = swLetzterWert(d, 9, 0, 0), ton = swLetzterWert(d, 5, 7, 150), wache = swLetzterWert(d, 5, 8, 12);
  const offen = [va, ton, wache].some(x => x.offen) ? ' <span class="leise klein-t">(wartet auf den Master)</span>' : '';
  return `<div class="karte" style="margin-top:12px"><h4>🎥 Kameras und Schwarmvorhersage${offen}</h4>
    <div class="zeile"><label>Varroa-Aufnahme<select id="sw-varroa">
        <option value="0" ${va.wert === 0 ? 'selected' : ''}>Serie alle 5 min</option>
        <option value="1" ${va.wert === 1 ? 'selected' : ''}>durchgehend bei Flugbetrieb</option></select></label>
      <label>Schwarmvorhersage (Summton)<select id="sw-ton">${SW_TON.map(([w, t]) => `<option value="${w}" ${w === ton.wert ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>danach Dauerbetrieb<select id="sw-wache">${[6, 12, 24].map(h => `<option value="${h}" ${h === wache.wert ? 'selected' : ''}>${h} Stunden</option>`).join('')}</select></label>
      <button onclick="swEinstellSetzen()">Übernehmen</button></div>
    <div class="klein-t leise">Durchgehend: die Fluglochkamera nimmt Serie an Serie auf, solange geflogen wird (genauere Varroa-Zahlen,
      mehr Strom, mehr Speicher). Schwarmvorhersage: steigt der Summton eines Volks mehrere Runden deutlich über seinen Normalwert,
      kommt die Meldung „Schwarmstimmung“ und das Volk wird so lange jede Minute gewogen, die Fluglochkamera läuft durchgehend.
      Das Volk lernt seinen Normalwert in den ersten Tagen. Der Summton ist ein Hinweis, keine sichere Vorhersage.
      Kameras: Ereignis-Clips bleiben am Pi, bis sie hochgeladen sind; ab 80 % voller Speicherkarte kommt eine Meldung.</div></div>`;
}
async function swEinstellSetzen() {
  const va = Number($('#sw-varroa').value), ton = Number($('#sw-ton').value), wache = Number($('#sw-wache').value), d = swStandDaten;
  const neu = [];
  if (va !== swLetzterWert(d, 9, 0, 0).wert) neu.push({ art: 'varroa', volk: 0, wert: va, text: va ? 'Varroa durchgehend bei Flugbetrieb' : 'Varroa Serie alle 5 min' });
  if (ton !== swLetzterWert(d, 5, 7, 150).wert) neu.push({ art: 'schwelle', volk: 7, wert: ton, text: ton ? `Schwarmvorhersage ${SW_TON.find(x => x[0] === ton)[1]}` : 'Schwarmvorhersage aus' });
  if (wache !== swLetzterWert(d, 5, 8, 12).wert) neu.push({ art: 'schwelle', volk: 8, wert: wache, text: `Dauerbetrieb ${wache} h` });
  if (!neu.length) { alert('Nichts geändert.'); return; }
  if (!confirm(neu.map(x => x.text).join('\n') + '\n\nÜbernehmen?')) return;
  try {
    for (const b of neu) await swAbruf(`/api/app/stand/${swStandAktiv}/befehl`, { method: 'POST', body: JSON.stringify(b) });
    alert('Gespeichert. Der Master übernimmt es beim nächsten Handy-Abgleich oder per Funk nach dem nächsten Bericht.');
  } catch (e) { alert('Nicht gespeichert: ' + e.message); }
  swStandLaden();
}

// ---------- Mess- und Sendetakt ----------
// Messtakt = wie oft gewogen wird (Rohdaten, Auswertung), Sendetakt = wie oft der Standbericht über Funk geht.
// Der Sendetakt hat eine Untergrenze: TTN erlaubt 30 s Sendezeit am Tag; wie viel ein Bericht braucht, hängt vom
// Spreizfaktor (SF) ab, den das Netz wählt. Der Master hält die Grenze selbst ein – die App zeigt sie nur an.
const SW_MESS = [5, 10, 15, 20, 30, 60], SW_SENDE = [5, 10, 15, 20, 30, 40, 45, 60, 90, 120, 180, 240];
const swMin = m => m >= 60 && m % 60 === 0 ? `${m / 60} h` : `${m} min`;
function swTaktKarte(d) {
  const st = d.status || {}, g = d.sendegrenze || { kuerzester: {} };
  const mess = Number($('#sw-mess')?.value) || st.mess_takt_min || 15;
  const grenze = g.kuerzester[mess] || 240;
  const sende = SW_SENDE.filter(x => x % mess === 0 && x >= mess);
  const wahlS = Number($('#sw-sende')?.value) || st.sende_takt_min || grenze;
  return `<div class="karte" style="margin-top:12px"><h4>⏱ Mess- und Sendetakt</h4>
    <div class="zeile"><label>Messen alle<select id="sw-mess" onchange="render()">${SW_MESS.map(m => `<option value="${m}" ${m === mess ? 'selected' : ''}>${swMin(m)}</option>`).join('')}</select></label>
      <label>Bericht senden alle<select id="sw-sende">${sende.map(x => `<option value="${x}" ${x < grenze ? 'disabled' : ''} ${x === Math.max(wahlS, grenze) ? 'selected' : ''}>${swMin(x)}${x < grenze ? ' (zu oft)' : ''}</option>`).join('')}</select></label>
      <button onclick="swTaktSetzen()">Übernehmen</button></div>
    <div class="klein-t leise">Jetzt: messen ${st.mess_takt_min ? swMin(st.mess_takt_min) : '–'}, senden ${st.sende_takt_min ? swMin(st.sende_takt_min) : '–'} (laut Gerätestatus).
      Grenze bei ${g.sf ? 'SF ' + g.sf : 'unbekanntem SF (gerechnet mit SF 12)'}: höchstens alle <b>${swMin(grenze)}</b> ein Bericht
      – TTN erlaubt 30 s Sendezeit am Tag. Wird der Empfang schlechter (höherer SF), verlängert der Master den Sendetakt selbst.
      Alarme gehen immer sofort. Der Messtakt wechselt zur nächsten vollen Stunde; kürzer messen braucht mehr Strom.</div></div>`;
}
async function swTaktSetzen() {
  const mess = Number($('#sw-mess').value), sende = Number($('#sw-sende').value);
  if (!confirm(`Messen alle ${swMin(mess)}, Bericht alle ${swMin(sende)}?`)) return;
  try {
    await swAbruf(`/api/app/stand/${swStandAktiv}/befehl`, { method: 'POST', body: JSON.stringify({ art: 'takt', volk: 0, wert: mess, text: `Messtakt ${swMin(mess)}` }) });
    await swAbruf(`/api/app/stand/${swStandAktiv}/befehl`, { method: 'POST', body: JSON.stringify({ art: 'sendetakt', volk: 0, wert: sende, text: `Sendetakt ${swMin(sende)}` }) });
    swFehler = '';
    alert('Gespeichert. Der Master übernimmt es beim nächsten Handy-Abgleich oder per Funk nach dem nächsten Bericht.');
  } catch (e) { swFehler = e.message; }
  swStandLaden();
}

// ---------- Firmware-Update ----------
// Pakete (.swfw) entstehen am PC (firmware/werkzeuge/fw-paket.js packen) und sind dort unterschrieben – der Server und
// jede Waage nehmen nur Pakete mit der eigenen Unterschrift an. Ablauf am Stand: Master holt die freigegebene Version
// beim Handy-Abgleich, verteilt sie nach den Runden an je 8 Slaves/Knoten/Kameras, zuletzt an sich selbst. Läuft eine neue
// Version nicht, starten die Geräte von selbst wieder die alte. Pakete können auf Platinen-Revisionen begrenzt sein
// (z. B. „ab Rev C“); jede Waage kennt ihre Revision selbst (Kennungs-Teiler) und bekommt nur passende Pakete.
const SW_FW_ARTEN = { 1: 'Waage', 2: 'Knoten Wetter', 3: 'Knoten Mikrofon', 4: 'Kamera (Pi)' };
const swRevPasst = (rev, ab, bis) => (!ab && !bis) || (rev && (!ab || rev >= ab) && (!bis || rev <= bis));
const swVerZahl = v => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || ''); return m ? (+m[1] << 16) + (+m[2] << 8) + +m[3] : 0; };
function swFirmwareKarte(d) {
  const f = d.fw;
  if (!f) return '';
  const pakete = d.pakete || [];
  const zeilen = [1, 2, 3, 4].map(art => {
    const ziel = f.ziele.find(z => z.art === art), geraete = f.versionen.filter(v => v.art === art);
    const auswahl = pakete.filter(p => p.art === art);
    if (!geraete.length && !ziel && !auswahl.length) return '';
    const betroffen = ziel ? geraete.filter(v => swRevPasst(v.rev, ziel.ab, ziel.bis)) : [];
    const fertig = betroffen.filter(v => swVerZahl(v.version) >= swVerZahl(ziel.version)).length;
    const revs = art === 1 ? [...new Set(geraete.map(v => v.revText || 'Rev ?'))].join(', ') : '';
    return `<tr><td><b>${SW_FW_ARTEN[art]}</b>${revs ? `<div class="klein-t leise">${esc(revs)}</div>` : ''}</td>
      <td>${geraete.length ? [...new Set(geraete.map(v => v.version))].map(v => `${esc(v)} (${geraete.filter(x => x.version === v).length})`).join(', ') : '–'}</td>
      <td>${ziel ? `${esc(ziel.version)} · ${fertig}/${betroffen.length} fertig${ziel.ab || ziel.bis ? `<div class="klein-t leise">${esc(ziel.platinen)}</div>` : ''}
          <div class="klein-t">${ziel.gestartet ? (ziel.startAngekommen ? '▶ gestartet, Master hat es' : '▶ gestartet – wartet auf den Master') : '⏸ bereitgestellt, nicht gestartet'}</div>
          ${!ziel.gestartet && fertig < betroffen.length ? `<button class="klein haupt" onclick="swFwStarten(${art})">▶ Update starten</button>` : ''}` : '–'}</td>
      <td><select id="sw-fw-${art}"><option value="0">– keine bereitstellen –</option>${auswahl.map(p => `<option value="${p.id}" ${ziel?.id === p.id ? 'selected' : ''}>${esc(p.version)}${p.ab || p.bis ? ' · ' + esc(p.platinen) : ''} (${zahl(p.groesse / 1024, 0)} KB)</option>`).join('')}</select>
        <button class="klein" onclick="swFwFreigeben(${art})">Übernehmen</button></td></tr>`;
  }).join('');
  const wer = v => v.nr > 100 ? `Kamera an ${v.nr === 101 ? 'Master' : 'Waage ' + (v.nr - 100)}` : v.nr === 1 ? 'Master' : 'Nr. ' + v.nr;
  const meldungen = f.versionen.filter(v => v.meldung || v.gesperrt)
    .map(v => `<li>${wer(v)}: ${esc(v.meldung || '')}${v.gesperrt ? ` (Version ${esc(v.gesperrt)} gesperrt – lief dort nicht)` : ''}</li>`).join('');
  return `<h3>Firmware</h3><div class="karte"><div class="tw"><table><tr><th>Gerät</th><th>läuft (Anzahl)</th><th>bereitgestellt</th><th>Version wählen</th></tr>${zeilen ||
      '<tr><td colspan="4" class="leise">Noch keine Versionen gemeldet (kommen beim nächsten Handy-Abgleich).</td></tr>'}</table></div>
    ${meldungen ? `<ul class="klein-t">${meldungen}</ul>` : ''}
    ${swZugangZeile(f.versionen)}
    <div class="zeile" style="margin-top:8px"><label>Neues Paket (.swfw)<input type="file" accept=".swfw" id="sw-fw-datei"></label>
      <button onclick="swFwHochladen()">⬆ Hochladen</button></div>
    <div class="klein-t leise">Zwei Schritte: <b>Übernehmen</b> stellt die Version bereit – der Master lädt sie beim nächsten Abgleich
      (Handy-Hotspot, festes WLAN oder Modem) auf seine Speicherkarte, spielt aber nichts ein. Erst <b>▶ Update starten</b> gibt sie frei
      – egal, ob die Waage über LoRaWAN, Modem, WLAN oder Hotspot verbunden ist. Dann je Runde bis zu 8 Geräte, der Master zuletzt.
      Nur bei vollem Akku (kein Lastabwurf). Läuft eine Version nicht, schalten die Geräte selbst zurück.</div></div>`;
}
// Kameras bekommen Hotspots, Server-Adresse und ihren Schlüssel vom Master (über das Kabel ihrer Waage)
function swZugangZeile(versionen) {
  const kam = versionen.filter(v => v.nr > 100 && v.zugang != null);
  if (!kam.length) return '';
  const alt = kam.filter(v => v.zugang !== 1).map(v => v.nr === 101 ? 'Master' : 'Waage ' + (v.nr - 100));
  return `<div class="klein-t" style="margin-top:6px">📶 Kamera-Zugang (Hotspots, Server, Schlüssel): <b>${kam.length - alt.length} von ${kam.length}</b> aktuell${alt.length
    ? ` – noch offen: ${esc(alt.join(', '))} <span class="leise">(kommt automatisch mit den nächsten Runden, solange die Kamera Strom hat)</span>` : ''}</div>`;
}
async function swFwHochladen() {
  const datei = $('#sw-fw-datei')?.files?.[0];
  if (!datei) { alert('Zuerst eine .swfw-Datei wählen (firmware/pakete am PC).'); return; }
  try {
    const r = await swAbruf(`/api/app/firmware?name=${encodeURIComponent(datei.name)}`, { method: 'POST', body: await datei.arrayBuffer(), kopf: { 'Content-Type': 'application/octet-stream' } });
    alert(`${SW_FW_ARTEN[r.art]} ${r.version} (${r.platinen}) ${r.schon ? 'war schon da' : 'hochgeladen'} – Unterschrift gültig. Jetzt bei „Version wählen“ übernehmen.`);
  } catch (e) { alert('Nicht angenommen: ' + e.message); }
  swStandLaden();
}
// Update starten: Befehl an den Master – erst dann verteilt er das bereitgestellte Paket
async function swFwStarten(art) {
  const ziel = swStandDaten.fw?.ziele.find(z => z.art === art);
  if (!ziel || !confirm(`${SW_FW_ARTEN[art]}: Update auf ${ziel.version} jetzt starten?\nDie Geräte spielen es in den nächsten Runden ein.`)) return;
  try {
    const r = await swAbruf(`/api/app/stand/${swStandAktiv}/fwstart`, { method: 'POST', body: JSON.stringify({ art }) });
    alert(r.ttn ? 'Gestartet – der Befehl geht über LoRaWAN zum Master.' : 'Gestartet – der Master holt den Befehl beim nächsten Abgleich (Modem, WLAN oder Hotspot).');
  } catch (e) { alert('Nicht gestartet: ' + e.message); }
  swStandLaden();
}
async function swFwFreigeben(art) {
  const id = Number($('#sw-fw-' + art).value), p = (swStandDaten.pakete || []).find(x => x.id === id);
  let frage = p ? `${SW_FW_ARTEN[art]}: Version ${p.version} an diesem Stand bereitstellen?\n(Eingespielt wird erst nach „Update starten“.)`
                : `${SW_FW_ARTEN[art]}: keine Version mehr bereitstellen?`;
  if (p && (p.ab || p.bis)) {
    const geraete = (swStandDaten.fw?.versionen || []).filter(v => v.art === art), passend = geraete.filter(v => swRevPasst(v.rev, p.ab, p.bis));
    frage += `\nGilt für ${p.platinen}: ${passend.length} von ${geraete.length} Geräten passen.`;
    if (!passend.length) frage = `⚠ Version ${p.version} gilt für ${p.platinen} – keine Waage an diesem Stand passt dazu, sie wird nirgends eingespielt.\nTrotzdem freigeben?`;
  }
  if (!confirm(frage)) return;
  try { await swAbruf(`/api/app/stand/${swStandAktiv}/firmware`, { method: 'POST', body: JSON.stringify({ art, id }) }); }
  catch (e) { alert('Nicht übernommen: ' + e.message); }
  swStandLaden();
}

// ---------- Waage kalibrieren (mit Prüfgewicht, das Volk darf daraufbleiben) ----------
// Schritt 1: Bearbeitung für das Volk + Bezug merken · Schritt 2: Prüfgewicht auflegen, Gewicht eingeben ·
// Ergebnis kommt mit dem nächsten Datensatz (Status-Bit) über den Handy-Abgleich. Je Schritt bis zu einer Messrunde.
let swKal = null;
function swKalibStart(stand, nr) {
  swKal = { stand, nr, schritt: 0, gramm: '' };
  swAnsicht = 'kalib'; render();
}
function swKalibSeite() {
  const k = swKal, v = swVolkVon(k.stand, k.nr);
  const titel = `Waage ${k.nr}${v ? ' · ' + esc(v.name) : ''} kalibrieren`;
  const zurueck = `<button onclick="swKalibAbbrechen()">← Zurück</button>`;
  const fehler = swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : '';
  let inhalt;
  if (k.schritt === 0) inhalt = `<div class="karte"><h4>Vorbereiten</h4><ol>
      <li>Ein <b>genau bekanntes Prüfgewicht</b> bereitlegen: mindestens 2 kg, besser 10–20 kg (z. B. Wasserkanister, vorher auf einer guten Waage gewogen).</li>
      <li>Am besten am Abend, wenn kaum Bienen fliegen – sonst verfälscht der Flug das Ergebnis.</li>
      <li><b>Handy-Hotspot einschalten</b> und beim Stand bleiben: der Master gleicht dann jede Runde ab (bis zu ${swMin(swStandDaten?.status?.mess_takt_min || 15)} je Schritt).</li>
      <li>Am Volk nichts verändern, bis „Fertig“ kommt. Das Volk bekommt dafür 60 min Bearbeitungsmodus (keine Fehlalarme).</li></ol>
      <button class="haupt" onclick="swKalibSchritt1()">Schritt 1: Bezug messen</button></div>`;
  else if (k.schritt === 1) inhalt = `<div class="karte"><h4>Schritt 1 läuft</h4>${k.erledigt ? '✅ Bezug gemessen.' : '⏳ Warte, bis der Master den Befehl abholt und die Waage misst …'}
      ${k.erledigt ? `<p>Jetzt das <b>Prüfgewicht auflegen</b> (gut mittig auf den Deckel) und sein Gewicht eingeben:</p>
      <div class="zeile"><label>Prüfgewicht (g)<input id="sw-kal-g" type="number" min="2000" max="200000" step="1" value="${esc(k.gramm)}" placeholder="z. B. 20000"></label>
      <button class="haupt" onclick="swKalibSchritt2()">Schritt 2: mit Prüfgewicht messen</button></div>` : ''}</div>`;
  else if (k.schritt === 2) inhalt = `<div class="karte"><h4>Schritt 2 läuft</h4>${k.ergebnis === 'ok'
      ? `✅ <b>Kalibrierung übernommen.</b> Die Waage zeigt jetzt ${k.gewicht != null ? zahl(k.gewicht / 1000, 2) + ' kg' : '–'} (mit Prüfgewicht).
         <p>Prüfgewicht wieder abnehmen, dann „Fertig“.</p><button class="haupt" onclick="swKalibFertig()">Fertig</button>`
      : k.ergebnis === 'abgelehnt'
      ? `❌ <b>Abgelehnt</b> – der gemessene Unterschied passt nicht zum Prüfgewicht (nicht aufgelegt, Waage bewegt, Gewicht falsch eingegeben oder mehr als 6 h seit Schritt 1). Der alte Wert bleibt.
         <div class="zeile" style="margin-top:8px"><button onclick="swKal.schritt=0;swKal.erledigt=false;render()">Neu beginnen</button><button onclick="swKalibFertig()">Abbrechen</button></div>`
      : '⏳ Warte auf die Messung mit Prüfgewicht und das Ergebnis vom Master …'}</div>`;
  main().innerHTML = kopf(titel, zurueck) + fehler + inhalt +
    '<p class="leise klein-t">Die Tara (Nullpunkt) bleibt dabei unverändert. Nur bei leerer Waage: „⚙ Befehl → Tara“.</p>';
  if (k.schritt === 1 && !k.erledigt || k.schritt === 2 && !k.ergebnis) swAlle(20000, swKalibPruefen);
  else swStopp();
}
async function swKalibBefehl(art, wert, text) {
  return (await swAbruf(`/api/app/stand/${swKal.stand}/befehl`, { method: 'POST', body: JSON.stringify({ art, volk: swKal.nr, wert, text }) })).id;
}
async function swKalibSchritt1() {
  try {
    await swKalibBefehl('bearbeitung', 60, `Volk ${swKal.nr}: Kalibrieren`);
    swKal.id1 = await swKalibBefehl('kalibrieren', 0, `Kalibrieren Waage ${swKal.nr}: Bezug`);
    swKal.schritt = 1; swKal.erledigt = false; swFehler = '';
  } catch (e) { swFehler = e.message; }
  render();
}
async function swKalibSchritt2() {
  const g = Math.round(Number($('#sw-kal-g').value));
  swKal.gramm = g || '';
  if (!(g >= 2000 && g <= 200000)) { alert('Prüfgewicht zwischen 2 000 und 200 000 g eingeben.'); return; }
  if (!confirm(`Liegt das Prüfgewicht (${zahl(g / 1000, 3)} kg) jetzt auf Waage ${swKal.nr}?`)) return;
  try {
    swKal.seit = Math.floor(Date.now() / 1000);
    await swKalibBefehl('kalibrieren', g, `Kalibrieren Waage ${swKal.nr}: ${zahl(g / 1000, 3)} kg`);
    swKal.schritt = 2; swKal.ergebnis = null; swFehler = '';
  } catch (e) { swFehler = e.message; }
  render();
}
async function swKalibPruefen() {
  const k = swKal;
  try {
    if (k.schritt === 1) {
      const b = (await swAbruf(`/api/app/stand/${k.stand}/befehle`)).befehle;
      k.erledigt = !!b.find(x => x.id === k.id1)?.erledigt;
    } else if (k.schritt === 2) {
      const r = await swAbruf(`/api/app/stand/${k.stand}/kalibrierung?volk=${k.nr}&seit=${k.seit - 60}`);
      k.ergebnis = r.ergebnis; k.gewicht = r.letzte?.gewicht_g;
    }
    swFehler = '';
  } catch (e) { swFehler = e.message; }
  if (ansicht === 'stockwaage' && swAnsicht === 'kalib') render();
}
async function swKalibFertig() {
  try { await swKalibBefehl('bearbeitung', 0, `Volk ${swKal.nr}: Kalibrieren fertig`); } catch {}
  swKalibAbbrechen();
}
function swKalibAbbrechen() { swStopp(); const st = swKal?.stand; swKal = null; swStandOeffnen(st || swStandAktiv); }

function swEreignisTabelle(liste, stand) {
  if (!liste?.length) return '<p class="leise klein-t">Keine.</p>';
  return tabelle(['Zeit', 'Volk', 'Ereignis', ''], liste.map(e => {
    const v = swVolkVon(stand, e.volk);
    const titel = `${SW_ARTEN[e.art] || e.artname || ''} ${e.volk ? 'Volk ' + e.volk : ''}`;
    const clips = e.clips || (e.clip ? [e.clip] : []);
    const video = clips.length ? clips.map(c => `<button class="klein" title="Video ${c.quelle === 'flugloch' ? 'vom Flugloch' : 'der Übersichtskamera'}" onclick="swVideo('${esc(c.url)}','${esc(titel)}',${e.zeit},'${c.quelle || ''}')">▶ ${c.quelle === 'flugloch' ? 'Flugloch' : 'Übersicht'}</button> `).join('')
      : e.clip_erwartet ? '<span class="leise klein-t" title="Die Kameras laden beim nächsten Handy-Abgleich am Stand hoch">🎥 beim nächsten Besuch</span> ' : '';
    return [new Date(e.zeit * 1000).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      e.volk ? (v ? esc(v.name) : e.volk) : 'Stand', (e.alarm ? '🚨 ' : '') + esc(SW_ARTEN[e.art] || e.artname || e.art) + (e.wert === 0 && !e.alarm ? ' <span class="leise">– vorbei</span>' : ''),
      video + (v && !e.uebernommen ? `<button class="klein" onclick="swUebernehmen(${e.id},'${stand}')">→ Stockführung</button>` : e.uebernommen ? '<span class="leise klein-t">übernommen</span>' : '')];
  }));
}

// Video der Übersichtskamera (Ereignis-Clip: 30 s vor bis 60 s nach dem Ereignis) in einem eigenen Fenster.
// Der Link ist vom Server unterschrieben und einige Stunden gültig – deshalb ohne Anmeldung abspielbar.
function swVideo(url, titel, zeit, quelle) {
  swVideoZu();
  const w = document.createElement('div');
  w.id = 'sw-video';
  w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px';
  w.onclick = ev => { if (ev.target === w) swVideoZu(); };
  w.innerHTML = `<div style="width:100%;max-width:900px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:8px;gap:8px">
      <span>${esc(titel)} · ${new Date(zeit * 1000).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      <button class="klein" onclick="swVideoZu()">✕ Schließen</button></div>
    <video controls playsinline autoplay preload="metadata" style="width:100%;max-width:900px;max-height:80vh;background:#000" src="${esc(swKonto().server + url)}"></video>
    <div class="klein-t" style="color:#ccc;margin-top:6px">${quelle === 'flugloch' ? 'Fluglochkamera: ab dem Alarm, 90 s' : 'Übersichtskamera: 30 s vor dem Ereignis bis 60 s danach'}</div>`;
  w.querySelector('video').onerror = () => { w.querySelector('.klein-t').textContent = 'Video nicht abspielbar – Link abgelaufen oder Server nicht erreichbar. Seite neu laden.'; };
  document.body.appendChild(w);
}
function swVideoZu() { document.getElementById('sw-video')?.remove(); }

function swZuordnen(stand, nr, volkId) {
  for (const v of db.voelker) if (v.waage?.stand === stand && v.waage?.nr === nr) delete v.waage;
  const v = volk(volkId);
  if (v) v.waage = { stand, nr };
  speichern(); render();
}
function swPlatz(stand, standortId) {
  for (const o of db.standorte) if (o.waageStand === stand) delete o.waageStand;
  const o = db.standorte.find(x => x.id === standortId);
  if (o) o.waageStand = stand;
  speichern(); render();
  // mit Einwilligung „GPS-Standort“ die Lage gleich an den Server (ohne Einwilligung lehnt er ab – dann still nichts)
  if (o && hatKoord(o)) swAbruf(`/api/app/stand/${stand}/ort`, { method: 'POST', body: JSON.stringify({ lat: o.lat, lon: o.lon }) }).catch(() => {});
}

async function swBefehl(art, volkNr, wert, text, stand = swStandAktiv) {
  try {
    const j = await swAbruf(`/api/app/stand/${stand}/befehl`, { method: 'POST', body: JSON.stringify({ art, volk: volkNr, wert, text }) });
    swFehler = '';
    if (ansicht === 'stockwaage') alert(`Befehl gespeichert. Er geht ${j.ttn ? 'per Funk nach dem nächsten Bericht oder ' : ''}beim nächsten Handy-Abgleich an den Master.`);
  } catch (e) { swFehler = e.message; }
  if (ansicht === 'stockwaage' && swAnsicht === 'stand') swStandLaden();
}
function swBefehlFragen() {
  const w = prompt('Befehl an den Stand:\n1 = Bearbeitung beenden\n2 = Kameras aus\n3 = Kameras an\n4 = Kameras automatisch\n5 = Takt automatisch (messen 15 min, senden so oft wie erlaubt)\n6 = Waage kalibrieren (Nummer folgt)\n7 = Volk leer → Tara (Nummer folgt)');
  if (!w) return;
  if (w === '1') swBefehl('bearbeitung', 0, 0, 'Bearbeitung beenden');
  if (w === '2') swBefehl('kamera', 0, 0, 'Kameras aus');
  if (w === '3') swBefehl('kamera', 0, 1, 'Kameras an');
  if (w === '4') swBefehl('kamera', 0, 2, 'Kameras automatisch');
  if (w === '5') { swBefehl('takt', 0, 0, 'Messtakt automatisch'); swBefehl('sendetakt', 0, 0, 'Sendetakt automatisch'); }
  if (w === '6') { const nr = Number(prompt('Waagen-Nummer:')); if (nr >= 1 && nr <= 30) swKalibStart(swStandAktiv, nr); }
  if (w === '7') {
    const nr = Number(prompt('Waagen-Nummer (nur wenn die Waage gerade LEER ist!):'));
    if (nr >= 1 && nr <= 30 && confirm(`Waage ${nr} wirklich auf 0 setzen? Nur wenn nichts darauf steht.`)) swBefehl('tara', nr, 0, `Tara Waage ${nr}`);
  }
}

// Ereignis als Eintrag in die Stockführung (zählt nicht als Durchsicht)
async function swUebernehmen(id, stand) {
  const e = (swStandDaten?.ereignisse || []).concat(swVolkDaten?.ereignisse || []).find(x => x.id === id);
  const v = e && swVolkVon(stand, e.volk);
  if (!v) return;
  const text = `Waage: ${SW_ARTEN[e.art] || e.artname}${e.art === 1 && e.wert ? ` (${zahl(e.wert / 10, 1)} kg)` : ''}`;
  if (!confirm(`In die Stockführung von ${v.name} eintragen?\n„${text}“`)) return;
  db.durchsichten.push({ id: uid(), volkId: v.id, datum: swDatum(e.zeit).slice(0, 10), notiz: text, quelle: 'waage' });
  speichern();
  try { await swAbruf(`/api/app/ereignis/${id}/uebernommen`, { method: 'POST', body: '{}' }); e.uebernommen = Date.now(); } catch {}
  render();
}

// Kurve wie kurve() in zusatz.js, aber mit Uhrzeit (Punkte {t: ms, wert}) – für den Stundenverlauf
function swKurve(titel, punkte, farbe, einheit, abNull) {
  punkte = punkte.filter(p => p.wert != null && p.t).sort((a, b) => a.t - b.t);
  if (punkte.length < 2) return '';
  const t0 = punkte[0].t, t1 = punkte[punkte.length - 1].t, werte = punkte.map(p => p.wert);
  let lo = abNull ? 0 : Math.min(...werte), hi = Math.max(...werte); if (hi === lo) hi = lo + 1;
  const xy = p => [(12 + (p.t - t0) / (t1 - t0 || 1) * 276).toFixed(1), (92 - (p.wert - lo) / (hi - lo) * 72).toFixed(1)];
  const tag = t => new Date(t).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
  const wann = t => new Date(t).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `<div class="karte"><h4>${titel}</h4><svg viewBox="0 0 300 112" style="width:100%">
    <line x1="12" x2="288" y1="92" y2="92" stroke="#e6dcc4"/><line x1="12" x2="288" y1="20" y2="20" stroke="#e6dcc4" stroke-dasharray="3 3"/>
    <polyline fill="none" stroke="${farbe}" stroke-width="2" points="${punkte.map(p => xy(p).join(',')).join(' ')}"/>
    ${punkte.length <= 60 ? punkte.map(p => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="2.2" fill="${farbe}"><title>${wann(p.t)}: ${zahl(p.wert)} ${einheit}</title></circle>`; }).join('') : ''}
    <text x="12" y="14" font-size="9" fill="#7a6f5a">${zahl(hi)} ${einheit}</text><text x="12" y="88" font-size="9" fill="#7a6f5a">${zahl(lo)}</text>
    <text x="12" y="106" font-size="9" fill="#7a6f5a">${tag(t0)}</text><text x="288" y="106" font-size="9" fill="#7a6f5a" text-anchor="end">${tag(t1)}</text></svg>
    <div class="klein-t">Zuletzt: <b>${zahl(werte[werte.length - 1])} ${einheit}</b></div></div>`;
}

// ---------- Verlauf je Volk ----------
function swVolkOeffnen(stand, nr) { swStandAktiv = stand; swVolkAktiv = nr; swVolkDaten = null; swAnsicht = 'volk'; render(); swVolkLaden(); }
async function swVolkLaden() {
  const jetzt = Math.floor(Date.now() / 1000), von = jetzt - swVolkTage * 86400, st = swStandAktiv, nr = swVolkAktiv;
  try {
    const stufe = swVolkTage <= 7 ? 'stunde' : 'tag';
    const [v, t, e, c] = await Promise.all([
      swAbruf(`/api/app/stand/${st}/verlauf?volk=${nr}&von=${von}&bis=${jetzt}&stufe=${stufe}`),
      swAbruf(`/api/app/stand/${st}/tageswerte?volk=${nr}&von=${swDatum(von).slice(0, 10)}&bis=${swDatum(jetzt).slice(0, 10)}`),
      swAbruf(`/api/app/stand/${st}/ereignisse?volk=${nr}&seit=${von}`),
      swAbruf(`/api/app/stand/${st}/clips?volk=${nr}&seit=${von}`).catch(() => ({ clips: [] }))]);
    swVolkDaten = { werte: v.werte, tage: t.tage, ereignisse: e.ereignisse, clips: c.clips }; swFehler = '';
  } catch (e) { swFehler = e.message; swVolkDaten = { werte: [], tage: [], ereignisse: [], clips: [] }; }
  if (ansicht === 'stockwaage' && swAnsicht === 'volk') render();
}
function swVolkSeite() {
  const v = swVolkVon(swStandAktiv, swVolkAktiv), d = swVolkDaten;
  const titel = `Waage ${swVolkAktiv}${v ? ' · ' + esc(v.name) : ''}`;
  const auswahl = [7, 30, 90, 365].map(t => `<button class="${t === swVolkTage ? 'haupt' : ''}" onclick="swVolkTage=${t};swVolkLaden()">${t === 365 ? '1 Jahr' : t + ' Tage'}</button>`).join('');
  if (!d) { main().innerHTML = kopf(titel, swZurueck('stand')) + '<p class="leise">Lade …</p>'; return; }
  const p = k => d.werte.map(w => ({ t: w.zeit * 1000, wert: w[k] == null ? null : (k === 'gewicht_g' ? w[k] / 1000 : w[k]) }));
  main().innerHTML = kopf(titel, swZurueck('stand') + (v ? `<button onclick="detailVolk='${v.id}';gehe('voelker')">Stockkarte</button>` : '') +
      `<button onclick="swBefehl('bearbeitung',${swVolkAktiv},120,'Volk ${swVolkAktiv} 2 h in Bearbeitung')">🛠 Bearbeitung 2 h</button>
       <button onclick="swKalibStart(swStandAktiv,swVolkAktiv)">⚖ Kalibrieren</button>`) +
    `<div class="zeile" style="margin-bottom:10px">${auswahl}</div>` + (swFehler ? `<p class="rot-t">${esc(swFehler)}</p>` : '') +
    `<div class="raster">${swKurve('Gewicht', p('gewicht_g'), '#a87400', 'kg') || '<div class="karte leise">Noch zu wenig Werte.</div>'}
      ${kurve('Zunahme je Tag', d.tage.map(t => ({ datum: t.tag, wert: t.aenderung_kg })), '#3d8b40', 'kg')}
      ${swKurve('Innentemperatur', p('t_innen'), '#c0392b', '°C')}${swKurve('Brut-Temperatur', p('t_brut'), '#e67e22', '°C')}
      ${swKurve('Summen', p('summ_hz'), '#2563eb', 'Hz')}
      ${kurve('Milben je 1000 Bienen', d.tage.map(t => ({ datum: t.tag, wert: t.milben_je_1000 })), '#8e2318', '‰', true)}</div>
    <h3>Ereignisse</h3>${swEreignisTabelle(d.ereignisse, swStandAktiv)}` +
    (d.clips?.length ? '<h3>Videos der Übersichtskamera</h3>' + tabelle(['Zeit', 'Ereignis', ''], d.clips.map(c => [
      new Date((c.ereignis_zeit || c.zeit) * 1000).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      esc(SW_ARTEN[c.ereignis_art] || 'Aufnahme') + ` <span class="leise klein-t">${c.quelle === 'flugloch' ? 'Flugloch' : 'Übersicht'}</span>`,
      `<button class="klein" onclick="swVideo('${esc(c.url)}','${esc(SW_ARTEN[c.ereignis_art] || 'Aufnahme')} Volk ${swVolkAktiv}',${c.ereignis_zeit || c.zeit},'${c.quelle || ''}')">▶ Video</button>`])) : '');
}

// Waagen-Karte in der Stockkarte (zeigeVolk in app.js): Platzhalter, wird nachgeladen
function swStockkarte(v) {
  if (!v.waage || !swKonto().token) return '';
  setTimeout(async () => {
    const el = document.getElementById('sw-stockkarte');
    if (!el) return;
    try {
      const heute = new Date().toISOString().slice(0, 10), von = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const [t, e] = await Promise.all([swAbruf(`/api/app/stand/${v.waage.stand}/tageswerte?volk=${v.waage.nr}&von=${von}&bis=${heute}`),
        swAbruf(`/api/app/stand/${v.waage.stand}/ereignisse?volk=${v.waage.nr}&seit=${Math.floor(Date.now() / 1000) - 60 * 86400}`)]);
      swVolkDaten = { werte: [], tage: t.tage, ereignisse: e.ereignisse };
      const neu = e.ereignisse.filter(x => !x.uebernommen && x.wert !== 0).slice(0, 5);
      el.innerHTML = '<h3>Waage (60 Tage)</h3><div class="raster">' +
        (kurve('Gewicht', t.tage.map(x => ({ datum: x.tag, wert: x.gewicht_kg })), '#a87400', 'kg') || '<div class="karte leise">Noch zu wenig Werte.</div>') +
        kurve('Zunahme je Tag', t.tage.map(x => ({ datum: x.tag, wert: x.aenderung_kg })), '#3d8b40', 'kg') +
        kurve('Milben je 1000 Bienen', t.tage.map(x => ({ datum: x.tag, wert: x.milben_je_1000 })), '#8e2318', '‰', true) + '</div>' +
        (neu.length ? '<h4>Neue Ereignisse der Waage</h4>' + swEreignisTabelle(neu, v.waage.stand) : '') +
        `<button class="klein" onclick="swVolkOeffnen('${v.waage.stand}',${v.waage.nr});gehe('stockwaage')">Mehr …</button>`;
    } catch (err) { el.innerHTML = `<p class="leise klein-t">Waage: ${esc(err.message)}</p>`; }
  });
  return '<div id="sw-stockkarte"><p class="leise klein-t">Waage wird geladen …</p></div>';
}

// Trachtpotenzial (ertrag.js): gemessene Zunahme der Saison an diesem Standplatz (Mittel der zugeordneten Völker)
function swTracht(standort, jahr) {
  if (!standort?.waageStand || !swKonto().token) return '';
  const voelker = db.voelker.filter(v => v.waage?.stand === standort.waageStand);
  if (!voelker.length) return '';
  setTimeout(async () => {
    const el = document.getElementById('sw-tracht');
    if (!el) return;
    try {
      const summen = await Promise.all(voelker.map(async v => (await swAbruf(`/api/app/stand/${standort.waageStand}/tageswerte?volk=${v.waage.nr}&von=${jahr}-03-01&bis=${jahr}-09-30`))
        .tage.reduce((s, t) => s + Math.max(0, t.aenderung_kg || 0), 0)));
      const mittel = summen.reduce((a, b) => a + b, 0) / summen.length;
      el.innerHTML = `<div class="karte kachel"><b>${zahl(mittel, 1)} kg</b>gemessene Tageszunahmen ${jahr} je Volk (Waage, März–September, ${voelker.length} ${voelker.length === 1 ? 'Volk' : 'Völker'})</div>`;
    } catch { el.innerHTML = ''; }
  });
  return '<div id="sw-tracht"></div>';
}

// Arbeitszeit (arbeit.js): Start am Standplatz mit Waage → Bearbeitungsmodus 2 h, Ende → beenden
function swArbeit(standortId, an) {
  const o = db.standorte.find(x => x.id === standortId);
  if (!o?.waageStand || !swKonto().token) return;
  swAbruf(`/api/app/stand/${o.waageStand}/befehl`, { method: 'POST', body: JSON.stringify({ art: 'bearbeitung', volk: 0, wert: an ? 120 : 0, text: an ? 'Arbeitszeit läuft' : 'Arbeitszeit beendet' }) }).catch(() => {});
}

// ---------- Push ----------
async function swPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return alert('Dieser Browser kann keine Push-Meldungen. iPhone: die App zum Home-Bildschirm hinzufügen und von dort öffnen (iOS 16.4+).');
  try {
    const reg = await navigator.serviceWorker.ready;
    const alt = await reg.pushManager.getSubscription();
    if (alt && !confirm('Meldungen sind eingeschaltet. Test senden? (Abbrechen = ausschalten)')) {
      await swAbruf('/api/app/push/abbestellen', { method: 'POST', body: JSON.stringify({ endpoint: alt.endpoint }) });
      await alt.unsubscribe();
      return alert('Meldungen ausgeschaltet.');
    }
    if (!alt) {
      if (await Notification.requestPermission() !== 'granted') return alert('Ohne Erlaubnis keine Meldungen.');
      const k = (await swAbruf('/api/app/push/schluessel')).schluessel;
      const roh = atob(k.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - k.length % 4) % 4));
      const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(roh, c => c.charCodeAt(0)) });
      await swAbruf('/api/app/push/abo', { method: 'POST', body: JSON.stringify(abo) });
    }
    await swAbruf('/api/app/push/test', { method: 'POST', body: '{}' });
    alert('Meldungen eingeschaltet – eine Testmeldung ist unterwegs.');
  } catch (e) { alert('Meldungen: ' + e.message); }
}

// Aus einer Push-Meldung geöffnet (./#stockwaage) → gleich auf die Seite
window.addEventListener('load', () => { if (location.hash === '#stockwaage' && typeof gehe === 'function') { history.replaceState(null, '', location.pathname); gehe('stockwaage'); } });

// ---------- Daten teilen, Karte, Konto, Betreiber (Server für viele Kunden) ----------
// Jede Stufe ist eine eigene Einwilligung: Text lesen, Häkchen „gelesen und einverstanden“, dann Erlauben. Widerruf jederzeit.
// Standort und Ertrag schickt die App nur mit der jeweiligen Einwilligung an den Server (Standplätze mit Waage).
let swTeilen = null, swKarteDaten = null, swBetrieb = null, swKarteObj = null;
const swSeite = was => { swAnsicht = was; swFehler = ''; swTeilen = swKarteDaten = swBetrieb = null; swStopp(); render(); };
const swFehlerZeile = () => swFehler ? `<ul class="hinweise"><li class="rot">${esc(swFehler)}</li></ul>` : '';
const swZeit = ms => ms ? new Date(ms).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' }) : '';

async function swNeuLaden(fn) {
  try { await fn(); swFehler = ''; } catch (e) { swFehler = e.message; }
  if (ansicht === 'stockwaage') render();
}

function swTeilenSeite() {
  main().innerHTML = kopf('Daten teilen', swZurueck()) + swFehlerZeile() +
    `<p class="klein-t leise" style="max-width:680px">Freiwillig und jederzeit widerrufbar. Ohne Freigabe funktioniert die Waage genauso.
      Deine Daten sieht sonst niemand – auch der Betreiber des Servers nicht. Genaueres:
      <a href="#" onclick="swDatenschutz();return false">Datenschutzerklärung</a>.</p>` +
    (swTeilen == null ? '<p class="leise">Lade …</p>' : swTeilen.map(f => {
      const fehlt = f.braucht.filter(b => !swTeilen.find(x => x.stufe === b)?.aktiv).map(b => swTeilen.find(x => x.stufe === b)?.titel);
      return `<div class="karte" style="max-width:680px;margin-bottom:10px"><h4>${f.aktiv ? '✅' : '⬜'} ${esc(f.titel)}</h4>
        <p class="klein-t">${esc(f.text)}</p>
        ${f.aktiv ? `<div class="klein-t leise">Erlaubt am ${swZeit(f.erteilt)}</div>
            <button style="margin-top:6px" onclick="swFreigabe('${f.stufe}',false)">Widerrufen</button>
            ${f.stufe === 'standort' ? `<button style="margin-top:6px" onclick="swOrteSenden(true)">📍 Standorte jetzt übertragen</button>` : ''}
            ${f.stufe === 'ertrag' ? `<button style="margin-top:6px" onclick="swErtragSenden(true)">🍯 Ertragsdaten jetzt übertragen</button>` : ''}`
          : fehlt.length ? `<div class="klein-t leise">Zuerst „${esc(fehlt.join('“, „'))}“ erlauben.</div>`
          : `<label class="klein-t" style="display:flex;gap:8px;align-items:flex-start;margin-top:6px"><input type="checkbox" id="sw-ok-${f.stufe}" style="width:auto">
              Ich habe den Text gelesen und bin einverstanden, dass diese Daten gespeichert und so verwendet werden.</label>
            <button class="haupt" style="margin-top:6px" onclick="swFreigabe('${f.stufe}',true,${f.version})">Erlauben</button>
            ${f.widerrufen ? `<div class="klein-t leise">Widerrufen am ${swZeit(f.widerrufen)}</div>` : ''}`}
      </div>`; }).join(''));
  if (swTeilen == null) swNeuLaden(async () => { swTeilen = (await swAbruf('/api/app/freigaben')).freigaben; });
}

async function swFreigabe(stufe, an, version) {
  if (an && !$('#sw-ok-' + stufe)?.checked) { swFehler = 'Bitte zuerst das Häkchen „gelesen und einverstanden“ setzen.'; return render(); }
  const titel = swTeilen.find(x => x.stufe === stufe)?.titel;
  if (!an && !confirm(`„${titel}“ widerrufen?` + (stufe === 'standort' ? ' Die gespeicherten Standorte werden gelöscht, die Karte wird mit widerrufen.' :
    stufe === 'ertrag' ? ' Die gespeicherten Ertragsdaten werden gelöscht.' : ''))) return;
  await swNeuLaden(async () => {
    swTeilen = (await swAbruf('/api/app/freigaben', { method: 'POST', body: JSON.stringify({ stufe, an, version }) })).freigaben;
    if (an && stufe === 'standort') await swOrteSenden();
    if (an && stufe === 'ertrag') await swErtragSenden();
  });
}

// Standplätze mit Waage und Koordinaten → Server (nur mit Einwilligung „GPS-Standort“; der Server lehnt sonst ab)
async function swOrteSenden(melden) {
  const orte = db.standorte.filter(o => o.waageStand && hatKoord(o));
  for (const o of orte) await swAbruf(`/api/app/stand/${o.waageStand}/ort`, { method: 'POST', body: JSON.stringify({ lat: o.lat, lon: o.lon }) });
  if (melden) alert(orte.length ? `${orte.length} Standort(e) übertragen.` : 'Kein Standplatz mit Waage und Koordinaten – zuerst beim Stand den Standplatz wählen und am Standplatz die Lage eintragen.');
}
// Ertrag je Jahr: Honigernte am Standplatz, Mitte des Trachtpotenzials, Völker
async function swErtragSenden(melden) {
  let n = 0;
  for (const o of db.standorte.filter(o => o.waageStand)) {
    const jahre = [...new Set([...Object.keys(o.potenzial || {}), ...db.ernten.map(e => e.datum?.slice(0, 4)).filter(Boolean)])].map(jahr => {
      const p = o.potenzial?.[jahr], kg = ernteAm(o, jahr);
      return { jahr: +jahr, ernte_kg: kg || null, potenzial_kg: p ? Math.round((p.min + p.max) / 2) : null,
        voelker: db.voelker.filter(v => v.standortId === o.id && v.status !== 'aufgelöst').length };
    }).filter(j => j.ernte_kg || j.potenzial_kg);
    if (jahre.length) { await swAbruf(`/api/app/stand/${o.waageStand}/ertrag`, { method: 'POST', body: JSON.stringify({ jahre }) }); n += jahre.length; }
  }
  if (melden) alert(n ? `${n} Jahreswert(e) übertragen.` : 'Keine Ernte oder kein Trachtpotenzial an Standplätzen mit Waage gefunden.');
}

// Karte: Stände anderer Teilnehmer, nur ungefähr (Kreis = Unschärfe), mit vereinfachten Werten
function swKarteSeite() {
  const d = swKarteDaten;
  main().innerHTML = kopf('Karte der Stände', swZurueck()) + swFehlerZeile() +
    (d == null ? '<p class="leise">Lade …</p>' : !d.aktiv ? `<div class="karte">${esc(d.grund)}</div>` :
      `<p class="klein-t leise">${d.staende.length} Stände · Lage absichtlich ungenau (bis ${zahl(d.unschaerfe_m)} m verschoben), auch dein eigener. Werte der letzten 7 Tage.</p>
       <div id="sw-karte" style="height:62vh;border-radius:10px"></div>`);
  if (d == null) return swNeuLaden(async () => { swKarteDaten = await swAbruf('/api/app/karte'); });
  if (!d.aktiv || typeof L === 'undefined') return;
  swKarteObj?.remove();
  swKarteObj = L.map('sw-karte').setView([47.6, 14.1], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15, attribution: '© OpenStreetMap' }).addTo(swKarteObj);
  const w = (x, e, n = 1) => x == null ? '–' : zahl(x, n) + ' ' + e, punkte = [];
  for (const s of d.staende) {
    const farbe = s.eigener ? '#1f6feb' : '#e0a100', v = s.werte;
    L.circle([s.lat, s.lon], { radius: d.unschaerfe_m, color: farbe, weight: 1, fillOpacity: 0.15 }).addTo(swKarteObj)
      .bindPopup(`<b>${s.eigener ? 'Dein Stand' : 'Stand ' + esc(s.id.slice(0, 4))}</b><br>${v.voelker} Völker · gesamt ${w(v.gesamt_kg, 'kg', 0)}<br>
        Tageszunahme Ø ${v.tageszunahme_kg == null ? '–' : (v.tageszunahme_kg > 0 ? '+' : '') + zahl(v.tageszunahme_kg, 2) + ' kg'} je Volk<br>
        Varroa ${w(v.varroa_je_1000, '‰')} · ${w(v.temperatur_c, '°C')}<br>Wind ${w(v.wind_ms, 'm/s')} · Regen ${w(v.regen_mm, 'mm')}`);
    punkte.push([s.lat, s.lon]);
  }
  if (punkte.length) swKarteObj.fitBounds(punkte, { padding: [30, 30], maxZoom: 14 });
}

// Konto: Passwort ändern, eigene Daten herunterladen, Konto löschen
function swKontoSeite() {
  const k = swKonto().konto || {};
  main().innerHTML = kopf('Konto', swZurueck()) + swFehlerZeile() + `<div class="raster">
    <div class="karte"><h4>${esc(k.name || k.benutzer || '')}</h4><div class="klein-t">Benutzer ${esc(k.benutzer || '–')}${k.email ? ' · ' + esc(k.email) : ''}<br>
      ${k.rolle === 'betreiber' ? 'Betreiber des Servers' : 'Kunde'}</div></div>
    <div class="karte"><h4>Passwort ändern</h4>
      <label>Altes Passwort<input id="sw-pa" type="password" autocomplete="current-password"></label>
      <label>Neues Passwort (mind. 8 Zeichen)<input id="sw-pn" type="password" autocomplete="new-password"></label>
      <button class="haupt" style="margin-top:8px" onclick="swPasswort()">Ändern</button>
      <div class="klein-t leise">Danach ist das Konto auf allen Geräten abgemeldet.</div></div>
    <div class="karte"><h4>Meine Daten</h4><p class="klein-t">Alles, was der Server über dich speichert, als ZIP (Konto, Einwilligungen, Messwerte als CSV).</p>
      <button onclick="swMeineDaten()">⬇ Herunterladen</button></div>
    <div class="karte"><h4>Konto löschen</h4><p class="klein-t">Löscht Konto, alle Stände, Messwerte, Bilder und Freigaben am Server. Die Daten in dieser App bleiben.</p>
      <label>Passwort zur Bestätigung<input id="sw-pl" type="password" autocomplete="current-password"></label>
      <button style="margin-top:8px" onclick="swKontoLoeschen()">🗑 Konto endgültig löschen</button></div></div>`;
}
async function swPasswort() {
  const alt = $('#sw-pa').value, neu = $('#sw-pn').value;
  if (neu.length < 8) { swFehler = 'Das neue Passwort braucht mindestens 8 Zeichen.'; return render(); }
  try { await swAbruf('/api/app/passwort', { method: 'POST', body: JSON.stringify({ alt, neu }) }); }
  catch (e) { swFehler = e.message; return render(); }
  alert('Passwort geändert – bitte mit dem neuen Passwort anmelden.');
  const k = swKonto(); swKontoSetzen({ server: k.server, benutzer: k.benutzer }); swAnsicht = 'liste'; swFehler = ''; render();
}
// Herunterladen mit Anmeldung im Kopf (nicht in der Adresse)
async function swDatei(pfad, name) {
  const k = swKonto();
  try {
    const r = await fetch(k.server + pfad, { headers: { Authorization: 'Bearer ' + k.token } });
    if (!r.ok) throw new Error(`Server antwortet ${r.status}`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { swFehler = e.message; render(); }
}
const swMeineDaten = () => swDatei('/api/app/meine-daten', `stockwaage-${swKonto().konto?.benutzer || 'daten'}.zip`);
async function swKontoLoeschen() {
  const pw = $('#sw-pl').value;
  if (!pw) { swFehler = 'Bitte das Passwort eingeben.'; return render(); }
  if (!confirm('Konto und alle Daten am Server wirklich endgültig löschen? Das lässt sich nicht rückgängig machen.')) return;
  try { await swAbruf('/api/app/konto-loeschen', { method: 'POST', body: JSON.stringify({ passwort: pw }) }); }
  catch (e) { swFehler = e.message; return render(); }
  swKontoSetzen({ server: swKonto().server }); swAnsicht = 'liste'; swStaende = null; swFehler = ''; render();
}

// Betreiber: Konten verwalten, Karte ein/aus und Unschärfe, Auswertung der geteilten Daten
function swBetriebSeite() {
  const b = swBetrieb;
  main().innerHTML = kopf('Betrieb', swZurueck()) + swFehlerZeile() + (b == null ? '<p class="leise">Lade …</p>' : `
    <div class="raster">
      <div class="karte"><h4>Neues Kundenkonto</h4>
        <label>Benutzername<input id="sw-kb" autocapitalize="none"></label><label>Name<input id="sw-kn"></label><label>E-Mail<input id="sw-ke" type="email"></label>
        <button class="haupt" style="margin-top:8px" onclick="swKundeNeu()">Anlegen</button>
        <div class="klein-t leise">Das Passwort wird einmal angezeigt – dem Kunden weitergeben, er ändert es dann selbst.</div></div>
      <div class="karte"><h4>Karte</h4>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sw-ka" style="width:auto" ${b.karte.aktiv ? 'checked' : ''}> Karte für Teilnehmer freigeben</label>
        <label>Unschärfe der Lage (m, 50–5000)<input id="sw-ku" type="number" min="50" max="5000" step="50" value="${b.karte.unschaerfe_m}"></label>
        <button style="margin-top:8px" onclick="swKarteEinst()">Speichern</button>
        <div class="klein-t leise">Jeder Stand wird fest um 60–100 % dieses Werts verschoben angezeigt.</div></div>
      <div class="karte"><h4>Auswertung</h4><p class="klein-t">Nur Stände, deren Besitzer „Sensordaten“ oder „Ertragsdaten“ erlaubt haben – ohne Namen, Stand-Nummer und Standort.</p>
        <button onclick="swDatei('/api/app/betrieb/auswertung.csv','auswertung.csv')">⬇ auswertung.csv</button></div>
      <div class="karte"><h4>Angaben für die Datenschutzerklärung</h4>
        <label>Name / Firma<input id="sw-an" value="${esc(b.angaben?.name || '')}"></label>
        <label>Anschrift<textarea id="sw-aa" rows="2">${esc(b.angaben?.anschrift || '')}</textarea></label>
        <label>E-Mail<input id="sw-ae" type="email" value="${esc(b.angaben?.email || '')}"></label>
        <button style="margin-top:8px" onclick="swAngabenSpeichern()">Speichern</button>
        <a href="#" class="klein-t" style="margin-left:8px" onclick="swDatenschutz();return false">Erklärung ansehen</a></div>
      <div class="karte"><h4>Nachweise gelöschter Konten</h4>
        <p class="klein-t">Im Streitfall: Benutzername und E-Mail, wie der frühere Kunde sie nennt. Aufbewahrt 3 Jahre, ohne Namen.</p>
        <label>Benutzername<input id="sw-nb" autocapitalize="none"></label><label>E-Mail<input id="sw-ne" type="email"></label>
        <button style="margin-top:8px" onclick="swNachweiseSuchen()">Suchen</button><div id="sw-nachweise" class="klein-t"></div></div>
    </div>
    <h3>Konten</h3>` + tabelle(['Benutzer', 'Name', 'Rolle', 'Stände', 'Seit', ''], b.kunden.map(x => [
      esc(x.benutzer) + (x.gesperrt ? ' ' + marke('gesperrt', 'rot') : ''), esc(x.name || '') + (x.email ? `<div class="klein-t leise">${esc(x.email)}</div>` : ''),
      x.rolle === 'betreiber' ? 'Betreiber' : 'Kunde', x.staende, x.angelegt ? fmtD(new Date(x.angelegt).toISOString().slice(0, 10)) : '',
      x.id === swKonto().konto?.id ? '<span class="leise klein-t">du</span>' :
        `<button class="klein" onclick="swKundeTun(${x.id},'passwort')">🔑 neues Passwort</button>
         <button class="klein" onclick="swKundeTun(${x.id},'${x.gesperrt ? 'freigeben' : 'sperren'}')">${x.gesperrt ? '🔓 freigeben' : '🔒 sperren'}</button>
         <button class="klein" onclick="swKundeTun(${x.id},'loeschen')">🗑</button>`])));
  if (b == null) swNeuLaden(swBetriebLaden);
}
async function swBetriebLaden() {
  swBetrieb = { kunden: (await swAbruf('/api/app/betrieb/kunden')).kunden, karte: await swAbruf('/api/app/betrieb/karte'),
    angaben: (await swAbruf('/api/app/betrieb/angaben').catch(() => ({}))).angaben };
}
async function swKundeNeu() {
  const benutzer = $('#sw-kb').value.trim(), name = $('#sw-kn').value.trim(), email = $('#sw-ke').value.trim();
  if (!benutzer) { swFehler = 'Benutzername fehlt.'; return render(); }
  await swNeuLaden(async () => {
    const j = await swAbruf('/api/app/betrieb/kunden', { method: 'POST', body: JSON.stringify({ benutzer, name, email }) });
    alert(`Konto „${benutzer}“ angelegt.\n\nPasswort (nur jetzt sichtbar): ${j.passwort}\n\nServer-Adresse: ${swKonto().server}`);
    await swBetriebLaden();
  });
}
async function swKundeTun(id, was) {
  const x = swBetrieb.kunden.find(k => k.id === id);
  const frage = { loeschen: `Konto „${x.benutzer}“ mit allen Ständen, Messwerten und Bildern endgültig löschen?`,
    sperren: `„${x.benutzer}“ sperren? Er wird sofort abgemeldet, die Daten bleiben.`, passwort: `Für „${x.benutzer}“ ein neues Passwort erzeugen? Das alte gilt dann nicht mehr.` }[was];
  if (frage && !confirm(frage)) return;
  await swNeuLaden(async () => {
    const j = await swAbruf(`/api/app/betrieb/kunde/${id}/${was}`, { method: 'POST' });
    if (j.passwort) alert(`Neues Passwort für „${x.benutzer}“ (nur jetzt sichtbar): ${j.passwort}`);
    await swBetriebLaden();
  });
}
async function swKarteEinst() {
  const aktiv = $('#sw-ka').checked, unschaerfe_m = Number($('#sw-ku').value);
  await swNeuLaden(async () => {
    swBetrieb.karte = await swAbruf('/api/app/betrieb/karte', { method: 'POST', body: JSON.stringify({ aktiv, unschaerfe_m }) });
  });
}

// Datenschutzerklärung des Servers (GET /datenschutz, ohne Anmeldung) in einem neuen Fenster
function swDatenschutz() {
  const k = swKonto(), srv = (k.server || ($('#sw-server')?.value || '')).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(srv)) return alert('Erst die Server-Adresse eintragen.');
  window.open(srv + '/datenschutz', '_blank', 'noopener');
}
async function swAngabenSpeichern() {
  const b = { name: $('#sw-an').value, anschrift: $('#sw-aa').value, email: $('#sw-ae').value };
  await swNeuLaden(async () => { swBetrieb.angaben = (await swAbruf('/api/app/betrieb/angaben', { method: 'POST', body: JSON.stringify(b) })).angaben; });
}
async function swNachweiseSuchen() {
  const ziel = $('#sw-nachweise');
  try {
    const n = (await swAbruf('/api/app/betrieb/nachweise', { method: 'POST', body: JSON.stringify({ benutzer: $('#sw-nb').value.trim(), email: $('#sw-ne').value.trim() }) })).nachweise;
    const d = ms => ms ? fmtD(new Date(ms).toISOString().slice(0, 10)) : '–';
    ziel.innerHTML = n.length ? tabelle(['Freigabe', 'Fassung', 'erteilt', 'widerrufen', 'Konto gelöscht', 'aufbewahrt bis'],
      n.map(x => [esc(x.stufe), x.version, d(x.erteilt), d(x.widerrufen), d(x.geloescht), d(x.aufbewahren_bis)])) : '<p class="leise">Keine Nachweise zu diesen Angaben.</p>';
  } catch (e) { ziel.textContent = e.message; }
}
