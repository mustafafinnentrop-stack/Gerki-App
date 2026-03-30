#Requires -Version 5.1
<#
.SYNOPSIS
    Gerki Windows Installer – Vollautomatisch
.DESCRIPTION
    Installiert alle benötigten Programme für Gerki:
    1. Systemvoraussetzungen prüfen
    2. Ollama installieren (lokale KI)
    3. Mistral 7B KI-Modell herunterladen
    4. Gerki Desktop-App installieren
    5. Desktop-Verknüpfung erstellen
.NOTES
    Muss als Administrator ausgeführt werden für globale Installation.
    Ohne Admin: Installation im Benutzerverzeichnis.
#>

param(
    [switch]$Silent,
    [string]$InstallPath = "$env:LOCALAPPDATA\Gerki",
    [string]$OllamaModel = "mistral"
)

# ── Farben & Ausgabe ─────────────────────────────────────────────────────────

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║           GERKI – KI-Assistent Installer         ║" -ForegroundColor Cyan
    Write-Host "  ║         Lokale KI. Keine Cloud. Deine Daten.     ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([int]$Number, [string]$Text)
    Write-Host "  [$Number/5] $Text" -ForegroundColor Yellow
}

function Write-OK { param([string]$Text) Write-Host "    ✓ $Text" -ForegroundColor Green }
function Write-WARN { param([string]$Text) Write-Host "    ⚠ $Text" -ForegroundColor Yellow }
function Write-ERR { param([string]$Text) Write-Host "    ✗ $Text" -ForegroundColor Red }
function Write-INFO { param([string]$Text) Write-Host "    → $Text" -ForegroundColor White }

# ── Schritt 1: Systemvoraussetzungen ─────────────────────────────────────────

Write-Header

Write-Step 1 "Systemvoraussetzungen prüfen..."

# Windows Version prüfen
$winVer = [System.Environment]::OSVersion.Version
if ($winVer.Major -lt 10) {
    Write-ERR "Windows 10 oder neuer erforderlich. Gefunden: Windows $($winVer.Major)"
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}
Write-OK "Windows Version: OK ($($winVer.Major).$($winVer.Minor))"

# RAM prüfen
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ram -lt 8) {
    Write-WARN "Mindestens 8 GB RAM empfohlen. Gefunden: $ram GB"
    Write-WARN "Gerki läuft, aber das KI-Modell könnte langsam sein."
} else {
    Write-OK "RAM: $ram GB – ausreichend"
}

# Festplatte prüfen (mindestens 10 GB frei)
$disk = Get-PSDrive -Name C | Select-Object -ExpandProperty Free
$diskGB = [math]::Round($disk / 1GB, 1)
if ($diskGB -lt 10) {
    Write-ERR "Zu wenig Speicherplatz. Mindestens 10 GB erforderlich, frei: $diskGB GB"
    Read-Host "Drücke Enter zum Beenden"
    exit 1
}
Write-OK "Festplatte: $diskGB GB frei – ausreichend"

# PowerShell Execution Policy prüfen
$policy = Get-ExecutionPolicy
if ($policy -eq "Restricted") {
    Write-WARN "Execution Policy ist Restricted. Setze auf RemoteSigned..."
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-OK "Execution Policy aktualisiert"
}

Write-Host ""

# ── Schritt 2: Ollama installieren ───────────────────────────────────────────

Write-Step 2 "Ollama (lokale KI-Engine) installieren..."

$ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
$ollamaInstalled = Test-Path $ollamaExe

