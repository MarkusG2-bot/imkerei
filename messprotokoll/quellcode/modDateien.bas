Attribute VB_Name = "modDateien"
Option Explicit
' Datei- und Ordnerhilfen, Sperrdateien und Protokoll-Dateien (CSV).
' Ohne Excel-Objekte, damit alles automatisch getestet werden kann.

' Kopfspalten einer Protokoll-Zeile (1-15), danach folgen die 18 Merkmalsspalten
Public Const K_PRODUKT As Long = 1
Public Const K_ARTIKEL As Long = 2
Public Const K_BEZEICHNUNG As Long = 3
Public Const K_AUFTRAG As Long = 4
Public Const K_KUNDE As Long = 5
Public Const K_STAND As Long = 6
Public Const K_STATUS As Long = 7
Public Const K_ERGEBNIS As Long = 8
Public Const K_PRUEFER As Long = 9
Public Const K_BEGONNEN As Long = 10
Public Const K_ABGESCHLOSSEN As Long = 11
Public Const K_GEAENDERT_VON As Long = 12
Public Const K_GEAENDERT_AM As Long = 13
Public Const K_STD_MESSMITTEL As Long = 14
Public Const K_VERSION As Long = 15
Public Const KOPF_ANZ As Long = 15

' Merkmalsspalten (gleiche Reihenfolge wie im Blatt "Messung", Spalten A bis R)
Public Const M_NR As Long = 1
Public Const M_MERKMAL As Long = 2
Public Const M_ART As Long = 3
Public Const M_NENN As Long = 4
Public Const M_PASSUNG As Long = 5
Public Const M_OGW As Long = 6
Public Const M_UGW As Long = 7
Public Const M_IST As Long = 8
Public Const M_BEWERTUNG As Long = 9
Public Const M_MESSMITTEL As Long = 10
Public Const M_ENTSCHEIDUNG As Long = 11
Public Const M_BEGRUENDUNG As Long = 12
Public Const M_ENTSCHIEDEN_VON As Long = 13
Public Const M_ENTSCHIEDEN_AM As Long = 14
Public Const M_VORWERT As Long = 15
Public Const M_BEMERKUNG As Long = 16
Public Const M_KRITISCH As Long = 17
Public Const M_MM_TYP As Long = 18
Public Const MERKMAL_ANZ As Long = 18

' Protokoll-Status
Public Const ST_IN_ARBEIT As String = "In Arbeit"
Public Const ST_NACHARBEIT As String = "Nacharbeit"
Public Const ST_FREIGABE As String = "Wartet auf Freigabe"
Public Const ST_ABGESCHLOSSEN As String = "Abgeschlossen"

' Entscheidungen bei n.i.O.
Public Const E_NACHARBEIT As String = "Nacharbeit"
Public Const E_SONDERFREIGABE As String = "Sonderfreigabe"
Public Const E_AUSSCHUSS As String = "Ausschuss"

' Ergebnisse
Public Const ERG_IO As String = "i.O."
Public Const ERG_SONDER As String = "i.O. mit Sonderfreigabe"
Public Const ERG_AUSSCHUSS As String = "Ausschuss"

' ---------- Ordner und Dateien ----------

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

Public Sub Schreibschutz(ByVal p As String, ByVal schuetzen As Boolean)
    If Not DateiExistiert(p) Then Exit Sub
    If schuetzen Then
        SetAttr p, vbReadOnly
    Else
        SetAttr p, vbNormal
    End If
End Sub

Public Sub DateiLoeschen(ByVal p As String)
    If Not DateiExistiert(p) Then Exit Sub
    SetAttr p, vbNormal
    Kill p
End Sub

