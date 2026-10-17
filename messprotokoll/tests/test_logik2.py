"""Tests: Messung, Statistik, Messmittel, Protokoll-Dateien (VBA in LibreOffice).

Aufruf:  python3 tests/test_logik2.py
"""
import math
import random
import sys
import tempfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "werkzeuge"))
import protokoll_csv as P  # noqa: E402
from vba_laufzeit import VBALaufzeit  # noqa: E402

HILFS = r'''
Function T_BewM(art As Variant, ist As Variant, o As Variant, u As Variant) As String
    T_BewM = BewertungMerkmal(art, ist, o, u)
End Function

Function T_Status(b As String, e As String) As String
    Dim erg As String, offen As Long, s As String
    s = Abschlussstatus(Split(b, ","), Split(e, ","), erg, offen)
    T_Status = s & "|" & erg & "|" & offen
End Function

Function T_Stat(w As String) As String
    Dim a As Variant, m As Double, s As Double, mn As Double, mx As Double
    a = Split(w, ",")
    Dim i As Long
    For i = 0 To UBound(a): a(i) = Val(a(i)): Next i
    Statistik a, UBound(a) + 1, m, s, mn, mx
    T_Stat = CsvFeld(Round(m, 6)) & ";" & CsvFeld(Round(s, 6)) & ";" & CsvFeld(mn) & ";" & CsvFeld(mx)
End Function

Function T_Faeh(m As Double, s As Double, o As Variant, u As Variant) As String
    Dim cp As Variant, cpk As Variant
    Faehigkeit m, s, o, u, cp, cpk
    If IsEmpty(cp) Then T_Faeh = "-" Else T_Faeh = CsvFeld(Round(cp, 4))
    If IsEmpty(cpk) Then T_Faeh = T_Faeh & ";-" Else T_Faeh = T_Faeh & ";" & CsvFeld(Round(cpk, 4))
End Function

Function T_FText(cpk As Variant, n As Long) As String
    T_FText = FaehigkeitText(cpk, n)
End Function

Function T_MM(letzte As String, intervall As Variant, stichtag As String) As String
    Dim nx As Variant, l As Variant
    If letzte = "" Then l = Empty Else l = DatumLesen(letzte)
    T_MM = MessmittelStatus(l, intervall, DatumLesen(stichtag), nx)
    If Not IsEmpty(nx) Then T_MM = T_MM & ";" & Left(DatumText(nx), 10)
End Function

Function T_Schreiben(pfad As String) As Boolean
    Dim k(1 To 15) As Variant, d(1 To 3, 1 To 18) As Variant
    k(1) = "J1567/1": k(2) = "DEMO-100": k(3) = "Welle; lang": k(4) = "A-77": k(5) = "Kunde Müller"
    k(6) = "A": k(7) = "Abgeschlossen": k(8) = "i.O. mit Sonderfreigabe": k(9) = "Max Prüfer"
    k(10) = DateSerial(2026, 10, 17) + TimeSerial(8, 5, 9): k(11) = DateSerial(2026, 10, 17) + TimeSerial(9, 0, 0)
    k(14) = "MS-01": k(15) = "1.0.0"
    d(1, 1) = "1": d(1, 2) = "Durchmesser": d(1, 3) = "Passung": d(1, 4) = 20: d(1, 5) = "g6"
    d(1, 6) = 19.993: d(1, 7) = 19.98: d(1, 8) = 19.9875: d(1, 9) = "i.O.": d(1, 10) = "BM-02"
    d(2, 1) = "2": d(2, 2) = "Länge": d(2, 3) = "Maß": d(2, 4) = 50: d(2, 6) = 50.1: d(2, 7) = 49.9
    d(2, 8) = 50.12: d(2, 9) = "n.i.O.": d(2, 11) = "Sonderfreigabe": d(2, 12) = "Kunde informiert" & vbLf & "OK"
    d(2, 13) = "QS Chef": d(2, 14) = DateSerial(2026, 10, 17) + TimeSerial(8, 59, 0): d(2, 15) = -0.0005
    d(3, 1) = "3": d(3, 2) = "Gewinde": d(3, 3) = "Attribut": d(3, 8) = "i.O.": d(3, 9) = "i.O.": d(3, 17) = "ja"
    SchreibeProtokoll pfad, k, d, 3
    T_Schreiben = True
End Function

Function T_Lesen(pfad As String) As String
    Dim k As Variant, d As Variant, n As Long, z As Long, s As String
    If Not LiesProtokoll(pfad, k, d, n) Then T_Lesen = "FEHLER": Exit Function
    s = n & "|" & k(1) & "|" & k(2) & "|" & k(7) & "|" & DatumText(k(10)) & "|" & TypeName(k(12))
    For z = 1 To n
        s = s & "|" & d(z, 1) & ":" & TypeName(d(z, 8)) & "=" & CsvFeld(d(z, 8)) & ":" & TypeName(d(z, 6)) & ":" & CsvFeld(d(z, 6))
    Next z
    T_Lesen = s
End Function

Function T_Pfade(p As String, a As String) As String
    T_Pfade = ProtokollRelPfad("Abgeschlossen", p, a, DateSerial(2026, 3, 1)) & "|" & _
        ProtokollRelPfad("Wartet auf Freigabe", p, a, Empty) & "|" & ProtokollRelPfad("In Arbeit", p, a, Empty) & "|" & _
        PdfRelPfad(p, a, DateSerial(2025, 1, 1)) & "|" & IndexRelPfad(p) & "|" & SperreRelPfad(p)
End Function

Function T_Sperre(pfad As String) As String
    Dim wer As String, seit As Date
    SperreSetzen pfad, "mueller"
    If SperreLesen(pfad, wer, seit) Then T_Sperre = wer & "|" & (Abs(Now - seit) < 0.01)
End Function

Function T_Liste(ordner As String) As String
    T_Liste = Replace(DateiListe(ordner, "*.csv"), vbLf, ",") & "|" & Replace(OrdnerListe(ordner), vbLf, ",")
End Function

Function T_OrdnerAnlegen(p As String) As Boolean
    OrdnerAnlegen p
    T_OrdnerAnlegen = OrdnerExistiert(p)
End Function
'''


