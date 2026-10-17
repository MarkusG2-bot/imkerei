Attribute VB_Name = "modMessung"
Option Explicit
' Messprotokolle erfassen, zwischenspeichern, abschließen, freigeben.
' Einstieg immer über die Produktnummer (eindeutig, z. B. J1567/1).

' Kopfzellen im Blatt "Messung"
Private Const Z_PRODUKT As String = "C2"
Private Const Z_ARTIKEL As String = "C3"
Private Const Z_BEZEICHNUNG As String = "C4"
Private Const Z_AUFTRAG As String = "C5"
Private Const Z_KUNDE As String = "C6"
Private Const Z_STD_MM As String = "C7"
Private Const Z_STAND As String = "G2"
Private Const Z_PRUEFER As String = "G3"
Private Const Z_BEGONNEN As String = "G4"
Private Const Z_STATUS As String = "G5"
Private Const Z_ERGEBNIS As String = "G6"
Private Const Z_ABGESCHLOSSEN As String = "G7"
Private Const Z_MODUS As String = "A8"

Public Const MS_ERSTE As Long = 10
Public Const MS_MAX As Long = 1000

Private Function MS() As Worksheet
    Set MS = ThisWorkbook.Worksheets(BLATT_MESSUNG)
End Function

' ---------- Schaltflächen ----------

' "Messung starten / öffnen": fragt die Produktnummer
Public Sub MessungStarten()
    Dim prod As String
    If Not AktuellesSchliessenOk() Then Exit Sub
    prod = Trim(InputBox("Produktnummer (z. B. J1567/1):", "Messung starten / öffnen"))
    If prod = "" Then Exit Sub
    OeffnenOderNeu prod
End Sub

' Öffnet eine bestimmte Produktnummer (z. B. aus der Liste der offenen Protokolle)
Public Sub MessungOeffnenNummer(ByVal prod As String)
    If Not AktuellesSchliessenOk() Then Exit Sub
    OeffnenOderNeu prod
    MS().Activate
End Sub

' Öffnet das Protokoll zur Produktnummer oder legt ein neues an
Public Sub OeffnenOderNeu(ByVal prod As String)
    Dim rel As String, datei As String
    rel = TextDateiLesen(Pfad(Basispfad(), IndexRelPfad(prod)))
    If rel <> "" Then
        datei = Pfad(Basispfad(), rel)
        If Not DateiExistiert(datei) Then
            MsgBox "Zur Produktnummer " & prod & " ist ein Protokoll vermerkt, die Datei fehlt aber:" & vbLf & datei, vbCritical
            Exit Sub
        End If
        ProtokollOeffnen datei
    Else
        NeuesProtokoll prod
    End If
End Sub

Public Sub Zwischenspeichern()
    SpeichernIntern False
End Sub

Public Sub Abschliessen()
    SpeichernIntern True
End Sub

Public Sub ProtokollSchliessen()
    If Bearbeitbar() Then
        If MsgBox("Protokoll schließen? Nicht gespeicherte Eingaben gehen verloren.", _
                vbYesNo + vbQuestion) <> vbYes Then Exit Sub
    End If
    SperreFreigeben
    BlattLeeren
    MerkeProtokoll "", False
End Sub

' Beim Schließen von Excel: eigene Sperre freigeben (aus Workbook_BeforeClose)
Public Sub SperreFreigeben()
    Dim prod As String, sp As String, wer As String, seit As Date
    On Error Resume Next
    If Not Bearbeitbar() Then Exit Sub
    prod = TextVon(MS().Range(Z_PRODUKT).Value)
    If prod = "" Then Exit Sub
    sp = Pfad(Basispfad(), SperreRelPfad(prod))
    If SperreLesen(sp, wer, seit) Then
        If wer = Benutzer() Then DateiLoeschen sp
    End If
End Sub

' ---------- Anlegen und Öffnen ----------

