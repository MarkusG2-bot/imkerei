# Einrichten · Messprotokoll Phase 1 (Version 0.1.0)

Phase 1 umfasst: Stammdaten (Personen/Rollen, Messmittel-Liste), Prüfpläne mit
ISO-Passungen und Allgemeintoleranzen, neue Zeichnungsstände, ISO-Passungsrechner.

## 1. Dateien holen
Auf GitHub im Ordner `messprotokoll/dateien` (oder „Code → Download ZIP“):
- `Messprotokoll.xlsx`
- `Stammdaten.xlsx`
- Ordner `vba` mit 7 Dateien (`.bas`)

**Wichtig:** Aus dem Internet geladene Dateien sperrt Windows für Makros.
Je Datei: Rechtsklick → Eigenschaften → Haken bei **„Zulassen“** → OK.

## 2. Ordner auf dem Netzlaufwerk
Einen Basisordner anlegen, z. B. `\\Server\Messdaten\`, darin:
- `Programm\` → hierhin `Messprotokoll.xlsx`
- `Stammdaten\` → hierhin `Stammdaten.xlsx`

Die übrigen Ordner legt das Programm später selbst an.

## 3. Stammdaten: Personen eintragen
`Stammdaten.xlsx` öffnen, Blatt **Personen**:
- **Benutzername** = Windows-Anmeldename. Herausfinden: Windows-Taste → `cmd` → `echo %USERNAME%`
- In den Spalten **Prüfer / Freigeber / Stammdaten** ein `x` setzen.
- Zuerst die Stammdaten-Gruppe eintragen. Solange dort niemand steht, darf jeder Prüfpläne anlegen
  (Einrichtungsmodus).

## 4. Makros einspielen (einmalig)
1. `Programm\Messprotokoll.xlsx` öffnen.
2. **Alt + F11** (VBA-Editor) → **Datei → Datei importieren** → alle 7 `.bas`-Dateien aus `vba`
   nacheinander importieren.
3. VBA-Editor schließen, **Alt + F8** → Makro **Einrichten** → Ausführen.
4. **Datei → Speichern unter** → Dateityp **„Excel-Arbeitsmappe mit Makros (*.xlsm)“**,
   Name `Messprotokoll.xlsm`, Ordner `Programm`.
5. Die alte `Messprotokoll.xlsx` löschen.
6. Auf dem Startblatt **„Ordnerstruktur anlegen“** klicken.

## 5. Makros zulassen
Damit Excel die Makros auf dem Netzlaufwerk ausführt: **Datei → Optionen → Trust Center →
Einstellungen → Vertrauenswürdige Speicherorte** → „Vertrauenswürdige Speicherorte im Netzwerk
zulassen“ → Basisordner hinzufügen. Bei 80 Arbeitsplätzen besser von der IT zentral per
Gruppenrichtlinie einstellen lassen.

## 6. Schreibrechte (IT)
| Ordner | Alle | Stammdaten-Gruppe |
|--------|------|-------------------|
| `Programm` | lesen | ändern |
| `Stammdaten` | lesen | ändern |
| `Pruefplaene` | lesen | ändern |

## 7. Testliste für Phase 1
Bitte in Excel durchspielen und melden, was nicht passt:
1. Startblatt: **Anmeldung prüfen** zeigt deinen Namen und deine Rollen.
2. **ISO-Rechner**: Ø20 H7 ergibt +0,021 / 0 und Ø20 g6 ergibt −0,007 / −0,020.
3. **Neuer Prüfplan**: Artikel `TEST-1`, Stand `A`. Einige Zeilen eintragen:
   - `1 | Außendurchmesser | Passung | 20 | g6`
   - `2 | Länge | Maß | 50 | | 0,1 | -0,1`
   - `3 | Fase | Maß | 5 | 2768-m`
   - `4 | Ebenheit | Form/Lage | | | 0,05`
   - `5 | Gewinde M8 | Attribut`
   OGW/UGW müssen sich sofort füllen. Eine Zeile absichtlich falsch machen (z. B. Art leer):
   Spalte **Prüfung** zeigt den Fehler rot.
4. **Speichern** → Datei liegt unter `Pruefplaene\TEST-1\TEST-1_Stand-A.xlsx`.
5. **Neuer Zeichnungsstand** → `B`. Zeile 2 ändern, Zeile 5 löschen, Zeile 6 neu.
   **Speichern** → Zeile 2 gelb, Zeile 6 grün, „Entfallene Merkmale: 5“.
   Stand A ist jetzt schreibgeschützt.
6. **Laden** → Stand A wählen → Hinweis „abgeschlossen (nur lesen)“, Speichern wird abgelehnt.
7. Zweiter PC: gleichen Stand laden, beide ändern, beide speichern → der Zweite bekommt
   „von jemand anderem geändert“.

## Für Entwickler
- Quellcode (UTF-8): `quellcode/*.bas`, Lieferdateien erzeugen: `python3 werkzeuge/erzeuge.py`
- ISO-286-Daten nur in `werkzeuge/iso286_daten.py` ändern.
- Tests (LibreOffice nötig): `python3 tests/test_logik.py`, `python3 tests/syntax_pruefung.py`
