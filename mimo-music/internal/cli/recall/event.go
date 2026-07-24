// Package recall 实现音乐召回池:补全与 recent 命令共用的候选数据基础设施。
//
// 召回池聚合三类来源(主动/隐式/远端)的事件流,落 append-only JSONL,
// 按 frecency 排序供补全(--id <TAB>)与 recent 命令消费。三类来源用 Src 字段
// 区分,不拆三文件;容量 1000 行 drop oldest(FIFO),打分与裁剪解耦。
//
// 这是 PRD-0014 G 片段:本包只建池子(写 + 内存读 + frecency 排序),
// recent(#H)与补全挂载(#I)消费它。路径经 kit.HistoryPath()(PRD-0015 #44
// 已建可注入 seam),测试覆写 userConfigDir 即可重定向到临时目录。
package recall

import "time"

// Src 标识事件来源类型,影响 frecency 的 src 权重。
//
// 权重分级(Mozilla frecency 访问类型加权):
//   - SrcPlay/SrcDownload(主动消费,强意图)权重最高
//   - SrcSearch/SrcDetail(显式查询)次之
//   - SrcRemote(被动快照)最低
type Src string

const (
	// SrcPlay 播放成功(song play 的 --id 隐式埋点)。
	SrcPlay Src = "play"
	// SrcDownload 下载成功(song download / playlist download 的 --id 隐式埋点)。
	SrcDownload Src = "download"
	// SrcSearch 主动搜索(search 命令的 keyword 记录为候选,命中详情后补 id)。
	SrcSearch Src = "search"
	// SrcDetail 主动详情查询(song detail 的 --id 显式记录)。
	SrcDetail Src = "detail"
	// SrcRemote 远端快照(红心/歌单/每日推荐,24h TTL,后台预热拉取)。
	SrcRemote Src = "remote"
)

// Event 是召回池事件流中的一条记录,对应 JSONL 一行。
//
// ID 必填;Name/Artist 尽量填(补全候选的描述列),缺失留空。TS 是事件发生时间,
// frecency 据此算时段桶权重。Src 决定该事件的 src 权重。
type Event struct {
	ID     int64     `json:"id"`
	Name   string    `json:"name,omitempty"`
	Artist string    `json:"artist,omitempty"`
	Src    Src       `json:"src"`
	TS     time.Time `json:"ts"`
}

// Ranked 是 frecency 打分后的候选,补全与 recent 消费。
// Score 是聚合后的 frecency 分数(越高越靠前);Event 是该 id 的代表性事件
// (取最新一条,Name/Artist 优先非空)。
type Ranked struct {
	Event Event   `json:"-"`
	Score float64 `json:"score"`
}
