FROM node:26-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:26-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG SURLS_GIT_SHA=""
ENV NEXT_PUBLIC_GIT_SHA=${SURLS_GIT_SHA}
RUN --mount=type=secret,id=next_server_actions_encryption_key,required=false,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY npm run build

FROM node:26-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node --from=builder /app/scripts/bootstrap.mjs ./scripts/bootstrap.mjs
COPY --chown=node:node --from=builder /app/scripts/docker-entrypoint.mjs ./scripts/docker-entrypoint.mjs
COPY --chown=node:node --from=builder /app/scripts/seed-demo.mjs ./scripts/seed-demo.mjs
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ARG SURLS_GIT_SHA=""
ENV NEXT_PUBLIC_GIT_SHA=${SURLS_GIT_SHA}
ENV SURLS_GIT_SHA=${SURLS_GIT_SHA}
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
LABEL org.opencontainers.image.title="Surls"
LABEL org.opencontainers.image.description="Personal short URL system"
LABEL org.opencontainers.image.revision="${SURLS_GIT_SHA}"
USER node
ENTRYPOINT ["node", "scripts/docker-entrypoint.mjs"]
CMD ["node", "server.js"]
