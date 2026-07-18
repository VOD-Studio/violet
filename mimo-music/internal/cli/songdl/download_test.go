package songdl

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// ==================== proxyReader(从 song/download_test.go 迁入)====================

type fakeNow struct{ t time.Time }

func (f *fakeNow) now() time.Time { return f.t }

// TestProxyReader_IncrsBar proxyReader 读取 N 字节后 Bar.Current 增加 N。
func TestProxyReader_IncrsBar(t *testing.T) {
	t.Parallel()
	p := kit.NewProgress(io.Discard, 80, false)
	bar := p.AddBar(1000, "test")
	clock := &fakeNow{t: time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)}
	pr := &proxyReader{r: bytes.NewReader([]byte("hello world")), bar: bar, now: clock.now}
	buf := make([]byte, 4)
	if n, err := pr.Read(buf); err != nil || n != 4 {
		t.Fatalf("首次 Read got %d bytes, err %v", n, err)
	}
	io.Copy(io.Discard, pr)
	require.Equal(t, int64(11), bar.Current, "读完 11 字节后 bar.Current 应为 11")
}

// ==================== DownloadOne(新增)====================

// fakeSongURL 构造测试用 SongURL。
func fakeSongURL(format string, size int64) *mmpb.SongURL {
	return &mmpb.SongURL{
		Url:     "http://cdn.example.com/test." + format,
		Format:  format,
		Size:    size,
		Bitrate: 320000,
	}
}

// fakeSong 构造测试用 Song。
func fakeSong(id int64, name, artist string) *mmpb.Song {
	return &mmpb.Song{
		Id:      id,
		Name:    name,
		Artists: []*mmpb.Artist{{Name: artist}},
	}
}

// TestDownloadOne_Success 正常下载:文件落盘 + 元数据写入 + Outcome 字段齐全。
func TestDownloadOne_Success(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	song := fakeSong(1, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)

	var downloadCalled bool
	deps := Deps{
		download: func(ctx context.Context, u string, total int64, path, label string) (int64, error) {
			downloadCalled = true
			require.Equal(t, url.Url, u)
			require.Equal(t, int64(100), total)
			require.Contains(t, path, "周杰伦 - 晴天.mp3")
			require.Equal(t, "周杰伦 - 晴天.mp3", label)
			// 模拟下载:写文件供 writeMeta 读。
			if err := os.WriteFile(path, []byte("fake-mp3"), 0o644); err != nil {
				return 0, err
			}
			return 8, nil
		},
		writeMeta: func(path string, s *mmpb.Song) error {
			require.Equal(t, song, s)
			return nil
		},
	}

	outcome := DownloadOne(context.Background(), song, url, dir, false, deps)
	require.Equal(t, StatusSuccess, outcome.Status)
	require.True(t, downloadCalled, "download 应被调用")
	require.Equal(t, int64(8), outcome.Bytes)
	require.Equal(t, "mp3", outcome.Format)
	require.True(t, outcome.MetaWritten)
	require.Equal(t, "周杰伦 - 晴天.mp3", outcome.Filename)
	require.Contains(t, outcome.Path, "周杰伦 - 晴天.mp3")

	// 文件实际落盘。
	_, err := os.Stat(outcome.Path)
	require.NoError(t, err)
}

// TestDownloadOne_SkippedConflict 默认名已存在且非 force → StatusSkipped,不调 download。
func TestDownloadOne_SkippedConflict(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	song := fakeSong(1, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)
	// 预置默认名 + 回退名 → ResolveConflictPath 返回 skipped。
	require.NoError(t, os.WriteFile(filepath.Join(dir, "周杰伦 - 晴天.mp3"), []byte("x"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "周杰伦 - 晴天 (1).mp3"), []byte("x"), 0o644))

	deps := Deps{
		download: func(context.Context, string, int64, string, string) (int64, error) {
			t.Fatal("skip 时不应调 download")
			return 0, nil
		},
	}

	outcome := DownloadOne(context.Background(), song, url, dir, false, deps)
	require.Equal(t, StatusSkipped, outcome.Status)
	require.Contains(t, outcome.Reason, "已存在")
}

