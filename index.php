<?php
// php8.0-mbstring php8.0-curl php8.0-yaml
parse_str($_SERVER["QUERY_STRING"], $query);
function random_str(
    $length,
    $keyspace = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
) {
    $str = '';
    $max = mb_strlen($keyspace, '8bit') - 1;
    if ($max < 1) {
        throw new Exception('$keyspace must be at least two characters long');
    }
    for ($i = 0; $i < $length; ++$i) {
        $str .= $keyspace[random_int(0, $max)];
    }
    return $str;
}
function dump_chunk($chunk)
{
    echo $chunk;
    echo '<script>confetti();</script>';
    flush();
    ob_flush();
}
function bash($cmd)
{
    exec("$cmd 2>&1", $output, $rc);
    if ($rc > 0) {
        dump_chunk("<br/>Command: $cmd failed<br/>");
        die();
    }

    return implode(" ", $output);
}
function installCoolify($domain, $mongodbRootPassword, $mongodbUser, $mongodbPassword, $mongodbDB)
{
    header('Content-Type: text/html; charset=UTF-8');
    flush();
    $mongodb = array(
        "version" => "3.8",
        "services" => array(
            "mongodb" => array(
                "image" => "bitnami/mongodb:4.4",
                "hostname" => "coollabs-mongodb",
                "environment" => array(
                    "MONGODB_ROOT_PASSWORD=$mongodbRootPassword",
                    "MONGODB_USERNAME=$mongodbUser",
                    "MONGODB_PASSWORD=$mongodbPassword",
                    "MONGODB_DATABASE=$mongodbDB"
                ),
                "volumes" => array(
                    "coollabs-mongodb-data:/bitnami/mongodb"
                ),
                "networks" => array(
                    "coollabs"
                )
            )
        ),
        "volumes" => array(
            "coollabs-mongodb-data" => array(
                "external" => true
            )
        ),
        "networks" => array(
            "coollabs" => array(
                "driver" => "overlay",
                "external" => true,
                "name" => "coollabs"
            )
        )
    );
    $myfile = fopen("mongo.yaml", "w") or die("Unable to open file!");
    fwrite($myfile, yaml_emit($mongodb));
    fclose($myfile);
    flush();
    ob_flush();
    dump_chunk('Installation started, please wait! It only takes ~2-3 minutes!<br/><br/>');
    $IPv4 = bash('curl -s http://ipecho.net/plain');
    system("docker swarm init --advertise-addr $IPv4 >/dev/null");
    system("docker network create coollabs --driver overlay >/dev/null");

    dump_chunk('Cloning GitHub Repository... ');
    $starttime = microtime(true);
    system("find ./coolify -mindepth 1 -delete >/dev/null");
    bash("GIT_SSH_COMMAND=\"ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no\" git clone https://github.com/coollabsio/coolify.git coolify");
    $endtime = microtime(true);
    $timediff = round(($endtime - $starttime) * 1000);
    dump_chunk("$timediff ms<br/>");

    dump_chunk('Removing old MongoDB... ');
    $starttime = microtime(true);
    system('docker stack rm coollabs-mongodb >/dev/null && sleep 10');
    system('docker volume rm -f coollabs-mongodb-data >/dev/null');
    $endtime = microtime(true);
    $timediff = round(($endtime - $starttime) * 1000);
    dump_chunk("$timediff ms<br/>");


    dump_chunk('Removing old Coolify... ');
    $starttime = microtime(true);
    system('docker stack rm coollabs-coolify >/dev/null');
    $endtime = microtime(true);
    $timediff = round(($endtime - $starttime) * 1000);
    dump_chunk("$timediff ms<br/>");

    dump_chunk('Building Coolify... ');
    $starttime = microtime(true);
    bash("cp mongo.yaml .env coolify/");
    bash("cd coolify/ && docker build -t coolify -f install/Dockerfile-new .");
    $endtime = microtime(true);
    $timediff = round($endtime - $starttime);
    dump_chunk("$timediff s<br/>");

    dump_chunk('Deploying MongoDB... ');
    $starttime = microtime(true);
    bash("cat coolify/mongo.yaml | docker stack deploy -c - coollabs-mongodb");
    $endtime = microtime(true);
    $timediff = round(($endtime - $starttime) * 1000);
    dump_chunk("$timediff ms<br/>");

    dump_chunk('Deploying Coolify... ');
    $starttime = microtime(true);
    bash('bash -c "cd coolify && set -a && source .env && set +a && envsubst < install/coolify-template.yml | docker stack deploy -c - coollabs-coolify"');
    $endtime = microtime(true);
    $timediff = round(($endtime - $starttime) * 1000);
    dump_chunk("$timediff ms<br/><br/><br/>");

    dump_chunk("Done! 🎉 Please wait 1-2 minutes until the SSL cert is automatically generated. <br /> <div class='text-center pt-10'><a href='https://$domain' class='underline font-bold text-xl  '>https://$domain</a></div>");
    system("docker stop -t 0 coollabs-installer");
    die();
}

