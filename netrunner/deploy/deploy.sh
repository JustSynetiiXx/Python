#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# NETRUNNER Deploy Script
# Run as root on your Ubuntu VPS:  sudo bash deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-}"
PASSWORD="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$PASSWORD" ]; then
    echo "Usage: sudo bash deploy.sh <domain> <password>"
    echo "Example: sudo bash deploy.sh netrunner.example.de mein-geheimes-passwort"
    exit 1
fi

JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")

echo "══════════════════════════════════════════"
echo "  NETRUNNER DEPLOYMENT"
echo "  Domain:   $DOMAIN"
echo "══════════════════════════════════════════"

# ── 1. System dependencies ──
echo ""
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx certbot python3-certbot-nginx > /dev/null

# ── 2. Create netrunner user ──
echo "[2/7] Setting up netrunner user..."
if ! id "netrunner" &>/dev/null; then
    useradd --system --create-home --shell /usr/sbin/nologin netrunner
    echo "  Created user 'netrunner'"
else
    echo "  User 'netrunner' already exists"
fi

# ── 3. Copy project files ──
echo "[3/7] Copying project files to /opt/netrunner/..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p /opt/netrunner
# Copy backend
rsync -a --delete "$PROJECT_DIR/backend/" /opt/netrunner/backend/
# Copy frontend dist
mkdir -p /opt/netrunner/frontend
rsync -a --delete "$PROJECT_DIR/frontend/dist/" /opt/netrunner/frontend/dist/

chown -R netrunner:netrunner /opt/netrunner

# ── 4. Python venv + dependencies ──
echo "[4/7] Setting up Python virtual environment..."
if [ ! -d /opt/netrunner/venv ]; then
    python3 -m venv /opt/netrunner/venv
fi
/opt/netrunner/venv/bin/pip install -q --upgrade pip
/opt/netrunner/venv/bin/pip install -q -r /opt/netrunner/backend/requirements.txt
chown -R netrunner:netrunner /opt/netrunner/venv

# ── 5. Systemd service ──
echo "[5/7] Configuring systemd service..."
# Write service file with actual values
cat > /etc/systemd/system/netrunner.service << SERVICEEOF
[Unit]
Description=NETRUNNER Backend
After=network.target

[Service]
Type=simple
User=netrunner
Group=netrunner
WorkingDirectory=/opt/netrunner/backend

Environment=NETRUNNER_PASSWORD=${PASSWORD}
Environment=NETRUNNER_JWT_SECRET=${JWT_SECRET}

ExecStart=/opt/netrunner/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=netrunner

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/netrunner/backend

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable netrunner
systemctl restart netrunner

echo "  Service started. Status:"
systemctl --no-pager status netrunner || true

# ── 6. Nginx configuration ──
echo ""
echo "[6/7] Configuring nginx..."
# Write nginx config with actual domain
sed "s/YOUR_DOMAIN/${DOMAIN}/g" "$SCRIPT_DIR/nginx.conf" > /etc/nginx/sites-available/netrunner

# Enable site
ln -sf /etc/nginx/sites-available/netrunner /etc/nginx/sites-enabled/netrunner

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx

# ── 7. Done ──
echo ""
echo "[7/7] SSL Certificate..."
echo ""
echo "══════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "══════════════════════════════════════════"
echo ""
echo "  Backend:  running on :8000"
echo "  Frontend: /opt/netrunner/frontend/dist"
echo "  Nginx:    configured for $DOMAIN"
echo ""
echo "  NEXT STEP — Run certbot for HTTPS:"
echo ""
echo "    sudo certbot --nginx -d $DOMAIN"
echo ""
echo "  After that, open https://$DOMAIN"
echo ""
echo "  Useful commands:"
echo "    journalctl -u netrunner -f    # Backend logs"
echo "    systemctl restart netrunner   # Restart backend"
echo "    nginx -t && systemctl reload nginx  # Reload nginx"
echo ""
echo "  JWT Secret (saved in service file):"
echo "    $JWT_SECRET"
echo ""
