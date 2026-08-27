package chat

import (
	"encoding/json"
	"sync"

	domainshared "blog-api/internal/domain/shared"
	"github.com/rs/zerolog"
)

// ConnectionManager 维护用户聊天 SSE 连接。
type ConnectionManager struct {
	mu    sync.Mutex
	conns map[domainshared.ID][]chan EventDTO
	log   zerolog.Logger
}

// NewConnectionManager 创建聊天 SSE 连接管理器。
func NewConnectionManager(log zerolog.Logger) *ConnectionManager {
	return &ConnectionManager{conns: make(map[domainshared.ID][]chan EventDTO), log: log}
}

// Register 注册用户连接并返回接收通道与清理函数。
func (m *ConnectionManager) Register(userID domainshared.ID) (<-chan EventDTO, func()) {
	ch := make(chan EventDTO, 32)
	var once sync.Once
	m.mu.Lock()
	m.conns[userID] = append(m.conns[userID], ch)
	m.mu.Unlock()
	cleanup := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		connections := m.conns[userID]
		for i, current := range connections {
			if current == ch {
				m.conns[userID] = append(connections[:i], connections[i+1:]...)
				break
			}
		}
		if len(m.conns[userID]) == 0 {
			delete(m.conns, userID)
		}
		once.Do(func() { close(ch) })
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
