package recall

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// newTestPool 构造一个指向临时目录 history.jsonl 的 Pool,时钟固定。
func newTestPool(t *testing.T) (*Pool, string) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "history.jsonl")
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	p := NewPool(func() (string, error) { return path, nil }).WithClock(func() time.Time { return now })
	return p, path
}

func TestAppend_ThenLoad_RoundTrip(t *testing.T) {
	p, _ := newTestPool(t)
	events := []Event{
		{ID: 1, Name: "晴天", Artist: "周杰伦", Src: SrcPlay},
		{ID: 2, Name: "稻香", Artist: "周杰伦", Src: SrcSearch},
	}
	if err := p.Append(events...); err != nil {
		t.Fatalf("Append: %v", err)
	}
	ranked, err := p.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(ranked) != 2 {
		t.Fatalf("got %d 候选,want 2", len(ranked))
	}
}

func TestLoad_NewUser_EmptyFile(t *testing.T) {
	p, _ := newTestPool(t)
	ranked, err := p.Load()
	if err != nil {
		t.Fatalf("新用户 Load 应无错: %v", err)
	}
	if ranked != nil {
		t.Errorf("空池应返回 nil,got %v", ranked)
	}
}

func TestAppend_AtomicWrite_NoTmpLeft(t *testing.T) {
	p, path := newTestPool(t)
	if err := p.Append(Event{ID: 1, Src: SrcPlay}); err != nil {
		t.Fatal(err)
	}
	// tmp 文件不应残留。
	if _, err := os.Stat(path + ".tmp"); !os.IsNotExist(err) {
		t.Errorf("tmp 文件应已 rename 掉,stat err = %v", err)
	}
}

func TestAppend_Permissions(t *testing.T) {
	p, path := newTestPool(t)
	if err := p.Append(Event{ID: 1, Src: SrcPlay}); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Errorf("history.jsonl 权限 = %o, want 0600", got)
	}
	// 注:目录权限由 MkdirAll 在创建时设 0700,但测试用 t.TempDir()(已存在,0755),
	// MkdirAll 不收紧已存在目录权限,故不在此断言目录权限;生产环境新建目录得 0700。
}

func TestAppend_AppendsToExisting(t *testing.T) {
	p, _ := newTestPool(t)
	if err := p.Append(Event{ID: 1, Src: SrcPlay}); err != nil {
		t.Fatal(err)
	}
	if err := p.Append(Event{ID: 2, Src: SrcPlay}); err != nil {
		t.Fatal(err)
	}
	ranked, _ := p.Load()
	if len(ranked) != 2 {
		t.Errorf("两次 Append 后应 2 候选,got %d", len(ranked))
	}
}

func TestAppend_DropOldestAtCapacity(t *testing.T) {
	p, _ := newTestPool(t)
	// 写 MaxLines + 50 个不同 id,验证只剩 MaxLines 个,且是最新的那些(drop oldest)。
	var events []Event
	for i := 0; i < MaxLines+50; i++ {
		events = append(events, Event{ID: int64(i + 1), Src: SrcPlay})
	}
	if err := p.Append(events...); err != nil {
		t.Fatal(err)
	}
	ranked, _ := p.Load()
	if len(ranked) != MaxLines {
		t.Fatalf("裁剪后应 %d 候选,got %d", MaxLines, len(ranked))
	}
	// 最旧的 id 1..50 应被裁掉;存活的最小 id 是 51。
	minID := int64(1 << 62)
	for _, r := range ranked {
		if r.Event.ID < minID {
			minID = r.Event.ID
		}
	}
	if minID < 51 {
		t.Errorf("drop oldest 后最小 id 应 >= 51,got %d", minID)
	}
}

func TestLoad_SkipsCorruptLine(t *testing.T) {
	p, path := newTestPool(t)
	dir := filepath.Dir(path)
	_ = os.MkdirAll(dir, 0o700)
	// 手写:合法行 + 坏行 + 合法行。
	good1, _ := json.Marshal(Event{ID: 1, Name: "好1", Src: SrcPlay})
	good2, _ := json.Marshal(Event{ID: 2, Name: "好2", Src: SrcPlay})
	content := string(good1) + "\n{不是合法json}\n" + string(good2) + "\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	ranked, err := p.Load()
	if err != nil {
		t.Fatalf("单行损坏不应报错: %v", err)
	}
	if len(ranked) != 2 {
		t.Errorf("坏行应跳过,得 2 候选,got %d", len(ranked))
	}
}

func TestLoad_SkipsLineWithZeroID(t *testing.T) {
	p, path := newTestPool(t)
	_ = os.MkdirAll(filepath.Dir(path), 0o700)
	// id=0 视为无效,跳过。
	content := `{"id":0,"src":"play"}` + "\n" + `{"id":5,"src":"play"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	ranked, _ := p.Load()
	if len(ranked) != 1 {
		t.Errorf("id=0 应跳过,得 1 候选,got %d", len(ranked))
	}
}

func TestTopN_LimitsResults(t *testing.T) {
	p, _ := newTestPool(t)
	var events []Event
	for i := 0; i < 10; i++ {
		events = append(events, Event{ID: int64(i + 1), Src: SrcPlay})
	}
	if err := p.Append(events...); err != nil {
		t.Fatal(err)
	}
	ranked, _ := p.TopN(3)
	if len(ranked) != 3 {
		t.Errorf("TopN(3) 应返回 3,got %d", len(ranked))
	}
	// N 超过实际数量返回全部。
	rankedAll, _ := p.TopN(100)
	if len(rankedAll) != 10 {
		t.Errorf("TopN(100) 应返回全部 10,got %d", len(rankedAll))
	}
}

func TestAppend_EmptyNoOp(t *testing.T) {
	p, _ := newTestPool(t)
	if err := p.Append(); err != nil {
		t.Errorf("Append() 空 slice 应无错: %v", err)
	}
	// 文件不应被创建。
	ranked, _ := p.Load()
	if ranked != nil {
		t.Errorf("空 Append 后 Load 应 nil")
	}
}
