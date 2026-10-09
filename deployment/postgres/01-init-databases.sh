#!/bin/sh
set -eu

psql --set=ON_ERROR_STOP=1 --username "omi_studio" --dbname "omi_studio" <<'SQL'
CREATE DATABASE omi_identity OWNER omi_studio;
SQL
