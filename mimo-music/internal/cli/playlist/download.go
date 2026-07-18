// playlist download 命令:整单批量下载,worker 池并发 + 跳过已存在 + 失败汇总(PRD-0013)。
//
// 流程:AllTracks(拿全量) → 确认闸门(写盘量级) → worker 池(songdl.DownloadOne
// per song,并发 = --workers,风控自动降并发)→ 汇总(渲染层:成功/跳过/失败计数 +
// 失败列表走 stderr)。
//
// 进度:kit.Progress 总 bar(X-of-Y + ETA,IsTotal=true)+ 每首一个子 bar(完成 ✓/失败 ✗)。
// 风控:歌间随机 jitter sleep;连续 3 次失败降并发到 1(serialMu 串行化);
// 降并发后再连续失败 → cancel 全部 + 限流提示。
package playlist

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/songdl"
	playlistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/playlist"
	songendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/song"
)

// 风控参数。
const (
	failThreshold = 3 // 连续失败达此值 → 降并发到 1
	stopThreshold = 2 // 降并发后再连续失败达此值 → 停止 + 限流提示
)

// newDownload 构造 playlist download 命令。
func newDownload(k *kit.Kit) *cobra.Command {
	var id int64
	var level int
	var out string
	var workers int
	var force bool
	c := &cobra.Command{
		Use:   "download",
		Short: "下载整个歌单(批量,带元数据)",
		Args:  cobra.MaximumNArgs(1), // 位置参数:playlist download 12345 ≡ --id 12345
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return runPlaylistDownload(k, rid, level, out, workers, force, defaultPlaylistDeps(k))
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌单 ID")
	c.Flags().IntVar(&level, "level", 1, "音质: 1=standard 2=exhigh 3=lossless 4=hires")
	c.Flags().StringVar(&out, "out", ".", "下载目录(自动 mkdir -p)")
	c.Flags().IntVar(&workers, "workers", 3, "并发数 1-5")
	c.Flags().BoolVar(&force, "force", false, "覆盖已存在文件")
	return c
}

// playlistDeps 是 runPlaylistDownload 的外部依赖(网络 + 进度 + 单曲核心)。
//
// 抽成可注入结构是为了 worker 池并发与风控逻辑的单测:
//   - fetchTracks:拿全量曲目(测试 mock 控制总数)
//   - fetchURL:per-song 拿直链(测试 mock 返空模拟 VIP 无音源失败)
//   - downloadOne:单曲落盘核心(测试 mock 返固定 Outcome 控制成功/跳过/失败)
//   - newProgress:进度条工厂(测试可注入 io.Discard 版)
//   - sleepJitter:风控抖动 sleep(测试可注入 noop 加速)
type playlistDeps struct {
	fetchTracks        func(ctx context.Context, id int64) (*mmpb.AllTracksResponse, error)
	fetchPlaylistDetail func(ctx context.Context, id int64) (*mmpb.Playlist, error) // 拿歌单名(显示用)
	fetchURL           func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error)
	downloadOne        func(ctx context.Context, song *mmpb.Song, songURL *mmpb.SongURL, opts songdl.Options) songdl.Outcome
	newProgress        func() *kit.Progress
	sleepJitter        func() // 风控:歌间随机 sleep 200-500ms(测试 noop)
	now                func() time.Time
}

