// Package kit 是 musicctl 命令层的共享工具包。
//
// 封装 engine 调用、登录会话读写、输出与确认交互,各领域命令包(song/playlist/...)
// 只依赖本包,不直接碰 engine 细节。
package kit

import (
	"context"
	"encoding/json"
	"fmt"

	"google.golang.org/protobuf/proto"

	"github.com/VOD-Studio/mimo-music/internal/cache"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// Kit 持有命令层共享的运行时依赖。
type Kit struct {
	eng *engine.Engine
}

// New 创建 Kit。engine 无缓存、无 session 池,纯转发到网易云。
func New() *Kit {
	return &Kit{eng: engine.New(engine.WithCache(cache.Noop{}))}
}

// CookieCtx 把当前生效的 cookie 注入 context(无则注入空)。
func (k *Kit) CookieCtx() context.Context {
	return engine.WithCookie(context.Background(), k.CurrentCookie())
}

// RawDo 执行一个 Meta + 参数 形式的原始调用(动态 path / 写接口用)。
func (k *Kit) RawDo(ctx context.Context, meta engine.Meta, params map[string]any) (json.RawMessage, string, error) {
	return k.eng.RawDoWithCookieAndInput(ctx, meta, params)
}

// Exec 执行一个声明式 endpoint(注入当前 cookie)。
// 是 service 包 executeOverride 的等价物:复制而非 import,
// 因为 service 包还装配了 gRPC 相关类型,这里只要纯执行逻辑。
func Exec[Req, Resp any](k *Kit, ctx context.Context, ep *engine.Endpoint[Req, Resp], req Req) (Resp, error) {
	params, err := ep.MapRequest(req)
	if err != nil {
		var zero Resp
		return zero, err
	}
	raw, _, err := k.RawDo(ctx, ep.Meta, params)
	if err != nil {
		var zero Resp
		return zero, err
	}
	return ep.MapResponse(req, raw)
}

// PrintExec 执行声明式 endpoint 并打印响应(读命令通用)。
func PrintExec[Req any, Resp proto.Message](k *Kit, ep *engine.Endpoint[Req, Resp], req Req) error {
	resp, err := Exec(k, k.CookieCtx(), ep, req)
	if err != nil {
		return err
	}
	return PrintJSON(resp)
}

// RequireLogin 检查当前有可用的登录态(环境变量或本地会话文件)。
func (k *Kit) RequireLogin() error {
	if k.CurrentCookie() == "" {
		return fmt.Errorf("未登录:先运行 `musicctl login` 扫码登录(也可用 NETEASE_COOKIE 环境变量临时指定 cookie)")
	}
	return nil
}
