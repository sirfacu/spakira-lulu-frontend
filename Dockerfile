# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:9001
ENV NITRO_PRESET=node-server \
    VITE_API_URL=$VITE_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build SSR/node server + assets (static/ se copia como publicDir)
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9000
ENV HOST=0.0.0.0

# Nitro / TanStack Start output
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json

# Estáticos listos para sincronizar a S3/CloudFront (también servidos por Nitro)
COPY --from=build /app/static ./static

EXPOSE 9000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:9000/ >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
