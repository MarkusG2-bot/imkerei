Attribute VB_Name = "modAuswertung"
Option Explicit
' Auswertung je Artikel: Mittelwert, Streuung, Cp/Cpk je Merkmal, Verlauf

Private Const AW_ERSTE As Long = 11
Private Const AW_SPALTEN As Long = 14
Private Const VERLAUF_SPALTE As Long = 30      ' Hilfsdaten für das Diagramm ab Spalte AD

Private Function AW() As Worksheet
    Set AW = ThisWorkbook.Worksheets(BLATT_AUSWERTUNG)
End Function

' Sammelt alle abgeschlossenen Protokolle eines Artikels.
' Ergebnis: Dictionary Schlüssel (Nr|OGW|UGW) -> Collection von Array(Datum, Wert, Produktnummer)
'           info: Schlüssel -> Array(Nr, Merkmal, Art, OGW, UGW, n.i.O.-Anzahl)
Private Function Sammeln(ByVal art As String, ByVal stand As String, ByVal von As Variant, ByVal bis As Variant, _
        ByRef info As Object, ByRef reihenfolge As Collection, ByRef zaehler As Variant) As Object
    Dim werte As Object, jahre As String, j As Variant, ordner As String, dateien As String, f As Variant
    Dim kopf As Variant, daten As Variant, n As Long, z As Long, k As String, d As Variant, e As Variant
    Dim erg As String

    Set werte = CreateObject("Scripting.Dictionary")
    Set info = CreateObject("Scripting.Dictionary")
    Set reihenfolge = New Collection
    zaehler = Array(0, 0, 0, 0)    ' Protokolle, i.O., Sonderfreigabe, Ausschuss

    jahre = OrdnerListe(Pfad(Basispfad(), "Daten\Archiv"))
    If jahre = "" Then GoTo Ende
    For Each j In Split(jahre, vbLf)
        ordner = Pfad(Basispfad(), "Daten\Archiv", CStr(j), SichererName(art))
        dateien = DateiListe(ordner, "*.csv")
        If dateien <> "" Then
            For Each f In Split(dateien, vbLf)
                Application.StatusBar = "Auswertung: " & f
                If LiesProtokoll(Pfad(ordner, CStr(f)), kopf, daten, n) Then
                    d = kopf(K_ABGESCHLOSSEN)
                    If PasstFilter(kopf, stand, von, bis) Then
                        zaehler(0) = zaehler(0) + 1
                        erg = TextVon(kopf(K_ERGEBNIS))
                        If erg = ERG_IO Then zaehler(1) = zaehler(1) + 1
                        If erg = ERG_SONDER Then zaehler(2) = zaehler(2) + 1
                        If erg = ERG_AUSSCHUSS Then zaehler(3) = zaehler(3) + 1
                        For z = 1 To n
                            If IstZahl(daten(z, M_IST)) And ArtNormal(daten(z, M_ART)) <> ART_ATTRIBUT Then
                                k = TextVon(daten(z, M_NR)) & "|" & CsvFeld(daten(z, M_OGW)) & "|" & CsvFeld(daten(z, M_UGW))
                                If Not werte.Exists(k) Then
                                    werte.Add k, New Collection
                                    info.Add k, Array(TextVon(daten(z, M_NR)), daten(z, M_MERKMAL), daten(z, M_ART), _
                                        daten(z, M_OGW), daten(z, M_UGW), 0)
                                    reihenfolge.Add k
                                End If
                                werte(k).Add Array(d, CDbl(daten(z, M_IST)), kopf(K_PRODUKT))
                                If BewertungMerkmal(daten(z, M_ART), daten(z, M_IST), daten(z, M_OGW), daten(z, M_UGW)) = "n.i.O." Then
                                    e = info(k)
                                    e(5) = e(5) + 1
                                    info(k) = e
                                End If
                            End If
                        Next z
                    End If
                End If
            Next f
        End If
    Next j
Ende:
    Application.StatusBar = False
    Set Sammeln = werte
End Function

Private Function PasstFilter(ByVal kopf As Variant, ByVal stand As String, ByVal von As Variant, ByVal bis As Variant) As Boolean
    Dim d As Variant
    d = kopf(K_ABGESCHLOSSEN)
    If stand <> "" Then
        If LCase(Trim(TextVon(kopf(K_STAND)))) <> LCase(stand) Then Exit Function
    End If
    If IsDate(von) Then
        If Not IsDate(d) Then Exit Function
        If d < CDate(von) Then Exit Function
    End If
    If IsDate(bis) Then
        If Not IsDate(d) Then Exit Function
        If d >= CDate(bis) + 1 Then Exit Function
    End If
    PasstFilter = True
