FROM rust:1.88-slim-bookworm as image

ARG SSH_DEPLOY_KEY

RUN apt-get update -yqq && \
    apt-get install -yqq --no-install-recommends gnupg build-essential curl openssh-client wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev cmake protobuf-compiler libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libwebkit2gtk-4.1-dev && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    curl -fsSL https://deb.nodesource.com/setup_current.x | bash - && \
    apt update && apt-get install -yqq --no-install-recommends nodejs yarn && \
    apt-get clean

WORKDIR app
COPY package.json yarn.lock /app/
RUN yarn install --frozen-lockfile
COPY tsconfig.json /app/
COPY public /app/public
COPY src /app/src
COPY src-tauri /app/src-tauri
COPY dist/linux/xdg /app/dist/linux/xdg


RUN eval $(ssh-agent -s) && \
    echo "$SSH_DEPLOY_KEY" | base64 -d | tr -d '\r' | ssh-add - && \
    yarn tauri build -b deb 
