#!/usr/bin/env bash
# Wrapper around mcp-inspector that ensures all child processes are cleaned up
# when the script exits (Ctrl+C, kill, etc).
set -e
trap 'kill 0' INT TERM EXIT
# Source .env so the inspector process itself has fresh values — it spreads
# process.env into the child, so shell-level vars would otherwise win over --env-file.
set -a && source .env && set +a
node_modules/.bin/mcp-inspector node dist/index.js &
wait
