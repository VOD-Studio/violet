// Package service 的 cookie override 执行辅助。
//
// 第三条执行路径（ADR §4.5）：写操作/特定登录态接口从请求字段取 cookie，
// 绕过 SessionStore 轮换。与 Execute 的区别：cookie 由调用方传入，不经 session 池选取。
package service

import (
	"context"

	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// executeWithCookie 走 cookie override 路径执行 endpoint。
//
// 与 engine.Execute 对应，但不走缓存（写操作/即时数据不缓存），cookie 从参数取。
// 串起 MapRequest → RawDoWithCookieAndInput → MapResponse。service 方法恒一行调用它。
func executeWithCookie[Req, Resp any](
	eng *engine.Engine,
	ctx context.Context,
	ep *engine.Endpoint[Req, Resp],
	req Req,
	cookie string,
) (Resp, error) {
	params, err := ep.MapRequest(req)
	if err != nil {
		var zero Resp
		return zero, err
	}
	raw, _, err := eng.RawDoWithCookieAndInput(ctx, ep.Meta, params, cookie)
	if err != nil {
		var zero Resp
		return zero, err
	}
	return ep.MapResponse(req, raw)
}
