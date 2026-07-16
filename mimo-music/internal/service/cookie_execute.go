// Package service 的 cookie override 执行辅助。
//
// 第三条执行路径（ADR §4.5）：写操作/特定登录态接口走 cookie override，
// cookie 由 interceptor 从 metadata 注入 context，绕过 SessionStore 轮换。
package service

import (
	"context"

	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// executeOverride 走 cookie override 路径执行 endpoint（cookie 从 context 取，不经 session 池）。
//
// 与 engine.Execute 对应，但不走缓存（写操作/即时数据不缓存）。
// cookie 由 interceptor 从 metadata "x-netease-cookie" 注入 context，对 service 透明。
// 串起 MapRequest → RawDoWithCookieAndInput → MapResponse。service 方法恒一行调用它。
func executeOverride[Req, Resp any](
	eng *engine.Engine,
	ctx context.Context,
	ep *engine.Endpoint[Req, Resp],
	req Req,
) (Resp, error) {
	params, err := ep.MapRequest(req)
	if err != nil {
		var zero Resp
		return zero, err
	}
	raw, _, err := eng.RawDoWithCookieAndInput(ctx, ep.Meta, params)
	if err != nil {
		var zero Resp
		return zero, err
	}
	return ep.MapResponse(req, raw)
}
