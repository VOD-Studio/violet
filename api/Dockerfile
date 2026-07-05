# 阶段1: 依赖下载
FROM golang:1.25-alpine AS deps

# 临时：服务器在国内，用 goproxy.cn 加速 module 下载
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

# 阶段2: 构建
FROM golang:1.25-alpine AS builder

ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /app

COPY go.mod go.sum ./
COPY --from=deps /go/pkg/mod /go/pkg/mod
COPY . .

# 构建 server 与 migrate 两个二进制，ldflags 去除调试信息减小体积
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /migrate ./cmd/migrate

# 阶段3: 运行时，保留 shell 与 wget 以便健康检查和调试
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates wget

# 创建非 root 用户，UID/GID 与 distroless nonroot 保持一致
RUN addgroup -g 65532 -S appgroup && adduser -u 65532 -S appuser -G appgroup

# 复制构建产物与迁移文件并设置所有权
COPY --from=builder --chown=appuser:appgroup /server /server
COPY --from=builder --chown=appuser:appgroup /migrate /migrate
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations

# 预创建上传根目录并设置所有权：命名卷（uploads_data:/app/uploads）首次挂载时为空，
# podman 会从镜像该路径复制属主——若此处为 root，appuser 将无法创建分片目录，
# 触发「创建分片目录失败」500。先建好并 chown，保证卷挂载后 appuser 可写。
RUN mkdir -p /app/uploads && chown -R 65532:65532 /app/uploads

USER appuser:appgroup

ENTRYPOINT ["/server"]
