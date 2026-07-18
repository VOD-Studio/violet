package player

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gopxl/beep/v2"
	"github.com/gopxl/beep/v2/effects"
	"github.com/gopxl/beep/v2/flac"
	"github.com/gopxl/beep/v2/mp3"
	"github.com/gopxl/beep/v2/speaker"
)

// beep 后端设计要点:
//   - 流式不落盘:HTTP 响应体喂 prefetchBuffer,解码器从 buffer 读;
//     fill goroutine 以网络速度搬运,与消费速度解耦。
//   - 水位抗弱网:起播/续播前缓冲到 watermark;播放中低于 lowWater
//     自动暂停续缓冲,水位回升自动恢复。
//   - seek:纯流不可原地 seek——flac 全量在内存则 ReadSeeker 精确 seek;
//     mp3 全量在内存按码率估算字节落点切片重解码(对解码器隐藏 Seeker,
//     避开 go-mp3 的全文件扫帧建索引);否则 mp3 走「HTTP Range 重建 + 帧同步
//     重解码」,flac 走「重新拉全量 + 丢弃解码到目标」(flac 帧流无自同步头,
//     Range 不可行)。
//   - speaker.Init 全进程只能一次(beep 限制),输出采样率固定 44.1k,
//     异采样率音源经 beep.Resample 对齐。

const (
	outRate            = 44100 // speaker 输出采样率(全进程固定)
	speakerBuf         = outRate / 10
	mp3PeekSize        = 64 * 1024 // mp3 码率探测窗口上限
	mp3PeekFloor       = 4 * 1024  // 探测前至少等到的字节数
	defaultBitrateKbps = 320       // 探测失败时的兜底码率(网易 level=1)
	defaultWatermarkMs = 5000      // 起播水位(PRD:缓冲到 ~5s 才起播)
	defaultLowWaterMs  = 800       // 播放中低水位,低于则暂停续缓冲
	monitorEvery       = 200 * time.Millisecond
)

// RequestBuilder 构造音频流 HTTP 请求。生产实现是 PF-1 的
// engine.NewNeteaseRequest(netease 伪装头),测试可注入任意构造器。
type RequestBuilder func(ctx context.Context, method, url string) (*http.Request, error)

// BeepOption 调整 beepPlayer。
type BeepOption func(*beepPlayer)

// WithVolume 设置初始音量 0-100(对应 song play --volume)。
func WithVolume(percent int) BeepOption {
	return func(p *beepPlayer) { p.vol = clampInt(percent, 0, 100) }
}

// WithWatermark 覆盖起播/低水位(毫秒)。
func WithWatermark(highMs, lowMs int64) BeepOption {
	return func(p *beepPlayer) { p.watermarkMs, p.lowWaterMs = highMs, lowMs }
}

// WithHTTPClient 覆盖 HTTP client(如自定义超时)。
func WithHTTPClient(c *http.Client) BeepOption {
	return func(p *beepPlayer) { p.client = c }
}

type beepPlayer struct {
	newReq      RequestBuilder
	client      *http.Client
	watermarkMs int64
	lowWaterMs  int64
	vol         int

	mu            sync.Mutex
	state         State
	started       bool // 已交给 speaker(区分起播与续播/暂停恢复)
	playRequested bool // Play 已下达起播意图(水位未达标前保持 Buffering)
	monitored     bool // 当前代 monitor 已在跑
	gen           int  // 每路流一代,Load/Seek 重建时递增
	genDone       chan struct{}

	url            string
	format         string // "mp3" | "flac"
	cancel         context.CancelFunc
	buffer         *prefetchBuffer
	fullSnapshot   []byte // 全量已下载快照(首次 buffer.Done 时落盘,跨 seek 复用;Bytes() 切片会丢前缀)
	streamer       beep.StreamSeekCloser
	ctrl           *beep.Ctrl
	volume         *effects.Volume
	tracker        *posTracker
	id3Size        int64
	bytesPerMs     float64 // 码率换算(flac 为精确值);水位/seek 共用
	totalMs        int64   // flac 精确,mp3 估算;0 = 未知
	baseMs         int64   // tracker 零点对应的绝对时间轴(seek 后非 0)
	discardSamples int64   // flac/Range 被忽略时,起播前需丢弃的样本数
	eos            atomic.Bool
}

