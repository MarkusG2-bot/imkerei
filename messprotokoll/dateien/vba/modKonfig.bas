Attribute VB_Name = "modKonfig"
Option Explicit
' Einstellungen und Pfade

Public Const PROGRAMM_VERSION As String = "1.0.0"
Public Const BLATT_SCHUTZ As String = ""      ' Blattschutz ohne Kennwort (nur gegen Versehen)

' Blattnamen im Programm
Public Const BLATT_START As String = "Start"
Public Const BLATT_MESSUNG As String = "Messung"
Public Const BLATT_OFFEN As String = "Offene Protokolle"
Public Const BLATT_PP As String = "Prüfplan"
Public Const BLATT_AUSWERTUNG As String = "Auswertung"
Public Const BLATT_MESSMITTEL As String = "Messmittel"
Public Const BLATT_RECHNER As String = "ISO-Rechner"
Public Const BLATT_LISTEN As String = "Listen"
Public Const BLATT_SYSTEM As String = "System"

' Ordner unterhalb des Basisordners auf dem Netzlaufwerk
Public Const ORDNER_PROGRAMM As String = "Programm"
Public Const ORDNER_STAMMDATEN As String = "Stammdaten"
Public Const ORDNER_PP As String = "Pruefplaene"
Public Const DATEI_STAMMDATEN As String = "Stammdaten.xlsx"
Public Const DATEI_AKTUELL As String = "aktueller_Stand.txt"

' Zellen im Blatt System
Public Const SYS_PP_DATEI As String = "B1"
Public Const SYS_PP_ZEIT As String = "B2"
Public Const SYS_BASIS As String = "B3"
Public Const SYS_VERSION As String = "B4"
Public Const SYS_MS_DATEI As String = "B5"
Public Const SYS_MS_ZEIT As String = "B6"
Public Const SYS_MS_BEARBEITEN As String = "B7"

' Basisordner: Elternordner von "Programm\", oder Eintrag im Blatt System (B3)
Public Function Basispfad() As String
    Dim p As String
    p = Trim(CStr(ThisWorkbook.Worksheets(BLATT_SYSTEM).Range(SYS_BASIS).Value))
    If p = "" Then
        p = ThisWorkbook.Path
        If LCase(Right(p, Len(ORDNER_PROGRAMM) + 1)) = LCase("\" & ORDNER_PROGRAMM) Then
            p = Left(p, Len(p) - Len(ORDNER_PROGRAMM) - 1)
        End If
    End If
    If Right(p, 1) = "\" Then p = Left(p, Len(p) - 1)
    Basispfad = p
End Function

Public Function Pfad(ParamArray teile() As Variant) As String
    Dim i As Long, r As String, t As String
    For i = LBound(teile) To UBound(teile)
        t = CStr(teile(i))
        If r = "" Then
            r = t
        Else
            If Right(r, 1) <> "\" Then r = r & "\"
            If Left(t, 1) = "\" Then t = Mid(t, 2)
            r = r & t
        End If
    Next i
    Pfad = r
End Function

Public Function AlleOrdner() As Variant
    AlleOrdner = Array(ORDNER_PROGRAMM, ORDNER_STAMMDATEN, ORDNER_PP, _
        "Daten", "Daten\Entwurf", "Daten\Freigabe", "Daten\Archiv", _
        "PDF", "Auswertung", "Import", "System", "System\Index", "System\Sperren")
End Function

Public Function Benutzer() As String
    Benutzer = LCase(Trim(Environ("USERNAME")))
End Function

Public Function Sys() As Worksheet
    Set Sys = ThisWorkbook.Worksheets(BLATT_SYSTEM)
End Function

' Blattschutz an/aus (Makros schalten ihn zum Schreiben kurz ab)
Public Sub Schutz(ByVal ws As Worksheet, ByVal ein As Boolean)
    If ein Then
        ws.Protect Password:=BLATT_SCHUTZ, DrawingObjects:=False, Contents:=True, _
            AllowFormattingColumns:=True, AllowFiltering:=True
    Else
        ws.Unprotect Password:=BLATT_SCHUTZ
    End If
End Sub

' Öffnet eine Arbeitsmappe nur zum Lesen. Ist sie in diesem Excel schon offen,
' wird die offene verwendet (warOffen = True) und darf danach nicht geschlossen werden.
Public Function MappeLesen(ByVal datei As String, ByRef warOffen As Boolean) As Workbook
    Dim wb As Workbook
    warOffen = False
    For Each wb In Application.Workbooks
        If LCase(wb.FullName) = LCase(datei) Then
            warOffen = True
            Set MappeLesen = wb
            Exit Function
        End If
    Next wb
    Set MappeLesen = Workbooks.Open(Filename:=datei, ReadOnly:=True, UpdateLinks:=0, AddToMru:=False)
End Function

Public Sub MappeSchliessen(ByVal wb As Workbook, ByVal warOffen As Boolean)
    If wb Is Nothing Then Exit Sub
    If Not warOffen Then wb.Close SaveChanges:=False
End Sub
