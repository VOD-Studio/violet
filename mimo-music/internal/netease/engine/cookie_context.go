// Package engine 的 cookie context 机制。
//
// cookie 是 engine 的消费物（发往上游网易云的登录态凭证）。
// context key 归 engine，interceptor 用 WithCookie 注入，engine 用 CookieFromContext 读取。
// 这样 engine 不依赖 server 包，cookie 注入方和消费方解耦。
package engine

import "context"

// cookieCtxKey 是 context 里 cookie 值的 key（未导出，防外部直接写）。
type cookieCtxKey struct{}

// WithCookie 把网易云 cookie 注入 context，返回新 context。
// interceptor 从 metadata 提取 cookie 后调用此函数注入。
func WithCookie(ctx context.Context, cookie string) context.Context {
	return context.WithValue(ctx, cookieCtxKey{}, cookie)
}

// CookieFromContext 从 context 读网易云 cookie（WithCookie 注入）。
// 无 cookie 返回空字符串（engine 走 session 池选取）。
func CookieFromContext(ctx context.Context) string {
	v, _ := ctx.Value(cookieCtxKey{}).(string)
	return v
}
