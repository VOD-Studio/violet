// 单曲下载核心:从拿到的 SongURL + Song 完成落盘,返回结构化 Outcome。
// 命令层(song runDownload / playlist worker)负责拿 URL/Song,调 DownloadOne,
// 然后按各自需要渲染(单曲渲染结果 / 批量汇总)。
package songdl

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// Status 单曲下载结果状态。
type Status int

const (
	StatusSuccess Status = iota
	StatusSkipped
	StatusFailed
)

func (s Status) String() string {
	switch s {
	case StatusSuccess:
		return "success"
	case StatusSkipped:
		return "skipped"
	case StatusFailed:
		return "failed"
	default:
		return "unknown"
	}
}

// Outcome 单曲下载结果。命令层收集后做汇总渲染。
type Outcome struct {
	Status Status
	// SongID 歌曲 ID(汇总失败列表用)。
	SongID int64
	// Reason skipped/failed 时的原因(success 时为空)。
	Reason string
	// Network 标记 failed 是否源于网络/HTTP 错误(而非 VIP 无音源、size 不符等
	// 逻辑跳过)。批量风控只对 Network=true 计连续失败,避免 VIP 歌曲误触发限流。
	Network bool

	// 以下字段仅 Status == StatusSuccess 时有意义。
	Path        string // 绝对路径
	Filename    string // 文件名(不含目录)
	Dir         string // 目录(绝对)
	Bytes       int64
	Format      string
	Bitrate     int64
	MetaWritten bool
}

// Deps 是下载过程的可注入依赖(网络 + 文件 IO + 元数据)。
//
// 抽成结构是为了错误路径单测:注入 mock fetchURL/download/writeMeta,
// 覆盖 VIP 无音源、下载失败、元数据失败等确定性场景;真实网络行为留集成测试。
//
// 用法:
//   - 单曲命令(song runDownload):fetchURL + fetchDetail 在命令层先调,
//     再把结果传给 DownloadOne;download/writeMeta 由 Deps 提供。
//   - 批量命令(playlist worker):同上,但 fetchURL 在 worker 内 per-song 调。
type Deps struct {
	// download 流式下载到 path,返回写入字节数。total<=0 时进度条无百分比模式。
	// label 用于进度条显示(歌名)。
	download func(ctx context.Context, url string, total int64, path, label string) (int64, error)
	// writeMeta 写元数据,失败返回 error(调用方按非阻塞处理)。
	writeMeta func(path string, song *mmpb.Song) error
}

// NewDeps 构造生产 Deps:真实 HTTP 下载 + 真实元数据写入。
// downloadURL 是单曲/批量共用的流式下载器(签名见 DownloadToFile)。
// opts 用于测试覆盖个别字段(WithDownload/WithWriteMeta),保留其余默认。
func NewDeps(k *kit.Kit, opts ...DepsOption) Deps {
	d := Deps{
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			return DownloadToFile(ctx, k, url, total, path, label)
		},
		writeMeta: func(path string, song *mmpb.Song) error {
			return WriteSongMetadata(path, song)
		},
	}
	for _, o := range opts {
		o(&d)
	}
	return d
}

// DepsOption 用于测试注入个别字段(保留默认其余)。
type DepsOption func(*Deps)

// WithDownload 覆盖 download 字段(测试用)。
func WithDownload(fn func(ctx context.Context, url string, total int64, path, label string) (int64, error)) DepsOption {
	return func(d *Deps) { d.download = fn }
}

// WithWriteMeta 覆盖 writeMeta 字段(测试用)。
func WithWriteMeta(fn func(path string, song *mmpb.Song) error) DepsOption {
	return func(d *Deps) { d.writeMeta = fn }
}

