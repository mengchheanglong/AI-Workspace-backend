#!/usr/bin/env bash
# ==============================================================================
# AI Workspace - Oracle Cloud Always Free Automated Setup Script
# ==============================================================================
# Compatible with: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (x86_64 & ARM64 Ampere A1)
# ==============================================================================

set -euo pipefail

# Text styling
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

banner() {
    echo -e "${BOLD}${BLUE}"
    echo "=================================================================="
    echo "       AI Workspace - Automated Oracle Cloud Deployment          "
    echo "=================================================================="
    echo -e "${NC}"
}

# Ensure script is run with sudo access available
if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root user. It is recommended to run as 'ubuntu' or 'opc' with sudo."
fi

banner

# 1. Architecture & System Detection
ARCH=$(uname -m)
log_info "Detected Architecture: ${BOLD}${ARCH}${NC}"
if [ "$ARCH" = "aarch64" ]; then
    log_info "Running on Oracle Cloud Ampere A1 (ARM64) - Optimal Free Tier configuration."
elif [ "$ARCH" = "x86_64" ]; then
    log_info "Running on x86_64 architecture."
fi

# 2. Swap Memory Setup (Prevent OOM during container builds)
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ -z "$SWAP_TOTAL" ] || [ "$SWAP_TOTAL" -lt 2000 ]; then
    log_info "Setting up 2GB swap file to guarantee stable Next.js builds..."
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        if ! grep -q '/swapfile' /etc/fstab; then
            echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
        fi
        log_success "2GB swap memory configured successfully."
    else
        sudo swapon /swapfile 2>/dev/null || true
    fi
else
    log_info "Swap memory already configured (${SWAP_TOTAL} MB)."
fi

# 3. Configure OS Firewall (Crucial for Oracle Cloud instances)
log_info "Configuring OS firewall rules for ports 80 (HTTP) and 443 (HTTPS)..."
sudo iptables -I INPUT 1 -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 2 -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 3 -p tcp --dport 443 -j ACCEPT 2>/dev/null || true

# Install iptables-persistent non-interactively if missing to persist rules across reboots
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq iptables-persistent netfilter-persistent > /dev/null 2>&1 || true
sudo netfilter-persistent save > /dev/null 2>&1 || true

if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 22/tcp >/dev/null 2>&1 || true
    sudo ufw allow 80/tcp >/dev/null 2>&1 || true
    sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi
log_success "OS firewall configured for ports 22, 80, and 443."

# 4. Install Docker & Docker Compose if missing
if ! command -v docker >/dev/null 2>&1; then
    log_info "Installing Docker Engine and Docker Compose plugin..."
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release > /dev/null
    sudo install -m 0755 -d /etc/apt/keyrings
    if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
    fi
    UBUNTU_CODENAME=$(lsb_release -cs)
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    log_success "Docker Engine installed successfully."
else
    log_info "Docker is already installed."
fi

# 5. Workspace Directory Setup
INSTALL_DIR="/opt/ai-workspace"
log_info "Setting up deployment directory at ${BOLD}${INSTALL_DIR}${NC}..."
sudo mkdir -p "${INSTALL_DIR}"
sudo chown -R "$USER":"$USER" "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# 6. Clone or Update Repositories
BACKEND_REPO="https://github.com/mengchheanglong/AI-Workspace-backend.git"
FRONTEND_REPO="https://github.com/mengchheanglong/ai-workspace-frontend.git"

if [ ! -d "${INSTALL_DIR}/backend" ]; then
    log_info "Cloning backend repository..."
    git clone "${BACKEND_REPO}" "${INSTALL_DIR}/backend"
else
    log_info "Updating backend repository..."
    git -C "${INSTALL_DIR}/backend" pull origin main || true
fi

if [ ! -d "${INSTALL_DIR}/frontend" ]; then
    log_info "Cloning frontend repository..."
    git clone "${FRONTEND_REPO}" "${INSTALL_DIR}/frontend"
else
    log_info "Updating frontend repository..."
    git -C "${INSTALL_DIR}/frontend" pull origin main || true
fi

# Copy deployment definitions
cp "${INSTALL_DIR}/backend/deploy/docker-compose.prod.yml" "${INSTALL_DIR}/docker-compose.prod.yml"
cp "${INSTALL_DIR}/backend/deploy/Caddyfile" "${INSTALL_DIR}/Caddyfile"