Private Sub NeuesProtokoll(ByVal prod As String)
    Dim art As String, stand As String, plan As String, pk As Object, pd As Variant, pn As Long
    Dim auftrag As String, kunde As String, stdMM As String, kopf() As Variant, daten() As Variant
    Dim z As Long, zi As Long, zp As Long, datei As String, rel As String

    If Not PruefeRolle(ROLLE_PRUEFER) Then Exit Sub
    art = Trim(InputBox("Zur Produktnummer " & prod & " gibt es noch kein Protokoll." & vbLf & vbLf & _
        "Artikelnummer für das neue Protokoll:", "Neues Messprotokoll"))
    If art = "" Then Exit Sub
    stand = AktuellerStand(art)
    If stand = "" Then
        MsgBox "Für Artikel " & art & " gibt es keinen Prüfplan." & vbLf & _
            "Bitte zuerst den Prüfplan anlegen (Stammdaten-Gruppe).", vbExclamation
        Exit Sub
    End If
    plan = PruefplanDatei(art, stand)
    Set pk = CreateObject("Scripting.Dictionary")
    If Not LiesDatei(plan, pk, pd, pn) Then
        MsgBox "Prüfplan konnte nicht gelesen werden:" & vbLf & plan, vbCritical
        Exit Sub
    End If
    If pn < 1 Or pn > MS_MAX Then
        MsgBox "Prüfplan hat keine oder zu viele Merkmale (" & pn & ").", vbCritical
        Exit Sub
    End If

    auftrag = Trim(InputBox("Auftragsnummer:", "Neues Messprotokoll " & prod))
    If auftrag = "" Then Exit Sub
    kunde = Trim(InputBox("Kunde:", "Neues Messprotokoll " & prod))
    If kunde = "" Then Exit Sub
    stdMM = Trim(InputBox("Standard-Messmittel für alle Merkmale (Nr, optional)." & vbLf & _
        "Abweichende Messmittel je Merkmal in Spalte Messmittel eintragen.", "Neues Messprotokoll " & prod))

    ReDim kopf(1 To KOPF_ANZ)
    kopf(K_PRODUKT) = prod
    kopf(K_ARTIKEL) = TextVon(pk("Artikelnummer"))
    kopf(K_BEZEICHNUNG) = pk("Bezeichnung")
    kopf(K_AUFTRAG) = auftrag
    kopf(K_KUNDE) = kunde
    kopf(K_STAND) = stand
    kopf(K_STATUS) = ST_IN_ARBEIT
    kopf(K_PRUEFER) = BenutzerAnzeige()
    kopf(K_BEGONNEN) = Now
    kopf(K_GEAENDERT_VON) = BenutzerAnzeige()
    kopf(K_GEAENDERT_AM) = Now
    If stdMM <> "" Then kopf(K_STD_MESSMITTEL) = stdMM
    kopf(K_VERSION) = PROGRAMM_VERSION

    ' Merkmale aus dem Prüfplan übernehmen (Spalten siehe modPruefplan), Leerzeilen überspringen
    ReDim daten(1 To pn, 1 To MERKMAL_ANZ)
    zi = 0
    For zp = 1 To pn
        If Not (IstLeer(pd(zp, SP_NR)) And IstLeer(pd(zp, SP_MERKMAL))) Then
            zi = zi + 1
            z = zi
            daten(z, M_NR) = pd(zp, SP_NR)
            daten(z, M_MERKMAL) = pd(zp, SP_MERKMAL)
            daten(z, M_ART) = pd(zp, SP_ART)
            daten(z, M_NENN) = pd(zp, SP_NENN)
            daten(z, M_PASSUNG) = pd(zp, SP_PASSUNG)
            If IstZahl(pd(zp, SP_OGW)) Then daten(z, M_OGW) = CDbl(pd(zp, SP_OGW))
            If IstZahl(pd(zp, SP_UGW)) Then daten(z, M_UGW) = CDbl(pd(zp, SP_UGW))
            daten(z, M_KRITISCH) = pd(zp, SP_KRITISCH)
            daten(z, M_MM_TYP) = pd(zp, SP_MESSMITTEL)
        End If
    Next zp
    pn = zi

    ' Produktnummer kurz vor dem Anlegen nochmals prüfen (jemand anderes könnte schneller sein)
    If TextDateiLesen(Pfad(Basispfad(), IndexRelPfad(prod))) <> "" Then
        MsgBox "Zur Produktnummer " & prod & " wurde gerade ein Protokoll angelegt. Bitte erneut öffnen.", vbExclamation
        Exit Sub
    End If

    On Error GoTo Fehler
    rel = ProtokollRelPfad(ST_IN_ARBEIT, prod, art, Empty)
    datei = Pfad(Basispfad(), rel)
    SchreibeProtokoll datei, kopf, daten, pn
    TextDateiSchreiben Pfad(Basispfad(), IndexRelPfad(prod)), rel
    SperreSetzen Pfad(Basispfad(), SperreRelPfad(prod)), Benutzer()
    ' Der verwendete Prüfplan-Stand darf ab jetzt nicht mehr geändert werden
    Schreibschutz plan, True
    On Error GoTo 0

    BlattFuellen kopf, daten, pn, True
    MerkeProtokoll datei, True
    MS().Activate
    MS().Cells(MS_ERSTE, M_IST).Select
    Exit Sub
