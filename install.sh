#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${ROOT_DIR}/setup/setup-host.sh"
bash "${ROOT_DIR}/setup/configure-lid.sh"
bash "${ROOT_DIR}/setup/install-service.sh"
bash "${ROOT_DIR}/setup/install-watchdog.sh"
bash "${ROOT_DIR}/scripts/deploy.sh"

echo
echo "Homeserver installation complete."
echo "The stack is configured to start automatically after reboots."
echo "For automatic power-on after total power loss, set the BIOS/UEFI option 'Power On after AC loss' manually."