if ($ollamaInstalled) {
    Write-OK "Ollama ist bereits installiert"
} else {
    Write-INFO "Ollama wird heruntergeladen (~100 MB)..."

    $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"

    try {
        # TLS 1.2 erzwingen
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        $progressPreference = 'SilentlyContinue'
        Invoke-WebRequest `
            -Uri "https://ollama.com/download/OllamaSetup.exe" `
            -OutFile $ollamaInstaller `
            -UseBasicParsing

        Write-OK "Download abgeschlossen"
        Write-INFO "Ollama wird installiert (bitte warten)..."

        $process = Start-Process -FilePath $ollamaInstaller -ArgumentList "/SILENT" -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            throw "Installer Exitcode: $($process.ExitCode)"
        }

        # Kurz warten bis Dateien geschrieben
        Start-Sleep -Seconds 3

        if (Test-Path $ollamaExe) {
            Write-OK "Ollama erfolgreich installiert"
        } else {
            Write-ERR "Ollama-Binary nicht gefunden nach Installation"
            Write-INFO "Bitte Ollama manuell installieren: https://ollama.com/download"
            Read-Host "Drücke Enter zum Weitermachen"
        }
    }
    catch {
        Write-ERR "Fehler beim Herunterladen: $_"
        Write-INFO "Alternativer Download: Öffne https://ollama.com/download im Browser"
        if (-not $Silent) {
            Start-Process "https://ollama.com/download"
            Read-Host "Installiere Ollama manuell und drücke dann Enter"
        }
    }
}

# Ollama starten
Write-INFO "Ollama wird gestartet..."
try {
    # Prüfen ob Ollama bereits läuft
    $ollamaRunning = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/version" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { $ollamaRunning = $true }
    } catch {}

    if (-not $ollamaRunning) {
        Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 4

        # Erneut prüfen
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:11434/api/version" -TimeoutSec 3 -UseBasicParsing
            if ($response.StatusCode -eq 200) { $ollamaRunning = $true }
        } catch {}
    }

    if ($ollamaRunning) {
        Write-OK "Ollama läuft auf Port 11434"
    } else {
        Write-WARN "Ollama konnte nicht automatisch gestartet werden"
        Write-INFO "Starte Ollama manuell: Suche 'Ollama' im Startmenü"
    }
} catch {
    Write-WARN "Ollama-Start fehlgeschlagen: $_"
}

Write-Host ""

# ── Schritt 3: KI-Modell herunterladen ───────────────────────────────────────

Write-Step 3 "KI-Modell '$OllamaModel' herunterladen (~4 GB, kann einige Minuten dauern)..."

# Prüfen ob Modell schon vorhanden
$modelDir = "$env:USERPROFILE\.ollama\models"
$hasModel = $false
if (Test-Path $modelDir) {
    $modelFiles = Get-ChildItem -Path $modelDir -Recurse -Filter "*.bin" -ErrorAction SilentlyContinue
    if ($modelFiles.Count -gt 0) {
        Write-OK "KI-Modell bereits vorhanden – wird übersprungen"
        $hasModel = $true
    }
}

if (-not $hasModel) {
    Write-INFO "Download läuft... (Internetverbindung erforderlich, ~4 GB)"
    Write-INFO "Bitte warten – das kann 5-20 Minuten dauern je nach Verbindung"

    try {
        $pullProcess = Start-Process `
            -FilePath $ollamaExe `
            -ArgumentList "pull $OllamaModel" `
            -Wait -PassThru -NoNewWindow

        if ($pullProcess.ExitCode -eq 0) {
            Write-OK "Modell '$OllamaModel' erfolgreich heruntergeladen"
        } else {
            Write-WARN "Modell-Download unvollständig (Code: $($pullProcess.ExitCode))"
            Write-INFO "Du kannst das Modell später in Gerki herunterladen"
        }
    } catch {
        Write-WARN "Automatischer Download fehlgeschlagen: $_"
        Write-INFO "Lade das Modell später in der Gerki-App herunter (Einstellungen → Ollama)"
    }
}

Write-Host ""

# ── Schritt 4: Gerki installieren ────────────────────────────────────────────

Write-Step 4 "Gerki Desktop-App installieren..."

# Gerki-Installer suchen (im gleichen Ordner wie dieses Skript)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gerkiInstaller = Get-ChildItem -Path $scriptDir -Filter "Gerki-Setup-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $gerkiInstaller) {
    # Auch im übergeordneten Verzeichnis suchen
    $parentDir = Split-Path -Parent $scriptDir
    $gerkiInstaller = Get-ChildItem -Path $parentDir -Filter "Gerki-Setup-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($gerkiInstaller) {
    Write-INFO "Gerki-Installer gefunden: $($gerkiInstaller.Name)"
    Write-INFO "Installation läuft..."

    $process = Start-Process -FilePath $gerkiInstaller.FullName -ArgumentList "/SILENT" -Wait -PassThru
    if ($process.ExitCode -eq 0) {
        Write-OK "Gerki erfolgreich installiert"
    } else {
        Write-WARN "Installation Exitcode: $($process.ExitCode)"
    }
} else {
    Write-WARN "Gerki-Installer (Gerki-Setup-*.exe) nicht in diesem Ordner gefunden"
    Write-INFO "Bitte lade Gerki von gerki.app herunter und führe den Installer aus"
    Write-INFO "Oder baue Gerki selbst: cd gerki-app && npm run build:win"
}

Write-Host ""

# ── Schritt 5: Desktop-Verknüpfung ───────────────────────────────────────────

Write-Step 5 "Fertigstellen..."

# Ollama Autostart-Eintrag prüfen/anlegen
$ollamaStartup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Ollama.lnk"
if (-not (Test-Path $ollamaStartup) -and (Test-Path $ollamaExe)) {
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $shortcut = $wsh.CreateShortcut($ollamaStartup)
        $shortcut.TargetPath = $ollamaExe
        $shortcut.Arguments = "serve"
        $shortcut.WindowStyle = 7  # Minimiert
        $shortcut.Description = "Ollama KI-Server (für Gerki)"
        $shortcut.Save()
        Write-OK "Ollama startet jetzt automatisch mit Windows"
    } catch {
        Write-WARN "Autostart konnte nicht angelegt werden: $_"
    }
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║              INSTALLATION ABGESCHLOSSEN          ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Was du jetzt tun kannst:" -ForegroundColor White
Write-Host "  1. Starte Gerki über das Startmenü oder den Desktop" -ForegroundColor White
Write-Host "  2. Erstelle ein kostenloses Konto" -ForegroundColor White
Write-Host "  3. Die lokale KI (Ollama) ist sofort einsatzbereit!" -ForegroundColor White
Write-Host ""
Write-Host "  Hilfe: docs.gerki.app  |  support@gerki.app" -ForegroundColor Gray
Write-Host ""

if (-not $Silent) {
    Read-Host "  Drücke Enter zum Beenden"
}
