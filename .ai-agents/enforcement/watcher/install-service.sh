#!/bin/bash
#
# Install OpenMemory Watcher as a System Service
#
# This script installs the watcher as a systemd service (Linux) or
# launchd service (macOS) so it runs automatically in the background.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

GLOBAL_DIR="${HOME}/.openmemory-global"
WATCHER_DIR="${GLOBAL_DIR}/ai-agents-template/enforcement/watcher"

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}OpenMemory Watcher - Service Installation${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)
        echo -e "${GREEN}Detected: Linux (systemd)${NC}"
        INSTALL_TYPE="systemd"
        ;;
    Darwin*)
        echo -e "${GREEN}Detected: macOS (launchd)${NC}"
        INSTALL_TYPE="launchd"
        ;;
    *)
        echo -e "${RED}Unsupported OS: ${OS}${NC}"
        echo "Manual installation required."
        exit 1
        ;;
esac

echo ""

# Install systemd service (Linux)
if [ "$INSTALL_TYPE" = "systemd" ]; then
    echo "Installing systemd user service..."

    # Create user systemd directory
    mkdir -p "${HOME}/.config/systemd/user"

    # Expand %u and %h in service file
    SERVICE_FILE="${HOME}/.config/systemd/user/openmemory-watcher.service"
    sed "s|%u|${USER}|g; s|%h|${HOME}|g" \
        "${WATCHER_DIR}/openmemory-watcher.service" > "${SERVICE_FILE}"

    echo -e "${GREEN}✓ Service file installed${NC}"

    # Reload systemd
    systemctl --user daemon-reload
    echo -e "${GREEN}✓ Systemd reloaded${NC}"

    # Enable service
    systemctl --user enable openmemory-watcher.service
    echo -e "${GREEN}✓ Service enabled (will start on login)${NC}"

    # Offer to start now
    echo ""
    read -p "Start the watcher now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        systemctl --user start openmemory-watcher.service
        echo -e "${GREEN}✓ Service started${NC}"

        # Show status
        sleep 1
        echo ""
        echo "Service status:"
        systemctl --user status openmemory-watcher.service --no-pager
    fi

    echo ""
    echo -e "${GREEN}=====================================================================${NC}"
    echo -e "${GREEN}✅ Systemd service installed successfully!${NC}"
    echo -e "${GREEN}=====================================================================${NC}"
    echo ""
    echo "Service commands:"
    echo "  systemctl --user start openmemory-watcher    Start service"
    echo "  systemctl --user stop openmemory-watcher     Stop service"
    echo "  systemctl --user status openmemory-watcher   Check status"
    echo "  systemctl --user restart openmemory-watcher  Restart service"
    echo "  systemctl --user disable openmemory-watcher  Disable auto-start"
    echo ""
    echo "Logs:"
    echo "  journalctl --user -u openmemory-watcher -f"
    echo "  Or: ${GLOBAL_DIR}/watcher/watcher.log"
    echo ""

# Install launchd service (macOS)
elif [ "$INSTALL_TYPE" = "launchd" ]; then
    echo "Installing launchd service..."

    # Create LaunchAgents directory
    mkdir -p "${HOME}/Library/LaunchAgents"

    # Copy plist file
    PLIST_FILE="${HOME}/Library/LaunchAgents/com.openmemory.watcher.plist"
    cp "${WATCHER_DIR}/com.openmemory.watcher.plist" "${PLIST_FILE}"

    # Replace placeholders
    sed -i '' "s|\${HOME}|${HOME}|g" "${PLIST_FILE}"

    echo -e "${GREEN}✓ Service file installed${NC}"

    # Load service
    launchctl load "${PLIST_FILE}"
    echo -e "${GREEN}✓ Service loaded${NC}"

    # Start service
    launchctl start com.openmemory.watcher
    echo -e "${GREEN}✓ Service started${NC}"

    echo ""
    echo -e "${GREEN}=====================================================================${NC}"
    echo -e "${GREEN}✅ Launchd service installed successfully!${NC}"
    echo -e "${GREEN}=====================================================================${NC}"
    echo ""
    echo "Service commands:"
    echo "  launchctl start com.openmemory.watcher   Start service"
    echo "  launchctl stop com.openmemory.watcher    Stop service"
    echo "  launchctl list | grep openmemory         Check status"
    echo ""
    echo "Logs:"
    echo "  ${GLOBAL_DIR}/watcher/watcher.log"
    echo ""
fi

echo "The watcher will now automatically detect and initialize new projects."
echo ""

exit 0
