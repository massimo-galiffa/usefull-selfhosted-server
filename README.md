# Homeserver Starter

## Features
- Pi-hole (DNS Adblock)
- Portainer (Docker UI)
- Dashboard (Intranet)
- Optional: Minecraft Server

## Setup

1. .env create youreself a .env :
   cp .env.example .env

2. Setup:
   bash setup/setup-host.sh

3. Deploy:
   bash scripts/deploy.sh

## access
- Dashboard: http://SERVER-IP:8080
- Portainer: http://SERVER-IP:9000
- Pi-hole: http://SERVER-IP:8081/admin

## Installation

# 🏠 Homeserver Setup Guide

This guide walks you through setting up your homeserver using Ubuntu, Docker, and a Next.js dashboard.

---

# 🧠 Concept

The system is designed to be:

* reproducible (scripts + Docker)
* local-first (runs inside your home network)
* modular (services via Docker)
* easy to redeploy on new hardware

---

# 🖥 Phase 1: Development in a VM (Recommended)

Before using your real laptop, build and test everything in a virtual machine.

## 1. Install Ubuntu

Use:

* Ubuntu Desktop (minimal install is enough)

## 2. Update system

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git -y
```

## 3. Clone repository

```bash
git clone https://github.com/massimo-galiffa/usefull-selfhosted-server
cd usefull-selfhosted-server
```

## 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Set your VM IP:

```
SERVER_IP=YOUR_VM_IP
```

Find your IP:

```bash
ip a
```

---

#  Phase 2: Install Host Dependencies

Run:

```bash
bash setup/setup-host.sh
```

Then log out and back in:

```bash
exit
```

---

#  Phase 3: Deploy Services

```bash
bash scripts/deploy.sh
```

This starts:

* Dashboard (Next.js)
* Pi-hole
* Portainer

---

#  Phase 4: Access Services

Open in browser:

* Dashboard: http://SERVER_IP:3000
* Portainer: http://SERVER_IP:9000
* Pi-hole: http://SERVER_IP:8081/admin

---

# 🎮 Optional: Minecraft Server

```bash
docker compose --env-file .env -f compose/optional.minecraft.yml up -d
```

Connect with:

```
SERVER_IP:25565
```

---

#  Phase 5: Autostart on Boot

## Create systemd service

copy homeserver.service file from system folder to:

```
/etc/systemd/system/homeserver.service
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable homeserver.service
```

---

#  Phase 6: Power Recovery (Important)

After power loss:

* Services will restart automatically
* Laptop may NOT power on automatically

Check BIOS/UEFI for:

* Power on after AC loss
* Restore on AC power

Set to:

```
Power On
```

---

#  Phase 7: Testing

Test reboot:

```bash
sudo reboot
```

Check containers:

```bash
docker ps
```

---

#  Phase 8: Deploy to Real Laptop

## 1. Install Ubuntu

## 2. Clone repo

```bash
git clone https://github.com/massimo-galiffa/usefull-selfhosted-server
cd usefull-selfhosted-server
```

## 3. Run setup

```bash
bash setup/setup-host.sh
```

## 4. Deploy

```bash
bash scripts/deploy.sh
```

---

#  Architecture

```
Router
└── Homeserver (Laptop)
    ├── Ubuntu Desktop
    ├── Docker
    │   ├── Dashboard (Next.js)
    │   ├── Pi-hole
    │   ├── Portainer
    │   └── Minecraft (optional)
    ├── VNC (LAN only)
    └── SSH
```

---

#  Security Notes

* Do NOT expose ports to the internet
* Keep everything inside your local network
* Use VPN later for remote access
* Use strong passwords
* Keep system updated

---

#  Updates

```bash
bash scripts/update.sh
```

---