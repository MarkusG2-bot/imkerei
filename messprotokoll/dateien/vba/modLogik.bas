Attribute VB_Name = "modLogik"
Option Explicit
' Reine Rechenlogik ohne Datei- und Blattzugriffe (wird automatisch getestet)

' Merkmalsarten
Public Const ART_MASS As String = "Maﬂ"
Public Const ART_PASSUNG As String = "Passung"
Public Const ART_FORMLAGE As String = "Form/Lage"
Public Const ART_OBERFLAECHE As String = "Oberfl‰che"
Public Const ART_ATTRIBUT As String = "Attribut"

' Berechnet die Grenzwerte eines Merkmals.
'   Maﬂ:        Nennmaﬂ + Abmaﬂe, oder Allgemeintoleranz ISO 2768 im Feld Passung (z. B. "2768-m")
'   Passung:    Nennmaﬂ + ISO-286-Passung (z. B. "H7")
'   Form/Lage:  Toleranz im Feld "Abmaﬂ oben" -> nur obere Grenze
'   Oberfl‰che: Hˆchstwert im Feld "Abmaﬂ oben", optional Mindestwert in "Abmaﬂ unten"
'   Attribut:   keine Grenzwerte (Pr¸fung i.O./n.i.O.)
' ogw / ugw bleiben Empty, wenn es keine Grenze gibt.
Public Function Grenzwerte(ByVal art As Variant, ByVal nenn As Variant, ByVal passung As Variant, _
        ByVal oben As Variant, ByVal unten As Variant, _
        ByRef ogw As Variant, ByRef ugw As Variant, ByRef fehler As String) As Boolean
    Dim a As String, p As String, n As Double, o As Double, u As Double, t As Double
    Dim hatN As Boolean, hatO As Boolean, hatU As Boolean

    ogw = Empty
    ugw = Empty
    fehler = ""
    a = ArtNormal(art)
    p = Trim(TextVon(passung))
    hatN = IstZahl(nenn): If hatN Then n = CDbl(nenn)
    hatO = IstZahl(oben): If hatO Then o = CDbl(oben)
    hatU = IstZahl(unten): If hatU Then u = CDbl(unten)

    If Not IstLeer(nenn) And Not hatN Then fehler = "Nennmaﬂ ist keine Zahl": Exit Function
    If Not IstLeer(oben) And Not hatO Then fehler = "Abmaﬂ oben ist keine Zahl": Exit Function
    If Not IstLeer(unten) And Not hatU Then fehler = "Abmaﬂ unten ist keine Zahl": Exit Function

    Select Case a
        Case ""
            fehler = "Art fehlt oder ist unbekannt"
            Exit Function

        Case ART_MASS
            If Not hatN Then fehler = "Nennmaﬂ fehlt": Exit Function
            If p <> "" Then
                If hatO Or hatU Then fehler = "Entweder Abmaﬂe oder Allgemeintoleranz angeben": Exit Function
                If Not Allgemeintoleranz(n, p, t, fehler) Then Exit Function
                ogw = Round(n + t, 6)
                ugw = Round(n - t, 6)
            Else
                If Not hatO And Not hatU Then fehler = "Abmaﬂe oder Allgemeintoleranz (z. B. 2768-m) fehlen": Exit Function
                If hatO Then ogw = Round(n + o, 6)
                If hatU Then ugw = Round(n + u, 6)
            End If

        Case ART_PASSUNG
            If Not hatN Then fehler = "Nennmaﬂ fehlt": Exit Function
            If p = "" Then fehler = "Passung fehlt (z. B. H7)": Exit Function
            If hatO Or hatU Then fehler = "Bei Passung keine Abmaﬂe eintragen": Exit Function
            If Not ISO_Abmasse(n, p, o, u, fehler) Then Exit Function
            ogw = Round(n + o, 6)
            ugw = Round(n + u, 6)

        Case ART_FORMLAGE
            If Not hatO Then fehler = "Toleranz fehlt (Feld Abmaﬂ oben)": Exit Function
            If o <= 0 Then fehler = "Toleranz muss grˆﬂer 0 sein": Exit Function
            ogw = o

        Case ART_OBERFLAECHE
            If Not hatO Then fehler = "Hˆchstwert fehlt (Feld Abmaﬂ oben)": Exit Function
            If o <= 0 Then fehler = "Hˆchstwert muss grˆﬂer 0 sein": Exit Function
            ogw = o
            If hatU Then ugw = u

        Case ART_ATTRIBUT
            ' keine Grenzwerte
    End Select

    If Not IsEmpty(ogw) And Not IsEmpty(ugw) Then
        If ogw <= ugw Then fehler = "Obere Grenze muss grˆﬂer als untere sein": Exit Function
    End If
    Grenzwerte = True
End Function

