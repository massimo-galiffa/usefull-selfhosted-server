#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=setup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

sudo tee /etc/systemd/system/homeserver-watchdog.service >/dev/null <<EOF
[Unit]
Description=Homeserver Docker Watchdog
Wants=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
WorkingDirectory=${REPO_ROOT}
ExecStart=/bin/bash ${REPO_ROOT}/scripts/watchdog.sh
EOF

sudo tee /etc/systemd/system/homeserver-watchdog.timer >/dev/null <<'EOF'
[Unit]
Description=Run homeserver watchdog regularly

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=homeserver-watchdog.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable homeserver-watchdog.timer
sudo systemctl restart homeserver-watchdog.timer

log "Watchdog timer installed."
