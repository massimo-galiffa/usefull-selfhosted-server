#this is only for laptop servers, if you want to be able to close the lid.

#!/bin/bash

sudo sed -i 's/#HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf

sudo systemctl restart systemd-logind

echo "Lid close deactivated"