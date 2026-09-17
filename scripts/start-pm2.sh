#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-web}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

WEB_NAME="${PM2_WEB_NAME:-railway-sign-web}"
TELEMETRY_NAME="${PM2_TELEMETRY_NAME:-railway-sign-telemetry}"
API_NAME="${PM2_API_NAME:-railway-sign-api}"
VOICE_NAME="${PM2_VOICE_NAME:-railway-sign-voice}"
WEB_HOST="${WEB_HOST:-0.0.0.0}"
WEB_PORT="${WEB_PORT:-4028}"
TELEMETRY_PORT="${TELEMETRY_PORT:-8036}"
API_PORT="${API_PORT:-8037}"
VOICE_PORT="${VOICE_PORT:-8039}"

cd "${PROJECT_ROOT}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

usage() {
  cat <<'EOF'
Usage: ./scripts/start-pm2.sh [all|web|api|voice|telemetry]

Default mode:
  web         Build and start only the web preview service.

Modes:
  all         Build and start web preview, unified API, voice sidecar and telemetry bridge.
  web         Build and start only the web preview service.
  api         Start only the unified API (auth + admin + AI + telemetry ingest).
  voice       Start only the local voice sidecar (ASR + TTS, Python).
  telemetry   Start only the telemetry bridge.

Environment variables:
  PM2_WEB_NAME        PM2 process name for the web service. Default: railway-sign-web
  PM2_TELEMETRY_NAME  PM2 process name for the telemetry service. Default: railway-sign-telemetry
  PM2_API_NAME        PM2 process name for the unified API. Default: railway-sign-api
  PM2_VOICE_NAME      PM2 process name for the voice sidecar. Default: railway-sign-voice
  WEB_HOST            Host used by vite preview. Default: 0.0.0.0
  WEB_PORT            Port used by vite preview. Default: 4028
  TELEMETRY_PORT      Port used by telemetry bridge. Default: 8036
  API_PORT            Port used by the unified API. Default: 8037
  VOICE_PORT          Port used by the voice sidecar. Default: 8039
  API_JWT_SECRET      JWT signing key. Default: auto-generated into .data/secret
  API_INGEST_TOKEN    Shared secret for telemetry ingest. Default: railway-sign-ingest
EOF
}

require_command() {
  local cmd="$1"
  if ! command_exists "${cmd}"; then
    echo "Error: '${cmd}' is required but was not found in PATH." >&2
    exit 1
  fi
}

port_in_use() {
  local port="$1"

  if command_exists lsof; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi

  if command_exists ss; then
    ss -ltn 2>/dev/null | awk 'NR > 1 { print $4 }' | grep -Eq "[:.]${port}$"
    return
  fi

  if command_exists netstat; then
    netstat -ltn 2>/dev/null | awk 'NR > 2 { print $4 }' | grep -Eq "[:.]${port}$"
    return
  fi

  echo "Error: no port inspection tool found. Install lsof, ss, or netstat." >&2
  exit 1
}

show_port_usage() {
  local port="$1"

  if command_exists lsof; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN || true
    return
  fi

  if command_exists ss; then
    ss -ltnp 2>/dev/null | grep -E "[:.]${port}[[:space:]]" || true
    return
  fi

  if command_exists netstat; then
    netstat -ltnp 2>/dev/null | grep -E "[:.]${port}[[:space:]]" || true
  fi
}

ensure_port_free() {
  local port="$1"
  local service_name="$2"

  if port_in_use "${port}"; then
    echo "Error: port ${port} is already in use, cannot start ${service_name}." >&2
    show_port_usage "${port}" >&2 || true
    exit 1
  fi
}

delete_pm2_process_if_exists() {
  local service_name="$1"

  if pm2 describe "${service_name}" >/dev/null 2>&1; then
    echo "Recreating PM2 process: ${service_name}"
    pm2 delete "${service_name}" >/dev/null
  fi
}

start_web() {
  echo "Building frontend bundle..."
  npm run build

  delete_pm2_process_if_exists "${WEB_NAME}"
  ensure_port_free "${WEB_PORT}" "${WEB_NAME}"

  echo "Starting web service: ${WEB_NAME} (host=${WEB_HOST}, port=${WEB_PORT})"
  NODE_ENV=production pm2 start npm \
    --name "${WEB_NAME}" \
    --cwd "${PROJECT_ROOT}" \
    -- run preview -- --host "${WEB_HOST}" --port "${WEB_PORT}"
}

start_telemetry() {
  delete_pm2_process_if_exists "${TELEMETRY_NAME}"
  ensure_port_free "${TELEMETRY_PORT}" "${TELEMETRY_NAME}"

  echo "Starting telemetry service: ${TELEMETRY_NAME} (port=${TELEMETRY_PORT})"
  NODE_ENV=production TELEMETRY_PORT="${TELEMETRY_PORT}" pm2 start npm \
    --name "${TELEMETRY_NAME}" \
    --cwd "${PROJECT_ROOT}" \
    -- run telemetry
}

start_api() {
  delete_pm2_process_if_exists "${API_NAME}"
  ensure_port_free "${API_PORT}" "${API_NAME}"

  echo "Starting unified API: ${API_NAME} (port=${API_PORT})"
  NODE_ENV=production API_PORT="${API_PORT}" API_INGEST_TOKEN="${API_INGEST_TOKEN:-railway-sign-ingest}" \
    pm2 start npm \
      --name "${API_NAME}" \
      --cwd "${PROJECT_ROOT}" \
      -- run api
}

start_voice() {
  delete_pm2_process_if_exists "${VOICE_NAME}"
  ensure_port_free "${VOICE_PORT}" "${VOICE_NAME}"

  echo "Starting voice sidecar: ${VOICE_NAME} (port=${VOICE_PORT})"
  NODE_ENV=production VOICE_PORT="${VOICE_PORT}" pm2 start npm \
    --name "${VOICE_NAME}" \
    --cwd "${PROJECT_ROOT}" \
    -- run voice
}

require_command npm
require_command pm2

case "${MODE}" in
  all)
    start_voice
    start_telemetry
    start_api
    start_web
    ;;
  web)
    start_web
    ;;
  api)
    start_api
    ;;
  voice)
    start_voice
    ;;
  telemetry)
    start_telemetry
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Error: unsupported mode '${MODE}'." >&2
    usage >&2
    exit 1
    ;;
esac

pm2 save >/dev/null

echo
echo "PM2 process status:"
pm2 list
