#!/bin/bash
set -e

mkdir -p targets/trusty/usr/share
rm -rf targets/trusty/usr/share/*

echo "Cloning base mediators..."
rsync -a ../. --exclude packaging targets/trusty/usr/share/openhim-mediator-ihris-np
echo "Done."

echo "Downloading module dependencies..."
(cd targets/trusty/usr/share/openhim-mediator-ihris-np/ && npm install)
echo "Done."