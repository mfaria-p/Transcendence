FROM node:22-alpine

# Trabalhamos a partir da raiz do monorepo (backend)
WORKDIR /app

# 1) Manifests da raiz (para cache de deps)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json

# 2) Manifests + código do serviço gateway
COPY services/gateway/package.json services/gateway/tsconfig.json ./services/gateway/
COPY packages/lib-auth ./packages/lib-auth
COPY services/gateway/src ./services/gateway/src

# 3) Instalar deps do monorepo (pnpm workspaces)
RUN corepack enable && pnpm install --filter '@svc/gateway...' --frozen-lockfile
RUN pnpm -r --filter "@pkg/lib-auth" run build

# 4) Build TS -> JS para o gateway
RUN pnpm --filter "@svc/gateway" run build

# 5) Runtime
WORKDIR /app/services/gateway
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]