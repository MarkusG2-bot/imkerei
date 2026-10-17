"""Führt den erzeugten Excel-Selbsttest (modSelbsttest) in LibreOffice aus.

MsgBox und TEMP-Pfad werden dafür ersetzt. Aufruf: python3 tests/test_selbsttest.py
"""
import sys
import tempfile
from vba_laufzeit import VBALaufzeit, QUELLE

with tempfile.TemporaryDirectory() as tmp:
    code = (QUELLE / "modSelbsttest.bas").read_text(encoding="utf-8")
    code = code.replace('Environ("TEMP") & "\\messprotokoll_selbsttest\\test.csv"', f'"{tmp}/test.csv"')
    code = code.replace("Application.StatusBar = False", "").replace('Application.StatusBar = "Selbsttest läuft ..."', "")
    code = code.replace("MsgBox ", "ErgebnisText = ")
    code = code.replace(', vbInformation, "Selbsttest"', "").replace(', vbCritical, "Selbsttest"', "")
    code = code.replace("Private mAnzahl As Long", "Public ErgebnisText As String\nPrivate mAnzahl As Long")
    code += '\nFunction T_Lauf() As String\n    Selbsttest\n    T_Lauf = ErgebnisText\nEnd Function\n'
    zeilen = [z for z in code.splitlines() if not z.startswith("Attribute ")]
    vba = VBALaufzeit(["modISO286Daten", "modISO286", "modLogik", "modDateien"], "")
    try:
        vba.doc.BasicLibraries.getByName("Standard").insertByName(
            "modSelbsttest", "Option VBASupport 1\n" + "\n".join(zeilen) + "\n")
        erg = vba.aufruf("modSelbsttest", "T_Lauf")
    finally:
        vba.ende()
print(erg)
sys.exit(0 if erg.startswith("Selbsttest bestanden") else 1)
