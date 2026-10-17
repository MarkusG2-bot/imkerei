Attribute VB_Name = "modFormeln"
Option Explicit
' Tabellenfunktionen für Excel-Zellen, z. B. =PM_OGW(C8;D8;E8;F8;G8)

' Obere Grenze eines Merkmals ("" wenn keine oder Eingabe fehlerhaft)
Public Function PM_OGW(art As Variant, nenn As Variant, passung As Variant, oben As Variant, unten As Variant) As Variant
    Dim o As Variant, u As Variant, f As String
    PM_OGW = ""
    If IstLeer(ZellWert(art)) Then Exit Function
    If Grenzwerte(ZellWert(art), ZellWert(nenn), ZellWert(passung), ZellWert(oben), ZellWert(unten), o, u, f) Then
        If Not IsEmpty(o) Then PM_OGW = o
    End If
End Function

' Untere Grenze eines Merkmals ("" wenn keine oder Eingabe fehlerhaft)
Public Function PM_UGW(art As Variant, nenn As Variant, passung As Variant, oben As Variant, unten As Variant) As Variant
    Dim o As Variant, u As Variant, f As String
    PM_UGW = ""
    If IstLeer(ZellWert(art)) Then Exit Function
    If Grenzwerte(ZellWert(art), ZellWert(nenn), ZellWert(passung), ZellWert(oben), ZellWert(unten), o, u, f) Then
        If Not IsEmpty(u) Then PM_UGW = u
    End If
End Function

' Prüfhinweis für eine Zeile ("" wenn alles in Ordnung)
Public Function PM_PRUEFUNG(nr As Variant, merkmal As Variant, art As Variant, nenn As Variant, _
        passung As Variant, oben As Variant, unten As Variant) As String
    Dim o As Variant, u As Variant, f As String
    If IstLeer(ZellWert(nr)) And IstLeer(ZellWert(merkmal)) And IstLeer(ZellWert(art)) And IstLeer(ZellWert(nenn)) And _
            IstLeer(ZellWert(passung)) And IstLeer(ZellWert(oben)) And IstLeer(ZellWert(unten)) Then Exit Function
    If IstLeer(ZellWert(nr)) Then PM_PRUEFUNG = "Nr fehlt": Exit Function
    If IstLeer(ZellWert(merkmal)) Then PM_PRUEFUNG = "Bezeichnung fehlt": Exit Function
    If Not Grenzwerte(ZellWert(art), ZellWert(nenn), ZellWert(passung), ZellWert(oben), ZellWert(unten), o, u, f) Then PM_PRUEFUNG = f
End Function

' Abmaß einer ISO-Passung in mm; teil = "O" (oben) oder "U" (unten)
Public Function PM_ABMASS(nenn As Variant, passung As Variant, teil As Variant) As Variant
    Dim o As Double, u As Double, f As String
    If Not IstZahl(ZellWert(nenn)) Or IstLeer(ZellWert(passung)) Then PM_ABMASS = "": Exit Function
    If ISO_Abmasse(CDbl(ZellWert(nenn)), TextVon(ZellWert(passung)), o, u, f) Then
        If UCase(Left(TextVon(ZellWert(teil)), 1)) = "U" Then PM_ABMASS = u Else PM_ABMASS = o
    Else
        PM_ABMASS = f
    End If
End Function

' Bewertung eines Messwerts: "i.O.", "n.i.O.", "ungültig" oder ""
Public Function PM_BEWERTUNG(art As Variant, ist As Variant, ogw As Variant, ugw As Variant) As String
    PM_BEWERTUNG = BewertungMerkmal(ZellWert(art), ZellWert(ist), ZellWert(ogw), ZellWert(ugw))
End Function

' Zellbezug in Wert umwandeln
Private Function ZellWert(ByVal x As Variant) As Variant
    If IsObject(x) Then
        ZellWert = x.Cells(1, 1).Value
    Else
        ZellWert = x
    End If
End Function
