package chat

import (
	"encoding/json"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// BotReplyStatus 描述一条 bot 回复的生成阶段。
type BotReplyStatus string

const (
	BotReplyPending      BotReplyStatus = "pending"
	BotReplyThinking     BotReplyStatus = "thinking"
	BotReplyStreaming    BotReplyStatus = "streaming"
	BotReplyCompleted    BotReplyStatus = "completed"
	BotReplyFailed       BotReplyStatus = "failed"
	MaxBotThinkingLength                = 20_000
)

const (
	// MaxBotToolCalls 单条回复最多记录的调用数。
	MaxBotToolCalls = 32
	// MaxBotToolCallIDLength 调用 ID 的字符上限；ID 在单条回复内必须唯一。
	MaxBotToolCallIDLength = 128
	// MaxBotToolCallNameLength 工具名的字符上限。
	MaxBotToolCallNameLength = 64
	// MaxBotToolCallTextLength arguments、result、error 各字段的字符上限。
	MaxBotToolCallTextLength = 8_000
	// MaxBotToolCallDurationMS 单次调用耗时的毫秒上限（24 小时）。
	MaxBotToolCallDurationMS = 86_400_000
	// MaxBotToolCallsJSONBytes 序列化后调用列表的字节上限。
	MaxBotToolCallsJSONBytes = 64 << 10
)

// BotToolCallStatus 描述一次工具调用的执行阶段。
//
// 终态回复里仍可能保留 running 调用：bot 中断时不会回填状态，
// 读模型照原样返回，由前端渲染为「已中断」。
type BotToolCallStatus string

const (
	// BotToolCallRunning 调用已发起、尚未返回。
	BotToolCallRunning BotToolCallStatus = "running"
	// BotToolCallCompleted 调用成功返回。
	BotToolCallCompleted BotToolCallStatus = "completed"
	// BotToolCallFailed 调用失败，原因见 Error。
	BotToolCallFailed BotToolCallStatus = "failed"
)

// BotToolCall 是 bot 上报的一次工具调用快照。
//
// 字段值只做长度与枚举校验，不做内容解析：arguments 与 result 可能是任意
// 工具方言，服务端原样保存与返回。
type BotToolCall struct {
	// ID 调用方的稳定标识；非空时必须在本条回复内唯一，重试快照据此对齐同一次调用。
	ID string `json:"id,omitempty"`
	// Name 工具名，去除首尾空白后必填。
	Name string `json:"name"`
	// Status 执行阶段；空值按 completed 处理。
	Status BotToolCallStatus `json:"status,omitempty"`
	// Arguments 调用参数的原始文本，原样保存。
	Arguments string `json:"arguments,omitempty"`
	// Result 工具返回内容的原始文本，原样保存。
	Result string `json:"result,omitempty"`
	// Error 失败原因；成功调用为空。
	Error string `json:"error,omitempty"`
	// DurationMS 调用耗时（毫秒）。
	DurationMS int64 `json:"duration_ms,omitempty"`
}

// NormalizeBotToolCalls 校验并规范化一份累计调用快照。
//
// 返回新切片，不修改入参；输入为空时返回非 nil 的空切片，调用方可直接落库。
// 空状态补为 completed；ID 与工具名去除首尾空白。
func NormalizeBotToolCalls(calls []BotToolCall) ([]BotToolCall, error) {
	if len(calls) > MaxBotToolCalls {
		return nil, shared.BadRequest("Bot 工具调用数量过多")
	}
	out := make([]BotToolCall, len(calls))
	seen := make(map[string]struct{}, len(calls))
	for i, call := range calls {
		call.ID = strings.TrimSpace(call.ID)
		call.Name = strings.TrimSpace(call.Name)
		if call.Name == "" || len([]rune(call.Name)) > MaxBotToolCallNameLength {
			return nil, shared.BadRequest("Bot 工具调用名称无效")
		}
		if len([]rune(call.ID)) > MaxBotToolCallIDLength {
			return nil, shared.BadRequest("Bot 工具调用 ID 过长")
		}
		if call.ID != "" {
			if _, ok := seen[call.ID]; ok {
				return nil, shared.BadRequest("Bot 工具调用 ID 重复")
			}
			seen[call.ID] = struct{}{}
		}
		if call.Status == "" {
			call.Status = BotToolCallCompleted
		}
		if call.Status != BotToolCallRunning && call.Status != BotToolCallCompleted && call.Status != BotToolCallFailed {
			return nil, shared.BadRequest("Bot 工具调用状态无效")
		}
		if len([]rune(call.Arguments)) > MaxBotToolCallTextLength ||
			len([]rune(call.Result)) > MaxBotToolCallTextLength ||
			len([]rune(call.Error)) > MaxBotToolCallTextLength {
			return nil, shared.BadRequest("Bot 工具调用内容过长")
		}
		if call.DurationMS < 0 || call.DurationMS > MaxBotToolCallDurationMS {
			return nil, shared.BadRequest("Bot 工具调用耗时无效")
		}
		out[i] = call
	}
	if len(out) == 0 {
		return []BotToolCall{}, nil
	}
	encoded, err := json.Marshal(out)
	if err != nil || len(encoded) > MaxBotToolCallsJSONBytes {
		return nil, shared.BadRequest("Bot 工具调用内容过大")
	}
	return out, nil
}

// BotReply 是消息附带的生成状态；普通消息没有该对象。
type BotReply struct {
	// status 当前生成阶段，完成与失败为终态。
	status BotReplyStatus
	// thinking bot 主动上报的可展示思考内容。
	thinking string
	// toolCalls bot 上报的工具调用累计快照，按调用顺序排列。
	toolCalls []BotToolCall
	// revision bot 累计更新的递增版本。
	revision int64
	// updatedAt 最近一次成功上报时间。
	updatedAt time.Time
}

// ReconstructBotReply 从已保存快照恢复生成信息。
func ReconstructBotReply(status BotReplyStatus, thinking string, toolCalls []BotToolCall, revision int64, updatedAt time.Time) *BotReply {
	return &BotReply{status: status, thinking: thinking, toolCalls: append([]BotToolCall(nil), toolCalls...), revision: revision, updatedAt: updatedAt}
}

// NewPendingBotMessage 创建允许空正文的 bot 占位回复。
func NewPendingBotMessage(conversationID, senderID shared.ID, idempotencyKey string, now time.Time, replyToID *shared.ID) (*Message, error) {
	if conversationID.IsZero() || senderID.IsZero() {
		return nil, shared.BadRequest("消息归属不能为空")
	}
	if err := validateIdempotencyKey(idempotencyKey); err != nil {
		return nil, err
	}
	if err := validateReplyToID(replyToID); err != nil {
		return nil, err
	}
	m := newMessage(conversationID, senderID, MessageText, "", nil, nil, replyToID, idempotencyKey, now)
	m.botReply = &BotReply{status: BotReplyPending, updatedAt: now}
	return m, nil
}

// AdvanceBotReply 接受完整快照；过期版本和终态再次更新均拒绝。
func (m *Message) AdvanceBotReply(content, thinking string, toolCalls []BotToolCall, status BotReplyStatus, revision int64, now time.Time) error {
	if m.botReply == nil || m.deletedAt != nil {
		return shared.Conflict("Bot 回复不可更新")
	}
	if m.botReply.status == BotReplyCompleted || m.botReply.status == BotReplyFailed {
		return shared.Conflict("Bot 回复已结束")
	}
	if revision <= m.botReply.revision {
		return shared.Conflict("Bot 回复版本已过期")
	}
	content = strings.TrimSpace(content)
	if len([]rune(content)) > MaxMessageContentLength || len([]rune(thinking)) > MaxBotThinkingLength {
		return shared.BadRequest("Bot 回复内容过长")
	}
	if status != BotReplyPending && status != BotReplyThinking && status != BotReplyStreaming && status != BotReplyCompleted && status != BotReplyFailed {
		return shared.BadRequest("Bot 回复状态无效")
	}
	if status == BotReplyCompleted && content == "" {
		return shared.BadRequest("完成的 Bot 回复不能为空")
	}
	normalizedCalls, err := NormalizeBotToolCalls(toolCalls)
	if err != nil {
		return err
	}
	m.content = content
	m.botReply.status = status
	m.botReply.thinking = thinking
	m.botReply.toolCalls = normalizedCalls
	m.botReply.revision = revision
	m.botReply.updatedAt = now
	m.UpdatedAt = now
	return nil
}

// BotReply 返回当前生成状态；nil 表示普通消息。
func (m *Message) BotReply() *BotReply { return m.botReply }

// Status 返回生成阶段。
func (r *BotReply) Status() BotReplyStatus { return r.status }

// Thinking 返回思考内容。
func (r *BotReply) Thinking() string { return r.thinking }

// ToolCalls 返回工具调用快照的副本，调用方修改不影响已存状态。
func (r *BotReply) ToolCalls() []BotToolCall {
	return append([]BotToolCall(nil), r.toolCalls...)
}

// Revision 返回更新版本。
func (r *BotReply) Revision() int64 { return r.revision }

// UpdatedAt 返回最近上报时间。
func (r *BotReply) UpdatedAt() time.Time { return r.updatedAt }
