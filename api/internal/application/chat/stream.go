package chat

import (
	"encoding/json"
	"sync"

	domainshared "blog-api/internal/domain/shared"
	"github.com/rs/zerolog"
)

// ConnectionManager 维护用户聊天 SSE 连接。
type ConnectionManager struct {
	mu       sync.Mutex
	conns    map[domainshared.ID][]chan EventDTO
	log      zerolog.Logger
	listener func(userID domainshared.ID)
}

// NewConnectionManager 创建聊天 SSE 连接管理器。
func NewConnectionManager(log zerolog.Logger) *ConnectionManager {
	return &ConnectionManager{conns: make(map[domainshared.ID][]chan EventDTO), log: log}
}

// SetPresenceListener 注册在线状态监听：用户的第一条连接建立或最后一条连接断开时调用。
//
// 监听在锁外同步调用，调用方若要做耗时工作须自行异步。
func (m *ConnectionManager) SetPresenceListener(listener func(userID domainshared.ID)) {
	m.mu.Lock()
	m.listener = listener
	m.mu.Unlock()
}

// IsOnline 判断用户当前是否至少有一条聊天 SSE 连接。
func (m *ConnectionManager) IsOnline(userID domainshared.ID) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.conns[userID]) > 0
}

// Register 注册用户连接并返回接收通道与清理函数。
func (m *ConnectionManager) Register(userID domainshared.ID) (<-chan EventDTO, func()) {
	ch := make(chan EventDTO, 32)
	var once sync.Once
	m.mu.Lock()
	first := len(m.conns[userID]) == 0
	m.conns[userID] = append(m.conns[userID], ch)
	listener := m.listener
	m.mu.Unlock()
	if first && listener != nil {
		listener(userID)
	}
	cleanup := func() {
		var notify func(userID domainshared.ID)
		m.mu.Lock()
		connections := m.conns[userID]
		for i, current := range connections {
			if current == ch {
				m.conns[userID] = append(connections[:i], connections[i+1:]...)
				break
			}
		}
		if len(m.conns[userID]) == 0 {
			delete(m.conns, userID)
			notify = m.listener
		}
		once.Do(func() { close(ch) })
		m.mu.Unlock()
		if notify != nil {
			notify(userID)
		}
	}
	return ch, cleanup
}

// Push 向用户的所有在线连接广播事件。
func (m *ConnectionManager) Push(userID domainshared.ID, event EventDTO) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ch := range m.conns[userID] {
		select {
		case ch <- event:
		default:
			m.log.Warn().Str("user_id", userID.String()).Msg("聊天 SSE 缓冲已满，事件将由客户端补拉")
		}
	}
}

// EventNotifier 返回连接管理器作为 application 端口。
func (m *ConnectionManager) EventNotifier() EventNotifier { return m }

// MarshalEvent 序列化 SSE data 行。
func MarshalEvent(event EventDTO) string {
	data, _ := json.Marshal(event)
	return string(data)
}