// NewBeep 构造 beep 后端的 Player。newReq 为 nil 时用裸 http 请求
// (无 netease 伪装头;生产请传 engine.NewNeteaseRequest)。
func NewBeep(newReq RequestBuilder, opts ...BeepOption) Player {
	if newReq == nil {
		newReq = func(ctx context.Context, method, url string) (*http.Request, error) {
			return http.NewRequestWithContext(ctx, method, url, nil)
		}
	}
	p := &beepPlayer{
		newReq: newReq,
		// 响应头超时防半开悬挂;body 流速不设限时(弱网缓冲是设计场景)。
		client:      &http.Client{Transport: &http.Transport{ResponseHeaderTimeout: 15 * time.Second}},
		watermarkMs: defaultWatermarkMs,
		lowWaterMs:  defaultLowWaterMs,
		vol:         75,
		state:       StateStopped,
	}
	for _, o := range opts {
		o(p)
	}
	return p
}

// streamParts 是一路已打开音频流的全部组成。
type streamParts struct {
	format       string
	buffer       *prefetchBuffer
	streamer     beep.StreamSeekCloser
	cancel       context.CancelFunc
	sampleRate   int
	contentLen   int64
	id3Size      int64
	bitrateKbps  int
	flacTotalMs  int64
	rangeIgnored bool // 服务端无视 Range 返回 200(回退丢弃解码)
}

// open 发起 HTTP 并接通解码器。rangeFrom>0 时发 Range 头(mp3 seek 重建)。
func (p *beepPlayer) open(url string, rangeFrom int64) (*streamParts, error) {
	ctx, cancel := context.WithCancel(context.Background())
	fail := func(err error) (*streamParts, error) {
		cancel()
		return nil, err
	}

	req, err := p.newReq(ctx, http.MethodGet, url)
	if err != nil {
		return fail(fmt.Errorf("构造播放请求: %w", err))
	}
	if rangeFrom > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", rangeFrom))
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return fail(fmt.Errorf("请求音频流: %w", err))
	}
	if resp.StatusCode/100 != 2 {
		resp.Body.Close()
		return fail(fmt.Errorf("音频流 HTTP 状态 %s", resp.Status))
	}

	parts := &streamParts{contentLen: resp.ContentLength, cancel: cancel}
	if rangeFrom > 0 && resp.StatusCode != http.StatusPartialContent {
		parts.rangeIgnored = true
	}
	format := detectFormat(resp.Header.Get("Content-Type"), url)
	parts.format = format
	buf := newPrefetchBuffer(resp.Body)
	parts.buffer = buf

	// mp3 探测必须在解码消费前做:此时 buffer 头部仍是流起始字节。
	if format == "mp3" && rangeFrom == 0 {
		head, _ := buf.PeekAtLeast(mp3PeekFloor, mp3PeekSize)
		parts.id3Size = int64(parseID3v2Size(head))
		parts.bitrateKbps = parseMP3Bitrate(head)
	}
	if format == "mp3" && rangeFrom > 0 && !parts.rangeIgnored {
		// Range 重建的落点是估算字节偏移,几乎不在帧边界;
		// go-mp3 的帧头扫描不校验 Layer,伪同步会报「only layer3」。
		// 先 peek 头部、自行找到帧同步、丢弃前面的杂字节再解码。
		if head, perr := buf.PeekAtLeast(mp3PeekFloor, mp3PeekSize); perr == nil {
			if sync := findFrameSync(head, 0); sync > 0 {
				_, _ = io.CopyN(io.Discard, buf, int64(sync))
			}
		}
	}

	var stream beep.StreamSeekCloser
	var bf beep.Format
	if format == "flac" {
		stream, bf, err = flac.Decode(buf)
	} else {
		stream, bf, err = mp3.Decode(buf)
	}
	if err != nil {
		buf.Close()
		resp.Body.Close()
		return fail(fmt.Errorf("解码音频流: %w", err))
	}
	parts.streamer = stream
	parts.sampleRate = int(bf.SampleRate)

	if format == "flac" && stream.Len() > 0 && parts.sampleRate > 0 {
		// STREAMINFO 给出精确总样本数。
		parts.flacTotalMs = int64(stream.Len()) * 1000 / int64(parts.sampleRate)
	}
	return parts, nil
}

