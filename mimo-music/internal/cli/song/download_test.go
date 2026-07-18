package song

import (
	"bytes"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// TestShouldSkip 冲突跳过逻辑(表驱动)。
// 文件存在且未 --force → 跳过。
func TestShouldSkip(t *testing.T) {
	t.Parallel()
	cases := []struct {
		exists, force, want bool
	}{
		{exists: false, force: false, want: false}, // 不存在:下载
		{exists: false, force: true, want: false},  // 不存在:即使 force 也下载
		{exists: true, force: false, want: true},   // 存在非 force:跳过
		{exists: true, force: true, want: false},   // 存在 + force:覆盖(不跳)
	}
	for _, tc := range cases {
		if got := shouldSkip(tc.exists, tc.force); got != tc.want {
			t.Errorf("shouldSkip(exists=%v, force=%v) = %v, want %v", tc.exists, tc.force, got, tc.want)
		}
	}
}

// TestProxyReader_IncrsBar proxyReader 读取 N 字节后 Bar.Current 增加 N。
func TestProxyReader_IncrsBar(t *testing.T) {
	t.Parallel()
	p := kit.NewProgress(io.Discard, 80, false)
	bar := p.AddBar(1000, "test")
	clock := &fakeNow{t: time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)}
	pr := &proxyReader{r: bytes.NewReader([]byte("hello world")), bar: bar, now: clock.now}
	// 读几次消耗完。
	buf := make([]byte, 4)
	if n, err := pr.Read(buf); err != nil || n != 4 {
		t.Fatalf("首次 Read got %d bytes, err %v", n, err)
	}
	io.Copy(io.Discard, pr)
	if bar.Current != 11 {
		t.Errorf("读完 11 字节后 bar.Current = %d, want 11", bar.Current)
	}
}

type fakeNow struct{ t time.Time }

func (f *fakeNow) now() time.Time { return f.t }

// TestNewDownload_FlagRequired --id 缺失时命令执行报用法错误(对应 exit 2)。
func TestNewDownload_FlagRequired(t *testing.T) {
	t.Parallel()
	k := kit.New()
	cmd := newDownload(k)
	cmd.SetOut(io.Discard)
	cmd.SetErr(io.Discard)
	err := cmd.Execute()
	if err == nil {
		t.Fatal("缺 --id 应报错")
	}
	// cobra 必填缺失:root.go FlagErrorFunc 包成 ErrUsage,或直接 required flag 错误。
	// 独立 cmd 没 FlagErrorFunc,会是 "required flag(s) \"id\" not set" 消息。
	if !errors.Is(err, kit.ErrUsage) && err.Error() == "" {
		t.Errorf("缺 --id 应是有意义的错误,got %v", err)
	}
}

// TestNewDownload_DefaultFlags flag 默认值正确。
func TestNewDownload_DefaultFlags(t *testing.T) {
	t.Parallel()
	k := kit.New()
	cmd := newDownload(k)
	if lvl, err := cmd.Flags().GetInt("level"); err != nil || lvl != 1 {
		t.Errorf("--level 默认应为 1, got %v (err %v)", lvl, err)
	}
	if out, err := cmd.Flags().GetString("out"); err != nil || out != "." {
		t.Errorf("--out 默认应为 '.', got %q (err %v)", out, err)
	}
	if f, err := cmd.Flags().GetBool("force"); err != nil || f {
		t.Errorf("--force 默认应为 false, got %v (err %v)", f, err)
	}
}
