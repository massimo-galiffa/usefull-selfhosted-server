#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=setup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_command curl
require_command sudo

sudo apt update
sudo apt upgrade -y

sudo apt install -y curl git ufw ca-certificates lsb-release

curl -fsSL https://get.docker.com | sudo sh

sudo systemctl enable docker
sudo systemctl start docker

if ! getent group docker >/dev/null 2>&1; then
    sudo groupadd docker
fi

if ! id -nG "${USER}" | grep -qw docker; then
    sudo usermod -aG docker "${USER}"
fi

sudo ufw allow 22/tcp
sudo ufw allow 53/tcp
sudo ufw allow 53/udp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
sudo ufw allow 9000/tcp
sudo ufw allow 25565/tcp
sudo ufw --force enable

ensure_env_files

log "Base host setup completed."
