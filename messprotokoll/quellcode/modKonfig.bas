Attribute VB_Name = "modKonfig"
Option Explicit
' Einstellungen, Pfade, Rollen und Dateihilfen

Public Const PROGRAMM_VERSION As String = "0.1.0"

' Blattnamen im Programm
Public Const BLATT_START As String = "Start"
Public Const BLATT_PP As String = "Prüfplan"
Public Const BLATT_RECHNER As String = "ISO-Rechner"
Public Const BLATT_SYSTEM As String = "System"

' Ordner unterhalb des Basisordners auf dem Netzlaufwerk
Public Const ORDNER_PROGRAMM As String = "Programm"
Public Const ORDNER_STAMMDATEN As String = "Stammdaten"
Public Const ORDNER_PP As String = "Pruefplaene"
Public Const DATEI_STAMMDATEN As String = "Stammdaten.xlsx"
Public Const DATEI_AKTUELL As String = "aktueller_Stand.txt"

' Rollen (Spalten im Blatt "Personen" der Stammdaten)
Public Const ROLLE_PRUEFER As String = "Prüfer"
Public Const ROLLE_FREIGEBER As String = "Freigeber"
Public Const ROLLE_STAMMDATEN As String = "Stammdaten"

Private mRollen As Object          ' Benutzer -> "|Prüfer|Freigeber|..."
Private mNamen As Object           ' Benutzer -> Anzeigename
Private mKeinAdmin As Boolean      ' noch niemand mit Rolle Stammdaten eingetragen
Private mGeladenUm As Date

' ---------- Pfade ----------

' Basisordner: Elternordner von "Programm\", oder Eintrag im Blatt System (B3)
Public Function Basispfad() As String
    Dim p As String
    p = Trim(CStr(ThisWorkbook.Worksheets(BLATT_SYSTEM).Range("B3").Value))
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
        "PDF", "Auswertung", "Import", "System", "System\Index")
End Function

' ---------- Benutzer und Rollen ----------

Public Function Benutzer() As String
    Benutzer = LCase(Trim(Environ("USERNAME")))
End Function

Public Function BenutzerAnzeige() As String
    LadeRollen False
    If Not mNamen Is Nothing Then
        If mNamen.Exists(Benutzer()) Then
            If Trim(mNamen(Benutzer())) <> "" Then
                BenutzerAnzeige = mNamen(Benutzer())
                Exit Function
            End If
        End If
    End If
    BenutzerAnzeige = Benutzer()
End Function

Public Function HatRolle(ByVal rolle As String) As Boolean
    LadeRollen False
    If mRollen Is Nothing Then Exit Function
    If rolle = ROLLE_STAMMDATEN And mKeinAdmin Then
        HatRolle = True     ' Einrichtungsmodus: noch niemand berechtigt
        Exit Function
    End If
    If mRollen.Exists(Benutzer()) Then
        HatRolle = (InStr(1, mRollen(Benutzer()), "|" & rolle & "|", vbTextCompare) > 0)
    End If
End Function

