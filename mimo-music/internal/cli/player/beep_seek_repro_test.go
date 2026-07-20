//go:build !linux

// beep 后端连续内存 seek 的回归测试。
//
// PRD-0013 Testing Decisions 既定「beep 后端不做单元测试(音频硬件依赖)」——
// 针对的是音频输出/解码本身的硬件耦合。本文件测的是 **seek 状态机的数据完整性**
// (memFull 快照是否跨 seek 保留全量),与音频输出无关,但需要 beep Player 跑通
// Load/Play/Seek 真实链路才能暴露,所以仍归在 beep 测试里。headless/CI 用
// t.Skip 跳过(//go:build !linux 排除 Linux 容器)。
//
// 回归背景:mem-seek 把 p.buffer 替换为切片(sealed),其 Bytes() 只返回切片
// 而非原始全量。连续 seek 时每次 memSnapshot 都从切片取,累积丢失前缀,
// 最终切片耗尽 → openFromBytes 报 mp3: EOF。修复:beepPlayer.fullSnapshot
// 字段缓存首次全量快照,跨 seek 复用。
package player

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"
)

// skipIfNoAudio 跳过无音频设备的测试环境。
// 用 ensureSpeaker(sync.Once 幂等)而不是直接 speaker.Init——后者重复调用会
// 报 "cannot be initialized more than once",被误当成 headless 错误。
func skipIfNoAudio(t *testing.T) {
	t.Helper()
	if err := ensureSpeaker(); err != nil {
		t.Skipf("oto 不可用(headless?): %v", err)
	}
}

// serveMP3 起一个本地 HTTP server 喂 testdata 里的 mp3,返回 url + close。
// 全量一次写完(本地内存,无弱网),保证 buffer.Done 后走 mem-seek 路径。
func serveMP3(t *testing.T, name string) (url string, closeSrv func()) {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("读 %s: %v", name, err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/mpeg")
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		_, _ = w.Write(data)
	}))
	return srv.URL, srv.Close
}

// setupSeekPlayer 构造已起播的 beep player + 并发 Progress 压力 goroutine,
// 返回 player 和 cleanup(关 server + Close player + 停 loader)。
// 抽出来是因为每个连续 seek 回归用例的 setup 完全相同,只有 seek 序列不同。
func setupSeekPlayer(t *testing.T) (Player, func()) {
	t.Helper()
	skipIfNoAudio(t)
	url, closeSrv := serveMP3(t, "sine30.mp3")
	p := newTestBeep(url)
	if err := p.Load(url); err != nil {
		closeSrv()
		t.Fatalf("Load: %v", err)
	}
	if err := p.Play(); err != nil {
		closeSrv()
		_ = p.Close()
		t.Fatalf("Play: %v", err)
	}
	stop := startProgressLoaders(t, p, 1)
	return p, func() { stop(); _ = p.Close(); closeSrv() }
}

// startProgressLoaders 起 n 个 goroutine 高频调 Progress,返回 stop。
// 模拟 UI 状态栏 ticker 的并发压力(Progress 是 player 唯一允许并发调用的方法)。
func startProgressLoaders(t *testing.T, p Player, n int) (stop func()) {
	t.Helper()
	stopCh := make(chan struct{})
	var wg sync.WaitGroup
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stopCh:
					return
				default:
					_, _, _ = p.Progress()
				}
			}
		}()
	}
	return func() { close(stopCh); wg.Wait() }
}

// waitForPlaying 断言 player 在 timeout 内进入 StatePlaying;失败时打印诊断。
func waitForPlaying(t *testing.T, p Player, timeout time.Duration, what string) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if p.State() == StatePlaying {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	cur, total, st := p.Progress()
	t.Fatalf("%s: %v 内未恢复 Playing,state=%s progress=(%d/%d ms)",
		what, timeout, st, cur, total)
}

// newTestBeep 构造短水位的 beep player(加速测试)。
func newTestBeep(url string) Player {
	return NewBeep(func(ctx context.Context, method, u string) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, method, u, nil)
	}, WithWatermark(2000, 500))
}

// fmtSeek 给 waitForPlaying 失败消息生成上下文标签。
func fmtSeek(prefix string, i int, off int64) string {
	return prefix + " #" + strconv.Itoa(i) + " off=" + strconv.FormatInt(off, 10)
}

// ==================== 回归:连续 mem-seek 不丢前缀 ====================

// TestSeekSequence_Mixed 正负混合 seek 序列(原 bug 的最小触发序列)。
// 修复前:第 5 次 seek 报「内存重解码: mp3: EOF」。
func TestSeekSequence_Mixed(t *testing.T) {
	p, cleanup := setupSeekPlayer(t)
	defer cleanup()

	offs := []int64{1, 5, -3, 10, -5}
	for i, off := range offs {
		if err := p.Seek(off); err != nil {
			t.Fatalf("seek #%d off=%d: %v", i, off, err)
		}
		waitForPlaying(t, p, 2*time.Second, fmtSeek("seek", i, off))
	}
}

// TestSeekSequence_ManyForward 单调递增 seek,直接验证 fullSnapshot 保留全量:
// 修复前第 5 次左右 EOF,修复后可一直 seek 到接近末尾。
func TestSeekSequence_ManyForward(t *testing.T) {
	p, cleanup := setupSeekPlayer(t)
	defer cleanup()

	// 每次 +2s,共 12 次 → 累计 24s,接近 sine30 末尾(留余量避免 eos 干扰)。
	for i := 0; i < 12; i++ {
		if err := p.Seek(2); err != nil {
			t.Fatalf("seek #%d: %v(根因:mem-seek 切片累积丢前缀)", i, err)
		}
	}
}

// ==================== 回归:seek 不丢总时长 ====================

// TestSeek_TotalPreserved 回归:seek 重建后 Progress 总时长保持不变。
// 修复前:Seek 的 teardownLocked 把 p.totalMs 清零,applyStreamLocked 不恢复
// (computeMetaLocked 仅 Load 时跑),seek 后 Progress 总时长归零——
// 状态栏总时长显示 00:00、进度条全空、0-9 数字跳百分比失效。
func TestSeek_TotalPreserved(t *testing.T) {
	p, cleanup := setupSeekPlayer(t)
	defer cleanup()

	waitForPlaying(t, p, 2*time.Second, "起播")
	_, total0, _ := p.Progress()
	if total0 <= 0 {
		t.Fatalf("起播后总时长应为正, got %d", total0)
	}

	if err := p.Seek(5); err != nil {
		t.Fatalf("seek: %v", err)
	}
	waitForPlaying(t, p, 2*time.Second, "seek +5s")

	_, total1, _ := p.Progress()
	if total1 != total0 {
		t.Errorf("seek 后总时长丢失: 起播 %d ms, seek 后 %d ms", total0, total1)
	}
}
