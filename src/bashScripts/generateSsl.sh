#!/bin/bash
# Server Bucket generateSsl.sh
# Make a self signed SSL cert for the socket and rest API.

cn="$1"

openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.cert -days 7300 -subj '/CN=$cn' -nodes