Fehler:
    MsgBox "Protokoll konnte nicht angelegt werden:" & vbLf & Err.Description, vbCritical
End Sub

Private Sub ProtokollOeffnen(ByVal datei As String)
    Dim kopf As Variant, daten As Variant, n As Long, status As String, darf As Boolean
    Dim sp As String, wer As String, seit As Date, prod As String, z As Long, nach As Long

    If Not LiesProtokoll(datei, kopf, daten, n) Then
        MsgBox "Protokoll konnte nicht gelesen werden:" & vbLf & datei, vbCritical
        Exit Sub
    End If
    prod = TextVon(kopf(K_PRODUKT))
    status = TextVon(kopf(K_STATUS))

    Select Case status
        Case ST_ABGESCHLOSSEN
            darf = False
        Case ST_FREIGABE
            darf = HatRolle(ROLLE_FREIGEBER)
        Case Else
            darf = HatRolle(ROLLE_PRUEFER) Or HatRolle(ROLLE_FREIGEBER)
    End Select

    ' Sperre: bearbeitet gerade jemand anderes?
    If darf Then
        sp = Pfad(Basispfad(), SperreRelPfad(prod))
        If SperreLesen(sp, wer, seit) Then
            If wer <> Benutzer() And Now - seit < 0.5 Then
                If MsgBox("Protokoll " & prod & " wird gerade von " & wer & " bearbeitet (seit " & _
                        Format(seit, "dd.mm.yyyy hh:nn") & ")." & vbLf & vbLf & "Nur ansehen?", _
                        vbYesNo + vbQuestion) = vbYes Then
                    darf = False
                ElseIf MsgBox("Sperre von " & wer & " aufheben und selbst bearbeiten?" & vbLf & _
                        "Nur wenn " & wer & " sicher nicht mehr daran arbeitet!", _
                        vbYesNo + vbExclamation) <> vbYes Then
                    Exit Sub
                End If
            End If
        End If
    End If

    ' Nach Nacharbeit: Merkmale zum Nachmessen vorbereiten
    If darf And status = ST_NACHARBEIT Then
        If MsgBox("Protokoll " & prod & " wartet auf Nacharbeit." & vbLf & vbLf & _
                "Wurde das Teil nachgearbeitet und soll jetzt nachgemessen werden?", vbYesNo + vbQuestion) = vbYes Then
            For z = 1 To n
                If TextVon(daten(z, M_ENTSCHEIDUNG)) = E_NACHARBEIT Then
                    daten(z, M_VORWERT) = daten(z, M_IST)
                    daten(z, M_IST) = Empty
                    daten(z, M_BEMERKUNG) = "Nacharbeit " & Format(Date, "dd.mm.yyyy") & _
                        IIf(TextVon(daten(z, M_BEMERKUNG)) <> "", "; " & TextVon(daten(z, M_BEMERKUNG)), "")
                    daten(z, M_ENTSCHEIDUNG) = Empty
                    daten(z, M_BEGRUENDUNG) = Empty
                    daten(z, M_ENTSCHIEDEN_VON) = Empty
                    daten(z, M_ENTSCHIEDEN_AM) = Empty
                    nach = nach + 1
                End If
            Next z
            kopf(K_STATUS) = ST_IN_ARBEIT
        Else
            darf = False
        End If
    End If

    If darf Then SperreSetzen Pfad(Basispfad(), SperreRelPfad(prod)), Benutzer()
    BlattFuellen kopf, daten, n, darf
    MerkeProtokoll datei, darf
    MS().Activate
    If nach > 0 Then
        MsgBox nach & " Merkmal(e) zum Nachmessen vorbereitet (alter Wert steht in Spalte Vorwert).", vbInformation
    ElseIf status = ST_ABGESCHLOSSEN Then
        MsgBox "Protokoll " & prod & " ist abgeschlossen (Ergebnis: " & TextVon(kopf(K_ERGEBNIS)) & ")." & vbLf & _
            "Es kann nur angesehen werden.", vbInformation
    ElseIf Not darf Then
        MsgBox "Protokoll " & prod & " (" & status & ") wird nur angezeigt.", vbInformation
    End If
End Sub

' ---------- Speichern und Abschließen ----------

