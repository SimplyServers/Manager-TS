#!/bin/bash
# Server Bucket newUser.sh
# Creates a user with the specified prams (./newUser.sh <name> <password>)

adduser --disabled-password --disable-login --home /home/$1 --password $2 $1

usermod -G sftponly $1

chown root:$1 /home/$1
chmod 775 /home/$1

mkdir /home/$1/public /home/$1/backups
chown $1:$1 /home/$1/*

#limit disk usage for the user bob to 2 GB and inodes 10 1000000
#setquota -u -F vfsv0 $1 2097152 2097152 1000000 1000000 /
