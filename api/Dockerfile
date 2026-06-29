# 阶段1: 依赖下载
FROM golang:1.25-alpine AS deps

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

# 阶段2: 构建
FROM golang:1.25-alpine AS builder

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

USER appuser:appgroup

ENTRYPOINT ["/server"]
