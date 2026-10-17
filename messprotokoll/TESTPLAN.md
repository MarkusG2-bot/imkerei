# Großer Test · Messprotokoll 1.0.0

Alle Funktionen in einem Durchgang. Dauer etwa 60–90 Minuten.
Abhaken in `Testliste.xlsx` (liegt im ZIP) – Spalte „OK?“ und Notizen.

**Vorher:** Windows-PC mit Microsoft 365 Excel. Testordner verwenden, nicht die echten Daten.


## A Installation

1. ZIP herunterladen, Rechtsklick → Eigenschaften → „Zulassen“ → OK, dann entpacken.  
   → **Erwartet:** Ordner Messprotokoll_1.0.0 mit INSTALLIEREN.bat
2. INSTALLIEREN.bat doppelklicken. Basisordner z. B. C:\Messdaten_Test, alle Fragen mit J.  
   → **Erwartet:** „Installation abgeschlossen“, Programm öffnet sich
3. Falls gelbe Leiste „Makros deaktiviert“: Inhalt aktivieren.  
   → **Erwartet:** Keine Leiste mehr bzw. Makros aktiv

## B Start

4. Startblatt ansehen.  
   → **Erwartet:** Version 1.0.0, Basisordner, dein Name, Rollen „Prüfer, Freigeber, Stammdaten“, Hinweis „Messmittel: 2 gesperrt, 1 bald fällig“
5. „Selbsttest“ klicken.  
   → **Erwartet:** „Selbsttest bestanden: alle 98 Prüfungen in Ordnung“
6. „Anmeldung prüfen“ klicken.  
   → **Erwartet:** Name, Rollen und Basisordner werden angezeigt

## C Messmittel

7. „Messmittel“ klicken.  
   → **Erwartet:** 15 Messmittel; MS-99 rot „abgelaufen“, RL-02 rot „keine Kalibrierdaten“, MS-03 gelb „bald fällig“, Rest grün

## D Auswertung

8. Blatt Auswertung: C3 = DEMO-100, „Auswerten“.  
   → **Erwartet:** Protokolle 30 · i.O. 27 · Sonderfreigabe 2 · Ausschuss 1; 14 Merkmale
9. Cpk-Spalte prüfen.  
   → **Erwartet:** Nr 1 ≈ 1,68 grün · Nr 2 ≈ 0,97 rot · Nr 3 ≈ 0,55 rot · Nr 10 ≈ 1,37 grün · Nr 13 ≈ 1,03 gelb
10. C7 = 2, „Verlauf anzeigen“.  
   → **Erwartet:** Liniendiagramm mit 30 Punkten, rote Linien OGW 20,015 / UGW 20,002, graue Mittelwertlinie

## E Prüfplan

11. „Prüfplan laden“ → DEMO-100 → Stand A.  
   → **Erwartet:** 15 Merkmale mit OGW/UGW; Hinweis „Stand A ist abgeschlossen (nur lesen)“
12. „Neuer Stand“ → B. Merkmal 1: Abmaß oben 0,15. Zeile 15 komplett leeren. In die nächste freie Zeile: 16 | Ø Zapfen | Passung | 12 | h7. „Speichern“, Frage „aktueller Stand?“ mit Ja.  
   → **Erwartet:** Nr 1 gelb „geändert“, Nr 16 grün „neu“, Entfallene Merkmale: 15; OGW Nr 16 = 12,000, UGW = 11,982
13. „Neu“ → Artikel TEST-1, Stand A. Zeile: 1 | Bohrung | Passung | 20 | X7. Zeile: 2 | Länge | (Art leer) | 50.  
   → **Erwartet:** Spalte N rot: „Bohrungs-Toleranzfeld X wird nicht unterstützt“ bzw. „Art fehlt“
14. „Speichern“ versuchen.  
   → **Erwartet:** Wird abgelehnt, Liste der Fehler; erste Fehlerzeile ist markiert. Danach X7 → H7, Art → Maß, Abmaße ±0,1 → Speichern klappt
15. Blatt ISO-Rechner: 40 und f7.  
   → **Erwartet:** Abmaß oben −0,025, unten −0,050, Höchstmaß 39,975, Mindestmaß 39,950

## F Messung

16. „Messung starten / öffnen“ → J1567/5.  
   → **Erwartet:** Abgeschlossenes Protokoll öffnet sich nur zum Ansehen (Ergebnis i.O.)
17. „Messung starten / öffnen“ → J1567/40 → Artikel DEMO-200 → Auftrag A-1 → Kunde Test GmbH → Standard-Messmittel MS-01.  
   → **Erwartet:** 8 Merkmale geladen, Modus BEARBEITEN, Cursor in Istwert Nr 10
18. Istwerte (Spalte H) und Messmittel (Spalte J) eintragen: 10: 80,1 · 20: 39,96 (BM-02) · 30: 30,025 (IM-01) · 40: 12,02 (BM-01) · 50: 60,05 (MS-99) · 60: 0,01 (MU-01) · 70: 1,2 (RA-01) · 80: io (GL-08).  
   → **Erwartet:** Bewertung: alle grün, nur Nr 30 rot n.i.O.; Spalte K bei Nr 30 orange
19. „Zwischenspeichern“.  
   → **Erwartet:** Fehler: „Messmittel MS-99: Kalibrierung abgelaufen“ – nichts wird gespeichert
