// Rechnung erfassen: PDF oder Foto einlesen, Positionen erkennen und als Zugang ins Lager buchen.
// Wird vor app.js geladen und nutzt dessen Hilfsfunktionen erst zur Laufzeit.

// Bibliotheken werden erst beim ersten Einlesen geladen, danach liegen sie im Cache des Service Workers
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const skripte = {};
const ladeSkript = url => skripte[url] ??= new Promise((ok, fehler) => {
  const s = document.createElement('script'); s.src = url; s.onload = ok;
  s.onerror = () => { delete skripte[url]; s.remove(); fehler(new Error('Skript nicht ladbar: ' + url)); };
  document.head.append(s);
});

// ---------- Text aus PDF oder Foto ----------
async function pdfText(datei, info) {
  await ladeSkript(PDFJS + 'pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await datei.arrayBuffer() }).promise, seiten = Math.min(pdf.numPages, 6), zeilen = [];
  for (let n = 1; n <= seiten; n++) {
    // Textstücke mit gleicher Höhe auf der Seite zu Zeilen zusammensetzen, links nach rechts
    const reihen = [];
    for (const t of (await (await pdf.getPage(n)).getTextContent()).items.filter(t => t.str?.trim())) {
      const y = t.transform[5];
      let r = reihen.find(r => Math.abs(r.y - y) < Math.max(2, (t.height || 10) * 0.5));
      if (!r) reihen.push(r = { y, teile: [] });
      r.teile.push(t);
    }
    zeilen.push(...reihen.sort((a, b) => b.y - a.y).map(r => r.teile.sort((a, b) => a.transform[4] - b.transform[4]).map(t => t.str.trim()).join(' ')));
  }
  if (zeilen.join('').replace(/\s/g, '').length > 30) return zeilen.join('\n');
  // Eingescannte PDF ohne Textebene: Seiten als Bild lesen
  const bilder = [];
  for (let n = 1; n <= seiten; n++) {
    info(`Seite ${n} wird aufbereitet …`);
    const p = await pdf.getPage(n), vp = p.getViewport({ scale: 3 }), c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    bilder.push(c);
  }
  return ocr(bilder, info);
}
async function bildCanvas(datei) {
  const b = await createImageBitmap(datei), f = Math.min(1, 3000 / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.round(b.width * f); c.height = Math.round(b.height * f);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  return c;
}
async function ocr(bilder, info) {
  info('Lade Texterkennung … (beim ersten Mal einige MB, danach auch ohne Empfang)');
  await ladeSkript(TESSERACT);
  let seite = 0;
  const w = await Tesseract.createWorker('deu', 1, { logger: m => m.status === 'recognizing text' && info(`Lese Text${bilder.length > 1 ? ` (Seite ${seite} von ${bilder.length})` : ''} … ${Math.round(m.progress * 100)} %`) });
  try {
    let text = '';
    for (const b of bilder) { seite++; text += (await w.recognize(b)).data.text + '\n'; }
    return text;
  } finally { w.terminate(); }
}

// ---------- Auswertung ----------
const RE_EINHEIT = { kg: 'kg', kilo: 'kg', kilogramm: 'kg', g: 'g', gr: 'g', gramm: 'g', l: 'l', ltr: 'l', liter: 'l', ml: 'ml',
  stk: 'Stk', stck: 'Stk', 'stück': 'Stk', st: 'Stk', pcs: 'Stk', karton: 'Karton', krt: 'Karton', rolle: 'Rolle', rollen: 'Rolle',
  sack: 'Sack', 'säcke': 'Sack', kanister: 'Kanister', eimer: 'Eimer', pkg: 'Pkg', packung: 'Pkg' };
const ZAEHL = ['Stk', 'Karton', 'Rolle', 'Sack', 'Kanister', 'Eimer', 'Pkg'];
const NUM = '\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?';
const EINH = Object.keys(RE_EINHEIT).sort((a, b) => b.length - a.length).join('|');
const GELD = /(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)|(?<![\d.,])\d+\.\d{2}(?![\d.,])/g;
const RE_KAT = [[/zucker|futter|sirup|apifonda|ambrosia|invert|fondant|teig/, 'Futter'], [/glas|gläser|deckel/, 'Gläser & Deckel'], [/etikett/, 'Etiketten'],
  [/rähmchen|raehmchen|mittelw/, 'Rähmchen & Mittelwände'], [/säure|saeure|thymol|apiguard|thymovar|varromed|apibioxal|oxuvar|polyvar/, 'Behandlungsmittel'],
  [/wachs/, 'Wachs'], [/beute|zarge|boden|absperrgitter|fluglochkeil|futterzarge/, 'Beutenteile'], [/handschuh|schleier|anzug|stockmei|smoker|besen/, 'Werkzeug & Schutz']];

// Deutsche Schreibweise: 1.200,50 → 1200.5; 1.200 → 1200; 1.5 → 1.5
function zahlLesen(s) {
  s = String(s).trim();
  if (s.includes(',')) return +s.replace(/\./g, '').replace(',', '.');
  return /^\d{1,3}(\.\d{3})+$/.test(s) ? +s.replace(/\./g, '') : +s;
}
const reZahl = v => v === '' || v == null ? null : parseFloat(String(v).replace(',', '.'));
const einheitNorm = e => (RE_EINHEIT[String(e || '').toLowerCase()] || String(e || '')).toLowerCase();
function umrechnen(m, von, nach) {
  von = einheitNorm(von); nach = einheitNorm(nach);
  if (von === nach) return m;
  const f = { 'kg>g': 1000, 'g>kg': 0.001, 'l>ml': 1000, 'ml>l': 0.001 }[von + '>' + nach];
  return f ? +(m * f).toFixed(3) : null;
}
const reNorm = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const woerter = s => reNorm(s).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));

