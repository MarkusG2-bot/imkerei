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

from testfaelle import PASSUNGEN, FEHLER_PASSUNG, GRENZ, GRENZ_FEHLER, BEWERTUNG  # noqa: E402


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
