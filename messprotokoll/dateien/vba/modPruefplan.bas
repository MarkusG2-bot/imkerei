Attribute VB_Name = "modPruefplan"
Option Explicit
' Prüfpläne anlegen, laden, speichern und neue Zeichnungsstände ableiten.
' Ablage: Pruefplaene\<Artikel>\<Artikel>_Stand-<Stand>.xlsx
' Der aktuelle Stand je Artikel steht in Pruefplaene\<Artikel>\aktueller_Stand.txt

' Kopfzellen im Blatt "Prüfplan"
Public Const PP_ARTIKEL As String = "C2"
Public Const PP_BEZEICHNUNG As String = "C3"
Public Const PP_STAND As String = "C4"
Public Const PP_BASIS As String = "C5"
Public Const PP_ERSTELLT_VON As String = "G2"
Public Const PP_ERSTELLT_AM As String = "G3"
Public Const PP_STATUS As String = "G4"
Public Const PP_ENTFALLEN As String = "G5"

' Merkmalstabelle
Public Const PP_ERSTE As Long = 8
Public Const PP_MAX As Long = 1000
Public Const PP_SPALTEN As Long = 13
Public Const SP_NR As Long = 1
Public Const SP_MERKMAL As Long = 2
Public Const SP_ART As Long = 3
Public Const SP_NENN As Long = 4
Public Const SP_PASSUNG As Long = 5
Public Const SP_OBEN As Long = 6
Public Const SP_UNTEN As Long = 7
Public Const SP_OGW As Long = 8
Public Const SP_UGW As Long = 9
Public Const SP_MESSMITTEL As Long = 10
Public Const SP_KRITISCH As Long = 11
Public Const SP_AENDERUNG As Long = 12
Public Const SP_BEMERKUNG As Long = 13

Public Const STATUS_NEU As String = "Neu (nicht gespeichert)"
Public Const STATUS_GELADEN As String = "Gespeichert"
Public Const STATUS_NEUER_STAND As String = "Neuer Stand (nicht gespeichert)"

Private Const FARBE_NEU As Long = 13434828      ' hellgrün
Private Const FARBE_GEAENDERT As Long = 10092543 ' hellgelb
Private Const FARBE_GRAU As Long = 15921906     ' wie Vorlage (F2F2F2)

' Spalten, die für "geändert" verglichen werden
Private Function VergleichsSpalten() As Variant
    VergleichsSpalten = Array(SP_MERKMAL, SP_ART, SP_NENN, SP_PASSUNG, SP_OBEN, SP_UNTEN, SP_MESSMITTEL, SP_KRITISCH)
End Function

Private Function PP() As Worksheet
    Set PP = ThisWorkbook.Worksheets(BLATT_PP)
End Function

' ---------- Pfade ----------

Public Function PruefplanOrdner(ByVal artikel As String) As String
    PruefplanOrdner = Pfad(Basispfad(), ORDNER_PP, SichererName(artikel))
End Function

Public Function PruefplanDatei(ByVal artikel As String, ByVal stand As String) As String
    PruefplanDatei = Pfad(PruefplanOrdner(artikel), _
        SichererName(artikel) & "_Stand-" & SichererName(stand) & ".xlsx")
End Function

' Aktueller Stand eines Artikels ("" wenn keiner)
Public Function AktuellerStand(ByVal artikel As String) As String
    AktuellerStand = TextDateiLesen(Pfad(PruefplanOrdner(artikel), DATEI_AKTUELL))
End Function

' Alle gespeicherten Stände eines Artikels, durch ", " getrennt
Public Function VorhandeneStaende(ByVal artikel As String) As String
    Dim muster As String, f As String, r As String, vor As String
    vor = SichererName(artikel) & "_Stand-"
    muster = Pfad(PruefplanOrdner(artikel), vor & "*.xlsx")
    f = Dir(muster, vbNormal Or vbReadOnly)
    Do While f <> ""
        r = r & ", " & Mid(f, Len(vor) + 1, Len(f) - Len(vor) - 5)
        f = Dir()
    Loop
    If r <> "" Then VorhandeneStaende = Mid(r, 3)
