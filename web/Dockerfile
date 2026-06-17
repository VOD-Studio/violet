# 前端生产 Dockerfile（多阶段构建）
#
# 阶段 1: Node 构建前端静态资源
# 阶段 2: Nginx 托管静态资源 + 反向代理 API
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

# 构建生产版本（tsc + vite build）
RUN pnpm build

# ============================================================
# 阶段 2: 运行时（Nginx 托管静态资源）
# ============================================================
FROM nginx:alpine AS runtime

# 拷贝自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
