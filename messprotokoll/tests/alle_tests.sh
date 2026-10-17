#!/bin/sh
# Alle Prüfungen (LibreOffice nötig). Aufruf: sh tests/alle_tests.sh
cd "$(dirname "$0")" || exit 1
for t in deklarationen_pruefen.py syntax_pruefung.py test_logik.py test_logik2.py test_selbsttest.py test_testdaten.py; do
  echo "== $t"; python3 "$t" || exit 1
done
