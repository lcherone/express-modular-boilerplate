
FROM cypress/base:12.13.0

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

RUN apt --fix-broken install
RUN apt-get update \
    && apt-get -y install --no-install-recommends apt-utils 2>&1 \
    && apt-get -y install --no-install-recommends apt-transport-https 2>&1 \
    #
    # Verify git and needed tools are installed
    && apt-get install -y wget curl lsb-release procps net-tools \
    # Chrome deps
    && apt-get install -y xdg-utils fonts-liberation libappindicator3-1 \
    # Chrome
    #&& wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    #&& dpkg -i google-chrome-stable_current_amd64.deb \
    # Clean up
    && apt-get autoremove -y && apt-get autoclean -y && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENV DEBIAN_FRONTEND=dialog

ENV TZ UTC

WORKDIR /app

# dependencies will be installed only if the package files change
COPY package.json .
COPY package-lock.json .

# by setting CI environment variable we switch the Cypress install messages
# to small "started / finished" and avoid 1000s of lines of progress messages
# https://github.com/cypress-io/cypress/issues/1243
ENV CI=1
RUN npm ci
# verify that Cypress has been installed correctly.
# running this command separately from "cypress run" will also cache its result
# to avoid verifying again when running the tests
RUN npx cypress verify
