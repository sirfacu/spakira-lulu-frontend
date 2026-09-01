#!/usr/bin/env bash
# Panel Spa Kira — puerto 9000. API hermana en :9001.
# Uso: ./scripts/spakira-lulu-run.sh start|stop|status|restart
# Sin VITE_API_URL → el front apunta a http://<host>:9001 (src/lib/api.ts)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WS_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"
# shellcheck disable=SC1091
source "$WS_ROOT/scripts/lib/spakira-local-host.sh"
BACKEND_DIR="${SPA_KIRA_BACKEND_DIR:-$(cd "$PROJECT_DIR/../spakira-lulu-backend" 2>/dev/null && pwd || true)}"
FRONTEND_PID="$PROJECT_DIR/.spakira-lulu-frontend.pid"
FRONTEND_LOG="$PROJECT_DIR/spakira-lulu-frontend.log"
FE_PORT="${SPA_KIRA_PORT:-9000}"

cd "$PROJECT_DIR" || exit 1

running() {
  local pid_file="$1"
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

stop_one() {
  local name="$1" pid_file="$2" port="${3:-}"
  if [ -f "$pid_file" ]; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
    echo "$name detenido"
  else
    echo "$name: sin PID file"
  fi
  if [ -n "$port" ] && command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

start_frontend() {
  if running "$FRONTEND_PID"; then
    echo "Frontend ya corre (PID $(cat "$FRONTEND_PID")) → http://${SPA_KIRA_LOCAL_HOST}/"
    return 0
  fi
  if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    npm install
  fi
  if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$PROJECT_DIR/.env"
    set +a
  fi
  if [ -f "$PROJECT_DIR/local-secrets/vite-tunnel.env" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$PROJECT_DIR/local-secrets/vite-tunnel.env"
    set +a
  fi
  if [ -n "${VITE_API_URL:-}" ]; then
    echo "Iniciando frontend http://0.0.0.0:${FE_PORT}/ (VITE_API_URL=${VITE_API_URL}) ..."
  else
    echo "Iniciando frontend http://0.0.0.0:${FE_PORT}/ (API por defecto :9001) ..."
  fi
  nohup env ${VITE_API_URL:+VITE_API_URL="$VITE_API_URL"} npm run dev >>"$FRONTEND_LOG" 2>&1 &
  echo $! >"$FRONTEND_PID"
  sleep 2
  if running "$FRONTEND_PID"; then
    echo "Frontend OK 🚀 PID $(cat "$FRONTEND_PID")"
  else
    echo "Frontend no arrancó. Ver $FRONTEND_LOG" >&2
    rm -f "$FRONTEND_PID"
    return 1
  fi
}

restart_frontend() {
  stop_one Frontend "$FRONTEND_PID" "$FE_PORT"
  sleep 1
  start_frontend
}

status() {
  if running "$FRONTEND_PID"; then
    echo "Frontend: corriendo (PID $(cat "$FRONTEND_PID")) → http://${SPA_KIRA_LOCAL_HOST}/ (Vite :${FE_PORT})"
  else
    echo "Frontend: detenido"
  fi
}

case "${1:-}" in
  start) start_frontend; status ;;
  stop) stop_one Frontend "$FRONTEND_PID" "$FE_PORT"; echo "Frontend detenido 🛑" ;;
  status) status ;;
  restart) restart_frontend; status ;;
  frontend-restart) restart_frontend ;;
  *)
    echo "Uso: $0 start|stop|status|restart" >&2
    echo "Túnel (backup): ver ../spakira-lulu-backend/scripts/tunnel-backup.sh" >&2
    exit 1
    ;;
esac