?>

<!DOCTYPE html>
<html>

<head>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.4.0/dist/confetti.browser.min.js"></script>
    <link href="https://unpkg.com/tailwindcss@^2/dist/tailwind.min.css" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;700&display=swap" rel="stylesheet">
    <title>
        coolLabs installer
    </title>
    <style>
        html {
            font-family: 'Raleway', sans-serif;
            color: white;
        }

        body {
            background-color: rgba(22, 22, 22);
        }


        input {
            padding-left: 10px;
            color: black;
        }

        .rainbow-button {

            min-width: 513.7px;
            max-width: 513.7px;
            animation: slidebg 2s linear infinite both !important;
            background-image: linear-gradient(90deg, #00C0FF 0%, #FFCF00 49%, #FC4F4F 80%, #00C0FF 100%);
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;

        }

        .rainbow-button:after {

            content: attr(alt);
            background-color: #191919;
            display: flex;
            align-items: center;
            justify-content: center;
        }


        @keyframes slidebg {

            to {
                background-position: 513.7px;
            }
        }
    </style>
</head>

<body class="flex h-screen">
    <div class="m-auto px-6">
        <div id="console">
            <div class="font-mono text-xs bg-black rounded p-10">
                <?php
                if (isset($query['code']) && isset($query['state'])) {
                    global $query;
                    $code = $query['code'];
                    $email = $query['state'];
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, "https://api.github.com/app-manifests/$code/conversions");
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_FAILONERROR, false);
                    curl_setopt($ch, CURLINFO_HEADER_OUT, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt(
                        $ch,
                        CURLOPT_HTTPHEADER,
                        array(
                            'Content-Type: application/json',
                            "User-Agent: curl"
                        )
                    );
                    $result = curl_exec($ch);
                    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    if ($httpcode != 200 && $httpcode != 201) {
                        http_response_code($httpcode);
                        file_put_contents('php://stderr', print_r(http_response_code($httpcode), TRUE));
                        echo print_r($result, TRUE);
                        curl_close($ch);
                        die();
                    }
                    curl_close($ch);
                    $result = json_decode($result);
                    $domain = explode('https://', $result->external_url)[1];
                    $myfile = fopen(".env", "w") or die("Unable to open file!");
                    $txt = "DOMAIN=$domain\n";
                    fwrite($myfile, $txt);
                    $txt = "EMAIL=$email\n";
                    fwrite($myfile, $txt);
                    $txt = "JWT_SIGN_KEY=" . random_str(14) . "\n";
                    fwrite($myfile, $txt);
                    $txt = "SECRETS_ENCRYPTION_KEY=" . random_str(32) . "\n";
                    fwrite($myfile, $txt);
                    $txt = "DOCKER_ENGINE=/var/run/docker.sock\n";
                    fwrite($myfile, $txt);
                    $txt = "DOCKER_NETWORK=coollabs\n";
                    fwrite($myfile, $txt);
                    $txt = "MONGODB_HOST=coollabs-mongodb\n";
                    fwrite($myfile, $txt);
                    $txt = "MONGODB_PORT=27017\n";
                    fwrite($myfile, $txt);
                    $mongodbRootPassword = random_str(19);
                    $txt = "MONGODB_ROOT_PASSWORD={$mongodbRootPassword}\n";
                    fwrite($myfile, $txt);
                    $mongodbUser = random_str(12);
                    $txt = "MONGODB_USER={$mongodbUser}\n";
                    fwrite($myfile, $txt);
                    $mongodbPassword = random_str(18);
                    $txt = "MONGODB_PASSWORD={$mongodbPassword}\n";
                    fwrite($myfile, $txt);
                    $mongodbDB = "coolify";
                    $txt = "MONGODB_DB={$mongodbDB}\n";
                    fwrite($myfile, $txt);
                    $txt = "VITE_GITHUB_APP_CLIENTID={$result->client_id}\n";
                    fwrite($myfile, $txt);
                    $txt = "VITE_GITHUB_APP_NAME={$result->slug}\n";
                    fwrite($myfile, $txt);
                    $txt = "GITHUB_APP_CLIENT_SECRET={$result->client_secret}\n";
                    fwrite($myfile, $txt);
                    $txt = "GITHUB_APP_PRIVATE_KEY=" . str_replace("\/", "/", json_encode($result->pem)) . "\n";
                    fwrite($myfile, $txt);
                    $txt = "GITHUP_APP_WEBHOOK_SECRET={$result->webhook_secret}\n";
                    fwrite($myfile, $txt);
                    fclose($myfile);
                    installCoolify($domain, $mongodbRootPassword, $mongodbUser, $mongodbPassword, $mongodbDB);
                }

                ?>
            </div>

        </div>

        <div id="installer">
            <h1 class="text-3xl font-bold  text-center uppercase">Coolify</h1>
            <div class=" text-center text-xs uppercase pb-4 text-gray-400">Installer</div>
            <div class="flex-col space-y-8">
                <div>
                    <div>
                        <label for="email" class="block text-sm font-medium text-white">Domain</label>
                        <div class="mt-1">
                            <input type="text" id="domain" name="domain" class="py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="coolify.coollabs.io">
                        </div>
                        <p class="mt-2 text-xs text-gray-300" id="email-description">Your Coolify instance will be available in this domain. No https://, only the domain.</p>
                    </div>
                </div>
                <div>
                    <div>
                        <label for="email" class="block text-sm font-medium text-white">Email</label>
                        <div class="mt-1">
                            <input type="text" id="email" name="email" class=" py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="example@example.com" aria-describedby="email-description">
                        </div>
                        <p class="mt-2 text-xs text-gray-300" id="email-description">Only required to receive emails from Let's Encrypt regarding your SSL Certs.</p>
                    </div>
                </div>
            </div>
            <div id="github" class="py-6 space-y-4">
                <div>
                    <input type="checkbox" id="isOrganization" name="isOrganization" onclick="isOrgranization()" />
                    <label for="isOrganization" class="text-sm">Are you installing for a GitHub organization?</label>
                    <div class="text-xs text-gray-300 mt-1" for="isOrganization">
                        If you would like to use repositories under a GitHub organization, check this one.
                    </div>
                </div>
                <div id="isOrg" style="display:none">
                    <div>
                        <label for="email" class="block text-sm font-medium text-white">GitHub Organization name</label>
                        <div class="mt-1">
                            <input type="input" id="organization" name="organization" class=" py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="coollabsio" aria-describedby="github-organization">
                        </div>
                    </div>
                </div>
            </div>
            <div class="text-center">
                <button class="rainbow-button mx-auto" type="submit" id="registerGithub" name="registerGithub" onclick="registerGH()">
                    <div class="p-2 px-4 font-bold text-xl transform duration-200  hover:scale-110"> Get started 🚀</div>
                </button>
            </div>
        </div>
        <script>
            const params = new URLSearchParams(window.location.search);
            if (params.get("install") || (params.get("code") && params.get("state"))) {
                document.getElementById("installer").style.display = 'none'
                document.getElementById("console").style.display = 'block'
            } else {
                document.getElementById("installer").style.display = 'block'
                document.getElementById("console").style.display = 'none'
            }

            function registerGH() {
                if (document.getElementById("domain").value && document.getElementById("email").value) {
                    let url = 'settings/apps/new';
                    const local = window.location.host;
                    const domain = document.getElementById("domain").value
                    const email = document.getElementById("email").value
                    const isOrgranization = document.getElementById("isOrganization").checked
                    const organization = document.getElementById("organization").value ? true : false
                    if (isOrgranization || organization) {
                        if (document.getElementById("organization").value) {
                            url = `organizations/${document.getElementById("organization").value}/settings/apps/new`;
                        }
                    }
                    const data = JSON.stringify({
                        name: `coolify-${domain}`,
                        url: `https://${domain}`,
                        hook_attributes: {
                            url: `https://${domain}/api/v1/webhooks/deploy`
                        },
                        redirect_url: `http://${local}/`,
                        callback_urls: [`https://${domain}/api/v1/login/github/app`],
                        public: false,
                        request_oauth_on_install: true,
                        default_permissions: {
                            contents: 'read',
                            metadata: 'read',
                            pull_requests: 'read',
                            emails: 'read'
                        },
                        default_events: ['pull_request', 'push']
                    });

                    const form = document.createElement("form");
                    form.setAttribute("method", "post");
                    form.setAttribute("action", `https://github.com/${url}?state=${email}`);
                    const input = document.createElement("input")
                    input.setAttribute("id", "manifest")
                    input.setAttribute("name", "manifest")
                    input.setAttribute("type", "hidden")
                    input.setAttribute("value", data)
                    form.appendChild(input)
                    document.getElementsByTagName("body")[0].appendChild(form);
                    form.submit()
                }

            }

            function isOrgranization() {
                const isOrg = document.getElementById("isOrg");
                isOrg.style.display === "none" ? isOrg.style.display = "block" : isOrg.style.display = "none"

            }
        </script>
</body>


</html>