End Function

' ---------- Schaltflächen ----------

Public Sub NeuerPruefplan()
    Dim artikel As String, stand As String
    If Not PruefeRolle(ROLLE_STAMMDATEN) Then Exit Sub
    If Not VerwerfenOk() Then Exit Sub

    artikel = Trim(InputBox("Artikelnummer des neuen Prüfplans:", "Neuer Prüfplan"))
    If artikel = "" Then Exit Sub
    If VorhandeneStaende(artikel) <> "" Then
        MsgBox "Für Artikel " & artikel & " gibt es schon Prüfpläne (Stand: " & VorhandeneStaende(artikel) & ")." & vbLf & _
            "Bitte den Prüfplan laden und ""Neuer Zeichnungsstand"" verwenden.", vbExclamation
        Exit Sub
    End If
    stand = Trim(InputBox("Zeichnungsstand (z. B. A oder 01):", "Neuer Prüfplan", "A"))
    If stand = "" Then Exit Sub

    BlattLeeren
    With PP()
        .Range(PP_ARTIKEL).Value = artikel
        .Range(PP_STAND).Value = stand
        .Range(PP_STATUS).Value = STATUS_NEU
        .Activate
        .Range(PP_BEZEICHNUNG).Select
    End With
    MerkeDatei "", 0
End Sub

Public Sub PruefplanLaden()
    Dim artikel As String, stand As String, staende As String, aktuell As String
    If Not VerwerfenOk() Then Exit Sub

    artikel = Trim(InputBox("Artikelnummer:", "Prüfplan laden", TextVon(PP().Range(PP_ARTIKEL).Value)))
    If artikel = "" Then Exit Sub
    staende = VorhandeneStaende(artikel)
    If staende = "" Then
        MsgBox "Für Artikel " & artikel & " gibt es noch keinen Prüfplan.", vbInformation
        Exit Sub
    End If
    aktuell = AktuellerStand(artikel)
    stand = Trim(InputBox("Vorhandene Stände: " & staende & vbLf & _
        "Aktueller Stand: " & IIf(aktuell = "", "-", aktuell) & vbLf & vbLf & _
        "Welchen Stand laden?", "Prüfplan laden", aktuell))
    If stand = "" Then Exit Sub
    If Not DateiExistiert(PruefplanDatei(artikel, stand)) Then
        MsgBox "Stand " & stand & " gibt es für Artikel " & artikel & " nicht.", vbExclamation
        Exit Sub
    End If
    LadeDatei PruefplanDatei(artikel, stand)
End Sub

Public Sub NeuerZeichnungsstand()
    Dim artikel As String, alt As String, neu As String
    If Not PruefeRolle(ROLLE_STAMMDATEN) Then Exit Sub
    With PP()
        artikel = Trim(TextVon(.Range(PP_ARTIKEL).Value))
        alt = Trim(TextVon(.Range(PP_STAND).Value))
        If TextVon(.Range(PP_STATUS).Value) <> STATUS_GELADEN Or artikel = "" Then
            MsgBox "Bitte zuerst den bisherigen Stand laden (oder speichern).", vbExclamation
            Exit Sub
        End If
        neu = Trim(InputBox("Bisheriger Stand: " & alt & vbLf & vbLf & _
            "Neuer Zeichnungsstand:", "Neuer Zeichnungsstand"))
        If neu = "" Then Exit Sub
        If DateiExistiert(PruefplanDatei(artikel, neu)) Then
            MsgBox "Stand " & neu & " existiert bereits.", vbExclamation
            Exit Sub
        End If
        .Range(PP_BASIS).Value = alt
        .Range(PP_STAND).Value = neu
        .Range(PP_STATUS).Value = STATUS_NEUER_STAND
        .Range(PP_ERSTELLT_VON).Value = ""
        .Range(PP_ERSTELLT_AM).Value = ""
        .Range(PP_ENTFALLEN).Value = ""
        .Range(.Cells(PP_ERSTE, SP_AENDERUNG), .Cells(PP_ERSTE + PP_MAX - 1, SP_AENDERUNG)).ClearContents
    End With
    FarbenZuruecksetzen
    MerkeDatei "", 0
    MsgBox "Stand " & neu & " wurde als Kopie von Stand " & alt & " angelegt." & vbLf & _
        "Jetzt nur die Änderungen eintragen und speichern." & vbLf & _
        "Geänderte und neue Merkmale werden beim Speichern farbig markiert.", vbInformation
