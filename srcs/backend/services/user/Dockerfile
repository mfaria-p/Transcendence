FROM node:20-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json
COPY packages/lib-docs/package.json ./packages/lib-docs/package.json
COPY services/user/package.json ./services/user/package.json

RUN corepack enable && pnpm install --filter "@svc/user..." --frozen-lockfile

COPY packages/lib-auth ./packages/lib-auth
COPY packages/lib-docs ./packages/lib-docs
COPY services/user ./services/user

ENV DATABASE_URL=file:/app/prisma/data/profile.db
RUN pnpm --filter "@svc/user" exec prisma generate --schema /app/services/user/prisma/schema.prisma
RUN mv ./services/user/src/generated/prisma/libquery_engine-linux-musl-openssl-*.so.node ./services/user/prisma

RUN pnpm -r --filter "@svc/user..." run build
RUN pnpm --filter "@svc/user" deploy --prod /out

FROM node:20-alpine AS run
WORKDIR /app

COPY --from=build /out .

ENV DATABASE_URL=file:/app/prisma/data/profile.db
RUN mkdir -p /app/prisma/data
RUN chown -R node:node /app/prisma/data
RUN npx prisma@6.17.0 migrate deploy --schema /app//prisma/schema.prisma

CMD ["node","dist/server.js"]
