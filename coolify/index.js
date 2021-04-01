#!/usr/bin/env node
const shell = require('shelljs')
const inquirer = require('inquirer');
const yaml = require('js-yaml')
const fs = require('fs')
const crypto = require('crypto')
const isDomain = require('is-valid-domain')
const { program } = require('commander');

program.version('1.0.0');

program
    .option('-d, --debug', 'output extra debugging')

program.parse(process.argv);
const options = program.opts();

let mongodbJson = require('./mongodb.json')
let networkName = 'coollabs'
let configJson = {}
let publicAddress = null

let answers = {
    general: {
        domain: null,
        dns: true,
        email: null,
        jwt: generateRandom(14),
        encryptionKey: generateRandom(32)
    },
    docker: {
        networkName
    },
    mongodb: {
        required: true,
        rootPw: generateRandom(18),
        databaseName: 'coolify',
        username: generateRandom(12),
        userPw: generateRandom(18),
    },
    github: {
        app: {
            required: true,
            name: null,
            clientId: null,
            secret: null,
            webhookSecret: null,
            privateKey: null
        }
    }
}

function generateRandom(n) {
    if (n <= 0) {
        return '';
    }
    var rs = '';
    try {
        rs = crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
    }
    catch (ex) {
        console.error('Exception generating random string: ' + ex);
        rs = '';
        var r = n % 8, q = (n - r) / 8, i;
        for (i = 0; i < q; i++) {
            rs += Math.random().toString(16).slice(2);
        }
        if (r > 0) {
            rs += Math.random().toString(16).slice(2, i);
        }
    }
    return rs;
}
async function checkDocker() {
    const docker = shell.exec('docker version --format "{{json . }}"')
    if (docker.code !== 0) {
        return false
    } else {
        const dockerMajorVersion = JSON.parse(docker.stdout).Server.Version.split('.')[0]
        if (dockerMajorVersion !== '20') {
            return false
        }
    }
    return true
}
async function installDocker() {
    console.log('\n## Installing Docker Engine')
    shell.exec('apt-get remove docker docker-engine docker.io containerd runc')
    shell.set('-e')
    shell.exec('curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -')
    shell.exec('add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"')
    shell.exec('apt-get update')
    shell.exec('apt-get install -y docker-ce docker-ce-cli containerd.io')
    console.log('\n## Initiating Docker Swarm.')
    shell.exec(`docker swarm init --advertise-addr ${publicAddress}`)
    console.log('\n## Creating Docker network.')
    shell.exec(`docker network create ${answers.docker.networkName} --driver overlay`)
    shell.set('+e')
}
async function installMongodb() {
    const { rootPw, databaseName, username, userPw } = answers.mongodb
    mongodbJson.services.mongodb.environment = [
        `MONGODB_ROOT_PASSWORD=${rootPw}`,
        `MONGODB_USERNAME=${username}`,
        `MONGODB_PASSWORD=${userPw}`,
        `MONGODB_DATABASE=${databaseName}`
    ]
    mongodbJson.services.mongodb.networks = [networkName]
    mongodbJson.networks = {
        [networkName]: {
            driver: 'overlay',
            external: true,
            name: networkName
        }
    }
    console.log('\n## Installing MongoDB.')
    fs.writeFileSync('./mongo.yml', yaml.dump(mongodbJson))
    shell.exec(`docker stack rm coollabs-mongodb && sleep 15`)
    shell.exec(`docker volume rm coollabs-mongodb-data`)
    shell.exec(`cat ./mongo.yml | docker stack deploy -c - coollabs-mongodb`);
}
async function installCoolify() {
    const envFile = `
        DOMAIN=${answers.general.domain}
        EMAIL=${answers.general.email}
        
        JWT_SIGN_KEY=${answers.general.jwt}
        SECRETS_ENCRYPTION_KEY=${answers.general.encryptionKey}
        
        DOCKER_ENGINE=/var/run/docker.sock
        DOCKER_NETWORK=${answers.docker.networkName}
        
        MONGODB_HOST=coollabs-mongodb
        MONGODB_PORT=27017
        MONGODB_USER=${answers.mongodb.username}
        MONGODB_PASSWORD=${answers.mongodb.userPw}
        MONGODB_DB=${answers.mongodb.databaseName}
        
        VITE_GITHUB_APP_CLIENTID=${answers.github.app.clientId}
        VITE_GITHUB_APP_NAME=${answers.github.app.name}

        GITHUB_APP_CLIENT_SECRET=${answers.github.app.secret}
        GITHUB_APP_PRIVATE_KEY="${answers.github.app.privateKey.replace(/(\n|\r)+$/, '').split('\n').join('\\n')}"
        GITHUP_APP_WEBHOOK_SECRET=${answers.github.app.webhookSecret}
        `
    console.log("\n\nEverything is ready! Now let me install Coolify itself. It will take some minutes... Grab a tea or coffee!")
    shell.exec('GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no" git clone https://github.com/coollabsio/coolify.git coolify-source')
    fs.writeFileSync('./coolify-source/.env', envFile)
    shell.cd('coolify-source');
    shell.exec(`bash ./install.sh all`)
    console.log(`\nThe initial Let's Encrypt certificate requests could be slow, so be patient if you deploy a new application.`)
    console.log(`\n\nWe are done - what a ride! Visit https://${answers.general.domain} to access your cool application! :)`)

}
async function installationBasedOnPreviousConfiguration() {

    console.log('\n## Installing basic libraries')
    shell.exec('apt update')
    shell.exec('apt-get install -y bind9-dnsutils apt-transport-https ca-certificates curl gnupg-agent software-properties-common bind9-dnsutils git')
    publicAddress = shell.exec('dig @ns1-1.akamaitech.net ANY whoami.akamai.net +short').stdout.replace(/\s+/g, ' ').trim()
    const nslookup = shell.exec(`dig @1.1.1.1 A ${answers.general.domain} +short`).stdout.replace(/\s+/g, ' ').trim()

    if (nslookup !== publicAddress) {
        throw new Error(`${answers.general.domain} not matching with ${publicAddress} - it's ${nslookup}, please check again!\nIt's possible that DNS propogation needs some minutes between DNS servers. Be patient and try again later!`)
    }

    const isDockerOK = await checkDocker()
    if (!isDockerOK) await installDocker()
    await installMongodb()
    await installCoolify()
    saveConfig()
}

