#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" != 0 ]]; then
  echo "Run this one-time provisioning script as root." >&2
  exit 1
fi

REPOSITORY_ROOT="${STUDIO_REPOSITORY_ROOT:-/var/www/vhosts/openmanuscript.org/studio/repository}"
DOCUMENT_ROOT="${STUDIO_DOCUMENT_ROOT:-/var/www/vhosts/openmanuscript.org/studio/httpdocs}"
DOMAIN="studio.openmanuscript.org"
APP_DIR="$REPOSITORY_ROOT/demos/collaboration"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="/var/lib/omi-collaboration-demo"
ENV_FILE="/etc/omi-studio-collaboration-demo.env"
UNIT_FILE="/etc/systemd/system/omi-studio-collaboration-demo.service"
NGINX_FILE="/var/www/vhosts/system/$DOMAIN/conf/vhost_nginx.conf"
NODE_BIN="/opt/plesk/node/24/bin/node"
MARKER_BEGIN="# BEGIN OMI Studio collaboration demo managed block"
MARKER_END="# END OMI Studio collaboration demo managed block"

for required in "$APP_DIR/server.mjs" "$DOCUMENT_ROOT"; do
  if [[ ! -e "$required" ]]; then
    echo "Required deployment path is missing: $required" >&2
    exit 1
  fi
done
if [[ ! -x "$NODE_BIN" ]]; then
  echo "Node 24 executable is missing: $NODE_BIN" >&2
  exit 1
fi
command -v plesk >/dev/null
command -v nginx >/dev/null

SERVICE_USER="$(stat -c '%U' "$DOCUMENT_ROOT")"
SERVICE_GROUP="$(id -gn "$SERVICE_USER")"
if [[ -z "$SERVICE_USER" || "$SERVICE_USER" == root ]]; then
  echo "Could not determine the Plesk document owner." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  cat > "$ENV_FILE" <<EOF
DEMO_ACCESS_CODE=$(openssl rand -hex 18)
DEMO_TOKEN_SECRET=$(openssl rand -hex 32)
DEMO_HTTP_PORT=3020
DEMO_WS_PORT=3021
DEMO_WS_BIND=127.0.0.1
DEMO_ALLOWED_ORIGIN=https://$DOMAIN
DEMO_PUBLIC_WS_URL=wss://$DOMAIN/collaboration-demo/ws
DEMO_STORAGE_DIR=$DATA_DIR
EOF
  chown "$SERVICE_USER:$SERVICE_GROUP" "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
fi

install -d -o "$SERVICE_USER" -g "$SERVICE_GROUP" -m 0700 "$DATA_DIR"
unit_temp="$(mktemp)"
nginx_temp="$(mktemp)"
nginx_backup="$(mktemp)"
cleanup() { rm -f "$unit_temp" "$nginx_temp" "$nginx_backup"; }
trap cleanup EXIT

cat > "$unit_temp" <<EOF
[Unit]
Description=OMI Studio synthetic collaboration demo
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN server.mjs
Restart=on-failure
RestartSec=3
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF
install -o root -g root -m 0644 "$unit_temp" "$UNIT_FILE"
systemctl daemon-reload

install -d -o root -g root -m 0755 "$(dirname "$NGINX_FILE")"
if [[ -f "$NGINX_FILE" ]]; then
  cp -p "$NGINX_FILE" "$nginx_backup"
  has_begin=false
  has_end=false
  grep -Fq "$MARKER_BEGIN" "$nginx_backup" && has_begin=true || true
  grep -Fq "$MARKER_END" "$nginx_backup" && has_end=true || true
  if [[ "$has_begin" == true || "$has_end" == true ]]; then
    if [[ "$has_begin" != "$has_end" ]]; then
      echo "Found an incomplete managed block; refusing to edit Nginx configuration." >&2
      exit 1
    fi
    awk -v begin="$MARKER_BEGIN" -v end="$MARKER_END" -f "$SCRIPT_DIR/strip-managed-nginx-block.awk" "$nginx_backup" > "$nginx_temp"
  else
    cp "$nginx_backup" "$nginx_temp"
  fi
else
  : > "$nginx_temp"
fi

if grep -Eq '^[[:space:]]*location[[:space:]]+(\^~[[:space:]]+)?(/collaboration-demo/(api/|ws)|/collaboration/ws)([[:space:]]|$)' "$nginx_temp"; then
  echo "Found an unmanaged OMI collaboration location; refusing to create a duplicate. Remove or migrate that Plesk Nginx rule first." >&2
  exit 1
fi

cat >> "$nginx_temp" <<'NGINX'
# BEGIN OMI Studio collaboration demo managed block
location ^~ /collaboration-demo/api/ {
    proxy_pass http://127.0.0.1:3020/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ^~ /collaboration-demo/ws {
    proxy_pass http://127.0.0.1:3021;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location ^~ /collaboration/ws {
    proxy_pass http://127.0.0.1:3022;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
# END OMI Studio collaboration demo managed block
NGINX

install -o root -g root -m 0644 "$nginx_temp" "$NGINX_FILE"
if ! plesk sbin httpdmng --reconfigure-domain "$DOMAIN" -no-restart || ! nginx -t; then
  if [[ -s "$nginx_backup" ]]; then
    install -o root -g root -m 0644 "$nginx_backup" "$NGINX_FILE"
  else
    rm -f "$NGINX_FILE"
  fi
  plesk sbin httpdmng --reconfigure-domain "$DOMAIN" -no-restart || true
  nginx -t && systemctl reload nginx || true
  echo "Plesk rejected the proxy; the previous custom config was restored." >&2
  exit 1
fi
systemctl reload nginx
systemctl enable omi-studio-collaboration-demo.service >/dev/null

echo "Provisioned the isolated demo service for $DOMAIN."
echo "Secrets were created in $ENV_FILE and were not printed."
echo "The service starts when the deployment installs app dependencies and restarts it."
