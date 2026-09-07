#!/usr/bin/env bash
# Misma prueba HyperFrames que el backend (spike protegida).
# Uso: ./scripts/hyperframes-trial.sh doctor
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/../spakira-lulu-backend/scripts/hyperframes-trial.sh" "$@"
