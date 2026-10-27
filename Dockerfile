# ---- Стадия сборки ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.js index.html ./
COPY src ./src
COPY shared ./shared
COPY server ./server

# Сборка фронтенда (TypeScript через Vite/esbuild) и проверка типов сервера
RUN npm run build

# ---- Стадия рантайма (сервер: API + раздача статики) ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared

EXPOSE 8787
USER node
CMD ["node", "server/index.cjs"]
