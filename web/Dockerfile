# 前端生产 Dockerfile（多阶段构建）
#
# 2.0 SSR：从 Nginx 静态托管改为 Node 运行 TanStack Start Nitro server。
# Nitro server 自己托管 .output/public 静态资源并处理 SSR 渲染。
#
# 阶段 1: Node 构建 SSR 产物（.output/）
# 阶段 2: Node 运行时启动 Nitro server
#
# 用法: docker build -t mimo-blog-web ./web
# 配合 docker-compose.prod.yml 使用

# ============================================================
# 阶段 1: 构建
# ============================================================
FROM node:22-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 无 TTY 环境下让 pnpm 自动确认（如 lockfile 变化时需要清理 node_modules）
ENV CI=true

WORKDIR /app

# 先拷贝 lockfile 利用 Docker 缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# 安装依赖（frozen-lockfile 保证可复现）
RUN pnpm install --frozen-lockfile

# 拷贝源码
COPY . .

# 构建 SSR 产物：vite build 产出 .output/（server + public）
RUN pnpm build

# ============================================================
# 阶段 2: 运行时（Node 启动 Nitro server）
# ============================================================
FROM node:22-alpine AS runtime

WORKDIR /app

# 拷贝 Nitro 构建产物（.output/server + .output/public）
COPY --from=builder /app/.output ./.output

# Nitro server 监听所有网络接口（容器内必须 0.0.0.0 才能被外部访问）
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

# 健康检查：探测 Nitro server 根路径
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

EXPOSE 3000

# 启动 Nitro server
CMD ["node", ".output/server/index.mjs"]
