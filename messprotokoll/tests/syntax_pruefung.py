"""Übersetzt jedes VBA-Modul einzeln in LibreOffice (VBA-Modus) und meldet Syntaxfehler.

Aufruf: python3 tests/syntax_pruefung.py
Excel-spezifische Aufrufe werden nur übersetzt, nicht ausgeführt.
"""
import sys
from vba_laufzeit import VBALaufzeit, QUELLE

module = [p.stem for p in sorted(QUELLE.glob("*.bas"))]
fehler = []
vba = VBALaufzeit([], "")
try:
    libs = vba.doc.BasicLibraries
    for m in module:
        lib = libs.createLibrary("L_" + m)
        code = (QUELLE / f"{m}.bas").read_text(encoding="utf-8")
        zeilen = [z for z in code.splitlines() if not z.startswith("Attribute ")]
        lib.insertByName(m, "Option VBASupport 1\n" + "\n".join(zeilen) + "\n")
        lib.insertByName("modSyntax", 'Option VBASupport 1\nFunction T_Ok() As String\n T_Ok = "ok"\nEnd Function\n')
        s = vba.sp.getScript(f"vnd.sun.star.script:L_{m}.modSyntax.T_Ok?language=Basic&location=document")
        try:
            erg = s.invoke((), (), ())[0]
        except Exception as e:
            erg = str(e)
        if erg != "ok":
            fehler.append(f"{m}: lässt sich nicht übersetzen {erg!r}")
finally:
    vba.ende()
if fehler:
    print("Syntaxfehler:\n  " + "\n  ".join(fehler))
    sys.exit(1)
print(f"{len(module)} Module ohne Syntaxfehler: {', '.join(module)}")
