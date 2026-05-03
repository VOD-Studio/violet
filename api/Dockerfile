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
FROM gcr.io/distroless/static-debian12

# 复制构建产物
COPY --from=builder /server /server

USER nonroot:nonroot

ENTRYPOINT ["/server"]