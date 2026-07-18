// song download 命令:从 flag 解析到文件落盘的端到端垂直切片(PRD-0013 Phase C)。
//
// 流程:URL(拿直链) → Detail(拿歌名/封面) → 文件名 → 冲突检查 →
// 流式下载(进度条) → 元数据(失败 Warnf 不阻塞) → 渲染输出。
//
// 本切片交付主干(--id/--level/--out/--force);
// --dry-run/--no-metadata/--filename/位置参数/.part 续传留给 issue #24。
package song

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	songendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/song"
)

// newDownload 构造 song download 命令。
func newDownload(k *kit.Kit) *cobra.Command {
	var id int64
	var level int
	var out string
	var force bool
	c := &cobra.Command{
		Use:   "download",
		Short: "下载歌曲到本地(带元数据)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runDownload(k, id, level, out, force)
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	c.Flags().IntVar(&level, "level", 1, "音质: 1=standard 2=exhigh 3=lossless 4=hires")
	c.Flags().StringVar(&out, "out", ".", "下载目录(自动 mkdir -p)")
	c.Flags().BoolVar(&force, "force", false, "覆盖已存在文件")
	_ = c.MarkFlagRequired("id")
	return c
}

// runDownload 执行下载主流程(抽出来便于未来测试 + 逻辑清晰)。
func runDownload(k *kit.Kit, id int64, level int, out string, force bool) error {
	ctx := k.CookieCtx()

	// 1. 拿播放直链。
	urlResp, err := kit.Exec(k, ctx, songendpoint.URL, &mmpb.GetSongURLRequest{
		SongId: id, Level: mmpb.SongLevel(level),
	})
	if err != nil {
		return fmt.Errorf("获取播放地址: %w", err)
	}
	if urlResp.Url == nil || urlResp.Url.Url == "" {
		return fmt.Errorf("✗ 歌曲 %d 无可用音源(level=%d)。尝试 --level 1 或登录 VIP 账号", id, level)
	}
	songURL := urlResp.Url

	// 2. 拿歌曲详情(文件名 + 元数据用)。失败不致命:用 id 兜底空 Song。
	var song *mmpb.Song
	if detailResp, derr := kit.Exec(k, ctx, songendpoint.Detail, &mmpb.GetSongDetailRequest{SongId: id}); derr == nil && detailResp.Song != nil {
		song = detailResp.Song
	}
	if song == nil {
		song = &mmpb.Song{Id: id}
	}

	// 3. 文件名 + 目录。
	filename := songFilename(song, songURL.Format)
	if err := os.MkdirAll(out, 0o755); err != nil {
		return fmt.Errorf("✗ 目录 %s 不可写: %v", out, err)
	}
	path := filepath.Join(out, filename)

	// 4. 冲突检查:存在且非 force → 跳过。
	if shouldSkip(fileExists(path), force) {
		fmt.Fprintf(k.OutWriter(), "已跳过(已存在):%s\n", filename)
		return nil
	}

	// 5. 流式下载(进度条)。
	written, err := downloadToFile(ctx, k, songURL.Url, songURL.Size, path, filename)
	if err != nil {
		return err
	}

	// 6. 元数据(失败不阻塞:Warnf 警告,继续)。
	metaWritten := writeSongMetadata(k, path, song)

	// 7. 结果输出(stdout):人类 key-value / --json 对象。
	// download 结果不是 proto(文件信息),不走 Render;自己处理双态。
	result := downloadResult{
		Filename:    filename,
		Dir:         absOrSame(out),
		Size:        written,
		Format:      songURL.Format,
		Bitrate:     songURL.Bitrate,
		MetaWritten: metaWritten,
	}
	return result.write(k)
}

// downloadToFile 流式下载 URL 到 path,带进度条(TTY 时渲染 stderr)。
// 返回写入字节数。
func downloadToFile(ctx context.Context, k *kit.Kit, url string, total int64, path, label string) (int64, error) {
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

// writeSongMetadata 构造 Metadata 并写入,失败 Warnf 警告(非阻塞)。返回是否成功。
func writeSongMetadata(k *kit.Kit, path string, song *mmpb.Song) bool {
	cover := fetchCover(picURLOf(song))
	artist := ""
	if len(song.Artists) > 0 {
		artist = song.Artists[0].Name
	}
	album := ""
	if song.Album != nil {
		album = song.Album.Name
	}
	if err := writeMetadata(path, Metadata{
		Title:  song.Name,
		Artist: artist,
		Album:  album,
		Cover:  cover,
	}); err != nil {
		k.Warnf("⚠ 元数据写入失败,文件已保存")
		return false
	}
	return true
}

// fetchCover HTTP GET 取封面字节,失败返回 nil(不阻塞主流程)。
// 封面 CDN 通常无 Referer 检查,用普通请求即可。
func fetchCover(picURL string) []byte {
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

// shouldSkip 冲突跳过判定:文件存在且未 --force → 跳过。
func shouldSkip(exists, force bool) bool {
	return exists && !force
}

// fileExists 文件是否存在。
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
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

// downloadResult 下载完成结果(人类 key-value / --json 对象,双态输出)。
type downloadResult struct {
	Filename    string
	Dir         string
	Size        int64
	Format      string
	Bitrate     int64
	MetaWritten bool
}

// write 按 --json 决定输出形态:人类 key-value 表格 / JSON 对象。
// 写到 stdout(k.OutWriter)。
func (r downloadResult) write(k *kit.Kit) error {
	if k.JSON {
		return r.writeJSON(k.OutWriter())
	}
	r.writeHuman(k.OutWriter())
	return nil
}

// writeHuman 渲染人类可读 key-value(PRD-0013 行 85-91 格式)。
func (r downloadResult) writeHuman(w io.Writer) {
	meta := "✗"
	if r.MetaWritten {
		meta = "✓ 标题/艺人/专辑/封面"
	}
	fmt.Fprintf(w, "文件     %s\n", r.Filename)
	fmt.Fprintf(w, "目录     %s\n", r.Dir)
	fmt.Fprintf(w, "大小     %s\n", formatSizeLabel(r.Size, r.Format))
	fmt.Fprintf(w, "格式     %s (%d kbps)\n", r.Format, r.Bitrate/1000)
	fmt.Fprintf(w, "元数据   %s\n", meta)
}

// writeJSON 输出 JSON 对象(PRD-0013 --json 字段)。
func (r downloadResult) writeJSON(w io.Writer) error {
	// 手动构造(避免引入 encoding/json 到 download.go 顶部);
	// 字段固定、无特殊字符,简单拼接够用。
	_, err := fmt.Fprintf(w, `{"path":%q,"size":%d,"format":%q,"bitrate":%d,"metadata_written":%t}`+"\n",
		filepath.Join(r.Dir, r.Filename), r.Size, r.Format, r.Bitrate, r.MetaWritten)
	return err
}

// formatSizeLabel 大小 + 格式后缀(PRD 显示 "3.4 MB")。
// 复用 kit.formatBytes 但避免导出,这里本地简化(字节→MB)。
func formatSizeLabel(bytes int64, format string) string {
	const mb = 1024 * 1024
	if bytes >= mb {
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(mb))
	}
	return fmt.Sprintf("%.1f KB", float64(bytes)/1024)
}