' Allgemeintoleranz ISO 2768-1 f¸r L‰ngenmaﬂe, Klassen f, m, c, v. Liefert ±Toleranz in mm.
Public Function Allgemeintoleranz(ByVal nenn As Double, ByVal angabe As String, _
        ByRef tol As Double, ByRef fehler As String) As Boolean
    Dim k As String, bis As Variant, werte As Variant, i As Integer
    ' erlaubt: "m", "2768-m", "ISO 2768-m", "ISO 2768-1-m"
    k = LCase(Replace(Replace(Trim(angabe), " ", ""), "-", ""))
    If Left(k, 3) = "iso" Then k = Mid(k, 4)
    If Left(k, 4) = "2768" Then k = Mid(k, 5)
    If Len(k) = 2 And Left(k, 1) = "1" Then k = Mid(k, 2)
    If Len(k) <> 1 Then
        fehler = "Toleranz nicht lesbar (Beispiel: 2768-m; f¸r H7 usw. Art ""Passung"" w‰hlen)"
        Exit Function
    End If
    bis = Array(3, 6, 30, 120, 400, 1000, 2000, 4000)
    ' Werte in µm, -1 = nicht festgelegt
    Select Case k
        Case "f": werte = Array(50, 50, 100, 150, 200, 300, 500, -1)
        Case "m": werte = Array(100, 100, 200, 300, 500, 800, 1200, 2000)
        Case "c": werte = Array(200, 300, 500, 800, 1200, 2000, 3000, 4000)
        Case "v": werte = Array(-1, 500, 1000, 1500, 2500, 4000, 6000, 8000)
        Case Else
            fehler = "Toleranz nicht lesbar (Beispiel: 2768-m; f¸r H7 usw. Art ""Passung"" w‰hlen)"
            Exit Function
    End Select
    If nenn < 0.5 Then fehler = "ISO 2768 gilt erst ab 0,5 mm": Exit Function
    For i = 0 To UBound(bis)
        If nenn <= bis(i) Then
            If werte(i) < 0 Then fehler = "ISO 2768-" & k & " f¸r dieses Maﬂ nicht festgelegt": Exit Function
            tol = werte(i) / 1000
            Allgemeintoleranz = True
            Exit Function
        End If
    Next i
    fehler = "ISO 2768 gilt nur bis 4000 mm"
End Function

' Bewertung eines Messwerts: "i.O." oder "n.i.O." (Grenzen gehˆren zur Toleranz)
Public Function Bewertung(ByVal ist As Variant, ByVal ogw As Variant, ByVal ugw As Variant) As String
    Const EPS As Double = 0.0000001
    If Not IstZahl(ist) Then Exit Function
    Bewertung = "i.O."
    If IstZahl(ogw) Then
        If CDbl(ist) > CDbl(ogw) + EPS Then Bewertung = "n.i.O."
    End If
    If IstZahl(ugw) Then
        If CDbl(ist) < CDbl(ugw) - EPS Then Bewertung = "n.i.O."
    End If
End Function

' Art vereinheitlichen; "" wenn unbekannt
Public Function ArtNormal(ByVal art As Variant) As String
    Select Case LCase(Trim(TextVon(art)))
        Case "maﬂ", "mass", "mas": ArtNormal = ART_MASS
        Case "passung": ArtNormal = ART_PASSUNG
        Case "form/lage", "form", "lage": ArtNormal = ART_FORMLAGE
        Case "oberfl‰che", "oberflaeche": ArtNormal = ART_OBERFLAECHE
        Case "attribut": ArtNormal = ART_ATTRIBUT
        Case Else: ArtNormal = ""
    End Select
End Function

' Zwei Zellwerte vergleichen (Zahlen numerisch, Text ohne Leerzeichen am Rand)
Public Function WerteGleich(ByVal a As Variant, ByVal b As Variant) As Boolean
    If IstLeer(a) And IstLeer(b) Then WerteGleich = True: Exit Function
    If IstZahl(a) And IstZahl(b) Then
        WerteGleich = (Abs(CDbl(a) - CDbl(b)) < 0.0000001)
    Else
        WerteGleich = (Trim(TextVon(a)) = Trim(TextVon(b)))
    End If
End Function

' Text f¸r Datei- und Ordnernamen tauglich machen (z. B. "J1567/1" -> "J1567_1")
Public Function SichererName(ByVal s As String) As String
    Dim i As Long, z As String, r As String
    For i = 1 To Len(s)
        z = Mid(s, i, 1)
        If InStr("\/:*?""<>|", z) > 0 Or Asc(z) < 32 Then z = "_"
        r = r & z
    Next i
    r = Trim(r)
    Do While Len(r) > 0 And Right(r, 1) = "."
        r = Left(r, Len(r) - 1)
    Loop
    SichererName = r
End Function

Public Function IstLeer(ByVal v As Variant) As Boolean
    If IsEmpty(v) Or IsNull(v) Then
        IstLeer = True
    ElseIf IsError(v) Then
        IstLeer = False
    Else
        IstLeer = (Trim(CStr(v)) = "")
    End If
End Function

Public Function IstZahl(ByVal v As Variant) As Boolean
    If IsEmpty(v) Or IsNull(v) Or IsError(v) Then Exit Function
    Select Case VarType(v)
        Case vbInteger, vbLong, vbSingle, vbDouble, vbCurrency, vbDecimal, vbByte
            IstZahl = True
        Case vbString
            If Trim(v) <> "" Then IstZahl = IsNumeric(v)
    End Select
End Function

Public Function TextVon(ByVal v As Variant) As String
    If IsEmpty(v) Or IsNull(v) Or IsError(v) Then Exit Function
    TextVon = CStr(v)
End Function
