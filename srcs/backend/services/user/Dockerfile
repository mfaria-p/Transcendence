FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json
COPY packages/lib-docs/package.json ./packages/lib-docs/package.json
COPY services/user/package.json ./services/user/package.json
RUN pnpm install --filter "@svc/user..." --frozen-lockfile
COPY packages/lib-auth ./packages/lib-auth
COPY packages/lib-docs ./packages/lib-docs
COPY services/user ./services/user
RUN npx prisma generate --schema ./services/user/prisma/schema.prisma
RUN pnpm -r --filter "@svc/user..." run build
RUN pnpm --filter "@svc/user" deploy --prod /out

FROM node:20-alpine AS run
WORKDIR /app
COPY --from=build /out .
RUN npx prisma migrate deploy --schema ./prisma/schema.prisma
RUN mv ./src/generated/prisma/libquery_engine-linux-musl-openssl-*.so.node ./prisma
CMD ["node","dist/server.js"]
