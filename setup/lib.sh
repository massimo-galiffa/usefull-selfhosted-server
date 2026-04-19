#!/bin/bash

set -euo pipefail

SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SETUP_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
DASHBOARD_ENV_FILE="${REPO_ROOT}/dashboard/.env.local"

log() {
    echo "[homeserver] $*"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log "Required command missing: $1"
        exit 1
    fi
}

detect_primary_ip() {
    local detected_ip=""

    if command -v ip >/dev/null 2>&1; then
        detected_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
    fi

    if [[ -z "${detected_ip}" ]]; then
        detected_ip="$(hostname -I 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i !~ /^127\./) { print $i; exit }}')"
    fi

    if [[ -z "${detected_ip}" ]]; then
        log "Could not detect a LAN IP automatically."
        exit 1
    fi

    echo "${detected_ip}"
}

detect_timezone() {
    local timezone=""

    if command -v timedatectl >/dev/null 2>&1; then
        timezone="$(timedatectl show --property=Timezone --value 2>/dev/null || true)"
    fi

    if [[ -z "${timezone}" && -f /etc/timezone ]]; then
        timezone="$(cat /etc/timezone)"
    fi

    if [[ -z "${timezone}" ]]; then
        timezone="UTC"
    fi

    echo "${timezone}"
}

random_password() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 12
        return
    fi

    od -An -N 12 -tx1 /dev/urandom | tr -d ' \n'
}

set_env_value() {
    local file="$1"
    local key="$2"
    local value="$3"

    if grep -q "^${key}=" "${file}"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "${file}"
    else
        printf '\n%s=%s\n' "${key}" "${value}" >>"${file}"
    fi
}

get_env_value() {
    local file="$1"
    local key="$2"

    if [[ ! -f "${file}" ]]; then
        return
    fi

    awk -F '=' -v target="${key}" '$1 == target {sub(/^[^=]*=/, ""); print; exit}' "${file}"
}

ensure_env_files() {
    local server_ip timezone pihole_password password_generated="false"

    server_ip="$(detect_primary_ip)"
    timezone="$(detect_timezone)"

    if [[ ! -f "${ENV_FILE}" ]]; then
        cp "${REPO_ROOT}/.env.example" "${ENV_FILE}"
    fi

    set_env_value "${ENV_FILE}" "SERVER_IP" "${server_ip}"
    set_env_value "${ENV_FILE}" "TZ" "${timezone}"

    pihole_password="$(get_env_value "${ENV_FILE}" "PIHOLE_WEBPASSWORD")"
    if [[ -z "${pihole_password}" || "${pihole_password}" == "changeme" ]]; then
        pihole_password="$(random_password)"
        set_env_value "${ENV_FILE}" "PIHOLE_WEBPASSWORD" "${pihole_password}"
        password_generated="true"
    fi

    if [[ ! -f "${DASHBOARD_ENV_FILE}" ]]; then
        printf 'NEXT_PUBLIC_SERVER_IP=%s\n' "${server_ip}" >"${DASHBOARD_ENV_FILE}"
    else
        set_env_value "${DASHBOARD_ENV_FILE}" "NEXT_PUBLIC_SERVER_IP" "${server_ip}"
    fi

    log "Environment updated:"
    log "  SERVER_IP=${server_ip}"
    log "  TZ=${timezone}"
    if [[ "${password_generated}" == "true" ]]; then
        log "  PIHOLE_WEBPASSWORD=${pihole_password}"
    else
        log "  PIHOLE_WEBPASSWORD preserved from ${ENV_FILE}"
    fi
}

docker_compose_cmd() {
    if docker info >/dev/null 2>&1; then
        docker compose "$@"
    else
        sudo docker compose "$@"
    fi
}

docker_cmd() {
    if docker info >/dev/null 2>&1; then
        docker "$@"
    else
        sudo docker "$@"
    fi
}
