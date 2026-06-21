#!/usr/bin/env bash
# Uninstall the ACDC watcher LaunchAgent: bootout the running instance and
# remove the plist. Leaves ~/.acdc state (logs, counters) in place.
set -euo pipefail

LABEL="com.bason.acdc-watch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
rm -f "$PLIST"

echo "Uninstalled $LABEL (removed $PLIST)"
