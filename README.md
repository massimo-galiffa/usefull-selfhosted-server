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