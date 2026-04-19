#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=setup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

sudo install -d -m 755 /etc/systemd/logind.conf.d
sudo install -d -m 755 /etc/systemd/sleep.conf.d

sudo tee /etc/systemd/logind.conf.d/homeserver.conf >/dev/null <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF

sudo tee /etc/systemd/sleep.conf.d/homeserver.conf >/dev/null <<'EOF'
[Sleep]
AllowSuspend=no
AllowHibernation=no
AllowHybridSleep=no
AllowSuspendThenHibernate=no
EOF

if [[ -n "${XDG_SESSION_ID:-}" ]] || loginctl list-sessions 2>/dev/null | grep -qE '\b(tty|seat|wayland|x11)\b'; then
    log "Lid-close settings were written successfully."
    log "Skipping 'systemd-logind' restart to avoid breaking the active desktop session."
    log "Please reboot once later, or restart systemd-logind manually from a non-graphical session."
else
    sudo systemctl restart systemd-logind
    log "Laptop sleep on lid close has been disabled."
fi
