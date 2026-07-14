# 阶段1: 依赖下载
FROM golang:1.25-alpine AS deps

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

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# 阶段3: 运行时
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates wget

RUN addgroup -g 65532 -S appgroup && adduser -u 65532 -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /server /server

USER appuser:appgroup

ENTRYPOINT ["/server"]
