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

docker compose -f compose.yml pull
docker compose -f compose.yml up -d
docker compose -f compose.yml ps

if [ -t 0 ]; then
  printf "List this Studio instance in the public OMI server directory? [y/N] "
  read -r registry_opt_in
  case "$registry_opt_in" in
    y|Y|yes|YES)
      printf "Public server name: "
      read -r registry_name
      printf "Public HTTPS origin (for example https://studio.example.org): "
      read -r registry_origin
      echo ""
      echo "The installer will request a pending directory listing."
      echo "The next output shows the exact DNS TXT type, host name, and value to enter."
      echo "The private registration token must stay in the server environment and must never go in DNS."
      echo ""
      if ! docker compose -f compose.yml exec api npm run server:register -- --name "$registry_name" --origin "$registry_origin"; then
        echo "Directory registration could not be completed now. The Studio installation is running; you can retry registration later."
      fi
      ;;
  esac
fi