Private Function SpeichernIntern(ByVal endgueltig As Boolean) As Boolean
    Dim kopf() As Variant, daten As Variant, n As Long, z As Long, datei As String
    Dim prod As String, art As String, status As String, altStatus As String, ergebnis As String, offen As Long
    Dim bew() As Variant, ents() As Variant, b As String, e As String, mm As String, grund As String
    Dim meldung As String, anzahl As Long, ersteZeile As Long, f As String
    Dim neuRel As String, neuDatei As String, wer As String, seit As Date, pdf As String
    Dim istFreigeber As Boolean, frage As String
    Dim altKopf As Variant, altDaten As Variant, altN As Long, alt As Object, nr As String
    Dim altWerte As Variant, neuGemessen As Boolean

    If Not Bearbeitbar() Then
        MsgBox "Es ist kein Protokoll zum Bearbeiten geöffnet.", vbExclamation
        Exit Function
    End If
    LiesBlatt kopf, daten, n
    prod = TextVon(kopf(K_PRODUKT))
    art = TextVon(kopf(K_ARTIKEL))
    altStatus = TextVon(kopf(K_STATUS))
    If TextVon(kopf(K_AUFTRAG)) = "" Or TextVon(kopf(K_KUNDE)) = "" Then
        MsgBox "Auftragsnummer und Kunde müssen ausgefüllt sein.", vbExclamation
        Exit Function
    End If

    ' Hat inzwischen jemand anderes gespeichert oder die Sperre übernommen?
    datei = TextVon(Sys().Range(SYS_MS_DATEI).Value)
    If DateiExistiert(datei) Then
        If Abs(CDbl(FileDateTime(datei)) - CDbl(Sys().Range(SYS_MS_ZEIT).Value2)) > 0.00001 Then
            MsgBox "Das Protokoll wurde inzwischen von jemand anderem gespeichert." & vbLf & _
                "Bitte neu öffnen und die Eingaben wiederholen.", vbExclamation
            Exit Function
        End If
    ElseIf datei <> "" Then
        MsgBox "Die Protokoll-Datei wurde inzwischen verschoben (z. B. freigegeben)." & vbLf & _
            "Bitte neu öffnen.", vbExclamation
        Exit Function
    End If
    If SperreLesen(Pfad(Basispfad(), SperreRelPfad(prod)), wer, seit) Then
        If wer <> Benutzer() Then
            MsgBox "Die Bearbeitung wurde von " & wer & " übernommen. Speichern nicht möglich.", vbExclamation
            Exit Function
        End If
    End If

    ' Gespeicherter Stand: was ist in dieser Sitzung neu gemessen oder neu entschieden?
    Set alt = CreateObject("Scripting.Dictionary")
    If datei <> "" Then
        If LiesProtokoll(datei, altKopf, altDaten, altN) Then
            For z = 1 To altN
                mm = Trim(TextVon(altDaten(z, M_MESSMITTEL)))
                If mm = "" Then mm = Trim(TextVon(altKopf(K_STD_MESSMITTEL)))
                alt(LCase(Trim(TextVon(altDaten(z, M_NR))))) = Array(CsvFeld(altDaten(z, M_IST)), LCase(mm), _
                    TextVon(altDaten(z, M_ENTSCHEIDUNG)))
            Next z
        End If
    End If

    ' Zeilen prüfen
    istFreigeber = HatRolle(ROLLE_FREIGEBER)
    ReDim bew(1 To n)
    ReDim ents(1 To n)
    For z = 1 To n
        f = ""
        b = BewertungMerkmal(daten(z, M_ART), daten(z, M_IST), daten(z, M_OGW), daten(z, M_UGW))
        daten(z, M_BEWERTUNG) = IIf(b = "", Empty, b)
        e = Trim(TextVon(daten(z, M_ENTSCHEIDUNG)))
        If b = "ungültig" Then
            If ArtNormal(daten(z, M_ART)) = ART_ATTRIBUT Then
                f = "Istwert: i.O. oder n.i.O. eintragen"
            Else
                f = "Istwert ist keine Zahl"
            End If
        ElseIf b = "" Then
            If endgueltig Then f = "Istwert fehlt"
        Else
            ' Messmittel: fehlt -> beim Abschließen Fehler; neu gemessen -> Kalibrierung heute gültig?
            mm = Trim(TextVon(daten(z, M_MESSMITTEL)))
            If mm = "" Then mm = Trim(TextVon(kopf(K_STD_MESSMITTEL)))
            nr = LCase(Trim(TextVon(daten(z, M_NR))))
            neuGemessen = True
            If alt.Exists(nr) Then
                altWerte = alt(nr)
                neuGemessen = (altWerte(0) <> CsvFeld(daten(z, M_IST)) Or altWerte(1) <> LCase(mm))
            End If
            If mm = "" Then
                If endgueltig Then f = "Messmittel fehlt (Spalte Messmittel oder Standard-Messmittel)"
            ElseIf neuGemessen Then
                If Not MessmittelOk(mm, Date, grund) Then f = grund
            End If
        End If
        If f = "" And b <> "n.i.O." And e <> "" Then
            ' Entscheidung nur bei n.i.O. (z. B. nach Korrektur des Messwerts)
            daten(z, M_ENTSCHEIDUNG) = Empty: daten(z, M_BEGRUENDUNG) = Empty
            daten(z, M_ENTSCHIEDEN_VON) = Empty: daten(z, M_ENTSCHIEDEN_AM) = Empty
            e = ""
        End If
        If f = "" And b = "n.i.O." And e <> "" Then
            If e <> E_NACHARBEIT And e <> E_SONDERFREIGABE And e <> E_AUSSCHUSS Then
                f = "Entscheidung nur Nacharbeit, Sonderfreigabe oder Ausschuss"
            Else
                ' Neue oder geänderte Entscheidung: neu abzeichnen
                nr = LCase(Trim(TextVon(daten(z, M_NR))))
                If alt.Exists(nr) Then
                    altWerte = alt(nr)
                    If altWerte(2) <> e Then
                        daten(z, M_ENTSCHIEDEN_VON) = Empty
                        daten(z, M_ENTSCHIEDEN_AM) = Empty
                    End If
                End If
            End If
            If f = "" And IstLeer(daten(z, M_ENTSCHIEDEN_VON)) Then
                If (e = E_SONDERFREIGABE Or e = E_AUSSCHUSS) And Not istFreigeber Then
                    f = e & " darf nur die Freigabe-Gruppe entscheiden"
                ElseIf (e = E_SONDERFREIGABE Or e = E_AUSSCHUSS) And IstLeer(daten(z, M_BEGRUENDUNG)) Then
                    f = "Begründung für " & e & " fehlt"
                Else
                    daten(z, M_ENTSCHIEDEN_VON) = BenutzerAnzeige()
                    daten(z, M_ENTSCHIEDEN_AM) = Now
                End If
            End If
        End If
        If f <> "" Then
            anzahl = anzahl + 1
            If ersteZeile = 0 Then ersteZeile = MS_ERSTE + z - 1
            If anzahl <= 15 Then meldung = meldung & "Nr " & TextVon(daten(z, M_NR)) & ": " & f & vbLf
        End If
        bew(z) = b
        ents(z) = e
    Next z
    If anzahl > 0 Then
        If anzahl > 15 Then meldung = meldung & "... und " & (anzahl - 15) & " weitere" & vbLf
        MS().Activate
        MS().Cells(ersteZeile, M_IST).Select
        MsgBox "Bitte korrigieren:" & vbLf & vbLf & meldung, vbExclamation, IIf(endgueltig, "Abschließen", "Zwischenspeichern")
        Exit Function
    End If

    ' Neuer Status
    status = altStatus
    If endgueltig Then
        status = Abschlussstatus(bew, ents, ergebnis, offen)
        Select Case status
            Case ST_ABGESCHLOSSEN
                frage = "Protokoll endgültig abschließen?" & vbLf & vbLf & "Ergebnis: " & ergebnis & vbLf & _
                    "Danach kann es nicht mehr geändert werden."
            Case ST_FREIGABE
                frage = offen & " Merkmal(e) n.i.O. ohne Entscheidung." & vbLf & _
                    "Protokoll an die Freigabe-Gruppe übergeben?"
            Case ST_NACHARBEIT
                frage = "Teil geht in die Nacharbeit." & vbLf & _
                    "Nach der Nacharbeit die Produktnummer wieder öffnen und nachmessen." & vbLf & vbLf & "Fortfahren?"
        End Select
        If MsgBox(frage, vbYesNo + vbQuestion, "Abschließen") <> vbYes Then Exit Function
        If status = ST_ABGESCHLOSSEN Then
            kopf(K_ABGESCHLOSSEN) = Now
            kopf(K_ERGEBNIS) = ergebnis
        End If
    End If
    kopf(K_STATUS) = status
    kopf(K_GEAENDERT_VON) = BenutzerAnzeige()
    kopf(K_GEAENDERT_AM) = Now
    kopf(K_VERSION) = PROGRAMM_VERSION

    ' Schreiben (neue Ablage je Status), Verweis aktualisieren, alte Datei entfernen
    On Error GoTo Fehler
    neuRel = ProtokollRelPfad(status, prod, art, kopf(K_ABGESCHLOSSEN))
    neuDatei = Pfad(Basispfad(), neuRel)
    If LCase(neuDatei) <> LCase(datei) And DateiExistiert(neuDatei) Then
        MsgBox "Am Zielort gibt es schon eine Datei:" & vbLf & neuDatei, vbCritical
        Exit Function
    End If
    SchreibeProtokoll neuDatei, kopf, daten, n
    TextDateiSchreiben Pfad(Basispfad(), IndexRelPfad(prod)), neuRel
    If datei <> "" And LCase(neuDatei) <> LCase(datei) Then DateiLoeschen datei

    If status = ST_ABGESCHLOSSEN Then
        Schreibschutz neuDatei, True
        DateiLoeschen Pfad(Basispfad(), SperreRelPfad(prod))
        BlattFuellen kopf, daten, n, False
        MerkeProtokoll neuDatei, False
        pdf = Pfad(Basispfad(), PdfRelPfad(prod, art, kopf(K_ABGESCHLOSSEN)))
        PdfErzeugen pdf, n
        MsgBox "Protokoll " & prod & " abgeschlossen." & vbLf & "Ergebnis: " & ergebnis & vbLf & vbLf & _
            "PDF: " & pdf, vbInformation
    ElseIf endgueltig Then
        ' Übergabe an Freigabe oder Nacharbeit: Bearbeitung hier beenden
        DateiLoeschen Pfad(Basispfad(), SperreRelPfad(prod))
        BlattFuellen kopf, daten, n, False
        MerkeProtokoll neuDatei, False
        If status = ST_FREIGABE Then
            MsgBox "Protokoll " & prod & " wartet jetzt auf die Freigabe-Gruppe.", vbInformation
        Else
            MsgBox "Protokoll " & prod & " wartet auf Nacharbeit.", vbInformation
        End If
    Else
        BlattFuellen kopf, daten, n, True
        MerkeProtokoll neuDatei, True
        Application.StatusBar = "Protokoll " & prod & " zwischengespeichert (" & Format(Now, "hh:nn") & ")"
    End If
    SpeichernIntern = True
    Exit Function
