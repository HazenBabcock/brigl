#!/bin/bash
readonly username=whoami

# Update
sudo apt update -qq

# Install Python3
sudo apt --yes install python3

# Install nginx webserver.
sudo apt --yes install nginx

# Install chrome.
sudo apt --yes install chromium-chromedriver

# Add chrome-driver to path.
export PATH=$PATH:/usr/lib/chromium-browser/
export DISPLAY=:99.0
sh -e /etc/init.d/xvfb start

# Pause
sleep 10

# Create Python virtual environment & activate.
python3 -m venv
source venv/bin/activate

# Install python modules.
pip install pytest
pip install selenium

# Configure server.
sudo mkdir /var/www/html/brigl
sudo chown $username:$username /var/www/html/brigl

ls -la /var/www/html/

mkdir /var/www/html/brigl/test
cp -r web/parts /var/www/html/brigl/.

ls -la /var/www/html/brigl

# Install parts.
wget http://www.ldraw.org/library/updates/complete.zip
unzip complete.zip
python tools/prepareParts ldraw/parts /var/www/html/brigl/parts
python tools/prepareParts ldraw/p /var/www/html/brigl/parts

ls -la /var/www/html/brigl/parts

# Install JS and html.
ls -la /var/www/html/brigl/

sh install.sh

# Run tests.
cd test
ls -la
pytest
