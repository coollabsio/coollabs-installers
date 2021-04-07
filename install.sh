#!/bin/bash
echo -e 'Welcome to coolLabs installer.\n'
WHO=$(whoami)
if [ $WHO != 'root' ]; then
    echo 'Run as root please: sudo /bin/bash -c "$(curl -fsSL https://get.coollabs.io/install.sh)"'
    exit
fi

PS3='Which application you would like to install: '
options=("coolify" "coolify-debug" "exit")

select opt in "${options[@]}"
do
    case $opt in
        "coolify")
            rm ./coolify-installer
            wget "https://get.coollabs.io/coolify-installer"
            chmod +x "./coolify-installer"
            ./coolify-installer
            break
            ;;
        "coolify-debug")
            rm ./coolify-installer
            wget "https://get.coollabs.io/coolify-installer"
            chmod +x "./coolify-installer"
            ./coolify-installer -d
            break
            ;;
        "exit")
            break
            ;;
        *)  echo "Okay, nice try."
            break
    esac
done
