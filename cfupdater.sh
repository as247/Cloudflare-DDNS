#!/bin/sh

# CHANGE THESE
authToken="YOUR_API_TOKEN"
zoneIdentifier="YOUR_ZONE_ID"
recordName="home.example.com"
ttl=120
proxied=false

workerURL="https://your-worker.workers.dev"

updateURL="${workerURL}/?user=${zoneIdentifier}&pass=${authToken}&host=${recordName}&ttl=${ttl}&proxied=${proxied}"

if command -v curl >/dev/null 2>&1; then
    curl -fsS --connect-timeout 10 --max-time 30 "$updateURL"
elif command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=30 "$updateURL"
else
    echo "Error: neither curl nor wget is installed." >&2
    exit 1
fi