Fehler:
    MsgBox "Speichern fehlgeschlagen:" & vbLf & Err.Description, vbCritical
End Function

Private Sub PdfErzeugen(ByVal pdf As String, ByVal n As Long)
    Dim ws As Worksheet, modus As Variant
    Set ws = MS()
    On Error GoTo Fehler
    OrdnerFuerDatei pdf
    Schutz ws, False
    modus = ws.Range(Z_MODUS).Value
    ws.Range(Z_MODUS).Value = ""
    With ws.PageSetup
        .PrintArea = "$A$1:$Q$" & (MS_ERSTE + n - 1)
        .PrintTitleRows = "$" & (MS_ERSTE - 1) & ":$" & (MS_ERSTE - 1)
        .Orientation = xlLandscape
        .Zoom = False
        .FitToPagesWide = 1
        .FitToPagesTall = False
        .LeftFooter = "Produktnummer " & TextVon(ws.Range(Z_PRODUKT).Value)
        .CenterFooter = "Seite &P von &N"
        .RightFooter = "Erstellt " & Format(Now, "dd.mm.yyyy hh:nn")
    End With
    ws.ExportAsFixedFormat Type:=xlTypePDF, Filename:=pdf, Quality:=xlQualityStandard, _
        IncludeDocProperties:=False, IgnorePrintAreas:=False, OpenAfterPublish:=False
    ws.Range(Z_MODUS).Value = modus
    Schutz ws, True
    Exit Sub
