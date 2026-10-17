# Architektur · Messdatenverwaltung Metalltechnik

Status: **Entwurf zur Freigabe** (2026-10-17). Grundlage: GEDAECHTNIS.md

## Rahmen
- Microsoft 365 Excel mit VBA, Windows
- Ablage auf Netzlaufwerk, kein Server/SharePoint
- ca. 80 gleichzeitige Nutzer, ca. 30 Protokolle/Tag, bis 1000 Merkmale je Teil
- ISO 9001, Aufbewahrung 10 Jahre

## Grundprinzip
Niemand schreibt gleichzeitig in dieselbe Datei.
Das Programm ist schreibgeschützt; jedes Protokoll und jeder Prüfplanstand ist eine eigene Datei.

## Ordnerstruktur auf dem Netzlaufwerk
```
Messdaten\
  Programm\       Messprotokoll.xlsm      (schreibgeschützt, alle öffnen diese Datei)
  Stammdaten\     Stammdaten.xlsx         (Messmittel, Personen/Rollen, Kunden, ISO-286-Tabelle)
  Pruefplaene\    <Artikel>\<Artikel>_Stand-<X>.xlsx   (ein Stand = eine Datei, alte bleiben)
  Daten\
    Entwurf\      laufende Protokolle (mit Sperrvermerk, wer gerade bearbeitet)
    Freigabe\     Protokolle mit n.i.O.-Maßen, warten auf Entscheidung
    Archiv\       <Jahr>\<Artikel>\<Protokoll-Nr>.csv  (nur lesbar, Ordnerrechte IT)
  PDF\            <Jahr>\<Artikel>\<Protokoll-Nr>.pdf
  Auswertung\     Auswertung.xlsx         (Power Query, Cpk je Artikel/Merkmal)
  Import\         später: Messmaschinen-CSV
  System\         Zähler für Protokoll-Nummern, Protokoll der Änderungen
```

## Rollen (Erkennung über Windows-Benutzername)
| Rolle | Darf |
|-------|------|
| Prüfer | Protokolle anlegen, Messwerte eintragen, abschließen, **Nacharbeit setzen** |
| Freigeber (Gruppe) | n.i.O.-Maße entscheiden: Sonderfreigabe / Nacharbeit / Ausschuss |
| Stammdaten (Gruppe) | Prüfpläne, Messmittel, Personen pflegen |

## Abläufe
1. **Prüfplan anlegen**: Merkmale von Hand eintragen (Nr., Bezeichnung, Art, Nennmaß,
   Toleranz/Passung). Passungen (z. B. H7) rechnet das Programm aus der ISO-286-Tabelle.
2. **Neuer Zeichnungsstand**: alten Stand kopieren → nur Änderungen eintragen →
   geänderte Merkmale werden markiert. Alter Stand bleibt unverändert erhalten.
3. **Messen – Einstieg über die Produktnummer**:
   - Prüfer gibt **Produktnummer** ein.
   - Programm sucht, ob es dazu schon ein Protokoll gibt (Entwurf, Freigabe, Archiv).
     Gefunden → Protokoll mit den bereits eingetragenen Daten öffnet sich
     (Archiv nur lesend bzw. als Nachmessung nach Nacharbeit).
   - Nicht gefunden → Aufforderung **Artikelnummer** → aktueller Prüfplanstand
     dieses Artikels wird als Vorlage geladen → Auftragsnr., Kunde ergänzen.
   - Schnelle Suche über ein Index-Verzeichnis (System\Index\<Produktnummer>.txt
     mit Verweis auf die Protokolldatei) – kein Durchsuchen aller Ordner nötig.
   - Produktnummer ist eindeutig (z. B. `J1567/1`) und dient als Schlüssel.
     Für Dateinamen wird `/` ersetzt (`J1567_1`); Auftragsnr. und Kunde werden eingetippt.
   Dann → Istwerte eintragen, Enter springt weiter →
   sofort Ampel i.O./n.i.O. → Messmittel je Merkmal wählbar (nur gültig kalibrierte).
   Zwischenspeichern als Entwurf möglich.
4. **Abschließen**: alles i.O. → Archiv + PDF.
   n.i.O. vorhanden → Prüfer kann selbst **Nacharbeit** setzen;
   für Sonderfreigabe oder Ausschuss → Ordner Freigabe.
5. **Freigabe**: Freigeber sieht Liste offener Fälle → je n.i.O.-Maß
   Sonderfreigabe / Nacharbeit / Ausschuss + Begründung → Archiv + PDF.
   Nacharbeit: Teil wird neu gemessen (neues Protokoll mit Verweis).
6. **Auswertung**: Artikel wählen → Cpk, Mittelwert, Streuung, Verlauf je Merkmal
   über alle Protokolle dieses Artikels.

## Merkmalsarten
Maß (±), Passung (ISO 286), Form/Lage (nur Obergrenze), Oberfläche (Ra/Rz),
Attribut (i.O./n.i.O., z. B. Gewindelehre).

## Datenformat Archiv
Eine CSV-Datei pro Protokoll, eine Zeile pro Merkmal mit allen Kopfdaten
(Protokoll-Nr., Artikel, Produkt, Auftrag, Kunde, Zeichnungsstand, Prüfer, Datum,
Merkmal, Soll, OGW, UGW, Ist, i.O./n.i.O., Messmittel, Entscheidung, Freigeber,
Begründung). Schnell für Power Query, lesbar auch ohne das Programm (10 Jahre).

## Messmittel (ISO 9001 Kap. 7.1.5)
Nr., Art, Messbereich, Standort, letzte/nächste Kalibrierung, Status.
Abgelaufene Messmittel sind bei der Erfassung gesperrt; Warnliste vor Ablauf.

## Bau in Phasen
1. Stammdaten + Prüfplan (inkl. ISO 286, Stand kopieren)
2. Erfassung, i.O./n.i.O., Speichern, PDF
3. Freigabe-Ablauf
4. Messmittelverwaltung mit Kalibrierwarnung
5. Auswertung mit Cpk
6. Später: PDF-Import aus Zeichnung, Messgeräte-/CSV-Import

## Technische Umsetzung
- VBA-Code liegt als Textdateien (.bas/.frm) im Repo → nachvollziehbare Versionen.
- Excel-Dateien werden hier erzeugt; der VBA-Code wird einmalig in Excel eingespielt.
- Getestet wird die Logik (Toleranzen, ISO 286, Cpk) hier automatisch;
  die Bedienung muss unter Windows/Excel getestet werden.
