package chat

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// BotConnectionManager 维护 bot 的 SSE 连接，按 bot ID 分桶。
//
// 与用户侧 ConnectionManager 同构，但队列事件不参与断线补发：bot 的补拉通道是
// GET /chat/bot/conversations/{id}/messages（消息快照自带全文，重连后按时间拉齐）。
type BotConnectionManager struct {
	mu    sync.Mutex
	conns map[domainshared.ID][]chan EventDTO
	log   zerolog.Logger
}

// NewBotConnectionManager 创建 bot SSE 连接管理器。
func NewBotConnectionManager(logger zerolog.Logger) *BotConnectionManager {
	return &BotConnectionManager{conns: make(map[domainshared.ID][]chan EventDTO), log: logger}
}

// Register 注册一个 bot 连接，返回接收通道与清理函数。
func (m *BotConnectionManager) Register(botID domainshared.ID) (<-chan EventDTO, func()) {
	ch := make(chan EventDTO, 32)
	var once sync.Once
	m.mu.Lock()
	m.conns[botID] = append(m.conns[botID], ch)
	m.mu.Unlock()
	cleanup := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		connections := m.conns[botID]
		for i, current := range connections {
			if current == ch {
				m.conns[botID] = append(connections[:i], connections[i+1:]...)
				break
			}
		}
		if len(m.conns[botID]) == 0 {
			delete(m.conns, botID)
		}
		once.Do(func() { close(ch) })
	}
	return ch, cleanup
}

// Push 向某 bot 的全部在线连接投递事件。队列满即丢弃（慢消费者不拖垮会话写入）。
func (m *BotConnectionManager) Push(botID domainshared.ID, event EventDTO) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ch := range m.conns[botID] {
		select {
		case ch <- event:
		default:
			m.log.Warn().Str("bot_id", botID.String()).Msg("Bot SSE 缓冲已满，事件需由客户端重拉会话消息")
		}
	}
}

// BotNotifier 会话事件面向 bot 的投递端口（chat.Service 的可选依赖）。
type BotNotifier interface {
	// Dispatch 把事件投给应接收它的在线 bot。实现必须不阻塞主链路：
	// 投递失败只记日志，绝不使已成功的发消息/输入上报返回错误。
	Dispatch(ctx context.Context, conversation *domainchat.Conversation, senderID domainshared.ID, mentionedIDs []domainshared.ID, event EventDTO)
}

// BotEventDispatcher 按触发规则筛选应接收事件的 bot 并投递。
//
// 规则（PRD-0029）：
//   - 发送者本身是 bot → 不投给任何 bot，切断 bot→bot 回环
//   - 私聊会话 → 对端 bot 收
//   - 群聊会话 → 仅被 @ 到的 bot 收；输入状态无 mention 信息，故群聊 typing 不投 bot
//   - 禁用的 bot 不投：凭证停了就不该再被唤醒
type BotEventDispatcher struct {
	repo        domainchat.ConversationRepository
	bots        domainchat.BotRepository
	connections *BotConnectionManager
	log         zerolog.Logger
}

// NewBotEventDispatcher 构造 bot 事件分发器。
func NewBotEventDispatcher(repo domainchat.ConversationRepository, bots domainchat.BotRepository, connections *BotConnectionManager, logger zerolog.Logger) *BotEventDispatcher {
	return &BotEventDispatcher{repo: repo, bots: bots, connections: connections, log: logger}
}

// Dispatch 见 BotNotifier。
func (d *BotEventDispatcher) Dispatch(ctx context.Context, conversation *domainchat.Conversation, senderID domainshared.ID, mentionedIDs []domainshared.ID, event EventDTO) {
	targets, err := d.recipientIDs(ctx, conversation, senderID, mentionedIDs)
	if err != nil {
		d.log.Warn().Err(err).Str("conversation_id", conversation.ID().String()).Msg("判定 Bot 事件接收者失败")
		return
	}
	for _, botID := range targets {
		d.connections.Push(botID, event)
	}
}

// recipientIDs 返回应接收该事件的启用 bot ID。
func (d *BotEventDispatcher) recipientIDs(ctx context.Context, conversation *domainchat.Conversation, senderID domainshared.ID, mentionedIDs []domainshared.ID) ([]domainshared.ID, error) {
	members, err := d.repo.ListMembers(ctx, conversation.ID(), false)
	if err != nil {
		return nil, err
	}
	memberIDs := make([]domainshared.ID, 0, len(members))
	for _, member := range members {
		if member.IsActive() {
			memberIDs = append(memberIDs, member.UserID())
		}
	}
	bots, err := d.bots.ListByUserIDs(ctx, memberIDs)
	if err != nil {
		return nil, err
	}
	isDirect := conversation.Kind() == domainchat.ConversationDirect
	mentioned := make(map[domainshared.ID]struct{}, len(mentionedIDs))
	for _, id := range mentionedIDs {
		mentioned[id] = struct{}{}
	}
	out := make([]domainshared.ID, 0, len(bots))
	for _, bot := range bots {
		switch {
		case !bot.IsEnabled():
			continue
		case bot.UserID().Equal(senderID):
			// 发送者就是 bot：无论是它自己的回声还是 bot 间互聊，都不投。
			return nil, nil
		case isDirect:
			out = append(out, bot.ID())
		default:
			if _, ok := mentioned[bot.UserID()]; ok {
				out = append(out, bot.ID())
			}
		}
	}
	return out, nil
}

// NewBotEvent 组装 bot 侧 SSE 事件信封。
//
// ID 留空：bot 事件不写 `id:` 行，浏览器/客户端的 Last-Event-ID 续传语义只对
// 用户侧持久化事件成立，bot 的恢复路径是重拉会话消息。
func NewBotEvent(eventType domainchat.ChatEventType, data map[string]any, occurredAt time.Time) EventDTO {
	return EventDTO{
		Type:       string(eventType),
		Version:    1,
		OccurredAt: occurredAt.Format(time.RFC3339Nano),
		Data:       data,
	}
}
