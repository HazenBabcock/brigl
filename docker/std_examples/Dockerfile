# Distro
FROM ubuntu:bionic
MAINTAINER Hazen Babcock <hbabcock@mac.com>

# Update sources
RUN apt update

# Get dependencies
RUN apt-get --yes install git
RUN apt-get --yes install nginx
RUN apt-get --yes install python
RUN apt-get --yes install python3
RUN apt-get --yes install python3-distutils
RUN apt-get --yes install unzip
RUN apt-get --yes install wget

# Make directories for nginx.
RUN mkdir /var/www/html/brigl

# Get current brigl & install.
RUN git clone https://github.com/HazenBabcock/brigl.git
WORKDIR /brigl
RUN cp -r web/* /var/www/html/brigl/.

# Download parts & install.
WORKDIR /
RUN wget http://www.ldraw.org/library/updates/complete.zip
RUN unzip complete.zip > foo1.txt
RUN python3 /brigl/tools/prepareParts.py /ldraw/parts /var/www/html/brigl/parts > foo2.txt
RUN python3 /brigl/tools/prepareParts.py /ldraw/p /var/www/html/brigl/parts > foo3.txt

# Set owner.
RUN chown -R www-data:www-data /var/www/html/.

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

