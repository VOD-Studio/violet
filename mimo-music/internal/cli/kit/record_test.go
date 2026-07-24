package kit

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
)

// newKitWithTestPool 构造一个 Kit,召回池指向临时目录,返回池路径供断言。
func newKitWithTestPool(t *testing.T) (*Kit, string) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "history.jsonl")
	pool := recall.NewPool(func() (string, error) { return path, nil })
	k := &Kit{pool: pool}
	// 注入 capturing stderr 让 Warnf 可断言。
	var buf capturingWriter
	k.Err = &buf
	return k, path
}

func TestRecord_WritesEventToPool(t *testing.T) {
	k, path := newKitWithTestPool(t)
	k.Record(347230, "晴天", "周杰伦", recall.SrcPlay)

	pool := k.RecallPool()
	ranked, err := pool.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(ranked) != 1 {
		t.Fatalf("应 1 候选,got %d", len(ranked))
	}
	if ranked[0].Event.ID != 347230 || ranked[0].Event.Name != "晴天" {
		t.Errorf("事件不符: %+v", ranked[0].Event)
	}
	// 验证文件确实落盘。
	if _, err := os.Stat(path); err != nil {
		t.Errorf("文件应落盘: %v", err)
	}
}

func TestRecord_NilPool_NoOp(t *testing.T) {
	k := &Kit{pool: nil}
	// 不应 panic。
	k.Record(1, "x", "y", recall.SrcPlay)
}

func TestRecord_ZeroID_NoOp(t *testing.T) {
	k, _ := newKitWithTestPool(t)
	k.Record(0, "x", "y", recall.SrcPlay)
	ranked, _ := k.RecallPool().Load()
	if ranked != nil {
		t.Errorf("id=0 不应记录,got %v", ranked)
	}
}

func TestRecord_AppendsMultiple(t *testing.T) {
	k, _ := newKitWithTestPool(t)
	k.Record(1, "a", "x", recall.SrcPlay)
	k.Record(2, "b", "y", recall.SrcSearch)
	ranked, _ := k.RecallPool().Load()
	if len(ranked) != 2 {
		t.Errorf("两次 Record 后应 2 候选,got %d", len(ranked))
	}
}
