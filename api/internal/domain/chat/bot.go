package chat

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// botTokenPrefix 明文 token 前缀，便于人眼与日志识别（与 PAT 的 violet_pat_ 同构）。
const botTokenPrefix = "violet_bot_"

// BotToken 明文 bot token，仅在创建或重置时一次性返回；库中只存哈希。
type BotToken struct {
	// Value 明文 token 字符串。
	Value string
}

// generateBotToken 生成明文 bot token：前缀 + 32 字节 crypto/rand（base64url）。
//
// 读 crypto/rand 失败返回错误，绝不降级为弱随机——token 一旦可预测，
// 任何持有 token 的外部程序都能冒充 bot 发消息。调用方必须把错误当 500 处理。
func generateBotToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return botTokenPrefix + base64.RawURLEncoding.EncodeToString(b), nil
}

// hashBotToken 对明文 token 取 SHA-256 hex。
//
// 库中只存哈希：明文泄露后无法从哈希反推；鉴权时对入参同样哈希再比对。
func hashBotToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// BotCreated bot 注册成功事件。凭据生命周期应审计，Name 为显示名快照。
type BotCreated struct {
	domainshared.BaseEvent
	// Name bot 显示名。
	Name string
	// UserID 对应的虚拟用户 ID。
	UserID domainshared.ID
}

// NewBotCreated 构造 bot 创建事件。
func NewBotCreated(botID, userID domainshared.ID, name string) BotCreated {
	return BotCreated{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.created", botID),
		Name:      name,
		UserID:    userID,
	}
}

// BotTokenRegenerated bot token 重置事件。token 重置是安全敏感操作，单独审计。
type BotTokenRegenerated struct {
	domainshared.BaseEvent
	// Name bot 显示名快照。
	Name string
}

// NewBotTokenRegenerated 构造 token 重置事件。
func NewBotTokenRegenerated(botID domainshared.ID, name string) BotTokenRegenerated {
	return BotTokenRegenerated{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.token.regenerated", botID),
		Name:      name,
	}
}

// BotEnabled bot 启用事件。
type BotEnabled struct {
	domainshared.BaseEvent
	// Name bot 显示名快照。
	Name string
}

// NewBotEnabled 构造 bot 启用事件。
func NewBotEnabled(botID domainshared.ID, name string) BotEnabled {
	return BotEnabled{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.enabled", botID),
		Name:      name,
	}
}

// BotDisabled bot 禁用事件。
type BotDisabled struct {
	domainshared.BaseEvent
	// Name bot 显示名快照。
	Name string
}

// NewBotDisabled 构造 bot 禁用事件。
func NewBotDisabled(botID domainshared.ID, name string) BotDisabled {
	return BotDisabled{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.disabled", botID),
		Name:      name,
	}
}

// Bot 聊天机器人聚合根。
//
// bot 是以虚拟用户身份接入 Violet 站内聊天的外部程序（如 AI agent）的凭证。
// bot 复用 domain/user 的虚拟用户身份参与会话，前端无感区分 bot 与人类。
//
// 不变量：
//   - tokenHash 创建后只在 RegenerateToken 时替换；明文仅在创建/重置时一次性返回
//   - userID 对应虚拟用户 ID，创建后不可变
//   - enabled 控制鉴权是否放行；禁用的 bot 的 token 仍可比对但鉴权拒绝
type Bot struct {
	domainshared.AggregateRoot
	// userID 对应的虚拟用户 ID，创建后不可变。bot 以此用户身份收发消息。
	userID domainshared.ID
	// name 显示名，出现在会话成员列表与消息 sender 中。
	name string
	// avatarID 头像文件 ID；nil 表示无头像，渲染时用默认头像。
	avatarID *domainshared.ID
	// tokenHash API token 的 SHA-256 hex；明文不存。
	tokenHash string
	// enabled 是否启用。禁用的 bot 鉴权拒绝，但记录保留。
	enabled bool
	// timestamps 创建与更新时间。
	domainshared.Timestamps
}

// NewBot 创建新 bot：生成 token，返回聚合根与明文 token。
//
// id 与 userID 由调用方预先生成（userID 对应已创建的虚拟用户）。
// 明文 token 只在此处返回一次，调用方必须立即转交持有方，不落库不记日志。
func NewBot(id, userID domainshared.ID, name string, avatarID *domainshared.ID, now time.Time) (*Bot, BotToken, error) {
	raw, err := generateBotToken()
	if err != nil {
		return nil, BotToken{}, domainshared.Internal("生成 bot token 失败", err)
	}
	b := &Bot{
		userID:    userID,
		name:      name,
		avatarID:  avatarID,
		tokenHash: hashBotToken(raw),
		enabled:   true,
	}
	b.SetID(id)
	b.CreatedAt = now
	b.UpdatedAt = now
	b.RecordEvent(NewBotCreated(id, userID, name))
	return b, BotToken{Value: raw}, nil
}

// ReconstructBot 从持久化数据重建 bot 聚合（不触发事件、不设默认值）。
func ReconstructBot(
	id, userID domainshared.ID,
	name string,
	avatarID *domainshared.ID,
	tokenHash string,
	enabled bool,
	createdAt, updatedAt time.Time,
) *Bot {
	b := &Bot{
		userID:    userID,
		name:      name,
		avatarID:  avatarID,
		tokenHash: tokenHash,
		enabled:   enabled,
	}
	b.SetID(id)
	b.CreatedAt = createdAt
	b.UpdatedAt = updatedAt
	return b
}

// RegenerateToken 生成新 token 并替换哈希，返回明文。
//
// 旧 token 立即失效：持有旧 token 的外部程序下次鉴权即被拒。
// 明文只在此处返回一次。
func (b *Bot) RegenerateToken(now time.Time) (BotToken, error) {
	raw, err := generateBotToken()
	if err != nil {
		return BotToken{}, domainshared.Internal("生成 bot token 失败", err)
	}
	b.tokenHash = hashBotToken(raw)
	b.UpdatedAt = now
	b.RecordEvent(NewBotTokenRegenerated(b.GetID(), b.name))
	return BotToken{Value: raw}, nil
}

// Enable 启用 bot。已启用的 bot 调用是幂等空操作（不记事件）。
func (b *Bot) Enable(now time.Time) {
	if b.enabled {
		return
	}
	b.enabled = true
	b.UpdatedAt = now
	b.RecordEvent(NewBotEnabled(b.GetID(), b.name))
}

// Disable 禁用 bot。已禁用的 bot 调用是幂等空操作（不记事件）。
func (b *Bot) Disable(now time.Time) {
	if !b.enabled {
		return
	}
	b.enabled = false
	b.UpdatedAt = now
	b.RecordEvent(NewBotDisabled(b.GetID(), b.name))
}

// ID 返回 bot 标识（AggregateRoot.GetID 的域内别名，与 Conversation/Message 同构）。
func (b *Bot) ID() domainshared.ID { return b.GetID() }

// UserID 返回对应的虚拟用户 ID。
func (b *Bot) UserID() domainshared.ID { return b.userID }

// Name 返回显示名。
func (b *Bot) Name() string { return b.name }

// AvatarID 返回头像文件 ID；nil 表示无头像。
func (b *Bot) AvatarID() *domainshared.ID { return b.avatarID }

// TokenHash 返回 token 哈希（仅鉴权比对用，不返回明文）。
func (b *Bot) TokenHash() string { return b.tokenHash }

// IsEnabled 返回是否启用。
func (b *Bot) IsEnabled() bool { return b.enabled }
