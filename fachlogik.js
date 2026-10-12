// Fachlogik für Seite und Service Worker: Wetter, Vegetationsstand, Arbeiten im Jahreslauf.
// Kein Zugriff auf DOM oder localStorage, damit sie auch im Hintergrund läuft.
const iso = d => d.toLocaleDateString('sv');
const heute = () => iso(new Date());
const tagText = datum => new Date(datum + 'T12:00').toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'numeric' });

const BEUTEN = ['Zander', 'Einheitsmaß', 'Dadant', 'Langstroth', 'Deutsch Normal', 'Flachzargen', 'Kuntzsch', 'Sonstige'];
const beuteGruppe = b => b === 'Dadant' ? 'dadant' : b === 'Flachzargen' ? 'flach' : ['Zander', 'Einheitsmaß', 'Langstroth', 'Deutsch Normal'].includes(b) ? 'magazin' : 'sonst';

// ---------- Wetter (Open-Meteo, ortsbezogen) ----------
const WETTERCODE = [[0, '☀️ klar'], [2, '🌤️ heiter'], [3, '☁️ bedeckt'], [48, '🌫️ Nebel'], [57, '🌦️ Niesel'], [67, '🌧️ Regen'], [77, '🌨️ Schnee'], [82, '🌧️ Schauer'], [86, '🌨️ Schneeschauer'], [99, '⛈️ Gewitter']];
const wetterText = c => (WETTERCODE.find(([max]) => c <= max) || WETTERCODE[0])[1];
const flug = t => t.tmax >= 14 && t.regen < 1 && t.wind < 25 ? ['gruen', 'gut'] : t.tmax >= 10 && t.regen < 5 && t.wind < 40 ? ['gelb', 'mäßig'] : ['rot', 'kein Flug'];
// Grünlandtemperatursumme: positive Tagesmittel ab 1.1., Jänner ×0,5, Februar ×0,75
const gtsAnteil = (datum, t) => t > 0 ? t * (datum.slice(5, 7) === '01' ? 0.5 : datum.slice(5, 7) === '02' ? 0.75 : 1) : 0;

