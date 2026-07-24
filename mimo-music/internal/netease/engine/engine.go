// Package engine 是网易云共享执行引擎，是 mimo-music 的核心深模块。
//
// Engine 持有 transport（HTTP）、SessionStore（cookie 池）、Cache（缓存）、
// retryPolicy、circuitBreaker，暴露唯一深方法 RawDo。一个方法背后藏全部脏活：
// session 选取 → 加密 → HTTP 请求 → 重试/熔断 → 错误映射 → 返回原始 JSON。
//
// deletion test：删掉 RawDo，这些复杂度会散落到 357 个调用点。
package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// CryptoMethod 标识网易云请求的加密方式。
type CryptoMethod int

const (
	// CryptoNone 不加密（GET 请求用）。
	CryptoNone CryptoMethod = iota
	// CryptoWeAPI 用 weapi 协议加密（大部分 POST 接口）。
	CryptoWeAPI
	// CryptoEAPI 用 eapi 协议加密。
	CryptoEAPI
	// CryptoLinuxAPI 用 linuxapi 协议加密。
	CryptoLinuxAPI
)

// Meta 是网易云 endpoint 的执行元数据。
type Meta struct {
	// Path 是网易云端点路径（如 /weapi/song/enhance/player/url/v1）。
	Path string
	// Method 是 HTTP 方法。
	Method string
	// Crypto 是加密方式。
	Crypto CryptoMethod
	// Auth 是登录态需求，驱动 cookie 池选取。
	Auth session.AuthRequirement
	// UserAgent 覆盖请求 UA（空 = 默认桌面客户端 UA）。
	// 网易云按 UA 分配 CDN 节点：song url 接口桌面 UA 拿到的 x04 节点链接
	// 回源鉴权 403，移动端 UA 的 x01 节点正常——需移动 UA 的 endpoint 用
	// engine.MobileUserAgent。
	UserAgent string
}

// Engine 是网易云共享执行引擎。
type Engine struct {
	transport *transport
	sessions  session.SessionStore
	cache     cacheClient
	retry     retryPolicy
	breaker   *circuitBreaker
}

// cacheClient 是 Engine 对缓存的依赖接口（internal/cache.Cache 的别名契约）。
type cacheClient interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// Option 是 Engine 的配置项。
type Option func(*Engine)

// WithTimeout 设置 HTTP 超时。
func WithTimeout(d time.Duration) Option {
	return func(e *Engine) { e.transport = newTransport(d) }
}

// WithBaseURL 覆盖网易云 API 基础地址（测试用，指向 httptest server）。
func WithBaseURL(base string) Option {
	return func(e *Engine) { e.transport = e.transport.withBaseURL(base) }
}

// WithSessions 注入 SessionStore。
func WithSessions(s session.SessionStore) Option {
	return func(e *Engine) { e.sessions = s }
}

// WithCache 注入 Cache。
func WithCache(c cacheClient) Option {
	return func(e *Engine) { e.cache = c }
}

