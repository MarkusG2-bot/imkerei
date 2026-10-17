# Gedächtnis · Messdatenverwaltung Metalltechnik (Excel)

Dieses Dokument ist das Projekt-Gedächtnis. Es hält Ziel, Entscheidungen und
offene Fragen fest, damit jede neue Sitzung hier weitermachen kann.

## Ziel
Eine Messdatenverwaltung für die Metalltechnik auf Basis von Excel aufbauen
(Messprotokolle erfassen, verwalten, auswerten).

## Status
- 2026-10-17: Ordner `messprotokoll/` angelegt. **Noch nichts gebaut.**
  Phase: Fragen klären und Architektur festlegen.
- 2026-10-17: Alle Grundfragen beantwortet, `ARCHITEKTUR.md` als Entwurf erstellt.
  **Nächster Schritt: Freigabe der Architektur durch den Nutzer, dann Phase 1 bauen.**
- 2026-10-17: Alle Fragen geklärt. Wartet nur noch auf „Go" für Phase 1.

## Arbeitsregeln
- Erst bauen, wenn die Architektur unten als „entschieden" markiert ist.
- Jede Entscheidung mit Datum im Entscheidungs-Log eintragen.
- Sprache: Deutsch.

## Offene Fragen

### A · Einsatz & Nutzer
1. Wer misst und wer trägt ein? (eine Person / mehrere Prüfer / Büro)
2. Wo wird erfasst? (PC in der Werkstatt, Laptop, Tablet, Papier → später abtippen)
3. Arbeiten mehrere Personen gleichzeitig an der Datei? (Netzlaufwerk, OneDrive/SharePoint)
4. Welche Excel-Version? (Microsoft 365, 2019/2021, Mac) – Makros (VBA) erlaubt?

### B · Was wird gemessen
5. Welche Teile/Produkte? (Drehteile, Frästeile, Schweißbaugruppen, Bleche …)
6. Welche Merkmale? (Länge, Durchmesser, Bohrung, Gewinde, Ebenheit, Rauheit, Härte, Schichtdicke …)
7. Wie werden Toleranzen angegeben? (Nennmaß ± / Ober-/Untermaß / ISO-Passung wie H7 / Form- und Lagetoleranzen)
8. Messmittel? (Messschieber, Bügelmessschraube, Lehren, Höhenmessgerät, KMG) – müssen sie mit Kalibrierdatum verwaltet werden?
9. Wie viele Teile pro Auftrag/Los, wie viele Merkmale pro Teil? (Größenordnung)

### C · Ablauf & Ergebnis
10. Erstmusterprüfung, Serienprüfung (Stichprobe), Endkontrolle – welche Arten?
11. Automatische i.O./n.i.O.-Bewertung mit Farbe?
12. Was passiert bei n.i.O.? (Nacharbeit, Sperren, Reklamation dokumentieren)
13. Braucht es ein druckbares/PDF-Messprotokoll für den Kunden? Mit Logo, Unterschrift?
14. Statistik gewünscht? (Mittelwert, Streuung, Cp/Cpk, Verlaufsdiagramm)

### D · Stammdaten & Struktur
15. Gibt es Kunden, Artikel/Zeichnungsnummern, Aufträge, die verknüpft werden sollen?
16. Prüfplan pro Artikel einmal anlegen und dann immer wieder verwenden?
17. Zeichnungsstand/Revision mitführen?

### E · Technik & Ablage
18. Eine Datei für alles oder Vorlage + eine Datei pro Auftrag/Protokoll?
19. Datenmenge pro Jahr? (wichtig für „eine Datei" vs. „Archiv")
20. Normen/Kundenvorgaben? (ISO 9001, IATF, Rückverfolgbarkeit, Aufbewahrungsfrist)
21. Datensicherung: wo liegt die Datei, wer sichert?
22. Import von Messgeräten (USB-Messschieber, CSV vom KMG) nötig?

## Antworten (2026-10-17)
- Excel: **Microsoft 365, Makros (VBA) erlaubt**
- Nutzer: **ca. 80 Personen gleichzeitig**
- Ergebnis: druckbares Protokoll (PDF), automatische i.O./n.i.O.-Bewertung,
  Statistik (Cp/Cpk), Messmittelverwaltung mit Kalibrierdatum
