package coderunner

import (
	"context"
	"sync"
	"testing"
	"time"

	appcoderunner "blog-api/internal/application/coderunner"
)

func TestStreamRegistry_InsertAndTake(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry(time.Minute)
	taskID := "task-1"

	ch := reg.Insert(taskID)
	ch <- appcoderunner.OutputChunk{Type: "stdout", Data: "hello"}

	got := reg.Take(taskID)
	if got == nil {
		t.Fatal("Take 应返回插入的 channel")
	}
	select {
	case chunk := <-got:
		if chunk.Type != "stdout" || chunk.Data != "hello" {
			t.Errorf("收到 chunk = %+v", chunk)
		}
	case <-time.After(time.Second):
		t.Error("应能从 channel 读到 chunk")
	}

	// Take 后再 Take 应返回 nil（一次性消费，对应 SSE handler 取走后删除）
	if reg.Take(taskID) != nil {
		t.Error("Take 后应删除，二次 Take 返回 nil")
	}
}

func TestStreamRegistry_Take_NotExist(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry(time.Minute)
	if reg.Take("nope") != nil {
		t.Error("不存在的 taskID Take 应返回 nil")
	}
}

func TestStreamRegistry_GC_RemovesExpired(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry(50 * time.Millisecond) // 短 TTL
	reg.Insert("old-task")

	// 未过期前存在
	if reg.Take("old-task") == nil {
		// Take 会消费掉，换个方式验证：直接查内部不暴露，用 GC 行为间接验证
	}
	// 重新插一个（Take 刚消费了）
	reg.Insert("old-task")

	time.Sleep(80 * time.Millisecond)
	reg.GC(context.Background())

	// GC 后过期 entry 被清理，Take 返回 nil
	if reg.Take("old-task") != nil {
		t.Error("GC 后过期 entry 应被清理")
	}
}

func TestStreamRegistry_GC_KeepsFresh(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry(time.Minute)
	reg.Insert("fresh-task")

	reg.GC(context.Background())

	if reg.Take("fresh-task") == nil {
		t.Error("未过期的 entry 应保留")
	}
}

func TestStreamRegistry_ConcurrentInsertTake(t *testing.T) {
	// 并发 Insert/Take 不应 panic 或丢数据
	t.Parallel()
	reg := NewStreamRegistry(time.Minute)
	var wg sync.WaitGroup

	// 10 个并发 Insert
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			ch := reg.Insert("task-" + string(rune('a'+n)))
			ch <- appcoderunner.OutputChunk{Type: "done", Data: "ok"}
		}(i)
	}
	wg.Wait()

	// 顺序 Take 验证全部可消费
	count := 0
	for i := 0; i < 10; i++ {
		if reg.Take("task-"+string(rune('a'+i))) != nil {
			count++
		}
	}
	if count != 10 {
		t.Errorf("并发 Insert 后应能 Take 全部 10 个，实际 %d", count)
	}
}
