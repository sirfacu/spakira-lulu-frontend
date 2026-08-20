#!/usr/bin/env bash
# Activa hooks locales que impiden commit/push directo a main.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
chmod +x "$ROOT/.githooks/pre-commit" "$ROOT/.githooks/pre-push"
git -C "$ROOT" config core.hooksPath .githooks
echo "Hooks activos (core.hooksPath=.githooks)."
echo "Commit/push a main quedan bloqueados en este clone."
