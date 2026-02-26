#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# FlowBoard AI Service - One-click Deploy
# Usage: bash deploy.sh
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_PROD_FILE="${SCRIPT_DIR}/.env.production"

echo "========================================"
echo "  FlowBoard AI Service Deploy"
echo "========================================"

# --- 1. Check Docker ---
if ! command -v docker &>/dev/null; then
    echo "[1/5] Docker not found, installing..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "  Docker installed."
else
    echo "[1/5] Docker found: $(docker --version)"
fi

# --- 2. Check Docker Compose ---
if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "[2/5] Docker Compose not found, installing plugin..."
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    COMPOSE_CMD="docker compose"
    echo "  Docker Compose installed."
fi
echo "[2/5] Compose: ${COMPOSE_CMD}"

# --- 3. Generate .env if missing ---
if [ ! -f "$ENV_FILE" ]; then
    echo "[3/5] Creating .env from .env.production template..."
    cp "$ENV_PROD_FILE" "$ENV_FILE"

    # Generate random tokens
    SECRET_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    API_TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    PG_PASS=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)
    REDIS_PASS=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)

    sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET_KEY}|" "$ENV_FILE"
    sed -i "s|^API_TOKEN=.*|API_TOKEN=${API_TOKEN}|" "$ENV_FILE"
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" "$ENV_FILE"
    sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASS}|" "$ENV_FILE"
    # Update DATABASE_URL and REDIS_URL with new passwords
    sed -i "s|flowboard_secret_2026|${PG_PASS}|g" "$ENV_FILE"
    sed -i "s|flowboard_redis_2026|${REDIS_PASS}|g" "$ENV_FILE"

    echo ""
    echo "  ============================================"
    echo "  IMPORTANT: Your API Token (save this!):"
    echo "  ${API_TOKEN}"
    echo "  ============================================"
    echo ""
    echo "  Enter this token in FlowBoard Settings > AI > API Token"
    echo ""
else
    echo "[3/5] .env already exists, skipping generation."
    API_TOKEN=$(grep '^API_TOKEN=' "$ENV_FILE" | cut -d'=' -f2)
fi

# --- 4. Build and start ---
echo "[4/5] Building and starting services..."
cd "$SCRIPT_DIR"
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
$COMPOSE_CMD up -d --build

echo "[5/5] Waiting for services to be healthy..."
sleep 5

# Health check with retries
for i in 1 2 3 4 5; do
    if curl -sf http://localhost:8000/api/v1/health >/dev/null 2>&1; then
        echo ""
        echo "========================================"
        echo "  Deploy SUCCESS!"
        echo "========================================"
        echo ""
        echo "  Service URL : http://$(hostname -I | awk '{print $1}'):8000"
        echo "  Health check: http://$(hostname -I | awk '{print $1}'):8000/api/v1/health"
        echo "  API Docs    : http://$(hostname -I | awk '{print $1}'):8000/api/v1/docs"
        echo "  API Token   : ${API_TOKEN}"
        echo ""
        echo "  In FlowBoard Settings > AI:"
        echo "    Service URL = http://$(hostname -I | awk '{print $1}'):8000"
        echo "    API Token   = ${API_TOKEN}"
        echo ""
        echo "  Make sure port 8000 is open in your firewall/security group."
        echo "========================================"
        exit 0
    fi
    echo "  Attempt ${i}/5: service not ready, waiting 5s..."
    sleep 5
done

echo ""
echo "WARNING: Service may not be fully ready yet."
echo "Check logs with: cd ${SCRIPT_DIR} && ${COMPOSE_CMD} logs -f"