Fehler:
    ws.Range(Z_MODUS).Value = modus
    Schutz ws, True
    MsgBox "PDF konnte nicht erzeugt werden:" & vbLf & Err.Description & vbLf & pdf, vbExclamation
End Sub

' ---------- Blatt lesen und füllen ----------

Private Sub BlattFuellen(ByVal kopf As Variant, ByVal daten As Variant, ByVal n As Long, ByVal bearbeiten As Boolean)
    Dim ws As Worksheet, links() As Variant, rechts() As Variant, z As Long, sp As Long
    Set ws = MS()
    Application.ScreenUpdating = False
    Schutz ws, False
    BlattLeerenOhneSchutz
    ws.Range(Z_PRODUKT).Value = kopf(K_PRODUKT)
    ws.Range(Z_ARTIKEL).Value = kopf(K_ARTIKEL)
    ws.Range(Z_BEZEICHNUNG).Value = kopf(K_BEZEICHNUNG)
    ws.Range(Z_AUFTRAG).Value = kopf(K_AUFTRAG)
    ws.Range(Z_KUNDE).Value = kopf(K_KUNDE)
    ws.Range(Z_STD_MM).Value = kopf(K_STD_MESSMITTEL)
    ws.Range(Z_STAND).Value = kopf(K_STAND)
    ws.Range(Z_PRUEFER).Value = kopf(K_PRUEFER)
    ws.Range(Z_BEGONNEN).Value = kopf(K_BEGONNEN)
    ws.Range(Z_STATUS).Value = kopf(K_STATUS)
    ws.Range(Z_ERGEBNIS).Value = kopf(K_ERGEBNIS)
    ws.Range(Z_ABGESCHLOSSEN).Value = kopf(K_ABGESCHLOSSEN)

    ' Spalte I (Bewertung) ist eine Formel und wird nicht überschrieben
    ReDim links(1 To n, 1 To M_IST)
    ReDim rechts(1 To n, 1 To MERKMAL_ANZ - M_BEWERTUNG)
    For z = 1 To n
        For sp = 1 To M_IST
            links(z, sp) = daten(z, sp)
        Next sp
        For sp = M_MESSMITTEL To MERKMAL_ANZ
            rechts(z, sp - M_BEWERTUNG) = daten(z, sp)
        Next sp
    Next z
    ws.Range(ws.Cells(MS_ERSTE, 1), ws.Cells(MS_ERSTE + n - 1, M_IST)).Value = links
    ws.Range(ws.Cells(MS_ERSTE, M_MESSMITTEL), ws.Cells(MS_ERSTE + n - 1, MERKMAL_ANZ)).Value = rechts

    ' Eingabefelder nur beim Bearbeiten freigeben
    Eingabebereich(n).Locked = Not bearbeiten
    If bearbeiten Then
        ws.Range(Z_MODUS).Value = "BEARBEITEN – Istwerte in Spalte H eintragen, Enter springt weiter"
        ws.Range(Z_MODUS).Font.Color = RGB(0, 97, 0)
        MessmittelListeAktualisieren
    Else
        ws.Range(Z_MODUS).Value = "NUR ANSEHEN"
        ws.Range(Z_MODUS).Font.Color = RGB(192, 0, 0)
    End If
    Schutz ws, True
    Application.ScreenUpdating = True
    ws.Calculate