// defaultPlaylistDeps 生产依赖:真实网络 + songdl 核心 + 真实进度 + 真实 jitter。
func defaultPlaylistDeps(k *kit.Kit) playlistDeps {
	dlDeps := songdl.NewDeps(k)
	return playlistDeps{
		fetchTracks: func(ctx context.Context, id int64) (*mmpb.AllTracksResponse, error) {
			resp, err := kit.Exec(k, ctx, playlistendpoint.AllTracks, &mmpb.AllTracksRequest{PlaylistId: id})
			if err != nil {
				return nil, err
			}
			return resp, nil
		},
		fetchPlaylistDetail: func(ctx context.Context, id int64) (*mmpb.Playlist, error) {
			resp, err := kit.Exec(k, ctx, playlistendpoint.GetPlaylist, &mmpb.GetPlaylistRequest{PlaylistId: id})
			if err != nil {
				return nil, err
			}
			return resp.Playlist, nil
		},
		fetchURL: func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.URL, &mmpb.GetSongURLRequest{
				SongId: id, Level: mmpb.SongLevel(level),
			})
			if err != nil {
				return nil, err
			}
			return resp.Url, nil
		},
		downloadOne: func(ctx context.Context, song *mmpb.Song, songURL *mmpb.SongURL, opts songdl.Options) songdl.Outcome {
			return songdl.DownloadOne(ctx, song, songURL, opts, dlDeps)
		},
		newProgress: func() *kit.Progress { return k.NewProgress() },
		sleepJitter: func() {
			time.Sleep(time.Duration(200+rand.IntN(300)) * time.Millisecond)
		},
		now: time.Now,
	}
}

// runPlaylistDownload 执行批量下载主流程。
//
// 流程:fetchTracks(+fetchPlaylistDetail 拿名)→ 确认闸门(含预估总量)→ mkdir →
// worker 池 → 汇总渲染。
// 退出码:确认取消 → ErrCancelled(exit 0);非 TTY 无 --yes → ErrUsage(exit 2);
// mkdir 失败 → exit 1;否则 exit 0。
func runPlaylistDownload(k *kit.Kit, id int64, level int, out string, workers int, force bool, deps playlistDeps) error {
	ctx := k.CookieCtx()

	// 1. 拿全量曲目 + 歌单名(并行)。歌单名失败不致命(用 ID 兜底)。
	resp, err := deps.fetchTracks(ctx, id)
	if err != nil {
		return fmt.Errorf("获取歌单曲目: %w", err)
	}
	songs := resp.GetSongs()
	playlistName := strconvInt64(id) // 兜底
	if deps.fetchPlaylistDetail != nil {
		if pl, derr := deps.fetchPlaylistDetail(ctx, id); derr == nil && pl != nil && pl.Name != "" {
			playlistName = pl.Name
		}
	}
	if len(songs) == 0 {
		fmt.Fprintf(k.OutWriter(), "歌单「%s」无可下载曲目\n", playlistName)
		return nil
	}

	// 2. 预估总量 + 确认闸门(写盘量级)。按 level 码率 × 总时长粗估。
	// level 1≈320kbps, 2≈320, 3(flac)≈996, 4≈1411;字节/秒 = kbps×1000/8。
	estBytes := estimateTotalBytes(songs, level)
	estLabel := songdl.FormatSizeLabel(estBytes)
	action := fmt.Sprintf("下载歌单「%s」(%d 首, 预估 %s)到 %s",
		playlistName, len(songs), estLabel, absOrSamePlaylist(out))
	if err := k.ConfirmFatal(action); err != nil {
		return err
	}

	// 3. mkdir。
	if err := os.MkdirAll(out, 0o755); err != nil {
		return fmt.Errorf("✗ 目录 %s 不可写: %v", out, err)
	}

	// 4. worker 池。
	outcomes := runWorkerPool(k, songs, level, out, force, workers, deps)

	// 5. 汇总渲染。
	return renderPlaylistSummary(k, playlistName, len(songs), outcomes)
}

