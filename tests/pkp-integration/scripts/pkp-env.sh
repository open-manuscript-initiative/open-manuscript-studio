#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPOSITORY_DIR="$(cd "$ENV_DIR/../.." && pwd)"
COMPOSE_FILE="$ENV_DIR/compose.yml"
RUNTIME_DIR="$ENV_DIR/runtime"
PLUGIN_DIR="$RUNTIME_DIR/plugin"
LOG_DIR="$RUNTIME_DIR/logs"

usage() {
  cat <<'USAGE'
Usage: pkp-env.sh <prepare|config|up|verify|test|logs|down> [ojs|omp]

  prepare  Clone the matching OMI plugin when runtime/plugin is absent.
  config   Validate and render the Docker Compose configuration.
  up       Build, start and install the selected PKP application and plugin.
  verify   Check health, plugin loading and PKP <-> Studio connectivity.
  test     Run the Playwright environment smoke suite.
  logs     Save Compose status and logs under runtime/logs.
  down     Stop the environment and delete its ephemeral test volumes.
USAGE
}

fail() {
  printf 'PKP integration environment: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

ACTION="${1:-}"
PLATFORM="${2:-${PKP_PLATFORM:-ojs}}"

case "$ACTION" in
  prepare|config|up|verify|test|logs|down) ;;
  -h|--help|help|'')
    usage
    exit 0
    ;;
  *)
    usage >&2
    fail "unknown action: $ACTION"
    ;;
esac

case "$PLATFORM" in
  ojs)
    PLUGIN_REPOSITORY="https://github.com/open-manuscript-initiative/omi-ojs-plugin.git"
    ;;
  omp)
    PLUGIN_REPOSITORY="https://github.com/open-manuscript-initiative/omi-omp-plugin.git"
    ;;
  *)
    fail "platform must be 'ojs' or 'omp', received: $PLATFORM"
    ;;
esac

export PKP_PLATFORM="$PLATFORM"
export PKP_VERSION="${PKP_VERSION:-3_5_0-4}"
export PKP_HTTP_PORT="${PKP_HTTP_PORT:-8080}"
export STUDIO_API_HTTP_PORT="${STUDIO_API_HTTP_PORT:-3001}"
export COMPOSE_PROJECT_NAME="${PKP_COMPOSE_PROJECT_NAME:-omi-pkp-$PLATFORM}"

compose() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --project-directory "$ENV_DIR" \
    --file "$COMPOSE_FILE" \
    "$@"
}

prepare_plugin() {
  require_command git
  mkdir -p "$RUNTIME_DIR"

  if [[ -f "$PLUGIN_DIR/version.xml" && -f "$PLUGIN_DIR/StudioIntegrationPlugin.php" ]]; then
    if grep -R -F -q "omi-integration/1/$PLATFORM" "$PLUGIN_DIR"; then
      printf 'Using existing %s plugin source at %s.\n' "$PLATFORM" "$PLUGIN_DIR" >&2
      return
    fi
    fail "$PLUGIN_DIR contains a plugin for a different PKP platform"
  fi

  if [[ -e "$PLUGIN_DIR" ]]; then
    fail "$PLUGIN_DIR exists but is not a valid studioIntegration plugin checkout"
  fi

  git clone \
    --depth 1 \
    --branch "${PKP_PLUGIN_REF:-main}" \
    "$PLUGIN_REPOSITORY" \
    "$PLUGIN_DIR"
}

is_pkp_installed() {
  compose exec -T pkp sh -c \
    "grep -Eq '^[[:space:]]*installed[[:space:]]*=[[:space:]]*On' /var/www/html/config.inc.php" \
    >/dev/null 2>&1
}

install_pkp() {
  if is_pkp_installed; then
    printf '%s %s is already installed.\n' "${PLATFORM^^}" "$PKP_VERSION"
    return
  fi

  mkdir -p "$LOG_DIR"
  printf 'Installing %s %s with the native PKP CLI installer...\n' "${PLATFORM^^}" "$PKP_VERSION"

  {
    printf '\n'
    printf '\n'
    printf '/var/www/files\n'
    printf '%s\n' "${PKP_ADMIN_USERNAME:-omiadmin}"
    printf '%s\n' "${PKP_ADMIN_PASSWORD:-omi-test-admin}"
    printf '%s\n' "${PKP_ADMIN_PASSWORD:-omi-test-admin}"
    printf '%s\n' "${PKP_ADMIN_EMAIL:-admin@example.test}"
    printf 'mariadb\n'
    printf 'pkp-db\n'
    printf 'pkp\n'
    printf 'omi_pkp_test_only\n'
    printf 'pkp\n'
    printf 'omi-%s-integration-test\n' "$PLATFORM"
    printf 'n\n'
    printf 'y\n'
  } | compose exec -T pkp php tools/install.php 2>&1 | tee "$LOG_DIR/pkp-install.log"

  is_pkp_installed || fail "PKP CLI installation did not set installed = On"
}

