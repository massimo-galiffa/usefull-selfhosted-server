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

sudo systemctl restart systemd-logind

log "Laptop sleep on lid close has been disabled."
