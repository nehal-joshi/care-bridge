#!/usr/bin/env bash
# Copy the care-bridge plugin into the live Hermes install. It does not change Hermes config or tokens;
# follow docs/hackathon/runbook.md for those steps, then restart the gateway.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/plugins/care-bridge"
DEST="$HOME/.hermes/plugins/care-bridge"
mkdir -p "$DEST"
cp "$SRC/plugin.yaml" "$SRC/__init__.py" "$DEST/"
echo "Copied care-bridge plugin to $DEST"
echo "Next: enable it in ~/.hermes/config.yaml (plugins.enabled), then: hermes gateway restart"