# 7. Environment Configuration
PUBLIC_IP=$(curl -s -m 5 https://ifconfig.me || curl -s -m 5 https://api.ipify.org || echo "127.0.0.1")

if [ ! -f "${INSTALL_DIR}/.env.production" ]; then
    log_info "Creating new production configuration..."
    
    CUSTOM_DOMAIN=""
    if [ -t 0 ]; then
        echo ""
        echo -e "${YELLOW}Do you have a custom domain name pointing to this server's IP (${PUBLIC_IP})?${NC}"
        echo -n "Enter domain (e.g. workspace.example.com) or press ENTER to use Public IP: "
        read -r CUSTOM_DOMAIN
    fi

    # Database choice (Supabase vs local Docker)
    DB_CHOICE="2"
    SUPABASE_URL_INPUT=""
    if [ -t 0 ]; then
        echo ""
        echo -e "${YELLOW}Which PostgreSQL database would you like to use?${NC}"
        echo "  1) Supabase (Cloud Managed PostgreSQL + pgvector)"
        echo "  2) Built-in Docker PostgreSQL (Self-hosted on this VM)"
        echo -n "Select option [1 or 2, default 2]: "
        read -r DB_CHOICE
    fi

    if [ "$DB_CHOICE" = "1" ]; then
        log_info "Using Supabase for PostgreSQL database."
        if [ -t 0 ]; then
            echo -e "${YELLOW}Enter your Supabase Session Pooler connection string:${NC}"
            echo "Format: postgresql://postgres.yfwjdjlrqvykxzsvfpwj:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
            echo -n "DATABASE_URL: "
            read -r SUPABASE_URL_INPUT
        fi
        DATABASE_URL="${SUPABASE_URL_INPUT}"
        POSTGRES_USER="postgres"
        POSTGRES_PWD=""
        POSTGRES_DB="postgres"
        # Use Supabase compose manifest (without local postgres container)
        cp "${INSTALL_DIR}/backend/deploy/docker-compose.supabase.yml" "${INSTALL_DIR}/docker-compose.prod.yml"
    else
        log_info "Using built-in Docker PostgreSQL with pgvector."
        DATABASE_URL="postgresql://ai_workspace:${POSTGRES_PWD}@postgres:5432/ai_workspace"
        POSTGRES_USER="ai_workspace"
        POSTGRES_DB="ai_workspace"
        cp "${INSTALL_DIR}/backend/deploy/docker-compose.prod.yml" "${INSTALL_DIR}/docker-compose.prod.yml"
    fi

    cat <<EOF > "${INSTALL_DIR}/.env.production"
# Production Environment Configuration
APP_ORIGIN=${APP_ORIGIN}
DOMAIN=${DOMAIN}

NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PWD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=${DATABASE_URL}

# Redis (Built-in Docker Redis)
REDIS_URL=redis://redis:6379

# Storage
STORAGE_DRIVER=local
STORAGE_LOCAL_ROOT=/app/var/uploads
MAX_UPLOAD_BYTES=20971520

# Sessions
SESSION_IDLE_HOURS=8
SESSION_ABSOLUTE_DAYS=7

# Initial Admin Bootstrap
INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}
INITIAL_ADMIN_PASSWORD=${ADMIN_PWD}

# Swagger API Docs
SWAGGER_ENABLED=true

# AI Capabilities (Core workspace works without AI keys)
AI_ENABLED=false
AI_LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
AI_CHAT_MODEL=deepseek-v4-pro

AI_EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_EMBEDDING_BASE_URL=https://api.openai.com/v1
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=1536
AI_DAILY_PROJECT_BUDGET_USD=10

GITHUB_ENABLED=false
GITHUB_USE_MOCK=false

NEXT_PUBLIC_API_URL=/api/v1
BACKEND_INTERNAL_URL=http://backend:3000
EOF

    chmod 600 "${INSTALL_DIR}/.env.production"
    log_success "Generated secure .env.production configuration."
else
    log_info "Using existing .env.production configuration."
    ADMIN_EMAIL=$(grep '^INITIAL_ADMIN_EMAIL=' "${INSTALL_DIR}/.env.production" | cut -d '=' -f2- || echo "admin@aiworkspace.local")
    ADMIN_PWD="[Existing Password in .env.production]"
    APP_ORIGIN=$(grep '^APP_ORIGIN=' "${INSTALL_DIR}/.env.production" | cut -d '=' -f2- || echo "http://${PUBLIC_IP}")
fi

# 8. Build & Start Stack
log_info "Building and starting production containers..."
sudo docker compose -f "${INSTALL_DIR}/docker-compose.prod.yml" up -d --build

# 9. Health Verification
log_info "Waiting for services to become healthy..."
sleep 8
for i in {1..12}; do
    if sudo docker compose -f "${INSTALL_DIR}/docker-compose.prod.yml" ps | grep -q "healthy"; then
        log_success "Services are operational!"
        break
    fi
    echo -n "."
    sleep 3
done
echo ""

# 10. Summary Banner
echo -e "${BOLD}${GREEN}"
echo "=================================================================="
echo "          🎉 AI WORKSPACE DEPLOYED SUCCESSFULLY! 🎉              "
echo "=================================================================="
echo -e "${NC}"
echo -e "${BOLD}Access URL:${NC}           ${BLUE}${APP_ORIGIN}${NC}"
echo -e "${BOLD}Admin Email:${NC}          ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e "${BOLD}Admin Password:${NC}       ${YELLOW}${ADMIN_PWD}${NC}"
echo -e "${BOLD}Swagger Documentation:${NC}${BLUE}${APP_ORIGIN}/api/docs${NC}"
echo ""
echo -e "${BOLD}Important Notes:${NC}"
echo "1. Remember to add Ingress Rules for Ports 80 and 443 in your Oracle Cloud VCN Security List."
echo "2. View container logs anytime with:"
echo "   sudo docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml logs -f"
echo "3. To add AI keys or edit configuration:"
echo "   nano ${INSTALL_DIR}/.env.production"
echo "   sudo docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml restart backend"
echo ""
