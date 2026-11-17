#!/bin/sh
# Roda toda semana no Raspberry (cron): baixa os dados mais novos do jogo e recria o container.
# Se o build falhar, o container antigo continua no ar.
set -e
cd "$(dirname "$0")/.."
export DATA_VERSION="$(date +%F)"
docker compose build >> update.log 2>&1 && docker compose up -d >> update.log 2>&1
echo "$(date -Is) ok dados $DATA_VERSION" >> update.log
docker image prune -f >/dev/null 2>&1 || true
