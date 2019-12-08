#!/usr/bin/env bash
set -eu

#
# env for docker-compose
set -o allexport
source ../../.env
set +o allexport

#
## shutdown and remove containers
docker-compose down -v

#
## cleanup
docker network prune -f
docker system prune --volumes -f
docker rmi $(docker images -q)
