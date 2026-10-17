"""Führt VBA-Module in LibreOffice (VBA-Kompatibilitätsmodus) aus.

Nur für reine Rechenfunktionen ohne Excel-Objekte gedacht.
"""
import os
import subprocess
import tempfile
import time
from pathlib import Path

import uno
from com.sun.star.beans import PropertyValue

QUELLE = Path(__file__).resolve().parent.parent / "quellcode"


def _prop(name, wert):
    p = PropertyValue()
    p.Name, p.Value = name, wert
    return p


class VBALaufzeit:
    def __init__(self, module, zusatz_code=""):
        self.profil = tempfile.mkdtemp(prefix="lo_profil_")
        self.port = 2002 + os.getpid() % 1000
        self.proc = subprocess.Popen([
            "soffice", "--headless", "--invisible", "--norestore", "--nologo",
            f"-env:UserInstallation=file://{self.profil}",
            f"--accept=socket,host=127.0.0.1,port={self.port};urp;",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        lokal = uno.getComponentContext()
        resolver = lokal.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver", lokal)
        for _ in range(60):
            try:
                ctx = resolver.resolve(
                    f"uno:socket,host=127.0.0.1,port={self.port};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError("LibreOffice startet nicht")
        desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        self.doc = desktop.loadComponentFromURL(
            "private:factory/scalc", "_blank", 0, (_prop("Hidden", True),))
        libs = self.doc.BasicLibraries
        if not libs.hasByName("Standard"):
            libs.createLibrary("Standard")
        lib = libs.getByName("Standard")
        for name in module:
            code = (QUELLE / f"{name}.bas").read_text(encoding="utf-8")
            zeilen = [z for z in code.splitlines() if not z.startswith("Attribute ")]
            lib.insertByName(name, "Option VBASupport 1\n" + "\n".join(zeilen) + "\n")
        if zusatz_code:
            lib.insertByName("modTest", "Option VBASupport 1\n" + zusatz_code)
        self.sp = self.doc.getScriptProvider()

    def aufruf(self, modul, funktion, *args):
        s = self.sp.getScript(
            f"vnd.sun.star.script:Standard.{modul}.{funktion}?language=Basic&location=document")
        erg, _, _ = s.invoke(tuple(args), (), ())
        return erg

    def ende(self):
        try:
            self.doc.close(True)
        except Exception:
            pass
        self.proc.terminate()
        self.proc.wait(timeout=20)
