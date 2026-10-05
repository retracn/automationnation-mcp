#!/bin/bash
# Deploys the private smoke-test Actor (automationnation/mcp-smoke-test) with the current server code.
# Run it on Apify to call every tool against the live Actors; results land in the run's dataset.
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH
cd "$(dirname "$0")"
rm -rf server && cp -R ../src server
apify push
