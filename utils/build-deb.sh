#!/bin/bash

export DOCKER_BUILDKIT=1
SSH_DEPLOY_KEY=$(bw get attachment ccs_crab_deploy_key.b64 --itemid ssh.key.coral_deploy_key --raw)

docker build --build-arg SSH_DEPLOY_KEY=$SSH_DEPLOY_KEY -t hailstorm-deb  . -f docker/debian.dockerfile
docker run -it -v $(pwd)/artifacts:/artifacts hailstorm-deb cp -r /app/src-tauri/target/release/bundle /artifacts/
