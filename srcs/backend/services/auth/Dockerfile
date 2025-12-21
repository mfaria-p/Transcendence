FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app

# Manifests do monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json
COPY packages/lib-docs/package.json ./packages/lib-docs/package.json
COPY services/auth/package.json ./services/auth/package.json

# Instalar apenas o necessário para o serviço auth + libs
RUN pnpm install --filter "@svc/auth..." --frozen-lockfile

# Copiar código
COPY packages/lib-auth ./packages/lib-auth
COPY packages/lib-docs ./packages/lib-docs
COPY services/auth ./services/auth

# Prisma client (engines ficam em node_modules/.prisma)
RUN pnpm --filter "@svc/auth" exec prisma generate --schema /app/services/auth/prisma/schema.prisma

# Build TS para JS + deploy
RUN pnpm -r --filter "@svc/auth..." run build
RUN pnpm --filter "@svc/auth" deploy --prod /out

# ---------- RUNTIME STAGE ----------
FROM node:20-alpine AS run
WORKDIR /app

COPY --from=build /out .

# Aqui definimos a ligação SQLite usada pelo Prisma no container
ENV DATABASE_URL="file:./auth.db"
ENV PRISMA_CLI_VERSION=6.17.0

RUN npx prisma@${PRISMA_CLI_VERSION} generate --schema ./prisma/schema.prisma
RUN npx prisma@${PRISMA_CLI_VERSION} migrate deploy --schema ./prisma/schema.prisma

CMD ["node","dist/server.js"]
