#!/bin/bash
# ============================================================
# Gerki Mac Installer – Vollautomatisch
# Installiert: Homebrew (optional), Ollama, Mistral 7B, Gerki
# ============================================================

set -euo pipefail

# ── Farben ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

STEP=0
TOTAL=5

# ── Hilfsfunktionen ─────────────────────────────────────────
header() {
    clear
    echo ""
    echo -e "${CYAN}  ╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║           GERKI – KI-Assistent Installer         ║${NC}"
    echo -e "${CYAN}  ║       Lokale KI. Keine Cloud. Deine Daten.       ║${NC}"
    echo -e "${CYAN}  ╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

step() {
    STEP=$((STEP + 1))
    echo -e "${YELLOW}  [$STEP/$TOTAL] $1${NC}"
}

ok()   { echo -e "${GREEN}    ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}    ⚠ $1${NC}"; }
err()  { echo -e "${RED}    ✗ $1${NC}"; }
info() { echo -e "${WHITE}    → $1${NC}"; }

header

# ── Schritt 1: Systemvoraussetzungen ────────────────────────
step "Systemvoraussetzungen prüfen..."

# macOS Version
MAC_VER=$(sw_vers -productVersion)
MAC_MAJOR=$(echo "$MAC_VER" | cut -d. -f1)
if [ "$MAC_MAJOR" -lt 12 ]; then
    err "macOS 12 Monterey oder neuer erforderlich. Gefunden: $MAC_VER"
    exit 1
fi
ok "macOS $MAC_VER – OK"

# RAM prüfen
RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if [ "$RAM_GB" -lt 8 ]; then
    warn "${RAM_GB} GB RAM – mindestens 8 GB empfohlen (Modell kann langsam sein)"
else
    ok "${RAM_GB} GB RAM – ausreichend"
fi

# Festplatte prüfen (10 GB frei)
FREE_GB=$(df -g / | awk 'NR==2{print $4}')
if [ "$FREE_GB" -lt 10 ]; then
    err "Zu wenig Speicher: ${FREE_GB} GB frei, mindestens 10 GB benötigt"
    exit 1
fi
ok "${FREE_GB} GB frei auf / – ausreichend"

# Architektur
ARCH=$(uname -m)
ok "Architektur: $ARCH"
echo ""

# ── Schritt 2: Ollama installieren ──────────────────────────
step "Ollama (lokale KI-Engine) installieren..."

if command -v ollama &>/dev/null; then
    OLLAMA_VER=$(ollama --version 2>/dev/null | head -1 || echo "unbekannt")
    ok "Ollama bereits installiert: $OLLAMA_VER"
else
    # Methode 1: Homebrew (bevorzugt)
    if command -v brew &>/dev/null; then
        info "Installiere Ollama via Homebrew..."
        brew install ollama 2>&1 | while IFS= read -r line; do
            echo "    $line"
        done
        ok "Ollama via Homebrew installiert"
    else
        # Methode 2: Offizielles Installationsskript
        info "Installiere Ollama via offizielles Skript..."
        info "(Homebrew nicht gefunden – direkter Download)"

        if curl -fsSL https://ollama.com/install.sh | sh; then
            ok "Ollama installiert"
        else
            # Methode 3: Direkt-Download der App
            warn "Skript-Installation fehlgeschlagen. Versuche direkten Download..."
            TMPDIR_OLLAMA=$(mktemp -d)
            curl -L "https://ollama.com/download/Ollama-darwin.zip" -o "$TMPDIR_OLLAMA/Ollama.zip"
            unzip -q "$TMPDIR_OLLAMA/Ollama.zip" -d "$TMPDIR_OLLAMA"
            if [ -d "$TMPDIR_OLLAMA/Ollama.app" ]; then
                cp -r "$TMPDIR_OLLAMA/Ollama.app" /Applications/
                ok "Ollama.app nach /Applications kopiert"
                open /Applications/Ollama.app
            else
                err "Automatische Installation fehlgeschlagen"
                info "Bitte Ollama manuell installieren: open https://ollama.com/download"
                open "https://ollama.com/download"
                read -rp "    Installiere Ollama und drücke dann Enter: "
            fi
            rm -rf "$TMPDIR_OLLAMA"
        fi
    fi
fi

# Ollama starten
info "Starte Ollama-Server..."

# Prüfen ob bereits läuft
if curl -s http://localhost:11434/api/version &>/dev/null; then
    ok "Ollama läuft bereits auf Port 11434"
else
    # Via brew services wenn möglich
    if command -v brew &>/dev/null && brew list ollama &>/dev/null; then
        brew services start ollama &>/dev/null || true
    fi

    # Oder direkt als Hintergrundprozess
    if ! curl -s http://localhost:11434/api/version &>/dev/null; then
        OLLAMA_BIN=""
        for p in "/usr/local/bin/ollama" "/opt/homebrew/bin/ollama"; do
            if [ -f "$p" ]; then OLLAMA_BIN="$p"; break; fi
        done

        if [ -n "$OLLAMA_BIN" ]; then
            "$OLLAMA_BIN" serve &>/dev/null &
            sleep 4
        fi
    fi

    if curl -s http://localhost:11434/api/version &>/dev/null; then
        ok "Ollama läuft auf Port 11434"
    else
        warn "Ollama konnte nicht automatisch gestartet werden"
        info "Starte Ollama manuell: öffne ein Terminal und tippe 'ollama serve'"
    fi
fi
echo ""

# ── Schritt 3: KI-Modell herunterladen ──────────────────────
step "KI-Modell 'mistral' herunterladen (~4 GB)..."

OLLAMA_CMD=""
for p in "ollama" "/usr/local/bin/ollama" "/opt/homebrew/bin/ollama"; do
    if command -v "$p" &>/dev/null || [ -f "$p" ]; then
        OLLAMA_CMD="$p"
        break
    fi
done

if [ -z "$OLLAMA_CMD" ]; then
    warn "Ollama-Befehl nicht gefunden – Modell-Download übersprungen"
    info "Lade das Modell später in Gerki herunter (Einstellungen → Ollama)"
else
    # Prüfen ob Modell schon vorhanden
    MODELS_DIR="$HOME/.ollama/models"
    if [ -d "$MODELS_DIR" ] && [ "$(find "$MODELS_DIR" -name "*.bin" 2>/dev/null | wc -l)" -gt 0 ]; then
        ok "KI-Modell bereits vorhanden – wird übersprungen"
    else
        info "Download läuft... (~4 GB, je nach Internet 5-20 Minuten)"
        if "$OLLAMA_CMD" pull mistral; then
            ok "Modell 'mistral' erfolgreich geladen"
        else
            warn "Automatischer Download fehlgeschlagen"
            info "Starte später manuell: ollama pull mistral"
        fi
    fi
fi
echo ""

# ── Schritt 4: Gerki installieren ───────────────────────────
step "Gerki Desktop-App installieren..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

# Suche nach Gerki DMG in diesem Ordner oder übergeordnetem Ordner
GERKI_DMG=""
for dir in "$SCRIPT_DIR" "$PARENT_DIR"; do
    DMG=$(find "$dir" -maxdepth 1 -name "Gerki-*.dmg" 2>/dev/null | head -1)
    if [ -n "$DMG" ]; then
        GERKI_DMG="$DMG"
        break
    fi
done

if [ -n "$GERKI_DMG" ]; then
    info "Gerki DMG gefunden: $(basename "$GERKI_DMG")"
    info "Einbinden und installieren..."

    MOUNT_POINT=$(mktemp -d)
    hdiutil attach "$GERKI_DMG" -mountpoint "$MOUNT_POINT" -quiet

    if [ -d "$MOUNT_POINT/Gerki.app" ]; then
        cp -r "$MOUNT_POINT/Gerki.app" /Applications/
        ok "Gerki.app nach /Applications installiert"
    fi

    hdiutil detach "$MOUNT_POINT" -quiet
    rm -rf "$MOUNT_POINT"
else
    warn "Gerki DMG (Gerki-*.dmg) nicht in diesem Ordner gefunden"
    info "Bitte Gerki von gerki.app herunterladen"
    info "Oder selbst bauen: cd gerki-app && npm run build:mac"
fi
echo ""

# ── Schritt 5: Ollama Autostart ─────────────────────────────
step "Autostart und Abschluss..."

# Ollama LaunchAgent anlegen (startet automatisch beim Login)
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS/com.gerki.ollama.plist"
mkdir -p "$LAUNCH_AGENTS"

OLLAMA_BIN_FINAL=""
for p in "/usr/local/bin/ollama" "/opt/homebrew/bin/ollama"; do
    if [ -f "$p" ]; then OLLAMA_BIN_FINAL="$p"; break; fi
done

if [ -n "$OLLAMA_BIN_FINAL" ] && [ ! -f "$PLIST_PATH" ]; then
    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gerki.ollama</string>
    <key>ProgramArguments</key>
    <array>
        <string>${OLLAMA_BIN_FINAL}</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/ollama.log</string>
</dict>
</plist>
PLIST
    launchctl load "$PLIST_PATH" 2>/dev/null || true
    ok "Ollama startet jetzt automatisch beim Login"
fi

echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║              INSTALLATION ABGESCHLOSSEN          ║${NC}"
echo -e "${GREEN}  ╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${WHITE}  Was du jetzt tun kannst:${NC}"
echo -e "  1. Starte Gerki aus dem Launchpad oder /Applications"
echo -e "  2. Erstelle ein kostenloses Konto"
echo -e "  3. Die lokale KI (Ollama) ist sofort einsatzbereit!"
echo ""
echo -e "${GRAY}  Hilfe: docs.gerki.app  |  support@gerki.app${NC}"
echo ""
