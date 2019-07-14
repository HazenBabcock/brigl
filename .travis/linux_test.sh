#!/bin/bash
readonly username=travis
readonly www_dir=/usr/share/nginx/html

# Update
sudo apt update -qq

# Install Python3
sudo apt --yes install python3
sudo apt --yes install python3-venv

# Install nginx webserver & start it.
sudo apt --yes install nginx
sudo /etc/init.d/nginx start
nginx -V

# Install chrome.
sudo apt --yes install chromium-chromedriver

# Copy chromedriver to test directory.
echo ls -la /usr/lib/chromium-browser/
ls -la /usr/lib/chromium-browser/

cp /usr/lib/chromium-browser/chromedriver ./test/.
sudo chown $username:$username ./test/chromedriver

# Check chromium and chrome-driver versions.
echo chromium version check
./test/chromedriver --version
/usr/bin/chromium-browser --version

#export DISPLAY=:99.0
#sh -e /etc/init.d/xvfb start

echo path is
echo $PATH

# Pause
sleep 20

# Create Python virtual environment & activate.
python3 -m venv brigl_env
source brigl_env/bin/activate

# Install python modules.
pip install pytest
pip install selenium

# Configure server.
sudo mkdir $www_dir/brigl

# Set travis as the owner so we don't need sudo.
whoami
sudo chown $username:$username $www_dir/brigl

echo ls -la $www_dir
ls -la $www_dir

mkdir $www_dir/brigl/js
mkdir $www_dir/brigl/test
cp web/ship.mpd $www_dir/brigl/.
cp -r web/parts $www_dir/brigl/.

echo ls -la $www_dir/brigl
ls -la $www_dir/brigl

# Install parts.
wget http://www.ldraw.org/library/updates/complete.zip
unzip complete.zip > foo1.txt
python tools/prepareParts.py ldraw/parts $www_dir/brigl/parts > foo2.txt
python tools/prepareParts.py ldraw/p $www_dir/brigl/parts > foo3.txt

echo ls -la $www_dir/brigl/parts
ls -la $www_dir/brigl/parts

# Install JS and html.
echo ls -la $www_dir/brigl/
ls -la $www_dir/brigl/

sh install.sh

# Run tests.
cd test
which chromium-browser
which chrome
python driver.py
pytest
