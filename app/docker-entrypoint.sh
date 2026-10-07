#!/bin/sh
# Start Sonora as whoever owns its data folder.
#
# /data is often a folder on the host, created by the person installing (so
# owned by them) or by Docker on first run (so owned by root). The image's
# own user, sonora, can write to neither. So the container starts as root just
# long enough to look: a folder someone owns is used as theirs, and Sonora
# runs as that user; a folder root owns is handed to sonora. Root is dropped
# before Sonora starts either way.
set -e
if [ "$(id -u)" = 0 ]; then
    owner=$(stat -c %u /data)
    group=$(stat -c %g /data)
    if [ "$owner" = 0 ]; then
        chown sonora:sonora /data
        owner=$(id -u sonora)
        group=$(id -g sonora)
    fi
    exec setpriv --reuid="$owner" --regid="$group" --clear-groups -- "$@"
fi
exec "$@"
