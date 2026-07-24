package recall

import (
	"sort"
	"time"
)

// srcWeight 是各 Src 类型的权重(Mozilla frecency 访问类型加权)。
// 主动消费(play/download)最强 > 显式查询(search/detail) > 被动快照(remote)。
//
// 具体数值是相对权重,只有比例关系影响排序结果;采用 4/2/1 是为了在 play 与 remote
// 之间拉开足够区分度,同时让「上周密集 play」与「刚碰巧一次 search」可分辨。
var srcWeight = map[Src]float64{
	SrcPlay:     4,
	SrcDownload: 4,
	SrcSearch:   2,
	SrcDetail:   2,
	SrcRemote:   1,
}

// timeBucket 返回事件相对 now 的时段桶权重(atuin-z 工程化分法)。
//   - 1 小时内 ×4(刚发生,最强)
//   - 当天 ×2
//   - 本周 ×0.5
//   - 更早 ×0.25
//
// wall-clock 老化有「假期问题」(一周不听常听歌掉桶),但音乐召回的「最近听过」
// 语义本身是时间语义,与 Mozilla frecency/atuin-z 一致;事件计数时钟对 run-and-exit
// CLI 无明确收益(CONTEXT.md 召回池排序段已定此权衡)。
func timeBucket(ts, now time.Time) float64 {
	age := now.Sub(ts)
	switch {
	case age < time.Hour:
		return 4
	case age < 24*time.Hour:
		return 2
	case age < 7*24*time.Hour:
		return 0.5
	default:
		return 0.25
	}
}

// Score 对事件流按 id 聚合,返回按 frecency 降序排列的候选。
//
// 每个事件贡献 score = srcWeight[src] × timeBucket[ts, now];同一 id 的所有事件
// 求和得该 id 的总 score。代表性 Event 取该 id 最新一条,Name/Artist 优先非空
// (旧事件可能缺 name,新事件补上)。
//
// 纯函数(now 注入保证确定性),存储不变、无新字段——分数仅在装载时算出。
// 空事件流返回 nil。
func Score(events []Event, now time.Time) []Ranked {
	if len(events) == 0 {
		return nil
	}
	type agg struct {
		latest   Event
		scoreSum float64
		latestTS time.Time
	}
	byID := make(map[int64]*agg)
	for _, e := range events {
		a, ok := byID[e.ID]
		if !ok {
			a = &agg{latest: e, latestTS: e.TS}
			byID[e.ID] = a
		}
		// 累加分数。
		a.scoreSum += srcWeight[e.Src] * timeBucket(e.TS, now)
		// 更新代表性事件:取最新 TS;若 TS 相同,name 非空的优先。
		if e.TS.After(a.latestTS) {
			a.latest = e
			a.latestTS = e.TS
		} else if e.TS.Equal(a.latestTS) && a.latest.Name == "" && e.Name != "" {
			a.latest = e
		}
	}
	ranked := make([]Ranked, 0, len(byID))
	for _, a := range byID {
		ranked = append(ranked, Ranked{Event: a.latest, Score: a.scoreSum})
	}
	// 按 score 降序;并列时 id 升序(稳定可预测)。
	sortRanked(ranked)
	return ranked
}

// sortRanked 就地对 Ranked 切片排序:score 降序为主,id 升序为并列打破。
func sortRanked(r []Ranked) {
	sort.Slice(r, func(i, j int) bool {
		if r[i].Score != r[j].Score {
			return r[i].Score > r[j].Score
		}
		return r[i].Event.ID < r[j].Event.ID
	})
}
