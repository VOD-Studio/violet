// Package kit 是 musicctl 命令层的共享工具包。
//
// 封装 engine 调用、登录会话读写、输出与确认交互,各领域命令包(song/playlist/...)
// 只依赖本包,不直接碰 engine 细节。
package kit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"google.golang.org/protobuf/proto"

	"github.com/VOD-Studio/mimo-music/internal/cache"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// ErrNotLogin 未登录哨兵错误,Execute 据此映射退出码 3。
var ErrNotLogin = errors.New("未登录")

// ErrUsage 用法哨兵错误(flag 解析失败、非 TTY 写操作无 --yes 等),Execute 映射退出码 2。
var ErrUsage = errors.New("用法错误")

// Kit 持有命令层共享的运行时依赖与全局输出状态。
type Kit struct {
	eng *engine.Engine

	// JSON 为 true 时强制 protojson 输出(全局 --json);管道时无需设置,自动回退。
	JSON bool
	// Yes 为 true 时写操作跳过交互确认(全局 --yes)。
	Yes bool
	// Out 结果输出 writer,默认 os.Stdout(测试可替换)。
	Out io.Writer
}

// New 创建 Kit。engine 无缓存、无 session 池,纯转发到网易云。
func New() *Kit {
	return &Kit{eng: engine.New(engine.WithCache(cache.Noop{})), Out: os.Stdout}
}

// out 返回输出 writer(未设置时回退 os.Stdout)。
func (k *Kit) out() io.Writer {
	if k.Out == nil {
		return os.Stdout
	}
	return k.Out
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

// RequireLogin 检查当前有可用的登录态(环境变量或本地会话文件)。
// 未登录返回包装了 ErrNotLogin 的错误,Execute 映射退出码 3。
func (k *Kit) RequireLogin() error {
	if k.CurrentCookie() == "" {
		return fmt.Errorf("%w:先运行 `musicctl login` 扫码登录(也可用 NETEASE_COOKIE 环境变量临时指定 cookie)", ErrNotLogin)
	}
	return nil
}

// RenderExec 执行声明式 endpoint 并按三态规则输出(读命令通用)。
func RenderExec[Req any, Resp proto.Message](k *Kit, ep *engine.Endpoint[Req, Resp], req Req) error {
	resp, err := Exec(k, k.CookieCtx(), ep, req)
	if err != nil {
		return err
	}
	return k.Render(resp)
}