// openFromBytes 从全量内存快照重解码(seek 内存路径)。
// exposeSeeker=true 时保留 Seek 能力(flac 精确 seek);false 时对解码器隐藏——
// go-mp3 对 Seeker 源会全文件扫帧建索引(NewDecoder → ensureFrameStartsAndLength),
// 5MB 快照扫描数秒、冻结调用方 goroutine;mp3 帧同步容忍估算落点,
// 用「切片起点 ≈ 目标字节偏移」代替解码器精确 seek(与 HTTP Range 重建同精度)。
func openFromBytes(data []byte, format string, exposeSeeker bool) (*streamParts, error) {
	var rc io.ReadCloser
	if exposeSeeker {
		rc = readSeekCloser{bytes.NewReader(data)}
	} else {
		rc = io.NopCloser(bytes.NewReader(data))
	}
	var stream beep.StreamSeekCloser
	var bf beep.Format
	var err error
	if format == "flac" {
		stream, bf, err = flac.Decode(rc)
	} else {
		stream, bf, err = mp3.Decode(rc)
	}
	if err != nil {
		return nil, fmt.Errorf("内存重解码: %w", err)
	}
	return &streamParts{
		format:     format,
		buffer:     newSealedBuffer(data),
		streamer:   stream,
		cancel:     func() {},
		sampleRate: int(bf.SampleRate),
		contentLen: int64(len(data)),
	}, nil
}

func (p *beepPlayer) Load(url string) error {
	p.mu.Lock()
	p.teardownLocked()
	p.fullSnapshot = nil // 新音源:丢弃上一首的全量快照
	p.mu.Unlock()

	st, err := p.open(url, 0)
	if err != nil {
		return err
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	p.url = url
	p.computeMetaLocked(st)
	p.applyStreamLocked(st, 0, 0)
	return nil
}

func (p *beepPlayer) Play() error {
	p.mu.Lock()
	if p.streamer == nil {
		p.mu.Unlock()
		return errors.New("尚未加载音源")
	}
	if p.eos.Load() && p.url != "" {
		// 播完再 Play = 从头重播。
		url := p.url
		p.mu.Unlock()
		if err := p.Load(url); err != nil {
			return err
		}
		return p.Play()
	}
	if p.state == StatePaused {
		if p.started && p.ctrl != nil {
			speaker.Lock()
			p.ctrl.Paused = false
			speaker.Unlock()
			p.state = StatePlaying
		} else {
			// 水位未达标前暂停过:恢复后仍等水位。
			p.state = StateBuffering
		}
		p.playRequested = true
		p.mu.Unlock()
		return nil
	}
	if err := ensureSpeaker(); err != nil {
		p.mu.Unlock()
		return fmt.Errorf("无法初始化音频输出(beep): %w; headless 环境请用 song download", err)
	}
	p.playRequested = true
	p.startMonitorLocked()
	p.mu.Unlock()
	return nil
}

func (p *beepPlayer) Pause() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.state != StatePlaying && p.state != StateBuffering {
		return nil
	}
	if p.started && p.ctrl != nil {
		speaker.Lock()
		p.ctrl.Paused = true
		speaker.Unlock()
	}
	// 清起播意图:水位前暂停后,monitor 不得在水位达标时自行起播。
	p.playRequested = false
	p.state = StatePaused
	return nil
}

