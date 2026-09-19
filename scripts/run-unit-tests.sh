#!/usr/bin/env bash
# Unit tests del panel (Vitest). Lo que CI / compile debe correr.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [[ ! -d node_modules ]]; then
  echo "Falta node_modules. Corré: npm install" >&2
  exit 1
fi

exec npm test -- "$@"
