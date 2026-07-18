package playlist

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/songdl"
)

// ==================== 辅助 ====================

// newTestKit 构造测试 Kit:Out/Err 捕获到 buffer,Yes 控制跳过确认闸门。
// 与 song 包的 newTestKit 等价(各自独立,避免跨包共享未导出 helper)。
func newTestKit() (*kit.Kit, *bytes.Buffer, *bytes.Buffer) {
	var out, errb bytes.Buffer
	k := &kit.Kit{Out: &out, Err: &errb, Yes: true} // Yes=true 跳过确认闸门(测试默认)
	return k, &out, &errb
}

// fakeSongs 构造 n 个测试 Song(id 1..n)。
func fakeSongs(n int) []*mmpb.Song {
	out := make([]*mmpb.Song, n)
	for i := range n {
		out[i] = &mmpb.Song{Id: int64(i + 1), Name: "song", Artists: []*mmpb.Artist{{Name: "artist"}}}
	}
	return out
}

// noopProgressDeps 返回一个进度条往 io.Discard 输出的 deps,TTY=false 自动抑制。
func noopProgressDeps() func() *kit.Progress {
	return func() *kit.Progress { return kit.NewProgress(io.Discard, 80, false) }
}

// ==================== 纯函数 ====================

func TestClampWorkers(t *testing.T) {
	t.Parallel()
	cases := []struct{ in, want int }{
		{0, 1}, {1, 1}, {3, 3}, {5, 5}, {6, 5}, {-1, 1}, {100, 5},
	}
	for _, tc := range cases {
		if got := clampWorkers(tc.in); got != tc.want {
			t.Errorf("clampWorkers(%d) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

// TestNewPlaylistDownload_PositionalArgs 位置参数与 --id 的 ResolveID 行为(issue #24)。
// 命令层测:冲突 → ErrUsage;缺 id → ErrUsage;2+ 位置参数 → cobra 拒绝。
func TestNewPlaylistDownload_PositionalArgs(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		args    []string
		wantErr string // 错误消息子串(空 = 不验证消息,只验证报错)
	}{
		{"冲突_id_和位置参数", []string{"--id", "12345", "999"}, "不能同时指定"},
		{"缺_id_无位置参数", nil, "缺少 id"},
		{"两个位置参数被拒", []string{"1", "2"}, "at most 1 arg"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			k := kit.New()
			cmd := newDownload(k)
			cmd.SetOut(io.Discard)
			cmd.SetErr(io.Discard)
			if tc.args != nil {
				cmd.SetArgs(tc.args)
			}
			err := cmd.Execute()
			if err == nil {
				t.Fatalf("应报错")
			}
			if tc.wantErr != "" && !strings.Contains(err.Error(), tc.wantErr) {
				t.Errorf("错误应含 %q, got %q", tc.wantErr, err.Error())
			}
		})
	}
}

func TestSummarize(t *testing.T) {
	t.Parallel()
	outcomes := []songdl.Outcome{
		{Status: songdl.StatusSuccess, SongID: 1},
		{Status: songdl.StatusSuccess, SongID: 2},
		{Status: songdl.StatusSkipped, SongID: 3},
		{Status: songdl.StatusFailed, SongID: 4, Reason: "无可用音源"},
		{Status: songdl.StatusFailed, SongID: 5, Reason: "网络中断"},
	}
	s := summarize("我的歌单", 5, outcomes)
	if s.Total != 5 || s.Success != 2 || s.Skipped != 1 || len(s.Failed) != 2 {
		t.Errorf("summarize 计数错: %+v", s)
	}
	if s.Failed[0].ID != 4 || s.Failed[0].Reason != "无可用音源" {
		t.Errorf("failed[0] = %+v", s.Failed[0])
	}
}

// ==================== 渲染 ====================

func TestRenderPlaylistSummary_JSON(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	k.JSON = true
	outcomes := []songdl.Outcome{
		{Status: songdl.StatusSuccess, SongID: 1},
		{Status: songdl.StatusSkipped, SongID: 2},
		{Status: songdl.StatusFailed, SongID: 3, Reason: "无音源"},
	}
	if err := renderPlaylistSummary(k, "test", 3, outcomes); err != nil {
		t.Fatalf("render: %v", err)
	}

	// 解析 JSON 验证 schema。
	var got map[string]any
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatalf("输出非合法 JSON: %v\n%s", err, out.String())
	}
	if got["total"].(float64) != 3 || got["success"].(float64) != 1 || got["skipped"].(float64) != 1 {
		t.Errorf("计数字段错: %v", got)
	}
	failed, ok := got["failed"].([]any)
	if !ok || len(failed) != 1 {
		t.Fatalf("failed 应是长度 1 的数组, got %T %v", got["failed"], got["failed"])
	}
	entry := failed[0].(map[string]any)
	if entry["id"].(float64) != 3 || entry["reason"] != "无音源" {
		t.Errorf("failed[0] = %v", entry)
	}
}

func TestRenderPlaylistSummary_JSONEmptyFailed(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	k.JSON = true
	// 全成功:failed 应是 [] 而非 null。
	outcomes := []songdl.Outcome{{Status: songdl.StatusSuccess, SongID: 1}}
	if err := renderPlaylistSummary(k, "test", 1, outcomes); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), `"failed": []`) {
		t.Errorf("空 failed 应输出 [], got %s", out.String())
	}
}