// Mengenangaben einer Zeile; bei Gebinde × Inhalt (z. B. „32 Sack … 25 kg“) zuerst das Produkt
function reMengen(zeile) {
  const s = zeile.toLowerCase(), kand = [], spannen = [];
  for (const m of s.matchAll(new RegExp(`(?<![\\d.,])(\\d+)\\s*[x×*]\\s*(${NUM})\\s*(${EINH})(?![a-zäöüß])`, 'g'))) {
    kand.push({ menge: +(+m[1] * zahlLesen(m[2])).toFixed(3), einheit: RE_EINHEIT[m[3]] }); spannen.push([m.index, m.index + m[0].length]);
  }
  for (const m of s.matchAll(new RegExp(`(?<![\\d.,])(${NUM})\\s*(${EINH})(?![a-zäöüß])`, 'g'))) {
    if (spannen.some(([a, b]) => m.index >= a && m.index < b)) continue;
    kand.push({ menge: zahlLesen(m[1]), einheit: RE_EINHEIT[m[2]] }); spannen.push([m.index, m.index + m[0].length]);
  }
  const zaehl = kand.filter(k => ZAEHL.includes(k.einheit)), inhalt = kand.filter(k => !ZAEHL.includes(k.einheit));
  if (zaehl.length && inhalt.length) kand.unshift({ menge: +(zaehl[zaehl.length - 1].menge * inhalt[0].menge).toFixed(3), einheit: inhalt[0].einheit });
  return { kand: kand.filter(k => k.menge > 0), spannen };
}
const ohneSpannen = (z, spannen) => [...spannen].sort((a, b) => b[0] - a[0]).reduce((t, [a, b]) => t.slice(0, a) + ' '.repeat(b - a) + t.slice(b), z);
const reName = rest => rest.replace(GELD, ' ').replace(/€|\beur\b/gi, ' ').replace(/(^|\s)[\d.,%\/-]+(?=\s|$)/g, ' ').replace(/[|*_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const reKategorie = text => { const k = RE_KAT.find(([re]) => re.test(text.toLowerCase()))?.[1]; return k && liste('lagerKat').includes(k) ? k : 'Sonstiges'; };
function artikelFinden(text) {
  const zw = woerter(text); let beste = null, punkte = 0;
  for (const l of db.lager) {
    const aw = woerter(l.name); if (!aw.length) continue;
    const p = aw.filter(a => zw.some(z => z.includes(a) || (z.length >= 4 && a.includes(z)))).length / aw.length;
    if (p > punkte) { punkte = p; beste = l; }
  }
  return punkte >= 0.5 ? beste : null;
}
// Passende Menge zur Einheit des Artikels; bei neuem Artikel nach Art der Ware
function reWaehle(kand, einheit, kat) {
  if (!kand.length) return { menge: null, einheit: einheit || 'Stk' };
  if (einheit) {
    for (const k of kand) { const m = umrechnen(k.menge, k.einheit, einheit); if (m != null) return { menge: m, einheit }; }
    return { ...kand[0] };
  }
  return { ...(['Futter', 'Wachs', 'Honig'].includes(kat) ? kand[0] : kand.find(k => ZAEHL.includes(k.einheit)) || kand[0]) };
}
function reDatum(zeilen) {
  const d = z => {
    const m = z.match(/(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?!\d)/); if (!m || +m[1] > 31 || +m[2] > 12 || +m[1] < 1 || +m[2] < 1) return null;
    return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  return zeilen.filter(z => /rechnungsdatum/i.test(z)).map(d).find(Boolean) || zeilen.filter(z => /datum/i.test(z)).map(d).find(Boolean) || zeilen.map(d).find(Boolean) || heute();
}
function reAuswerten(text) {
  const zeilen = text.split(/\r?\n/).map(z => z.replace(/\s+/g, ' ').trim()).filter(Boolean), alias = db.einstellungen.reAlias || {}, pos = [];
  let betrag = null;
  for (const z of zeilen) {
    if (/gesamt|summe|rechnungsbetrag|zu zahlen|endbetrag|total/i.test(z) && !/netto|zwischen|gewicht/i.test(z)) {
      const g = [...z.matchAll(GELD)].map(m => zahlLesen(m[0]));
      if (g.length) betrag = Math.max(betrag ?? 0, g[g.length - 1]);
    }
    if (/summe|gesamt|mwst|umsatzsteuer|ust\.?\s*\d|skonto|übertrag|zahlbar|iban|bic\b|versandkosten|fracht|porto/i.test(z)) continue;
    const { kand, spannen } = reMengen(z);
    if (!kand.length) continue;
    const rest = ohneSpannen(z, spannen), geld = [...rest.matchAll(GELD)].map(m => zahlLesen(m[0])), name = reName(rest), schluessel = woerter(name).join(' ');
    const l = (alias[schluessel] && db.lager.find(x => x.id === alias[schluessel])) || artikelFinden(z);
    if (!l && !geld.length) continue; // z. B. Adresszeile „3100 St. Pölten“
    const kategorie = l?.kategorie || reKategorie(z);
    pos.push({ an: true, zeile: z, kand, schluessel, artikel: l?.id || 'neu', neuName: name, kategorie, betrag: geld.length ? geld[geld.length - 1] : null, manuell: false, ...reWaehle(kand, l?.einheit, kategorie) });
  }
  const nr = text.match(/(?:rechnungs?|beleg|invoice)\s*-?\s*(?:nr|nummer|no)\.?\s*:?\s*([A-Za-z0-9][\w\/.-]{0,20})/i)?.[1] || '';
  const lieferant = zeilen.find(z => /[a-zäöü]{3}/i.test(z) && !/rechnung|seite|datum|@|www\.|\b(tel|fax)\b|\d,\d\d/i.test(z))?.slice(0, 60) || '';
  if (betrag == null && pos.some(p => p.betrag != null)) betrag = +pos.reduce((s, p) => s + (p.betrag || 0), 0).toFixed(2);
  return { lieferant, nr, datum: reDatum(zeilen), betrag, pos };
}

// ---------- Ablauf und Anzeige ----------
let rech = null;
const reZeigen = () => { const el = $('#re-bereich'); if (el) el.innerHTML = reHtml(); };
async function reLaden(datei) {
  if (!datei) return;
  const pdf = datei.type === 'application/pdf' || /\.pdf$/i.test(datei.name);
  rech = { id: uid(), datei, name: datei.name || 'Foto', typ: pdf ? 'pdf' : 'bild', info: 'Lese Rechnung …' }; reZeigen();
  const info = t => { if (rech?.datei !== datei) return; rech.info = t; const el = $('#re-info'); if (el) el.textContent = t; };
  let erg;
  try {
    const text = pdf ? await pdfText(datei, info) : await ocr([await bildCanvas(datei)], info);
    erg = { text, ...reAuswerten(text) };
  } catch {
    erg = { text: '', lieferant: '', nr: '', datum: heute(), betrag: null, pos: [],
      fehler: 'Die Rechnung konnte nicht automatisch gelesen werden' + (navigator.onLine ? '.' : ' – für das erste Einlesen wird Internet gebraucht.') + ' Du kannst die Positionen unten selbst eintragen.' };
  }
  if (rech?.datei !== datei) return; // inzwischen verworfen oder neue Datei gewählt
  Object.assign(rech, erg, { info: null, ausgabe: erg.betrag != null });
  reZeigen();
}
function reArtikel(i, v) {
  const p = rech.pos[i], l = db.lager.find(x => x.id === v);
  p.artikel = v;
  if (!p.manuell) Object.assign(p, reWaehle(p.kand, l?.einheit, l?.kategorie || p.kategorie));
  else if (l) { const m = p.menge == null ? null : umrechnen(p.menge, p.einheit, l.einheit); if (p.menge == null || m != null) { p.menge = m; p.einheit = l.einheit; } }
  reZeigen();
}
function rePlus() {
  const l = db.lager[0];
  rech.pos.push({ an: true, zeile: '', kand: [], schluessel: '', artikel: l?.id || 'neu', neuName: '', kategorie: 'Sonstiges', menge: null, einheit: l?.einheit || 'Stk', betrag: null, manuell: true });
  reZeigen();
}
function reHtml() {
  if (!rech) return '';
  if (rech.info) return `<div class="karte" style="margin-bottom:12px"><h4>Rechnung: ${esc(rech.name)}</h4><div class="leise" id="re-info">${esc(rech.info)}</div>
    <div class="zeile" style="margin-top:8px"><button class="klein" onclick="rech=null;reZeigen()">Abbrechen</button></div></div>`;
  const artikel = [...db.lager].sort((a, b) => a.name.localeCompare(b.name, 'de')), doppelt = rech.nr && db.rechnungen.some(r => r.nr === rech.nr);
  const zeilen = rech.pos.map((p, i) => {
    const l = db.lager.find(x => x.id === p.artikel), neu = p.artikel === 'neu' || !l;
    return [`<input type="checkbox" ${p.an ? 'checked' : ''} onchange="rech.pos[${i}].an=this.checked">`,
      (p.zeile ? `<div class="leise klein-t">${esc(p.zeile)}</div>` : '') +
      `<select onchange="reArtikel(${i},this.value)"><option value="neu" ${neu ? 'selected' : ''}>＋ Neuer Artikel</option>${artikel.map(a => `<option value="${a.id}" ${a.id === p.artikel ? 'selected' : ''}>${esc(a.name)} (${esc(a.einheit)})</option>`).join('')}</select>` +
      (neu ? `<div class="zeile" style="margin-top:4px"><input placeholder="Name des neuen Artikels" value="${esc(p.neuName)}" oninput="rech.pos[${i}].neuName=this.value" style="flex:2;min-width:140px">
        <select onchange="rech.pos[${i}].kategorie=this.value" style="flex:1;min-width:120px">${liste('lagerKat').map(k => `<option ${k === p.kategorie ? 'selected' : ''}>${k}</option>`).join('')}</select></div>` : ''),
      `<div class="zeile" style="flex-wrap:nowrap"><input type="number" step="any" min="0" placeholder="Menge" value="${p.menge ?? ''}" oninput="rech.pos[${i}].menge=reZahl(this.value);rech.pos[${i}].manuell=true" style="width:90px">
        ${neu ? `<input value="${esc(p.einheit)}" list="dl-einheit" oninput="rech.pos[${i}].einheit=this.value" style="width:70px">` : esc(p.einheit)}</div>` +
      (!neu && umrechnen(1, p.einheit, l.einheit) == null ? marke(`Einheit prüfen: Artikel in ${l.einheit}`, 'gelb') : ''),
      `<input type="number" step="0.01" min="0" placeholder="Betrag €" value="${p.betrag ?? ''}" oninput="rech.pos[${i}].betrag=reZahl(this.value)" style="width:90px">`];
  });
  return `<div class="karte" style="margin-bottom:12px"><h4>Rechnung prüfen: ${esc(rech.name)}</h4>
    ${rech.fehler ? `<ul class="hinweise"><li class="rot">${esc(rech.fehler)}</li></ul>` : ''}
    ${doppelt ? `<ul class="hinweise"><li class="rot">Eine Rechnung mit der Nummer ${esc(rech.nr)} ist bereits erfasst.</li></ul>` : ''}
    <div class="formraster">
      <label>Lieferant<input value="${esc(rech.lieferant)}" oninput="rech.lieferant=this.value"></label>
      <label>Rechnungsnr.<input value="${esc(rech.nr)}" oninput="rech.nr=this.value" onchange="reZeigen()"></label>
      <label>Datum<input type="date" value="${rech.datum}" onchange="rech.datum=this.value||heute()"></label>
      <label>Betrag gesamt (€)<input type="number" step="0.01" min="0" value="${rech.betrag ?? ''}" oninput="rech.betrag=reZahl(this.value)"></label></div>
    <label class="check"><input type="checkbox" ${rech.ausgabe ? 'checked' : ''} onchange="rech.ausgabe=this.checked"> Betrag als Ausgabe unter Finanzen buchen</label>
    <h3>Positionen</h3>
    ${zeilen.length ? tabelle(['', 'Rechnungszeile → Lagerartikel', 'Menge', 'Betrag €'], zeilen) : '<p class="leer">Keine Positionen erkannt. Trage sie mit „+ Position“ selbst ein.</p>'}
    <datalist id="dl-einheit">${['Stk', 'kg', 'g', 'l', 'ml', 'Karton', 'Rolle', 'Sack', 'Kanister', 'Eimer'].map(e => `<option value="${e}">`).join('')}</datalist>
    <p class="leise klein-t">Angehakte Positionen werden als Zugang ins Lager gebucht, der Stückpreis des Artikels wird aus dem Betrag neu berechnet. Deine Zuordnung merkt sich die App für die nächste Rechnung.</p>
    ${rech.text ? `<details><summary class="klein-t">Erkannten Text anzeigen</summary><pre class="klein-t" style="white-space:pre-wrap;max-height:300px;overflow:auto">${esc(rech.text)}</pre></details>` : ''}
    <div class="zeile" style="margin-top:10px"><button onclick="rePlus()">+ Position</button><span style="flex:1"></span>
      <button onclick="rech=null;reZeigen()">Verwerfen</button><button class="haupt" onclick="reBuchen()">Ins Lager buchen</button></div></div>`;
}
const AUSGABE_KAT = { Futter: 'Futter', Behandlungsmittel: 'Behandlungsmittel', 'Gläser & Deckel': 'Gläser & Etiketten', Etiketten: 'Gläser & Etiketten' };
function reBuchen() {
  const aktiv = rech.pos.filter(p => p.an), artikelVon = p => p.artikel !== 'neu' && db.lager.find(x => x.id === p.artikel);
  if (aktiv.some(p => !(p.menge > 0))) return alert('Bitte bei allen angehakten Positionen eine Menge eintragen.');
  if (aktiv.some(p => !artikelVon(p) && !p.neuName?.trim())) return alert('Bitte bei neuen Artikeln einen Namen eintragen.');
  if (!aktiv.length && !(rech.ausgabe && rech.betrag > 0)) return alert('Es ist keine Position angehakt.');
  const id = rech.id, beschreibung = ['Rechnung', rech.nr, rech.lieferant].filter(Boolean).join(' ').trim(), alias = db.einstellungen.reAlias ??= {};
  let kat = null;
  for (const p of aktiv) {
    let l = artikelVon(p);
    if (!l) db.lager.push(l = { id: uid(), name: p.neuName.trim(), kategorie: p.kategorie, menge: 0, einheit: p.einheit || 'Stk' });
    const m = umrechnen(p.menge, p.einheit, l.einheit) ?? p.menge;
    l.menge = +((l.menge || 0) + m).toFixed(3);
    if (p.betrag > 0) l.preis = +(p.betrag / m).toFixed(4);
    db.bewegungen.push({ id: uid(), lagerId: l.id, datum: rech.datum, menge: m, grund: 'Einkauf · ' + beschreibung, rechnungId: id });
    if (p.schluessel) alias[p.schluessel] = l.id;
    kat ??= l.kategorie;
  }
  if (rech.ausgabe && rech.betrag > 0) db.buchungen.push({ id: uid(), datum: rech.datum, art: 'Ausgabe', betrag: rech.betrag, kategorie: AUSGABE_KAT[kat] || 'Material', text: beschreibung, rechnungId: id });
  db.rechnungen.push({ id, datum: rech.datum, lieferant: rech.lieferant, nr: rech.nr, betrag: rech.betrag, datei: rech.name, typ: rech.typ, positionen: aktiv.length });
  speichern();
  const datei = rech.datei;
  bildOp('readwrite', s => s.put(datei, 're-' + id)).catch(() => alert('Die Rechnungsdatei konnte nicht gespeichert werden (Speicher voll?). Die Buchungen sind trotzdem erfolgt.'));
  rech = null; render();
}

// ---------- Erfasste Rechnungen ----------
const reListe = () => db.rechnungen.length ? '<h3>Erfasste Rechnungen</h3>' + tabelle(['Datum', 'Lieferant', 'Nr.', 'Positionen', 'Betrag', ''], [...db.rechnungen].sort(nachDatum).map(r => [
  fmtD(r.datum), esc(r.lieferant), esc(r.nr), r.positionen, r.betrag != null ? euro(r.betrag) : '–',
  `<div class="zeile"><button class="klein" onclick="reAnsehen('${r.id}')">Ansehen</button><button class="klein gefahr" onclick="reLoeschen('${r.id}')">Löschen</button></div>`])) : '';
async function reAnsehen(id) {
  const r = db.rechnungen.find(x => x.id === id), blob = await bildOp('readonly', s => s.get('re-' + id)).catch(() => null), dlg = $('#dlg');
  if (!blob) return alert('Zu dieser Rechnung ist keine Datei gespeichert.');
  const url = URL.createObjectURL(blob);
  dlg.innerHTML = `<h2>${esc(['Rechnung', r.nr, r.lieferant].filter(Boolean).join(' '))}</h2>${r.typ === 'bild' ? `<img src="${url}" style="width:100%;border-radius:8px" alt="Rechnung">` : `<p>PDF-Datei: ${esc(r.datei)}</p>`}
    <div class="btns"><span class="platz"></span><a class="btn" href="${url}" target="_blank" rel="noopener">Öffnen</a><a class="btn" href="${url}" download="${esc(r.datei || 'rechnung')}">Herunterladen</a><button onclick="$('#dlg').close()">Schließen</button></div>`;
  dlg.onclose = () => { URL.revokeObjectURL(url); dlg.onclose = null; };
  dlg.showModal();
}
function reLoeschen(id) {
  if (!confirm('Rechnung löschen? Die Lagerzugänge daraus werden wieder abgezogen und die dazugehörige Ausgabe entfernt.')) return;
  for (const b of db.bewegungen.filter(b => b.rechnungId === id)) { const l = db.lager.find(x => x.id === b.lagerId); if (l) l.menge = +((l.menge || 0) - b.menge).toFixed(3); }
  db.bewegungen = db.bewegungen.filter(b => b.rechnungId !== id);
  db.buchungen = db.buchungen.filter(b => b.rechnungId !== id);
  db.rechnungen = db.rechnungen.filter(r => r.id !== id);
  speichern(); bildOp('readwrite', s => s.delete('re-' + id)).catch(() => {}); render();
}
