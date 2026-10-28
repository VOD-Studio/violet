package linkpreview

import (
	"context"
	"errors"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	domainlink "blog-api/internal/domain/linkpreview"
	"blog-api/internal/domain/shared"
)

type memoryCards struct {
	mu   sync.Mutex
	rows map[string]*domainlink.LinkCard
	err  error
}

func copyCard(c *domainlink.LinkCard) *domainlink.LinkCard {
	return domainlink.ReconstructLinkCard(c.ID(), c.URL(), c.Title(), c.Description(), c.SiteName(), c.ImageURL(), c.Status(), c.FetchedAt(), c.ExpiresAt(), c.LastError(), c.FailCount(), c.CreatedAt(), c.UpdatedAt())
}

func (r *memoryCards) Save(ctx context.Context, card *domainlink.LinkCard) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rows[card.URL()] = copyCard(card)
	return r.err
}

func (r *memoryCards) FindByURLs(ctx context.Context, urls []string) ([]*domainlink.LinkCard, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	rows := make([]*domainlink.LinkCard, 0, len(urls))
	for _, u := range urls {
		if c := r.rows[u]; c != nil {
			rows = append(rows, copyCard(c))
		}
	}
	return rows, r.err
}

type gatedFetcher struct {
	mu     sync.Mutex
	calls  map[string]int
	gate   <-chan struct{}
	result FetchResult
	err    error
}

func (f *gatedFetcher) Fetch(ctx context.Context, u string) (FetchResult, error) {
	f.mu.Lock()
	f.calls[u]++
	f.mu.Unlock()
	if f.gate != nil {
		select {
		case <-f.gate:
		case <-ctx.Done():
			return FetchResult{}, ctx.Err()
		}
	}
	return f.result, f.err
}

func TestLookupPreservesStaleSnapshotAndRetriesOnlyAfterBackoff(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		u := "https://example.com/post"
		card, err := domainlink.NewLinkCard(shared.NewID(), u, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		card.RecordSuccess("旧标题", "旧描述", "Example", "/uploads/old.png", time.Now().Add(-domainlink.DefaultTTL), domainlink.DefaultTTL)
		repo := &memoryCards{rows: map[string]*domainlink.LinkCard{u: card}}
		fetcher := &gatedFetcher{calls: map[string]int{}, err: errors.New("HTTP 403")}
		svc := NewService(context.Background(), repo, fetcher, nil, 2)

		first, err := svc.Lookup(context.Background(), []string{u})
		if err != nil {
			t.Fatal(err)
		}
		if len(first.Pending) != 1 || first.Cards[u].Title != "旧标题" {
			t.Fatalf("过期时先保留旧快照并报告等待: %+v", first)
		}
		synctest.Wait()
		settled, err := svc.Lookup(context.Background(), []string{u})
		if err != nil {
			t.Fatal(err)
		}
		if len(settled.Pending) != 0 || settled.Cards[u].ImageURL != "/uploads/old.png" {
			t.Fatalf("刷新失败不应丢失旧快照或一直等待: %+v", settled)
		}
		synctest.Wait()
		if fetcher.calls[u] != 1 {
			t.Fatal("退避期不能继续访问上游")
		}

		time.Sleep(domainlink.FailureBackoffBase)
		fetcher.err = nil
		fetcher.result = FetchResult{Title: "更新的标题"}
		if _, err := svc.Lookup(context.Background(), []string{u}); err != nil {
			t.Fatal(err)
		}
		synctest.Wait()
		updated, err := svc.Lookup(context.Background(), []string{u})
		if err != nil {
			t.Fatal(err)
		}
		if updated.Cards[u].Title != "更新的标题" || len(updated.Pending) != 0 {
			t.Fatalf("退避后应能更新: %+v", updated)
		}
	})
}

