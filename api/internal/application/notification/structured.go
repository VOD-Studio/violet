package notification

import (
	"maps"
	"strings"
	"time"

	domainnotification "blog-api/internal/domain/notification"
)

// 结构化字段在 payload 中的保留键。写入时与 title/body 同为快照；读侧由
// structuredFromPayload 统一提升为 DTO / SSE 的顶层字段（payload 本身原样保留，
// 保留键也在其中，旧客户端读 payload 不受影响）。
const (
	payloadKeyActor       = "actor"
	payloadKeyObjectTitle = "object_title"
	payloadKeyQuote       = "quote"
)

const (
	// quoteMaxRunes 引用摘要的最大 rune 数，超出截断并补省略号。
	quoteMaxRunes = 80
	// objectTitleMaxRunes 对象标题的最大 rune 数。
	objectTitleMaxRunes = 120
)

// Actor 通知的行为人（谁做了这件事）；系统发起的通知没有行为人。
type Actor struct {
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url,omitempty"`
}

// Structured 通知读模型的结构化字段，旧通知（payload 无保留键）全部为零值并在 JSON 中省略。
type Structured struct {
	// Actor 行为人
	Actor *Actor `json:"actor,omitempty"`
	// ObjectTitle 被操作对象的标题（文章标题、推文摘录、站点名、房间名、公告标题等）
	ObjectTitle string `json:"object_title,omitempty"`
	// Quote 单行原文摘录（评论正文、推文正文、公告内容等）
	Quote string `json:"quote,omitempty"`
}

// structuredFields subscriber 写入时收集的结构化字段，空值字段不写入 payload。
type structuredFields struct {
	actor       Actor
	objectTitle string
	quote       string
}

// applyTo 返回写入保留键后的 payload 拷贝（不改动入参：多个接收者可能共享同一份基础 payload）。
// 没有任何字段可写且入参为 nil 时返回 nil，保持旧通知「无 payload」的形态。
func (f structuredFields) applyTo(payload map[string]any) map[string]any {
	out := maps.Clone(payload)
	set := func(key string, v any) {
		if out == nil {
			out = make(map[string]any, 3)
		}
		out[key] = v
	}
	if f.actor.Name != "" {
		a := map[string]any{"name": f.actor.Name}
		if f.actor.AvatarURL != "" {
			a["avatar_url"] = f.actor.AvatarURL
		}
		set(payloadKeyActor, a)
	}
	if title := oneLine(f.objectTitle, objectTitleMaxRunes); title != "" {
		set(payloadKeyObjectTitle, title)
	}
	if quote := oneLine(f.quote, quoteMaxRunes); quote != "" {
		set(payloadKeyQuote, quote)
	}
	return out
}

// structuredFromPayload 把 payload 保留键提升为结构化字段（列表与 SSE 共用的唯一映射点）。
//
// 键缺失或类型不符一律视为未提供，不报错：旧行没有这些键，DB 读回的 JSON 对象
// 也只会是 map[string]any。
func structuredFromPayload(payload map[string]any) Structured {
	var s Structured
	if raw, ok := payload[payloadKeyActor].(map[string]any); ok {
		if name, _ := raw["name"].(string); name != "" {
			s.Actor = &Actor{Name: name}
			s.Actor.AvatarURL, _ = raw["avatar_url"].(string)
		}
	}
	s.ObjectTitle, _ = payload[payloadKeyObjectTitle].(string)
	s.Quote, _ = payload[payloadKeyQuote].(string)
	return s
}

// oneLine 把文本折叠为单行摘录：任意连续空白（含换行、制表符）压成一个空格并去首尾空白，
// 超过 maxRunes 个 rune 时截断并补「…」。按 rune 而非字节截断，不会切坏中文或 emoji。
func oneLine(s string, maxRunes int) string {
	s = strings.Join(strings.Fields(s), " ")
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return strings.TrimRight(string(runes[:maxRunes]), " ") + "…"
}

// NewSSEEvent 通知实体 → SSE 事件。实时推送与断线补发共用，保证两条通道的字段一致。
func NewSSEEvent(n *domainnotification.Notification) SSEEvent {
	return SSEEvent{
		ID:         n.GetID().String(),
		SourceType: string(n.SourceType()),
		SourceID:   n.SourceID().String(),
		Title:      n.Title(),
		Body:       n.Body(),
		Payload:    n.Payload(),
		Structured: structuredFromPayload(n.Payload()),
		CreatedAt:  n.CreatedAt().Format(time.RFC3339),
	}
}
