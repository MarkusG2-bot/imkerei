Attribute VB_Name = "modUebersicht"
Option Explicit
' Übersichten: offene Protokolle und Messmittel

Private Const OF_ERSTE As Long = 6

' Listet alle Protokolle in Arbeit, in Nacharbeit und in der Freigabe
Public Sub OffeneAktualisieren()
    Dim ws As Worksheet, ordner As Variant, dateien As String, f As Variant, z As Long
    Dim kopf As Variant, daten As Variant, n As Long, i As Long, gemessen As Long, nio As Long, offen As Long
    Dim b As String, sp As String, wer As String, seit As Date, prod As String, rel As Variant

    Set ws = ThisWorkbook.Worksheets(BLATT_OFFEN)
    Application.ScreenUpdating = False
    Schutz ws, False
    ws.Range(ws.Cells(OF_ERSTE, 1), ws.Cells(OF_ERSTE + 2000, 13)).ClearContents
    z = OF_ERSTE
    For Each rel In Array("Daten\Freigabe", "Daten\Entwurf")
        ordner = Pfad(Basispfad(), CStr(rel))
        dateien = DateiListe(CStr(ordner), "*.csv")
        If dateien <> "" Then
            For Each f In Split(dateien, vbLf)
                If LiesProtokoll(Pfad(CStr(ordner), CStr(f)), kopf, daten, n) Then
                    gemessen = 0: nio = 0: offen = 0
                    For i = 1 To n
                        b = BewertungMerkmal(daten(i, M_ART), daten(i, M_IST), daten(i, M_OGW), daten(i, M_UGW))
                        If b <> "" Then gemessen = gemessen + 1
                        If b = "n.i.O." Then
                            nio = nio + 1
                            If TextVon(daten(i, M_ENTSCHEIDUNG)) = "" Then offen = offen + 1
                        End If
                    Next i
                    prod = TextVon(kopf(K_PRODUKT))
                    wer = ""
                    sp = Pfad(Basispfad(), SperreRelPfad(prod))
                    If Not SperreLesen(sp, wer, seit) Then wer = ""
                    ws.Cells(z, 1).Value = prod
                    ws.Cells(z, 2).Value = kopf(K_STATUS)
                    ws.Cells(z, 3).Value = kopf(K_ARTIKEL)
                    ws.Cells(z, 4).Value = kopf(K_AUFTRAG)
                    ws.Cells(z, 5).Value = kopf(K_KUNDE)
                    ws.Cells(z, 6).Value = kopf(K_PRUEFER)
                    ws.Cells(z, 7).Value = kopf(K_BEGONNEN)
                    ws.Cells(z, 8).Value = kopf(K_GEAENDERT_AM)
                    ws.Cells(z, 9).Value = n
                    ws.Cells(z, 10).Value = gemessen
                    ws.Cells(z, 11).Value = nio
                    ws.Cells(z, 12).Value = offen
                    ws.Cells(z, 13).Value = wer
                    z = z + 1
                End If
            Next f
        End If
    Next rel
    ws.Range("B3").Value = (z - OF_ERSTE) & " offene Protokolle · Stand " & Format(Now, "dd.mm.yyyy hh:nn")
    Schutz ws, True
    Application.ScreenUpdating = True
    ws.Activate
End Sub

' Öffnet das Protokoll der markierten Zeile
Public Sub OffeneOeffnen()
    Dim ws As Worksheet, prod As String
    Set ws = ThisWorkbook.Worksheets(BLATT_OFFEN)
    If ActiveSheet.Name <> ws.Name Or ActiveCell.Row < OF_ERSTE Then
        MsgBox "Bitte zuerst eine Zeile in der Liste anklicken.", vbInformation
        Exit Sub
    End If
    prod = Trim(TextVon(ws.Cells(ActiveCell.Row, 1).Value))
    If prod = "" Then
        MsgBox "In dieser Zeile steht kein Protokoll.", vbInformation
        Exit Sub
    End If
    MessungOeffnenNummer prod
End Sub

' Messmittel-Übersicht mit Kalibrierstatus
Public Sub MessmittelAktualisieren()
    Dim ws As Worksheet, t As Variant, n As Long, ab As Long, bald As Long, z As Long
    Set ws = ThisWorkbook.Worksheets(BLATT_MESSMITTEL)
    If Not LadeStammdaten(True) Then Exit Sub
    t = MessmittelTabelle(n)
    Application.ScreenUpdating = False
    Schutz ws, False
    ws.Range("A6:H2005").ClearContents
    If n > 0 Then ws.Range(ws.Cells(6, 1), ws.Cells(5 + n, 8)).Value = t
    For z = 1 To n
        If t(z, 8) = "abgelaufen" Or t(z, 8) = "keine Kalibrierdaten" Then ab = ab + 1
        If t(z, 8) = "bald fällig" Then bald = bald + 1
    Next z
    ws.Range("B3").Value = n & " Messmittel · " & ab & " gesperrt (abgelaufen/ohne Daten) · " & _
        bald & " bald fällig · Stand " & Format(Now, "dd.mm.yyyy")
    Schutz ws, True
    Application.ScreenUpdating = True
    ws.Activate
End Sub