func TestRenderPlaylistSummary_HumanFailedListToStderr(t *testing.T) {
	t.Parallel()
	k, out, errb := newTestKit()
	outcomes := []songdl.Outcome{
		{Status: songdl.StatusSuccess, SongID: 1},
		{Status: songdl.StatusFailed, SongID: 2, Reason: "VIP"},
	}
	if err := renderPlaylistSummary(k, "test", 2, outcomes); err != nil {
		t.Fatal(err)
	}
	stdoutText := out.String()
	stderrText := errb.String()
	// 计数在 stdout。
	for _, want := range []string{"成功", "失败", "跳过"} {
		if !strings.Contains(stdoutText, want) {
			t.Errorf("stdout 应含 %q, got %s", want, stdoutText)
		}
	}
	// 失败详情在 stderr(不被 jq 污染)。
	if !strings.Contains(stderrText, "2  VIP") {
		t.Errorf("stderr 应含失败详情, got %q", stderrText)
	}
	if strings.Contains(stdoutText, "VIP") {
		t.Errorf("stdout 不应含失败详情(会污染 jq), got %q", stdoutText)
	}
}

// ==================== runPlaylistDownload 端到端(注入 deps)====================

// makeDeps 构造可控的 playlistDeps:fetchTracks 返回固定 songs,
// fetchURL/downloadOne 由调用方决定。sleepJitter/now noop 加速。
func makeDeps(songs []*mmpb.Song, fetchURL func(context.Context, int64, int) (*mmpb.SongURL, error), downloadOne func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome) playlistDeps {
	return playlistDeps{
		fetchTracks: func(context.Context, int64) (*mmpb.AllTracksResponse, error) {
			return &mmpb.AllTracksResponse{Songs: songs, Total: int32(len(songs))}, nil
		},
		fetchURL:    fetchURL,
		downloadOne: downloadOne,
		newProgress: noopProgressDeps(),
		sleepJitter: func() {},
		now:         func() time.Time { return time.Unix(0, 0) },
	}
}

func TestRunPlaylistDownload_EmptyPlaylist(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	deps := makeDeps(nil, nil, nil)
	if err := runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, false, false, deps); err != nil {
		t.Fatalf("空歌单应 exit 0, got %v", err)
	}
	if !strings.Contains(out.String(), "无可下载曲目") {
		t.Errorf("应提示无可下载曲目, got %s", out.String())
	}
}

func TestRunPlaylistDownload_AllSuccess(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	songs := fakeSongs(5)
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3"}, nil
		},
		func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome {
			return songdl.Outcome{Status: songdl.StatusSuccess}
		},
	)
	if err := runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, false, false, deps); err != nil {
		t.Fatalf("全成功应 exit 0, got %v", err)
	}
	if !strings.Contains(out.String(), "成功     5") {
		t.Errorf("应 5 成功, got %s", out.String())
	}
}