End Sub

Public Sub PruefplanSpeichern()
    Dim ws As Worksheet, artikel As String, stand As String, basis As String, status As String
    Dim ziel As String, daten As Variant, letzte As Long, fehler As String
    Dim istNeuerStand As Boolean, alsAktuell As Boolean, entfallen As String

    If Not PruefeRolle(ROLLE_STAMMDATEN) Then Exit Sub
    Set ws = PP()
    artikel = Trim(TextVon(ws.Range(PP_ARTIKEL).Value))
    stand = Trim(TextVon(ws.Range(PP_STAND).Value))
    basis = Trim(TextVon(ws.Range(PP_BASIS).Value))
    status = TextVon(ws.Range(PP_STATUS).Value)
    If artikel = "" Or stand = "" Then
        MsgBox "Artikelnummer und Zeichnungsstand müssen ausgefüllt sein.", vbExclamation
        Exit Sub
    End If

    ws.Calculate
    daten = ws.Range(ws.Cells(PP_ERSTE, 1), ws.Cells(PP_ERSTE + PP_MAX - 1, PP_SPALTEN)).Value
    letzte = LetzteZeile(daten)
    If letzte = 0 Then
        MsgBox "Der Prüfplan enthält keine Merkmale.", vbExclamation
        Exit Sub
    End If
    If Not PruefeMerkmale(daten, letzte) Then Exit Sub

    ziel = PruefplanDatei(artikel, stand)
    ' Artikelnummer oder Stand dürfen nach dem Laden nicht von Hand geändert werden
    If status = STATUS_GELADEN And LCase(TextVon(Sys().Range(SYS_PP_DATEI).Value)) <> LCase(ziel) Then
        MsgBox "Artikelnummer oder Zeichnungsstand wurden geändert." & vbLf & _
            "Für einen neuen Stand bitte ""Neuer Zeichnungsstand"" verwenden," & vbLf & _
            "für einen anderen Artikel ""Neuer Prüfplan"".", vbExclamation
        Exit Sub
    End If
    If status = STATUS_NEU And VorhandeneStaende(artikel) <> "" Then
        MsgBox "Für Artikel " & artikel & " gibt es schon Prüfpläne." & vbLf & _
            "Bitte den Prüfplan laden und ""Neuer Zeichnungsstand"" verwenden.", vbExclamation
        Exit Sub
    End If
    If DateiExistiert(ziel) Then
        If DateiSchreibgeschuetzt(ziel) Then
            MsgBox "Stand " & stand & " ist abgeschlossen und darf nicht mehr geändert werden." & vbLf & _
                "Für Änderungen bitte ""Neuer Zeichnungsstand"" verwenden.", vbExclamation
            Exit Sub
        End If
        If LCase(TextVon(Sys().Range(SYS_PP_DATEI).Value)) <> LCase(ziel) Then
            MsgBox "Stand " & stand & " von Artikel " & artikel & " existiert bereits." & vbLf & _
                "Bitte diesen Stand laden, wenn er geändert werden soll.", vbExclamation
            Exit Sub
        End If
        If Not IstZahl(Sys().Range(SYS_PP_ZEIT).Value2) Then
            MsgBox "Bitte den Prüfplan neu laden.", vbExclamation
            Exit Sub
        End If
        If Abs(CDbl(FileDateTime(ziel)) - CDbl(Sys().Range(SYS_PP_ZEIT).Value2)) > 0.00001 Then
            MsgBox "Die Datei wurde inzwischen von jemand anderem geändert." & vbLf & _
                "Bitte den Prüfplan neu laden und die Änderungen erneut eintragen.", vbExclamation
            Exit Sub
        End If
    End If

    ' Änderungen gegenüber dem Basis-Stand markieren
    If basis <> "" Then
        If Not MarkiereAenderungen(artikel, basis, daten, letzte, entfallen, fehler) Then
            MsgBox fehler, vbExclamation
            Exit Sub
        End If
        ws.Range(PP_ENTFALLEN).Value = entfallen
        ws.Range(ws.Cells(PP_ERSTE, SP_AENDERUNG), ws.Cells(PP_ERSTE + letzte - 1, SP_AENDERUNG)).Value = _
            SpalteAus(daten, letzte, SP_AENDERUNG)
        FaerbeAenderungen daten, letzte
    End If

    If TextVon(ws.Range(PP_ERSTELLT_VON).Value) = "" Then
        ws.Range(PP_ERSTELLT_VON).Value = BenutzerAnzeige()
        ws.Range(PP_ERSTELLT_AM).Value = Now
    End If

    istNeuerStand = (status <> STATUS_GELADEN)
    alsAktuell = True
    If AktuellerStand(artikel) <> "" And AktuellerStand(artikel) <> stand Then
        alsAktuell = (MsgBox("Soll Stand " & stand & " ab jetzt der aktuelle Stand für neue Messprotokolle sein?" & vbLf & _
            "(bisher: " & AktuellerStand(artikel) & ")", vbYesNo + vbQuestion) = vbYes)
    End If

    On Error GoTo Fehler
    OrdnerAnlegen PruefplanOrdner(artikel)
    SchreibeDatei ziel, daten, letzte
    If alsAktuell Then TextDateiSchreiben Pfad(PruefplanOrdner(artikel), DATEI_AKTUELL), stand
    ' Basis-Stand nach dem ersten Speichern des neuen Stands abschließen
    If istNeuerStand And basis <> "" Then
        If DateiExistiert(PruefplanDatei(artikel, basis)) Then
            SetAttr PruefplanDatei(artikel, basis), vbReadOnly
        End If
    End If
    On Error GoTo 0

    ws.Range(PP_STATUS).Value = STATUS_GELADEN
    MerkeDatei ziel, CDbl(FileDateTime(ziel))
    MsgBox "Prüfplan gespeichert:" & vbLf & ziel & vbLf & vbLf & letzte & " Merkmale" & _
        IIf(alsAktuell, vbLf & "Stand " & stand & " ist der aktuelle Stand.", ""), vbInformation
    Exit Sub

