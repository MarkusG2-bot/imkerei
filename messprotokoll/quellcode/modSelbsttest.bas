Attribute VB_Name = "modSelbsttest"
Option Explicit
' AUTOMATISCH ERZEUGT aus tests/testfaelle.py - nicht von Hand ändern.
' Prüft die Rechenlogik direkt in Excel (inkl. Ländereinstellungen) und die Dateiablage.

Private mAnzahl As Long
Private mFehler As String
Private mFehlerAnz As Long

Public Sub Selbsttest()
    mAnzahl = 0: mFehler = "": mFehlerAnz = 0
    Application.StatusBar = "Selbsttest läuft ..."
    P_Passung 20.0, "H7", 21.0, 0.0
    P_Passung 20.0, "h6", 0.0, -13.0
    P_Passung 20.0, "g6", -7.0, -20.0
    P_Passung 20.0, "f7", -20.0, -41.0
    P_Passung 20.0, "e8", -40.0, -73.0
    P_Passung 20.0, "d9", -65.0, -117.0
    P_Passung 20.0, "k6", 15.0, 2.0
    P_Passung 20.0, "m6", 21.0, 8.0
    P_Passung 20.0, "n6", 28.0, 15.0
    P_Passung 20.0, "p6", 35.0, 22.0
    P_Passung 20.0, "r6", 41.0, 28.0
    P_Passung 20.0, "s6", 48.0, 35.0
    P_Passung 20.0, "js6", 6.5, -6.5
    P_Passung 20.0, "JS7", 10.0, -10.0
    P_Passung 20.0, "K7", 6.0, -15.0
    P_Passung 20.0, "M7", 0.0, -21.0
    P_Passung 20.0, "N7", -7.0, -28.0
    P_Passung 20.0, "P7", -14.0, -35.0
    P_Passung 20.0, "S7", -27.0, -48.0
    P_Passung 20.0, "F8", 53.0, 20.0
    P_Passung 20.0, "G7", 28.0, 7.0
    P_Passung 20.0, "H11", 130.0, 0.0
    P_Passung 20.0, "h9", 0.0, -52.0
    P_Passung 20.0, "R7", -20.0, -41.0
    P_Passung 50.0, "H7", 25.0, 0.0
    P_Passung 50.0, "g6", -9.0, -25.0
    P_Passung 50.0, "k6", 18.0, 2.0
    P_Passung 50.0, "s6", 59.0, 43.0
    P_Passung 40.0, "s6", 59.0, 43.0
    P_Passung 45.0, "H8", 39.0, 0.0
    P_Passung 45.0, "f7", -25.0, -50.0
    P_Passung 10.0, "H7", 15.0, 0.0
    P_Passung 10.0, "k6", 10.0, 1.0
    P_Passung 10.0, "h6", 0.0, -9.0
    P_Passung 100.0, "r6", 73.0, 51.0
    P_Passung 100.0, "s6", 93.0, 71.0
    P_Passung 100.0, "H7", 35.0, 0.0
    P_Passung 110.0, "s6", 101.0, 79.0
    P_Passung 3.0, "H7", 10.0, 0.0
    P_Passung 3.0, "k6", 6.0, 0.0
    P_Passung 3.0, "M7", -2.0, -12.0
    P_Passung 3.0, "N7", -4.0, -14.0
    P_Passung 3.0, "P7", -6.0, -16.0
    P_Passung 6.0, "H7", 12.0, 0.0
    P_Passung 6.01, "H7", 15.0, 0.0
    P_Passung 200.0, "H7", 46.0, 0.0
    P_Passung 200.0, "s6", 151.0, 122.0
    P_Passung 25.0, "H6", 13.0, 0.0
    P_Passung 25.0, "K6", 2.0, -11.0
    P_Passung 25.0, "N9", 0.0, -52.0
    P_Passung 25.0, "M8", 4.0, -29.0
    P_Passung 500.0, "h7", 0.0, -63.0
    P_Passung 12.0, " h 7 ", 0.0, -18.0
    P_PassungFehler 20.0, "X7"
    P_PassungFehler 20.0, "H"
    P_PassungFehler 20.0, "H17"
    P_PassungFehler 600.0, "H7"
    P_PassungFehler 0.0, "H7"
    P_PassungFehler 20.0, "7H"
    P_PassungFehler 20.0, "c11"
    P_Grenz "Maß", 50, "", 0.1, -0.1, 50.1, 49.9
    P_Grenz "Maß", 50, "", 0.2, "", 50.2, ""
    P_Grenz "Maß", 20, "2768-m", "", "", 20.2, 19.8
    P_Grenz "Maß", 20, "ISO 2768-f", "", "", 20.1, 19.9
    P_Grenz "Maß", 2, "m", "", "", 2.1, 1.9
    P_Grenz "Maß", 150, "ISO 2768-1-c", "", "", 151.2, 148.8
    P_Grenz "Passung", 20, "H7", "", "", 20.021, 20.0
    P_Grenz "Passung", 20, "g6", "", "", 19.993, 19.98
    P_Grenz "Form/Lage", "", "", 0.05, "", 0.05, ""
    P_Grenz "Oberfläche", "", "", 1.6, "", 1.6, ""
    P_Grenz "Attribut", "", "", "", "", "", ""
    P_Grenz "mass", 10, "", 0, -0.02, 10.0, 9.98
    P_GrenzFehler "", 10, "", 0.1, -0.1
    P_GrenzFehler "Maß", "", "", 0.1, -0.1
    P_GrenzFehler "Maß", 10, "", "", ""
    P_GrenzFehler "Maß", 10, "2768-m", 0.1, ""
    P_GrenzFehler "Maß", 10, "H7", "", ""
    P_GrenzFehler "Passung", 10, "", "", ""
    P_GrenzFehler "Passung", 10, "H7", 0.1, ""
    P_GrenzFehler "Form/Lage", "", "", "", ""
    P_GrenzFehler "Form/Lage", "", "", -0.1, ""
    P_GrenzFehler "Maß", 10, "", -0.1, 0.1
    P_GrenzFehler "Maß", "abc", "", 0.1, ""
    P_GrenzFehler "Maß", 0.3, "2768-m", "", ""
    P_GrenzFehler "Maß", 2, "2768-v", "", ""
    P_Bewertung 20.01, 20.021, 20.0, "i.O."
    P_Bewertung 20.021, 20.021, 20.0, "i.O."
    P_Bewertung 20.0, 20.021, 20.0, "i.O."
    P_Bewertung 20.022, 20.021, 20.0, "n.i.O."
    P_Bewertung 19.999, 20.021, 20.0, "n.i.O."
    P_Bewertung 0.04, 0.05, "", "i.O."
    P_Bewertung 0.06, 0.05, "", "n.i.O."
    P_Bewertung "", 1, 0, ""
    P_Statistik
    P_Dateien
    Application.StatusBar = False
    If mFehlerAnz = 0 Then
        MsgBox "Selbsttest bestanden: alle " & mAnzahl & " Prüfungen in Ordnung.", vbInformation, "Selbsttest"
    Else
        MsgBox mFehlerAnz & " von " & mAnzahl & " Prüfungen fehlgeschlagen:" & vbLf & vbLf & mFehler & vbLf & _
            "Bitte diese Meldung abfotografieren und melden.", vbCritical, "Selbsttest"
    End If
End Sub

Private Sub Melde(ByVal ok As Boolean, ByVal text As String)
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