- Ablage: offen, Nutzer fragt nach Empfehlung für 80 gleichzeitige Nutzer

## Antworten Runde 2 (2026-10-17)
- IT: **nur Netzlaufwerk** (kein SQL Server, kein SharePoint) → Variante 1
- Teile: **Dreh- und Frästeile**
- Toleranzen: **± zum Nennmaß und ISO-Passungen (z. B. H7)** – Form/Lage noch klären
- Menge: **ca. 30 neue Messprotokolle**, **bis zu 1000 Maße pro Protokoll**
  (Zeitraum pro Tag/Woche noch klären)
- Norm: **ISO 9001**

### Folgerungen daraus
- Datenmenge: bei 30 Protokollen/Tag × bis 1000 Werte = bis 30.000 Werte/Tag,
  mehrere Millionen pro Jahr → passt **nicht** in ein Excel-Blatt (max. ~1 Mio. Zeilen).
  Daher: Daten **pro Artikel und Jahr in Ordnern** ablegen, Auswertung lädt
  nur den gewählten Artikel.
- ISO-Passungen: Grenzmaße automatisch aus hinterlegter ISO-286-Tabelle berechnen.
- 1000 Maße pro Protokoll: Eingabe muss schnell sein (Tastatur, Enter springt
  zum nächsten Maß, Prüfplan wird vorgeladen), ggf. Messgeräte-Import.
- ISO 9001 verlangt u. a.: Messmittelüberwachung mit Kalibrierung (Kap. 7.1.5),
  Rückverfolgbarkeit (wer, wann, welches Messmittel, welcher Zeichnungsstand),
  Schutz freigegebener Protokolle vor Änderung (PDF + schreibgeschützte Datei).

## Antworten Runde 3 (2026-10-17)
- **30 Protokolle pro Tag** → ca. 30.000 Messwerte/Tag, ca. 7 Mio./Jahr
- **1 Protokoll = 1 Teil mit bis zu 1000 Merkmalen**
- **Form- und Lagetoleranzen kommen vor** (einseitige Toleranz, z. B. Ebenheit ≤ 0,05)
- **Keine Messgeräte-Anbindung derzeit**, Integration später gewünscht
- **Keine generelle Freigabe**; nur Maße außerhalb der Toleranz müssen
  freigegeben werden (Sonderfreigabe)
- Offen: Wer legt Prüfpläne an / Quelle der Prüfpläne?

### Folgerungen daraus
- Cpk wird **über mehrere Protokolle** desselben Artikels je Merkmal berechnet
  (jedes Protokoll = ein Teil = ein Wert pro Merkmal).
- Merkmalsarten: Maß (±), Passung (ISO 286), Form/Lage (nur Obergrenze),
  ggf. Oberfläche (Ra/Rz) und Attribut (i.O./n.i.O., z. B. Gewinde mit Lehre).
- Protokoll-Status: In Arbeit → Abgeschlossen (alles i.O.)
  bzw. → Wartet auf Freigabe → Freigegeben (Sonderfreigabe mit Name, Datum, Begründung).
- Freigaberecht nur für berechtigte Personen (Liste in Stammdaten,
  Erkennung über Windows-Benutzername).
- Messgeräte-Integration vorbereiten: USB-Messschieber arbeiten meist wie eine
  Tastatur (sofort nutzbar); Messmaschinen-Export (CSV) per Import-Makro später.

## Antworten Runde 4 (2026-10-17)
- Prüfpläne werden **von Hand eingetippt**. Wunsch: **Import aus Zeichnungs-PDF**,
  sodass nur noch Nummerierung und kleine Korrekturen nötig sind.
- Freigabe n.i.O.: **nur eine bestimmte Gruppe**
- Entscheidung bei n.i.O.: **Sonderfreigabe, Nacharbeit, Ausschuss** (alle drei)
- PDF-Protokoll-Kopf: **Artikelnummer, Produktnummer, Auftragsnummer, Kunde**
- Aufbewahrung: **10 Jahre**

