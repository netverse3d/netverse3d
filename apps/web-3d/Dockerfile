FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @netverse/web-3d build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/web-3d/out /usr/share/nginx/html
EXPOSE 80