func TestRunPlaylistDownload_PartialFailureContinues(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	songs := fakeSongs(5)
	// id 3 模拟失败(无音源),其余成功。单曲失败不中断批量。
	deps := makeDeps(songs,
		func(_ context.Context, id int64, _ int) (*mmpb.SongURL, error) {
			if id == 3 {
				return &mmpb.SongURL{Url: ""}, nil // 空 URL = 无音源
			}
			return &mmpb.SongURL{Url: "http://x"}, nil
		},
		func(_ context.Context, song *mmpb.Song, _ *mmpb.SongURL, _ songdl.Options) songdl.Outcome {
			return songdl.Outcome{Status: songdl.StatusSuccess, SongID: song.Id}
		},
	)
	if err := runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, false, false, deps); err != nil {
		t.Fatalf("部分失败应仍 exit 0, got %v", err)
	}
	if !strings.Contains(out.String(), "成功     4") {
		t.Errorf("应 4 成功, got %s", out.String())
	}
	if !strings.Contains(out.String(), "失败     1") {
		t.Errorf("应 1 失败, got %s", out.String())
	}
}

// TestRunPlaylistDownload_WorkerConcurrency 并发上限验证:--workers=N 时,
// 同时 in-flight 的 processOne 不超过 N。用 atomic counter 记录峰值。
func TestRunPlaylistDownload_WorkerConcurrency(t *testing.T) {
	t.Parallel()
	cases := []int{1, 3, 5}
	for _, w := range cases {
		t.Run("workers_"+itoa(w), func(t *testing.T) {
			k, _, _ := newTestKit()
			songs := fakeSongs(20) // 多于 workers,确保排队
			var inFlight, peak atomic.Int32

			deps := makeDeps(songs,
				func(context.Context, int64, int) (*mmpb.SongURL, error) {
					return &mmpb.SongURL{Url: "http://x"}, nil
				},
				func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome {
					cur := inFlight.Add(1)
					for {
						p := peak.Load()
						if cur <= p || peak.CompareAndSwap(p, cur) {
							break
						}
					}
					time.Sleep(5 * time.Millisecond) // 拉长执行让并发可观测
					inFlight.Add(-1)
					return songdl.Outcome{Status: songdl.StatusSuccess}
				},
			)
			if err := runPlaylistDownload(k, 1, 1, t.TempDir(), w, false, false, false, deps); err != nil {
				t.Fatalf("err: %v", err)
			}
			// 允许等于 workers(临界),但绝不超过。
			if got := peak.Load(); got > int32(w) {
				t.Errorf("workers=%d: 并发峰值 %d 超过上限", w, got)
			}
			if got := peak.Load(); got < 1 {
				t.Errorf("workers=%d: 应有并发, peak=%d", w, got)
			}
		})
	}
}

// TestRunPlaylistDownload_ConfirmGateRejected 非 TTY 无 --yes → ErrUsage(exit 2)。
func TestRunPlaylistDownload_ConfirmGateRejected(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	k.Yes = false // 模拟非 TTY 无 --yes(ConfirmWrite 检查 stdinIsTTY,测试环境 stdin 非 TTY)
	songs := fakeSongs(3)
	deps := makeDeps(songs, nil, nil)
	err := runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, false, false, deps)
	if !errors.Is(err, kit.ErrUsage) {
		t.Fatalf("非 TTY 无 --yes 应 ErrUsage, got %v", err)
	}
}

