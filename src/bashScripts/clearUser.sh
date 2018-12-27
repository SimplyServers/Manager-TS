#!/bin/bash
# Server Bucket clearUser.sh
# Clears an users /public/ and /backups/ folder (./clearUser.sh <name>)

rm -rf /home/$1/public
rm -rf /home/$1/backups

mkdir /home/$1/public /home/$1/backups
chown $1:$1 /home/$1/*
