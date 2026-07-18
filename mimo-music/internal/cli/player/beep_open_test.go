// openFromBytes 的单元测试(纯 CPU 解码路径,不碰音频硬件)。
//
// 回归背景:mem-seek 曾对 mp3 全量快照走 ReadSeeker 精确 seek——
// go-mp3 的 NewDecoder 对 Seeker 源会全文件扫帧建索引(ensureFrameStartsAndLength),
// 5MB 快照扫描数秒,冻结 UI 主 goroutine(状态栏停转、按键无响应)。
// 修复:mp3 隐藏 Seeker 跳过扫帧,用估算字节落点切片代替解码器精确 seek。
package player

import (
	"os"
	"testing"
	"time"
)

// TestOpenFromBytes_MP3HideSeekerSkipsFrameScan 隐藏 Seeker 时 go-mp3 不建帧索引:
// Len() 未知(-1)是扫帧被跳过的可观测证据;且解码须足够快(无全文件扫描)。
func TestOpenFromBytes_MP3HideSeekerSkipsFrameScan(t *testing.T) {
	t.Parallel()
	data, err := os.ReadFile("testdata/sine.mp3")
	if err != nil {
		t.Fatalf("读测试音频: %v", err)
	}

	start := time.Now()
	st, err := openFromBytes(data, "mp3", false)
	if err != nil {
		t.Fatalf("非 Seeker 重解码失败: %v", err)
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("非 Seeker 解码耗时 %v,疑似退化为全文件扫帧", elapsed)
	}
	if st.streamer.Len() > 0 {
		t.Errorf("隐藏 Seeker 时不应建帧索引(Len 应为 -1),got %d", st.streamer.Len())
	}

	// 对照组:Seeker 可见时 go-mp3 建帧索引,Len 可知(flac 精确 seek 依赖此能力)。
	st2, err := openFromBytes(data, "mp3", true)
	if err != nil {
		t.Fatalf("Seeker 重解码失败: %v", err)
	}
	if st2.streamer.Len() <= 0 {
		t.Errorf("Seeker 可见时应建帧索引(Len > 0),got %d", st2.streamer.Len())
	}
}

// TestOpenFromBytes_MP3SliceFromOffset mem-seek 的核心操作:
// 从快照中间任意字节切片重解码(mp3 帧同步容忍估算落点)必须成功。
func TestOpenFromBytes_MP3SliceFromOffset(t *testing.T) {
	t.Parallel()
	data, err := os.ReadFile("testdata/sine.mp3")
	if err != nil {
		t.Fatalf("读测试音频: %v", err)
	}
	// 模拟估算落点:128kbps ≈ 16B/ms,seek 到 1s → 偏移 ~16000(任意字节对齐)。
	st, err := openFromBytes(data[16000:], "mp3", false)
	if err != nil {
		t.Fatalf("偏移切片重解码失败: %v", err)
	}
	if st.sampleRate <= 0 {
		t.Errorf("切片解码应识别采样率,got %d", st.sampleRate)
	}
}

// TestOpenFromBytes_SealedBufferWaterReached 内存路径的 buffer 是 sealed:
// Done 恒真,waterReached 立即成立(monitor 无需等待即可起播)。
func TestOpenFromBytes_SealedBufferWaterReached(t *testing.T) {
	t.Parallel()
	data, err := os.ReadFile("testdata/sine.mp3")
	if err != nil {
		t.Fatalf("读测试音频: %v", err)
	}
	st, err := openFromBytes(data, "mp3", false)
	if err != nil {
		t.Fatalf("重解码失败: %v", err)
	}
	if !st.buffer.Done() {
		t.Error("sealed buffer 应 Done 恒真")
	}
}
