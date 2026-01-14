FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/lib-auth/package.json ./packages/lib-auth/package.json
COPY packages/lib-docs/package.json ./packages/lib-docs/package.json
COPY services/auth/package.json ./services/auth/package.json

RUN pnpm install --filter "@svc/auth..." --frozen-lockfile

COPY packages/lib-auth ./packages/lib-auth
COPY packages/lib-docs ./packages/lib-docs
COPY services/auth ./services/auth

RUN pnpm --filter "@svc/auth" exec prisma generate --schema /app/services/auth/prisma/schema.prisma

RUN pnpm -r --filter "@svc/auth..." run build
RUN pnpm --filter "@svc/auth" deploy --prod /out

FROM node:20-alpine AS run
WORKDIR /app

COPY --from=build /out .

COPY --from=build /app/services/auth/entry.sh /entry.sh
RUN chmod +x /entry.sh

CMD ["/entry.sh"]
