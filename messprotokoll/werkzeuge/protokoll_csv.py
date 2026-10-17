"""Protokoll-Dateien im gleichen Format wie modDateien.SchreibeProtokoll (VBA).

Wird für Testdaten und Tests verwendet.
"""
from datetime import datetime

KOPF = ["Produktnummer", "Artikelnummer", "Bezeichnung", "Auftragsnummer", "Kunde",
        "Prüfplan-Stand", "Status", "Ergebnis", "Prüfer", "Begonnen", "Abgeschlossen",
        "Geändert von", "Geändert am", "Standard-Messmittel", "Programmversion"]
MERKMAL = ["Nr", "Merkmal", "Art", "Nennmaß", "Passung / Toleranz", "OGW", "UGW",
           "Istwert", "Bewertung", "Messmittel", "Entscheidung", "Begründung", "Entschieden von",
           "Entschieden am", "Vorwert", "Bemerkung", "Kritisch", "Messmittel-Typ"]


def feld(v):
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, bool):
        return "ja" if v else "nein"
    if isinstance(v, (int, float)):
        s = repr(float(v))
        if s.endswith(".0"):
            s = s[:-2]
        return s
    return str(v).replace(";", ",").replace("\r", " ").replace("\n", " ")


def zeilen(kopf: dict, merkmale: list) -> list:
    k = ";".join(feld(kopf.get(n)) for n in KOPF) + ";"
    out = [";".join(KOPF) + ";" + ";".join(MERKMAL)]
    for m in merkmale:
        out.append(k + ";".join(feld(m.get(n)) for n in MERKMAL))
    return out


def schreiben(pfad, kopf: dict, merkmale: list):
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_bytes(("\r\n".join(zeilen(kopf, merkmale)) + "\r\n").encode("cp1252"))


def lesen(pfad):
    roh = pfad.read_bytes()
    try:
        text = roh.decode("utf-8")      # LibreOffice-Tests unter Linux
    except UnicodeDecodeError:
        text = roh.decode("cp1252")     # Excel unter Windows
    z = [x for x in text.splitlines() if x.strip()]
    daten = []
    for zeile in z[1:]:
        t = zeile.split(";")
        daten.append((dict(zip(KOPF, t[:15])), dict(zip(MERKMAL, t[15:33]))))
    return daten
