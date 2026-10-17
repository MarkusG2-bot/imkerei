# Messprotokoll – Installation
# Baut aus Messprotokoll.xlsx + VBA-Modulen die fertige Messprotokoll.xlsm,
# legt die Ordnerstruktur an und spielt auf Wunsch Testdaten ein.
# Läuft mit Windows PowerShell 5.1 und Microsoft Excel (Microsoft 365).

$ErrorActionPreference = 'Stop'
$quelle = Split-Path -Parent $MyInvocation.MyCommand.Path
$version = (Get-Content (Join-Path $quelle 'VERSION.txt') -Raw).Trim()

function Frage-JaNein([string]$text) {
    while ($true) {
        $a = (Read-Host "$text [J/N]").Trim().ToUpper()
        if ($a -eq 'J') { return $true }
        if ($a -eq 'N') { return $false }
    }
}

function Schreibschutz-Aus([string]$datei) {
    if (Test-Path -LiteralPath $datei) { Set-ItemProperty -LiteralPath $datei -Name IsReadOnly -Value $false }
}

Write-Host ''
Write-Host "  Messprotokoll $version – Installation" -ForegroundColor Cyan
Write-Host '  ----------------------------------------'
Write-Host ''

# Aus dem Internet geladene Dateien freigeben (sonst sperrt Office die Makros)
Get-ChildItem -LiteralPath $quelle -Recurse -File | Unblock-File

$basis = (Read-Host 'Basisordner (z. B. \\Server\Messdaten_Test oder C:\Messdaten_Test)').Trim().TrimEnd('\')
if (-not $basis) { Write-Host 'Abgebrochen.'; exit 1 }
$testdaten = Frage-JaNein 'Testdaten einspielen (Beispiel-Prüfpläne, Messmittel, 33 Protokolle)?'
$mich = Frage-JaNein "Dich ($env:USERNAME) in den Stammdaten mit allen Rollen eintragen?"
$vertrauen = Frage-JaNein 'Basisordner als vertrauenswürdigen Speicherort für Makros eintragen (nur auf diesem PC)?'

# 1. Ordner
$ordner = @('Programm', 'Stammdaten', 'Pruefplaene', 'Daten', 'Daten\Entwurf', 'Daten\Freigabe',
    'Daten\Archiv', 'PDF', 'Auswertung', 'Import', 'System', 'System\Index', 'System\Sperren')
foreach ($o in $ordner) { New-Item -ItemType Directory -Force -Path (Join-Path $basis $o) | Out-Null }
Write-Host "[1/5] Ordnerstruktur unter $basis bereit."

# 2. Stammdaten (vorhandene werden nie überschrieben)
$stammdaten = Join-Path $basis 'Stammdaten\Stammdaten.xlsx'
if (Test-Path -LiteralPath $stammdaten) {
    Write-Host '[2/5] Stammdaten.xlsx ist schon vorhanden und bleibt unverändert.'
} else {
    if ($testdaten) { $sd = Join-Path $quelle 'testdaten\Stammdaten\Stammdaten.xlsx' }
    else { $sd = Join-Path $quelle 'Stammdaten.xlsx' }
    Copy-Item -LiteralPath $sd -Destination $stammdaten
    Write-Host '[2/5] Stammdaten.xlsx angelegt.'
}

# 3. Testdaten (vorhandene Dateien werden nicht überschrieben)
if ($testdaten) {
    $td = Join-Path $quelle 'testdaten'
    $neu = 0
    foreach ($f in Get-ChildItem -LiteralPath $td -Recurse -File) {
        $rel = $f.FullName.Substring($td.Length + 1)
        if ($rel -like 'Stammdaten\*') { continue }
        $ziel = Join-Path $basis $rel
        if (-not (Test-Path -LiteralPath $ziel)) {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ziel) | Out-Null
            Copy-Item -LiteralPath $f.FullName -Destination $ziel
            $neu++
        }
    }
    # Abgeschlossene Protokolle und benutzte Prüfplan-Stände sind schreibgeschützt
    Get-ChildItem -LiteralPath (Join-Path $basis 'Daten\Archiv') -Recurse -File -Filter *.csv |
        ForEach-Object { $_.IsReadOnly = $true }
    $pp = Join-Path $basis 'Pruefplaene\DEMO-100\DEMO-100_Stand-A.xlsx'
    if (Test-Path -LiteralPath $pp) { (Get-Item -LiteralPath $pp).IsReadOnly = $true }
    Write-Host "[3/5] Testdaten eingespielt ($neu Dateien)."
} else {
    Write-Host '[3/5] Keine Testdaten.'
}

# 4. Excel-Datei mit Makros bauen
$programm = Join-Path $basis 'Programm\Messprotokoll.xlsm'
$reg = 'HKCU:\Software\Microsoft\Office\16.0\Excel\Security'
if (-not (Test-Path $reg)) { New-Item -Path $reg -Force | Out-Null }
$altVBOM = (Get-ItemProperty -Path $reg -Name AccessVBOM -ErrorAction SilentlyContinue).AccessVBOM
Set-ItemProperty -Path $reg -Name AccessVBOM -Value 1 -Type DWord

