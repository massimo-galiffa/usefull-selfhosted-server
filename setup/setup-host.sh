#!/bin/bash

sudo apt update && sudo apt upgrade -y

# basis tools
sudo apt install -y curl git ufw

# Docker installation (official)
curl -fsSL https://get.docker.com | sudo sh

# Docker
sudo systemctl enable docker
sudo systemctl start docker

# add user to docker group
sudo usermod -aG docker $USER

# firewall
sudo ufw allow 22
sudo ufw allow 8080
sudo ufw allow 9000
sudo ufw allow 8081
sudo ufw allow 25565
sudo ufw enable

echo "setup done. restart if errors occur!"