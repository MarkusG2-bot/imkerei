"""Erzeugt modISO286Daten.bas und die Import-Dateien für Excel.

quellcode/*.bas (UTF-8, für Git)  ->  dateien/vba/*.bas (Windows-1252, CRLF, für Excel-Import)
"""
from pathlib import Path
import iso286_daten as D

BASIS = Path(__file__).resolve().parent.parent
QUELLE = BASIS / "quellcode"
ZIEL = BASIS / "dateien" / "vba"


def _zahl(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def _array(werte):
    return "Array(" + ", ".join(_zahl(w) for w in werte) + ")"


def daten_modul():
    z = [
        'Attribute VB_Name = "modISO286Daten"',
        "Option Explicit",
        "' AUTOMATISCH ERZEUGT aus werkzeuge/iso286_daten.py - nicht von Hand ändern.",
        "' Werte nach ISO 286-1, Nennmaß bis 500 mm.",
        "",
        "' Obere Grenzen der Hauptbereiche (mm)",
        "Public Function ISO_HauptBis() As Variant",
        "    ISO_HauptBis = " + _array(D.HAUPT_BIS),
        "End Function",
        "",
        "' Obere Grenzen der Feinbereiche (mm)",
        "Public Function ISO_FeinBis() As Variant",
        "    ISO_FeinBis = " + _array(D.FEIN_BIS),
        "End Function",
        "",
        "' Grundtoleranzen in Zehntel-Mikrometer je Hauptbereich",
        "Public Function ISO_IT10(ByVal grad As Integer) As Variant",
        "    Select Case grad",
    ]
    for g, w in D.IT.items():
        z.append(f"        Case {g}: ISO_IT10 = " + _array([round(v * 10) for v in w]))
    z += ["        Case Else: ISO_IT10 = Empty", "    End Select", "End Function", ""]

    def tabelle(name, kommentar, daten):
        out = [f"' {kommentar}", f"Public Function {name}(ByVal b As String) As Variant",
               "    Select Case b"]
        for k, w in daten.items():
            out.append(f'        Case "{k}": {name} = ' + _array(w))
        out += [f"        Case Else: {name} = Empty", "    End Select", "End Function", ""]
        return out

    z += tabelle("ISO_WelleES", "Oberes Abmaß es der Wellen in µm je Hauptbereich", D.WELLE_ES)
    z += tabelle("ISO_WelleEI", "Unteres Abmaß ei der Wellen in µm je Hauptbereich (k: nur IT4 bis IT7)", D.WELLE_EI)
    z += tabelle("ISO_WelleEIFein", "Unteres Abmaß ei der Wellen in µm je Feinbereich", D.WELLE_EI_FEIN)
    (QUELLE / "modISO286Daten.bas").write_text("\n".join(z) + "\n", encoding="utf-8")


def import_dateien():
    ZIEL.mkdir(parents=True, exist_ok=True)
    for alt in ZIEL.glob("*.bas"):
        alt.unlink()
    for q in sorted(QUELLE.glob("*.bas")):
        text = q.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\n", "\r\n")
        (ZIEL / q.name).write_bytes(text.encode("cp1252"))


if __name__ == "__main__":
    daten_modul()
    import_dateien()
    print("VBA-Dateien erzeugt:", ", ".join(p.name for p in sorted(ZIEL.glob("*.bas"))))