End Sub

Private Function Eingabebereich(ByVal n As Long) As Range
    Dim ws As Worksheet, letzte As Long
    Set ws = MS()
    letzte = MS_ERSTE + n - 1
    Set Eingabebereich = Union(ws.Range(Z_AUFTRAG), ws.Range(Z_KUNDE), ws.Range(Z_STD_MM), _
        ws.Range(ws.Cells(MS_ERSTE, M_IST), ws.Cells(letzte, M_IST)), _
        ws.Range(ws.Cells(MS_ERSTE, M_MESSMITTEL), ws.Cells(letzte, M_BEGRUENDUNG)), _
        ws.Range(ws.Cells(MS_ERSTE, M_BEMERKUNG), ws.Cells(letzte, M_BEMERKUNG)))
End Function

Private Sub LiesBlatt(ByRef kopf() As Variant, ByRef daten As Variant, ByRef n As Long)
    Dim ws As Worksheet, z As Long
    Set ws = MS()
    ws.Calculate
    ReDim kopf(1 To KOPF_ANZ)
    kopf(K_PRODUKT) = ws.Range(Z_PRODUKT).Value
    kopf(K_ARTIKEL) = ws.Range(Z_ARTIKEL).Value
    kopf(K_BEZEICHNUNG) = ws.Range(Z_BEZEICHNUNG).Value
    kopf(K_AUFTRAG) = Trim(TextVon(ws.Range(Z_AUFTRAG).Value))
    kopf(K_KUNDE) = Trim(TextVon(ws.Range(Z_KUNDE).Value))
    kopf(K_STD_MESSMITTEL) = Trim(TextVon(ws.Range(Z_STD_MM).Value))
    kopf(K_STAND) = ws.Range(Z_STAND).Value
    kopf(K_PRUEFER) = ws.Range(Z_PRUEFER).Value
    kopf(K_BEGONNEN) = ws.Range(Z_BEGONNEN).Value
    kopf(K_STATUS) = ws.Range(Z_STATUS).Value
    kopf(K_ERGEBNIS) = ws.Range(Z_ERGEBNIS).Value
    kopf(K_ABGESCHLOSSEN) = ws.Range(Z_ABGESCHLOSSEN).Value
    If TextVon(kopf(K_ABGESCHLOSSEN)) = "" Then kopf(K_ABGESCHLOSSEN) = Empty
    n = 0
    For z = MS_ERSTE To MS_ERSTE + MS_MAX - 1
        If IstLeer(ws.Cells(z, M_NR).Value) And IstLeer(ws.Cells(z, M_MERKMAL).Value) Then Exit For
        n = n + 1
    Next z
    If n > 0 Then
        daten = ws.Range(ws.Cells(MS_ERSTE, 1), ws.Cells(MS_ERSTE + n - 1, MERKMAL_ANZ)).Value
    End If
