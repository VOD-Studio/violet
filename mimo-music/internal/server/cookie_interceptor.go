// Package server 的 cookie interceptor。
//
// 从 gRPC metadata 提取上游网易云 cookie（x-netease-cookie），
// 调 engine.WithCookie 注入 context。凭证出域——cookie 不进 proto 字段，
// 由 interceptor 统一从 metadata 提取，service 对 cookie 来源透明。
//
// REST 调用方经 grpc-gateway 传 "Grpc-Metadata-X-Netease-Cookie" header，
// gateway 自动桥接到 metadata key "x-netease-cookie"（前缀剥离）。
package server

import (
	"context"

	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// cookieMetadataKey 是 gRPC metadata 里网易云 cookie 的 key。
const cookieMetadataKey = "x-netease-cookie"

// CookieInterceptor 从 incoming metadata 提取网易云 cookie，注入 context。
//
// 无 metadata 或无 cookie key 时注入空字符串——engine 据此走 session 池选取。
func CookieInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	cookie := ""
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if vals := md.Get(cookieMetadataKey); len(vals) > 0 {
			// 取最后一个：gRPC metadata 同 key 多值时，gateway 桥接的 header 取最后值，
			// 与 HTTP 多值 header 的常规解析一致。
			cookie = vals[len(vals)-1]
		}
	}
	return handler(engine.WithCookie(ctx, cookie), req)
}