def main():
    vba = VBALaufzeit(["modISO286Daten", "modISO286", "modLogik", "modDateien"], HILFS)
    fehler = []
    anzahl = 0

    def pruefe(name, erg, soll):
        nonlocal anzahl
        anzahl += 1
        if erg != soll:
            fehler.append(f"{name}: erwartet {soll!r}, erhalten {erg!r}")

    try:
        a = lambda f, *x: vba.aufruf("modTest", f, *x)  # noqa: E731
        # Bewertung je Art
        for art, ist, o, u, soll in [
            ("Maß", 50.05, 50.1, 49.9, "i.O."), ("Maß", 50.2, 50.1, 49.9, "n.i.O."),
            ("Maß", "", 50.1, 49.9, ""), ("Maß", "abc", 50.1, 49.9, "ungültig"),
            ("Attribut", "i.O.", "", "", "i.O."), ("Attribut", "io", "", "", "i.O."),
            ("Attribut", "n.i.O.", "", "", "n.i.O."), ("Attribut", "NIO", "", "", "n.i.O."),
            ("Attribut", "ok", "", "", "i.O."), ("Attribut", "x", "", "", "ungültig"),
            ("Form/Lage", 0.03, 0.05, "", "i.O."), ("Form/Lage", 0.06, 0.05, "", "n.i.O."),
        ]:
            pruefe(f"BewertungMerkmal {art} {ist}", a("T_BewM", art, ist, o, u), soll)
        # Abschlussstatus
        for b, e, soll in [
            ("i.O.,i.O.", ",", "Abgeschlossen|i.O.|0"),
            ("i.O.,n.i.O.", ",", "Wartet auf Freigabe||1"),
            ("i.O.,n.i.O.", ",Nacharbeit", "Nacharbeit||0"),
            ("n.i.O.,n.i.O.", "Nacharbeit,", "Wartet auf Freigabe||1"),
            ("n.i.O.,n.i.O.", "Sonderfreigabe,Sonderfreigabe", "Abgeschlossen|i.O. mit Sonderfreigabe|0"),
            ("n.i.O.,n.i.O.", "Sonderfreigabe,Nacharbeit", "Nacharbeit||0"),
            ("n.i.O.,n.i.O.", "Ausschuss,", "Abgeschlossen|Ausschuss|1"),
            ("i.O.,i.O.", "Nacharbeit,", "Abgeschlossen|i.O.|0"),
        ]:
            pruefe(f"Abschlussstatus {b} / {e}", a("T_Status", b, e), soll)
        # Statistik gegen Python
        random.seed(3)
        werte = [round(random.gauss(20.0, 0.004), 4) for _ in range(40)]
        m = sum(werte) / len(werte)
        s = math.sqrt(sum((x - m) ** 2 for x in werte) / (len(werte) - 1))
        erg = a("T_Stat", ",".join(str(x) for x in werte)).split(";")
        anzahl += 1
        if not (abs(float(erg[0]) - m) < 1e-5 and abs(float(erg[1]) - s) < 1e-5
                and float(erg[2]) == min(werte) and float(erg[3]) == max(werte)):
            fehler.append(f"Statistik: erwartet {m},{s},{min(werte)},{max(werte)}, erhalten {erg}")
        # Fähigkeit
        pruefe("Cp/Cpk beidseitig", a("T_Faeh", 20.0, 0.002, 20.021, 20.0), "1.75;0")
        pruefe("Cp/Cpk mittig", a("T_Faeh", 20.0105, 0.002, 20.021, 20.0), "1.75;1.75")
        pruefe("Cpk nur oben", a("T_Faeh", 0.02, 0.005, 0.05, ""), "-;2")
        pruefe("Cpk s=0", a("T_Faeh", 1.0, 0.0, 2.0, 0.0), "-;-")
        for cpk, n, soll in [(2.0, 30, "sehr gut"), (1.4, 30, "fähig"), (1.1, 30, "bedingt fähig"),
                             (0.8, 30, "nicht fähig"), (1.4, 10, "fähig (unter 25 Werte)"), (1.4, 1, "zu wenig Werte")]:
            pruefe(f"FaehigkeitText {cpk} {n}", a("T_FText", cpk, n), soll)
        # Messmittel
        pruefe("MM gültig", a("T_MM", "2026-01-15", 12, "2026-10-17"), "gültig;2027-01-15")
        pruefe("MM bald", a("T_MM", "2025-11-01", 12, "2026-10-17"), "bald fällig;2026-11-01")
        pruefe("MM abgelaufen", a("T_MM", "2025-01-01", 12, "2026-10-17"), "abgelaufen;2026-01-01")
        pruefe("MM ohne Daten", a("T_MM", "", 12, "2026-10-17"), "keine Kalibrierdaten")
        pruefe("MM ohne Intervall", a("T_MM", "2026-01-01", "", "2026-10-17"), "keine Kalibrierdaten")
        # Pfade
        pruefe("Ablagepfade", a("T_Pfade", "J1567/1", "DEMO:100"),
               r"Daten\Archiv\2026\DEMO_100\J1567_1.csv|Daten\Freigabe\J1567_1.csv|Daten\Entwurf\J1567_1.csv|"
               r"PDF\2025\DEMO_100\J1567_1.pdf|System\Index\J1567_1.txt|System\Sperren\J1567_1.lock")

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            # VBA schreibt, Python liest
            a("T_Schreiben", str(tmp / "vba.csv"))
            daten = P.lesen(tmp / "vba.csv")
            pruefe("VBA→Python Anzahl", len(daten), 3)
            k, m1 = daten[0]
            pruefe("VBA→Python Kopf", (k["Produktnummer"], k["Bezeichnung"], k["Kunde"], k["Begonnen"], k["Geändert von"]),
                   ("J1567/1", "Welle, lang", "Kunde Müller", "2026-10-17 08:05:09", ""))
            pruefe("VBA→Python Zahlen", (m1["Nennmaß"], m1["OGW"], m1["Istwert"]), ("20", "19.993", "19.9875"))
            m2 = daten[1][1]
            pruefe("VBA→Python Zeile 2", (m2["Begründung"], m2["Vorwert"], m2["Entschieden am"]),
                   ("Kunde informiert OK", "-0.0005", "2026-10-17 08:59:00"))
            pruefe("VBA→Python Attribut", daten[2][1]["Istwert"], "i.O.")
            # Python schreibt, VBA liest
            P.schreiben(tmp / "py.csv",
                        {"Produktnummer": "X-9", "Artikelnummer": "A1", "Status": "In Arbeit",
                         "Begonnen": datetime(2026, 5, 4, 3, 2, 1)},
                        [{"Nr": "10", "Merkmal": "Bohrung", "Art": "Passung", "OGW": 20.021, "Istwert": 20.0105},
                         {"Nr": "11", "Merkmal": "Gewinde", "Art": "Attribut", "Istwert": "n.i.O."},
                         {"Nr": "12", "Merkmal": "Fase", "Art": "Maß", "OGW": 0.5}])
            pruefe("Python→VBA", a("T_Lesen", str(tmp / "py.csv")),
                   "3|X-9|A1|In Arbeit|2026-05-04 03:02:01|Empty|10:Double=20.0105:Double:20.021|"
                   "11:String=n.i.O.:Empty:|12:Empty=:Double:0.5")
            # VBA liest eigene Datei
            pruefe("VBA→VBA", a("T_Lesen", str(tmp / "vba.csv")).split("|")[:6],
                   ["3", "J1567/1", "DEMO-100", "Abgeschlossen", "2026-10-17 08:05:09", "Empty"])
            # Überschreiben
            a("T_Schreiben", str(tmp / "vba.csv"))
            pruefe("Überschreiben", len(P.lesen(tmp / "vba.csv")), 3)
            # Sperren, Listen, Ordner
            pruefe("Sperre", a("T_Sperre", str(tmp / "s" / "x.lock")), "mueller|True")
            (tmp / "unter").mkdir()
            dl, ol = a("T_Liste", str(tmp)).split("|")
            pruefe("Dateiliste", (sorted(dl.split(",")), sorted(ol.split(","))), (["py.csv", "vba.csv"], ["s", "unter"]))
            pruefe("Ordner anlegen", a("T_OrdnerAnlegen", str(tmp / "a" / "b" / "c")), True)
    finally:
        vba.ende()

    if fehler:
        print(f"{len(fehler)} von {anzahl} Prüfungen fehlgeschlagen:")
        for f in fehler:
            print("  -", f)
        sys.exit(1)
    print(f"Alle {anzahl} Prüfungen bestanden.")


if __name__ == "__main__":
    main()