// TestDownloadOne_ConflictFallback 默认名冲突但回退名空 → 用回退名成功下载。
func TestDownloadOne_ConflictFallback(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	song := fakeSong(347230, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)
	// 预置默认名(回退名不存在)。
	require.NoError(t, os.WriteFile(filepath.Join(dir, "周杰伦 - 晴天.mp3"), []byte("x"), 0o644))

	deps := Deps{
		download: func(ctx context.Context, u string, total int64, path, label string) (int64, error) {
			require.Contains(t, path, "周杰伦 - 晴天 (347230).mp3", "应用回退名")
			return 0, os.WriteFile(path, []byte("x"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error { return nil },
	}

	outcome := DownloadOne(context.Background(), song, url, dir, false, deps)
	require.Equal(t, StatusSuccess, outcome.Status)
	require.Contains(t, outcome.Filename, "(347230)")
}

// TestDownloadOne_MetaFailureNonBlocking 元数据失败 → Outcome 仍 Success,
// MetaWritten=false(命令层据此时 Warnf,不阻塞)。
func TestDownloadOne_MetaFailureNonBlocking(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	song := fakeSong(1, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)

	deps := Deps{
		download: func(ctx context.Context, u string, total int64, path, label string) (int64, error) {
			return 8, os.WriteFile(path, []byte("x"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error {
			return errors.New("tag write failed")
		},
	}

	outcome := DownloadOne(context.Background(), song, url, dir, false, deps)
	require.Equal(t, StatusSuccess, outcome.Status, "元数据失败不阻塞,仍 Success")
	require.False(t, outcome.MetaWritten, "MetaWritten 应为 false")
}

// TestDownloadOne_DownloadError 下载失败 → StatusFailed + Reason。
func TestDownloadOne_DownloadError(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	song := fakeSong(1, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)

	deps := Deps{
		download: func(context.Context, string, int64, string, string) (int64, error) {
			return 0, errors.New("网络中断")
		},
	}

	outcome := DownloadOne(context.Background(), song, url, dir, false, deps)
	require.Equal(t, StatusFailed, outcome.Status)
	require.Contains(t, outcome.Reason, "网络中断")
}

// TestDownloadOne_MkdirFailure --out 不可写 → StatusFailed。
func TestDownloadOne_MkdirFailure(t *testing.T) {
	t.Parallel()
	readonlyDir := t.TempDir()
	require.NoError(t, os.Chmod(readonlyDir, 0o500))
	t.Cleanup(func() { _ = os.Chmod(readonlyDir, 0o755) })

	song := fakeSong(1, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)
	target := filepath.Join(readonlyDir, "subdir")

	deps := Deps{
		download: func(context.Context, string, int64, string, string) (int64, error) {
			t.Fatal("mkdir 失败不应调 download")
			return 0, nil
		},
	}

	outcome := DownloadOne(context.Background(), song, url, target, false, deps)
	require.Equal(t, StatusFailed, outcome.Status)
	require.Contains(t, outcome.Reason, "不可写")
}

// TestDownloadOne_Force 覆盖已存在:force=true → StatusSuccess(用默认名,不回退不跳)。
func TestDownloadOne_Force(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	song := fakeSong(1, "晴天", "周杰伦")
	url := fakeSongURL("mp3", 100)
	require.NoError(t, os.WriteFile(filepath.Join(dir, "周杰伦 - 晴天.mp3"), []byte("old"), 0o644))

	deps := Deps{
		download: func(ctx context.Context, u string, total int64, path, label string) (int64, error) {
			require.Contains(t, path, "周杰伦 - 晴天.mp3", "force 用默认名覆盖")
			return 8, os.WriteFile(path, []byte("new"), 0o644)
		},
		writeMeta: func(string, *mmpb.Song) error { return nil },
	}

	outcome := DownloadOne(context.Background(), song, url, dir, true, deps)
	require.Equal(t, StatusSuccess, outcome.Status)
	require.Equal(t, "周杰伦 - 晴天.mp3", outcome.Filename)
}