// runWorkerPool 跑批量下载 worker 池,返回每首 Outcome(按完成顺序)。
//
// 并发控制:初始 N 个 worker goroutine;连续失败达 failThreshold → degraded=true,
// 之后所有 worker 抢 serialMu 进入串行(并发=1);降并发后再连续 stopThreshold 次失败
// → cancel 全部 + 限流提示。单曲失败不中断批量(outcome 记账继续)。
func runWorkerPool(k *kit.Kit, songs []*mmpb.Song, level int, out string, force bool, workers int, deps playlistDeps) []songdl.Outcome {
	n := clampWorkers(workers)

	p := deps.newProgress()
	// 总 bar:label 用歌曲数,IsTotal 切 ETA 模式。字节总数未知,按歌曲数计 X-of-Y。
	totalBar := p.AddBar(int64(len(songs)), fmt.Sprintf("%d 首", len(songs)))
	totalBar.IsTotal = true
	p.Start()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var (
		mu          sync.Mutex
		outcomes    = make([]songdl.Outcome, 0, len(songs))
		wg          sync.WaitGroup
		warnMu      sync.Mutex   // 保护并发 k.Warnf(k.Err buffer 非线程安全)
		consecFails atomic.Int32 // 连续网络失败计数(VIP 无音源等逻辑跳过不计)
		degraded    atomic.Bool  // 已降并发到 1
		stopped     atomic.Bool  // 已触发停止
		serialMu    sync.Mutex   // degraded 后串行化 processOne(并发=1)
	)

	// warn 包一层锁:worker 并发触发风控提示时,k.Warnf 写 k.Err buffer
	// 非线程安全,必须串行化。
	warn := func(format string, args ...any) {
		warnMu.Lock()
		defer warnMu.Unlock()
		k.Warnf(format, args...)
	}

	// record 收集 outcome + 推进 totalBar(成功/跳过/失败各算一首完成)。
	record := func(o songdl.Outcome) {
		mu.Lock()
		outcomes = append(outcomes, o)
		mu.Unlock()
		totalBar.Incr(1, deps.now())
	}

	// checkExistingSize PRD 断点续传 size 预检(批量专属,单曲走 downloadOne 默认冲突逻辑):
	//   - force=true → ok=false(交 downloadOne 覆盖)
	//   - 默认名/回退名都不存在 → ok=false(交 downloadOne 下载)
	//   - 存在 + size 匹配(差 < 1KB 容 ID3 微调)→ StatusSkipped
	//   - 存在 + size 不符 → StatusSkipped + stderr 警告(疑似上次中断)
	// ok=true 时返回的 Outcome 已定终,worker 不再调 downloadOne。
	checkExistingSize := func(song *mmpb.Song, songURL *mmpb.SongURL, dir string, force bool) (songdl.Outcome, bool) {
		if force {
			return songdl.Outcome{}, false
		}
		for _, name := range []string{
			songdl.SongFilename(song, songURL.Format),
			songdl.FallbackFilename(song, songURL.Format),
		} {
			path := filepath.Join(dir, name)
			info, err := os.Stat(path)
			if err != nil {
				continue // 不存在,试下一个名
			}
			// size 已知才比对;未知(0)按 downloadOne 默认名冲突走回退逻辑。
			if songURL.Size > 0 {
				diff := info.Size() - songURL.Size
				if diff < 0 {
					diff = -diff
				}
				if diff >= 1024 {
					// 大小不符:跳过但警告。
					warn("⚠ %s 大小不符(本地 %d, 远端 %d),疑似上次中断。--force 覆盖。", name, info.Size(), songURL.Size)
					return songdl.Outcome{Status: songdl.StatusSkipped, SongID: song.Id, Reason: "大小不符", Filename: name, Path: path}, true
				}
			}
			return songdl.Outcome{Status: songdl.StatusSkipped, SongID: song.Id, Reason: "已存在", Filename: name, Path: path}, true
		}
		return songdl.Outcome{}, false
	}

	// processOne 单首:fetchURL → (size 检查) → downloadOne → subBar 反馈。
	// fetchURL 失败分两类:网络错误(Network=true,计风控)vs VIP 无音源(Network=false,不计)。
	processOne := func(song *mmpb.Song) songdl.Outcome {
		// 先 fetchURL 拿 size + url,再建 subBar(AddBar 时定 Total,渲染有百分比)。
		songURL, err := deps.fetchURL(ctx, song.Id, level)
		if err != nil {
			// fetchURL 本身报错(网络/HTTP):属网络失败。
			sub := p.AddBar(0, shortLabel(song))
			sub.Fail(err.Error(), deps.now())
			return songdl.Outcome{Status: songdl.StatusFailed, SongID: song.Id, Reason: err.Error(), Network: true}
		}
		if songURL == nil || songURL.Url == "" {
			// VIP/无音源:逻辑跳过,不计风控。
			sub := p.AddBar(0, shortLabel(song))
			sub.Fail("无可用音源", deps.now())
			return songdl.Outcome{Status: songdl.StatusFailed, SongID: song.Id, Reason: "无可用音源"}
		}
		// size 预检:文件已存在 + size 匹配 → 跳过(PRD 断点续传);size 不符 → 跳过 + 警告。
		if o, ok := checkExistingSize(song, songURL, out, force); ok {
			sub := p.AddBar(0, shortLabel(song))
			sub.Complete(deps.now())
			return o
		}
		sub := p.AddBar(songURL.Size, shortLabel(song)) // size 未知(0)走无百分比模式
		o := deps.downloadOne(ctx, song, songURL, songdl.Options{Out: out, Force: force})
		switch o.Status {
		case songdl.StatusSuccess, songdl.StatusSkipped:
			sub.Complete(deps.now())
		case songdl.StatusFailed:
			sub.Fail(o.Reason, deps.now())
		}
		return o
	}

	// throttle 风控:仅对 Network=true 的失败计连续计数(PRD「连续 3 次 4xx/fetch 失败」)。
	// VIP 无音源、size 不符等逻辑结果不触发风控。
	throttle := func(o songdl.Outcome) {
		if !o.Network {
			// 非网络失败不累加,也不重置(成功才重置,见下)。
			if o.Status == songdl.StatusSuccess || o.Status == songdl.StatusSkipped {
				consecFails.Store(0)
			}
			return
		}
		fails := consecFails.Add(1)
		switch {
		case !degraded.Load() && fails >= int32(failThreshold):
			degraded.Store(true)
			warn("⚠ 连续 %d 次失败,已降并发到 1", fails)
		case degraded.Load() && fails >= int32(failThreshold+stopThreshold):
			if stopped.CompareAndSwap(false, true) {
				warn("✗ 疑似被限流,请稍后重试或减少 --workers")
				cancel()
			}
		}
	}

	jobs := make(chan *mmpb.Song, len(songs))
	for _, s := range songs {
		jobs <- s
	}
	close(jobs)

	// finalize 是 processOne 之后的统一收尾:记录 + 风控。
	finalize := func(o songdl.Outcome) {
		record(o)
		throttle(o)
	}

	// runJob 处理一首:degraded 时串行(serialMu 压并发到 1)。两个分支都跑
	// processOne + finalize + jitter —— 降并发后 jitter 更重要(疑似限流时更要抖)。
	runJob := func(song *mmpb.Song) {
		if degraded.Load() {
			serialMu.Lock()
			o := processOne(song)
			serialMu.Unlock()
			finalize(o)
		} else {
			o := processOne(song)
			finalize(o)
		}
		if deps.sleepJitter != nil {
			deps.sleepJitter()
		}
	}

	for w := 0; w < n; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for song := range jobs {
				if stopped.Load() {
					return
				}
				runJob(song)
			}
		}()
	}
	wg.Wait()
	totalBar.Complete(deps.now())
	p.Wait()

	return outcomes
}