$xl = $null
$fehler = $null
try {
    Write-Host '[4/5] Excel wird gestartet und das Programm zusammengebaut ...'
    $xl = New-Object -ComObject Excel.Application
    $xl.Visible = $false
    $xl.DisplayAlerts = $false
    $wb = $xl.Workbooks.Open((Join-Path $quelle 'Messprotokoll.xlsx'))
    try {
        $komponenten = $wb.VBProject.VBComponents
    } catch {
        throw 'Excel erlaubt keinen Zugriff auf das VBA-Projekt (Richtlinie der IT). Bitte manuell einrichten, siehe ANLEITUNG.'
    }
    foreach ($f in Get-ChildItem -LiteralPath (Join-Path $quelle 'vba') -Filter *.bas) {
        [void]$komponenten.Import($f.FullName)
    }
    # Code für "DieseArbeitsmappe" (Öffnen/Schließen)
    $blattNamen = @()
    foreach ($ws in $wb.Worksheets) { $blattNamen += $ws.CodeName }
    $dokument = $null
    foreach ($k in $komponenten) {
        if ($k.Type -eq 100 -and ($blattNamen -notcontains $k.Name)) { $dokument = $k }
    }
    if ($dokument -ne $null) {
        $code = [IO.File]::ReadAllText((Join-Path $quelle 'vba\DieseArbeitsmappe.txt'), [Text.Encoding]::GetEncoding(1252))
        $dokument.CodeModule.AddFromString($code)
    } else {
        Write-Host '      Hinweis: Modul "DieseArbeitsmappe" nicht gefunden – Start-Infos erst nach "Anmeldung prüfen".' -ForegroundColor Yellow
    }
    $xl.Run('EinrichtenStill')
    if (Test-Path -LiteralPath $programm) {
        Schreibschutz-Aus $programm
        $sicherung = $programm -replace '\.xlsm$', ('_alt_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.xlsm')
        Move-Item -LiteralPath $programm -Destination $sicherung
        Write-Host "      Alte Version gesichert: $sicherung"
    }
    $wb.SaveAs($programm, 52)
    $wb.Close($false)
    # Schreibgeschützt: alle 80 Nutzer öffnen das Programm ohne Rückfrage nur lesend
    (Get-Item -LiteralPath $programm).IsReadOnly = $true
    Write-Host "      Programm gespeichert: $programm"

    # 5. Stammdaten ergänzen
    if ($mich -or $testdaten) {
        $wb2 = $xl.Workbooks.Open($stammdaten)
        if ($mich) {
            $ws = $wb2.Worksheets.Item('Personen')
            $z = 2
            $vorhanden = $false
            while ($ws.Cells.Item($z, 1).Text -ne '') {
                if ($ws.Cells.Item($z, 1).Text.ToLower() -eq $env:USERNAME.ToLower()) { $vorhanden = $true }
                $z++
            }
            if (-not $vorhanden) {
                $ws.Cells.Item($z, 1).Value2 = $env:USERNAME.ToLower()
                $ws.Cells.Item($z, 2).Value2 = $env:USERNAME
                $ws.Cells.Item($z, 3).Value2 = 'x'
                $ws.Cells.Item($z, 4).Value2 = 'x'
                $ws.Cells.Item($z, 5).Value2 = 'x'
            }
        }
        if ($testdaten) {
            # MS-03 soll beim Test "bald fällig" sein: letzte Kalibrierung vor knapp 12 Monaten
            $ws = $wb2.Worksheets.Item('Messmittel')
            for ($z = 2; $z -le 200; $z++) {
                if ($ws.Cells.Item($z, 1).Text -eq 'MS-03') {
                    $ws.Cells.Item($z, 7).Value2 = (Get-Date).Date.AddMonths(-12).AddDays(14).ToOADate()
                }
            }
        }
        $wb2.Save()
        $wb2.Close($false)
        Write-Host '[5/5] Stammdaten ergänzt.'
    } else {
        Write-Host '[5/5] Stammdaten unverändert.'
    }
} catch {
    $fehler = $_.Exception.Message
} finally {
    if ($xl -ne $null) {
        try { $xl.Quit() } catch { }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
    }
    if ($altVBOM -eq $null) { Remove-ItemProperty -Path $reg -Name AccessVBOM -ErrorAction SilentlyContinue }
    else { Set-ItemProperty -Path $reg -Name AccessVBOM -Value $altVBOM -Type DWord }
}

if ($fehler) {
    Write-Host ''
    Write-Host "FEHLER: $fehler" -ForegroundColor Red
    Write-Host 'Bitte diese Meldung abfotografieren. Manuelle Einrichtung: siehe ANLEITUNG.txt' -ForegroundColor Red
    exit 1
}

# Vertrauenswürdiger Speicherort
if ($vertrauen) {
    $tl = 'HKCU:\Software\Microsoft\Office\16.0\Excel\Security\Trusted Locations'
    if (-not (Test-Path $tl)) { New-Item -Path $tl -Force | Out-Null }
    Set-ItemProperty -Path $tl -Name AllowNetworkLocations -Value 1 -Type DWord
    $eintrag = Join-Path $tl 'Messprotokoll'
    if (-not (Test-Path $eintrag)) { New-Item -Path $eintrag -Force | Out-Null }
    Set-ItemProperty -Path $eintrag -Name Path -Value ($basis + '\')
    Set-ItemProperty -Path $eintrag -Name AllowSubfolders -Value 1 -Type DWord
    Set-ItemProperty -Path $eintrag -Name Description -Value 'Messprotokoll'
    Write-Host "Vertrauenswürdiger Speicherort eingetragen: $basis"
}

Write-Host ''
Write-Host 'Installation abgeschlossen.' -ForegroundColor Green
Write-Host "Programm: $programm"
Write-Host 'Nach dem Öffnen auf dem Startblatt zuerst "Selbsttest" klicken.'
Write-Host ''
if (Frage-JaNein 'Programm jetzt öffnen?') { Invoke-Item -LiteralPath $programm }
