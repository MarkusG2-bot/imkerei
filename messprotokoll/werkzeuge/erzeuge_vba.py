"""Erzeugt modISO286Daten.bas und die Import-Dateien für Excel.

quellcode/*.bas (UTF-8, für Git)  ->  dateien/vba/*.bas (Windows-1252, CRLF, für Excel-Import)
"""
from pathlib import Path
import iso286_daten as D

BASIS = Path(__file__).resolve().parent.parent
QUELLE = BASIS / "quellcode"
ZIEL = BASIS / "dateien" / "vba"


def _zahl(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def _array(werte):
    return "Array(" + ", ".join(_zahl(w) for w in werte) + ")"


def daten_modul():
    z = [
        'Attribute VB_Name = "modISO286Daten"',
        "Option Explicit",
        "' AUTOMATISCH ERZEUGT aus werkzeuge/iso286_daten.py - nicht von Hand ändern.",
        "' Werte nach ISO 286-1, Nennmaß bis 500 mm.",
        "",
        "' Obere Grenzen der Hauptbereiche (mm)",
        "Public Function ISO_HauptBis() As Variant",
        "    ISO_HauptBis = " + _array(D.HAUPT_BIS),
        "End Function",
        "",
        "' Obere Grenzen der Feinbereiche (mm)",
        "Public Function ISO_FeinBis() As Variant",
        "    ISO_FeinBis = " + _array(D.FEIN_BIS),
        "End Function",
        "",
        "' Grundtoleranzen in Zehntel-Mikrometer je Hauptbereich",
        "Public Function ISO_IT10(ByVal grad As Integer) As Variant",
        "    Select Case grad",
    ]
    for g, w in D.IT.items():
        z.append(f"        Case {g}: ISO_IT10 = " + _array([round(v * 10) for v in w]))
    z += ["        Case Else: ISO_IT10 = Empty", "    End Select", "End Function", ""]

    def tabelle(name, kommentar, daten):
        out = [f"' {kommentar}", f"Public Function {name}(ByVal b As String) As Variant",
               "    Select Case b"]
        for k, w in daten.items():
            out.append(f'        Case "{k}": {name} = ' + _array(w))
        out += [f"        Case Else: {name} = Empty", "    End Select", "End Function", ""]
        return out

    z += tabelle("ISO_WelleES", "Oberes Abmaß es der Wellen in µm je Hauptbereich", D.WELLE_ES)
    z += tabelle("ISO_WelleEI", "Unteres Abmaß ei der Wellen in µm je Hauptbereich (k: nur IT4 bis IT7)", D.WELLE_EI)
    z += tabelle("ISO_WelleEIFein", "Unteres Abmaß ei der Wellen in µm je Feinbereich", D.WELLE_EI_FEIN)
    (QUELLE / "modISO286Daten.bas").write_text("\n".join(z) + "\n", encoding="utf-8")


def import_dateien():
    ZIEL.mkdir(parents=True, exist_ok=True)
    for alt in ZIEL.glob("*.bas"):
        alt.unlink()
    for q in sorted(QUELLE.glob("*.bas")):
        text = q.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\n", "\r\n")
        (ZIEL / q.name).write_bytes(text.encode("cp1252"))




def _vb(v):
    """Python-Wert als VBA-Literal."""
    if v is None or v == "":
        return '""'
    if isinstance(v, str):
        return '"' + v.replace('"', '""') + '"'
    return repr(float(v)) if isinstance(v, float) else str(v)


def selbsttest_modul():
    import sys
    sys.path.insert(0, str(BASIS / "tests"))
    from testfaelle import PASSUNGEN, FEHLER_PASSUNG, GRENZ, GRENZ_FEHLER, BEWERTUNG
    z = [
        'Attribute VB_Name = "modSelbsttest"',
        "Option Explicit",
        "' AUTOMATISCH ERZEUGT aus tests/testfaelle.py - nicht von Hand ändern.",
        "' Prüft die Rechenlogik direkt in Excel (inkl. Ländereinstellungen) und die Dateiablage.",
        "",
        "Private mAnzahl As Long",
        "Private mFehler As String",
        "Private mFehlerAnz As Long",
        "",
        "Public Sub Selbsttest()",
        "    mAnzahl = 0: mFehler = \"\": mFehlerAnz = 0",
        "    Application.StatusBar = \"Selbsttest läuft ...\"",
    ]
    for n, p, o, u in PASSUNGEN:
        z.append(f"    P_Passung {_vb(float(n))}, {_vb(p)}, {_vb(float(o))}, {_vb(float(u))}")
    for n, p in FEHLER_PASSUNG:
        z.append(f"    P_PassungFehler {_vb(float(n))}, {_vb(p)}")
    for art, n, p, o, u, soll in GRENZ:
        so, su = soll.split(";")
        z.append(f"    P_Grenz {_vb(art)}, {_vb(n)}, {_vb(p)}, {_vb(o)}, {_vb(u)}, "
                 f"{_vb('' if so == '-' else float(so))}, {_vb('' if su == '-' else float(su))}")
    for art, n, p, o, u in GRENZ_FEHLER:
        z.append(f"    P_GrenzFehler {_vb(art)}, {_vb(n)}, {_vb(p)}, {_vb(o)}, {_vb(u)}")
    for ist, o, u, soll in BEWERTUNG:
        z.append(f"    P_Bewertung {_vb(ist)}, {_vb(o)}, {_vb(u)}, {_vb(soll)}")
    z += [
        "    P_Statistik",
        "    P_Dateien",
        "    Application.StatusBar = False",
        "    If mFehlerAnz = 0 Then",
        "        MsgBox \"Selbsttest bestanden: alle \" & mAnzahl & \" Prüfungen in Ordnung.\", vbInformation, \"Selbsttest\"",
        "    Else",
        "        MsgBox mFehlerAnz & \" von \" & mAnzahl & \" Prüfungen fehlgeschlagen:\" & vbLf & vbLf & mFehler & vbLf & _",
        "            \"Bitte diese Meldung abfotografieren und melden.\", vbCritical, \"Selbsttest\"",
        "    End If",
        "End Sub",
        "",
    ]
    z += r'''Private Sub Melde(ByVal ok As Boolean, ByVal text As String)
    mAnzahl = mAnzahl + 1
    If Not ok Then
        mFehlerAnz = mFehlerAnz + 1
        If mFehlerAnz <= 12 Then mFehler = mFehler & text & vbLf
    End If
End Sub

Private Function Gleich(ByVal a As Variant, ByVal b As Variant) As Boolean
    If IstLeer(a) And IstLeer(b) Then Gleich = True: Exit Function
    If IstZahl(a) And IstZahl(b) Then Gleich = (Abs(CDbl(a) - CDbl(b)) < 0.0000005): Exit Function
    Gleich = (TextVon(a) = TextVon(b))
End Function

Private Sub P_Passung(ByVal n As Double, ByVal p As String, ByVal o As Double, ByVal u As Double)
    Dim ao As Double, au As Double, f As String, ok As Boolean
    ok = ISO_Abmasse(n, p, ao, au, f)
    If ok Then ok = (Abs(ao * 1000 - o) < 0.001 And Abs(au * 1000 - u) < 0.001)
    Melde ok, "Passung " & n & " " & p & ": erwartet " & o & "/" & u & " µm, erhalten " & ao * 1000 & "/" & au * 1000 & " " & f
End Sub

Private Sub P_PassungFehler(ByVal n As Double, ByVal p As String)
    Dim ao As Double, au As Double, f As String
    Melde Not ISO_Abmasse(n, p, ao, au, f), "Passung " & n & " " & p & ": Fehler erwartet"
End Sub

Private Sub P_Grenz(ByVal art As Variant, ByVal nenn As Variant, ByVal pas As Variant, ByVal ob As Variant, _
        ByVal un As Variant, ByVal erwO As Variant, ByVal erwU As Variant)
    Dim o As Variant, u As Variant, f As String, ok As Boolean
    ok = Grenzwerte(art, nenn, pas, ob, un, o, u, f)
    If ok Then ok = Gleich(o, erwO) And Gleich(u, erwU)
    Melde ok, "Grenzwerte " & art & " " & nenn & " " & pas & ": erwartet " & erwO & "/" & erwU & ", erhalten " & TextVon(o) & "/" & TextVon(u) & " " & f
End Sub

Private Sub P_GrenzFehler(ByVal art As Variant, ByVal nenn As Variant, ByVal pas As Variant, ByVal ob As Variant, ByVal un As Variant)
    Dim o As Variant, u As Variant, f As String
    Melde Not Grenzwerte(art, nenn, pas, ob, un, o, u, f), "Grenzwerte " & art & " " & nenn & " " & pas & ": Fehler erwartet"
End Sub

Private Sub P_Bewertung(ByVal ist As Variant, ByVal o As Variant, ByVal u As Variant, ByVal soll As String)
    Dim b As String
    b = Bewertung(ist, o, u)
    Melde b = soll, "Bewertung " & ist & ": erwartet " & soll & ", erhalten " & b
End Sub

Private Sub P_Statistik()
    Dim w As Variant, m As Double, s As Double, mn As Double, mx As Double, cp As Variant, cpk As Variant
    w = Array(20.01, 20.012, 20.008, 20.011, 20.009)
    Statistik w, 5, m, s, mn, mx
    Melde Abs(m - 20.01) < 0.0000001 And Abs(s - 0.00158113883) < 0.0000001 And mn = 20.008 And mx = 20.012, _
        "Statistik: " & m & " / " & s
    Faehigkeit 20.0105, 0.002, 20.021, 20#, cp, cpk
    Melde Abs(cp - 1.75) < 0.0001 And Abs(cpk - 1.75) < 0.0001, "Cp/Cpk: " & TextVon(cp) & " / " & TextVon(cpk)
    Melde MessmittelStatus(DateSerial(2025, 1, 1), 12, DateSerial(2026, 10, 17), cp) = "abgelaufen", "Messmittelstatus abgelaufen"
    Melde BewertungMerkmal("Attribut", "nio", "", "") = "n.i.O.", "Attribut n.i.O."
End Sub

' Schreibt und liest ein Protokoll im TEMP-Ordner (Umlaute, Dezimalzahlen, Datum)
Private Sub P_Dateien()
    Dim k(1 To 15) As Variant, d(1 To 2, 1 To 18) As Variant, p As String
    Dim k2 As Variant, d2 As Variant, n As Long, ok As Boolean
    On Error GoTo Fehler
    p = Environ("TEMP") & "\messprotokoll_selbsttest\test.csv"
    k(1) = "J1567/1": k(2) = "TEST": k(5) = "Müller Ölwerk GmbH": k(7) = "In Arbeit"
    k(10) = DateSerial(2026, 10, 17) + TimeSerial(13, 45, 30)
    d(1, 1) = "1": d(1, 2) = "Durchmesser Ø": d(1, 4) = 20: d(1, 6) = 20.021: d(1, 7) = 20: d(1, 8) = 20.0105
    d(2, 1) = "2": d(2, 2) = "Gewinde": d(2, 3) = "Attribut": d(2, 8) = "i.O.": d(2, 15) = -0.0005
    SchreibeProtokoll p, k, d, 2
    ok = LiesProtokoll(p, k2, d2, n)
    If ok Then ok = (n = 2 And k2(1) = "J1567/1" And k2(5) = "Müller Ölwerk GmbH" And _
        k2(10) = k(10) And d2(1, 2) = "Durchmesser Ø" And Abs(d2(1, 8) - 20.0105) < 0.0000001 And _
        Abs(d2(1, 6) - 20.021) < 0.0000001 And d2(2, 8) = "i.O." And Abs(d2(2, 15) + 0.0005) < 0.0000001)
    Melde ok, "Protokoll-Datei schreiben/lesen (" & p & ")"
    DateiLoeschen p
    Exit Sub
Fehler:
    Melde False, "Protokoll-Datei: " & Err.Description
End Sub
'''.splitlines()
    (QUELLE / "modSelbsttest.bas").write_text("\n".join(z) + "\n", encoding="utf-8")


def thisworkbook_datei():
    q = QUELLE / "DieseArbeitsmappe.txt"
    text = q.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\n", "\r\n")
    (ZIEL / q.name).write_bytes(text.encode("cp1252"))


def alles():
    daten_modul()
    selbsttest_modul()
    import_dateien()
    thisworkbook_datei()


if __name__ == "__main__":
    alles()
    print("VBA-Dateien erzeugt:", ", ".join(p.name for p in sorted(ZIEL.glob("*.bas"))))