// ==================== 汇总渲染 ====================

// playlistSummary 批量下载汇总(人类 key-value / --json 对象,双态输出)。
//
// JSON schema 按 PRD-0013 行 271: total/success/skipped/failed[{id,reason}]。
// 人类显示额外用 playlistName(不进 JSON)。
type playlistSummary struct {
	Total   int           `json:"total"`
	Success int           `json:"success"`
	Skipped int           `json:"skipped"`
	Failed  []failedEntry `json:"failed"`

	// 人类显示辅助(不进 JSON)。
	playlistName string `json:"-"`
}

// failedEntry 失败曲目(id + 原因),进 JSON 数组。
type failedEntry struct {
	ID     int64  `json:"id"`
	Reason string `json:"reason"`
}

// renderPlaylistSummary 统计 outcomes 并按 --json 决定输出形态。
// 失败详情列表走 stderr(脚本 jq .success 直接拿结构化结果不被污染)。
func renderPlaylistSummary(k *kit.Kit, playlistName string, total int, outcomes []songdl.Outcome) error {
	s := summarize(playlistName, total, outcomes)
	if k.JSON {
		return s.writeJSON(k.OutWriter())
	}
	s.writeHuman(k.OutWriter(), k)
	return nil
}

// summarize 把 outcomes 折算成 playlistSummary(纯函数,易测)。
func summarize(playlistName string, total int, outcomes []songdl.Outcome) playlistSummary {
	s := playlistSummary{Total: total, playlistName: playlistName}
	for _, o := range outcomes {
		switch o.Status {
		case songdl.StatusSuccess:
			s.Success++
		case songdl.StatusSkipped:
			s.Skipped++
		case songdl.StatusFailed:
			s.Failed = append(s.Failed, failedEntry{ID: o.SongID, Reason: o.Reason})
		}
	}
	return s
}