### Folgerungen daraus
- PDF-Import: machbar nur bei **PDFs aus CAD (Text im PDF)**, nicht bei Scans.
  Weg: Text-Auslesen mit freiem Hilfsprogramm (z. B. pdftotext auf dem Netzlaufwerk),
  Makro erkennt Muster wie `Ø20 H7`, `45 ±0,1`, `R5`, Form/Lage-Angaben →
  Vorschlagsliste, die der Nutzer prüft, nummeriert und übernimmt.
  Grenzen: Form/Lage-Symbole und Zuordnung zu Ballon-Nummern oft unzuverlässig.
  Zuerst mit echten Beispiel-PDFs testen. Bessere Alternative prüfen: Merkmalsliste
  direkt aus dem CAD-Programm exportieren.
- 10 Jahre bei 30 Protokollen/Tag ≈ 75.000 Protokolldateien, ca. 70 Mio. Messwerte
  → Ordnerablage nach Artikel/Jahr bestätigt; Schreibschutz für abgeschlossene
  Protokolle über Ordnerrechte (IT) plus PDF-Kopie.

## Antworten Runde 5 (2026-10-17)
- CAD: **SolidWorks**, aber es stehen **nur PDFs** zur Verfügung
- **Kein Hilfsprogramm** jetzt → PDF-Import wird auf später verschoben
  (Idee für später: nur mit Office-Bordmitteln, z. B. Word öffnet PDF oder Power Query)
- Keine Beispiel-PDFs vorhanden
- Stammdaten pflegt **eine Personengruppe**
- Neuer Zeichnungsstand: **alter Prüfplan bleibt erhalten**, neuer Stand entsteht
  als **Kopie des alten**, nur Änderungen werden eingetragen

→ Architektur ausgearbeitet in `ARCHITEKTUR.md` (wartet auf Freigabe durch Nutzer).

## Änderungswünsche zur Architektur (2026-10-17)
- **Nacharbeit darf auch der Prüfer setzen** (Sonderfreigabe/Ausschuss nur Freigeber).
- **Einstieg über Produktnummer**: zuerst prüfen, ob schon ein Protokoll mit
  eingetragenen Daten existiert → dann dieses öffnen. Sonst Artikelnummer abfragen
  und darüber die passende Prüfplan-Vorlage laden.
- Nutzer fragte, was Cpk ist → erklärt (Prozessfähigkeit: wie sicher liegt die
  Fertigung innerhalb der Toleranz; ≥ 1,33 üblich gut).
- **Produktnummer ist eindeutig** (Beispiel `J1567/1`, gibt es nur einmal).
- **Auftragsnummer und Kunde werden eingetippt** (keine Auswahlliste).
- Technischer Hinweis: `/` ist in Dateinamen nicht erlaubt → Produktnummer wird für
  Dateinamen umgewandelt (`J1567/1` → `J1567_1`), im Protokoll bleibt das Original.

## Datenmodell-Entwurf
- **Prüfplan** (je Artikel + Zeichnungsstand): Merkmal-Nr. (Ballon-Nr.), Bezeichnung,
  Merkmalsart, Nennmaß, Passung/Toleranzen, OGW, UGW, Messmittel-Typ, Kritisch ja/nein
- **Protokoll-Kopf**: Protokoll-Nr., Artikelnummer, Produktnummer, Auftragsnummer, Kunde,
  Zeichnungsstand, Teil-Nr./Charge,
  Prüfer, Datum, Status
- **Messwert**: Protokoll-Nr., Merkmal-Nr., Istwert, Abweichung, i.O./n.i.O.,
  Messmittel-Nr., Entscheidung bei n.i.O. (Sonderfreigabe / Nacharbeit / Ausschuss,
  wer, wann, Begründung)
- **Messmittel**: Nr., Art, Messbereich, Standort, letzte/nächste Kalibrierung, Status
- **Personen**: Windows-Benutzer, Name, Rolle (Prüfer / Freigeber / Admin)

## Kernproblem: 80 gleichzeitige Nutzer
Eine einzige Excel-Datei, in die 80 Leute gleichzeitig schreiben, geht nicht gut:
- Gemeinsames Bearbeiten (Co-Authoring) und VBA-Makros vertragen sich schlecht;
  im Browser (Excel Online) laufen Makros gar nicht.