// TestRunPlaylistDownload_ThrottleDegrades 风控降并发:连续 3 次网络失败 → degraded。
// 注意:只有网络/fetch 失败(Network=true)才计风控;VIP 无音源(逻辑跳过)不计。
// 这里用 fetchURL 返 error 模拟网络失败。
func TestRunPlaylistDownload_ThrottleDegrades(t *testing.T) {
	t.Parallel()
	k, _, errb := newTestKit()
	songs := fakeSongs(6)
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return nil, errors.New("connection reset") // 网络失败
		},
		func(_ context.Context, song *mmpb.Song, _ *mmpb.SongURL, _ songdl.Options) songdl.Outcome {
			return songdl.Outcome{Status: songdl.StatusSuccess, SongID: song.Id} // 不会被调到
		},
	)
	_ = runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, false, false, deps)
	// 连续 3 网络失败 → 降并发提示;再 2 失败 → 停止 + 限流提示。
	if !strings.Contains(errb.String(), "降并发到 1") {
		t.Errorf("应触发降并发提示, got %q", errb.String())
	}
	if !strings.Contains(errb.String(), "疑似被限流") {
		t.Errorf("应触发限流停止提示, got %q", errb.String())
	}
}

// TestRunPlaylistDownload_VIPNoSourceDoesNotThrottle VIP 无音源不触发风控:
// 即使全部失败(空 URL),也不降并发/不限流(Network=false)。
func TestRunPlaylistDownload_VIPNoSourceDoesNotThrottle(t *testing.T) {
	t.Parallel()
	k, _, errb := newTestKit()
	songs := fakeSongs(6)
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: ""}, nil // VIP 无音源(非网络失败)
		},
		func(_ context.Context, song *mmpb.Song, _ *mmpb.SongURL, _ songdl.Options) songdl.Outcome {
			return songdl.Outcome{Status: songdl.StatusSuccess}
		},
	)
	_ = runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, false, false, deps)
	if strings.Contains(errb.String(), "降并发") {
		t.Errorf("VIP 无音源不应触发风控, got %q", errb.String())
	}
	if strings.Contains(errb.String(), "限流") {
		t.Errorf("VIP 无音源不应触发限流, got %q", errb.String())
	}
}

// ==================== 辅助(测试用)====================

// itoa 简单整数→字符串(避免引入 strconv 仅此一处)。
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// TestRunPlaylistDownload_SizeMatchSkips 文件已存在 + size 匹配 → 跳过(不调 downloadOne)。
func TestRunPlaylistDownload_SizeMatchSkips(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	dir := t.TempDir()
	songs := fakeSongs(1)
	// 预置文件:size 与 fetchURL 返回的 Size 一致。
	const size = int64(1000)
	path := filepath.Join(dir, songdl.SongFilename(songs[0], "mp3"))
	require := func(err error) { t.Helper(); if err != nil { t.Fatal(err) } }
	require(os.WriteFile(path, make([]byte, size), 0o644))

	downloadCalled := false
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: size}, nil
		},
		func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome {
			downloadCalled = true
			return songdl.Outcome{Status: songdl.StatusSuccess}
		},
	)
	_ = runPlaylistDownload(k, 1, 1, dir, 1, false, false, false, deps)
	if downloadCalled {
		t.Error("size 匹配时应跳过,不应调 downloadOne")
	}
	if !strings.Contains(out.String(), "跳过     1") {
		t.Errorf("应记 1 跳过, got %s", out.String())
	}
}

// TestRunPlaylistDownload_SizeMismatchSkipsWithWarn size 不符 → 跳过 + stderr 警告。
func TestRunPlaylistDownload_SizeMismatchSkipsWithWarn(t *testing.T) {
	t.Parallel()
	k, _, errb := newTestKit()
	dir := t.TempDir()
	songs := fakeSongs(1)
	const remoteSize = int64(5000)
	path := filepath.Join(dir, songdl.SongFilename(songs[0], "mp3"))
	require := func(err error) { t.Helper(); if err != nil { t.Fatal(err) } }
	// 本地 100 字节,远端 5000 → 不符。
	require(os.WriteFile(path, make([]byte, 100), 0o644))

	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: remoteSize}, nil
		},
		func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome {
			t.Fatal("size 不符时应跳过,不应调 downloadOne")
			return songdl.Outcome{}
		},
	)
	_ = runPlaylistDownload(k, 1, 1, dir, 1, false, false, false, deps)
	if !strings.Contains(errb.String(), "大小不符") {
		t.Errorf("应警告大小不符, got %q", errb.String())
	}
}