func (p *beepPlayer) Seek(offsetSec int64) error {
	p.mu.Lock()
	if p.streamer == nil {
		p.mu.Unlock()
		return errors.New("尚未加载音源")
	}
	cur := p.baseMs + p.tracker.ms()
	target := max(cur+offsetSec*1000, 0)
	if p.totalMs > 0 {
		target = min(target, p.totalMs)
	}
	url, format := p.url, p.format
	var memSnapshot []byte
	// fullSnapshot 缓存首次全量快照:p.buffer 在 mem-seek 后被替换为切片(sealed),
	// 其 Bytes() 只返回切片而非原始全量;若直接用它,连续 seek 会累积丢失前缀,
	// 最终切片耗尽 → openFromBytes 报 mp3: EOF。首次 Done 时落盘,跨 seek 复用。
	if len(p.fullSnapshot) > 0 {
		memSnapshot = p.fullSnapshot
	} else if p.buffer != nil && p.buffer.Done() {
		memSnapshot = p.buffer.Bytes()
		p.fullSnapshot = memSnapshot
	}
	rangeFrom := p.id3Size + int64(float64(target)*p.bytesPerMs)
	wasRequested := p.playRequested
	p.teardownLocked()
	p.mu.Unlock()

	var st *streamParts
	var err error
	var baseMs, discard int64
	switch {
	case memSnapshot != nil && format == "mp3":
		// 全量已在内存:按估算字节落点切片重解码,零网络零全文件扫描。
		// 落点先经 findFrameSync 对齐帧边界(go-mp3 的扫描不校验 Layer,
		// 伪同步会报「only layer3」),精度与 Range 重建一致(码率估算)。
		from := int(min(max(rangeFrom, p.id3Size), int64(len(memSnapshot))))
		if sync := findFrameSync(memSnapshot, from); sync >= 0 {
			from = sync
		}
		st, err = openFromBytes(memSnapshot[from:], format, false)
		if err == nil {
			baseMs = target
		}
	case memSnapshot != nil:
		// flac 全量已在内存:ReadSeeker 精确 seek,零网络。
		st, err = openFromBytes(memSnapshot, format, true)
		if err == nil {
			baseMs = target
			pos := int(target * int64(st.sampleRate) / 1000)
			if se := st.streamer.Seek(pos); se != nil {
				st.streamer.Close()
				err = fmt.Errorf("内存 seek: %w", se)
			}
		}
	case format == "mp3":
		// 部分下载:Range 重建,mp3 帧同步容忍任意字节落点。
		st, err = p.open(url, rangeFrom)
		if err == nil {
			if st.rangeIgnored {
				discard = target * outRate / 1000
			} else {
				baseMs = target
			}
		}
	default:
		// flac 部分下载:帧流无自同步头,只能重新拉全量 + 丢弃解码。
		st, err = p.open(url, 0)
		if err == nil {
			discard = target * outRate / 1000
		}
	}
	if err != nil {
		return fmt.Errorf("seek 重建流: %w", err)
	}

	p.mu.Lock()
	p.applyStreamLocked(st, baseMs, discard)
	if wasRequested {
		p.playRequested = true
		p.startMonitorLocked()
	}
	p.mu.Unlock()
	return nil
}

func (p *beepPlayer) Volume(delta int) error {
	p.mu.Lock()
	p.vol = clampInt(p.vol+delta, 0, 100)
	vol, volume := p.vol, p.volume
	p.mu.Unlock()
	if volume != nil {
		speaker.Lock()
		volume.Volume = gainOf(vol)
		volume.Silent = vol == 0
		speaker.Unlock()
	}
	return nil
}

func (p *beepPlayer) Progress() (int64, int64, State) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.state == StateBuffering && p.buffer != nil {
		// 起播/续缓冲中:暴露 (已缓冲, 目标水位),供缓冲 spinner 显示。
		return p.bufferedMsLocked(), p.watermarkMs, p.state
	}
	cur := p.baseMs
	if p.tracker != nil {
		cur += p.tracker.ms()
	}
	return cur, p.totalMs, p.state
}

func (p *beepPlayer) State() State {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.state
}

func (p *beepPlayer) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.teardownLocked()
	return nil
}

// computeMetaLocked 换算码率与总时长(仅 Load 时算;Seek 重建复用旧值)。
func (p *beepPlayer) computeMetaLocked(st *streamParts) {
	p.id3Size = st.id3Size
	p.totalMs = 0
	kbps := st.bitrateKbps
	if kbps == 0 {
		kbps = defaultBitrateKbps
	}
	// kbps*1000 bit/s ÷ 8 ÷ 1000 ms = kbps/8 byte/ms
	p.bytesPerMs = float64(kbps) / 8
	if st.format == "flac" {
		p.totalMs = st.flacTotalMs
		if st.contentLen > 0 && p.totalMs > 0 {
			p.bytesPerMs = float64(st.contentLen) / float64(p.totalMs)
		}
		return
	}
	if audioLen := st.contentLen - st.id3Size; audioLen > 0 {
		p.totalMs = int64(float64(audioLen) / p.bytesPerMs)
	}
}

