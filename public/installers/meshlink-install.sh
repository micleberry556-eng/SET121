#!/bin/bash
# Meshlink Installer for Linux
# Run: chmod +x meshlink-install.sh && ./meshlink-install.sh

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}========================================"
echo "   Meshlink - Decentralized Messenger"
echo -e "========================================${NC}"
echo ""
echo "Installing Meshlink..."
echo ""

SERVER_URL="http://72.56.244.207"

# Create app directory
mkdir -p "$HOME/Meshlink"

# Create launcher script
cat > "$HOME/Meshlink/meshlink" << LAUNCHER
#!/bin/bash
xdg-open "$SERVER_URL" 2>/dev/null || \
sensible-browser "$SERVER_URL" 2>/dev/null || \
firefox "$SERVER_URL" 2>/dev/null || \
google-chrome "$SERVER_URL" 2>/dev/null || \
echo "Please open $SERVER_URL in your browser"
LAUNCHER
chmod +x "$HOME/Meshlink/meshlink"

# Create .desktop file for app menu
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/meshlink.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Name=Meshlink
GenericName=Messenger
Comment=Decentralized Encrypted Messenger
Exec=xdg-open $SERVER_URL
Icon=internet-chat
Terminal=false
Type=Application
Categories=Network;InstantMessaging;Chat;
Keywords=mesh;chat;messenger;encrypted;
StartupNotify=true
DESKTOP

# Copy to Desktop if it exists
DESKTOP_DIR="$HOME/Desktop"
if [ ! -d "$DESKTOP_DIR" ]; then
    # Try localized desktop folder
    DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
fi

if [ -d "$DESKTOP_DIR" ]; then
    cp "$HOME/.local/share/applications/meshlink.desktop" "$DESKTOP_DIR/"
    chmod +x "$DESKTOP_DIR/meshlink.desktop" 2>/dev/null || true
    # Mark as trusted on GNOME
    gio set "$DESKTOP_DIR/meshlink.desktop" metadata::trusted true 2>/dev/null || true
fi

# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================"
echo "  Installation complete!"
echo ""
echo "  - App menu entry created"
echo "  - Desktop shortcut created"
echo "  - Launcher: ~/Meshlink/meshlink"
echo -e "========================================${NC}"
echo ""
echo "Opening Meshlink..."
xdg-open "$SERVER_URL" 2>/dev/null || echo "Open $SERVER_URL in your browser"