Fehler:
    MsgBox "Speichern fehlgeschlagen:" & vbLf & Err.Description, vbCritical
End Sub

' ---------- Prüfungen ----------

Private Function PruefeMerkmale(ByVal daten As Variant, ByVal letzte As Long) As Boolean
    Dim z As Long, nr As String, meldung As String, anzahl As Long, ersteZeile As Long
    Dim ogw As Variant, ugw As Variant, fehler As String, nummern As Object

    Set nummern = CreateObject("Scripting.Dictionary")
    For z = 1 To letzte
        If ZeileHatInhalt(daten, z) Then
            fehler = ""
            nr = Trim(TextVon(daten(z, SP_NR)))
            If nr = "" Then
                fehler = "Nr fehlt"
            ElseIf nummern.Exists(LCase(nr)) Then
                fehler = "Nr " & nr & " doppelt (auch Zeile " & nummern(LCase(nr)) & ")"
            Else
                nummern(LCase(nr)) = PP_ERSTE + z - 1
                If Trim(TextVon(daten(z, SP_MERKMAL))) = "" Then
                    fehler = "Merkmal-Bezeichnung fehlt"
                ElseIf Not Grenzwerte(daten(z, SP_ART), daten(z, SP_NENN), daten(z, SP_PASSUNG), _
                        daten(z, SP_OBEN), daten(z, SP_UNTEN), ogw, ugw, fehler) Then
                    ' fehler ist gesetzt
                End If
            End If
            If fehler <> "" Then
                anzahl = anzahl + 1
                If ersteZeile = 0 Then ersteZeile = PP_ERSTE + z - 1
                If anzahl <= 15 Then meldung = meldung & "Zeile " & (PP_ERSTE + z - 1) & ": " & fehler & vbLf
            End If
        End If
    Next z

    If anzahl > 0 Then
        If anzahl > 15 Then meldung = meldung & "... und " & (anzahl - 15) & " weitere" & vbLf
        PP().Activate
        PP().Cells(ersteZeile, 1).Select
        MsgBox "Der Prüfplan wurde nicht gespeichert, bitte korrigieren:" & vbLf & vbLf & meldung, vbExclamation
        Exit Function
    End If
    PruefeMerkmale = True
