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
	reg := NewStreamRegistry()
	taskID := "task-1"

	ch := reg.Insert(taskID, time.Minute)
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
	reg := NewStreamRegistry()
	if reg.Take("nope") != nil {
		t.Error("不存在的 taskID Take 应返回 nil")
	}
}

func TestStreamRegistry_GC_RemovesExpired(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry()
	reg.Insert("old-task", 50*time.Millisecond)

	// 未过期前存在:Take 应返回 non-nil(消费掉该 entry)
	if reg.Take("old-task") == nil {
		t.Error("未过期 entry 的 Take 应返回 non-nil")
	}
	// 重新插一个（Take 刚消费了）
	ch := reg.Insert("old-task", 50*time.Millisecond)

	time.Sleep(80 * time.Millisecond)
	reg.GC(context.Background())
	ch <- appcoderunner.OutputChunk{Type: "stdout", Data: "过期后生产者仍可写入"}
	close(ch)

	// GC 后过期 entry 被清理，Take 返回 nil
	if reg.Take("old-task") != nil {
		t.Error("GC 后过期 entry 应被清理")
	}
}

func TestStreamRegistry_GC_KeepsFresh(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry()
	reg.Insert("fresh-task", time.Minute)

	reg.GC(context.Background())

	if reg.Take("fresh-task") == nil {
		t.Error("未过期的 entry 应保留")
	}
}

func TestStreamRegistry_ConcurrentInsertTake(t *testing.T) {
	// 并发 Insert/Take 不应 panic 或丢数据
	t.Parallel()
	reg := NewStreamRegistry()
	var wg sync.WaitGroup

	// 10 个并发 Insert
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			ch := reg.Insert("task-"+string(rune('a'+n)), time.Minute)
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

func TestStreamRegistryAutomaticallyReclaimsCompletedResults(t *testing.T) {
	t.Parallel()
	reg := NewStreamRegistry()
	ch := reg.Insert("completed", time.Hour)
	close(ch)
	reg.Complete("completed", 10*time.Millisecond)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		reg.mu.RLock()
		_, exists := reg.data["completed"]
		reg.mu.RUnlock()
		if !exists {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("完成后的未消费流未按任务保留期自动回收")
}
