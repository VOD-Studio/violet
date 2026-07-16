// Package server 的 cookie interceptor 测试。
//
// 验证 metadata "x-netease-cookie" → context 注入的映射（经 engine.WithCookie）。
// 按 go-testing-guide.md：table-driven + t.Run + t.Parallel + testify require。
package server

import (
	"context"
	"testing"

	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// TestCookieInterceptor metadata cookie 提取并注入 context。
func TestCookieInterceptor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		md   metadata.MD
		want string
	}{
		{
			name: "有 cookie 注入对应值",
			md:   metadata.Pairs("x-netease-cookie", "MUSIC_API_UUT=abc;__csrf=def"),
			want: "MUSIC_API_UUT=abc;__csrf=def",
		},
		{
			name: "无 cookie 注入空字符串",
			md:   metadata.MD{},
			want: "",
		},
		{
			name: "无 metadata 注入空字符串",
			md:   nil,
			want: "",
		},
		{
			name: "多值取最后一个",
			md:   metadata.Pairs("x-netease-cookie", "first", "x-netease-cookie", "second"),
			want: "second",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			if tt.md != nil {
				ctx = metadata.NewIncomingContext(ctx, tt.md)
			}

			handler := func(ctx context.Context, req any) (any, error) {
				require.Equal(t, tt.want, engine.CookieFromContext(ctx))
				return nil, nil
			}

			info := &grpc.UnaryServerInfo{FullMethod: "/test/Method"}
			_, err := CookieInterceptor(ctx, nil, info, handler)
			require.NoError(t, err)
		})
	}
}
