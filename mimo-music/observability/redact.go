// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"strings"
)

// sensitiveKeys 是需要脱敏的字段名集合（小写匹配）。
//
// 这些字段绝不能明文进日志：一旦日志被采集到第三方或截图分享，
// 就是安全事故。
var sensitiveKeys = map[string]redactStrategy{
	"cookie":      redactHash,
	"set-cookie":  redactHash,
	"phone":       redactHash,
	"token":       redactMask,
	"password":    redactMask,
	"captcha":     redactMask,
	"session":     redactMask,
	"authorization": redactMask,
}

type redactStrategy int

const (
	// redactMask 完全遮蔽为 "***"。
	redactMask redactStrategy = iota

	// redactHash 用 SHA256 前 8 位替换，可关联但不可逆。
	redactHash
)

// redactHandler 包装 slog.Handler，遍历日志 attrs 替换敏感字段。
//
// 两种脱敏策略：
//   - 完全遮蔽：cookie=***（token / password / captcha 等无需关联的）
//   - 可关联不可逆：cookie_hash=sha256(cookie)[:8]
//     （排障时能判断是不是同一个 cookie 出的问题，又不泄露内容）
type redactHandler struct {
	next slog.Handler
}

func newRedactHandler(next slog.Handler) slog.Handler {
	return &redactHandler{next: next}
}

// Handle 遍历 record 的 attrs，替换敏感字段值。
func (h *redactHandler) Handle(ctx context.Context, r slog.Record) error {
	newAttrs := make([]slog.Attr, 0, r.NumAttrs())
	r.Attrs(func(a slog.Attr) bool {
		newAttrs = append(newAttrs, redactAttr(a))
		return true
	})

	// 用脱敏后的 attrs 重建 record
	newRecord := slog.NewRecord(r.Time, r.Level, r.Message, r.PC)
	for _, a := range newAttrs {
		newRecord.AddAttrs(a)
	}
	return h.next.Handle(ctx, newRecord)
}

// redactAttr 递归处理单个 attr，敏感字段替换值。
func redactAttr(a slog.Attr) slog.Attr {
	key := strings.ToLower(a.Key)
	if strategy, ok := sensitiveKeys[key]; ok {
		switch strategy {
		case redactHash:
			return slog.String(a.Key+"_hash", hashValue(a.Value.String()))
		case redactMask:
			return slog.String(a.Key, "***")
		}
	}
	return a
}

// hashValue 返回字符串的 SHA256 前 8 位。
func hashValue(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])[:8]
}

// WithAttrs 委托给下层 handler。
func (h *redactHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	redacted := make([]slog.Attr, len(attrs))
	for i, a := range attrs {
		redacted[i] = redactAttr(a)
	}
	return &redactHandler{next: h.next.WithAttrs(redacted)}
}

// WithGroup 委托给下层 handler。
func (h *redactHandler) WithGroup(name string) slog.Handler {
	return &redactHandler{next: h.next.WithGroup(name)}
}

// Enabled 委托给下层 handler。
func (h *redactHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}