// writeHuman 渲染人类可读汇总到 stdout,失败详情走 stderr(PRD 行 222-234 格式)。
func (s playlistSummary) writeHuman(stdout io.Writer, k *kit.Kit) {
	fmt.Fprintf(stdout, "歌单下载完成:%s\n\n", s.playlistName)
	fmt.Fprintf(stdout, "成功     %d\n", s.Success)
	fmt.Fprintf(stdout, "跳过     %d (已存在)\n", s.Skipped)
	failedCount := len(s.Failed)
	fmt.Fprintf(stdout, "失败     %d\n", failedCount)
	if failedCount > 0 {
		fmt.Fprintf(k.Err, "\n失败列表:\n")
		for _, f := range s.Failed {
			fmt.Fprintf(k.Err, "  - %d  %s\n", f.ID, f.Reason)
		}
	}
}

// writeJSON 输出多行缩进 JSON(对齐 protojson 的 Multiline 风格)。
// failed 为空时 MarshalIndent 产出 [] 还是 null?Go json 对 nil slice 输出 null,
// 非 nil 空 slice 输出 []。这里强制非 nil 空(语义:数组而非 null)。
func (s playlistSummary) writeJSON(w io.Writer) error {
	if s.Failed == nil {
		s.Failed = []failedEntry{}
	}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化歌单汇总: %w", err)
	}
	_, err = w.Write(append(b, '\n'))
	return err
}

// ==================== 辅助函数 ====================

// estimateTotalBytes 按 level 码率 × 各曲时长粗估总量(确认提示用,非精确)。
// level 1/2≈320kbps,3(flac)≈996kbps,4(hires)≈1411kbps。未知时长按 4 分钟兜底。
func estimateTotalBytes(songs []*mmpb.Song, level int) int64 {
	const defaultDurationMs = 240_000 // 4 分钟兜底
	kbps := 320
	switch level {
	case 3:
		kbps = 996
	case 4:
		kbps = 1411
	}
	bytesPerSec := int64(kbps) * 1000 / 8
	var total int64
	for _, s := range songs {
		dur := s.GetDurationMs()
		if dur <= 0 {
			dur = defaultDurationMs
		}
		total += bytesPerSec * dur / 1000
	}
	return total
}

// strconvInt64 int64 → 字符串(避免引入 strconv 仅为兜底一处)。
func strconvInt64(n int64) string {
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

// clampWorkers 把 workers 收敛到 [1,5](PRD flag 规格)。
func clampWorkers(w int) int {
	if w < 1 {
		return 1
	}
	if w > 5 {
		return 5
	}
	return w
}

// shortLabel 进度条子 bar 的短标签:{首艺人} - {歌名}(过长截断由渲染层处理)。
func shortLabel(s *mmpb.Song) string {
	if s == nil {
		return "?"
	}
	artist := ""
	if len(s.Artists) > 0 {
		artist = s.Artists[0].Name
	}
	if artist == "" {
		return s.Name
	}
	if s.Name == "" {
		return artist
	}
	return artist + " - " + s.Name
}

// absOrSamePlaylist 取绝对路径,失败返回原值(确认提示显示用)。
func absOrSamePlaylist(p string) string {
	if abs, err := filepath.Abs(p); err == nil {
		return abs
	}
	return p
}
