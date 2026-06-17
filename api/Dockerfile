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

# 复制构建产物
COPY --from=builder /server /server
# 复制数据库迁移文件（main.go 使用相对路径 "migrations" 加载）
COPY --from=builder /app/migrations ./migrations

ENTRYPOINT ["/server"]