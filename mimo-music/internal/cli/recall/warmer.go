package recall

import (
	"time"
)

// RemoteTTL 是远端快照的有效期,超期强制重拉(CONTEXT.md 预热与兜底段)。
const RemoteTTL = 24 * time.Hour

// RemoteFetcher 拉取远端快照事件(红心/歌单/每日推荐),供预热后台 goroutine 调用。
//
// 生产实现接网易云 endpoint(需登录态);测试用 fake。返回 error 时预热静默放弃
// (fire-and-forget,失败不影响主命令;下次启动再试)。
type RemoteFetcher interface {
	Fetch() ([]Event, error)
}

// RemoteFetcherFunc 让普通函数实现 RemoteFetcher。
type RemoteFetcherFunc func() ([]Event, error)

func (f RemoteFetcherFunc) Fetch() ([]Event, error) { return f() }

// NeedsRemoteRefresh 判断是否需要重拉远端:池里最近的 remote 事件超过 TTL,或无 remote 事件。
//
// 决策依据是 remote 事件流的最新 TS——而非单独的「上次拉取时间」字段(避免新增元数据)。
// 主命令/裸跑 onboarding 调本函数决定是否起后台预热;返回 false 时不启动 goroutine。
func NeedsRemoteRefresh(pool *Pool) bool {
	if pool == nil {
		return false
	}
	events, err := pool.loadEvents()
	if err != nil {
		return true // 读不出就尝试拉(乐观)
	}
	var latestRemote time.Time
	for _, e := range events {
		if e.Src == SrcRemote && e.TS.After(latestRemote) {
			latestRemote = e.TS
		}
	}
	if latestRemote.IsZero() {
		return true // 从无远端快照
	}
	return pool.now().Sub(latestRemote) >= RemoteTTL
}

// WarmBackground 起 fire-and-forget goroutine 拉远端快照并写入池子。
//
// **绝不阻塞调用方**:立即返回,拉取在后台;musicctl 是 run-and-exit CLI,进程退出时
// 未完成的 Append 直接丢弃——tmp+rename 保证主文件不被半拉子数据污染(Pool.Append 已保证)。
// fetcher 为 nil 或拉取失败:静默放弃,下次启动再试。
//
// 调用方(主命令/裸跑)负责先判 NeedsRemoteRefresh 决定是否调本函数。
// 返回的 done channel 在后台拉取完成(成功写盘或放弃)时关闭,供测试同步等待;
// 生产调用方可忽略返回值。
func WarmBackground(pool *Pool, fetcher RemoteFetcher) (done <-chan struct{}) {
	ch := make(chan struct{})
	go func() {
		defer close(ch)
		if pool == nil || fetcher == nil {
			return
		}
		events, err := fetcher.Fetch()
		if err != nil || len(events) == 0 {
			return // 静默放弃
		}
		_ = pool.Append(events...) // 失败不阻塞主命令(火并忘)
	}()
	return ch
}
