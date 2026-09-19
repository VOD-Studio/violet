# syntax=docker/dockerfile:1
# 单构建阶段:go module 与编译缓存走 BuildKit cache mount,跨构建共享;
# 不做 deps 阶段 COPY --from 传递(mount 内容不进镜像层,COPY 只能拿到空目录)
FROM golang:1.26-alpine AS builder

# 临时：服务器在国内，用 goproxy.cn 加速 module 下载
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /app

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .

# 发版镜像经 build-args 注入 API_VERSION（tag），本地/CI 构建缺省 dev；
# ${API_VERSION#v} 去掉 tag 前导 v，让 openapi spec 版本读作 2.8.9 而非 v2.8.9
ARG API_VERSION=dev

# 构建 server 与 migrate 两个二进制，ldflags 去除调试信息减小体积
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X blog-api/internal/version.Version=${API_VERSION#v}" -o /server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /migrate ./cmd/migrate

# 阶段2: 运行时，保留 shell 与 wget 以便健康检查和调试
FROM alpine:3.20

WORKDIR /app

# 优先使用国内镜像；镜像不可用时回退官方源，避免构建被单一镜像阻断。
# ffmpeg 用于视频封面；postgresql-client 为系统面板提供 pg_dump/psql；tar 用于备份运维。
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.aliyun.com#g' /etc/apk/repositories && \
    (apk add --no-cache ca-certificates wget ffmpeg postgresql-client tar || \
     (sed -i 's#mirrors.aliyun.com#dl-cdn.alpinelinux.org#g' /etc/apk/repositories && \
      apk add --no-cache ca-certificates wget ffmpeg postgresql-client tar))

# 创建非 root 用户，UID/GID 与 distroless nonroot 保持一致
RUN addgroup -g 65532 -S appgroup && adduser -u 65532 -S appuser -G appgroup

# 复制构建产物与迁移文件并设置所有权
COPY --from=builder --chown=appuser:appgroup /server /server
COPY --from=builder --chown=appuser:appgroup /migrate /migrate
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations

# config.yaml 入库并随镜像分发：承载全部配置键与非敏感默认值（权威文档）
# 密钥与环境差异由 compose 注入进程环境,优先级 env > config.yaml > 代码默认值
COPY --from=builder --chown=appuser:appgroup /app/config.yaml ./config.yaml

# 预创建持久化目录并设置所有权：命名卷首次挂载会继承镜像内路径属主。
RUN mkdir -p /app/uploads /app/backups && chown -R 65532:65532 /app/uploads /app/backups

USER appuser:appgroup

ENTRYPOINT ["/server"]
