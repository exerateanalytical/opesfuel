# Stage 1: Build TypeScript React Frontend
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
ARG VITE_API_BASE_URL=
ARG VITE_AUTH0_DOMAIN=
ARG VITE_AUTH0_CLIENT_ID=
ARG VITE_AUTH0_AUDIENCE=https://api.opesfuel.com/v1
ARG VITE_DEMO_URL=
ARG VITE_OIDC_ISSUER=
ARG VITE_OIDC_CLIENT_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_DEMO_URL=$VITE_DEMO_URL
ENV VITE_OIDC_ISSUER=$VITE_OIDC_ISSUER
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID
RUN npm run build

# Stage 2: Production Node.js Server serving compiled SPA + secured AI proxy
FROM node:24-alpine
RUN addgroup -S opesfuel && adduser -S opesfuel -G opesfuel && apk add --no-cache curl
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm install tsx --no-audit --no-fund
COPY --from=builder /app/dist ./dist
COPY server.ts ./
ENV NODE_ENV=production
ENV PORT=3000
USER opesfuel
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -sf http://localhost:3000/api/health || exit 1
CMD ["npx", "tsx", "server.ts"]
