echo -e "####################################\nIf you interested in what this script does, go to https://github.com/coollabsio/coollabs-installers\n####################################\n\n"
WHO=$(whoami)
if [ $WHO != 'root' ]; then
    echo 'Run as root please: sudo /bin/bash -c "$(curl -fsSL https://get.coollabs.io/coolify/install.sh)"'
    exit
fi
mkdir -p /data/coolify
mkdir -p /root/coollabs/coolify
/bin/bash -c "$(curl -fsSL https://get.docker.com)"
docker run --pull always --rm  -v "/var/run/docker.sock:/var/run/docker.sock" -v "/data/coolify:/data/coolify" -v "/root/coollabs/coolify:/usr/src/app/coollabs/coolify" -p "8080:8080" --name coollabs-installer coollabsio/coollabs-installer
