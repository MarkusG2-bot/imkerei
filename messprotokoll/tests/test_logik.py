"""Tests der VBA-Rechenlogik (ISO 286, ISO 2768, Grenzwerte, Bewertung).

Aufruf:  python3 tests/test_logik.py
Erwartete Werte stammen aus den Passungstabellen nach ISO 286-2 / ISO 2768-1.
"""
import sys
from vba_laufzeit import VBALaufzeit

HILFS = r'''
Function T_Passung(n As Double, p As String) As String
    Dim o As Double, u As Double, f As String
    If ISO_Abmasse(n, p, o, u, f) Then
        T_Passung = Format(o * 1000, "0.0") & ";" & Format(u * 1000, "0.0")
    Else
        T_Passung = "ERR:" & f
    End If
End Function

Function T_Grenz(art As Variant, nenn As Variant, pas As Variant, ob As Variant, un As Variant) As String
    Dim o As Variant, u As Variant, f As String, so As String, su As String
    If Grenzwerte(art, nenn, pas, ob, un, o, u, f) Then
        If IsEmpty(o) Then so = "-" Else so = Format(o, "0.0000")
        If IsEmpty(u) Then su = "-" Else su = Format(u, "0.0000")
        T_Grenz = so & ";" & su
    Else
        T_Grenz = "ERR:" & f
    End If
End Function

Function T_Bew(ist As Variant, o As Variant, u As Variant) As String
    T_Bew = Bewertung(ist, o, u)
End Function

Function T_Name(s As String) As String
    T_Name = SichererName(s)
End Function

Function T_Gleich(a As Variant, b As Variant) As Boolean
    T_Gleich = WerteGleich(a, b)
End Function
'''

# (Nennmaß, Passung, oberes Abmaß µm, unteres Abmaß µm)
PASSUNGEN = [
    (20, "H7", 21, 0), (20, "h6", 0, -13), (20, "g6", -7, -20), (20, "f7", -20, -41),
    (20, "e8", -40, -73), (20, "d9", -65, -117), (20, "k6", 15, 2), (20, "m6", 21, 8),
    (20, "n6", 28, 15), (20, "p6", 35, 22), (20, "r6", 41, 28), (20, "s6", 48, 35),
    (20, "js6", 6.5, -6.5), (20, "JS7", 10, -10), (20, "K7", 6, -15), (20, "M7", 0, -21),
    (20, "N7", -7, -28), (20, "P7", -14, -35), (20, "S7", -27, -48), (20, "F8", 53, 20),
    (20, "G7", 28, 7), (20, "H11", 130, 0), (20, "h9", 0, -52), (20, "R7", -20, -41),
    (50, "H7", 25, 0), (50, "g6", -9, -25), (50, "k6", 18, 2), (50, "s6", 59, 43),
    (40, "s6", 59, 43), (45, "H8", 39, 0), (45, "f7", -25, -50),
    (10, "H7", 15, 0), (10, "k6", 10, 1), (10, "h6", 0, -9),
    (100, "r6", 73, 51), (100, "s6", 93, 71), (100, "H7", 35, 0), (110, "s6", 101, 79),
    (3, "H7", 10, 0), (3, "k6", 6, 0), (3, "M7", -2, -12), (3, "N7", -4, -14), (3, "P7", -6, -16),
    (6, "H7", 12, 0), (6.01, "H7", 15, 0), (200, "H7", 46, 0), (200, "s6", 151, 122),
    (25, "H6", 13, 0), (25, "K6", 2, -11), (25, "N9", 0, -52), (25, "M8", 4, -29),
    (500, "h7", 0, -63), (12, " h 7 ", 0, -18),
]

FEHLER_PASSUNG = [(20, "X7"), (20, "H"), (20, "H17"), (600, "H7"), (0, "H7"), (20, "7H"), (20, "c11")]

