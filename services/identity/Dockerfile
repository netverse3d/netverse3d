FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/nest-kit packages/nest-kit
COPY services/identity services/identity
RUN pnpm install --frozen-lockfile --filter "@netverse/identity..."
RUN pnpm --filter "@netverse/identity..." build
RUN pnpm --filter @netverse/identity deploy --legacy --prod /out
RUN cd /out && node_modules/.bin/prisma generate

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT:-3000}/livez || exit 1
CMD ["node", "dist/main"]