install_plugin_descriptor() {
  printf 'Registering the studioIntegration plugin descriptor...\n'
  compose exec -T pkp php \
    lib/pkp/tools/installPluginVersion.php \
    plugins/generic/studioIntegration/version.xml \
    2>&1 | tee "$LOG_DIR/plugin-install.log"
}

wait_for_services() {
  require_command node
  node "$SCRIPT_DIR/wait-for-http.mjs" \
    "http://127.0.0.1:$STUDIO_API_HTTP_PORT/api/health" \
    240000
  node "$SCRIPT_DIR/wait-for-http.mjs" \
    "http://127.0.0.1:$PKP_HTTP_PORT/index/install" \
    240000
}

verify_environment() {
  require_command node

  node "$SCRIPT_DIR/wait-for-http.mjs" \
    "http://127.0.0.1:$STUDIO_API_HTTP_PORT/api/health" \
    120000
  node "$SCRIPT_DIR/wait-for-http.mjs" \
    "http://127.0.0.1:$PKP_HTTP_PORT/" \
    120000

  is_pkp_installed || fail "PKP is not installed"

  compose exec -T pkp sh -c \
    "grep -R -F -q 'omi-integration/1/$PLATFORM' /var/www/html/plugins/generic/studioIntegration"

  compose exec -T pkp php -r '
    require "tools/bootstrap.php";
    $versionDao = \PKP\db\DAORegistry::getDAO("VersionDAO");
    $version = $versionDao->getCurrentVersion("plugins.generic", "studioIntegration");
    if (!$version) {
        fwrite(STDERR, "studioIntegration plugin descriptor is not registered\n");
        exit(1);
    }
    $plugins = \PKP\plugins\PluginRegistry::loadCategory("generic", false);
    foreach ($plugins as $plugin) {
        if ($plugin instanceof \APP\plugins\generic\studioIntegration\StudioIntegrationPlugin) {
            fwrite(STDOUT, "studioIntegration plugin loaded\n");
            exit(0);
        }
    }
    fwrite(STDERR, "studioIntegration plugin did not load\n");
    exit(1);
  '

  compose exec -T pkp sh -c \
    "curl -fsS http://studio-api:3001/api/health | grep -F -q '\"status\":\"ok\"'"

  compose exec -T studio-api node -e \
    "fetch('http://pkp/').then(response=>{if(response.status>=500)process.exit(1);console.log('Studio reached PKP with HTTP '+response.status)}).catch(error=>{console.error(error);process.exit(1)})"

  compose exec -T studio-api node -e \
    "require('node:dns').lookup('pkp-db',error=>process.exit(error?0:1))"

  compose exec -T pkp php -r \
    'exit(gethostbyname("studio-db") === "studio-db" ? 0 : 1);'

  printf '%s integration environment is healthy.\n' "${PLATFORM^^}"
}

collect_logs() {
  require_command docker
  mkdir -p "$LOG_DIR"
  compose ps --all > "$LOG_DIR/compose-ps.txt" 2>&1 || true
  compose logs --no-color --timestamps > "$LOG_DIR/compose.log" 2>&1 || true
  printf 'Diagnostics saved to %s.\n' "$LOG_DIR"
}

case "$ACTION" in
  prepare)
    prepare_plugin
    ;;
  config)
    require_command docker
    prepare_plugin
    compose config --quiet
    compose config
    ;;
  up)
    require_command docker
    prepare_plugin
    mkdir -p "$LOG_DIR"
    compose up --detach --build
    wait_for_services
    install_pkp
    install_plugin_descriptor
    ;;
  verify)
    require_command docker
    verify_environment
    ;;
  test)
    require_command node
    cd "$REPOSITORY_DIR"
    PKP_BASE_URL="http://127.0.0.1:$PKP_HTTP_PORT" \
      STUDIO_API_BASE_URL="http://127.0.0.1:$STUDIO_API_HTTP_PORT" \
      PKP_PLATFORM="$PLATFORM" \
      npx playwright test --config=playwright.pkp.config.ts
    ;;
  logs)
    collect_logs
    ;;
  down)
    require_command docker
    compose down --volumes --remove-orphans
    ;;
esac
