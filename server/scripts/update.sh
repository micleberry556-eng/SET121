#!/bin/bash
# =============================================================================
# Meshlink Server - Update Script
# Pulls latest Docker images and restarts all services.
#
# Usage: sudo ./update.sh
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

if [ ! -f "$SERVER_DIR/.env" ]; then
    err ".env not found in $SERVER_DIR. Run setup.sh first."
    exit 1
fi

cd "$SERVER_DIR"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   Meshlink Server Update${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# --- Step 1: Backup current state ---
BACKUP_TAG="pre-update-$(date +%Y%m%d-%H%M%S)"
log "Creating pre-update backup tag: $BACKUP_TAG"

# Save current image versions for rollback
docker compose images --format json 2>/dev/null | tee "/tmp/meshlink-images-${BACKUP_TAG}.json" > /dev/null || true

# --- Step 2: Pull latest images ---
log "Pulling latest Docker images..."
docker compose pull

# --- Step 3: Rebuild custom images (admin-api) ---
log "Rebuilding custom images..."
docker compose build --no-cache admin-api

# --- Step 4: Restart with new images ---
log "Restarting services with updated images..."
docker compose up -d --remove-orphans

# --- Step 5: Wait for health checks ---
log "Waiting for Synapse to become healthy..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if docker compose exec -T synapse wget -qO /dev/null http://localhost:8008/health 2>/dev/null; then
        break
    fi
    RETRIES=$((RETRIES - 1))
    sleep 5
done

if [ $RETRIES -eq 0 ]; then
    err "Synapse did not become healthy after update."
    warn "Rolling back: docker compose down && docker compose up -d"
    exit 1
fi

# --- Step 6: Clean up old images ---
log "Cleaning up unused Docker images..."
docker image prune -f > /dev/null 2>&1 || true

# --- Step 7: Regenerate installers (in case server URL changed) ---
if [ -x "$SCRIPT_DIR/generate-installers.sh" ]; then
    log "Regenerating platform installers..."
    bash "$SCRIPT_DIR/generate-installers.sh"
fi

# --- Done ---
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Update complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

log "Service status:"
docker compose ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}"
echo ""