async function holeWetter(lat, lon) {
  const hole = async url => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
  const jahr = new Date().getFullYear(), ende = iso(new Date(Date.now() - 6 * 864e5)), q = `latitude=${lat}&longitude=${lon}&timezone=auto`;
  const [fc, ar, aq] = await Promise.all([
    hole(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&past_days=14&forecast_days=7`),
    ende > `${jahr}-01-01` ? hole(`https://archive-api.open-meteo.com/v1/archive?${q}&start_date=${jahr}-01-01&end_date=${ende}&daily=temperature_2m_mean`).catch(() => null) : null,
    hole(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen`).catch(() => null)]);
  const mittel = {};
  ar?.daily.time.forEach((d, i) => { if (ar.daily.temperature_2m_mean[i] != null) mittel[d] = ar.daily.temperature_2m_mean[i]; });
  fc.daily.time.forEach((d, i) => { if (fc.daily.temperature_2m_mean[i] != null) mittel[d] = fc.daily.temperature_2m_mean[i]; });
  let gts = 0, fehlend = 0, beginn = null; const verlauf = [];
  for (let d = new Date(jahr, 0, 1); iso(d) <= heute(); d.setDate(d.getDate() + 1)) {
    const t = mittel[iso(d)];
    if (t == null) fehlend++; else gts += gtsAnteil(iso(d), t);
    if (!beginn && gts >= 200) beginn = iso(d);
    verlauf.push(Math.round(gts));
  }
  const tage = fc.daily.time.map((d, i) => ({ datum: d, code: fc.daily.weather_code[i], tmax: fc.daily.temperature_2m_max[i], tmin: fc.daily.temperature_2m_min[i], tmittel: fc.daily.temperature_2m_mean[i], regen: fc.daily.precipitation_sum[i] ?? 0, wind: fc.daily.wind_speed_10m_max[i] ?? 0 })).filter(t => t.datum >= heute() && t.tmax != null);
  // Voraussichtliche Wärmesumme der nächsten Tage laut Vorhersage
  let g = gts; const prognose = tage.filter(t => t.datum > heute()).map(t => ({ datum: t.datum, gts: g += gtsAnteil(t.datum, t.tmittel ?? 0) }));
  return { gts, fehlend, beginn, verlauf, tage, prognose, pollen: aq?.current || null,
    jetzt: { temp: fc.current.temperature_2m, feuchte: fc.current.relative_humidity_2m, wind: fc.current.wind_speed_10m, code: fc.current.weather_code } };
}

// ---------- Phänologie ----------
const PHASEN = [
  [30, 'Winter', 'Vegetationsruhe', 'Völker in Ruhe lassen, Fluglöcher und Futtervorrat (Gewicht) kontrollieren. Restentmilbung bei Brutfreiheit.'],
  [200, 'Vorfrühling', 'Hasel, Erle, Schneeglöckchen, Salweide', 'Reinigungsflug beobachten, Futterkontrolle, Böden reinigen, Tränke aufstellen.'],
  [430, 'Erstfrühling', 'Forsythie, Kirsche, Schlehe, Löwenzahn', 'Frühjahrsdurchsicht, Brutnest prüfen, Baurahmen geben, Honigraum zur Kirschblüte aufsetzen.'],
  [800, 'Vollfrühling', 'Apfel, Raps, Rosskastanie', 'Schwarmkontrolle alle 7–9 Tage, erweitern, Ableger bilden, Drohnenbrut schneiden.'],
  [1200, 'Frühsommer', 'Robinie, Holunder, Himbeere', 'Frühtracht schleudern, Schwarmkontrolle fortsetzen, Königinnenzucht.'],
  [1900, 'Hochsommer', 'Linde, Edelkastanie, Waldtracht', 'Sommertracht ernten, Varroabefall messen, nach Abschleudern behandeln.'],
  [2500, 'Spätsommer', 'Heide, Sonnenblume, Phacelia', 'Sommerbehandlung, Auffütterung, Völker auf Weiselrichtigkeit prüfen und vereinigen.'],
];
const HERBST = { 9: ['Frühherbst', 'Efeu, Herbstzeitlose, Holunderreife', 'Einfütterung abschließen, Fluglöcher einengen, Varroakontrolle (Windel).'],
  10: ['Vollherbst', 'Efeu, Laubverfärbung', 'Mäusegitter anbringen, Futtervorrat prüfen, Beuten sturmfest machen.'],
  11: ['Spätherbst', 'Laubfall', 'Brutfreiheit abwarten, Winterbehandlung (Oxalsäure) vorbereiten, Material pflegen.'] };
function phase(gts, datum) {
  const m = +datum.slice(5, 7);
  const [name, zeiger, tipp] = m === 12 ? PHASEN[0].slice(1) : HERBST[m] && (m > 9 || gts >= 2500) ? HERBST[m] : (PHASEN.find(p => gts < p[0]) || PHASEN[6]).slice(1);
  return { name, zeiger, tipp };
}
// Geschätzte Blühfenster nach Grünlandtemperatursumme (Richtwerte)
const TRACHTEN = [['Hasel', 30, 150, 'Pollen'], ['Erle', 50, 170, 'Pollen'], ['Salweide', 150, 300, 'Nektar + Pollen'], ['Kirsche / Schlehe', 300, 420, 'Nektar + Pollen'], ['Löwenzahn', 360, 560, 'Nektar + Pollen'],
  ['Apfel / Obstblüte', 430, 560, 'Nektar + Pollen'], ['Raps', 450, 720, 'Nektar + Pollen'], ['Rosskastanie', 520, 700, 'Nektar + Pollen'], ['Robinie (Akazie)', 800, 980, 'Nektar'], ['Himbeere / Brombeere', 900, 1500, 'Nektar + Pollen'],
  ['Linde', 1200, 1650, 'Nektar + Honigtau'], ['Edelkastanie', 1350, 1700, 'Nektar + Pollen'], ['Sonnenblume', 1700, 2300, 'Nektar + Pollen'], ['Phacelia / Buchweizen', 1900, 2900, 'Nektar'], ['Heide', 2300, 2900, 'Nektar'], ['Efeu', 2900, 4200, 'Nektar + Pollen']];
const POLLEN = { alder_pollen: 'Erle', birch_pollen: 'Birke', grass_pollen: 'Gräser', mugwort_pollen: 'Beifuß', ragweed_pollen: 'Ragweed' };

// ---------- Arbeiten im Jahreslauf ----------
// von/bis = Grünlandtemperatursumme, ab/bisTag = Kalenderfenster 'MM-TT'. Texte je Beutengruppe unter beute.
// wetter: welcher Tag passt (durchsicht = warm und trocken, as = 15–25 °C, kalt = Frostwetter)
const MEILENSTEINE = [
  { id: 'reinigung', von: 60, bis: 200, pflanze: 'Hasel und Erle blühen', titel: 'Reinigungsflug und Futterkontrolle', wetter: 'durchsicht',
    text: 'Flugloch beobachten, Beute anheben und Gewicht prüfen. Bei knappem Vorrat Futterwabe oder Futterteig geben, Boden reinigen.' },
  { id: 'fruehjahr', von: 200, bis: 300, pflanze: 'Forsythie und Salweide blühen', titel: 'Frühjahrsdurchsicht', wetter: 'durchsicht',
    text: 'Weiselrichtigkeit, Brutnest, Futter (mind. 5 kg) und Volksstärke prüfen. Schwache Völker vereinigen, alte Waben entnehmen.' },
  { id: 'erw1', von: 250, bis: 330, pflanze: 'Salweide in Vollblüte', wetter: 'durchsicht', beute: {
    magazin: ['1. Erweitern: zweite Brutraumzarge', 'Sind alle Wabengassen der ersten Zarge besetzt, zweite Zarge mit ausgebauten Waben und Mittelwänden aufsetzen.'],
    dadant: ['1. Erweitern: Brutraum am Schied', 'Schied versetzen und 1–2 Waben oder Mittelwände ans Brutnest geben, sobald die Randwabe besetzt ist.'],
    flach: ['1. Erweitern: weitere Brut-Flachzarge', 'Flachzargen sind schneller voll: Sobald die oberste Zarge zu zwei Dritteln besetzt ist, die nächste Flachzarge aufsetzen.'],
    sonst: ['1. Erweitern: Brutraum', 'Brutraum um Waben oder Mittelwände erweitern, sobald alle Gassen besetzt sind.'] } },
  { id: 'erw2', von: 300, bis: 430, pflanze: 'Kirschblüte beginnt', wetter: 'durchsicht', beute: {
    magazin: ['2. Erweitern: erster Honigraum', 'Honigraum über dem Absperrgitter aufsetzen, wenn der Brutraum gut besetzt ist. Baurahmen einhängen.'],
    dadant: ['2. Erweitern: erster Honigraum', 'Halbzarge über dem Absperrgitter aufsetzen, Brutraum weiter mit dem Schied anpassen. Baurahmen einhängen.'],
    flach: ['2. Erweitern: erste Honig-Flachzarge', 'Erste Honig-Flachzarge über dem Absperrgitter aufsetzen. Baurahmen einhängen.'],
    sonst: ['2. Erweitern: Honigraum freigeben', 'Honigraum freigeben oder aufsetzen, wenn der Brutraum gut besetzt ist. Baurahmen einhängen.'] } },
  { id: 'schwarm', von: 430, bis: 1200, pflanze: 'Apfelblüte beginnt', titel: 'Schwarmkontrolle alle 7 Tage', wetter: 'durchsicht',
    text: 'Auf bestiftete Weiselzellen achten, Zellen brechen oder Zwischenableger bilden. Drohnenbrut im Baurahmen regelmäßig schneiden.' },
  { id: 'erw3', von: 450, bis: 720, pflanze: 'Rapsblüte beginnt', wetter: 'durchsicht', beute: {
    magazin: ['3. Erweitern: zweiter Honigraum', 'Ist der erste Honigraum zu zwei Dritteln gefüllt, zweiten Honigraum aufsetzen.'],
    dadant: ['3. Erweitern: zweiter Honigraum', 'Ist die erste Halbzarge zu zwei Dritteln gefüllt, die zweite darunter setzen.'],
    flach: ['3. Erweitern: weitere Honig-Flachzargen', 'Eine Flachzarge fasst nur etwa zwei Drittel einer Normalzarge. In guter Tracht früh nachgeben, lieber eine Zarge zu früh als zu spät.'],
    sonst: ['3. Erweitern: Honigraum vergrößern', 'Bei guter Tracht rechtzeitig weiteren Honigraum geben.'] } },
  { id: 'ableger', von: 500, bis: 1100, pflanze: 'Raps in Vollblüte', titel: 'Ableger bilden', wetter: 'durchsicht',
    text: 'Aus starken Völkern Brutwaben mit ansitzenden Bienen entnehmen. Dämpft den Schwarmtrieb und schafft Jungvölker für das nächste Jahr.' },
  { id: 'ernte1', von: 720, bis: 950, pflanze: 'Raps verblüht', titel: 'Frühtracht ernten', wetter: 'durchsicht',
    text: 'Waben ernten, wenn sie zu zwei Dritteln verdeckelt sind und die Spritzprobe besteht (Wassergehalt unter 18 %). Danach Futter prüfen – Trachtlücke.' },
  { id: 'ernte2', von: 1650, bis: 1900, ab: '07-10', bisTag: '07-31', pflanze: 'Linde verblüht', titel: 'Sommertracht ernten (Abschleudern)', wetter: 'durchsicht',
    text: 'Letzte Ernte des Jahres. Honigräume abnehmen, Fluglöcher einengen (Räuberei), sofort eine Futtergabe als Überbrückung.' },
  { id: 'varroa1', von: 1750, bis: 2300, ab: '07-20', bisTag: '08-31', pflanze: 'nach dem Abschleudern', titel: 'Varroa: Befall messen und Sommerbehandlung', wetter: 'as',
    text: 'Windel 3 Tage einlegen und Milbenfall zählen. Behandlung nach Befall, z. B. Ameisensäure bei 15–25 °C und trockenem Wetter.' },
  { id: 'fuettern', von: 1900, bis: 2700, ab: '08-01', bisTag: '09-20', pflanze: 'Spätsommer', titel: 'Auffüttern', beute: {
    magazin: ['Auffüttern', 'Abends füttern, bis der Wintervorrat erreicht ist: rund 18–22 kg zweizargig, 12–15 kg einzargig. Bis Mitte September abschließen.'],
    dadant: ['Auffüttern', 'Abends füttern, bis rund 18–22 kg im Brutraum sind. Volk mit dem Schied auf die besetzten Waben einengen. Bis Mitte September abschließen.'],
    flach: ['Auffüttern', 'Abends füttern, bis rund 18–22 kg erreicht sind. Auf zwei bis drei Flachzargen einwintern. Bis Mitte September abschließen.'],
    sonst: ['Auffüttern', 'Abends füttern, bis rund 15–20 kg Wintervorrat erreicht sind. Bis Mitte September abschließen.'] } },
  { id: 'varroa2', ab: '09-10', bisTag: '10-05', pflanze: 'Frühherbst', titel: 'Varroa-Nachkontrolle', wetter: 'as',
    text: 'Milbenfall erneut messen. Bei mehr als 5 Milben pro Tag zweite Behandlung. Weiselrichtigkeit prüfen, schwache Völker vereinigen.' },
  { id: 'maus', ab: '10-01', bisTag: '11-15', pflanze: 'Laubverfärbung', titel: 'Einwintern: Mäusegitter und Sturmsicherung',
    text: 'Mäusegitter anbringen, Beuten sichern, Futtervorrat am Gewicht prüfen. Völker ab jetzt nicht mehr öffnen.' },
  { id: 'winter', ab: '11-20', bisTag: '12-31', pflanze: 'etwa 3 Wochen nach dem ersten Frost', titel: 'Winterbehandlung (Oxalsäure)', wetter: 'kalt',
    text: 'Bei Brutfreiheit einmalig behandeln. Für das Träufeln sollte das Volk eng in der Traube sitzen, also bei Temperaturen um den Gefrierpunkt.' },
];

function besterTag(tage, art) {
  const wie = t => `${tagText(t.datum)}, ${Math.round(t.tmax)} °C, ${t.regen < 1 ? 'trocken' : t.regen.toFixed(1).replace('.', ',') + ' mm Regen'}`;
  let t, vorwort = 'Empfohlener Tag';
  if (art === 'kalt') { t = tage.find(t => t.tmax <= 5 && t.regen < 2); if (!t) { t = [...tage].sort((a, b) => a.tmax - b.tmax)[0]; vorwort = 'Noch zu warm, kältester Tag'; } }
  else if (art === 'as') t = tage.find(t => t.tmax >= 15 && t.tmax <= 25 && t.regen < 2);
  else if (art === 'durchsicht') { t = tage.find(t => t.tmax >= 15 && t.regen < 1 && t.wind < 30); if (!t) { t = tage.find(t => t.tmax >= 12 && t.regen < 3); vorwort = 'Bedingt geeignet (kurz halten)'; } }
  else return null;
  return t ? { datum: t.datum, text: `${vorwort}: ${wie(t)}` } : { datum: null, text: 'In den nächsten 7 Tagen kein passendes Wetter' };
}

// Liefert alle Arbeiten für einen Beutentyp mit Stand (kommt / jetzt / vorbei), Zeitprognose und Wetterempfehlung
function meilensteine(beute, d, tag) {
  const md = tag.slice(5), monat = +tag.slice(5, 7), gruppe = beuteGruppe(beute);
  return MEILENSTEINE.map(m => {
    const [titel, text] = m.beute ? m.beute[gruppe] : [m.titel, m.text];
    const imGts = m.von != null && d.gts >= m.von && d.gts <= m.bis && monat < 11, imDatum = m.ab != null && md >= m.ab && md <= m.bisTag;
    let stand = 'vorbei', wann = '', empf = null;
    if (imGts || imDatum) { stand = 'jetzt'; empf = besterTag(d.tage, m.wetter); }
    else if (m.von != null ? d.gts < m.von && monat < 10 && !(m.ab && md > m.bisTag) : md < m.ab) {
      stand = 'kommt';
      if (m.von != null) {
        const p = d.prognose.find(p => p.gts >= m.von), schnitt = d.prognose.length ? (d.prognose[d.prognose.length - 1].gts - d.gts) / d.prognose.length : 0;
        const tage = schnitt > 0.5 ? Math.round((m.von - d.gts) / schnitt) : null;
        wann = p ? `voraussichtlich ab ${tagText(p.datum)}` : tage && tage < 90 ? `in etwa ${tage} Tagen` : `ab Wärmesumme ${m.von}`;
      } else wann = `ab ${m.ab.slice(3)}.${m.ab.slice(0, 2)}.`;
    }
    return { id: m.id, titel, text, pflanze: m.pflanze, stand, wann, empf, allgemein: !m.beute };
  });
}

// ---------- Benachrichtigungen ----------
// Zustand liegt im Cache-Speicher, weil der Service Worker localStorage nicht lesen kann
async function statusLesen(name) { const r = await (await caches.open('imkerei-status')).match('status/' + name); return r ? r.json() : null; }
async function statusSchreiben(name, wert) { await (await caches.open('imkerei-status')).put('status/' + name, new Response(JSON.stringify(wert))); }

// VIS-Meldung (Österreich): Stichtage 30.4. und 31.10., zu melden bis 30.6. bzw. 31.12.
const VIS_LINK = 'https://vis.statistik.at/';
function visFenster(tag) {
  const j = tag.slice(0, 4), md = tag.slice(5);
  return md >= '04-30' && md <= '06-30' ? { id: j + '-F', stichtag: `30.04.${j}`, frist: `30.06.${j}` }
    : md >= '10-31' ? { id: j + '-H', stichtag: `31.10.${j}`, frist: `31.12.${j}` } : null;
}
const meldungOptionen = h => ({ body: h.text, icon: 'icon-192.png', badge: 'icon-192.png', tag: h.ersetzt || h.key, data: { url: h.url || null },
  actions: h.url ? [{ action: 'link', title: 'Zum VIS anmelden' }, { action: 'app', title: 'App öffnen' }] : [] });

// Arbeiten ohne beutenspezifischen Text zählen je Standplatz nur einmal
const hinweisKey = (tag, standortId, gruppe, m) => `${tag.slice(0, 4)}|${standortId}|${m.allgemein ? '*' : gruppe}|${m.id}`;
async function sammleHinweise(st) {
  const tag = heute(), liste = [], vis = visFenster(tag);
  // Mit Bestätigungspflicht enthält der Schlüssel das Datum: Erinnerung kommt täglich, bis bestätigt wurde
  if (vis && st.vis && !st.vis.aus && !st.vis.bestaetigt[vis.id]) liste.push({ key: st.vis.ohneBestaetigung ? `vis|${vis.id}` : `vis|${vis.id}|${tag}`, ersetzt: `vis|${vis.id}`, url: VIS_LINK,
    titel: 'VIS-Meldung fällig', text: `Stichtag ${vis.stichtag}: ${st.vis.voelker} Völker an ${st.vis.standorte} Standplätzen melden, Frist ${vis.frist}.${st.vis.ohneBestaetigung ? '' : ' Danach in der App bestätigen.'}` });
  for (const a of st.aufgaben) if (a.faellig <= tag) liste.push({ key: `a|${a.id}|${a.faellig}`, titel: a.faellig < tag ? 'Aufgabe überfällig' : 'Aufgabe heute fällig', text: a.titel });
  for (const s of st.standorte) {
    if (!s.beuten.length) continue;
    let d; try { d = await holeWetter(s.lat, s.lon); } catch { continue; }
    for (const [gruppe, beute] of new Map(s.beuten.map(b => [beuteGruppe(b), b])))
      for (const m of meilensteine(beute, d, tag)) if (m.stand === 'jetzt' && !liste.some(h => h.key === hinweisKey(tag, s.id, gruppe, m)))
        liste.push({ key: hinweisKey(tag, s.id, gruppe, m), titel: `${s.name}: ${m.titel}`, text: `${m.pflanze[0].toUpperCase() + m.pflanze.slice(1)}. ${m.text}${m.empf ? ' ' + m.empf.text + '.' : ''}` });
  }
  return liste;
}
// Zeigt jeden Hinweis genau einmal
async function benachrichtige(zeigen) {
  const st = await statusLesen('daten');
  if (!st?.push) return 0;
  const gemeldet = await statusLesen('gemeldet') || {};
  let n = 0;
  for (const h of await sammleHinweise(st)) if (!gemeldet[h.key]) { await zeigen(h); gemeldet[h.key] = 1; n++; }
  await statusSchreiben('gemeldet', gemeldet);
  return n;
}
