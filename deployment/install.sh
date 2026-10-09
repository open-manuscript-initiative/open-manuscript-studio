#!/bin/sh
set -eu

cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Install Docker Engine and the Compose plugin first." >&2
  exit 1
}
docker compose version >/dev/null

if [ ! -f .env ]; then
  cp .env.example .env
fi

if grep -q '^POSTGRES_PASSWORD=GENERATE_ON_INSTALL$' .env; then
  db_password="$(openssl rand -hex 32)"
  sed -i "s/^POSTGRES_PASSWORD=GENERATE_ON_INSTALL$/POSTGRES_PASSWORD=$db_password/" .env
fi

if grep -q '^INTEGRATION_MASTER_KEY=GENERATE_ON_INSTALL$' .env; then
  master_key="$(openssl rand -hex 32)"
  sed -i "s/^INTEGRATION_MASTER_KEY=GENERATE_ON_INSTALL$/INTEGRATION_MASTER_KEY=$master_key/" .env
fi

chmod 600 .env

if [ ! -f msmtprc ]; then
  cp msmtprc.example msmtprc
  chmod 600 msmtprc
  if [ "$(id -u)" -eq 0 ]; then
    chown 1000:1000 msmtprc
  fi
  echo "Created msmtprc. Edit it with your SMTP relay settings before relying on invitations or password reset e-mail."
fi

docker compose -f compose.yml up --build -d
docker compose -f compose.yml ps
