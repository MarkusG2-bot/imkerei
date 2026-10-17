Attribute VB_Name = "modEinrichten"
Option Explicit
' Einrichtung (Formeln, Schaltflächen), Start-Informationen, Ordnerstruktur

Public Sub Einrichten()
    EinrichtenIntern False
End Sub

' Für das Installationsprogramm: ohne Rückfragen
Public Sub EinrichtenStill()
    EinrichtenIntern True
End Sub

Private Sub EinrichtenIntern(ByVal still As Boolean)
    Dim ws As Worksheet, letzte As Long, e As Long

    Application.ScreenUpdating = False

    ' Prüfplan: Grenzwerte und Prüfhinweis
    Set ws = ThisWorkbook.Worksheets(BLATT_PP)
    e = PP_ERSTE
    letzte = PP_ERSTE + PP_MAX - 1
    ws.Range(ws.Cells(e, SP_OGW), ws.Cells(letzte, SP_OGW)).Formula = "=PM_OGW(C" & e & ",D" & e & ",E" & e & ",F" & e & ",G" & e & ")"
    ws.Range(ws.Cells(e, SP_UGW), ws.Cells(letzte, SP_UGW)).Formula = "=PM_UGW(C" & e & ",D" & e & ",E" & e & ",F" & e & ",G" & e & ")"
    ws.Range(ws.Cells(e, PP_SPALTEN + 1), ws.Cells(letzte, PP_SPALTEN + 1)).Formula = _
        "=PM_PRUEFUNG(A" & e & ",B" & e & ",C" & e & ",D" & e & ",E" & e & ",F" & e & ",G" & e & ")"
    ws.Buttons.Delete
    Knopf ws, ws.Range("J2"), "Laden", "PruefplanLaden", 90
    Knopf ws, ws.Range("K2"), "Neu", "NeuerPruefplan", 90
    Knopf ws, ws.Range("J4"), "Neuer Stand", "NeuerZeichnungsstand", 90
    Knopf ws, ws.Range("K4"), "Speichern", "PruefplanSpeichern", 90

    ' Messung: Bewertung
    Set ws = ThisWorkbook.Worksheets(BLATT_MESSUNG)
    Schutz ws, False
    e = MS_ERSTE
    letzte = MS_ERSTE + MS_MAX - 1
    ws.Range(ws.Cells(e, M_BEWERTUNG), ws.Cells(letzte, M_BEWERTUNG)).Formula = _
        "=PM_BEWERTUNG(C" & e & ",H" & e & ",F" & e & ",G" & e & ")"
    ws.Buttons.Delete
    Knopf ws, ws.Range("J2"), "Messung starten / öffnen", "MessungStarten", 170
    Knopf ws, ws.Range("J4"), "Zwischenspeichern", "Zwischenspeichern", 170
    Knopf ws, ws.Range("L2"), "Abschließen", "Abschliessen", 130
    Knopf ws, ws.Range("L4"), "Schließen", "ProtokollSchliessen", 130
    Schutz ws, True

    ' ISO-Rechner
    Set ws = ThisWorkbook.Worksheets(BLATT_RECHNER)
    ws.Range("C7").Formula = "=PM_ABMASS(C4,C5,""O"")"
    ws.Range("C8").Formula = "=PM_ABMASS(C4,C5,""U"")"
    ws.Range("C9").Formula = "=IF(ISNUMBER(C7),C4+C7,"""")"
    ws.Range("C10").Formula = "=IF(ISNUMBER(C8),C4+C8,"""")"

    ' Übersichten
    Set ws = ThisWorkbook.Worksheets(BLATT_OFFEN)
    Schutz ws, False
    ws.Buttons.Delete
    Knopf ws, ws.Range("H2"), "Aktualisieren", "OffeneAktualisieren", 130
    Knopf ws, ws.Range("J2"), "Markierte Zeile öffnen", "OffeneOeffnen", 170
    Schutz ws, True

    Set ws = ThisWorkbook.Worksheets(BLATT_AUSWERTUNG)
    Schutz ws, False
    ws.Buttons.Delete
    Knopf ws, ws.Range("H3"), "Auswerten", "Auswerten", 130
    Knopf ws, ws.Range("H6"), "Verlauf anzeigen", "VerlaufAnzeigen", 130
    Schutz ws, True

    Set ws = ThisWorkbook.Worksheets(BLATT_MESSMITTEL)
    Schutz ws, False
    ws.Buttons.Delete
    Knopf ws, ws.Range("F2"), "Aktualisieren", "MessmittelAktualisieren", 130
    Schutz ws, True

    ' Startblatt
    Set ws = ThisWorkbook.Worksheets(BLATT_START)
    ws.Buttons.Delete
    Knopf ws, ws.Range("B10"), "Messung starten / öffnen", "StartMessung"
    Knopf ws, ws.Range("B12"), "Offene Protokolle", "OffeneAktualisieren"
    Knopf ws, ws.Range("B16"), "Prüfplan laden", "StartPruefplanLaden"
    Knopf ws, ws.Range("B18"), "Neuer Prüfplan", "NeuerPruefplan"
    Knopf ws, ws.Range("B22"), "Auswertung (Cpk)", "StartAuswertung"
    Knopf ws, ws.Range("B24"), "Messmittel", "MessmittelAktualisieren"
    Knopf ws, ws.Range("B28"), "Anmeldung prüfen", "AnmeldungPruefen"
    Knopf ws, ws.Range("B30"), "Ordnerstruktur anlegen", "OrdnerstrukturAnlegen"
    Knopf ws, ws.Range("B32"), "Selbsttest", "Selbsttest"

    ThisWorkbook.Worksheets(BLATT_SYSTEM).Range(SYS_VERSION).Value = PROGRAMM_VERSION
    ThisWorkbook.Worksheets(BLATT_START).Range("C4").Value = PROGRAMM_VERSION
    Application.ScreenUpdating = True
    Application.CalculateFull
    ThisWorkbook.Worksheets(BLATT_START).Activate

    If Not still Then
        StartInfo
        MsgBox "Einrichtung abgeschlossen (Version " & PROGRAMM_VERSION & ")." & vbLf & vbLf & _
            "Bitte jetzt speichern unter: Dateityp ""Excel-Arbeitsmappe mit Makros (*.xlsm)""," & vbLf & _
            "Dateiname: Messprotokoll.xlsm im Ordner Programm.", vbInformation
    End If
