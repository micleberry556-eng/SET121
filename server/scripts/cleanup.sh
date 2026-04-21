#!/bin/bash
# =============================================================================
# Meshlink Server - Cleanup Script
# Removes old data, unused media, and optimizes the database.
#
# Usage: sudo ./cleanup.sh
# Can be added to cron: 0 3 * * 0 /path/to/cleanup.sh (weekly at 3am)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[Meshlink]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SERVER_DIR"

if [ ! -f ".env" ]; then
    echo "Error: .env not found. Run setup.sh first."
    exit 1
fi

# shellcheck source=/dev/null
source .env

echo ""
log "Meshlink Server Cleanup"
echo ""

# --- 1. Clean Docker logs ---
log "Cleaning Docker logs..."
docker compose logs --no-log-prefix synapse 2>/dev/null | wc -l | xargs -I{} log "  Synapse log lines: {}"
# Docker log rotation is handled by docker-compose.yml (max-size: 10m, max-file: 3)

# --- 2. Clean unused Docker resources ---
log "Cleaning unused Docker images and build cache..."
docker image prune -f > /dev/null 2>&1 || true
docker builder prune -f > /dev/null 2>&1 || true
FREED=$(docker system df --format '{{.Reclaimable}}' 2>/dev/null | head -1 || echo "unknown")
log "  Reclaimable space: $FREED"

# --- 3. Vacuum PostgreSQL database ---
log "Optimizing database..."
docker compose exec -T postgres psql -U "${POSTGRES_USER:-synapse}" -d "${POSTGRES_DB:-synapse}" -c "VACUUM ANALYZE;" 2>/dev/null && log "  Database vacuumed." || warn "  Could not vacuum database."

# --- 4. Report disk usage ---
log "Disk usage report:"
SYNAPSE_SIZE=$(docker system df -v 2>/dev/null | grep synapse_data | awk '{print $4}' || echo "unknown")
POSTGRES_SIZE=$(docker system df -v 2>/dev/null | grep postgres_data | awk '{print $4}' || echo "unknown")
log "  Server data: ${SYNAPSE_SIZE}"
log "  Database: ${POSTGRES_SIZE}"

TOTAL_DOCKER=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "unknown")
log "  Total Docker: ${TOTAL_DOCKER}"

DISK_FREE=$(df -h / | awk 'NR==2{print $4}')
DISK_USED=$(df -h / | awk 'NR==2{print $5}')
log "  Disk free: ${DISK_FREE} (${DISK_USED} used)"

echo ""
log "Cleanup complete."
log "Auto-cleanup is handled by the server:"
log "  - Messages older than 180 days: auto-deleted"
log "  - Local media older than 180 days: auto-deleted"
log "  - Remote media older than 30 days: auto-deleted"
log "  - Forgotten rooms: deleted after 7 days"
log "  - Stale devices: removed after 90 days"
log "  - Docker logs: max 30MB per service"
echo ""
