#!/bin/bash
# Server Bucket resetPassword.sh
# Resets a users password (./resetPassword.sh <name> <new password>)

echo -e "$2\n$2" | (passwd $1)