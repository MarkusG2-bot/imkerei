"""Liest alle Testdaten-Protokolle mit dem VBA-Code und vergleicht Cpk mit Python.

Aufruf: python3 tests/test_testdaten.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "werkzeuge"))
import protokoll_csv as P  # noqa: E402
from vba_laufzeit import VBALaufzeit  # noqa: E402

TD = Path(__file__).resolve().parent.parent / "dateien" / "testdaten"

HILFS = r'''
Function T_Cpk(ordner As String, nr As String) As String
    Dim liste As String, f As Variant, k As Variant, d As Variant, n As Long, z As Long
    Dim w() As Double, anz As Long, ogw As Variant, ugw As Variant, m As Double, s As Double
    Dim mn As Double, mx As Double, cp As Variant, cpk As Variant, nio As Long, dateien As Long
    ReDim w(1 To 1000)
    liste = DateiListe(ordner, "*.csv")
    For Each f In Split(liste, vbLf)
        If LiesProtokoll(ordner & "/" & f, k, d, n) Then
            dateien = dateien + 1
            If n <> 15 Or k(K_STATUS) <> "Abgeschlossen" Then T_Cpk = "FALSCH " & f: Exit Function
            For z = 1 To n
                If d(z, M_NR) = nr And IstZahl(d(z, M_IST)) Then
                    anz = anz + 1
                    w(anz) = d(z, M_IST)
                    ogw = d(z, M_OGW): ugw = d(z, M_UGW)
                    If BewertungMerkmal(d(z, M_ART), d(z, M_IST), ogw, ugw) = "n.i.O." Then nio = nio + 1
                End If
            Next z
        End If
    Next f
    Statistik w, anz, m, s, mn, mx
    Faehigkeit m, s, ogw, ugw, cp, cpk
    T_Cpk = dateien & ";" & anz & ";" & CsvFeld(Round(m, 6)) & ";" & CsvFeld(Round(s, 6)) & ";" & _
        IIf(IsEmpty(cp), "-", CsvFeld(Round(cp, 3))) & ";" & IIf(IsEmpty(cpk), "-", CsvFeld(Round(cpk, 3))) & ";" & nio
End Function

Function T_Kopf(pfad As String) As String
    Dim k As Variant, d As Variant, n As Long, z As Long, nio As Long, offen As Long, b As String
    If Not LiesProtokoll(pfad, k, d, n) Then T_Kopf = "FEHLER": Exit Function
    For z = 1 To n
        b = BewertungMerkmal(d(z, M_ART), d(z, M_IST), d(z, M_OGW), d(z, M_UGW))
        If b = "n.i.O." Then
            nio = nio + 1
            If TextVon(d(z, M_ENTSCHEIDUNG)) = "" Then offen = offen + 1
        End If
    Next z
    T_Kopf = k(K_PRODUKT) & ";" & k(K_STATUS) & ";" & n & ";" & nio & ";" & offen
End Function
'''


def py_cpk(nr):
    werte, ogw, ugw, nio = [], None, None, 0
    for f in sorted((TD / "Daten/Archiv/2026/DEMO-100").glob("*.csv")):
        for k, m in P.lesen(f):
            if m["Nr"] == nr and m["Istwert"]:
                x = float(m["Istwert"])
                werte.append(x)
                ogw = float(m["OGW"]) if m["OGW"] else None
                ugw = float(m["UGW"]) if m["UGW"] else None
                if (ogw is not None and x > ogw + 1e-7) or (ugw is not None and x < ugw - 1e-7):
                    nio += 1
    n = len(werte)
    mw = sum(werte) / n
    s = math.sqrt(sum((x - mw) ** 2 for x in werte) / (n - 1))
    cp = (ogw - ugw) / (6 * s) if ogw is not None and ugw is not None else None
    seiten = [v for v in ((ogw - mw) / (3 * s) if ogw is not None else None,
                          (mw - ugw) / (3 * s) if ugw is not None else None) if v is not None]
    return n, mw, s, cp, min(seiten), nio


def main():
    fehler, anzahl = [], 0
    vba = VBALaufzeit(["modISO286Daten", "modISO286", "modLogik", "modDateien"], HILFS)
    try:
        archiv = str(TD / "Daten/Archiv/2026/DEMO-100")
        for nr in ["1", "2", "3", "5", "8", "10", "12", "13"]:
            anzahl += 1
            erg = vba.aufruf("modTest", "T_Cpk", archiv, nr).split(";")
            n, mw, s, cp, cpk, nio = py_cpk(nr)
            ok = (erg[0] == "30" and int(erg[1]) == n and abs(float(erg[2]) - mw) < 1e-5
                  and abs(float(erg[3]) - s) < 1e-5 and int(erg[6]) == nio
                  and (erg[4] == "-" if cp is None else abs(float(erg[4]) - cp) < 0.002)
                  and abs(float(erg[5]) - cpk) < 0.002)
            print(f"  Merkmal {nr:>2}: n={n} Cpk={cpk:.2f} n.i.O.={nio}  VBA: {';'.join(erg)}")
            if not ok:
                fehler.append(f"Merkmal {nr}: Python n={n} m={mw:.6f} s={s:.6f} cp={cp} cpk={cpk:.3f} nio={nio}, VBA {erg}")
        for rel, soll in [("Daten/Freigabe/J1567_31.csv", "J1567/31;Wartet auf Freigabe;15;1;1"),
                          ("Daten/Entwurf/J1567_32.csv", "J1567/32;Nacharbeit;15;1;0"),
                          ("Daten/Entwurf/J1567_33.csv", "J1567/33;In Arbeit;15;0;0")]:
            anzahl += 1
            erg = vba.aufruf("modTest", "T_Kopf", str(TD / rel))
            if erg != soll:
                fehler.append(f"{rel}: erwartet {soll}, erhalten {erg}")
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
