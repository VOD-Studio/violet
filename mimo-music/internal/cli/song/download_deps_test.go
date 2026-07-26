package song

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// runDownload 错误路径测试(社区共识:抽 deps mock 网络,文件系统用 t.TempDir)。
// 覆盖 issue #20 验收的 4 项待验证场景。

// newTestKit 构造测试用 Kit:Out/Err 捕获到 buffer,JSON=false(人类模式)。
func newTestKit() (*kit.Kit, *bytes.Buffer, *bytes.Buffer) {
	var out, errb bytes.Buffer
	k := &kit.Kit{Out: &out, Err: &errb}
	return k, &out, &errb
}

// TestRunDownload_VIPNoSource VIP/无音源:fetchURL 返回空 Url → exit 1 错误消息。
func TestRunDownload_VIPNoSource(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	deps := downloadDeps{
		fetchURL: func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: ""}, nil // 空 Url = VIP/无音源
		},
	}
	err := runDownload(k, 99999, 1, t.TempDir(), false, false, false, "", deps)
	if err == nil {
		t.Fatal("VIP 无音源应返回错误")
	}
	if !strings.Contains(err.Error(), "无可用音源") {
		t.Errorf("错误消息应含「无可用音源」,got %q", err.Error())
	}
	if !strings.Contains(err.Error(), "99999") {
		t.Errorf("错误消息应含歌曲 id,got %q", err.Error())
	}
}

// TestRunDownload_NilURL fetchURL 返回 nil Url(接口异常)→ 同样报无音源。
func TestRunDownload_NilURL(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) { return nil, nil },
	}
	if err := runDownload(k, 1, 1, t.TempDir(), false, false, false, "", deps); err == nil {
		t.Fatal("nil Url 应报错")
	}
}

// TestRunDownload_NoSource_WithReason 空 URL + check-available 给出原因
// → 错误带出真实原因(如无版权),而非误导性的音质建议。
func TestRunDownload_NoSource_WithReason(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: ""}, nil
		},
		checkAvailable: func(context.Context, int64) (string, error) {
			return "亲爱的,暂无版权", nil
		},
	}
	err := runDownload(k, 174963, 1, t.TempDir(), false, false, false, "", deps)
	if err == nil || !strings.Contains(err.Error(), "亲爱的,暂无版权") {
		t.Fatalf("应带出 check-available 的真实原因,got %v", err)
	}
	if strings.Contains(err.Error(), "换个音质") {
		t.Errorf("有真实原因时不应再给音质建议,got %q", err.Error())
	}
}

// TestRunDownload_MetadataFailureWarnf 元数据写入失败 → Warnf 警告到 stderr,文件仍保存,exit 0。
func TestRunDownload_MetadataFailureWarnf(t *testing.T) {
	t.Parallel()
	k, stdout, stderr := newTestKit()
	dir := t.TempDir()
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://example.com/x.mp3", Format: "mp3", Size: 100}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 1, Name: "test", Artists: []*mmpb.Artist{{Name: "artist"}}}, nil
		},
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			// 模拟下载:写一个空文件让元数据有目标可写(会失败因为不是真 mp3)。
			if err := os.WriteFile(path, []byte("fake"), 0o644); err != nil {
				return 0, err
			}
			return 4, nil
		},
		writeMeta: func(string, *mmpb.Song) error {
			return errors.New("tag write failed") // 模拟元数据失败
		},
	}
	err := runDownload(k, 1, 1, dir, false, false, false, "", deps)
	if err != nil {
		t.Fatalf("元数据失败不应阻塞(exit 0),got err %v", err)
	}
	// stderr 应含 Warnf 警告。
	if got := stderr.String(); !strings.Contains(got, "元数据写入失败") {
		t.Errorf("应 Warnf 元数据失败警告到 stderr,got %q", got)
	}
	// stdout 结果应显示元数据未写入。
	if got := stdout.String(); !strings.Contains(got, "元数据   未写入") {
		t.Errorf("人类输出应显示元数据未写入,got %q", got)
	}
	// 文件仍保存。
	entries, _ := os.ReadDir(dir)
	if len(entries) == 0 {
		t.Error("元数据失败但文件应已保存")
	}
}

// TestRunDownload_UnwritableOut --out 不可写 → exit 1 带权限原因。
func TestRunDownload_UnwritableOut(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	// 构造只读父目录,MkdirAll 子目录会失败。
	readonlyDir := t.TempDir()
	if err := os.Chmod(readonlyDir, 0o500); err != nil {
		t.Skipf("无法设置只读目录(权限):%v", err)
	}
	t.Cleanup(func() { _ = os.Chmod(readonlyDir, 0o755) }) // 恢复以便清理

	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: 1}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 1, Name: "t"}, nil
		},
	}
	target := filepath.Join(readonlyDir, "subdir")
	err := runDownload(k, 1, 1, target, false, false, false, "", deps)
	if err == nil {
		t.Fatal("不可写目录应报错")
	}
	if !strings.Contains(err.Error(), "不可写") {
		t.Errorf("错误应含「不可写」,got %q", err.Error())
	}
}