async function generalQuestions() {
    const domain = await inquirer
        .prompt([
            {
                type: 'input',
                name: 'domain',
                message: `Enter a <domain> for Coolify - example 'coollabs.io' or 'coolify.coollabs.io' without http/https:`,
                validate: function (value) {
                    if (value) {
                        if (isDomain(value)) {
                            return true
                        } else {
                            return 'Not valid domain!'
                        }
                    }
                    return 'Required option!';
                }
            }])
    answers.general = { ...answers.general, ...domain }
    const email = await inquirer
        .prompt([
            {
                type: 'input',
                name: 'email',
                message: `Email address for Let's Encrypt:`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            }])
    answers.general = { ...answers.general, ...email }
}
async function githubQuestions() {
    console.log('\n## Github related questions')
    const githubApp = await inquirer
        .prompt([
            {
                type: 'confirm',
                name: 'required',
                message: `Open https://github.com/settings/apps/new

Create a new Github App.

# Register new GitHub App:
GitHub App name: <could be anything weird>
Homepage URL: https://${answers.general.domain}

# Identifying and authorizing users: 
Callback URL: https://${answers.general.domain}/api/v1/login/github/app
Request user authorization (OAuth) during installation -> Check!

# Webhook:
Active -> Check!
Webhook URL: https://${answers.general.domain}/api/v1/webhooks/deploy
Webhook Secret: <it should be super secret>

# Repository permissions:
Contents: Read-only
Metadata: Read-only

# User permissions
Email addresses: Read-only

# Subscribe to events: 
Push -> Check!

Are you ready to continue?`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },
            {
                type: 'input',
                name: 'name',
                message: `Github App name:`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },
            {
                type: 'input',
                name: 'clientId',
                message: `Github App Client ID:`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },
            {
                type: 'input',
                name: 'secret',
                message: `Github App Secret (you need to generate it by clicking on 'Generate a new client secret' button):`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },
            {
                type: 'input',
                name: 'webhookSecret',
                message: `Github App Webhook secret:`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },
            {
                type: 'editor',
                name: 'privateKey',
                message: `Github Private key (you need to generate it by clicking on 'Generate private key' button):`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },

        ])
    answers.github.app = { ...githubApp }
}

