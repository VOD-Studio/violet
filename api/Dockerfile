# 阶段1: 依赖下载
FROM golang:1.25-alpine AS deps

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

# 阶段2: 构建
FROM golang:1.25-alpine AS builder

WORKDIR /app

# 复制 go mod 文件
COPY go.mod go.sum ./
# 从 deps 阶段复制依赖缓存
COPY --from=deps /go/pkg/mod /go/pkg/mod
# 复制源代码
COPY . .

# 构建二进制，使用 ldflags 减小体积
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# 阶段3: 运行时
# 使用 alpine 代替 distroless，保留 shell/wget 以便健康检查和调试
FROM alpine:3.20

WORKDIR /app

# 安装 wget 与健康检查所需依赖
RUN apk add --no-cache ca-certificates wget

# 创建非 root 用户（与 distroless nonroot 一致的 UID/GID）
RUN addgroup -g 65532 -S appgroup && adduser -u 65532 -S appuser -G appgroup

# 复制构建产物与迁移文件，并设置所有权
COPY --from=builder --chown=appuser:appgroup /server /server
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations

USER appuser:appgroup

ENTRYPOINT ["/server"]