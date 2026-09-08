# ── Sparring Partner — self-hosted image ─────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
# better-sqlite3 has no prebuilt binary for alpine (musl) and compiles from
# source, which needs a toolchain the slim base image does not carry.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
# package-lock.json is resolved by npm 12; the npm 10 bundled with this image
# builds a different tree from it and fails `npm ci` on a hoisting mismatch.
# Pin the resolver so the image installs exactly what the lock file describes.
RUN npm i -g npm@12.0.2 && npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SP_DATABASE_PATH=/data/sparring.db

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

VOLUME ["/data"]
CMD ["node", "server.js"]