func TestLookupBoundsOutstandingWorkAndDeduplicatesConcurrentReaders(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		gate := make(chan struct{})
		fetcher := &gatedFetcher{calls: map[string]int{}, gate: gate, result: FetchResult{Title: "卡片"}}
		repo := &memoryCards{rows: map[string]*domainlink.LinkCard{}}
		svc := NewService(context.Background(), repo, fetcher, nil, 2)
		urls := []string{"https://example.com/a", "https://example.com/b", "https://example.com/c"}
		for range 8 {
			if _, err := svc.Lookup(context.Background(), urls); err != nil {
				t.Fatal(err)
			}
		}
		synctest.Wait()
		if fetcher.calls[urls[0]] != 1 || fetcher.calls[urls[1]] != 1 || fetcher.calls[urls[2]] != 0 {
			t.Fatalf("准入必须合并重复请求并限制整个抓取: %+v", fetcher.calls)
		}
		close(gate)
		synctest.Wait()
		if _, err := svc.Lookup(context.Background(), urls); err != nil {
			t.Fatal(err)
		}
		synctest.Wait()
		result, err := svc.Lookup(context.Background(), urls)
		if err != nil {
			t.Fatal(err)
		}
		for _, u := range urls {
			if result.Cards[u] == nil || fetcher.calls[u] != 1 {
				t.Fatalf("待获取链接必须最终完成且不重复抓取: %+v / %+v", result, fetcher.calls)
			}
		}
		if len(result.Pending) != 0 {
			t.Fatalf("全部完成后应停止等待: %+v", result)
		}
	})
}

type captureCover struct {
	source string
	err    error
}

func (s *captureCover) Save(_ context.Context, _, source string) (string, error) {
	s.source = source
	return "/uploads/cover.png", s.err
}

func TestRelativeCoverUsesFinalRedirectedPage(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		repo := &memoryCards{rows: map[string]*domainlink.LinkCard{}}
		fetcher := &gatedFetcher{calls: map[string]int{}, result: FetchResult{Title: "标题", PageURL: "https://example.com/moved/page/", ImageURL: "../cover.png"}}
		cover := &captureCover{}
		svc := NewService(context.Background(), repo, fetcher, cover, 1)
		if _, err := svc.Lookup(context.Background(), []string{"https://example.com/original"}); err != nil {
			t.Fatal(err)
		}
		synctest.Wait()
		if cover.source != "https://example.com/moved/cover.png" {
			t.Fatalf("相对封面必须相对最终页面解析，得到 %q", cover.source)
		}
	})
}

func TestLookupPropagatesRepositoryFailureWithoutCallingUpstream(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		failure := errors.New("database unavailable")
		fetcher := &gatedFetcher{calls: map[string]int{}}
		svc := NewService(context.Background(), &memoryCards{err: failure}, fetcher, nil, 1)
		_, err := svc.Lookup(context.Background(), []string{"https://example.com/"})
		if !errors.Is(err, failure) {
			t.Fatalf("缓存读取失败不能伪装成空快照: %v", err)
		}
		synctest.Wait()
		if len(fetcher.calls) != 0 {
			t.Fatal("查库失败不应触发上游抓取风暴")
		}
	})
}

func TestShutdownCancelsOutstandingFetch(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		fetcher := &gatedFetcher{calls: map[string]int{}, gate: make(chan struct{})}
		svc := NewService(ctx, &memoryCards{rows: map[string]*domainlink.LinkCard{}}, fetcher, nil, 1)
		if _, err := svc.Lookup(context.Background(), []string{"https://example.com/"}); err != nil {
			t.Fatal(err)
		}
		synctest.Wait()
		cancel()
		synctest.Wait()
		svc.mu.Lock()
		active := len(svc.active)
		svc.mu.Unlock()
		if active != 0 {
			t.Fatal("关停后仍有抓取占用名额")
		}
	})
}

func TestFetchDeadlineSettlesAsUnavailable(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		u := "https://example.com/slow"
		fetcher := &gatedFetcher{calls: map[string]int{}, gate: make(chan struct{})}
		svc := NewService(context.Background(), &memoryCards{rows: map[string]*domainlink.LinkCard{}}, fetcher, nil, 1)
		if _, err := svc.Lookup(context.Background(), []string{u}); err != nil {
			t.Fatal(err)
		}
		synctest.Wait()
		time.Sleep(30 * time.Second)
		synctest.Wait()
		result, err := svc.Lookup(context.Background(), []string{u})
		if err != nil {
			t.Fatal(err)
		}
		if len(result.Pending) != 0 || len(result.Unavailable) != 1 || result.Unavailable[0] != u {
			t.Fatalf("上游超时必须落下失败终态，不能让页面永久等待: %+v", result)
		}
	})
}