' Prüft die Rolle und meldet, wenn sie fehlt
Public Function PruefeRolle(ByVal rolle As String) As Boolean
    PruefeRolle = HatRolle(rolle)
    If Not PruefeRolle Then
        MsgBox "Dafür fehlt die Berechtigung """ & rolle & """." & vbLf & _
            "Angemeldet als: " & Benutzer() & vbLf & vbLf & _
            "Berechtigungen werden in den Stammdaten im Blatt ""Personen"" vergeben.", _
            vbExclamation, "Keine Berechtigung"
    End If
End Function

Public Function RollenText() As String
    Dim r As String
    LadeRollen False
    If HatRolle(ROLLE_PRUEFER) Then r = r & ", " & ROLLE_PRUEFER
    If HatRolle(ROLLE_FREIGEBER) Then r = r & ", " & ROLLE_FREIGEBER
    If HatRolle(ROLLE_STAMMDATEN) Then r = r & ", " & ROLLE_STAMMDATEN
    If mKeinAdmin Then r = r & " (Einrichtungsmodus: noch keine Stammdaten-Gruppe eingetragen)"
    If r = "" Then RollenText = "keine" Else RollenText = Mid(r, 3)
End Function

' Liest die Personen aus der Stammdaten-Datei (wird 5 Minuten zwischengespeichert)
Public Sub LadeRollen(ByVal erzwingen As Boolean)
    Dim datei As String, wb As Workbook, ws As Worksheet, daten As Variant
    Dim z As Long, sp As Long, kopf As String, rollen As String, b As String
    Dim scr As Boolean

    If Not erzwingen And Not mRollen Is Nothing Then
        If Now - mGeladenUm < TimeSerial(0, 5, 0) Then Exit Sub
    End If

    datei = Pfad(Basispfad(), ORDNER_STAMMDATEN, DATEI_STAMMDATEN)
    If Not DateiExistiert(datei) Then
        Set mRollen = Nothing
        MsgBox "Stammdaten-Datei nicht gefunden:" & vbLf & datei, vbCritical, "Stammdaten fehlen"
        Exit Sub
    End If

    scr = Application.ScreenUpdating
    Application.ScreenUpdating = False
    On Error GoTo Fehler
    Set wb = Workbooks.Open(Filename:=datei, ReadOnly:=True, UpdateLinks:=0, AddToMru:=False)
    Set ws = wb.Worksheets("Personen")
    daten = ws.UsedRange.Value
    wb.Close SaveChanges:=False
    On Error GoTo 0
    Application.ScreenUpdating = scr

    Set mRollen = CreateObject("Scripting.Dictionary")
    Set mNamen = CreateObject("Scripting.Dictionary")
    mKeinAdmin = True
    If IsArray(daten) Then
        For z = 2 To UBound(daten, 1)
            b = LCase(Trim(TextVon(daten(z, 1))))
            If b <> "" Then
                rollen = "|"
                For sp = 3 To UBound(daten, 2)
                    kopf = Trim(TextVon(daten(1, sp)))
                    If kopf <> "" And Trim(TextVon(daten(z, sp))) <> "" Then rollen = rollen & kopf & "|"
                Next sp
                mRollen(b) = rollen
                mNamen(b) = Trim(TextVon(daten(z, 2)))
                If InStr(1, rollen, "|" & ROLLE_STAMMDATEN & "|", vbTextCompare) > 0 Then mKeinAdmin = False
            End If
        Next z
    End If
    mGeladenUm = Now
    Exit Sub

Fehler:
    Application.ScreenUpdating = scr
    Set mRollen = Nothing
    MsgBox "Stammdaten konnten nicht gelesen werden:" & vbLf & Err.Description, vbCritical
End Sub

' ---------- Dateien und Ordner ----------

Public Function OrdnerExistiert(ByVal p As String) As Boolean
    On Error GoTo Nein
    OrdnerExistiert = ((GetAttr(p) And vbDirectory) = vbDirectory)
    Exit Function
Nein:
    OrdnerExistiert = False
End Function

Public Function DateiExistiert(ByVal p As String) As Boolean
    On Error GoTo Nein
    DateiExistiert = ((GetAttr(p) And vbDirectory) = 0)
    Exit Function
Nein:
    DateiExistiert = False
End Function

Public Function DateiSchreibgeschuetzt(ByVal p As String) As Boolean
    On Error GoTo Nein
    DateiSchreibgeschuetzt = ((GetAttr(p) And vbReadOnly) = vbReadOnly)
    Exit Function
Nein:
    DateiSchreibgeschuetzt = False
End Function

' Legt einen Ordner samt fehlender Elternordner an (auch \\Server\Freigabe\...)
Public Sub OrdnerAnlegen(ByVal p As String)
    Dim teile() As String, i As Long, akt As String, start As Long
    If OrdnerExistiert(p) Then Exit Sub
    teile = Split(p, "\")
    If Left(p, 2) = "\\" Then
        akt = "\\" & teile(2) & "\" & teile(3)
        start = 4
    Else
        akt = teile(0)
        start = 1
    End If
    For i = start To UBound(teile)
        If teile(i) <> "" Then
            akt = akt & "\" & teile(i)
            If Not OrdnerExistiert(akt) Then MkDir akt
        End If
    Next i
End Sub

Public Function TextDateiLesen(ByVal p As String) As String
    Dim n As Integer, zeile As String
    If Not DateiExistiert(p) Then Exit Function
    n = FreeFile
    Open p For Input As #n
    If Not EOF(n) Then Line Input #n, zeile
    Close #n
    TextDateiLesen = Trim(zeile)
End Function

Public Sub TextDateiSchreiben(ByVal p As String, ByVal inhalt As String)
    Dim n As Integer
    n = FreeFile
    Open p For Output As #n
    Print #n, inhalt
    Close #n
End Sub