End Function

Private Function ZeileHatInhalt(ByVal daten As Variant, ByVal z As Long) As Boolean
    Dim sp As Long
    For sp = 1 To PP_SPALTEN
        If sp <> SP_OGW And sp <> SP_UGW And sp <> SP_AENDERUNG Then
            If Not IstLeer(daten(z, sp)) Then
                ZeileHatInhalt = True
                Exit Function
            End If
        End If
    Next sp
End Function

Private Function LetzteZeile(ByVal daten As Variant) As Long
    Dim z As Long
    For z = UBound(daten, 1) To 1 Step -1
        If ZeileHatInhalt(daten, z) Then
            LetzteZeile = z
            Exit Function
        End If
    Next z
End Function

' ---------- Änderungen gegenüber Basis-Stand ----------

Private Function MarkiereAenderungen(ByVal artikel As String, ByVal basis As String, ByRef daten As Variant, _
        ByVal letzte As Long, ByRef entfallen As String, ByRef fehler As String) As Boolean
    Dim alt As Variant, altAnz As Long, altNr As Object, neuNr As Object
    Dim z As Long, nr As String, za As Long, i As Long, sp As Variant, gleich As Boolean

    If Not LiesDatei(PruefplanDatei(artikel, basis), Nothing, alt, altAnz) Then
        fehler = "Basis-Stand " & basis & " konnte nicht gelesen werden."
        Exit Function
    End If
    Set altNr = CreateObject("Scripting.Dictionary")
    For za = 1 To altAnz
        nr = LCase(Trim(TextVon(alt(za, SP_NR))))
        If nr <> "" Then altNr(nr) = za
    Next za

    Set neuNr = CreateObject("Scripting.Dictionary")
    For z = 1 To letzte
        daten(z, SP_AENDERUNG) = Empty
        nr = LCase(Trim(TextVon(daten(z, SP_NR))))
        If nr <> "" Then
            neuNr(nr) = z
            If Not altNr.Exists(nr) Then
                daten(z, SP_AENDERUNG) = "neu"
            Else
                za = altNr(nr)
                gleich = True
                For Each sp In VergleichsSpalten()
                    If sp = SP_ART Then
                        If ArtNormal(daten(z, sp)) <> ArtNormal(alt(za, sp)) Then gleich = False
                    ElseIf Not WerteGleich(daten(z, sp), alt(za, sp)) Then
                        gleich = False
                    End If
                Next sp
                If Not gleich Then daten(z, SP_AENDERUNG) = "geändert"
            End If
        End If
    Next z

    entfallen = ""
    For za = 1 To altAnz
        nr = LCase(Trim(TextVon(alt(za, SP_NR))))
        If nr <> "" And Not neuNr.Exists(nr) Then entfallen = entfallen & ", " & Trim(TextVon(alt(za, SP_NR)))
    Next za
    If entfallen <> "" Then entfallen = Mid(entfallen, 3)
    MarkiereAenderungen = True
End Function

