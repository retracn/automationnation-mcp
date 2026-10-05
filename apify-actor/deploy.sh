#!/bin/bash
# Deploys automationnation/data-tools-mcp-server (Actor Standby, MCP at /mcp) with the current server code.
# Pushes from a temp copy: apify push skips git-ignored files, and the copied server/ is git-ignored.
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH
cd "$(dirname "$0")"
tmp=$(mktemp -d)
rsync -a --exclude node_modules --exclude storage --exclude server ./ "$tmp/"
cp -R ../src "$tmp/server"
cd "$tmp" && apify push --force --wait-for-finish 900
