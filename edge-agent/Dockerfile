FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV OPESFUEL_OUTBOX_PATH=/data/outbox.jsonl
VOLUME ["/data"]
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
EXPOSE 9201
CMD ["node", "dist/index.js"]
