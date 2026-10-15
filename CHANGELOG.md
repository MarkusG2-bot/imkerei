# Imkerei-App – Änderungen

Neueste Version oben. Die Version steht in der App oben neben „Imkerei“.

## Version 1.1.0 · 15.10.2026 · Sperrzonen und Völkerdichte
Geänderte Dateien: app.js, ertrag.js, anpassen.js, index.html, sw.js, sperrzonen.js (neu). Unverändert: fachlogik.js, zusatz.js, rechnung.js, verkauf.js, arbeit.js, style.css, Manifest. Stand vor der Änderung: Ordner sicherung-1.0.0 (in Imkerei-sicherungen).

| Wunsch | Umsetzung |
|--------|-----------|
| Bestehende Bienenstände im Umkreis berücksichtigen (VIS-Daten sind nicht öffentlich) – ja zur Völkerdichte | Standplätze → 🍯 Potenzial: Das Potenzial wird jetzt auf alle Völker im Flugradius aufgeteilt. Geschätzt mit 5,4 Völkern je km² (Österreich-Schnitt), bei 3 km rund 153 Völker. Die echte Zahl, z. B. von der Ortsgruppe, lässt sich direkt in der Kachel eintragen; die Dichte unter ⚙ Anpassen. |
| Aktuelle Sperrzonen anzeigen | Standplätze → ⚠ Sperrzone → auf der Karte den Ausbruchsort antippen, Radius (3 km vorbelegt), Datum, Geschäftszahl und Link eintragen. Aktive Zonen sind rote Kreise auf der Karte. Liegt ein eigener Standplatz darin, steht eine rote Warnung in der Übersicht und über der Karte; beim Umstellen eines Volkes in eine Zone oder aus einer Zone fragt die App nach. Liste mit „Aufgehoben“-Knopf und Links zu den Listen der Landesverbände (OÖ, Tirol, Kärnten) und zum VIS. |

Hinweise: Eine öffentliche Datenquelle für Sperrzonen gibt es nicht – die Bezirkshauptmannschaften erlassen sie per Verordnung, die Landesverbände führen Listen ohne Koordinaten. Deshalb werden die Zonen selbst eingetragen. Einzelne Bienenstände anderer Imker sind nicht öffentlich (VIS, Datenschutz).

Geändertes Verhalten: Die Kachel „je Volk“ im Trachtpotenzial zeigt jetzt den Anteil bei allen Völkern im Umkreis statt nur bei den eigenen. Fehlen Wetterdaten länger als 20 Sekunden, rechnet die App ohne Trockenheitsfaktor weiter.

Geprüft: Syntax aller Dateien. Im Vorschau-Browser: Sperrzone über den Knopf und Klick auf die Karte eingetragen (Koordinaten, 3 km und Datum vorbelegt), roter Kreis, Warnung über der Karte und in der Übersicht, Rückfrage beim Umstellen verhindert die Wanderung, „Aufgehoben“ beendet die Warnung noch am selben Tag. Trachtpotenzial mit echten Daten: 153 geschätzte Völker → 8–41 kg je Volk, eigene Angabe 60 → 21–105 kg, Leeren kehrt zur Schätzung zurück, ohne die Felder neu zu laden. Nicht geprüft: am echten Handy.

## Version 1.0.0 · 15.10.2026 · Trachtpotenzial, Anpassen, Arbeitszeit, Flugradius, Versionsnummer
Geänderte Dateien: app.js, zusatz.js, rechnung.js, index.html, sw.js, style.css, arbeit.js (neu), anpassen.js (neu), ertrag.js (neu), CHANGELOG.md (neu). Unverändert: fachlogik.js, verkauf.js, Manifest. Stand vor der Änderung: Ordner sicherung-imkerei-v6 (in Imkerei-sicherungen).

| Wunsch | Umsetzung |
|--------|-----------|
| Bei „update“ soll die Version hochgezählt und vorher der alte Stand gesichert werden | Die App trägt jetzt eine Versionsnummer, sichtbar oben neben „Imkerei“. Vor jedem Update wird der Stand, der gerade online ist, nach `Claud_Work/Imkerei-sicherungen/sicherung-<alte Version>` kopiert. |
| Flugradius in der Karte selbst verändern | Standplätze → Feld „Flugradius … km“ über der Karte (0,5 bis 10 km). Die Kreise und die Trachtkarte rechnen mit diesem Radius, auch die Hektar-Angaben. Auch unter ⚙ Anpassen einstellbar. |
| Die App selbst anpassen: Schnellauswahl oben, Reihenfolge, was angezeigt wird, was in welcher Kategorie steht | Neuer Menüpunkt ⚙ Anpassen: Menü oben und Übersicht mit Häkchen ein-/ausblenden und mit ▲▼ sortieren (Daten und Anpassen bleiben immer sichtbar). Für die Übersicht gibt es zusätzlich Kacheln für volle Gläser, Einnahmen, Arbeitszeit und Lagerwert. Eigene Listen für Lager-Kategorien, Finanz-Kategorien, Honigsorten, Behandlungsmittel und Tätigkeiten: hinzufügen, umbenennen (gespeicherte Einträge ziehen mit), löschen (Lagerartikel kommen nach „Sonstiges“), sortieren. Das Lager zeigt die Kategorien in dieser Reihenfolge. |
| Auf Ertrags- bzw. Potenzialkarten zurückgreifen und daraus einen möglichen Honigertrag ableiten – mit dem Wetter der letzten Zeit (z. B. ein halbes Jahr trocken) | Standplätze → „🍯 Potenzial“: Die App holt alle Felder im Flugradius aus den Felddaten der AMA (INVEKOS, 2015 bis heute, Jahr oben wählbar), markiert die Trachtflächen gelb auf der Karte und rechnet Fläche × Honig-Richtwert je Hektar. Dazu der Niederschlag der letzten 6 Monate gegenüber dem Mittel der 10 Jahre davor (bei früheren Jahren März bis August) als Nektarfaktor: 100 % Regen = 1,0, die Hälfte = 0,65. Ergebnis als Spanne für den Flugradius und je Volk am Stand. Sind Honigernten mit diesem Standplatz eingetragen, vergleicht die App sie mit dem Potenzial des Jahres und schätzt daraus den Ertrag „nach deiner Erfahrung“. Die Richtwerte je Kultur lassen sich unter ⚙ Anpassen ändern. |
| Arbeitszeit am Stand mit Start und Ende erfassen, mit Stundenlohn | Start über die Übersicht, über ⏱ Start beim Standplatz oder unter Arbeitszeit. Solange sie läuft, steht oben eine orange Leiste mit der Zeit; „■ Beenden“ öffnet die Buchung mit Beginn, Ende, Pause, Tätigkeit, Volk und Notiz. Neuer Menüpunkt Arbeitszeit: Stunden je Jahr, je Volk, nach Standplatz und Tätigkeit, Stundenlohn und Wert der Arbeit. Unter Finanzen zusätzlich „Ergebnis inkl. Arbeitszeit“ und „Kosten je kg Honig inkl. Arbeit“. |

