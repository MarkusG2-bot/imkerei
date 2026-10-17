Attribute VB_Name = "modISO286"
Option Explicit
' Passungsberechnung nach ISO 286-1 (Nennmaß über 0 bis 500 mm)
' Unterstützt: Bohrungen D E F G H JS K M N P R S, Wellen d e f g h js k m n p r s
' Toleranzgrade IT1 bis IT16. Daten stehen in modISO286Daten.
' Intern wird in Zehntel-Mikrometer gerechnet, damit keine Rundungsfehler entstehen.

' Liefert oberes und unteres Abmaß in mm.
' Rückgabe False, wenn die Passung nicht berechnet werden kann (Grund in fehler).
Public Function ISO_Abmasse(ByVal nennmass As Double, ByVal passung As String, _
        ByRef oben As Double, ByRef unten As Double, ByRef fehler As String) As Boolean
    Dim p As String, buchst As String, zahl As String
    Dim i As Long, c As Long, grad As Integer
    Dim istBohrung As Boolean
    Dim h As Integer, f As Integer
    Dim itw As Double, es As Double, ei As Double

    fehler = ""
    p = Replace(Trim(passung), " ", "")
    If nennmass <= 0 Or nennmass > 500 Then
        fehler = "Nennmaß für ISO-Passung muss über 0 und bis 500 mm sein"
        Exit Function
    End If

    ' Buchstaben und Zahl trennen, z. B. "H7" -> "H" und "7"
    i = 1
    Do While i <= Len(p)
        c = Asc(Mid(p, i, 1))
        If (c >= 65 And c <= 90) Or (c >= 97 And c <= 122) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop
    buchst = Left(p, i - 1)
    zahl = Mid(p, i)
    If buchst = "" Or zahl = "" Or Len(zahl) > 2 Then
        fehler = "Passung nicht lesbar (Beispiel: H7, g6, JS7)"
        Exit Function
    End If
    For i = 1 To Len(zahl)
        c = Asc(Mid(zahl, i, 1))
        If c < 48 Or c > 57 Then
            fehler = "Passung nicht lesbar (Beispiel: H7, g6, JS7)"
            Exit Function
        End If
    Next i
    grad = CInt(zahl)
    If grad < 1 Or grad > 16 Then
        fehler = "Toleranzgrad muss zwischen 1 und 16 liegen"
        Exit Function
    End If

    ' Großbuchstabe = Bohrung, Kleinbuchstabe = Welle
    istBohrung = (Asc(Left(buchst, 1)) <= 90)
    If istBohrung Then buchst = UCase(buchst) Else buchst = LCase(buchst)

    h = BereichIndex(nennmass, ISO_HauptBis())
    f = BereichIndex(nennmass, ISO_FeinBis())
    itw = IT10(grad, h)

    If istBohrung Then
        If Not BohrungAbmasse(buchst, grad, h, f, itw, es, ei) Then
            fehler = "Bohrungs-Toleranzfeld " & buchst & " wird nicht unterstützt"
            Exit Function
        End If
    Else
        If Not WelleAbmasse(buchst, grad, h, f, itw, es, ei) Then
            fehler = "Wellen-Toleranzfeld " & buchst & " wird nicht unterstützt"
            Exit Function
        End If
    End If

    oben = Round(es / 10000, 5)
    unten = Round(ei / 10000, 5)
    ISO_Abmasse = True
End Function

' Grundtoleranz in Zehntel-µm
Public Function IT10(ByVal grad As Integer, ByVal h As Integer) As Double
    Dim a As Variant
    a = ISO_IT10(grad)
    IT10 = a(h)
End Function

Private Function BereichIndex(ByVal d As Double, ByVal grenzen As Variant) As Integer
    Dim i As Integer
    For i = LBound(grenzen) To UBound(grenzen)
        If d <= grenzen(i) Then
            BereichIndex = i
            Exit Function
        End If
    Next i
    BereichIndex = -1
End Function

' Halbe Toleranz für js / JS (bei IT7 bis IT11 mit ungeradem µm-Wert abgerundet)
Private Function HalbeToleranz(ByVal grad As Integer, ByVal itw As Double) As Double
    Dim um As Double
    um = itw / 10
    If grad >= 7 And grad <= 11 And um = Int(um) And (Int(um) Mod 2 = 1) Then
        HalbeToleranz = (um - 1) / 2 * 10
    Else
        HalbeToleranz = itw / 2
    End If
End Function

Private Function WelleAbmasse(ByVal b As String, ByVal grad As Integer, ByVal h As Integer, _
        ByVal f As Integer, ByVal itw As Double, ByRef es As Double, ByRef ei As Double) As Boolean
    Dim a As Variant
    Select Case b
        Case "d", "e", "f", "g", "h"
            a = ISO_WelleES(b)
            es = a(h) * 10
            ei = es - itw
        Case "js"
            es = HalbeToleranz(grad, itw)
            ei = -es
        Case "k"
            a = ISO_WelleEI("k")
            If grad >= 4 And grad <= 7 Then ei = a(h) * 10 Else ei = 0
            es = ei + itw
        Case "m", "n", "p"
            a = ISO_WelleEI(b)
            ei = a(h) * 10
            es = ei + itw
        Case "r", "s"
            a = ISO_WelleEIFein(b)
            ei = a(f) * 10
            es = ei + itw
        Case Else
            Exit Function
    End Select
    WelleAbmasse = True
End Function

Private Function BohrungAbmasse(ByVal b As String, ByVal grad As Integer, ByVal h As Integer, _
        ByVal f As Integer, ByVal itw As Double, ByRef es As Double, ByRef ei As Double) As Boolean
    Dim a As Variant, basis As Double, delta As Double, grenze As Integer
    Select Case b
        Case "D", "E", "F", "G", "H"
            a = ISO_WelleES(LCase(b))
            ei = -a(h) * 10
            es = ei + itw
        Case "JS"
            es = HalbeToleranz(grad, itw)
            ei = -es
        Case "K", "M", "N", "P", "R", "S"
            ' Grundabmaß der gleichnamigen Welle
            Select Case b
                Case "K", "M", "N", "P"
                    a = ISO_WelleEI(LCase(b))
                    basis = a(h) * 10
                Case Else
                    a = ISO_WelleEIFein(LCase(b))
                    basis = a(f) * 10
            End Select
            ' Delta = IT(n) - IT(n-1), gilt für IT3 bis IT8 und Nennmaß über 3 mm
            delta = 0
            If h > 0 And grad >= 3 And grad <= 8 Then delta = IT10(grad, h) - IT10(grad - 1, h)
            If b = "K" Or b = "M" Or b = "N" Then grenze = 8 Else grenze = 7
            If grad <= grenze Then
                es = -basis + delta
            Else
                Select Case b
                    Case "K"
                        es = 0
                    Case "N"
                        If h = 0 Then es = -basis Else es = 0
                    Case Else
                        es = -basis
                End Select
            End If
            ei = es - itw
        Case Else
            Exit Function
    End Select
    BohrungAbmasse = True
End Function
