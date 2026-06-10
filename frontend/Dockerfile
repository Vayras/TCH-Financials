FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ARG NEXT_PUBLIC_API_BASE=/api
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}

# Baked into the Next.js rewrite at build time (see next.config.ts).
ARG API_PROXY_TARGET=http://backend:8000
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=5000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 5000

CMD ["node", "server.js"]
