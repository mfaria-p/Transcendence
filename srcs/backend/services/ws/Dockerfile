FROM node:22-alpine

WORKDIR /app

# 1) Manifests da raiz do monorepo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json

# 2) Manifests + código do serviço ws
COPY services/ws/package.json services/ws/tsconfig.json ./services/ws/
COPY packages/lib-auth ./packages/lib-auth
COPY services/ws/src ./services/ws/src

# 3) Instalar deps do monorepo (apenas o serviço ws e lib-auth)
RUN corepack enable && pnpm install --filter '@svc/ws...' --frozen-lockfile
RUN pnpm -r --filter "@pkg/lib-auth" run build

# 4) Build TS -> JS para o serviço ws
RUN pnpm --filter "@svc/ws" run build

# 5) Runtime
WORKDIR /app/services/ws
EXPOSE 3003

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]