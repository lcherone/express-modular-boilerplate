#!/bin/bash

set -e

#
##
setup_database() {
    if [ "$IS_RESTART" = true ]; then
        echo >&2 "Entrypoint: [database] - assuming database container is setup after restart"
    else
        echo >&2 "Entrypoint: [database] - pausing 10s for database server to finish installing"
        sleep 10

        while ! mysqladmin ping --silent -h mysql -u"root" -p"$DB_ROOTPASS"; do
            echo >&2 "Entrypoint: [database] - waiting for database server to start +5s"
            sleep 5
        done

        echo >&2 "Entrypoint: [database] - database is up and running"
        sleep 1

        # setup users and database
        echo >&2 "Entrypoint: [database] - setup users and database"
        mysql -h mysql -u"root" -p"$DB_ROOTPASS" -e "CREATE DATABASE IF NOT EXISTS \`$DB_DATABASE\` /*\!40100 DEFAULT CHARACTER SET utf8mb4 */;"
        mysql -h mysql -u"root" -p"$DB_ROOTPASS" -e "CREATE USER IF NOT EXISTS $DB_USERNAME@'%' IDENTIFIED BY '$DB_PASSWORD';"
        mysql -h mysql -u"root" -p"$DB_ROOTPASS" -e "GRANT ALL PRIVILEGES ON \`$DB_DATABASE\`.* TO '$DB_USERNAME'@'%';"
        mysql -h mysql -u"root" -p"$DB_ROOTPASS" -e "GRANT ALL PRIVILEGES on *.* to 'root'@'localhost' IDENTIFIED BY '$DB_ROOTPASS';"
        mysql -h mysql -u"root" -p"$DB_ROOTPASS" -e "FLUSH PRIVILEGES;"

        # import database if exsits
        if [ -f /var/www/html/.devcontainer/sql/dump.sql ]; then
            echo >&2 "Entrypoint: [database] - import database file: dump.sql"
            cat /var/www/html/.devcontainer/sql/dump.sql | mysql -h mysql -u"root" -p"$DB_ROOTPASS" $DB_DATABASE
        fi
    fi
}

#
##
install_npm_packages() {
    if [ ! -f /var/www/html/package-lock.json ]; then
        echo >&2 "Entrypoint: [npm install]"
        cd /var/www/html && npm install
    else
        echo >&2 "Entrypoint: [npm install] - packages already installed and setup. To reinstall, remove: ./package-lock.json"
    fi
}

#
##
main() {
    echo >&2 "Entrypoint: [OS] $(uname -a)"
    echo >&2 "Entrypoint: [PWD] /var/www/html"

    #
    install_npm_packages

    #
    #setup_database

    echo >&2 "Entrypoint: [end build]"
}

main

# go to ./app as its where the package.json is
cd /var/www/html

echo >&2 "[exec] - $@"
exec "$@"
