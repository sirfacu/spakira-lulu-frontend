#!/usr/bin/env bash
# BACKUP — túnel Cloudflare (trycloudflare). No forma parte del flujo diario.
# Uso (con back + front hermanos levantados o los arranca este script):
#   ./scripts/tunnel-backup.sh start|stop|status
#
# Genera local-secrets/vite-tunnel.env y reinicia front con VITE_API_URL del túnel.
# Recordá agregar las URLs en Google OAuth (JS origins + redirect).

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${SPA_KIRA_FRONTEND_DIR:-$(cd "$PROJECT_DIR/../spakira-lulu-frontend" 2>/dev/null && pwd || true)}"
TUNNEL_FE_PID="$PROJECT_DIR/.spakira-lulu-tunnel-fe.pid"
TUNNEL_BE_PID="$PROJECT_DIR/.spakira-lulu-tunnel-be.pid"
TUNNEL_FE_LOG="$PROJECT_DIR/spakira-lulu-tunnel-fe.log"
TUNNEL_BE_LOG="$PROJECT_DIR/spakira-lulu-tunnel-be.log"
TUNNEL_ENV="$PROJECT_DIR/local-secrets/vite-tunnel.env"
# Copia también al front para que su Vite lea VITE_API_URL
TUNNEL_ENV_FRONT="${FRONTEND_DIR:+$FRONTEND_DIR/local-secrets/vite-tunnel.env}"
CLOUDFLARED_BIN="${CLOUDFLARED:-}"
FE_PORT="${SPA_KIRA_PORT:-9000}"
BE_PORT="${SPA_KIRA_API_PORT:-9001}"

cd "$PROJECT_DIR" || exit 1

running() {
  local pid_file="$1"
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

stop_one() {
  local name="$1" pid_file="$2"
  if [ -f "$pid_file" ]; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
    echo "$name detenido"
  fi
}

wait_trycloudflare_url() {
  local log="$1" i url
  for i in $(seq 1 50); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" 2>/dev/null | tail -1 || true)"
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
    sleep 0.4
  done
  return 1
}

ensure_cloudflared() {
  local dest="$PROJECT_DIR/local-secrets/bin/cloudflared"
  if [ -n "$CLOUDFLARED_BIN" ] && [ -x "$CLOUDFLARED_BIN" ]; then
    return 0
  fi
  if command -v cloudflared >/dev/null 2>&1; then
    CLOUDFLARED_BIN="$(command -v cloudflared)"
    return 0
  fi
  for cand in "$dest" /tmp/cloudflared "$HOME/.local/bin/cloudflared"; do
    if [ -x "$cand" ]; then
      CLOUDFLARED_BIN="$cand"
      return 0
    fi
  done
  echo "Descargando cloudflared a $dest ..."
  mkdir -p "$(dirname "$dest")"
  curl -fsSL -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o "$dest"
  chmod +x "$dest"
  CLOUDFLARED_BIN="$dest"
}

start_one_tunnel() {
  local name="$1" pid_file="$2" log_file="$3" target="$4"
  if running "$pid_file"; then
    echo "$name ya corre (PID $(cat "$pid_file"))"
    return 0
  fi
  : >"$log_file"
  nohup "$CLOUDFLARED_BIN" tunnel --no-autoupdate --url "$target" >>"$log_file" 2>&1 &
  echo $! >"$pid_file"
  sleep 0.3
  if running "$pid_file"; then
    echo "$name PID $(cat "$pid_file")"
  else
    echo "$name no arrancó. Ver $log_file" >&2
    rm -f "$pid_file"
    return 1
  fi
}

tunnel_start() {
  if [ -z "${FRONTEND_DIR:-}" ] || [ ! -x "$FRONTEND_DIR/scripts/spakira-lulu-run.sh" ]; then
    echo "No encuentro spakira-lulu-frontend hermano. Definí SPA_KIRA_FRONTEND_DIR." >&2
    exit 1
  fi
  ensure_cloudflared
  echo "Usando $CLOUDFLARED_BIN"
  "$PROJECT_DIR/scripts/spakira-lulu-run.sh" start
  "$FRONTEND_DIR/scripts/spakira-lulu-run.sh" start
  mkdir -p "$PROJECT_DIR/local-secrets" "$FRONTEND_DIR/local-secrets"
  start_one_tunnel "Túnel front" "$TUNNEL_FE_PID" "$TUNNEL_FE_LOG" "http://127.0.0.1:${FE_PORT}"
  start_one_tunnel "Túnel API" "$TUNNEL_BE_PID" "$TUNNEL_BE_LOG" "http://127.0.0.1:${BE_PORT}"
  echo "Esperando URLs de Cloudflare..."
  local fe be
  fe="$(wait_trycloudflare_url "$TUNNEL_FE_LOG")" || { echo "Sin URL front. Ver $TUNNEL_FE_LOG" >&2; exit 1; }
  be="$(wait_trycloudflare_url "$TUNNEL_BE_LOG")" || { echo "Sin URL API. Ver $TUNNEL_BE_LOG" >&2; exit 1; }
  cat >"$TUNNEL_ENV" <<ENVEOF
# Generado por tunnel-backup.sh — no commitear
VITE_API_URL=${be}
VITE_TUNNEL_FRONTEND=${fe}
ENVEOF
  cp "$TUNNEL_ENV" "$FRONTEND_DIR/local-secrets/vite-tunnel.env"
  # CORS del túnel
  export CORS_ORIGINS="http://localhost:${FE_PORT},http://127.0.0.1:${FE_PORT},${fe}"
  "$PROJECT_DIR/scripts/spakira-lulu-run.sh" restart
  # Front con VITE_API_URL
  (
    set -a
    # shellcheck disable=SC1090
    . "$FRONTEND_DIR/local-secrets/vite-tunnel.env"
    set +a
    export VITE_API_URL
    "$FRONTEND_DIR/scripts/spakira-lulu-run.sh" restart
  )
  cat <<MSG

Pegá en Google Cloud → Credenciales (JS origins + redirect):
  ${fe}
  ${be}/auth/google/login/callback
  (y las de localhost)

Panel: ${fe}/auth
API túnel: ${be}

Para cortar: $0 stop
MSG
}

tunnel_stop() {
  stop_one "Túnel front" "$TUNNEL_FE_PID"
  stop_one "Túnel API" "$TUNNEL_BE_PID"
  rm -f "$TUNNEL_ENV"
  if [ -n "${FRONTEND_DIR:-}" ]; then
    rm -f "$FRONTEND_DIR/local-secrets/vite-tunnel.env"
    if [ -x "$FRONTEND_DIR/scripts/spakira-lulu-run.sh" ]; then
      "$FRONTEND_DIR/scripts/spakira-lulu-run.sh" restart || true
    fi
  fi
  echo "Túneles detenidos. Volvé a localhost:${FE_PORT}"
}

status() {
  if running "$TUNNEL_FE_PID" || running "$TUNNEL_BE_PID"; then
    echo "Túnel: activo"
    if [ -f "$TUNNEL_ENV" ]; then
      # shellcheck disable=SC1090
      . "$TUNNEL_ENV"
      echo "  panel  ${VITE_TUNNEL_FRONTEND:-?}"
      echo "  API    ${VITE_API_URL:-?}"
    fi
  else
    echo "Túnel: detenido"
  fi
}

case "${1:-}" in
  start) tunnel_start ;;
  stop) tunnel_stop ;;
  status) status ;;
  *) echo "Uso: $0 start|stop|status" >&2; exit 1 ;;
esac
