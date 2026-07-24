package recall

import (
	"errors"
	"testing"
	"time"
)

var errFetchFailed = errors.New("simulated fetch failure")

func TestNeedsRemoteRefresh_NoRemoteEvents(t *testing.T) {
	p, _ := newTestPool(t)
	p.Append(Event{ID: 1, Src: SrcPlay}) // 只有 play,无 remote
	if !NeedsRemoteRefresh(p) {
		t.Error("无 remote 事件应需刷新")
	}
}

func TestNeedsRemoteRefresh_RecentRemoteWithinTTL(t *testing.T) {
	p, _ := newTestPool(t)
	// remote 事件在 now 前 1 小时(TTL 24h 内)。
	now := p.now()
	p.Append(Event{ID: 1, Src: SrcRemote, TS: now.Add(-1 * time.Hour)})
	if NeedsRemoteRefresh(p) {
		t.Error("TTL 内的 remote 事件不应刷新")
	}
}

func TestNeedsRemoteRefresh_StaleRemoteBeyondTTL(t *testing.T) {
	p, _ := newTestPool(t)
	now := p.now()
	p.Append(Event{ID: 1, Src: SrcRemote, TS: now.Add(-25 * time.Hour)}) // 超 TTL
	if !NeedsRemoteRefresh(p) {
		t.Error("超 TTL 的 remote 事件应刷新")
	}
}

func TestNeedsRemoteRefresh_NilPool(t *testing.T) {
	if NeedsRemoteRefresh(nil) {
		t.Error("nil pool 不应刷新")
	}
}

func TestWarmBackground_WritesFetchedEvents(t *testing.T) {
	p, _ := newTestPool(t)
	fetcher := RemoteFetcherFunc(func() ([]Event, error) {
		return []Event{
			{ID: 100, Name: "红心1", Src: SrcRemote},
			{ID: 101, Name: "红心2", Src: SrcRemote},
		}, nil
	})
	done := WarmBackground(p, fetcher)
	<-done // 等后台完成
	ranked, _ := p.Load()
	if len(ranked) != 2 {
		t.Errorf("后台拉取后应 2 候选,got %d", len(ranked))
	}
}

func TestWarmBackground_NilFetcher_NoOp(t *testing.T) {
	p, _ := newTestPool(t)
	done := WarmBackground(p, nil)
	<-done
	ranked, _ := p.Load()
	if ranked != nil {
		t.Errorf("nil fetcher 不应写入,got %v", ranked)
	}
}

func TestWarmBackground_FetchErrorSilentlyDropped(t *testing.T) {
	p, _ := newTestPool(t)
	fetcher := RemoteFetcherFunc(func() ([]Event, error) {
		return nil, errFetchFailed
	})
	done := WarmBackground(p, fetcher)
	<-done
	ranked, _ := p.Load()
	if ranked != nil {
		t.Errorf("fetcher 失败应静默放弃,got %v", ranked)
	}
}

func TestWarmBackground_NonBlocking(t *testing.T) {
	// fetcher 故意慢,WarmBackground 应立即返回(done 未关闭)。
	p, _ := newTestPool(t)
	started := make(chan struct{})
	fetcher := RemoteFetcherFunc(func() ([]Event, error) {
		close(started)
		time.Sleep(50 * time.Millisecond)
		return []Event{{ID: 1, Src: SrcRemote}}, nil
	})
	done := WarmBackground(p, fetcher)
	// done 应不是立即可读(fetcher 在睡),证明 WarmBackground 没阻塞等待 fetcher。
	select {
	case <-done:
		t.Error("WarmBackground 应立即返回,不该等 fetcher 完成")
	case <-started:
		// fetcher 已启动但 done 未关闭 → 非阻塞,正确。
	}
	<-done // 收尾
}
