"""Erzeugt alle Lieferdateien: python3 werkzeuge/erzeuge.py"""
import erzeuge_dateien
import erzeuge_vba

erzeuge_vba.alles()
erzeuge_dateien.ZIEL.mkdir(exist_ok=True)
erzeuge_dateien.messprotokoll()
erzeuge_dateien.stammdaten()
print("Fertig: dateien/Messprotokoll.xlsx, dateien/Stammdaten.xlsx, dateien/vba/*.bas")
