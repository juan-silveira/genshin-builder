# --- build: dados do jogo, interface e servidor empacotado
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# muda a cada atualização agendada: força baixar de novo os dados do jogo (Enka, genshin-db, mapa)
ARG DATA_VERSION=manual
RUN echo "dados: $DATA_VERSION" && npm run update-data && npm run validate-data && npx vite build && node scripts/bundle-server.mjs

# --- runtime: só o necessário, sem node_modules
FROM node:24-alpine
ENV NODE_ENV=production APP_ROOT=/app STATE_DIR=/state PORT=8787 HOST=0.0.0.0
WORKDIR /app
COPY --from=build /src/dist ./dist
COPY --from=build /src/build/server.mjs ./server.mjs
COPY --from=build /src/build/import.mjs ./import.mjs
COPY --from=build /src/data/enka ./data/enka
COPY --from=build /src/data/gamedb ./data/gamedb
COPY --from=build /src/data/guides ./data/guides
RUN mkdir -p /state && chown node:node /state
USER node
VOLUME /state
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/auth/me >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
