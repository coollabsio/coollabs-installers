#!/bin/sh
case $1 in
  coolify)
    wget "https://get.coollabs.io/coolify-installer"
    chmod +x "./coolify-installer"
    ./coolify-installer
    ;;
  *)
    echo "Invalid installer. 

Valid applications:
- coolify (https://github.com/coollabsio/coolify)
"
    ;;
esac