async function customInstallation() {
    console.log('\n## Installing basic libraries')
    shell.exec('apt update')
    shell.exec('apt-get install -y bind9-dnsutils apt-transport-https ca-certificates curl gnupg-agent software-properties-common bind9-dnsutils git')
    publicAddress = shell.exec('dig @ns1-1.akamaitech.net ANY whoami.akamai.net +short').stdout.replace(/\s+/g, ' ').trim()

    await generalQuestions()
    const configuration = await inquirer
        .prompt([
            {
                type: 'input',
                name: 'jwt',
                message: `Enter a JWT Sign Key for signing tokens for login or accept the randomly generated:`,
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                },
                default: generateRandom(14)
            },
            {
                type: 'input',
                name: 'encryptionKey',
                message: `Enter an encryption key for encrypting secrets or accept the randomly generated (must be 32 characters long!):`,
                validate: function (value) {
                    if (value.length === 32) {
                        return true
                    }
                    return 'Must be 32 characters!';
                },
                default: generateRandom(32)
            }])
    answers.general = { ...answers.general, ...configuration }

    const nslookup = shell.exec(`dig @1.1.1.1 A ${answers.general.domain} +short`).stdout.replace(/\s+/g, ' ').trim()
    if (nslookup !== publicAddress) {
        throw new Error(`${answers.general.domain} not matching with ${publicAddress} - it's ${nslookup}, please check again!\nIt's possible that DNS propogation needs some minutes between DNS servers. Be patient and try again later!`)
    }
    console.log('\n## Docker related questions')
    const docker = await inquirer
        .prompt([
            {
                type: 'input',
                name: 'networkName',
                message: "Enter a network name for your docker environment or accept the default:",
                default: 'coollabs',
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            }
        ])
    answers.docker = { ...docker }
    const isDockerOK = await checkDocker()
    if (!isDockerOK) await installDocker()

    console.log('\n## MongoDB related questions')

    const { required } = await inquirer
        .prompt([
            {
                type: 'confirm',
                name: 'required',
                message: 'Coolify needs a MongoDB database. I will install one for you! :)',
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                }
            },
        ])
    answers.mongodb.required = required
    let mongodb = await inquirer
        .prompt([
            {
                type: 'input',
                mask: true,
                name: 'rootPw',
                message: 'Enter a root password for the new MongoDB database or accept the randomly generated:',
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                },
                default: generateRandom(18)
            },
            {
                type: 'input',
                mask: true,
                name: 'databaseName',
                message: 'Enter a database name or accept the randomly generated:',
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                },
                default: 'coolify'
            },
            {
                type: 'input',
                mask: true,
                name: 'username',
                message: 'Enter a username for the database or accept the randomly generated:',
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                },
                default: generateRandom(18)
            },
            {
                type: 'input',
                mask: true,
                name: 'userPw',
                message: 'Enter a password for the user or accept the randomly generated:',
                validate: function (value) {
                    if (value) {
                        return true
                    }
                    return 'Required option!';
                },
                default: generateRandom(18)
            },
        ])
    answers.mongodb = { ...mongodb }
    await installMongodb()
    await githubQuestions()
    await installCoolify()
    saveConfig()
}
async function expressInstallation() {
    console.log('\n## Installing basic libraries')
    shell.exec('apt update')
    shell.exec('apt-get install -y bind9-dnsutils apt-transport-https ca-certificates curl gnupg-agent software-properties-common bind9-dnsutils git')
    publicAddress = shell.exec('dig @ns1-1.akamaitech.net ANY whoami.akamai.net +short').stdout.replace(/\s+/g, ' ').trim()

    await generalQuestions()

    const nslookup = shell.exec(`dig @1.1.1.1 A ${answers.general.domain} +short`).stdout.replace(/\s+/g, ' ').trim()
    if (nslookup !== publicAddress) {
        throw new Error(`\n\n${answers.general.domain} not matching with ${publicAddress} - it's ${nslookup}, please check again!\nIt's possible that DNS propogation needs some minutes between DNS servers. Be patient and try again later!\n\n`.bold.red)
    }
    const isDockerOK = await checkDocker()
    if (!isDockerOK) await installDocker()
    await installMongodb()
    await githubQuestions()
    await installCoolify()
    saveConfig()
}
function saveConfig() {
    fs.writeFileSync(`${process.cwd()}/../config.json`, JSON.stringify(answers))
}
async function coolifyMe() {
    try {
        let useConfigJson = false
        const originalConfigFile = './coolify-source/config.json';
        const newConfigFile = './config.json';
        shell.config.silent = !options.debug;
        console.log('## HINT: For debug mode run: sh <(curl -fsSL https://get.coollabs.io/install.sh) coolify -d\n')
        const isOriginalConfFileExists = fs.existsSync(originalConfigFile)
        const isConfFileExists = fs.existsSync(newConfigFile)
        if (isOriginalConfFileExists || isConfFileExists) {
            if (isOriginalConfFileExists) configJson = JSON.parse(fs.readFileSync(originalConfigFile).toString('utf8'))
            if (isConfFileExists) configJson = JSON.parse(fs.readFileSync(newConfigFile).toString('utf8'))

            answer = await inquirer
                .prompt([
                    {
                        type: 'confirm',
                        name: 'useConfigJson',
                        message: `I found a previous configuration. Do you want to use it for installation?`,
                        validate: function (value) {
                            if (value) {
                                return true
                            }
                            return 'Required option!';
                        }
                    },
                ])
            useConfigJson = answer.useConfigJson
        }
        if (useConfigJson) {
            answers = { ...configJson }
            await installationBasedOnPreviousConfiguration()
        } else {
            const { express } = await inquirer
                .prompt([
                    {
                        type: 'confirm',
                        name: 'express',
                        message: `Hey. Welcome to Coolify's installer!
                        
It will install/update many stuffs on your operating system automatically, which is needed for Coolify to be running! By continuing you accept this!
    
There are 2 ways of installation:
- express (recommended) - lots of stuffs generated automatically behind the scenes, like secure passwords, etc.
- custom - you can fill all values by hand.
    
Would you like the express installation (recommended)?`,
                        validate: function (value) {
                            if (value) {
                                return true
                            }
                            return 'Required option!';
                        }
                    },
                ])
            if (express) {
                await expressInstallation()
            } else {
                await customInstallation()
            }

        }
    } catch (error) {
        console.log(error)
    }

}

coolifyMe()