' Legt einen Ordner samt fehlender Elternordner an (auch \\Server\Freigabe\...)
Public Sub OrdnerAnlegen(ByVal p As String)
    Dim teile() As String, i As Long, akt As String, start As Long
    If OrdnerExistiert(p) Then Exit Sub
    teile = Split(p, "\")
    If Left(p, 2) = "\\" Then
        akt = "\\" & teile(2) & "\" & teile(3)
        start = 4
    ElseIf Left(p, 1) = "/" Then
        ' nur für Tests unter Linux
        teile = Split(p, "/")
        akt = ""
        For i = 1 To UBound(teile)
            If teile(i) <> "" Then
                akt = akt & "/" & teile(i)
                If Not OrdnerExistiert(akt) Then MkDir akt
            End If
        Next i
        Exit Sub
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

Public Sub OrdnerFuerDatei(ByVal datei As String)
    Dim p As Long
    p = InStrRev(Replace(datei, "/", "\"), "\")
    If p > 1 Then OrdnerAnlegen Left(datei, p - 1)
End Sub

' Erste Zeile einer Textdatei
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
    OrdnerFuerDatei p
    If DateiExistiert(p) Then SetAttr p, vbNormal
    n = FreeFile
    Open p For Output As #n
    Print #n, inhalt
    Close #n
End Sub

' Dateinamen in einem Ordner (Muster z. B. "*.csv"), getrennt durch vbLf
Public Function DateiListe(ByVal ordner As String, ByVal muster As String) As String
    Dim f As String, r As String, trenn As String
    If Not OrdnerExistiert(ordner) Then Exit Function
    trenn = "\"
    If InStr(ordner, "/") > 0 Then trenn = "/"
    If Right(ordner, 1) <> trenn Then ordner = ordner & trenn
    f = Dir(ordner & muster, vbNormal Or vbReadOnly)
    Do While f <> ""
        If Left(f, 1) <> "~" Then r = r & vbLf & f
        f = Dir()
    Loop
    If r <> "" Then DateiListe = Mid(r, 2)
End Function

' Unterordner eines Ordners, getrennt durch vbLf
Public Function OrdnerListe(ByVal ordner As String) As String
    Dim f As String, r As String, trenn As String
    If Not OrdnerExistiert(ordner) Then Exit Function
    trenn = "\"
    If InStr(ordner, "/") > 0 Then trenn = "/"
    If Right(ordner, 1) <> trenn Then ordner = ordner & trenn
    f = Dir(ordner & "*", vbDirectory)
    Do While f <> ""
        If f <> "." And f <> ".." Then
            If OrdnerExistiert(ordner & f) Then r = r & vbLf & f
        End If
        f = Dir()
    Loop
    If r <> "" Then OrdnerListe = Mid(r, 2)
End Function

' ---------- Sperren (wer bearbeitet gerade ein Protokoll) ----------

Public Function SperreLesen(ByVal p As String, ByRef wer As String, ByRef seit As Date) As Boolean
    Dim t As String, teile() As String
    t = TextDateiLesen(p)
    If t = "" Then Exit Function
    teile = Split(t, ";")
    wer = teile(0)
    If UBound(teile) >= 1 Then
        If Not IsEmpty(DatumLesen(teile(1))) Then seit = DatumLesen(teile(1))
    End If
    SperreLesen = True
End Function

Public Sub SperreSetzen(ByVal p As String, ByVal wer As String)
    TextDateiSchreiben p, wer & ";" & DatumText(Now)
End Sub

' ---------- Werte für CSV ----------

Public Function DatumText(ByVal d As Variant) As String
    If IsEmpty(d) Or IsNull(d) Then Exit Function
    If VarType(d) = vbString Then
        If Trim(d) = "" Then Exit Function
        If Not IsDate(d) Then DatumText = d: Exit Function
        d = CDate(d)
    End If
    DatumText = Year(d) & "-" & Right("0" & Month(d), 2) & "-" & Right("0" & Day(d), 2) & " " & _
        Right("0" & Hour(d), 2) & ":" & Right("0" & Minute(d), 2) & ":" & Right("0" & Second(d), 2)
End Function

' "yyyy-mm-dd hh:nn:ss" -> Datum (Empty wenn leer oder ungültig)
Public Function DatumLesen(ByVal s As String) As Variant
    s = Trim(s)
    DatumLesen = Empty
    If Len(s) < 10 Then Exit Function
    If Mid(s, 5, 1) <> "-" Or Mid(s, 8, 1) <> "-" Then Exit Function
    DatumLesen = DateSerial(Val(Left(s, 4)), Val(Mid(s, 6, 2)), Val(Mid(s, 9, 2)))
    If Len(s) >= 19 Then
        DatumLesen = DatumLesen + TimeSerial(Val(Mid(s, 12, 2)), Val(Mid(s, 15, 2)), Val(Mid(s, 18, 2)))
    End If
End Function

' Zahl immer mit Punkt (unabhängig von der Ländereinstellung), sonst Text ohne Trennzeichen
Public Function CsvFeld(ByVal v As Variant) As String
    Dim s As String
    If IsEmpty(v) Or IsNull(v) Or IsError(v) Then Exit Function
    Select Case VarType(v)
        Case vbDate
            CsvFeld = DatumText(v)
        Case vbInteger, vbLong, vbSingle, vbDouble, vbCurrency, vbDecimal, vbByte
            s = Trim(Str(CDbl(v)))
            If Left(s, 1) = "." Then s = "0" & s
            If Left(s, 2) = "-." Then s = "-0" & Mid(s, 2)
            CsvFeld = s
        Case vbBoolean
            If v Then CsvFeld = "ja" Else CsvFeld = "nein"
        Case Else
            s = CStr(v)
            s = Replace(s, ";", ",")
            s = Replace(s, vbCr, " ")
            s = Replace(s, vbLf, " ")
            CsvFeld = s
    End Select
End Function

' Sieht der Text wie eine CSV-Zahl aus (Ziffern, Punkt, Vorzeichen, Exponent)?
Public Function IstCsvZahl(ByVal s As String) As Boolean
    Dim i As Long, c As String, ziffer As Boolean
    s = Trim(s)
    If s = "" Then Exit Function
    For i = 1 To Len(s)
        c = Mid(s, i, 1)
        If c >= "0" And c <= "9" Then
            ziffer = True
        ElseIf InStr(".-+E", UCase(c)) = 0 Then
            Exit Function
        End If
    Next i
    IstCsvZahl = ziffer
End Function

Private Function CsvZahlOderText(ByVal s As String) As Variant
    If Trim(s) = "" Then
        CsvZahlOderText = Empty
    ElseIf IstCsvZahl(s) Then
        CsvZahlOderText = Val(s)
    Else
        CsvZahlOderText = s
    End If
End Function

Private Function CsvText(ByVal s As String) As Variant
    If s = "" Then CsvText = Empty Else CsvText = s
End Function

' ---------- Protokoll-Dateien ----------

Public Function KopfNamen() As Variant
    KopfNamen = Array("", "Produktnummer", "Artikelnummer", "Bezeichnung", "Auftragsnummer", "Kunde", _
        "Prüfplan-Stand", "Status", "Ergebnis", "Prüfer", "Begonnen", "Abgeschlossen", _
        "Geändert von", "Geändert am", "Standard-Messmittel", "Programmversion")
End Function

Public Function MerkmalNamen() As Variant
    MerkmalNamen = Array("", "Nr", "Merkmal", "Art", "Nennmaß", "Passung / Toleranz", "OGW", "UGW", _
        "Istwert", "Bewertung", "Messmittel", "Entscheidung", "Begründung", "Entschieden von", _
        "Entschieden am", "Vorwert", "Bemerkung", "Kritisch", "Messmittel-Typ")
End Function

' Schreibt ein Protokoll: eine Zeile je Merkmal, Kopfdaten in jeder Zeile wiederholt.
' kopf: Feld 1..KOPF_ANZ, daten: Feld (1..n, 1..MERKMAL_ANZ)
Public Sub SchreibeProtokoll(ByVal datei As String, ByVal kopf As Variant, ByVal daten As Variant, ByVal n As Long)
    Dim f As Integer, z As Long, sp As Long, kopfText As String, zeile As String, tmp As String
    Dim kn As Variant, mn As Variant, p As Long

    kn = KopfNamen()
    mn = MerkmalNamen()
    For sp = 1 To KOPF_ANZ
        kopfText = kopfText & CsvFeld(kopf(sp)) & ";"
    Next sp

    OrdnerFuerDatei datei
    p = InStrRev(Replace(datei, "/", "\"), "\")
    tmp = Left(datei, p) & "~" & Mid(datei, p + 1) & ".tmp"
    If DateiExistiert(tmp) Then DateiLoeschen tmp

    f = FreeFile
    Open tmp For Output As #f
    zeile = ""
    For sp = 1 To KOPF_ANZ
        zeile = zeile & kn(sp) & ";"
    Next sp
    For sp = 1 To MERKMAL_ANZ
        zeile = zeile & mn(sp)
        If sp < MERKMAL_ANZ Then zeile = zeile & ";"
    Next sp
    Print #f, zeile
    For z = 1 To n
        zeile = kopfText
        For sp = 1 To MERKMAL_ANZ
            zeile = zeile & CsvFeld(daten(z, sp))
            If sp < MERKMAL_ANZ Then zeile = zeile & ";"
        Next sp
        Print #f, zeile
    Next z
    Close #f

    DateiLoeschen datei
    Name tmp As datei
End Sub

' Liest ein Protokoll. kopf: Feld 1..KOPF_ANZ, daten: Feld (1..n, 1..MERKMAL_ANZ)
Public Function LiesProtokoll(ByVal datei As String, ByRef kopf As Variant, ByRef daten As Variant, ByRef n As Long) As Boolean
    Dim f As Integer, inhalt As String, zeilen() As String, teile() As String
    Dim i As Long, z As Long, sp As Long, k() As Variant, d() As Variant, anz As Long

    n = 0
    If Not DateiExistiert(datei) Then Exit Function
    f = FreeFile
    Open datei For Binary Access Read As #f
    inhalt = Space$(LOF(f))
    Get #f, , inhalt
    Close #f
    inhalt = Replace(inhalt, vbCrLf, vbLf)
    inhalt = Replace(inhalt, vbCr, vbLf)
    zeilen = Split(inhalt, vbLf)

    For i = 1 To UBound(zeilen)
        If Trim(zeilen(i)) <> "" Then anz = anz + 1
    Next i
    If anz = 0 Then Exit Function

    ReDim k(1 To KOPF_ANZ)
    ReDim d(1 To anz, 1 To MERKMAL_ANZ)
    z = 0
    For i = 1 To UBound(zeilen)
        If Trim(zeilen(i)) <> "" Then
            teile = Split(zeilen(i), ";")
            ReDim Preserve teile(0 To KOPF_ANZ + MERKMAL_ANZ - 1)
            z = z + 1
            If z = 1 Then
                For sp = 1 To KOPF_ANZ
                    Select Case sp
                        Case K_BEGONNEN, K_ABGESCHLOSSEN, K_GEAENDERT_AM
                            k(sp) = DatumLesen(teile(sp - 1))
                        Case Else
                            k(sp) = CsvText(teile(sp - 1))
                    End Select
                Next sp
            End If
            For sp = 1 To MERKMAL_ANZ
                Select Case sp
                    Case M_NENN, M_OGW, M_UGW, M_IST, M_VORWERT
                        d(z, sp) = CsvZahlOderText(teile(KOPF_ANZ + sp - 1))
                    Case M_ENTSCHIEDEN_AM
                        d(z, sp) = DatumLesen(teile(KOPF_ANZ + sp - 1))
                    Case M_NR
                        d(z, sp) = CsvText(teile(KOPF_ANZ + sp - 1))
                    Case Else
                        d(z, sp) = CsvText(teile(KOPF_ANZ + sp - 1))
                End Select
            Next sp
        End If
    Next i
    kopf = k
    daten = d
    n = anz
    LiesProtokoll = True
End Function

' ---------- Ablageorte (relativ zum Basisordner) ----------

Public Function ProtokollRelPfad(ByVal status As String, ByVal produkt As String, _
        ByVal artikel As String, ByVal abschluss As Variant) As String
    Dim jahr As Long
    Select Case status
        Case ST_ABGESCHLOSSEN
            If IsDate(abschluss) Then jahr = Year(abschluss) Else jahr = Year(Date)
            ProtokollRelPfad = "Daten\Archiv\" & jahr & "\" & SichererName(artikel) & "\" & SichererName(produkt) & ".csv"
        Case ST_FREIGABE
            ProtokollRelPfad = "Daten\Freigabe\" & SichererName(produkt) & ".csv"
        Case Else
            ProtokollRelPfad = "Daten\Entwurf\" & SichererName(produkt) & ".csv"
    End Select
End Function

Public Function PdfRelPfad(ByVal produkt As String, ByVal artikel As String, ByVal abschluss As Variant) As String
    Dim jahr As Long
    If IsDate(abschluss) Then jahr = Year(abschluss) Else jahr = Year(Date)
    PdfRelPfad = "PDF\" & jahr & "\" & SichererName(artikel) & "\" & SichererName(produkt) & ".pdf"
End Function

Public Function IndexRelPfad(ByVal produkt As String) As String
    IndexRelPfad = "System\Index\" & SichererName(produkt) & ".txt"
End Function

Public Function SperreRelPfad(ByVal produkt As String) As String
    SperreRelPfad = "System\Sperren\" & SichererName(produkt) & ".lock"
End Function