End Sub

Private Sub Knopf(ByVal ws As Worksheet, ByVal zelle As Range, ByVal beschriftung As String, _
        ByVal makro As String, Optional ByVal breite As Double = 200)
    Dim b As Object
    Set b = ws.Buttons.Add(zelle.Left, zelle.Top, breite, 24)
    b.Caption = beschriftung
    b.OnAction = makro
    b.Font.Size = 11
End Sub

' Aufruf aus Workbook_Open
Public Sub BeimOeffnen()
    On Error Resume Next
    Sys().Range(SYS_MS_DATEI).ClearContents
    Sys().Range(SYS_MS_ZEIT).ClearContents
    Sys().Range(SYS_MS_BEARBEITEN).ClearContents
    ThisWorkbook.Worksheets(BLATT_START).Activate
    StartInfo
End Sub

' Aufruf aus Workbook_BeforeClose
Public Sub BeimSchliessen()
    On Error Resume Next
    SperreFreigeben
    ' Das Programm selbst wird nie gespeichert (liegt schreibgeschützt im Netz)
    If ThisWorkbook.ReadOnly Then ThisWorkbook.Saved = True
End Sub

Public Sub StartMessung()
    ThisWorkbook.Worksheets(BLATT_MESSUNG).Activate
    MessungStarten
End Sub

Public Sub StartPruefplanLaden()
    ThisWorkbook.Worksheets(BLATT_PP).Activate
    PruefplanLaden
End Sub

Public Sub StartAuswertung()
    ThisWorkbook.Worksheets(BLATT_AUSWERTUNG).Activate
    MsgBox "Artikelnummer in C3 eintragen (optional Stand und Zeitraum) und ""Auswerten"" klicken.", vbInformation
End Sub

' Zeigt Benutzer, Rollen, Pfad und Messmittel-Warnungen auf dem Startblatt
Public Sub StartInfo()
    Dim ws As Worksheet, t As Variant, n As Long, z As Long, ab As Long, bald As Long
    Set ws = ThisWorkbook.Worksheets(BLATT_START)
    ws.Range("C4").Value = PROGRAMM_VERSION
    ws.Range("C5").Value = Basispfad()
    If Not DateiExistiert(StammdatenDatei()) Then
        ws.Range("C6").Value = Benutzer()
        ws.Range("C7").Value = "Stammdaten nicht gefunden – Ordnerstruktur anlegen und Stammdaten.xlsx ablegen"
        ws.Range("C8").Value = ""
        Exit Sub
    End If
    ws.Range("C6").Value = BenutzerAnzeige() & " (" & Benutzer() & ")"
    ws.Range("C7").Value = RollenText()
    t = MessmittelTabelle(n)
    For z = 1 To n
        If t(z, 8) = "abgelaufen" Or t(z, 8) = "keine Kalibrierdaten" Then ab = ab + 1
        If t(z, 8) = "bald fällig" Then bald = bald + 1
    Next z
    If ab + bald > 0 Then
        ws.Range("C8").Value = "Messmittel: " & ab & " gesperrt, " & bald & " bald fällig"
    Else
        ws.Range("C8").Value = "Messmittel: alle gültig (" & n & ")"
    End If
End Sub

Public Sub AnmeldungPruefen()
    LadeStammdaten True
    StartInfo
    MsgBox "Angemeldet als: " & BenutzerAnzeige() & " (" & Benutzer() & ")" & vbLf & _
        "Rollen: " & RollenText() & vbLf & vbLf & "Basisordner: " & Basispfad(), vbInformation
End Sub

' Legt die Ordner unter dem Basisordner an (nur Stammdaten-Gruppe, außer bei Ersteinrichtung)
Public Sub OrdnerstrukturAnlegen()
    Dim basis As String, o As Variant, neu As String
    basis = Basispfad()
    If MsgBox("Ordnerstruktur anlegen unter:" & vbLf & basis & vbLf & vbLf & "Fortfahren?", _
            vbYesNo + vbQuestion) <> vbYes Then Exit Sub
    If DateiExistiert(StammdatenDatei()) Then
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
    MsgBox "Ordnerstruktur ist bereit:" & neu, vbInformation
    Exit Sub
Fehler:
    MsgBox "Ordner konnten nicht angelegt werden:" & vbLf & Err.Description, vbCritical
End Sub
