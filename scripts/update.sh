#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../setup/lib.sh
source "${SCRIPT_DIR}/../setup/lib.sh"

ensure_env_files
docker_compose_cmd --env-file "${ENV_FILE}" -f "${REPO_ROOT}/compose/core.yml" pull
docker_compose_cmd --env-file "${ENV_FILE}" -f "${REPO_ROOT}/compose/core.yml" up -d --build
