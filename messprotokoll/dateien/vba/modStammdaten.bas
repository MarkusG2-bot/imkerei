Attribute VB_Name = "modStammdaten"
Option Explicit
' Personen/Rollen und Messmittel aus Stammdaten\Stammdaten.xlsx

Public Const ROLLE_PRUEFER As String = "Prüfer"
Public Const ROLLE_FREIGEBER As String = "Freigeber"
Public Const ROLLE_STAMMDATEN As String = "Stammdaten"

Private mRollen As Object          ' Benutzer -> "|Prüfer|Freigeber|..."
Private mNamen As Object           ' Benutzer -> Anzeigename
Private mMessmittel As Object      ' Nr (klein) -> Array(Nr, Bezeichnung, Art, Standort, Letzte, Intervall)
Private mKeinAdmin As Boolean      ' noch niemand mit Rolle Stammdaten eingetragen
Private mGeladenUm As Date
Private mGeladen As Boolean

Public Function StammdatenDatei() As String
    StammdatenDatei = Pfad(Basispfad(), ORDNER_STAMMDATEN, DATEI_STAMMDATEN)
End Function

' Liest Personen und Messmittel (5 Minuten zwischengespeichert)
Public Function LadeStammdaten(ByVal erzwingen As Boolean) As Boolean
    Dim wb As Workbook, pers As Variant, mm As Variant, scr As Boolean
    Dim z As Long, sp As Long, kopf As String, rollen As String, b As String, nr As String
    Dim warOffen As Boolean

    If Not erzwingen And mGeladen Then
        If Now - mGeladenUm < TimeSerial(0, 5, 0) Then
            LadeStammdaten = True
            Exit Function
        End If
    End If
    mGeladen = False
    If Not DateiExistiert(StammdatenDatei()) Then
        MsgBox "Stammdaten-Datei nicht gefunden:" & vbLf & StammdatenDatei(), vbCritical, "Stammdaten fehlen"
        Exit Function
    End If

    scr = Application.ScreenUpdating
    Application.ScreenUpdating = False
    On Error GoTo Fehler
    Set wb = MappeLesen(StammdatenDatei(), warOffen)
    pers = wb.Worksheets("Personen").UsedRange.Value
    mm = wb.Worksheets("Messmittel").Range("A1:H2000").Value
    MappeSchliessen wb, warOffen
    On Error GoTo 0
    Application.ScreenUpdating = scr

    Set mRollen = CreateObject("Scripting.Dictionary")
    Set mNamen = CreateObject("Scripting.Dictionary")
    Set mMessmittel = CreateObject("Scripting.Dictionary")
    mKeinAdmin = True
    If IsArray(pers) Then
        For z = 2 To UBound(pers, 1)
            b = LCase(Trim(TextVon(pers(z, 1))))
            If b <> "" Then
                rollen = "|"
                For sp = 3 To UBound(pers, 2)
                    kopf = Trim(TextVon(pers(1, sp)))
                    If kopf <> "" And Trim(TextVon(pers(z, sp))) <> "" Then rollen = rollen & kopf & "|"
                Next sp
                mRollen(b) = rollen
                mNamen(b) = Trim(TextVon(pers(z, 2)))
                If InStr(1, rollen, "|" & ROLLE_STAMMDATEN & "|", vbTextCompare) > 0 Then mKeinAdmin = False
            End If
        Next z
    End If
    For z = 2 To UBound(mm, 1)
        nr = Trim(TextVon(mm(z, 1)))
        If nr <> "" Then
            mMessmittel(LCase(nr)) = Array(nr, TextVon(mm(z, 2)), TextVon(mm(z, 3)), TextVon(mm(z, 6)), mm(z, 7), mm(z, 8))
        End If
    Next z
    mGeladenUm = Now
    mGeladen = True
    LadeStammdaten = True
    Exit Function

Fehler:
    Dim fehlerText As String
    fehlerText = Err.Description
    Application.ScreenUpdating = scr
    On Error Resume Next
    MappeSchliessen wb, warOffen
    MsgBox "Stammdaten konnten nicht gelesen werden:" & vbLf & fehlerText, vbCritical
End Function

' ---------- Rollen ----------

Public Function BenutzerAnzeige() As String
    BenutzerAnzeige = Benutzer()
    If Not LadeStammdaten(False) Then Exit Function
    If mNamen.Exists(Benutzer()) Then
        If Trim(mNamen(Benutzer())) <> "" Then BenutzerAnzeige = mNamen(Benutzer())
    End If
End Function

Public Function HatRolle(ByVal rolle As String) As Boolean
    If Not LadeStammdaten(False) Then Exit Function
    If mKeinAdmin Then
        HatRolle = True     ' Einrichtungsmodus: noch niemand eingetragen -> alles erlaubt
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
    If Not LadeStammdaten(False) Then RollenText = "Stammdaten nicht gefunden": Exit Function
    If mKeinAdmin Then
        RollenText = "alle (Einrichtungsmodus: in den Stammdaten ist noch niemand mit Rolle Stammdaten eingetragen)"
        Exit Function
    End If
    If HatRolle(ROLLE_PRUEFER) Then r = r & ", " & ROLLE_PRUEFER
    If HatRolle(ROLLE_FREIGEBER) Then r = r & ", " & ROLLE_FREIGEBER
    If HatRolle(ROLLE_STAMMDATEN) Then r = r & ", " & ROLLE_STAMMDATEN
    If r = "" Then RollenText = "keine (nur ansehen)" Else RollenText = Mid(r, 3)
End Function

' ---------- Messmittel ----------

' Prüft ein Messmittel zum Stichtag. grund enthält den Fehler.
Public Function MessmittelOk(ByVal nr As String, ByVal stichtag As Date, ByRef grund As String) As Boolean
    Dim e As Variant, st As String, nx As Variant
    grund = ""
    nr = Trim(nr)
    If nr = "" Then grund = "Messmittel fehlt": Exit Function
    If Not LadeStammdaten(False) Then grund = "Stammdaten fehlen": Exit Function
    If Not mMessmittel.Exists(LCase(nr)) Then grund = "Messmittel " & nr & " unbekannt": Exit Function
    e = mMessmittel(LCase(nr))
    st = MessmittelStatus(e(4), e(5), stichtag, nx)
    Select Case st
        Case "abgelaufen"
            grund = "Messmittel " & nr & ": Kalibrierung abgelaufen (" & Format(nx, "dd.mm.yyyy") & ")"
        Case "keine Kalibrierdaten"
            grund = "Messmittel " & nr & ": keine Kalibrierdaten"
        Case Else
            MessmittelOk = True
    End Select
End Function

' Alle Messmittel: Feld (1..n, 1..8) Nr, Bezeichnung, Art, Standort, Letzte, Intervall, Nächste, Status
Public Function MessmittelTabelle(ByRef n As Long) As Variant
    Dim r() As Variant, k As Variant, e As Variant, nx As Variant, z As Long
    n = 0
    If Not LadeStammdaten(False) Then Exit Function
    If mMessmittel.Count = 0 Then Exit Function
    ReDim r(1 To mMessmittel.Count, 1 To 8)
    For Each k In mMessmittel.Keys
        e = mMessmittel(k)
        z = z + 1
        r(z, 1) = e(0): r(z, 2) = e(1): r(z, 3) = e(2): r(z, 4) = e(3)
        r(z, 5) = e(4): r(z, 6) = e(5)
        r(z, 8) = MessmittelStatus(e(4), e(5), Date, nx)
        r(z, 7) = nx
    Next k
    n = z
    MessmittelTabelle = r
End Function
