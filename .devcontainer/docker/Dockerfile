FROM node:lts-slim

# copy files to container
#COPY somefile.ini /var/www/html

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Configure apt and install packages
RUN apt-get update \
    && apt-get -y install --no-install-recommends apt-utils 2>&1 \
    && apt-get -y install --no-install-recommends apt-transport-https 2>&1 \
    #
    # Verify git and needed tools are installed
    && apt-get install -y wget curl lsb-release git procps net-tools nano htop iftop \
    #
    # mySQL client
    && apt-get install -y mysql-client \
    #
    # ssmtp mta for mailhog
    && apt-get install -y ssmtp \
    && echo "mailhub=mailhog:2525\nUseTLS=NO\nFromLineOverride=YES" > /etc/ssmtp/ssmtp.conf \
    #
    # npm
    && npm config set ignore-scripts false \
    # Install global npm packages
    && npm install -g eslint \
    && npm install -g nodemon \
    && npm install -g pm2 \
    #
    # Clean up
    && apt-get autoremove -y && apt-get autoclean -y && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog

# Create volumn link to current directory
VOLUME /var/www/html

# Set environment vars
ENV TZ UTC

COPY entrypoint.sh /

#
ENTRYPOINT ["/entrypoint.sh"]

# comment out if you dont want to use .devcontainer.json
#CMD npm run dev