Hinweise: Das Trachtpotenzial ist die Menge, die die Felder bestenfalls liefern – die Richtwerte sind Faustzahlen und schwanken stark; was die Völker selbst brauchen und was fremde Völker holen, ist nicht abgezogen. Brauchbar wird die Schätzung erst mit dem Abgleich eigener Ernten. Wald (Honigtau), Gärten und Straßenbäume sind nicht enthalten. Die Felder eines Jahres veröffentlicht die AMA erst ab dem Sommer; braucht Internet. Die Arbeitszeit ist kein Geldfluss und erscheint nicht als Ausgabe. Der Stundenlohn wird mit jedem neuen Eintrag gespeichert; Einträge ohne Stundenlohn rechnen mit dem aktuellen. Die Zeitmessung läuft weiter, auch wenn die App geschlossen wird. Anpassungen gelten je Gerät und sind in der Daten-Sicherung enthalten.

Geändertes Verhalten: Die Trachtkarte steht nicht mehr im Feld „Trachtangebot“ – dort stand nach dem Erstellen einer Trachtkarte „[object Object]“ und ein eingetragener Text ging verloren. Vorhandene Trachtkarten werden beim Öffnen übernommen.

Geprüft: Syntax aller Dateien, Versionsnummer in app.js und sw.js gleich, App lädt im Vorschau-Browser mit „v1.0.0“ im Kopf. Im Vorschau-Browser: Übernahme einer alten Trachtkarte, Flugradius 5 km (Kreis 5000 m, Grenzen 0,5/10 km), echte Trachtkarte mit 5 km (OpenStreetMap, 19 s), Zeitmessung über ⏱ am Standplatz und Beenden mit Pause (75 − 10 = 65 min, 16,25 € bei 15 €/h, auch unter Finanzen), Menü ausblenden und umsortieren, Übersicht-Kacheln an/aus und Reihenfolge, Kategorie anlegen/umbenennen/löschen mit Lagerartikeln, Handyansicht 375 px, keine Konsolenfehler. Trachtpotenzial mit echten Daten für einen Standplatz bei St. Pölten (3 km): 2026 → 331 Trachtflächen in 7 s, Niederschlag 58 % des Mittels → Faktor 0,71, 1.259–6.290 kg; 2025 → Faktor 1,07, Abgleich mit einer Test-Ernte; Richtwerte unter Anpassen ändern; Zuordnung der Kulturarten stichprobenartig. Nicht geprüft: am echten Handy, Zeitmessung über mehrere Stunden mit geschlossener App, Trachtpotenzial bei 10 km Flugradius und in Gegenden mit viel Grünland.

## Frühere Stände (vor Einführung der Versionsnummern)

- **14.10.2026** · Rechnung erfassen (PDF oder Foto, Positionen erkennen, Zugang ins Lager, Ausgabe in Finanzen), Menüpunkt Verkauf mit Abfüllung (Honig, leere Gläser, Deckel, Etiketten → volle Gläser) und Verkauf (Gläser vom Lager, Einnahme „Honigverkauf“), Mindestbestand und Verkaufspreis je Sorte, Ernte bucht als loser Honig ins Lager. Zwischenspeicher imkerei-v6.
- **12.10.2026** · Finanzen mit Investitionen und Abschreibung, Bestandsbuch als PDF, Trachtkarte im 3-km-Flugradius, eigene Blühbeobachtungen, Verlaufskurven je Volk, Spracheingabe bei der Durchsicht.
- **12.10.2026** · VIS-Erinnerung mit Link, Bestätigung und täglicher Wiederholung.
- **12.10.2026** · Flachzargen, Arbeiten im Jahreslauf je Beutentyp, Vorschläge aus dem Wetter, Benachrichtigungen.
- **12.10.2026** · Erste Fassung: Stockführung, Lager, Standplätze, Vegetation und Varroa-Zähler.