# (Art, Nenn, Passung, oben, unten, erwartet)
GRENZ = [
    ("Maß", 50, "", 0.1, -0.1, "50.1000;49.9000"),
    ("Maß", 50, "", 0.2, "", "50.2000;-"),
    ("Maß", 20, "2768-m", "", "", "20.2000;19.8000"),
    ("Maß", 20, "ISO 2768-f", "", "", "20.1000;19.9000"),
    ("Maß", 2, "m", "", "", "2.1000;1.9000"),
    ("Maß", 150, "ISO 2768-1-c", "", "", "151.2000;148.8000"),
    ("Passung", 20, "H7", "", "", "20.0210;20.0000"),
    ("Passung", 20, "g6", "", "", "19.9930;19.9800"),
    ("Form/Lage", "", "", 0.05, "", "0.0500;-"),
    ("Oberfläche", "", "", 1.6, "", "1.6000;-"),
    ("Attribut", "", "", "", "", "-;-"),
    ("mass", 10, "", 0, -0.02, "10.0000;9.9800"),
]
GRENZ_FEHLER = [
    ("", 10, "", 0.1, -0.1), ("Maß", "", "", 0.1, -0.1), ("Maß", 10, "", "", ""),
    ("Maß", 10, "2768-m", 0.1, ""), ("Maß", 10, "H7", "", ""), ("Passung", 10, "", "", ""),
    ("Passung", 10, "H7", 0.1, ""), ("Form/Lage", "", "", "", ""), ("Form/Lage", "", "", -0.1, ""),
    ("Maß", 10, "", -0.1, 0.1), ("Maß", "abc", "", 0.1, ""), ("Maß", 0.3, "2768-m", "", ""),
    ("Maß", 2, "2768-v", "", ""),
]

BEWERTUNG = [
    (20.01, 20.021, 20.0, "i.O."), (20.021, 20.021, 20.0, "i.O."), (20.0, 20.021, 20.0, "i.O."),
    (20.022, 20.021, 20.0, "n.i.O."), (19.999, 20.021, 20.0, "n.i.O."),
    (0.04, 0.05, "", "i.O."), (0.06, 0.05, "", "n.i.O."), ("", 1, 0, ""),
]


def main():
    vba = VBALaufzeit(["modISO286Daten", "modISO286", "modLogik"], HILFS)
    fehler = []
    try:
        for n, p, o, u in PASSUNGEN:
            erg = vba.aufruf("modTest", "T_Passung", float(n), p).replace(",", ".")
            soll = f"{o:.1f};{u:.1f}"
            if erg != soll:
                fehler.append(f"Passung Ø{n} {p!r}: erwartet {soll}, erhalten {erg}")
        for n, p in FEHLER_PASSUNG:
            erg = vba.aufruf("modTest", "T_Passung", float(n), p)
            if not erg.startswith("ERR:"):
                fehler.append(f"Passung Ø{n} {p!r}: Fehler erwartet, erhalten {erg}")
        for art, n, p, o, u, soll in GRENZ:
            erg = vba.aufruf("modTest", "T_Grenz", art, n, p, o, u).replace(",", ".")
            if erg != soll:
                fehler.append(f"Grenzwerte {art} {n} {p} {o} {u}: erwartet {soll}, erhalten {erg}")
        for art, n, p, o, u in GRENZ_FEHLER:
            erg = vba.aufruf("modTest", "T_Grenz", art, n, p, o, u)
            if not erg.startswith("ERR:"):
                fehler.append(f"Grenzwerte {art} {n} {p} {o} {u}: Fehler erwartet, erhalten {erg}")
        for ist, o, u, soll in BEWERTUNG:
            erg = vba.aufruf("modTest", "T_Bew", ist, o, u)
            if erg != soll:
                fehler.append(f"Bewertung {ist} in [{u}, {o}]: erwartet {soll!r}, erhalten {erg!r}")
        for ein, soll in [("J1567/1", "J1567_1"), ("A:B*C?", "A_B_C_"), (" X12. ", "X12")]:
            erg = vba.aufruf("modTest", "T_Name", ein)
            if erg != soll:
                fehler.append(f"SichererName {ein!r}: erwartet {soll!r}, erhalten {erg!r}")
        for a, b, soll in [(1.0, 1.0, True), (1.0, 1.00001, False), ("H7", "H7 ", True),
                           ("H7", "h7", False), ("", "", True), ("", 0.0, False)]:
            erg = vba.aufruf("modTest", "T_Gleich", a, b)
            if bool(erg) != soll:
                fehler.append(f"WerteGleich {a!r},{b!r}: erwartet {soll}, erhalten {erg}")
    finally:
        vba.ende()

    anzahl = len(PASSUNGEN) + len(FEHLER_PASSUNG) + len(GRENZ) + len(GRENZ_FEHLER) + len(BEWERTUNG) + 9
    if fehler:
        print(f"{len(fehler)} von {anzahl} Prüfungen fehlgeschlagen:")
        for f in fehler:
            print("  -", f)
        sys.exit(1)
    print(f"Alle {anzahl} Prüfungen bestanden.")


if __name__ == "__main__":
    main()