- Bei so vielen Schreibern drohen Speicherkonflikte, gesperrte Dateien und Datenverlust.
- Die Datei wird mit der Zeit groß und langsam.

Daraus folgt: **Eingabe und Datenspeicher trennen.**

## Architektur-Varianten (Empfehlung offen bis Antwort zu IT/Server)
**Variante 1 – nur Excel + Netzordner (ohne IT-Hilfe machbar)**
- `Messprotokoll.xlsm` (Eingabe-Programm, schreibgeschützt, jeder öffnet seine Kopie)
- `Stammdaten.xlsx` (Artikel, Prüfpläne, Messmittel, Prüfer – pflegt nur ein Admin)
- Beim Speichern schreibt das Makro **eine eigene Datei pro Protokoll** in einen
  Datenordner → niemand schreibt in dieselbe Datei, keine Konflikte
- `Auswertung.xlsx` sammelt alle Protokolle per Power Query (Statistik, Cpk, Suche)

**Variante 2 – Excel vorne, Datenbank hinten (robusteste Lösung)**
- Gleiches Excel-Eingabeprogramm, speichert aber per Makro in eine
  Datenbank (SQL Server/Express oder SharePoint-Liste)
- Echte Mehrbenutzerfähigkeit, Rechte, Rückverfolgbarkeit
- Braucht IT-Unterstützung (Server bzw. SharePoint)

## Ursprünglicher Architektur-Entwurf (Diskussionsgrundlage)
Vorschlag als Diskussionsgrundlage:
- **Stammdaten-Blätter:** Kunden, Artikel, Prüfplan (Merkmale je Artikel mit Nennmaß/Toleranz), Messmittel, Prüfer
- **Erfassungs-Blatt:** Auftrag wählen → Merkmale aus Prüfplan werden geladen → Messwerte eintragen → i.O./n.i.O. automatisch
- **Daten-Blatt:** alle Messwerte als lange Tabelle (eine Zeile pro Messwert) – Basis für Auswertung
- **Protokoll-Blatt:** druckfertiges Messprotokoll (PDF-Export)
- **Auswertung:** Pivot/Diagramme, ggf. Cpk

## Entscheidungs-Log
| Datum | Entscheidung | Begründung |
|-------|--------------|------------|
| 2026-10-17 | Eigener Ordner `messprotokoll/` im Repo | Vom Nutzer gewünscht |
| 2026-10-17 | Excel 365 mit VBA | Antwort Nutzer |
| 2026-10-17 | Eingabe und Datenspeicher werden getrennt | 80 gleichzeitige Nutzer |
| 2026-10-17 | Variante 1: Excel + Netzlaufwerk, eine Datei pro Protokoll | Kein Server/SharePoint vorhanden |
| 2026-10-17 | Ablage nach Artikel/Jahr, Auswertung pro Artikel | Datenmenge mehrere Mio. Werte/Jahr |
| 2026-10-17 | Freigabe nur für n.i.O.-Maße (Sonderfreigabe) | Antwort Nutzer |
| 2026-10-17 | Cpk über mehrere Protokolle je Artikel/Merkmal | 1 Protokoll = 1 Teil |
| 2026-10-17 | n.i.O.-Entscheidung: Sonderfreigabe/Nacharbeit/Ausschuss, nur Freigabe-Gruppe | Antwort Nutzer |
| 2026-10-17 | Aufbewahrung 10 Jahre | Antwort Nutzer |
| 2026-10-17 | PDF-Import auf später verschoben, kein Hilfsprogramm | Antwort Nutzer |
| 2026-10-17 | Prüfplan je Zeichnungsstand eigene Datei, neuer Stand = Kopie des alten | Antwort Nutzer |
| 2026-10-17 | Stammdaten-Pflege durch eine Personengruppe | Antwort Nutzer |
| 2026-10-17 | Prüfer darf Nacharbeit setzen | Wunsch Nutzer |
| 2026-10-17 | Einstieg über Produktnummer, sonst Artikelnummer → Vorlage | Wunsch Nutzer |
| 2026-10-17 | Produktnummer eindeutig = Schlüssel des Protokolls | Antwort Nutzer |
| 2026-10-17 | Auftragsnummer und Kunde frei eintippen | Antwort Nutzer |
