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
}

// streamEntry 仅由生产者关闭 channel，过期回收只移除注册项。
type streamEntry struct {
	ch        chan appcoderunner.OutputChunk
	timer     *time.Timer
	expiresAt time.Time
}

// NewStreamRegistry 构造按任务保留期回收的注册表。
func NewStreamRegistry() *StreamRegistry {
	return &StreamRegistry{data: make(map[string]streamEntry)}
}

// Insert 注册活动任务流；到期删除索引，不关闭生产者仍在写入的 channel。
func (r *StreamRegistry) Insert(taskID string, ttl time.Duration) chan appcoderunner.OutputChunk {
	ch := make(chan appcoderunner.OutputChunk, 64)
	r.mu.Lock()
	if old, ok := r.data[taskID]; ok {
		old.timer.Stop()
	}
	r.data[taskID] = r.entry(taskID, ch, ttl)
	r.mu.Unlock()
	return ch
}

func (r *StreamRegistry) entry(taskID string, ch chan appcoderunner.OutputChunk, ttl time.Duration) streamEntry {
	expiry := time.Now().Add(ttl)
	timer := time.AfterFunc(ttl, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if current, ok := r.data[taskID]; ok && current.ch == ch && !time.Now().Before(current.expiresAt) {
			delete(r.data, taskID)
		}
	})
	return streamEntry{ch: ch, timer: timer, expiresAt: expiry}
}

// Complete 从完成时重新计算未消费结果流的保留期。
func (r *StreamRegistry) Complete(taskID string, ttl time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if current, ok := r.data[taskID]; ok {
		current.timer.Stop()
		r.data[taskID] = r.entry(taskID, current.ch, ttl)
	}
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
	entry.timer.Stop()
	return entry.ch
}

// GC 删除过期索引，不能关闭仍属于生产者的 channel。
func (r *StreamRegistry) GC(ctx context.Context) {
	now := time.Now()
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, entry := range r.data {
		if !now.Before(entry.expiresAt) {
			entry.timer.Stop()
			delete(r.data, id)
		}
	}
}
