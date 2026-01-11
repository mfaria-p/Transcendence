#!/bin/sh
set -e

mkdir -p /app/prisma/data
chown -R node:node /app/prisma/data

npx prisma@"${PRISMA_CLI_VERSION}" migrate deploy --schema ./prisma/schema.prisma

exec node dist/server.js