// TestRunPlaylistDownload_ForceOverridesSize force=true 时跳过 size 预检,正常下载。
func TestRunPlaylistDownload_ForceOverridesSize(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	dir := t.TempDir()
	songs := fakeSongs(1)
	const size = int64(1000)
	path := filepath.Join(dir, songdl.SongFilename(songs[0], "mp3"))
	require := func(err error) { t.Helper(); if err != nil { t.Fatal(err) } }
	require(os.WriteFile(path, make([]byte, size), 0o644))

	downloadCalled := false
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x", Format: "mp3", Size: size}, nil
		},
		func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome {
			downloadCalled = true
			return songdl.Outcome{Status: songdl.StatusSuccess}
		},
	)
	_ = runPlaylistDownload(k, 1, 1, dir, 1, true, false, false, deps) // force=true
	if !downloadCalled {
		t.Error("force=true 应跳过 size 预检正常下载")
	}
	if !strings.Contains(out.String(), "成功     1") {
		t.Errorf("应记 1 成功, got %s", out.String())
	}
}

// TestEstimateTotalBytes 预估总量按 level 码率 × 时长算。
func TestEstimateTotalBytes(t *testing.T) {
	t.Parallel()
	// 2 首,各 1 分钟(60000ms),level 1(320kbps = 40000 B/s)。
	// 预估 = 2 × 60 × 40000 = 4_800_000 字节。
	songs := []*mmpb.Song{
		{Id: 1, DurationMs: 60000},
		{Id: 2, DurationMs: 60000},
	}
	if got := estimateTotalBytes(songs, 1); got != 4_800_000 {
		t.Errorf("level 1 预估 = %d, want 4800000", got)
	}
}

// ==================== --dry-run / --no-metadata(issue #24)====================

// TestRunPlaylistDownload_DryRun --dry-run:打印歌单名+曲目数+预估总量,不落盘,不调 worker。
func TestRunPlaylistDownload_DryRun(t *testing.T) {
	t.Parallel()
	k, out, _ := newTestKit()
	songs := fakeSongs(5)
	// 给每首设时长,让预估非 0。
	for _, s := range songs {
		s.DurationMs = 240000
	}
	workerCalled := false
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			workerCalled = true
			return &mmpb.SongURL{Url: "http://x"}, nil
		},
		func(context.Context, *mmpb.Song, *mmpb.SongURL, songdl.Options) songdl.Outcome {
			workerCalled = true
			return songdl.Outcome{Status: songdl.StatusSuccess}
		},
	)
	if err := runPlaylistDownload(k, 1, 1, t.TempDir(), 3, false, true, false, deps); err != nil {
		t.Fatalf("dry-run 应 exit 0, got %v", err)
	}
	if workerCalled {
		t.Error("dry-run 不应调 worker(fetchURL/downloadOne)")
	}
	text := out.String()
	for _, want := range []string{"共 5 首", "预估总量"} {
		if !strings.Contains(text, want) {
			t.Errorf("dry-run 输出应含 %q, got %q", want, text)
		}
	}
}

// TestRunPlaylistDownload_NoMetadata --no-metadata:downloadOne 收到 SkipMeta=true。
// 用 atomic 计数(而非 slice append)避免 worker 并发写竞态。
func TestRunPlaylistDownload_NoMetadata(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	songs := fakeSongs(2)
	var skipMetaCount atomic.Int32
	deps := makeDeps(songs,
		func(context.Context, int64, int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{Url: "http://x"}, nil
		},
		func(_ context.Context, _ *mmpb.Song, _ *mmpb.SongURL, opts songdl.Options) songdl.Outcome {
			if opts.SkipMeta {
				skipMetaCount.Add(1)
			}
			return songdl.Outcome{Status: songdl.StatusSuccess}
		},
	)
	if err := runPlaylistDownload(k, 1, 1, t.TempDir(), 2, false, false, true, deps); err != nil {
		t.Fatalf("no-metadata 应 exit 0, got %v", err)
	}
	if got := skipMetaCount.Load(); got != 2 {
		t.Errorf("应 2 首 SkipMeta=true, got %d", got)
	}
}
