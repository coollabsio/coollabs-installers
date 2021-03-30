#!/bin/sh
case $1 in
  coolify)
    rm ./coolify-installer
    wget "https://get.coollabs.io/coolify-installer"
    chmod +x "./coolify-installer"
    ./coolify-installer $2
    ;;
  *)
    echo "Invalid installer. 

Valid applications:
- coolify (https://github.com/coollabsio/coolify)
"
    ;;
esac
