# Homeserver Starter

Docker-based homeserver stack for a laptop or mini PC with:

- Pi-hole
- Portainer
- Dashboard
- optional Minecraft server

The project now supports:

- one-command installation with `bash install.sh`
- automatic LAN IP detection
- automatic `.env` generation and update
- automatic startup after reboot via `systemd`
- laptop mode so the machine keeps running with the lid closed
- watchdog timer for automatic container recovery
- live dashboard widgets for health, errors and load history

## Quick Start

```bash
git clone https://github.com/massimo-galiffa/usefull-selfhosted-server
cd usefull-selfhosted-server
bash install.sh
```

The installer will:

1. install Docker and required packages
2. create or update `.env`
3. detect the current LAN IP automatically
4. generate a Pi-hole password if needed
5. disable suspend on lid close
6. install the `homeserver.service` autostart unit
7. install the watchdog timer for automatic recovery checks
8. build and start the stack

If you run the installer from the graphical desktop, the lid-close config is written safely without restarting your login session. Reboot once afterward to apply that part fully.

## Access

After installation, open:

- Dashboard: `http://SERVER-IP:8080`
- Portainer: `http://SERVER-IP:9000`
- Pi-hole: `http://SERVER-IP:8081/admin`

`SERVER-IP` is detected automatically during install and deploy.

## Manual Commands

If you want to run steps separately:

```bash
bash setup/setup-host.sh
bash setup/configure-lid.sh
bash setup/install-service.sh
bash setup/install-watchdog.sh
bash scripts/deploy.sh
```

To update everything later:

```bash
bash scripts/update.sh
```

## Optional Minecraft Server

```bash
docker compose --env-file .env -f compose/optional.minecraft.yml up -d
```

Connect with:

```text
SERVER_IP:25565
```

## Important Notes

- Normal reboots are handled automatically by `systemd` and Docker restart policies.
- A watchdog timer checks the stack every 5 minutes and restarts stopped or unhealthy containers.
- Automatic power-on after a complete power loss cannot reliably be configured from Linux alone.
- For that last part, set the BIOS/UEFI option `Power On after AC loss` or `Restore on AC power` to `Power On`.
- Closing the laptop lid will no longer suspend the machine after `install.sh` or `setup/configure-lid.sh`.
- The installer no longer force-restarts `systemd-logind` during an active desktop session; reboot once after install if needed.

## Stack

- Dashboard runs on port `8080`
- Portainer runs on port `9000`
- Pi-hole web UI runs on port `8081`
- Pi-hole DNS uses port `53`
- Minecraft, when enabled, uses port `25565`

## Monitoring

The dashboard now shows:

- Docker container state and health
- CPU, RAM and disk usage
- host temperature when Linux exposes a readable sensor
- service reachability for Dashboard, Pi-hole and Portainer
- short history lines so you can spot trends instead of only one snapshot

## Security

- Keep the services inside your local network.
- Do not expose these ports directly to the public internet.
- Use strong passwords.
- Keep Ubuntu and Docker updated.
