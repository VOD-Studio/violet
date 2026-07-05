# syntax=docker/dockerfile:1
# 临时 Dockerfile（仅本次部署使用，不入库）
# 2.0 SSR（TanStack Start + Vite 8）：vite build 产出 dist/server/server.js（Nitro 入口）
# builder 阶段构建后 prune 出生产依赖，runtime 阶段 COPY dist + node_modules

# ─── 阶段 1：依赖安装 ───────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# postinstall 脚本会把 pdf.worker.min.mjs 复制到 public/，deps 阶段没有源码，
# 需预先创建 public/ 否则 ENOENT
RUN mkdir -p public

RUN pnpm install --frozen-lockfile

# ─── 阶段 2：构建 SSR 产物 ───────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /app

# CI=true：pnpm 在 CI 模式下不会因 node_modules 与 lockfile 状态不一致而交互式确认
ENV CI=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建期注入 Vite 环境变量（见 web/src/shared/config/env.ts）
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_SSR_API_BASE_URL=http://api:9090/api/v1
ARG VITE_SITE_URL=https://xunrua.top
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SSR_API_BASE_URL=$VITE_SSR_API_BASE_URL \
    VITE_SITE_URL=$VITE_SITE_URL

RUN pnpm run build

# 剪掉开发依赖，只保留运行时依赖（server.js 运行需要 react、axios 等）
RUN pnpm prune --prod

# ─── 阶段 3：运行时 ─────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Nitro server 监听 HOST/PORT；HOST=0.0.0.0 才能被容器外访问
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# 复制构建产物（dist/server/server.js 是 SSR handler）、生产依赖、node 启动器
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# server.mjs 在仓库根，构建时 COPY 进 builder 后再带到 runtime
COPY --from=builder /app/server.mjs ./server.mjs

EXPOSE 3000

# 用 node:http wrapper 启动 SSR（dist/server/server.js 只导出 { fetch }，不监听端口）
CMD ["node", "server.mjs"]