// applyStreamLocked 接管一路流:建播放链路,进入 Buffering 等水位。
// 链路:decoder → resample(→44.1k) → volume → seq(eos 回调) → tracker → ctrl。
// tracker 必须在 ctrl 内侧:暂停时 ctrl 出静音不拉 tracker,位置才不漂移。
func (p *beepPlayer) applyStreamLocked(st *streamParts, baseMs, discardSamples int64) {
	var s beep.Streamer = st.streamer
	if st.sampleRate > 0 && st.sampleRate != outRate {
		s = beep.Resample(4, beep.SampleRate(st.sampleRate), outRate, s)
	}
	p.eos.Store(false)
	vol := &effects.Volume{Streamer: s, Base: 2, Volume: gainOf(p.vol), Silent: p.vol == 0}
	seq := beep.Seq(vol, beep.Callback(func() { p.eos.Store(true) }))
	tr := &posTracker{Streamer: seq}
	p.volume = vol
	p.tracker = tr
	p.ctrl = &beep.Ctrl{Streamer: tr, Paused: true}
	p.buffer = st.buffer
	p.streamer = st.streamer
	p.cancel = st.cancel
	p.format = st.format
	p.baseMs = baseMs
	p.discardSamples = discardSamples
	p.state = StateBuffering
}

// teardownLocked 停掉当前流:断网络、摘 mixer、停 monitor、释放解码器。
// 顺序关键:必须先 cancel——网络 stall 时 mixer 拉取线程阻塞在 buffer.Read,
// 若先 speaker.Clear 会等不到拉取退出,而 cancel 恰好是解堵的那一步。
func (p *beepPlayer) teardownLocked() {
	if p.cancel != nil {
		p.cancel()
		p.cancel = nil
	}
	if p.started {
		speaker.Clear()
	}
	p.started = false
	p.playRequested = false
	p.monitored = false
	if p.genDone != nil {
		close(p.genDone)
		p.genDone = nil
	}
	if p.streamer != nil {
		_ = p.streamer.Close()
		p.streamer = nil
	}
	p.ctrl = nil
	p.tracker = nil
	p.volume = nil
	p.buffer = nil
	p.totalMs = 0
	p.baseMs = 0
	p.discardSamples = 0
	p.state = StateStopped
}

func (p *beepPlayer) bufferedMsLocked() int64 {
	if p.buffer == nil || p.bytesPerMs <= 0 {
		return 0
	}
	return int64(float64(p.buffer.Buffered()) / p.bytesPerMs)
}

func (p *beepPlayer) waterReachedLocked() bool {
	return p.buffer.Done() || p.bufferedMsLocked() >= p.watermarkMs
}

func (p *beepPlayer) waterLowLocked() bool {
	return !p.buffer.Done() && p.bufferedMsLocked() < p.lowWaterMs
}

// startMonitorLocked 启动当前代的水位 monitor(每代最多一个)。
func (p *beepPlayer) startMonitorLocked() {
	if p.monitored {
		return
	}
	p.monitored = true
	p.gen++
	done := make(chan struct{})
	p.genDone = done
	go p.monitor(p.gen, done)
}

// monitor 水位状态机:丢弃解码(seek)→ 起播 → 低水位续缓冲/恢复 → 播完。
func (p *beepPlayer) monitor(gen int, done chan struct{}) {
	if !p.discardPhase(gen, done) {
		return
	}
	ticker := time.NewTicker(monitorEvery)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case <-ticker.C:
		}

		p.mu.Lock()
		if p.gen != gen {
			p.mu.Unlock()
			return
		}
		var action func(int)
		switch {
		case p.eos.Load() && p.started:
			action = p.actStop
		case !p.started && p.playRequested && p.waterReachedLocked():
			action = p.actStart
		case p.started && p.state == StatePlaying && p.waterLowLocked():
			action = p.actRebuffer
		case p.started && p.state == StateBuffering && p.waterReachedLocked():
			action = p.actResume
		}
		p.mu.Unlock()

		if action == nil {
			continue
		}
		action(gen)
		if p.State() == StateStopped {
			return
		}
	}
}

