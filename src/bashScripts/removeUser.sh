#!/bin/bash
# Server Bucket removeUser.sh
# Removes a user from the system (./removeUser.sh <name>)
userdel -r $1
rm -rf /home/$1