Private Sub FaerbeAenderungen(ByVal daten As Variant, ByVal letzte As Long)
    Dim ws As Worksheet, z As Long, bereich As Range
    Set ws = PP()
    FarbenZuruecksetzen
    For z = 1 To letzte
        Set bereich = Union(ws.Cells(PP_ERSTE + z - 1, SP_NR), ws.Cells(PP_ERSTE + z - 1, SP_MERKMAL), _
            ws.Cells(PP_ERSTE + z - 1, SP_AENDERUNG))
        Select Case TextVon(daten(z, SP_AENDERUNG))
            Case "neu": bereich.Interior.Color = FARBE_NEU
            Case "geändert": bereich.Interior.Color = FARBE_GEAENDERT
        End Select
    Next z
End Sub

Private Function SpalteAus(ByVal daten As Variant, ByVal letzte As Long, ByVal sp As Long) As Variant
    Dim r() As Variant, z As Long
    ReDim r(1 To letzte, 1 To 1)
    For z = 1 To letzte
        r(z, 1) = daten(z, sp)
    Next z
    SpalteAus = r
End Function

' ---------- Datei lesen / schreiben ----------

' Schreibt den Prüfplan als eigene Excel-Datei (Blätter "Kopf" und "Merkmale").
' Erst unter Zwischennamen (~speichern_...) speichern, dann umbenennen -> keine halben Dateien.
Private Sub SchreibeDatei(ByVal ziel As String, ByVal daten As Variant, ByVal letzte As Long)
    Dim wb As Workbook, wsK As Worksheet, wsM As Worksheet, tmp As String
    Dim kopf As Variant, werte() As Variant, z As Long, sp As Long, ogw As Variant, ugw As Variant, f As String
    Dim ws As Worksheet, paar As Variant, anzahl As Long, zi As Long

    Set ws = PP()
    ' Leerzeilen weglassen, damit die Merkmale lückenlos gespeichert werden
    anzahl = 0
    For z = 1 To letzte
        If ZeileHatInhalt(daten, z) Then anzahl = anzahl + 1
    Next z
    ReDim werte(1 To anzahl + 1, 1 To PP_SPALTEN)
    For sp = 1 To PP_SPALTEN
        werte(1, sp) = ws.Cells(PP_ERSTE - 1, sp).Value
    Next sp
    zi = 1
    For z = 1 To letzte
        If ZeileHatInhalt(daten, z) Then
            zi = zi + 1
            For sp = 1 To PP_SPALTEN
                werte(zi, sp) = daten(z, sp)
            Next sp
            ' Grenzwerte als feste Zahlen ablegen (nicht als Formel)
            werte(zi, SP_OGW) = Empty
            werte(zi, SP_UGW) = Empty
            If Grenzwerte(daten(z, SP_ART), daten(z, SP_NENN), daten(z, SP_PASSUNG), _
                    daten(z, SP_OBEN), daten(z, SP_UNTEN), ogw, ugw, f) Then
                werte(zi, SP_OGW) = ogw
                werte(zi, SP_UGW) = ugw
            End If
            werte(zi, SP_ART) = ArtNormal(daten(z, SP_ART))
        End If
    Next z

    kopf = Array( _
        Array("Artikelnummer", ws.Range(PP_ARTIKEL).Value), _
        Array("Bezeichnung", ws.Range(PP_BEZEICHNUNG).Value), _
        Array("Zeichnungsstand", ws.Range(PP_STAND).Value), _
        Array("Basis-Stand", ws.Range(PP_BASIS).Value), _
        Array("Erstellt von", ws.Range(PP_ERSTELLT_VON).Value), _
        Array("Erstellt am", ws.Range(PP_ERSTELLT_AM).Value), _
        Array("Geändert von", BenutzerAnzeige()), _
        Array("Geändert am", Now), _
        Array("Entfallene Merkmale", ws.Range(PP_ENTFALLEN).Value), _
        Array("Anzahl Merkmale", anzahl), _
        Array("Programmversion", PROGRAMM_VERSION))

    Application.ScreenUpdating = False
    Set wb = Workbooks.Add(xlWBATWorksheet)
    Set wsM = wb.Worksheets(1)
    wsM.Name = "Merkmale"
    wsM.Range(wsM.Cells(1, 1), wsM.Cells(anzahl + 1, PP_SPALTEN)).Value = werte
    wsM.Rows(1).Font.Bold = True
    Set wsK = wb.Worksheets.Add(Before:=wsM)
    wsK.Name = "Kopf"
    For z = 0 To UBound(kopf)
        paar = kopf(z)
        wsK.Cells(z + 1, 1).Value = paar(0)
        wsK.Cells(z + 1, 2).Value = paar(1)
    Next z
    wsK.Columns("A:B").AutoFit

    tmp = Left(ziel, InStrRev(ziel, "\")) & "~speichern_" & Mid(ziel, InStrRev(ziel, "\") + 1)
    If DateiExistiert(tmp) Then Kill tmp

    Application.DisplayAlerts = False
    wb.SaveAs Filename:=tmp, FileFormat:=51
    Application.DisplayAlerts = True
    wb.Close SaveChanges:=False
    Application.ScreenUpdating = True

    If DateiExistiert(ziel) Then Kill ziel
    Name tmp As ziel
End Sub

' Liest eine Prüfplan-Datei. kopf (Dictionary) darf Nothing sein.
Public Function LiesDatei(ByVal datei As String, ByVal kopf As Object, ByRef daten As Variant, ByRef anzahl As Long) As Boolean
    Dim wb As Workbook, k As Variant, z As Long, scr As Boolean, letzteZ As Long, warOffen As Boolean

    If Not DateiExistiert(datei) Then Exit Function
    scr = Application.ScreenUpdating
    Application.ScreenUpdating = False
    On Error GoTo Fehler
    Set wb = MappeLesen(datei, warOffen)
    If Not kopf Is Nothing Then
        k = wb.Worksheets("Kopf").Range("A1:B30").Value
        For z = 1 To UBound(k, 1)
            If Trim(TextVon(k(z, 1))) <> "" Then kopf(Trim(TextVon(k(z, 1)))) = k(z, 2)
        Next z
    End If
    With wb.Worksheets("Merkmale")
        letzteZ = .Cells(.Rows.Count, SP_NR).End(xlUp).Row
        If .Cells(.Rows.Count, SP_MERKMAL).End(xlUp).Row > letzteZ Then letzteZ = .Cells(.Rows.Count, SP_MERKMAL).End(xlUp).Row
        anzahl = letzteZ - 1
        If anzahl > 0 Then
            daten = .Range(.Cells(2, 1), .Cells(letzteZ, PP_SPALTEN)).Value
        End If
    End With
    MappeSchliessen wb, warOffen
    Application.ScreenUpdating = scr
    LiesDatei = True
    Exit Function
Fehler:
    Application.ScreenUpdating = scr
    On Error Resume Next
    MappeSchliessen wb, warOffen
End Function

Private Sub LadeDatei(ByVal datei As String)
    Dim kopf As Object, daten As Variant, anzahl As Long, ws As Worksheet, z As Long, sp As Long
    Dim links() As Variant, rechts() As Variant

    Set kopf = CreateObject("Scripting.Dictionary")
    If Not LiesDatei(datei, kopf, daten, anzahl) Then
        MsgBox "Prüfplan konnte nicht gelesen werden:" & vbLf & datei, vbCritical
        Exit Sub
    End If
    If anzahl > PP_MAX Then
        MsgBox "Der Prüfplan hat mehr als " & PP_MAX & " Merkmale.", vbCritical
        Exit Sub
    End If

    On Error GoTo Fehler
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    BlattLeeren
    Set ws = PP()
    ws.Range(PP_ARTIKEL).Value = kopf("Artikelnummer")
    ws.Range(PP_BEZEICHNUNG).Value = kopf("Bezeichnung")
    ws.Range(PP_STAND).Value = kopf("Zeichnungsstand")
    ws.Range(PP_BASIS).Value = kopf("Basis-Stand")
    ws.Range(PP_ERSTELLT_VON).Value = kopf("Erstellt von")
    ws.Range(PP_ERSTELLT_AM).Value = kopf("Erstellt am")
    ws.Range(PP_ENTFALLEN).Value = kopf("Entfallene Merkmale")

    If anzahl > 0 Then
        ' Spalten A-G und J-M schreiben, H und I enthalten die Formeln
        ReDim links(1 To anzahl, 1 To SP_UNTEN)
        ReDim rechts(1 To anzahl, 1 To PP_SPALTEN - SP_UGW)
        For z = 1 To anzahl
            For sp = 1 To SP_UNTEN
                links(z, sp) = daten(z, sp)
            Next sp
            For sp = SP_MESSMITTEL To PP_SPALTEN
                rechts(z, sp - SP_UGW) = daten(z, sp)
            Next sp
        Next z
        ws.Range(ws.Cells(PP_ERSTE, 1), ws.Cells(PP_ERSTE + anzahl - 1, SP_UNTEN)).Value = links
        ws.Range(ws.Cells(PP_ERSTE, SP_MESSMITTEL), ws.Cells(PP_ERSTE + anzahl - 1, PP_SPALTEN)).Value = rechts
        FaerbeAenderungen daten, anzahl
    End If

    ws.Range(PP_STATUS).Value = STATUS_GELADEN
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MerkeDatei datei, CDbl(FileDateTime(datei))
    ws.Activate
    ws.Cells(PP_ERSTE, 1).Select
    If DateiSchreibgeschuetzt(datei) Then
        MsgBox "Stand " & kopf("Zeichnungsstand") & " ist abgeschlossen (nur lesen)." & vbLf & _
            "Für Änderungen ""Neuer Zeichnungsstand"" verwenden.", vbInformation
    End If
    Exit Sub
Fehler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Fehler beim Laden:" & vbLf & Err.Description, vbCritical
End Sub

' ---------- Hilfen ----------

Private Sub BlattLeeren()
    Dim ws As Worksheet
    Set ws = PP()
    ws.Range(PP_ARTIKEL & "," & PP_BEZEICHNUNG & "," & PP_STAND & "," & PP_BASIS & "," & _
        PP_ERSTELLT_VON & "," & PP_ERSTELLT_AM & "," & PP_STATUS & "," & PP_ENTFALLEN).ClearContents
    ws.Range(ws.Cells(PP_ERSTE, 1), ws.Cells(PP_ERSTE + PP_MAX - 1, SP_UNTEN)).ClearContents
    ws.Range(ws.Cells(PP_ERSTE, SP_MESSMITTEL), ws.Cells(PP_ERSTE + PP_MAX - 1, PP_SPALTEN)).ClearContents
    FarbenZuruecksetzen
End Sub

' Markierungen entfernen (Spalte Änderung bleibt grau wie in der Vorlage)
Private Sub FarbenZuruecksetzen()
    Dim ws As Worksheet
    Set ws = PP()
    ws.Range(ws.Cells(PP_ERSTE, SP_NR), ws.Cells(PP_ERSTE + PP_MAX - 1, SP_MERKMAL)).Interior.Pattern = xlNone
    ws.Range(ws.Cells(PP_ERSTE, SP_AENDERUNG), ws.Cells(PP_ERSTE + PP_MAX - 1, SP_AENDERUNG)).Interior.Color = FARBE_GRAU
End Sub

' Fragt nach, wenn ungespeicherte Inhalte verloren gehen würden
Private Function VerwerfenOk() As Boolean
    Dim st As String
    st = TextVon(PP().Range(PP_STATUS).Value)
    If st = STATUS_NEU Or st = STATUS_NEUER_STAND Then
        VerwerfenOk = (MsgBox("Der aktuelle Prüfplan ist noch nicht gespeichert." & vbLf & _
            "Trotzdem verwerfen?", vbYesNo + vbExclamation) = vbYes)
    Else
        VerwerfenOk = True
    End If
End Function

Private Sub MerkeDatei(ByVal datei As String, ByVal zeit As Double)
    Sys().Range(SYS_PP_DATEI).Value = datei
    If datei = "" Then
        Sys().Range(SYS_PP_ZEIT).ClearContents
    Else
        Sys().Range(SYS_PP_ZEIT).Value2 = zeit
    End If
End Sub
