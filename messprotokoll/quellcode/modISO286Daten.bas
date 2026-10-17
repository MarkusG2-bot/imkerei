Attribute VB_Name = "modISO286Daten"
Option Explicit
' AUTOMATISCH ERZEUGT aus werkzeuge/iso286_daten.py - nicht von Hand ändern.
' Werte nach ISO 286-1, Nennmaß bis 500 mm.

' Obere Grenzen der Hauptbereiche (mm)
Public Function ISO_HauptBis() As Variant
    ISO_HauptBis = Array(3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500)
End Function

' Obere Grenzen der Feinbereiche (mm)
Public Function ISO_FeinBis() As Variant
    ISO_FeinBis = Array(3, 6, 10, 14, 18, 24, 30, 40, 50, 65, 80, 100, 120, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500)
End Function

' Grundtoleranzen in Zehntel-Mikrometer je Hauptbereich
Public Function ISO_IT10(ByVal grad As Integer) As Variant
    Select Case grad
        Case 1: ISO_IT10 = Array(8, 10, 10, 12, 15, 15, 20, 25, 35, 45, 60, 70, 80)
        Case 2: ISO_IT10 = Array(12, 15, 15, 20, 25, 25, 30, 40, 50, 70, 80, 90, 100)
        Case 3: ISO_IT10 = Array(20, 25, 25, 30, 40, 40, 50, 60, 80, 100, 120, 130, 150)
        Case 4: ISO_IT10 = Array(30, 40, 40, 50, 60, 70, 80, 100, 120, 140, 160, 180, 200)
        Case 5: ISO_IT10 = Array(40, 50, 60, 80, 90, 110, 130, 150, 180, 200, 230, 250, 270)
        Case 6: ISO_IT10 = Array(60, 80, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400)
        Case 7: ISO_IT10 = Array(100, 120, 150, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630)
        Case 8: ISO_IT10 = Array(140, 180, 220, 270, 330, 390, 460, 540, 630, 720, 810, 890, 970)
        Case 9: ISO_IT10 = Array(250, 300, 360, 430, 520, 620, 740, 870, 1000, 1150, 1300, 1400, 1550)
        Case 10: ISO_IT10 = Array(400, 480, 580, 700, 840, 1000, 1200, 1400, 1600, 1850, 2100, 2300, 2500)
        Case 11: ISO_IT10 = Array(600, 750, 900, 1100, 1300, 1600, 1900, 2200, 2500, 2900, 3200, 3600, 4000)
        Case 12: ISO_IT10 = Array(1000, 1200, 1500, 1800, 2100, 2500, 3000, 3500, 4000, 4600, 5200, 5700, 6300)
        Case 13: ISO_IT10 = Array(1400, 1800, 2200, 2700, 3300, 3900, 4600, 5400, 6300, 7200, 8100, 8900, 9700)
        Case 14: ISO_IT10 = Array(2500, 3000, 3600, 4300, 5200, 6200, 7400, 8700, 10000, 11500, 13000, 14000, 15500)
        Case 15: ISO_IT10 = Array(4000, 4800, 5800, 7000, 8400, 10000, 12000, 14000, 16000, 18500, 21000, 23000, 25000)
        Case 16: ISO_IT10 = Array(6000, 7500, 9000, 11000, 13000, 16000, 19000, 22000, 25000, 29000, 32000, 36000, 40000)
        Case Else: ISO_IT10 = Empty
    End Select
End Function

' Oberes Abmaß es der Wellen in µm je Hauptbereich
Public Function ISO_WelleES(ByVal b As String) As Variant
    Select Case b
        Case "d": ISO_WelleES = Array(-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230)
        Case "e": ISO_WelleES = Array(-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135)
        Case "f": ISO_WelleES = Array(-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68)
        Case "g": ISO_WelleES = Array(-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20)
        Case "h": ISO_WelleES = Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        Case Else: ISO_WelleES = Empty
    End Select
End Function

' Unteres Abmaß ei der Wellen in µm je Hauptbereich (k: nur IT4 bis IT7)
Public Function ISO_WelleEI(ByVal b As String) As Variant
    Select Case b
        Case "k": ISO_WelleEI = Array(0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5)
        Case "m": ISO_WelleEI = Array(2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23)
        Case "n": ISO_WelleEI = Array(4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40)
        Case "p": ISO_WelleEI = Array(6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68)
        Case Else: ISO_WelleEI = Empty
    End Select
End Function

' Unteres Abmaß ei der Wellen in µm je Feinbereich
Public Function ISO_WelleEIFein(ByVal b As String) As Variant
    Select Case b
        Case "r": ISO_WelleEIFein = Array(10, 15, 19, 23, 23, 28, 28, 34, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80, 84, 94, 98, 108, 114, 126, 132)
        Case "s": ISO_WelleEIFein = Array(14, 19, 23, 28, 28, 35, 35, 43, 43, 53, 59, 71, 79, 92, 100, 108, 122, 130, 140, 158, 170, 190, 208, 232, 252)
        Case Else: ISO_WelleEIFein = Empty
    End Select
End Function

