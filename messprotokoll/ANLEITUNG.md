# Messprotokoll 1.0.0 · Anleitung

## Installation (einmalig, ca. 5 Minuten)

1. Auf GitHub im Ordner `messprotokoll` die Datei **`Messprotokoll_1.0.0.zip`** herunterladen
   (Datei anklicken → Download-Knopf).
2. **Rechtsklick auf die ZIP → Eigenschaften → Haken bei „Zulassen“ → OK.**
   (Sonst sperrt Windows die Makros.)
3. ZIP entpacken (Rechtsklick → Alle extrahieren).
4. Im entpackten Ordner **`INSTALLIEREN.bat` doppelklicken** und die Fragen beantworten:
   - Basisordner, z. B. `C:\Messdaten_Test` (zum Testen) oder `\\Server\Messdaten`
   - Testdaten einspielen? → **J** für den Test
   - Dich mit allen Rollen eintragen? → **J**
   - Vertrauenswürdiger Speicherort? → **J**
5. Fertig: `Programm\Messprotokoll.xlsm` öffnet sich. Zuerst **„Selbsttest“** klicken.

Das Installationsprogramm baut die Excel-Datei mit allen Makros selbst zusammen.
Dafür schaltet es kurz den „Zugriff auf das VBA-Projekt“ ein und danach wieder zurück.

### Wenn die Installation nicht startet
- **Fenster schließt sofort / „Ausführung von Skripts deaktiviert“:** Die IT blockiert PowerShell.
  → Manuell einrichten (unten) oder IT fragen.
- **„Excel erlaubt keinen Zugriff auf das VBA-Projekt“:** Richtlinie der IT. → Manuell einrichten.

### Manuell einrichten (falls nötig)
1. Ordner anlegen: `Basisordner\Programm` und `Basisordner\Stammdaten`.
2. `Stammdaten.xlsx` (bzw. `testdaten\Stammdaten\Stammdaten.xlsx`) nach `Stammdaten\` kopieren.
   Für Testdaten den Inhalt von `testdaten\` in den Basisordner kopieren.
3. `Messprotokoll.xlsx` öffnen → **Alt+F11** → Datei → Datei importieren → alle `.bas` aus `vba\`.
4. Im VBA-Editor links „DieseArbeitsmappe“ doppelklicken und den Inhalt von
   `vba\DieseArbeitsmappe.txt` hineinkopieren.
5. **Alt+F8** → `Einrichten` → Ausführen.
6. Speichern unter → **Excel-Arbeitsmappe mit Makros (*.xlsm)** → `Basisordner\Programm\Messprotokoll.xlsm`.
7. In Stammdaten.xlsx, Blatt Personen, dich eintragen (Windows-Benutzername, x bei allen Rollen).

## Bedienung kurz

| Aufgabe | So geht's |
|---------|-----------|
| Messen | „Messung starten / öffnen“ → Produktnummer. Neu: Artikelnummer, Auftrag, Kunde, Standard-Messmittel. Istwerte in Spalte H. |
| n.i.O. | Spalte K: Nacharbeit (Prüfer) oder Sonderfreigabe/Ausschuss (Freigeber, mit Begründung). Ohne Entscheidung → Freigabe-Gruppe. |
| Abschließen | Archiv + schreibgeschützt + PDF unter `PDF\Jahr\Artikel\`. |
| Nacharbeit | Produktnummer wieder öffnen → „nachgemessen?“ Ja → nur die betroffenen Merkmale neu messen. |
| Offene Protokolle | Liste aller laufenden, in Nacharbeit und in Freigabe; Zeile anklicken → öffnen. |
| Prüfplan | Laden / Neu / Neuer Stand / Speichern (Stammdaten-Gruppe). |
| Auswertung | Artikelnummer → Auswerten (Cpk je Merkmal), Merkmal-Nr → Verlauf. |
| Messmittel | Gepflegt in `Stammdaten.xlsx`, Übersicht im Programm. Abgelaufene sind gesperrt. |

## Für den Echtbetrieb (IT)
- Programm `Programm\Messprotokoll.xlsm` ist schreibgeschützt – alle öffnen dieselbe Datei.
- Ordnerrechte: `Programm`, `Stammdaten`, `Pruefplaene` nur Stammdaten-Gruppe schreibend;
  `Daten`, `PDF`, `System` alle schreibend; `Daten\Archiv` später nur lesend + Anlegen.
- Makros: Basisordner per Gruppenrichtlinie als vertrauenswürdigen Speicherort eintragen.
- Datensicherung des ganzen Basisordners; Aufbewahrung 10 Jahre.

## Für Entwickler
- Quellcode (UTF-8): `quellcode/`, Lieferpaket bauen: `python3 werkzeuge/paket.py`
- ISO-286-Daten nur in `werkzeuge/iso286_daten.py`, Testfälle in `tests/testfaelle.py`
- Tests (LibreOffice im VBA-Modus): `tests/test_logik.py`, `tests/test_logik2.py`,
  `tests/test_selbsttest.py`, `tests/test_testdaten.py`, `tests/syntax_pruefung.py`
