# Gedächtnis · Messdatenverwaltung Metalltechnik (Excel)

Dieses Dokument ist das Projekt-Gedächtnis. Es hält Ziel, Entscheidungen und
offene Fragen fest, damit jede neue Sitzung hier weitermachen kann.

## Ziel
Eine Messdatenverwaltung für die Metalltechnik auf Basis von Excel aufbauen
(Messprotokolle erfassen, verwalten, auswerten).

## Status
- 2026-10-17: Ordner `messprotokoll/` angelegt. **Noch nichts gebaut.**
  Phase: Fragen klären und Architektur festlegen.

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

## Architektur-Entwurf (noch nicht entschieden)
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