// New 创建 Engine。
func New(opts ...Option) *Engine {
	e := &Engine{
		transport: newTransport(10 * time.Second),
		retry:     defaultRetryPolicy,
		breaker:   newCircuitBreaker(5, 30*time.Second),
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

// RawDo 是 engine 唯一对外深方法：一个接口，背后藏加密/HTTP/cookie选取/重试/熔断。
//
// 不碰 proto 类型，只接收元数据 + 网易云参数，返回原始 JSON。
// 流程：熔断检查 → withRetry(session选取 → 加密 → transport请求 → 错误映射)。
func (e *Engine) RawDo(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, error) {
	raw, _, err := e.rawDoWithResult(ctx, meta, params)
	return raw, err
}

// RawDoWithCookieAndInput 走 cookie override 路径：从 context 取网易云 cookie（interceptor 注入），
// 不走 session 池选取。写操作/auth 接口用。
// cookie 由调用方经 metadata "x-netease-cookie" 传入，interceptor 注入 context。
func (e *Engine) RawDoWithCookieAndInput(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, string, error) {
	// 熔断检查。
	if !e.breaker.allow() {
		return nil, "", ErrCircuitOpen
	}

	cookie := CookieFromContext(ctx)

	var (
		raw       json.RawMessage
		setCookie string
	)
	err := withRetry(ctx, e.retry, func() error {
		r, sc, callErr := e.doOnceWithCookie(ctx, meta, params, cookie)
		if callErr != nil {
			e.breaker.recordFailure()
			return callErr
		}
		e.breaker.recordSuccess()
		raw = r
		setCookie = sc
		return nil
	})

	if err != nil {
		return nil, "", err
	}
	return raw, setCookie, nil
}

// doOnceWithCookie 同 doOnce，但用 context 里的 cookie 而非从 session 池选取。
func (e *Engine) doOnceWithCookie(ctx context.Context, meta Meta, params map[string]any, cookie string) (json.RawMessage, string, error) {
	payload, err := json.Marshal(params)
	if err != nil {
		return nil, "", fmt.Errorf("序列化参数失败: %w", err)
	}

	var (
		body      []byte
		setCookie string
		callErr   error
	)

	switch meta.Crypto {
	case CryptoWeAPI:
		body, setCookie, callErr = e.transport.weapiPost(ctx, meta.Path, string(payload), cookie, meta.UserAgent)
	case CryptoEAPI:
		encrypted, encErr := EAPIEncrypt(meta.Path, string(payload))
		if encErr != nil {
			return nil, "", fmt.Errorf("eapi 加密失败: %w", encErr)
		}
		body, _, callErr = e.transport.eapiPost(ctx, meta.Path, encrypted.Params, cookie, meta.UserAgent)
	case CryptoNone:
		if meta.Method == "GET" {
			body, callErr = e.transport.apiGet(ctx, meta.Path, toQueryValues(params), cookie, meta.UserAgent)
		} else {
			body, _, callErr = e.transport.postJSON(ctx, e.transport.baseURL+meta.Path, string(payload), cookie, meta.UserAgent)
		}
	default:
		body, setCookie, callErr = e.transport.weapiPost(ctx, meta.Path, string(payload), cookie, meta.UserAgent)
	}

	if callErr != nil {
		return nil, "", callErr
	}
	return json.RawMessage(body), setCookie, nil
}

// RawDoWithCookie 同 RawDo，但额外返回响应的 Set-Cookie（登录类接口用）。
// 登录成功后 service 层拿这个 cookie 存入 session 池。
func (e *Engine) RawDoWithCookie(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, string, error) {
	return e.rawDoWithResult(ctx, meta, params)
}

// rawDoWithResult 是 RawDo / RawDoWithCookie 的共享实现。
func (e *Engine) rawDoWithResult(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, string, error) {
	// 熔断检查。
	if !e.breaker.allow() {
		return nil, "", ErrCircuitOpen
	}

	// 用闭包局部变量把 doOnce 的结果传出来（withRetry 回调签名是 func() error）。
	var (
		raw       json.RawMessage
		setCookie string
	)
	err := withRetry(ctx, e.retry, func() error {
		r, sc, callErr := e.doOnce(ctx, meta, params)
		if callErr != nil {
			e.breaker.recordFailure()
			return callErr
		}
		e.breaker.recordSuccess()
		raw = r
		setCookie = sc
		return nil
	})

	if err != nil {
		return nil, "", err
	}
	return raw, setCookie, nil
}

// doOnce 执行一次完整调用（不含重试/熔断）：session 选取 → 加密 → transport → 错误映射。
// 返回 raw JSON + Set-Cookie。
func (e *Engine) doOnce(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, string, error) {
	// session 选取（登录类接口创建 session 时不走这里，直接传 cookie）。
	cookie := ""
	if meta.Auth == session.AuthLoggedIn {
		if e.sessions == nil {
			return nil, "", merrors.ErrUnauthorized
		}
		sess, err := e.sessions.GetAvailable(ctx, meta.Auth)
		if err != nil {
			return nil, "", err
		}
		cookie = sess.Cookie
	}

	// 参数序列化为 JSON。
	payload, err := json.Marshal(params)
	if err != nil {
		return nil, "", fmt.Errorf("序列化参数失败: %w", err)
	}

	var (
		body      []byte
		setCookie string
		callErr   error
	)

	switch meta.Crypto {
	case CryptoWeAPI:
		body, setCookie, callErr = e.transport.weapiPost(ctx, meta.Path, string(payload), cookie, meta.UserAgent)
	case CryptoEAPI:
		encrypted, encErr := EAPIEncrypt(meta.Path, string(payload))
		if encErr != nil {
			return nil, "", fmt.Errorf("eapi 加密失败: %w", encErr)
		}
		body, _, callErr = e.transport.eapiPost(ctx, meta.Path, encrypted.Params, cookie, meta.UserAgent)
	case CryptoNone:
		if meta.Method == "GET" {
			body, callErr = e.transport.apiGet(ctx, meta.Path, toQueryValues(params), cookie, meta.UserAgent)
		} else {
			body, _, callErr = e.transport.postJSON(ctx, e.transport.baseURL+meta.Path, string(payload), cookie, meta.UserAgent)
		}
	default:
		body, setCookie, callErr = e.transport.weapiPost(ctx, meta.Path, string(payload), cookie, meta.UserAgent)
	}

	if callErr != nil {
		// cookie 失效时上报 session 池。
		if meta.Auth == session.AuthLoggedIn && e.sessions != nil && isUnauthorized(callErr) {
			sess, _ := e.sessions.GetAvailable(ctx, meta.Auth)
			if sess != nil {
				e.sessions.ReportFailure(sess.UserID, callErr)
			}
		}
		return nil, "", callErr
	}

	return json.RawMessage(body), setCookie, nil
}

// isUnauthorized 判断错误是否为登录态失效。
func isUnauthorized(err error) bool {
	return errors.Is(err, merrors.ErrUnauthorized)
}

// toQueryValues 把 params map 转成 url.Values（GET 请求用）。
func toQueryValues(params map[string]any) url.Values {
	q := url.Values{}
	for k, v := range params {
		q.Set(k, fmt.Sprintf("%v", v))
	}
	return q
}
