package coderunner

import (
	"context"
	"sync"
	"time"

	appcoderunner "blog-api/internal/application/coderunner"
)

// StreamRegistry 进程内 SSE channel 注册表。
//
// 对应 yggdrasil 的 EXEC_STREAMS（DashMap）。流式执行路径 StartExecStream
// 创建 channel 存入此处，SSE handler 从此处 Take 取走消费。
//
// channel 是进程内的：单实例下无影响；多实例需配合粘性路由（见 ADR-0006 扩展点）。
// 前端永不连 SSE 会导致 entry 泄漏，靠 GC 按 TTL 清理兜底。
type StreamRegistry struct {
	mu   sync.RWMutex
	data map[string]streamEntry
	ttl  time.Duration
}

// streamEntry 单个任务的流式 channel + 创建时间（供 GC 判定）。
type streamEntry struct {
	ch        chan appcoderunner.OutputChunk
	createdAt time.Time
}

// NewStreamRegistry 构造注册表。ttl 为 entry 保留时长（防泄漏）。
func NewStreamRegistry(ttl time.Duration) *StreamRegistry {
	return &StreamRegistry{
		data: make(map[string]streamEntry),
		ttl:  ttl,
	}
}

// Insert 创建并注册一个 channel，返回供生产者（执行后台 goroutine）写入。
func (r *StreamRegistry) Insert(taskID string) chan appcoderunner.OutputChunk {
	ch := make(chan appcoderunner.OutputChunk, 64)
	r.mu.Lock()
	r.data[taskID] = streamEntry{ch: ch, createdAt: time.Now()}
	r.mu.Unlock()
	return ch
}

// Take 取出并删除 channel（一次性消费），返回 nil 表示不存在。
//
// 一次性语义对应 SSE handler：前端连上 SSE 时取走 channel 独占消费，
// 取走后该 taskID 不再可被其他连接 Take（防止重复消费）。
func (r *StreamRegistry) Take(taskID string) chan appcoderunner.OutputChunk {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.data[taskID]
	if !ok {
		return nil
	}
	delete(r.data, taskID)
	return entry.ch
}

// GC 清理超过 TTL 的 entry（前端永不连 SSE 的兜底）。
//
// 关闭 channel 通知等待的消费者（执行 goroutine）停止写入。
func (r *StreamRegistry) GC(ctx context.Context) {
	now := time.Now()
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, entry := range r.data {
		if now.Sub(entry.createdAt) > r.ttl {
			close(entry.ch)
			delete(r.data, id)
		}
	}
}
