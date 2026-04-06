#!/usr/bin/env bash
# Wrapper around mcp-inspector that ensures all child processes are cleaned up
# when the script exits (Ctrl+C, kill, etc).
set -e
trap 'kill 0' INT TERM EXIT
node_modules/.bin/mcp-inspector node dist/index.js &
wait
