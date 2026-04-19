#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../setup/lib.sh
source "${SCRIPT_DIR}/../setup/lib.sh"

ensure_env_files

log "Watchdog run started."

docker_compose_cmd --env-file "${ENV_FILE}" -f "${REPO_ROOT}/compose/core.yml" up -d

container_ids="$(docker_compose_cmd --env-file "${ENV_FILE}" -f "${REPO_ROOT}/compose/core.yml" ps -q)"

for container_id in ${container_ids}; do
    [[ -z "${container_id}" ]] && continue

    container_name="$(docker_cmd inspect --format '{{.Name}}' "${container_id}" | sed 's#^/##')"
    container_status="$(docker_cmd inspect --format '{{.State.Status}}' "${container_id}")"
    health_status="$(docker_cmd inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${container_id}")"

    if [[ "${container_status}" != "running" ]]; then
        log "Restarting ${container_name} because status is ${container_status}."
        docker_cmd restart "${container_id}" >/dev/null
        continue
    fi

    if [[ "${health_status}" == "unhealthy" ]]; then
        log "Restarting ${container_name} because health check is unhealthy."
        docker_cmd restart "${container_id}" >/dev/null
    fi
done

log "Watchdog run completed."
