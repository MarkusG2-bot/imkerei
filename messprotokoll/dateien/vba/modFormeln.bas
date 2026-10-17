Attribute VB_Name = "modFormeln"
Option Explicit
' Tabellenfunktionen für Excel-Zellen, z. B. =PM_OGW(C8;D8;E8;F8;G8)

' Obere Grenze eines Merkmals ("" wenn keine oder Eingabe fehlerhaft)
Public Function PM_OGW(art As Variant, nenn As Variant, passung As Variant, oben As Variant, unten As Variant) As Variant
    Dim o As Variant, u As Variant, f As String
    PM_OGW = ""
    If IstLeer(W(art)) Then Exit Function
    If Grenzwerte(W(art), W(nenn), W(passung), W(oben), W(unten), o, u, f) Then
        If Not IsEmpty(o) Then PM_OGW = o
    End If
End Function

' Untere Grenze eines Merkmals ("" wenn keine oder Eingabe fehlerhaft)
Public Function PM_UGW(art As Variant, nenn As Variant, passung As Variant, oben As Variant, unten As Variant) As Variant
    Dim o As Variant, u As Variant, f As String
    PM_UGW = ""
    If IstLeer(W(art)) Then Exit Function
    If Grenzwerte(W(art), W(nenn), W(passung), W(oben), W(unten), o, u, f) Then
        If Not IsEmpty(u) Then PM_UGW = u
    End If
End Function

' Prüfhinweis für eine Zeile ("" wenn alles in Ordnung)
Public Function PM_PRUEFUNG(nr As Variant, merkmal As Variant, art As Variant, nenn As Variant, _
        passung As Variant, oben As Variant, unten As Variant) As String
    Dim o As Variant, u As Variant, f As String
    If IstLeer(W(nr)) And IstLeer(W(merkmal)) And IstLeer(W(art)) And IstLeer(W(nenn)) And _
            IstLeer(W(passung)) And IstLeer(W(oben)) And IstLeer(W(unten)) Then Exit Function
    If IstLeer(W(nr)) Then PM_PRUEFUNG = "Nr fehlt": Exit Function
    If IstLeer(W(merkmal)) Then PM_PRUEFUNG = "Bezeichnung fehlt": Exit Function
    If Not Grenzwerte(W(art), W(nenn), W(passung), W(oben), W(unten), o, u, f) Then PM_PRUEFUNG = f
End Function

' Abmaß einer ISO-Passung in mm; teil = "O" (oben) oder "U" (unten)
Public Function PM_ABMASS(nenn As Variant, passung As Variant, teil As Variant) As Variant
    Dim o As Double, u As Double, f As String
    If Not IstZahl(W(nenn)) Or IstLeer(W(passung)) Then PM_ABMASS = "": Exit Function
    If ISO_Abmasse(CDbl(W(nenn)), TextVon(W(passung)), o, u, f) Then
        If UCase(Left(TextVon(W(teil)), 1)) = "U" Then PM_ABMASS = u Else PM_ABMASS = o
    Else
        PM_ABMASS = f
    End If
End Function

' Zellbezug in Wert umwandeln
Private Function W(ByVal x As Variant) As Variant
    If IsObject(x) Then
        W = x.Cells(1, 1).Value
    Else
        W = x
    End If
End Function
