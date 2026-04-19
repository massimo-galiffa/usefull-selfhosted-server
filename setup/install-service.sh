#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=setup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

ensure_env_files

sudo tee /etc/systemd/system/homeserver.service >/dev/null <<EOF
[Unit]
Description=Homeserver Docker Compose Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${REPO_ROOT}
ExecStart=/usr/bin/docker compose --env-file ${ENV_FILE} -f ${REPO_ROOT}/compose/core.yml up -d
ExecStop=/usr/bin/docker compose --env-file ${ENV_FILE} -f ${REPO_ROOT}/compose/core.yml down
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable homeserver.service

log "Autostart service installed."