// discardPhase 起播前把解码快进丢弃到目标位置(flac seek / Range 被忽略时)。
// 拉 tracker 而非 ctrl:ctrl 暂停态只出静音不拉流,丢弃必须真实推进解码器。
func (p *beepPlayer) discardPhase(gen int, done chan struct{}) bool {
	p.mu.Lock()
	remaining := p.discardSamples
	tr := p.tracker
	p.mu.Unlock()
	if remaining <= 0 || tr == nil {
		return true
	}
	scratch := make([][2]float64, 2048)
	stalled := 0
	for remaining > 0 {
		select {
		case <-done:
			return false
		default:
		}
		n, ok := tr.Stream(scratch[:min(remaining, int64(len(scratch)))])
		remaining -= int64(n)
		if !ok {
			break
		}
		if n == 0 {
			// resampler 等中间环节可能瞬时返回 (0, true),防死循环。
			stalled++
			if stalled > 100 {
				break
			}
			time.Sleep(10 * time.Millisecond)
			continue
		}
		stalled = 0
	}
	p.mu.Lock()
	if p.gen == gen {
		p.discardSamples = 0
	}
	p.mu.Unlock()
	return true
}

// 以下 act* 在 monitor 决策后执行,各自重新校验代与状态以闭合 TOCTOU。

func (p *beepPlayer) actStart(gen int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.gen != gen || p.started || !p.playRequested || p.ctrl == nil {
		return
	}
	speaker.Clear() // CLI 单播放器假设:清掉上一代的残留
	// Paused 写入须在 Play 之前:mixer 尚看不到 ctrl,写被 Play 内部锁发布;
	// Play 之后再写就是与拉取线程的数据竞争。
	p.ctrl.Paused = false
	speaker.Play(p.ctrl)
	p.started = true
	p.state = StatePlaying
}

func (p *beepPlayer) actResume(gen int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.gen != gen || p.state != StateBuffering || !p.started || p.ctrl == nil {
		return
	}
	speaker.Lock()
	p.ctrl.Paused = false
	speaker.Unlock()
	p.state = StatePlaying
}

func (p *beepPlayer) actRebuffer(gen int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.gen != gen || p.state != StatePlaying || !p.started || p.ctrl == nil {
		return
	}
	speaker.Lock()
	p.ctrl.Paused = true
	speaker.Unlock()
	p.state = StateBuffering
}

func (p *beepPlayer) actStop(gen int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.gen != gen || !p.started {
		return
	}
	p.started = false
	p.playRequested = false
	p.monitored = false // monitor 随即退出
	p.state = StateStopped
}

// speaker 全进程只能 Init 一次(beep/oto 限制),懒初始化。
var (
	speakerOnce sync.Once
	speakerErr  error
)

func ensureSpeaker() error {
	speakerOnce.Do(func() {
		speakerErr = speaker.Init(outRate, speakerBuf)
	})
	return speakerErr
}

// posTracker 统计被拉走的样本数(在 44.1k 输出域),换算播放位置。
type posTracker struct {
	beep.Streamer
	samples atomic.Int64
}

func (t *posTracker) Stream(samples [][2]float64) (int, bool) {
	n, ok := t.Streamer.Stream(samples)
	t.samples.Add(int64(n))
	return n, ok
}

func (t *posTracker) ms() int64 {
	return t.samples.Load() * 1000 / outRate
}

// readSeekCloser 让 bytes.Reader 满足解码器的 ReadCloser 要求,
// 同时保留 Seeker 能力(io.NopCloser 会丢掉 Seeker 类型断言)。
type readSeekCloser struct{ io.ReadSeeker }

func (readSeekCloser) Close() error { return nil }

// detectFormat 按 Content-Type / URL 后缀判定编码,网易 CDN 无后缀默认 mp3。
func detectFormat(contentType, url string) string {
	ct := strings.ToLower(contentType)
	if strings.Contains(ct, "flac") {
		return "flac"
	}
	if strings.Contains(ct, "mpeg") || strings.Contains(ct, "mp3") {
		return "mp3"
	}
	path, _, _ := strings.Cut(strings.ToLower(url), "?")
	if strings.HasSuffix(path, ".flac") {
		return "flac"
	}
	return "mp3"
}

// gainOf 把 0-100 音量映射到 effects.Volume(base 2):
// 100→0(原声),75→-1,0→-4 且静音。
func gainOf(percent int) float64 {
	return float64(percent-100) / 25
}

func clampInt(v, lo, hi int) int {
	return min(max(v, lo), hi)
}
