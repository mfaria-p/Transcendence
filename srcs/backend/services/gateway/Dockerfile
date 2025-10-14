FROM node:22-alpine

# Trabalhamos a partir da raiz do monorepo (backend)
WORKDIR /app

# 1) Manifests da raiz (para cache de deps)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# 2) Manifests + código do serviço gateway
COPY services/gateway/package.json services/gateway/tsconfig.json ./services/gateway/
COPY services/gateway/src ./services/gateway/src

# 3) Instalar deps do monorepo (pnpm workspaces)
RUN corepack enable && pnpm install --frozen-lockfile

# 4) Correr o serviço gateway
WORKDIR /app/services/gateway
EXPOSE 3000
CMD ["pnpm", "dev"]