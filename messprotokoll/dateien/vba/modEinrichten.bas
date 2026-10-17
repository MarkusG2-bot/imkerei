Attribute VB_Name = "modEinrichten"
Option Explicit
' Einmalige Einrichtung nach dem Import der Module sowie Verwaltungsfunktionen

Public Sub Einrichten()
    Dim ws As Worksheet, letzte As Long, r As Range

    Application.ScreenUpdating = False

    ' Formeln im Prüfplan
    Set ws = ThisWorkbook.Worksheets(BLATT_PP)
    letzte = PP_ERSTE + PP_MAX - 1
    ws.Range(ws.Cells(PP_ERSTE, SP_OGW), ws.Cells(letzte, SP_OGW)).Formula = "=PM_OGW(C" & PP_ERSTE & ",D" & PP_ERSTE & ",E" & PP_ERSTE & ",F" & PP_ERSTE & ",G" & PP_ERSTE & ")"
    ws.Range(ws.Cells(PP_ERSTE, SP_UGW), ws.Cells(letzte, SP_UGW)).Formula = "=PM_UGW(C" & PP_ERSTE & ",D" & PP_ERSTE & ",E" & PP_ERSTE & ",F" & PP_ERSTE & ",G" & PP_ERSTE & ")"
    ws.Range(ws.Cells(PP_ERSTE, PP_SPALTEN + 1), ws.Cells(letzte, PP_SPALTEN + 1)).Formula = "=PM_PRUEFUNG(A" & PP_ERSTE & ",B" & PP_ERSTE & ",C" & PP_ERSTE & ",D" & PP_ERSTE & ",E" & PP_ERSTE & ",F" & PP_ERSTE & ",G" & PP_ERSTE & ")"

    ' ISO-Rechner
    Set ws = ThisWorkbook.Worksheets(BLATT_RECHNER)
    ws.Range("C7").Formula = "=PM_ABMASS(C4,C5,""O"")"
    ws.Range("C8").Formula = "=PM_ABMASS(C4,C5,""U"")"
    ws.Range("C9").Formula = "=IF(ISNUMBER(C7),C4+C7,"""")"
    ws.Range("C10").Formula = "=IF(ISNUMBER(C8),C4+C8,"""")"

    ' Schaltflächen
    Set ws = ThisWorkbook.Worksheets(BLATT_START)
    ws.Buttons.Delete
    Knopf ws, ws.Range("B10"), "Prüfplan laden", "PruefplanLaden"
    Knopf ws, ws.Range("B12"), "Neuer Prüfplan", "NeuerPruefplan"
    Knopf ws, ws.Range("B14"), "Neuer Zeichnungsstand", "NeuerZeichnungsstand"
    Knopf ws, ws.Range("B16"), "Prüfplan speichern", "PruefplanSpeichern"
    Knopf ws, ws.Range("B20"), "Anmeldung prüfen", "AnmeldungPruefen"
    Knopf ws, ws.Range("B22"), "Ordnerstruktur anlegen", "OrdnerstrukturAnlegen"

    Set ws = ThisWorkbook.Worksheets(BLATT_PP)
    ws.Buttons.Delete
    Knopf ws, ws.Range("J2"), "Laden", "PruefplanLaden", 90
    Knopf ws, ws.Range("K2"), "Neu", "NeuerPruefplan", 90
    Knopf ws, ws.Range("J4"), "Neuer Stand", "NeuerZeichnungsstand", 90
    Knopf ws, ws.Range("K4"), "Speichern", "PruefplanSpeichern", 90

    ThisWorkbook.Worksheets(BLATT_SYSTEM).Range("B4").Value = PROGRAMM_VERSION
    Application.ScreenUpdating = True
    Application.CalculateFull
    StartInfo

    ThisWorkbook.Worksheets(BLATT_START).Activate
    MsgBox "Einrichtung abgeschlossen (Version " & PROGRAMM_VERSION & ")." & vbLf & vbLf & _
        "Bitte jetzt speichern unter: Dateityp ""Excel-Arbeitsmappe mit Makros (*.xlsm)""," & vbLf & _
        "Dateiname: Messprotokoll.xlsm im Ordner Programm.", vbInformation
End Sub

Private Sub Knopf(ByVal ws As Worksheet, ByVal zelle As Range, ByVal beschriftung As String, _
        ByVal makro As String, Optional ByVal breite As Double = 200)
    Dim b As Object
    Set b = ws.Buttons.Add(zelle.Left, zelle.Top, breite, 24)
    b.Caption = beschriftung
    b.OnAction = makro
    b.Font.Size = 11
End Sub

' Zeigt Benutzer, Rollen und Pfad auf dem Startblatt
Public Sub StartInfo()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(BLATT_START)
    ws.Range("C4").Value = PROGRAMM_VERSION
    ws.Range("C5").Value = Basispfad()
    ws.Range("C6").Value = BenutzerAnzeige() & " (" & Benutzer() & ")"
    ws.Range("C7").Value = RollenText()
End Sub

Public Sub AnmeldungPruefen()
    LadeRollen True
    StartInfo
    MsgBox "Angemeldet als: " & BenutzerAnzeige() & " (" & Benutzer() & ")" & vbLf & _
        "Rollen: " & RollenText() & vbLf & vbLf & "Basisordner: " & Basispfad(), vbInformation
End Sub

' Legt die Ordner unter dem Basisordner an (nur Stammdaten-Gruppe)
Public Sub OrdnerstrukturAnlegen()
    Dim basis As String, o As Variant, neu As String
    basis = Basispfad()
    If MsgBox("Ordnerstruktur anlegen unter:" & vbLf & basis & vbLf & vbLf & "Fortfahren?", _
            vbYesNo + vbQuestion) <> vbYes Then Exit Sub
    If DateiExistiert(Pfad(basis, ORDNER_STAMMDATEN, DATEI_STAMMDATEN)) Then
        If Not PruefeRolle(ROLLE_STAMMDATEN) Then Exit Sub
    End If
    On Error GoTo Fehler
    For Each o In AlleOrdner()
        If Not OrdnerExistiert(Pfad(basis, CStr(o))) Then
            OrdnerAnlegen Pfad(basis, CStr(o))
            neu = neu & vbLf & "  " & CStr(o)
        End If
    Next o
    If neu = "" Then neu = vbLf & "  (alle Ordner waren schon vorhanden)"
    MsgBox "Ordnerstruktur ist bereit:" & neu & vbLf & vbLf & _
        "Bitte die Datei Stammdaten.xlsx in den Ordner ""Stammdaten"" legen.", vbInformation
    Exit Sub
Fehler:
    MsgBox "Ordner konnten nicht angelegt werden:" & vbLf & Err.Description, vbCritical
End Sub
