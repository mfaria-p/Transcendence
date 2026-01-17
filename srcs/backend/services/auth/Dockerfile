FROM node:20-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json
COPY packages/lib-docs/package.json ./packages/lib-docs/package.json
COPY services/auth/package.json ./services/auth/package.json

RUN corepack enable && pnpm install --filter "@svc/auth..." --frozen-lockfile

COPY packages/lib-auth ./packages/lib-auth
COPY packages/lib-docs ./packages/lib-docs
COPY services/auth ./services/auth

ENV DATABASE_URL=file:/app/prisma/data/account.db
RUN pnpm --filter "@svc/auth" exec prisma generate --schema /app/services/auth/prisma/schema.prisma
RUN mv ./services/auth/src/generated/prisma/libquery_engine-linux-musl-openssl-*.so.node ./services/auth/prisma

RUN pnpm -r --filter "@svc/auth..." run build
RUN pnpm --filter "@svc/auth" deploy --prod /out

FROM node:20-alpine AS run
WORKDIR /app

COPY --from=build /out .

ENV DATABASE_URL=file:/app/prisma/data/account.db
RUN mkdir -p /app/prisma/data
RUN chown -R node:node /app/prisma/data
RUN pnpm --filter "@svc/auth" exec prisma migrate deploy --schema /app/services/auth/prisma/schema.prisma

CMD ["node","dist/server.js"]
