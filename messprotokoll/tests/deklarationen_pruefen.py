"""Statische Prüfung: Werden alle Variablen deklariert (Option Explicit)?

Excel verweigert sonst das Übersetzen des ganzen Projekts. LibreOffice prüft das nicht.
Aufruf: python3 tests/deklarationen_pruefen.py
"""
import re
import sys
from pathlib import Path

QUELLE = Path(__file__).resolve().parent.parent / "quellcode"
SCHLUESSEL = set("""
and as boolean byref byval call case const date dim do double each else elseif empty end error exit
explicit false for function get goto if in integer is like long loop me mod new next not nothing null
object on option or preserve private public redim resume select set single step string sub then to true
until variant wend while with xor print open input output binary access read write lock close append
""".split())

def bereinigen(zeile):
    zeile = re.sub(r'"[^"]*"', '""', zeile)
    if "'" in zeile:
        zeile = zeile[:zeile.index("'")]
    return zeile

global_namen = set()
module = {}
for f in sorted(QUELLE.glob("*.bas")):
    text = f.read_text(encoding="utf-8")
    zeilen = [bereinigen(z) for z in text.replace(" _\n", " ").splitlines()]
    module[f.stem] = zeilen
    for z in zeilen:
        m = re.match(r"\s*(Public|Private|Global)?\s*(Function|Sub|Property Get)\s+(\w+)", z, re.I)
        if m:
            global_namen.add(m.group(3).lower())
        m = re.match(r"\s*(Public|Private|Global|Dim)\s+(Const\s+)?(\w+)", z, re.I)
        if m and not re.match(r"\s*(Public|Private)\s+(Function|Sub)", z, re.I):
            for teil in re.split(r",", re.sub(r"^\s*(Public|Private|Global|Dim)\s+(Const\s+)?", "", z, flags=re.I)):
                n = re.match(r"\s*(\w+)", teil)
                if n:
                    global_namen.add(n.group(1).lower())

fehler = []
for name, zeilen in module.items():
    lokal = None
    kopf = ""
    for nr, z in enumerate(zeilen, start=1):
        m = re.match(r"\s*(Public |Private )?(Function|Sub)\s+(\w+)\s*\((.*)\)", z, re.I)
        if m:
            lokal = set()
            kopf = m.group(3)
            lokal.add(m.group(3).lower())
            for p in m.group(4).split(","):
                p = re.sub(r"\b(Optional|ByVal|ByRef|ParamArray)\b", "", p, flags=re.I)
                n = re.match(r"\s*(\w+)", p)
                if n:
                    lokal.add(n.group(1).lower())
            continue
        if re.match(r"\s*End (Function|Sub)", z, re.I):
            lokal = None
            continue
        if lokal is None:
            continue
        for dm in re.finditer(r"\b(?:Dim|ReDim(?:\s+Preserve)?|Static)\s+(.*)", z, re.I):
            for teil in dm.group(1).split(","):
                n = re.match(r"\s*(\w+)", teil)
                if n:
                    lokal.add(n.group(1).lower())
        # Zuweisungen und Schleifenvariablen
        ziele = []
        for teil in z.split(":"):
            t = teil.strip()
            t = re.sub(r"^(If .* Then\s+)", "", t, flags=re.I)
            t = re.sub(r"^Else\s+", "", t, flags=re.I)
            m = re.match(r"(?:Set\s+)?(\w+)\s*(?:\([^=]*\))?\s*=", t, re.I)
            if m and not re.match(r"(If|ElseIf|Case|Do|Loop|While|Until|Const|Dim)\b", t, re.I):
                ziele.append(m.group(1))
            m = re.match(r"For\s+(?:Each\s+)?(\w+)", t, re.I)
            if m:
                ziele.append(m.group(1))
        for v in ziele:
            if v.lower() in SCHLUESSEL:
                continue
            if v.lower() not in lokal and v.lower() not in global_namen:
                fehler.append(f"{name}.{kopf} Zeile {nr}: '{v}' nicht deklariert")

if fehler:
    print("\n".join(sorted(set(fehler))))
    sys.exit(1)
print(f"Alle Variablen deklariert ({len(module)} Module).")