// TestRunDownload_OutMkdir --out 不存在时自动 mkdir -p,文件落到新目录。
func TestRunDownload_OutMkdir(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	base := t.TempDir()
	nested := filepath.Join(base, "a", "b", "c") // 多层不存在

	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: 10}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 1, Name: "t"}, nil
		},
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			// 确认父目录已被 MkdirAll 创建。
			if _, err := os.Stat(filepath.Dir(path)); err != nil {
				return 0, err
			}
			return 0, os.WriteFile(path, []byte("x"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error { return nil },
	}
	if err := runDownload(k, 1, 1, nested, false, false, false, "", deps); err != nil {
		t.Fatalf("自动 mkdir 应成功,got %v", err)
	}
	// 嵌套目录应已创建。
	if info, err := os.Stat(nested); err != nil || !info.IsDir() {
		t.Errorf("嵌套目录 %s 应被 MkdirAll 创建", nested)
	}
}

// TestRunDownload_FLACFormat flac 格式:文件名扩展名 + 元数据走 flac 路径。
func TestRunDownload_FLACFormat(t *testing.T) {
	t.Parallel()
	k, stdout, _ := newTestKit()
	dir := t.TempDir()
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "flac", Size: 1000, Bitrate: 996000}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 1, Name: "flac歌", Artists: []*mmpb.Artist{{Name: "艺人"}}}, nil
		},
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			if !strings.HasSuffix(path, ".flac") {
				t.Errorf("flac 文件应以 .flac 结尾,got %s", path)
			}
			return 0, os.WriteFile(path, []byte("x"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error { return nil },
	}
	if err := runDownload(k, 1, 3, dir, false, false, false, "", deps); err != nil {
		t.Fatalf("flac 下载应成功,got %v", err)
	}
	// 人类输出应显示 flac 格式。
	if got := stdout.String(); !strings.Contains(got, "flac") {
		t.Errorf("输出应含 flac 格式,got %q", got)
	}
}

// ==================== --dry-run / --no-metadata(issue #24)====================

// TestRunDownload_DryRun --dry-run:打印目标路径/文件名/预估大小,不落盘,exit 0。
func TestRunDownload_DryRun(t *testing.T) {
	t.Parallel()
	k, stdout, _ := newTestKit()
	dir := t.TempDir()
	downloadCalled := false
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: 3400000, Bitrate: 320000}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 1, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}, nil
		},
		download: func(context.Context, string, int64, string, string) (int64, error) {
			downloadCalled = true
			return 0, nil
		},
		writeMeta: func(string, *mmpb.Song) error { return nil },
	}
	if err := runDownload(k, 1, 1, dir, false, true, false, "", deps); err != nil {
		t.Fatalf("dry-run 应 exit 0, got %v", err)
	}
	if downloadCalled {
		t.Error("dry-run 不应调 download")
	}
	out := stdout.String()
	for _, want := range []string{"将下载到", "周杰伦 - 晴天.mp3", "预估大小"} {
		if !strings.Contains(out, want) {
			t.Errorf("dry-run 输出应含 %q, got %q", want, out)
		}
	}
	// 目录应空(没落盘)。
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Errorf("dry-run 不应落盘, got %d files", len(entries))
	}
}

// TestRunDownload_NoMetadata --no-metadata:跳过 writeMeta,文件落盘但无元数据。
func TestRunDownload_NoMetadata(t *testing.T) {
	t.Parallel()
	k, stdout, _ := newTestKit()
	dir := t.TempDir()
	metaCalled := false
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: 100}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 1, Name: "t", Artists: []*mmpb.Artist{{Name: "a"}}}, nil
		},
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			return 4, os.WriteFile(path, []byte("data"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error {
			metaCalled = true
			return nil
		},
	}
	if err := runDownload(k, 1, 1, dir, false, false, true, "", deps); err != nil {
		t.Fatalf("no-metadata 应 exit 0, got %v", err)
	}
	if metaCalled {
		t.Error("--no-metadata 不应调 writeMeta")
	}
	// 文件落盘 + 元数据显示 ✗(未写)。
	entries, _ := os.ReadDir(dir)
	if len(entries) == 0 {
		t.Error("文件应已落盘")
	}
	if !strings.Contains(stdout.String(), "元数据   未写入") {
		t.Errorf("人类输出应显示元数据未写, got %q", stdout.String())
	}
}

// TestRunDownload_FilenameTemplate --filename 模板端到端:自定义文件名传到 download。
func TestRunDownload_FilenameTemplate(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	dir := t.TempDir()
	var gotPath string
	deps := downloadDeps{
		fetchURL: func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: 100}, nil
		},
		fetchDetail: func(context.Context, int64) (*mmpb.Song, error) {
			return &mmpb.Song{Id: 347230, Name: "晴天", Artists: []*mmpb.Artist{{Name: "周杰伦"}}}, nil
		},
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			gotPath = path
			return 4, os.WriteFile(path, []byte("data"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error { return nil },
	}
	// 自定义模板 {title} - {id}。
	if err := runDownload(k, 347230, 1, dir, false, false, false, "{title} - {id}", deps); err != nil {
		t.Fatalf("filename 模板应 exit 0, got %v", err)
	}
	want := filepath.Join(dir, "晴天 - 347230.mp3")
	if gotPath != want {
		t.Errorf("文件名应按模板, got %q, want %q", gotPath, want)
	}
}