20. Nr 50 Messmittel auf MS-02 ändern → „Zwischenspeichern“, dann „Schließen“. Blatt Offene Protokolle → Aktualisieren.  
   → **Erwartet:** Statuszeile unten „zwischengespeichert“. Liste: J1567/40 „In Arbeit“, 8 Merkmale, 8 gemessen, 1 n.i.O., 1 offen
21. Zeile J1567/40 anklicken → „Markierte Zeile öffnen“ → „Abschließen“.  
   → **Erwartet:** Frage „1 Merkmal(e) n.i.O. ohne Entscheidung – an Freigabe übergeben?“ → Ja → Status „Wartet auf Freigabe“, NUR ANSEHEN

## G Freigabe

22. J1567/40 öffnen. Nr 30: Entscheidung Sonderfreigabe (ohne Begründung) → „Abschließen“.  
   → **Erwartet:** Fehler „Begründung für Sonderfreigabe fehlt“
23. Begründung eintragen → „Abschließen“ → Ja.  
   → **Erwartet:** Ergebnis „i.O. mit Sonderfreigabe“, Meldung mit PDF-Pfad; Entschieden von/am ausgefüllt
24. PDF im Ordner PDF\2026\DEMO-200 öffnen.  
   → **Erwartet:** Kopf mit Produktnummer, Artikelnummer, Auftragsnummer, Kunde; Tabelle quer auf Seitenbreite; Fußzeile Seite x von y
25. J1567/40 erneut öffnen.  
   → **Erwartet:** Nur ansehen, Hinweis „abgeschlossen“
26. Offene Protokolle → J1567/31 öffnen. Nr 2 (rot): Ausschuss + Begründung → Abschließen.  
   → **Erwartet:** Ergebnis „Ausschuss“, Protokoll verschwindet aus offenen Protokollen

## H Nacharbeit

27. J1567/32 öffnen.  
   → **Erwartet:** Frage „nachgearbeitet – jetzt nachmessen?“ → Ja → Nr 13 Istwert leer, Vorwert 22,13, Bemerkung „Nacharbeit …“
28. Nr 13 Istwert 22,05 → Abschließen.  
   → **Erwartet:** Ergebnis i.O.
29. J1567/33 öffnen (In Arbeit, halb gemessen). Fehlende Werte aus der Mitte der Toleranz eintragen, Nr 11 „nio“ → Entscheidung Nacharbeit → Abschließen.  
   → **Erwartet:** Status „Nacharbeit“; danach wie oben nachmessen möglich

## I Rechte

30. Stammdaten\Stammdaten.xlsx öffnen, bei dir das x bei Freigeber entfernen, speichern und schließen. Im Programm „Anmeldung prüfen“.  
   → **Erwartet:** Rollen ohne Freigeber
31. Neues Protokoll J1567/41 (DEMO-100): Nr 1 = 125 → Sonderfreigabe + Begründung → Zwischenspeichern.  
   → **Erwartet:** Fehler „Sonderfreigabe darf nur die Freigabe-Gruppe entscheiden“. Nacharbeit dagegen geht
32. x bei Freigeber wieder setzen (speichern, schließen), „Anmeldung prüfen“.  
   → **Erwartet:** Rolle Freigeber wieder da

## J Prüfplan-Schutz

33. Prüfplan DEMO-200 Stand A laden.  
   → **Erwartet:** Hinweis „abgeschlossen (nur lesen)“, weil J1567/40 diesen Stand verwendet

## K Mehrbenutzer (optional, 2 PCs)

34. PC 1 öffnet J1567/41, PC 2 öffnet dasselbe.  
   → **Erwartet:** PC 2: „wird gerade von … bearbeitet – nur ansehen?“
35. Beide laden Prüfplan TEST-1, ändern etwas, beide speichern.  
   → **Erwartet:** Der Zweite bekommt „von jemand anderem geändert“

## L Abschluss

36. Excel schließen (nicht speichern nötig) und Programm neu öffnen.  
   → **Erwartet:** Keine Speicherfrage; Startblatt wieder aktuell; offene Sperren freigegeben

## Erwartete Cpk-Werte (Testdaten DEMO-100, vor dem Test)

| Nr | Merkmal | n | Cpk | Bewertung |
|---|---|---|---|---|
| 1 | Gesamtlänge | 30 | 1.68 | sehr gut |
| 2 | Ø Lagersitz | 30 | 0.97 | nicht fähig |
| 3 | Ø Wellenabsatz | 30 | 0.55 | nicht fähig |
| 4 | Ø Querbohrung | 30 | 2.38 | sehr gut |
| 5 | Länge Absatz | 30 | 0.94 | nicht fähig |
| 6 | Fase 1x45° | 30 | 1.34 | fähig |
| 7 | Passfedernut Breite | 30 | 1.37 | fähig |
| 8 | Rundlauf Lagersitz | 30 | 1.23 | bedingt fähig |
| 9 | Ebenheit Stirnfläche | 30 | 1.54 | fähig |
| 10 | Rauheit Ra Lagersitz | 30 | 1.37 | fähig |
| 12 | Ø Einstich | 30 | 1.09 | bedingt fähig |
| 13 | Länge Lagersitz | 30 | 1.03 | bedingt fähig |
| 14 | Koaxialität | 30 | 1.37 | fähig |
| 15 | Radius Übergang | 30 | 1.51 | fähig |

Fehler bitte mit Schrittnummer und Foto der Meldung melden.
