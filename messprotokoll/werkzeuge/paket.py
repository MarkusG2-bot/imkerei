"""Baut das Lieferpaket Messprotokoll_<Version>.zip (alles für die Installation).

Aufruf: python3 werkzeuge/paket.py
"""
import re
import shutil
import zipfile
from pathlib import Path

import erzeuge_dateien
import erzeuge_testdaten
import erzeuge_testplan
import erzeuge_vba

BASIS = Path(__file__).resolve().parent.parent


def version():
    text = (BASIS / "quellcode" / "modKonfig.bas").read_text(encoding="utf-8")
    return re.search(r'PROGRAMM_VERSION As String = "([^"]+)"', text).group(1)


def crlf(text):
    return text.replace("\r\n", "\n").replace("\n", "\r\n")


def main():
    v = version()
    erzeuge_vba.alles()
    erzeuge_dateien.ZIEL.mkdir(exist_ok=True)
    erzeuge_dateien.messprotokoll()
    erzeuge_dateien.stammdaten()
    erzeuge_testdaten.main()
    erzeuge_testplan.main()

    name = f"Messprotokoll_{v}"
    bau = BASIS / "dateien" / "_bau" / name
    if bau.parent.exists():
        shutil.rmtree(bau.parent)
    bau.mkdir(parents=True)
    d = BASIS / "dateien"
    for f in ["Messprotokoll.xlsx", "Stammdaten.xlsx", "Testliste.xlsx"]:
        shutil.copy2(d / f, bau / f)
    shutil.copytree(d / "vba", bau / "vba")
    shutil.copytree(d / "testdaten", bau / "testdaten")
    inst = BASIS / "installation"
    shutil.copy2(inst / "INSTALLIEREN.bat", bau / "INSTALLIEREN.bat")
    # PowerShell 5.1 braucht UTF-8 mit BOM für Umlaute
    ps = crlf((inst / "installieren.ps1").read_text(encoding="utf-8"))
    (bau / "installieren.ps1").write_bytes(b"\xef\xbb\xbf" + ps.encode("utf-8"))
    (bau / "VERSION.txt").write_bytes((v + "\r\n").encode("ascii"))
    for md, txt in [("ANLEITUNG.md", "ANLEITUNG.txt"), ("TESTPLAN.md", "TESTPLAN.txt")]:
        (bau / txt).write_bytes(b"\xef\xbb\xbf" + crlf((BASIS / md).read_text(encoding="utf-8")).encode("utf-8"))

    zipdatei = BASIS / f"{name}.zip"
    for alt in BASIS.glob("Messprotokoll_*.zip"):
        alt.unlink()
    with zipfile.ZipFile(zipdatei, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(bau.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(bau.parent).as_posix())
    shutil.rmtree(bau.parent)
    print(f"Paket: {zipdatei.name} ({zipdatei.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
