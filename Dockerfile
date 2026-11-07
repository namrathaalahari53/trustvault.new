FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
COPY .env.example ./.env.example

RUN mkdir -p /app/.local-data /app/private-storage

ENV NODE_ENV=production
ENV API_PORT=5106
ENV SCANNER_MODE=development-allow

EXPOSE 4200 5106

CMD ["node", "scripts/start-all.mjs"]
