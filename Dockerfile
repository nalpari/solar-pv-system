FROM node:20-alpine AS base

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@10 --activate

# --- 의존성 설치 ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- 빌드 ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_AWS_S3_BASE_URL
ARG NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_AWS_S3_BASE_URL=$NEXT_PUBLIC_AWS_S3_BASE_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# 빌드 전 검증 (lint·타입체크) — Jenkins 호스트에 Node 없이 컨테이너 안에서 일원화 수행
RUN pnpm lint
RUN pnpm exec tsc --noEmit
RUN pnpm build

# --- 프로덕션 ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
