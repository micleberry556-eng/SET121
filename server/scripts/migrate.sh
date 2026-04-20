#!/bin/bash
# =============================================================================
# Meshlink Server - Migration Script
# Backup or restore the entire Meshlink server for migration to another host.
#
# Usage:
#   sudo ./migrate.sh backup              # Create a backup archive
#   sudo ./migrate.sh restore backup.tar.gz  # Restore from backup on new server
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[Meshlink]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMAND="${1:-help}"

do_backup() {
    cd "$SERVER_DIR"

    if [ ! -f ".env" ]; then
        err ".env not found. Nothing to backup."
        exit 1
    fi

    TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP_DIR="/tmp/meshlink-backup-${TIMESTAMP}"
    BACKUP_FILE="meshlink-backup-${TIMESTAMP}.tar.gz"

    log "Creating backup..."
    mkdir -p "$BACKUP_DIR"

    # Stop services for consistent backup
    log "Stopping services for consistent backup..."
    docker compose stop

    # Backup Docker volumes
    log "Backing up PostgreSQL data..."
    docker run --rm \
        -v meshlink_postgres_data:/data \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf /backup/postgres_data.tar.gz -C /data .

    log "Backing up Synapse data..."
    docker run --rm \
        -v meshlink_synapse_data:/data \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf /backup/synapse_data.tar.gz -C /data .

    # Backup config files
    log "Backing up configuration..."
    cp -r "$SERVER_DIR"/.env "$BACKUP_DIR/"
    cp -r "$SERVER_DIR"/synapse "$BACKUP_DIR/"
    cp -r "$SERVER_DIR"/element "$BACKUP_DIR/"
    cp -r "$SERVER_DIR"/coturn "$BACKUP_DIR/"
    cp -r "$SERVER_DIR"/nginx "$BACKUP_DIR/"
    cp -r "$SERVER_DIR"/docker-compose.yml "$BACKUP_DIR/"
    cp -r "$SERVER_DIR"/admin-api "$BACKUP_DIR/"

    # Restart services
    log "Restarting services..."
    docker compose start

    # Create archive
    log "Creating archive..."
    cd /tmp
    tar czf "$BACKUP_FILE" "meshlink-backup-${TIMESTAMP}"
    rm -rf "$BACKUP_DIR"

    FINAL_PATH="/tmp/${BACKUP_FILE}"
    SIZE=$(du -h "$FINAL_PATH" | cut -f1)

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Backup complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  File: ${CYAN}${FINAL_PATH}${NC}"
    echo -e "  Size: ${CYAN}${SIZE}${NC}"
    echo ""
    echo -e "  To migrate to a new server:"
    echo -e "  1. Copy this file to the new server"
    echo -e "  2. Clone the Meshlink repo"
    echo -e "  3. Run: ${CYAN}sudo ./migrate.sh restore ${BACKUP_FILE}${NC}"
    echo ""
}

do_restore() {
    local BACKUP_FILE="${2:-}"

    if [ -z "$BACKUP_FILE" ]; then
        err "Usage: ./migrate.sh restore <backup-file.tar.gz>"
        exit 1
    fi

    if [ ! -f "$BACKUP_FILE" ]; then
        err "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    # Check Docker is installed
    if ! command -v docker &>/dev/null; then
        err "Docker is not installed. Run setup.sh first to install Docker."
        exit 1
    fi

    log "Extracting backup..."
    RESTORE_DIR="/tmp/meshlink-restore-$$"
    mkdir -p "$RESTORE_DIR"
    tar xzf "$BACKUP_FILE" -C "$RESTORE_DIR" --strip-components=1

    cd "$SERVER_DIR"

    # Stop existing services if running
    docker compose down 2>/dev/null || true

    # Restore config files
    log "Restoring configuration..."
    cp "$RESTORE_DIR/.env" "$SERVER_DIR/"
    cp -r "$RESTORE_DIR/synapse" "$SERVER_DIR/"
    cp -r "$RESTORE_DIR/element" "$SERVER_DIR/"
    cp -r "$RESTORE_DIR/coturn" "$SERVER_DIR/"
    cp -r "$RESTORE_DIR/nginx" "$SERVER_DIR/"
    cp "$RESTORE_DIR/docker-compose.yml" "$SERVER_DIR/"
    cp -r "$RESTORE_DIR/admin-api" "$SERVER_DIR/"

    # Create volumes and restore data
    log "Restoring PostgreSQL data..."
    docker volume create meshlink_postgres_data 2>/dev/null || true
    docker run --rm \
        -v meshlink_postgres_data:/data \
        -v "$RESTORE_DIR":/backup \
        alpine sh -c "cd /data && tar xzf /backup/postgres_data.tar.gz"

    log "Restoring Synapse data..."
    docker volume create meshlink_synapse_data 2>/dev/null || true
    docker run --rm \
        -v meshlink_synapse_data:/data \
        -v "$RESTORE_DIR":/backup \
        alpine sh -c "cd /data && tar xzf /backup/synapse_data.tar.gz"

    # Clean up
    rm -rf "$RESTORE_DIR"

    # Update server host if needed
    # shellcheck source=/dev/null
    source "$SERVER_DIR/.env"
    CURRENT_IP=$(curl -4 -s --max-time 5 ifconfig.co 2>/dev/null || hostname -I | awk '{print $1}')

    if [ "$SERVER_HOST" != "$CURRENT_IP" ]; then
        warn "Backup was from server $SERVER_HOST, this server is $CURRENT_IP"
        read -rp "Update config to use $CURRENT_IP? (yes/no) [yes]: " UPDATE_IP
        UPDATE_IP="${UPDATE_IP:-yes}"
        if [ "$UPDATE_IP" = "yes" ]; then
            sed -i "s|${SERVER_HOST}|${CURRENT_IP}|g" "$SERVER_DIR/.env"
            sed -i "s|${SERVER_HOST}|${CURRENT_IP}|g" "$SERVER_DIR/synapse/homeserver.yaml"
            sed -i "s|${SERVER_HOST}|${CURRENT_IP}|g" "$SERVER_DIR/coturn/turnserver.conf"
            sed -i "s|${SERVER_HOST}|${CURRENT_IP}|g" "$SERVER_DIR/element/config.json"
            log "Config updated to use $CURRENT_IP"
        fi
    fi

    # Start services
    log "Starting services..."
    docker compose pull
    docker compose up -d

    # Wait for health
    log "Waiting for Synapse..."
    RETRIES=30
    while [ $RETRIES -gt 0 ]; do
        if docker compose exec -T synapse wget -qO /dev/null http://localhost:8008/health 2>/dev/null; then
            break
        fi
        RETRIES=$((RETRIES - 1))
        sleep 5
    done

    # Regenerate installers for new host
    if [ -x "$SCRIPT_DIR/generate-installers.sh" ]; then
        bash "$SCRIPT_DIR/generate-installers.sh"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Restore complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  All data and configuration restored."
    echo -e "  Services are running."
    echo ""
}

case "$COMMAND" in
    backup)
        do_backup
        ;;
    restore)
        do_restore "$@"
        ;;
    *)
        echo "Meshlink Migration Tool"
        echo ""
        echo "Usage:"
        echo "  sudo ./migrate.sh backup              Create a backup archive"
        echo "  sudo ./migrate.sh restore <file>       Restore from backup"
        echo ""
        ;;
esac
