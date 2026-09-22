package chat

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// botTokenPrefix 明文 token 前缀，便于人眼与日志识别（与 PAT 的 violet_pat_ 同构）。
const botTokenPrefix = "violet_bot_"

// MaxBotNameLength bot 显示名上限。
//
// 比 chat_bots.name 的 VARCHAR(80) 更严：bot 名会同步到虚拟用户的 display_name，
// 后者受 DisplayName 值对象 32 字符上限约束，取两者的交集才不会写出「能存不能显示」的名。
const MaxBotNameLength = 32

// normalizeBotName 修剪并校验 bot 名称。
//
// 按 Unicode 字符计数而非字节：中文名是常态，按字节会把 30 个汉字判为超限。
func normalizeBotName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", domainshared.BadRequest("Bot 名称不能为空")
	}
	if len([]rune(trimmed)) > MaxBotNameLength {
		return "", domainshared.BadRequest("Bot 名称最多 32 个字符")
	}
	return trimmed, nil
}

// BotToken 明文 bot token。创建与重置时随响应返回一次，其余时候经
// Bot.Token() 取回（前提是持久层存了可解密的密文，见仓储）。
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

// HashBotToken 对明文 token 取 SHA-256 hex。
//
// 库中只存哈希：明文泄露后无法从哈希反推；鉴权时对入参同样哈希再比对。
// 导出是给鉴权路径复用同一规则，避免两处各写一份 SHA-256 而形态漂移。
func HashBotToken(token string) string {
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

// BotRenamed bot 显示名变更事件。虚拟用户 display_name 由应用层同步。
type BotRenamed struct {
	domainshared.BaseEvent
	// From 变更前名称。
	From string
	// To 变更后名称。
	To string
}

// NewBotRenamed 构造名称变更事件。
func NewBotRenamed(botID domainshared.ID, from, to string) BotRenamed {
	return BotRenamed{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.renamed", botID),
		From:      from,
		To:        to,
	}
}

// BotAvatarUpdated bot 头像变更事件。AvatarID 为空字符串表示清除头像。
type BotAvatarUpdated struct {
	domainshared.BaseEvent
	// AvatarID 新头像文件 ID；空串表示无头像。
	AvatarID string
}

// NewBotAvatarUpdated 构造头像变更事件。
func NewBotAvatarUpdated(botID domainshared.ID, avatarID *domainshared.ID) BotAvatarUpdated {
	value := ""
	if avatarID != nil {
		value = avatarID.String()
	}
	return BotAvatarUpdated{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.avatar.updated", botID),
		AvatarID:  value,
	}
}

// BotDeleted bot 凭证吊销事件。
//
// 删除不改变聚合内部状态，故不经 RecordEvent 由用例直接构造发布（与 PATDeleted 同构）。
// UserID 是保留但被停用的虚拟用户：审计要能从凭证回溯到主体。
type BotDeleted struct {
	domainshared.BaseEvent
	// Name bot 显示名快照。
	Name string
	// UserID 对应虚拟用户 ID。
	UserID domainshared.ID
}

// NewBotDeleted 构造 bot 吊销事件。
func NewBotDeleted(botID, userID domainshared.ID, name string) BotDeleted {
	return BotDeleted{
		BaseEvent: domainshared.NewBaseEvent("chat.bot.deleted", botID),
		Name:      name,
		UserID:    userID,
	}
}

// Bot 聊天机器人聚合根。
//
// bot 是以虚拟用户身份接入 Violet 站内聊天的外部程序（如 AI agent）的凭证。
// bot 复用 domain/user 的虚拟用户身份参与会话，前端无感区分 bot 与人类。
//
// 不变量：
//   - tokenHash 创建后只在 RegenerateToken 时替换；鉴权比对走它，明文只在库里以密文形态存在
//   - token 明文可能为空：引入密文列之前创建的 bot、或密钥已变更解不开时，
//     凭证仍能正常鉴权（tokenHash 在），只是拿不回明文，只能重置
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
	// tokenHash API token 的 SHA-256 hex，落库并建唯一索引供鉴权反查。
	tokenHash string
	// token 明文 token，由持久层从密文列解密得到；空串表示不可查看。
	token string
	// enabled 是否启用。禁用的 bot 鉴权拒绝，但记录保留。
	enabled bool
	// timestamps 创建与更新时间。
	domainshared.Timestamps
}

