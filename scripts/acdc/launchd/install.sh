#!/usr/bin/env bash
# Install the ACDC watcher LaunchAgent.
#
# Substitutes __HOME__ / __REPO__ in the template, writes it to
# ~/Library/LaunchAgents/com.bason.acdc-watch.plist, then (re)bootstraps it.
set -euo pipefail

LABEL="com.bason.acdc-watch"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/$LABEL.plist.template"

# Repo root = three levels up from scripts/acdc/launchd
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOME_DIR="$HOME"

PLIST_DIR="$HOME_DIR/Library/LaunchAgents"
PLIST="$PLIST_DIR/$LABEL.plist"

mkdir -p "$PLIST_DIR"
mkdir -p "$HOME_DIR/.acdc/inflight"

# Substitute placeholders. Use | as the sed delimiter since paths contain /.
sed -e "s|__HOME__|$HOME_DIR|g" -e "s|__REPO__|$REPO|g" "$TEMPLATE" > "$PLIST"

# Reload: bootout any existing instance (ignore errors), then bootstrap fresh.
DOMAIN="gui/$(id -u)"
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

echo "Installed $LABEL"
echo "  plist: $PLIST"
echo "  repo:  $REPO"
echo "  logs:  $HOME_DIR/.acdc/watch.log"
