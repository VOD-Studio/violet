# Go API 多阶段构建
FROM golang:1.25-alpine AS builder

WORKDIR /app

# 安装依赖
COPY go.mod go.sum ./
RUN go mod download

# 编译
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /blog-api ./cmd/server

# 运行阶段
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /blog-api .

EXPOSE 8080

CMD ["./blog-api"]
