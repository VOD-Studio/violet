package recent

import (
	"bytes"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
)

// newKitWithPool 构造一个 Kit,召回池指向临时目录,时钟固定,Out/Err 捕获。
func newKitWithPool(t *testing.T, events []recall.Event) (*kit.Kit, *bytes.Buffer) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "history.jsonl")
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	pool := recall.NewPool(func() (string, error) { return path, nil }).WithClock(func() time.Time { return now })
	// 预填事件。
	if len(events) > 0 {
		if err := pool.Append(events...); err != nil {
			t.Fatal(err)
		}
	}
	var out bytes.Buffer
	k := &kit.Kit{Out: &out}
	k.SetRecallPool(pool)
	return k, &out
}

func TestRun_HumanOutput(t *testing.T) {
	events := []recall.Event{
		{ID: 1, Name: "晴天", Artist: "周杰伦", Src: recall.SrcPlay, TS: time.Now().Add(-1 * time.Minute)},
		{ID: 2, Name: "稻香", Artist: "周杰伦", Src: recall.SrcSearch, TS: time.Now().Add(-1 * time.Hour)},
	}
	k, out := newKitWithPool(t, events)
	if err := run(k, 20); err != nil {
		t.Fatalf("run: %v", err)
	}
	s := out.String()
	if !strings.Contains(s, "晴天") || !strings.Contains(s, "稻香") {
		t.Errorf("人类输出应含歌名,got: %s", s)
	}
	if !strings.Contains(s, "周杰伦") {
		t.Errorf("应含艺人")
	}
}

func TestRun_JSONOutput(t *testing.T) {
	events := []recall.Event{
		{ID: 1, Name: "晴天", Artist: "周杰伦", Src: recall.SrcPlay, TS: time.Now().Add(-1 * time.Minute)},
	}
	k, out := newKitWithPool(t, events)
	k.JSON = true
	if err := run(k, 20); err != nil {
		t.Fatalf("run: %v", err)
	}
	var got []rankedJSON
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatalf("JSON 输出应合法: %v\n%s", err, out.String())
	}
	if len(got) != 1 || got[0].ID != 1 {
		t.Errorf("JSON 内容不符: %+v", got)
	}
	if got[0].Name != "晴天" || got[0].Artist != "周杰伦" {
		t.Errorf("name/artist 缺失: %+v", got[0])
	}
	if got[0].Src != "play" || got[0].Score == 0 {
		t.Errorf("src/score 缺失: %+v", got[0])
	}
}

func TestRun_LimitTruncates(t *testing.T) {
	var events []recall.Event
	for i := 0; i < 10; i++ {
		events = append(events, recall.Event{ID: int64(i + 1), Src: recall.SrcPlay})
	}
	k, out := newKitWithPool(t, events)
	k.JSON = true
	if err := run(k, 3); err != nil {
		t.Fatal(err)
	}
	var got []rankedJSON
	json.Unmarshal(out.Bytes(), &got)
	if len(got) != 3 {
		t.Errorf("limit=3 应返回 3,got %d", len(got))
	}
}

func TestRun_EmptyPool_HumanHint(t *testing.T) {
	k, out := newKitWithPool(t, nil) // 无事件
	if err := run(k, 20); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "召回池为空") {
		t.Errorf("空池人类模式应给提示,got: %s", out.String())
	}
}

func TestRun_EmptyPool_JSONEmptyArray(t *testing.T) {
	k, out := newKitWithPool(t, nil)
	k.JSON = true
	if err := run(k, 20); err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(out.String()) != "[]" {
		t.Errorf("空池 JSON 应输出 [],got: %q", out.String())
	}
}

func TestRun_NilPool(t *testing.T) {
	// 异常初始化(pool nil)→ 空输出不报错。
	k := &kit.Kit{}
	var out bytes.Buffer
	k.Out = &out
	if err := run(k, 20); err != nil {
		t.Fatalf("nil pool 不应报错: %v", err)
	}
}

func TestRun_NoNetwork(t *testing.T) {
	// recent 纯读本地,不应触发网络——通过它对无 endpoint 的 Kit 正常工作间接验证
	// (Kit 无 eng,run 不调任何 RawDo/Exec)。
	events := []recall.Event{{ID: 1, Src: recall.SrcPlay}}
	k, _ := newKitWithPool(t, events)
	if err := run(k, 20); err != nil {
		t.Errorf("recent 不应需要网络: %v", err)
	}
}