End Function

Private Sub Eingaben(ByRef art As String, ByRef stand As String, ByRef von As Variant, ByRef bis As Variant)
    art = Trim(TextVon(AW().Range("C3").Value))
    stand = Trim(TextVon(AW().Range("C4").Value))
    von = AW().Range("C5").Value
    bis = AW().Range("C6").Value
End Sub

Public Sub Auswerten()
    Dim art As String, stand As String, von As Variant, bis As Variant, werte As Object, info As Object
    Dim reihenfolge As Collection, zaehler As Variant, k As Variant, c As Collection, i As Long
    Dim w() As Double, m As Double, s As Double, mn As Double, mx As Double, cp As Variant, cpk As Variant
    Dim aus() As Variant, z As Long, e As Variant, ws As Worksheet, tmp As Variant

    Eingaben art, stand, von, bis
    If art = "" Then MsgBox "Bitte Artikelnummer in C3 eintragen.", vbExclamation: Exit Sub
    Set ws = AW()
    Set werte = Sammeln(art, stand, von, bis, info, reihenfolge, zaehler)

    Application.ScreenUpdating = False
    Schutz ws, False
    ws.Range(ws.Cells(AW_ERSTE, 1), ws.Cells(AW_ERSTE + 2000, AW_SPALTEN)).ClearContents
    ws.Range("F3").Value = zaehler(0)
    ws.Range("F4").Value = zaehler(1)
    ws.Range("F5").Value = zaehler(2)
    ws.Range("F6").Value = zaehler(3)

    If reihenfolge.Count > 0 Then
        ReDim aus(1 To reihenfolge.Count, 1 To AW_SPALTEN)
        For Each k In reihenfolge
            z = z + 1
            Set c = werte(k)
            e = info(k)
            ReDim w(1 To c.Count)
            For i = 1 To c.Count
                tmp = c(i)
                w(i) = tmp(1)
            Next i
            Statistik w, c.Count, m, s, mn, mx
            Faehigkeit m, s, e(3), e(4), cp, cpk
            aus(z, 1) = e(0): aus(z, 2) = e(1): aus(z, 3) = e(2): aus(z, 4) = e(3): aus(z, 5) = e(4)
            aus(z, 6) = c.Count: aus(z, 7) = m
            If c.Count >= 2 Then aus(z, 8) = s
            aus(z, 9) = mn: aus(z, 10) = mx
            If Not IsEmpty(cp) Then aus(z, 11) = Round(cp, 2)
            If Not IsEmpty(cpk) Then aus(z, 12) = Round(cpk, 2)
            aus(z, 13) = e(5)
            aus(z, 14) = FaehigkeitText(cpk, c.Count)
        Next k
        ws.Range(ws.Cells(AW_ERSTE, 1), ws.Cells(AW_ERSTE + z - 1, AW_SPALTEN)).Value = aus
    End If
    ws.Range("B8").Value = "Artikel " & art & IIf(stand <> "", ", Stand " & stand, ", alle Stände") & _
        " · " & z & " Merkmale · ausgewertet " & Format(Now, "dd.mm.yyyy hh:nn")
    Schutz ws, True
    Application.ScreenUpdating = True
    ws.Activate
    If zaehler(0) = 0 Then MsgBox "Keine abgeschlossenen Protokolle für Artikel " & art & " gefunden.", vbInformation
End Sub