// NewBot 创建新 bot：生成 token，返回聚合根与明文 token。
//
// id 与 userID 由调用方预先生成（userID 对应已创建的虚拟用户）。
// 明文同时留在聚合上供持久层加密保存；日志与不加密的列不得出现它。
func NewBot(id, userID domainshared.ID, name string, avatarID *domainshared.ID, now time.Time) (*Bot, BotToken, error) {
	name, err := normalizeBotName(name)
	if err != nil {
		return nil, BotToken{}, err
	}
	raw, err := generateBotToken()
	if err != nil {
		return nil, BotToken{}, domainshared.Internal("生成 bot token 失败", err)
	}
	b := &Bot{
		userID:    userID,
		name:      name,
		avatarID:  avatarID,
		tokenHash: HashBotToken(raw),
		token:     raw,
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
	token string,
	enabled bool,
	createdAt, updatedAt time.Time,
) *Bot {
	b := &Bot{
		userID:    userID,
		name:      name,
		avatarID:  avatarID,
		tokenHash: tokenHash,
		token:     token,
		enabled:   enabled,
	}
	b.SetID(id)
	b.CreatedAt = createdAt
	b.UpdatedAt = updatedAt
	return b
}

// RegenerateToken 生成新 token 并替换哈希与明文，返回明文。
//
// 旧 token 立即失效：持有旧 token 的外部程序下次鉴权即被拒。
func (b *Bot) RegenerateToken(now time.Time) (BotToken, error) {
	raw, err := generateBotToken()
	if err != nil {
		return BotToken{}, domainshared.Internal("生成 bot token 失败", err)
	}
	b.tokenHash = HashBotToken(raw)
	b.token = raw
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

// Rename 修改显示名。同名调用是幂等空操作（不记事件）。
func (b *Bot) Rename(name string, now time.Time) error {
	normalized, err := normalizeBotName(name)
	if err != nil {
		return err
	}
	if normalized == b.name {
		return nil
	}
	previous := b.name
	b.name = normalized
	b.UpdatedAt = now
	b.RecordEvent(NewBotRenamed(b.GetID(), previous, normalized))
	return nil
}

// SetAvatar 替换头像；传 nil 清除头像。同值调用是幂等空操作（不记事件）。
func (b *Bot) SetAvatar(avatarID *domainshared.ID, now time.Time) {
	if sameID(b.avatarID, avatarID) {
		return
	}
	b.avatarID = avatarID
	b.UpdatedAt = now
	b.RecordEvent(NewBotAvatarUpdated(b.GetID(), avatarID))
}

// sameID 比较两个可选 ID，nil 与非 nil 不等。
func sameID(a, b *domainshared.ID) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

// ID 返回 bot 标识（AggregateRoot.GetID 的域内别名，与 Conversation/Message 同构）。
func (b *Bot) ID() domainshared.ID { return b.GetID() }

// UserID 返回对应的虚拟用户 ID。
func (b *Bot) UserID() domainshared.ID { return b.userID }

// Name 返回显示名。
func (b *Bot) Name() string { return b.name }

// AvatarID 返回头像文件 ID；nil 表示无头像。
func (b *Bot) AvatarID() *domainshared.ID { return b.avatarID }

// TokenHash 返回 token 哈希（鉴权比对用）。
func (b *Bot) TokenHash() string { return b.tokenHash }

// Token 返回明文 token；空串表示本行没有可查看的凭据（密文缺失或密钥已换），
// 调用方应引导重置而不是把空串当 token 返回给持有方。
func (b *Bot) Token() string { return b.token }

// IsEnabled 返回是否启用。
func (b *Bot) IsEnabled() bool { return b.enabled }
