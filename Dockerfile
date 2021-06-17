FROM php:8-alpine
RUN apk update && apk add --no-cache php8-curl php8-mbstring gcc musl-dev make autoconf yaml-dev git bash 
RUN pecl install yaml && docker-php-ext-enable yaml
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-20.10.7.tgz | tar -xzvf - docker/docker -C . --strip-components 1 && mv docker /usr/bin/docker
RUN curl -L https://github.com/a8m/envsubst/releases/download/v1.2.0/envsubst-`uname -s`-`uname -m` -o /usr/bin/envsubst
RUN chmod +x /usr/bin/envsubst /usr/bin/docker
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY . /usr/src/app/coollabs
WORKDIR /usr/src/app/coollabs
CMD echo -e "####################################\nInstaller started on http://`curl -s http://ipecho.net/plain`:8080\n####################################\n" && php -S 0.0.0.0:8080