' Verlaufsdiagramm für ein Merkmal (Nr in C7)
Public Sub VerlaufAnzeigen()
    Dim art As String, stand As String, von As Variant, bis As Variant, werte As Object, info As Object
    Dim reihenfolge As Collection, zaehler As Variant, k As Variant, nr As String, wahl As String
    Dim c As Collection, n As Long, i As Long, j As Long, a() As Variant, tmp As Variant, e As Variant
    Dim ws As Worksheet, co As ChartObject, w() As Double, m As Double, s As Double, mn As Double, mx As Double
    Dim sp As Long, letzteZ As Long, vgl As Variant

    Eingaben art, stand, von, bis
    nr = Trim(TextVon(AW().Range("C7").Value))
    If art = "" Or nr = "" Then MsgBox "Bitte Artikelnummer (C3) und Merkmal-Nr (C7) eintragen.", vbExclamation: Exit Sub
    Set werte = Sammeln(art, stand, von, bis, info, reihenfolge, zaehler)
    ' Merkmal mit dieser Nr; bei mehreren Toleranzständen den zuletzt gemessenen nehmen
    For Each k In reihenfolge
        e = info(k)
        If LCase(TextVon(e(0))) = LCase(nr) Then wahl = k
    Next k
    If wahl = "" Then MsgBox "Merkmal " & nr & " hat keine Messwerte.", vbInformation: Exit Sub
    Set c = werte(wahl)
    e = info(wahl)
    n = c.Count
    ReDim a(1 To n)
    For i = 1 To n
        a(i) = c(i)
    Next i
    ' nach Datum sortieren (einfaches Einfügesortieren)
    For i = 2 To n
        tmp = a(i)
        j = i - 1
        Do While j >= 1
            vgl = a(j)
            If vgl(0) <= tmp(0) Then Exit Do
            a(j + 1) = a(j)
            j = j - 1
        Loop
        a(j + 1) = tmp
    Next i
    ReDim w(1 To n)
    For i = 1 To n
        tmp = a(i)
        w(i) = tmp(1)
    Next i
    Statistik w, n, m, s, mn, mx

    Set ws = AW()
    Application.ScreenUpdating = False
    Schutz ws, False
    sp = VERLAUF_SPALTE
    ws.Range(ws.Cells(1, sp), ws.Cells(5000, sp + 4)).ClearContents
    ws.Cells(1, sp).Value = "Produkt": ws.Cells(1, sp + 1).Value = "Istwert"
    ws.Cells(1, sp + 2).Value = "OGW": ws.Cells(1, sp + 3).Value = "UGW": ws.Cells(1, sp + 4).Value = "Mittelwert"
    For i = 1 To n
        tmp = a(i)
        ws.Cells(i + 1, sp).Value = tmp(2)
        ws.Cells(i + 1, sp + 1).Value = tmp(1)
        If IstZahl(e(3)) Then ws.Cells(i + 1, sp + 2).Value = e(3)
        If IstZahl(e(4)) Then ws.Cells(i + 1, sp + 3).Value = e(4)
        ws.Cells(i + 1, sp + 4).Value = m
    Next i
    letzteZ = n + 1

    For Each co In ws.ChartObjects
        co.Delete
    Next co
    Set co = ws.ChartObjects.Add(ws.Range("P3").Left, ws.Range("P3").Top, 620, 300)
    With co.Chart
        .ChartType = xlLineMarkers
        Do While .SeriesCollection.Count > 0
            .SeriesCollection(1).Delete
        Loop
        With .SeriesCollection.NewSeries
            .Name = "Istwert"
            .Values = ws.Range(ws.Cells(2, sp + 1), ws.Cells(letzteZ, sp + 1))
            .XValues = ws.Range(ws.Cells(2, sp), ws.Cells(letzteZ, sp))
        End With
        If IstZahl(e(3)) Then
            With .SeriesCollection.NewSeries
                .Name = "OGW"
                .Values = ws.Range(ws.Cells(2, sp + 2), ws.Cells(letzteZ, sp + 2))
                .ChartType = xlLine
                .Format.Line.ForeColor.RGB = RGB(192, 0, 0)
            End With
        End If
        If IstZahl(e(4)) Then
            With .SeriesCollection.NewSeries
                .Name = "UGW"
                .Values = ws.Range(ws.Cells(2, sp + 3), ws.Cells(letzteZ, sp + 3))
                .ChartType = xlLine
                .Format.Line.ForeColor.RGB = RGB(192, 0, 0)
            End With
        End If
        With .SeriesCollection.NewSeries
            .Name = "Mittelwert"
            .Values = ws.Range(ws.Cells(2, sp + 4), ws.Cells(letzteZ, sp + 4))
            .ChartType = xlLine
            .Format.Line.ForeColor.RGB = RGB(127, 127, 127)
        End With
        .HasTitle = True
        .ChartTitle.Text = "Merkmal " & e(0) & " · " & TextVon(e(1)) & " · " & n & " Werte"
    End With
    Schutz ws, True
    Application.ScreenUpdating = True
End Sub
