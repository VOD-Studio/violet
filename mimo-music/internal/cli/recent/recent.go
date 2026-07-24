// Package recent 提供 musicctl recent 命令:读召回池按 frecency 展示最近条目。
//
// 解决「刚才那首叫什么」(PRD-0014 #24)。纯读本地召回池(召回池的远端快照由
// recall 包后台预热,本命令不主动拉),不触发网络请求,秒出。
package recent

import (
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/spf13/cobra"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
)

// defaultLimit 是无 --limit 时的默认条目数。
const defaultLimit = 20

// NewCommand 创建 recent 命令:读召回池按 frecency 展示最近条目。
func NewCommand(k *kit.Kit) *cobra.Command {
	var limit int
	c := &cobra.Command{
		Use:   "recent",
		Short: "列出最近搜索/播放/下载的歌曲(按 frecency 排序)",
		Long: `列出召回池中最近的歌曲条目,按 frecency(频率+最近度)排序。

数据来自本地召回池(播放/下载/搜索自动累积,红心/歌单后台同步),
不触发网络请求。空召回池(新用户)输出为空。`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return run(k, limit)
		},
	}
	c.Flags().IntVar(&limit, "limit", defaultLimit, "显示条目数")
	kit.AnnotateRpcs(c) // 本地命令,无 rpc(读本地召回池)
	return c
}

// run 读召回池 top N 并按三态渲染。
func run(k *kit.Kit, limit int) error {
	pool := k.RecallPool()
	if pool == nil {
		// 无池(异常初始化)→ 空输出,不报错。
		return renderEmpty(k)
	}
	ranked, err := pool.TopN(limit)
	if err != nil {
		return fmt.Errorf("读召回池: %w", err)
	}
	if len(ranked) == 0 {
		return renderEmpty(k)
	}
	if k.JSON {
		return renderJSON(k.OutWriter(), ranked)
	}
	renderHuman(k.OutWriter(), ranked)
	return nil
}

// renderEmpty 空召回池输出:人类模式给提示,JSON 模式给空数组。
func renderEmpty(k *kit.Kit) error {
	if k.JSON {
		fmt.Fprintln(k.OutWriter(), "[]")
		return nil
	}
	fmt.Fprintln(k.OutWriter(), "(召回池为空,播放/下载/搜索歌曲后会自动累积)")
	return nil
}

// renderHuman 渲染人类可读表格:序号 id 名称 艺人 来源 时间。
func renderHuman(w io.Writer, ranked []recall.Ranked) {
	for i, r := range ranked {
		name := r.Event.Name
		if name == "" {
			name = fmt.Sprintf("(id %d)", r.Event.ID)
		}
		artist := r.Event.Artist
		if artist != "" {
			artist = " - " + artist
		}
		fmt.Fprintf(w, "%3d  %d\t%s%s\t[%s]\t%s\n",
			i+1, r.Event.ID, name, artist, r.Event.Src, relTime(r.Event.TS))
	}
}

// renderJSON 输出结构化数组(id/name/artist/src/ts/score)。
type rankedJSON struct {
	ID     int64   `json:"id"`
	Name   string  `json:"name,omitempty"`
	Artist string  `json:"artist,omitempty"`
	Src    string  `json:"src"`
	TS     string  `json:"ts"`
	Score  float64 `json:"score"`
}

func renderJSON(w io.Writer, ranked []recall.Ranked) error {
	out := make([]rankedJSON, 0, len(ranked))
	for _, r := range ranked {
		out = append(out, rankedJSON{
			ID:     r.Event.ID,
			Name:   r.Event.Name,
			Artist: r.Event.Artist,
			Src:    string(r.Event.Src),
			TS:     r.Event.TS.Format(time.RFC3339),
			Score:  r.Score,
		})
	}
	b, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(w, string(b))
	return nil
}

// relTime 返回相对时间描述(「2分钟前」「3小时前」),超过一天用日期。
func relTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "刚刚"
	case d < time.Hour:
		return fmt.Sprintf("%d 分钟前", int(d/time.Minute))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d 小时前", int(d/time.Hour))
	default:
		return t.Format("2006-01-02")
	}
}
