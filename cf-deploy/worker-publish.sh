#!/usr/bin/env bash

npm i @cloudflare/wrangler -g
CF_ACCOUNT_ID=$CF_ACCOUNT_ID CF_API_TOKEN=$CF_API_TOKEN wrangler publish --env kowospace

if [ $? -eq 0 ]; then
  echo "Last successful deploy: $(date)" > cf-deploy/index.html
  exit 0
else
  exit 1
fi