// DownloadOne 完成单曲落盘的核心链路,返回结构化 Outcome(不渲染)。
//
// 调用方负责:① 拿到 songURL(含 Url/Format/Size/Bitrate);② 拿到 song(歌名/艺人/封面)。
// 空音源(songURL==nil 或 Url=="")→ 调用方应在调本函数前拦截(单曲/批量各自的处理不同,
// 不在此强加)。本函数只处理「拿到合法 songURL/song 之后」的落盘流程。
//
// 流程:ResolveConflictPath → mkdir → download → writeMeta(失败非阻塞)。
// Outcome.Status 三态:Success / Skipped(冲突且非 force)/ Failed(下载或 IO 错误)。
func DownloadOne(ctx context.Context, song *mmpb.Song, songURL *mmpb.SongURL, out string, force bool, deps Deps) Outcome {
	absOut := absOrSame(out)
	filename, path, skipped := resolvePath(song, songURL.Format, out, force)
	if skipped {
		return Outcome{
			Status:  StatusSkipped,
			SongID:  song.Id,
			Reason:  "已存在(用 --force 覆盖)",
			Path:    filepath.Join(absOut, filename),
			Filename: filename,
			Dir:     absOut,
		}
	}

	if err := os.MkdirAll(out, 0o755); err != nil {
		return Outcome{
			Status: StatusFailed,
			SongID: song.Id,
			Reason: fmt.Sprintf("目录 %s 不可写: %v", out, err),
		}
	}

	written, err := deps.download(ctx, songURL.Url, songURL.Size, path, filename)
	if err != nil {
		return Outcome{
			Status:  StatusFailed,
			SongID:  song.Id,
			Reason:  err.Error(),
			Network: true, // 下载 IO/HTTP 错误属网络失败
		}
	}

	metaWritten := true
	if deps.writeMeta != nil {
		if merr := deps.writeMeta(path, song); merr != nil {
			metaWritten = false
			// 元数据失败不阻塞:Outcome 仍是 Success(文件已落盘),
			// 命令层据 MetaWritten=false 提示。Reason 记元数据失败原因备查。
			// 不覆盖可能的 download 失败原因——这里只在 download 成功后跑。
		}
	}

	return Outcome{
		Status:      StatusSuccess,
		SongID:      song.Id,
		Path:        filepath.Join(absOut, filename),
		Filename:    filename,
		Dir:         absOut,
		Bytes:       written,
		Format:      songURL.Format,
		Bitrate:     songURL.Bitrate,
		MetaWritten: metaWritten,
	}
}

// resolvePath 是 ResolveConflictPath 的薄包装,同时返回 filename + path + skipped,
// 供 DownloadOne 内部用(避免重复 filepath.Join)。
func resolvePath(song *mmpb.Song, ext, dir string, force bool) (filename, path string, skipped bool) {
	path, skipped = ResolveConflictPath(song, ext, dir, force)
	filename = filepath.Base(path)
	return filename, path, skipped
}

// DownloadToFile 流式下载 URL 到 path,带进度条(TTY 时渲染 stderr)。
// 返回写入字节数。
func DownloadToFile(ctx context.Context, k *kit.Kit, url string, total int64, path, label string) (int64, error) {
	req, err := engine.NewNeteaseRequest(ctx, "GET", url, k.CurrentCookie())
	if err != nil {
		return 0, fmt.Errorf("构造下载请求: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("✗ 下载失败(网络): %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("✗ 下载失败: HTTP %d", resp.StatusCode)
	}

	f, err := os.Create(path)
	if err != nil {
		return 0, fmt.Errorf("✗ 创建文件 %s 失败: %v", path, err)
	}
	defer f.Close()

	// 进度条:total 未知(<=0)时传 0(进度条无百分比模式,仅显示已下载量)。
	p := k.NewProgress()
	bar := p.AddBar(total, label)
	p.Start()
	pr := &proxyReader{r: resp.Body, bar: bar, now: time.Now}
	written, err := io.Copy(f, pr)
	bar.Complete(time.Now())
	p.Wait()
	if err != nil {
		return written, fmt.Errorf("✗ 下载中断: %v", err)
	}
	return written, nil
}

// WriteSongMetadata 构造 Metadata 并写入。失败返回 error(调用方按非阻塞 Warnf 处理)。
func WriteSongMetadata(path string, song *mmpb.Song) error {
	cover := FetchCover(picURLOf(song))
	artist := ""
	if len(song.Artists) > 0 {
		artist = song.Artists[0].Name
	}
	album := ""
	if song.Album != nil {
		album = song.Album.Name
	}
	return WriteMetadata(path, Metadata{
		Title:  song.Name,
		Artist: artist,
		Album:  album,
		Cover:  cover,
	})
}

// FetchCover HTTP GET 取封面字节,失败返回 nil(不阻塞主流程)。
// 封面 CDN 通常无 Referer 检查,用普通请求即可。
func FetchCover(picURL string) []byte {
	if picURL == "" {
		return nil
	}
	resp, err := http.Get(picURL)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	return b
}

// picURLOf 取封面 URL:Album.PicUrl(Song 本身无 PicUrl 字段)。
func picURLOf(song *mmpb.Song) string {
	if song.Album != nil {
		return song.Album.PicUrl
	}
	return ""
}

// absOrSame 取绝对路径,失败返回原值(渲染显示用)。
func absOrSame(p string) string {
	if abs, err := filepath.Abs(p); err == nil {
		return abs
	}
	return p
}

// proxyReader 包装 io.Reader,Read 时累加进度到 Bar。
type proxyReader struct {
	r   io.Reader
	bar *kit.Bar
	now func() time.Time
}

func (p *proxyReader) Read(buf []byte) (int, error) {
	n, err := p.r.Read(buf)
	if n > 0 {
		p.bar.Incr(int64(n), p.now())
	}
	return n, err
}

// FormatSizeLabel 字节 → 人类可读大小(PRD 显示 "3.4 MB")。
func FormatSizeLabel(bytes int64) string {
	const mb = 1024 * 1024
	if bytes >= mb {
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(mb))
	}
	return fmt.Sprintf("%.1f KB", float64(bytes)/1024)
}
