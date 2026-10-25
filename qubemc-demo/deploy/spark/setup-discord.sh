#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
node_bin="${NEMOCLAW_NODE:-$HOME/.nvm/versions/node/v22.23.4/bin/node}"
exec "$node_bin" --env-file="${COFLOOR_ENV_FILE:-$HOME/.env}" "$script_dir/setup-discord.mjs"
