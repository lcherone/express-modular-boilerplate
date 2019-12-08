#!/bin/sh -e

if [ -n "$@" ]; then
  exec "$@"
fi

ARGS="ngrok start --all -config=/home/ngrok/.ngrok2/ngrok.yml"

set -x
exec $ARGS
