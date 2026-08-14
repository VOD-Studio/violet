package notification

import (
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

func TestConnectionManager_RegisterAndPush(t *testing.T) {
	mgr := NewConnectionManager(zerolog.Nop())
	userID := domainshared.NewID()

	ch, cleanup := mgr.Register(userID)
	defer cleanup()

	// 推送一条通知
	mgr.Push(userID, SSEEvent{ID: "notif-1", Title: "测试通知"})

	select {
	case event := <-ch:
		assert.Equal(t, "notif-1", event.ID)
		assert.Equal(t, "测试通知", event.Title)
	default:
		t.Fatal("应收到推送")
	}
}

func TestConnectionManager_MultipleConnectionsSameUser(t *testing.T) {
	mgr := NewConnectionManager(zerolog.Nop())
	userID := domainshared.NewID()

	ch1, cleanup1 := mgr.Register(userID)
	defer cleanup1()
	ch2, cleanup2 := mgr.Register(userID)
	defer cleanup2()

	mgr.Push(userID, SSEEvent{ID: "notif-1"})

	// 两个连接都应收到
	<-ch1
	<-ch2
	// 两个 channel 都收到 = 广播正确
}

func TestConnectionManager_CleanupRemovesConnection(t *testing.T) {
	mgr := NewConnectionManager(zerolog.Nop())
	userID := domainshared.NewID()

	ch, cleanup := mgr.Register(userID)
	cleanup()

	// cleanup 关闭了 channel：从 closed channel 读立即返回零值 + ok=false
	_, ok := <-ch
	assert.False(t, ok, "cleanup 后 channel 应已关闭")

	// cleanup 后推送不应 panic（用户已从 map 移除）
	mgr.Push(userID, SSEEvent{ID: "notif-1"})

	// 用户不应出现在 conns map
	mgr.mu.Lock()
	_, exists := mgr.conns[userID]
	mgr.mu.Unlock()
	assert.False(t, exists)
}

func TestConnectionManager_PushToOfflineUser_NoOp(t *testing.T) {
	mgr := NewConnectionManager(zerolog.Nop())
	userID := domainshared.NewID()

	// 无在线连接时推送 = 无操作，不 panic
	mgr.Push(userID, SSEEvent{ID: "notif-1"})

	// 用户不应出现在 conns map
	mgr.mu.Lock()
	_, exists := mgr.conns[userID]
	mgr.mu.Unlock()
	assert.False(t, exists)
}

func TestConnectionManager_BufferFullDropsSilently(t *testing.T) {
	mgr := NewConnectionManager(zerolog.Nop())
	userID := domainshared.NewID()

	ch, cleanup := mgr.Register(userID)
	defer cleanup()

	// 填满缓冲（16 条）
	for i := 0; i < 16; i++ {
		mgr.Push(userID, SSEEvent{ID: "notif"})
	}

	// 第 17 条应被丢弃，不阻塞
	mgr.Push(userID, SSEEvent{ID: "overflow"})

	// 读出 16 条
	count := 0
	for range ch {
		count++
		if count == 16 {
			break
		}
	}
	require.Equal(t, 16, count)
}

func TestConnectionManager_CleanupIdempotent(t *testing.T) {
	mgr := NewConnectionManager(zerolog.Nop())
	userID := domainshared.NewID()

	_, cleanup := mgr.Register(userID)

	// cleanup 重复调用不应 panic（sync.Once 保护 close）
	cleanup()
	assert.NotPanics(t, func() { cleanup() })
}
