// song download 命令:从 flag 解析到文件落盘的端到端垂直切片(PRD-0013 Phase C)。
//
// 流程:URL(拿直链) → Detail(拿歌名/封面) → songdl.DownloadOne(文件名→mkdir→
// 冲突→下载→元数据)→ 渲染输出。
//
// 下载核心已下沉到 internal/cli/songdl 包(song 与 playlist 命令共享)。
// 本文件只做 song 命令专属的 flag 编排 + endpoint 调用 + 结果渲染。
//
// 本切片交付主干(--id/--level/--out/--force);
// --dry-run/--no-metadata/--filename/位置参数/.part 续传留给 issue #24。
package song

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/songdl"
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
			return runDownload(k, id, level, out, force, defaultDownloadDeps(k))
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	c.Flags().IntVar(&level, "level", 1, "音质: 1=standard 2=exhigh 3=lossless 4=hires")
	c.Flags().StringVar(&out, "out", ".", "下载目录(自动 mkdir -p)")
	c.Flags().BoolVar(&force, "force", false, "覆盖已存在文件")
	_ = c.MarkFlagRequired("id")
	return c
}

// downloadDeps 是 runDownload 的外部依赖(网络 + 文件 + 元数据)。
//
// 抽成可注入结构是为了错误路径单测(Go 社区共识:抽业务逻辑成可测函数,
// mock 网络做确定性单测,真实网络行为留集成测试)。默认实现走真实网络,
// 测试注入 mock 覆盖:VIP 无音源(fetchURL 返回空)、元数据失败(writeMeta 返 error)、
// 下载失败(download 返 error)等。
//
// download/writeMeta 在 runDownload 内部转译成 songdl.Deps 的 option——
// songdl.DownloadOne 只消费这两个回调,不感知 song 命令的 fetchURL/fetchDetail。
type downloadDeps struct {
	fetchURL    func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error)
	fetchDetail func(ctx context.Context, id int64) (*mmpb.Song, error)
	// download 流式下载到 path,返回写入字节数。label 用于进度条显示。
	download func(ctx context.Context, url string, total int64, path, label string) (int64, error)
	// writeMeta 写元数据,失败返回 error(调用方按非阻塞处理)。
	writeMeta func(path string, song *mmpb.Song) error
}

// defaultDownloadDeps 生产环境依赖:真实网络(engine + endpoint)+ 真实文件下载 + 真实元数据。
func defaultDownloadDeps(k *kit.Kit) downloadDeps {
	return downloadDeps{
		fetchURL: func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.URL, &mmpb.GetSongURLRequest{
				SongId: id, Level: mmpb.SongLevel(level),
			})
			if err != nil {
				return nil, err
			}
			return resp.Url, nil
		},
		fetchDetail: func(ctx context.Context, id int64) (*mmpb.Song, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.Detail, &mmpb.GetSongDetailRequest{SongId: id})
			if err != nil {
				return nil, err
			}
			return resp.Song, nil
		},
		download: func(ctx context.Context, url string, total int64, path, label string) (int64, error) {
			return songdl.DownloadToFile(ctx, k, url, total, path, label)
		},
		writeMeta: func(path string, song *mmpb.Song) error {
			return songdl.WriteSongMetadata(path, song)
		},
	}
}

// runDownload 执行下载主流程。
//
// deps 注入外部依赖(测试用);生产用 defaultDownloadDeps。
// 流程:fetchURL → fetchDetail → songdl.DownloadOne → 渲染结果。
func runDownload(k *kit.Kit, id int64, level int, out string, force bool, deps downloadDeps) error {
	ctx := k.CookieCtx()

	// 1. 拿播放直链。
	songURL, err := deps.fetchURL(ctx, id, level)
	if err != nil {
		return fmt.Errorf("获取播放地址: %w", err)
	}
	if songURL == nil || songURL.Url == "" {
		return fmt.Errorf("✗ 歌曲 %d 无可用音源(level=%d)。尝试 --level 1 或登录 VIP 账号", id, level)
	}

	// 2. 拿歌曲详情(文件名 + 元数据用)。失败不致命:用 id 兜底空 Song。
	song, _ := deps.fetchDetail(ctx, id)
	if song == nil {
		song = &mmpb.Song{Id: id}
	}

	// 3. 单曲落盘(songdl.DownloadOne):文件名→mkdir→冲突→下载→元数据。
	//    download/writeMeta 注入到 songdl.Deps,保持测试 mock 路径不变
	//    (deps.download/writeMeta 字段是测试 mock 点,默认实现走真实网络)。
	dlDeps := songdl.NewDeps(k,
		songdl.WithDownload(deps.download),
		songdl.WithWriteMeta(deps.writeMeta),
	)
	outcome := songdl.DownloadOne(ctx, song, songURL, out, force, dlDeps)

	switch outcome.Status {
	case songdl.StatusSkipped:
		fmt.Fprintf(k.OutWriter(), "已跳过(已存在):%s\n", outcome.Filename)
		return nil
	case songdl.StatusFailed:
		// 目录不可写等失败:带原因 exit 1。
		return fmt.Errorf("✗ %s", outcome.Reason)
	}

	// 元数据失败不阻塞:Warnf 警告到 stderr,结果照常渲染。
	if !outcome.MetaWritten {
		k.Warnf("⚠ 元数据写入失败,文件已保存")
	}

	// 4. 结果输出(stdout):人类 key-value / --json 对象。
	//    JSON schema 按 PRD-0013 行 269: path/size/format/level/metadata_written。
	result := downloadResult{
		Path:        outcome.Path,
		Size:        outcome.Bytes,
		Format:      outcome.Format,
		Level:       level,
		MetaWritten: outcome.MetaWritten,
		filename:    outcome.Filename,
		dir:         outcome.Dir,
		bitrate:     outcome.Bitrate,
	}
	return result.write(k)
}

// downloadResult 下载完成结果(人类 key-value / --json 对象,双态输出)。
//
// JSON schema 按 PRD-0013 行 269: snake_case 字段 + 多行缩进(对齐 protojson 视觉风格)。
// 人类显示额外用 filename/dir/bitrate(不进 JSON,json:"-")。
type downloadResult struct {
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	Duration    string `json:"duration,omitempty"` // TODO(#24): 解析音频时长,目前无
	Format      string `json:"format"`
	Level       int    `json:"level"`
	MetaWritten bool   `json:"metadata_written"`

	// 人类显示辅助(不进 JSON)。
	filename string `json:"-"`
	dir      string `json:"-"`
	bitrate  int64  `json:"-"`
}

// write 按 --json 决定输出形态:人类 key-value / JSON 对象。
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
	fmt.Fprintf(w, "文件     %s\n", r.filename)
	fmt.Fprintf(w, "目录     %s\n", r.dir)
	fmt.Fprintf(w, "大小     %s\n", songdl.FormatSizeLabel(r.Size))
	fmt.Fprintf(w, "格式     %s (%d kbps)\n", r.Format, r.bitrate/1000)
	fmt.Fprintf(w, "元数据   %s\n", meta)
}

// writeJSON 输出多行缩进 JSON(对齐 protojson 的 Multiline 风格)。
func (r downloadResult) writeJSON(w io.Writer) error {
	b, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化下载结果: %w", err)
	}
	_, err = w.Write(append(b, '\n'))
	return err
}