End Sub

Private Sub BlattLeeren()
    Schutz MS(), False
    BlattLeerenOhneSchutz
    MS().Range(Z_MODUS).Value = "Kein Protokoll geöffnet – ""Messung starten / öffnen"" klicken"
    MS().Range(Z_MODUS).Font.Color = RGB(89, 89, 89)
    Schutz MS(), True
End Sub

Private Sub BlattLeerenOhneSchutz()
    Dim ws As Worksheet, letzte As Long
    Set ws = MS()
    letzte = MS_ERSTE + MS_MAX - 1
    ws.Range("C2:C7,G2:G7").ClearContents
    ws.Range(ws.Cells(MS_ERSTE, 1), ws.Cells(letzte, M_IST)).ClearContents
    ws.Range(ws.Cells(MS_ERSTE, M_MESSMITTEL), ws.Cells(letzte, MERKMAL_ANZ)).ClearContents
    ws.Range(ws.Cells(MS_ERSTE, 1), ws.Cells(letzte, MERKMAL_ANZ)).Locked = True
    ws.Range("C5:C7").Locked = True
End Sub

' Gültige Messmittel für die Auswahlliste in Spalte J
Private Sub MessmittelListeAktualisieren()
    Dim t As Variant, n As Long, z As Long, ws As Worksheet, k As Long
    Set ws = ThisWorkbook.Worksheets(BLATT_LISTEN)
    ws.Range("A2:A1000").ClearContents
    t = MessmittelTabelle(n)
    For z = 1 To n
        If t(z, 8) = "gültig" Or t(z, 8) = "bald fällig" Then
            k = k + 1
            If k <= 999 Then ws.Cells(k + 1, 1).Value = t(z, 1)
        End If
    Next z
End Sub

' ---------- Zustand ----------

Private Sub MerkeProtokoll(ByVal datei As String, ByVal bearbeiten As Boolean)
    Sys().Range(SYS_MS_DATEI).Value = datei
    If datei <> "" And DateiExistiert(datei) Then
        Sys().Range(SYS_MS_ZEIT).Value2 = CDbl(FileDateTime(datei))
    Else
        Sys().Range(SYS_MS_ZEIT).ClearContents
    End If
    Sys().Range(SYS_MS_BEARBEITEN).Value = IIf(bearbeiten, "1", "")
End Sub

Public Function Bearbeitbar() As Boolean
    Bearbeitbar = (TextVon(Sys().Range(SYS_MS_BEARBEITEN).Value) = "1")
End Function

' Vor dem Öffnen eines anderen Protokolls: aktuelles speichern?
Private Function AktuellesSchliessenOk() As Boolean
    Dim a As VbMsgBoxResult
    If Not Bearbeitbar() Then AktuellesSchliessenOk = True: Exit Function
    a = MsgBox("Protokoll " & TextVon(MS().Range(Z_PRODUKT).Value) & " ist noch geöffnet." & vbLf & _
        "Vorher zwischenspeichern?", vbYesNoCancel + vbQuestion)
    Select Case a
        Case vbYes
            AktuellesSchliessenOk = SpeichernIntern(False)
            If AktuellesSchliessenOk Then SperreFreigeben
        Case vbNo
            SperreFreigeben
            AktuellesSchliessenOk = True
        Case Else
            AktuellesSchliessenOk = False
    End Select
    If AktuellesSchliessenOk Then
        BlattLeeren
        MerkeProtokoll "", False
    End If
End Function
