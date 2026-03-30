@echo off
:: ============================================================
:: Gerki Windows Installer – Starter
:: Dieses Skript startet den PowerShell-Installer mit den
:: richtigen Rechten und Einstellungen.
:: ============================================================

title Gerki Installer

echo.
echo  Gerki wird installiert...
echo  Bitte warte einen Moment.
echo.

:: PowerShell-Version prüfen
powershell -Command "if ($PSVersionTable.PSVersion.Major -lt 5) { Write-Host 'PowerShell 5+ erforderlich'; exit 1 }"
if %ERRORLEVEL% neq 0 (
    echo.
    echo  FEHLER: PowerShell 5 oder neuer erforderlich.
    echo  Bitte Windows Update ausfuehren.
    echo.
    pause
    exit /b 1
)

:: Als Administrator neu starten wenn nötig
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Administrator-Rechte werden angefordert...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

:: PowerShell-Installer ausführen
powershell -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo  Installation konnte nicht abgeschlossen werden.
    echo  Schau in die FAQ: gerki-windows\FAQ.md
    echo.
    pause
)
