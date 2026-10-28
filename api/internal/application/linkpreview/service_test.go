package linkpreview

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	domainlink "blog-api/internal/domain/linkpreview"
	"blog-api/internal/domain/shared"
)

// stubRepo 内存仓储：记录 Save 调用供异步刷新断言。
type stubRepo struct {
	mu    sync.Mutex
	cards map[string]*domainlink.LinkCard
	saves []string
}

func (r *stubRepo) Save(_ context.Context, card *domainlink.LinkCard) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cards == nil {
		r.cards = map[string]*domainlink.LinkCard{}
	}
	r.cards[card.URL()] = card
	r.saves = append(r.saves, card.URL())
	return nil
}

func (r *stubRepo) FindByURLs(_ context.Context, urls []string) ([]*domainlink.LinkCard, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []*domainlink.LinkCard
	for _, u := range urls {
		if card, ok := r.cards[u]; ok {
			out = append(out, card)
		}
	}
	return out, nil
}

func (r *stubRepo) saved(url string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for _, s := range r.saves {
		if s == url {
			n++
		}
	}
	return n
}

// stubFetcher 可编程抓取器：按 URL 返回结果或错误，计数调用；
// block 非 nil 时计数后阻塞到 close，用于并发窗口控制。
type stubFetcher struct {
	mu     sync.Mutex
	calls  map[string]int
	result map[string]FetchResult
	err    map[string]error
	block  map[string]chan struct{}
}

func (f *stubFetcher) Fetch(_ context.Context, url string) (FetchResult, error) {
	f.mu.Lock()
	f.calls[url]++
	block := f.block[url]
	f.mu.Unlock()
	if block != nil {
		<-block
	}
	if err, ok := f.err[url]; ok {
		return FetchResult{}, err
	}
	return f.result[url], nil
}

func (f *stubFetcher) callCount(url string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[url]
}

type stubCovers struct {
	url string
	err error
}

func (c *stubCovers) Save(_ context.Context, _, _ string) (string, error) {
	if c.err != nil {
		return "", c.err
	}
	return c.url, nil
}

// eventually 等待异步刷新落库（refresh 是 go 出去的）。
func eventually(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("condition not met before timeout")
}

func newTestService(t *testing.T, repo *stubRepo, fetcher *stubFetcher, covers *stubCovers, now func() time.Time) *Service {
	t.Helper()
	return NewService(repo, fetcher, covers, 2, WithClock(now))
}

func TestLookup_MissTriggersBackgroundFetch(t *testing.T) {
	var now = time.Now()
	repo := &stubRepo{}
	fetcher := &stubFetcher{calls: map[string]int{}, result: map[string]FetchResult{
		"https://example.com/a": {Title: "标题", SiteName: "Example"},
	}}
	fetcher.calls = map[string]int{}
	svc := newTestService(t, repo, fetcher, &stubCovers{}, func() time.Time { return now })

	// 首次：miss，无卡片返回，后台抓取。
	got := svc.Lookup(context.Background(), []string{"https://example.com/a"})
	if len(got) != 0 {
		t.Fatalf("miss 时不应有卡片, got %v", got)
	}
	eventually(t, 2*time.Second, func() bool { return repo.saved("https://example.com/a") == 1 })

	// 时间前进到 TTL 内：命中缓存，不再抓取。
	now = now.Add(time.Minute)
	got = svc.Lookup(context.Background(), []string{"https://example.com/a"})
	if got["https://example.com/a"] == nil || got["https://example.com/a"].Title != "标题" {
		t.Fatalf("应命中缓存: %v", got)
	}
	if fetcher.callCount("https://example.com/a") != 1 {
		t.Errorf("TTL 内不应重抓, calls = %d", fetcher.callCount("https://example.com/a"))
	}

	// TTL 过期：返回旧快照 + 触发重抓。
	now = now.Add(domainlink.DefaultTTL + time.Minute)
	got = svc.Lookup(context.Background(), []string{"https://example.com/a"})
	if got["https://example.com/a"] == nil {
		t.Fatal("过期后仍应返回旧快照")
	}
	eventually(t, 2*time.Second, func() bool { return fetcher.callCount("https://example.com/a") == 2 })
}

func TestLookup_FailureBackoff(t *testing.T) {
	var now = time.Now()
	repo := &stubRepo{}
	fetcher := &stubFetcher{
		calls:  map[string]int{},
		result: map[string]FetchResult{},
		err:    map[string]error{"https://down.example/": errors.New("connection refused")},
	}
	svc := newTestService(t, repo, fetcher, &stubCovers{}, func() time.Time { return now })

	svc.Lookup(context.Background(), []string{"https://down.example/"})
	eventually(t, 2*time.Second, func() bool { return fetcher.callCount("https://down.example/") == 1 })

	// 退避期内（24h）：lookup 不再触发抓取，也没有卡片。
	now = now.Add(time.Hour)
	got := svc.Lookup(context.Background(), []string{"https://down.example/"})
	if len(got) != 0 {
		t.Fatalf("failed 卡片不可展示: %v", got)
	}
	if fetcher.callCount("https://down.example/") != 1 {
		t.Errorf("退避期内不应重抓")
	}

	// 退避结束：再次触发。
	now = now.Add(domainlink.FailureBackoffBase + time.Minute)
	svc.Lookup(context.Background(), []string{"https://down.example/"})
	eventually(t, 2*time.Second, func() bool { return fetcher.callCount("https://down.example/") == 2 })
}

func TestLookup_CoverFailureDegradesToTextCard(t *testing.T) {
	var now = time.Now()
	repo := &stubRepo{}
	fetcher := &stubFetcher{calls: map[string]int{}, result: map[string]FetchResult{
		"https://example.com/a": {Title: "有封面页", ImageURL: "https://cdn.example/c.png"},
	}}
	svc := newTestService(t, repo, fetcher, &stubCovers{err: errors.New("403")}, func() time.Time { return now })

	svc.Lookup(context.Background(), []string{"https://example.com/a"})
	eventually(t, 2*time.Second, func() bool { return repo.saved("https://example.com/a") == 1 })

	now = now.Add(time.Second)
	got := svc.Lookup(context.Background(), []string{"https://example.com/a"})
	card := got["https://example.com/a"]
	if card == nil {
		t.Fatal("封面失败应降级为纯文本卡")
	}
	if card.Title != "有封面页" || card.ImageURL != "" {
		t.Errorf("降级卡 = %+v", card)
	}
}

func TestLookup_RelativeImageResolved(t *testing.T) {
	var now = time.Now()
	repo := &stubRepo{}
	fetcher := &stubFetcher{calls: map[string]int{}, result: map[string]FetchResult{
		"https://example.com/a": {Title: "T", ImageURL: "/static/c.png"},
	}}
	covers := &stubCovers{url: "/uploads/link-previews/x/c.png"}
	svc := newTestService(t, repo, fetcher, covers, func() time.Time { return now })

	svc.Lookup(context.Background(), []string{"https://example.com/a"})
	eventually(t, 2*time.Second, func() bool { return repo.saved("https://example.com/a") == 1 })

	now = now.Add(time.Second)
	card := svc.Lookup(context.Background(), []string{"https://example.com/a"})["https://example.com/a"]
	if card == nil || card.ImageURL != "/uploads/link-previews/x/c.png" {
		t.Fatalf("相对封面未解析: %+v", card)
	}
}

func TestRefresh_SingleflightMergesConcurrent(t *testing.T) {
	var now = time.Now()
	repo := &stubRepo{}
	block := make(chan struct{})
	fetcher := &stubFetcher{
		calls:  map[string]int{},
		result: map[string]FetchResult{"https://slow.example/": {Title: "慢"}},
		block:  map[string]chan struct{}{"https://slow.example/": block},
	}
	svc := newTestService(t, repo, fetcher, &stubCovers{}, func() time.Time { return now })

	// 并发 5 次 refresh 同一 URL：第一个进入 Fetch 并阻塞，
	// 其余在 singleflight 上等待——窗口期内网络调用只有一次。
	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			svc.refresh("https://slow.example/", nil)
		}()
	}
	eventually(t, 2*time.Second, func() bool { return fetcher.callCount("https://slow.example/") == 1 })
	time.Sleep(50 * time.Millisecond)
	if got := fetcher.callCount("https://slow.example/"); got != 1 {
		t.Fatalf("singleflight 未合并, fetch calls = %d", got)
	}
	close(block)
	wg.Wait()
	if got := fetcher.callCount("https://slow.example/"); got != 1 {
		t.Errorf("合并窗口后 calls = %d, want 1", got)
	}
	if repo.saved("https://slow.example/") != 1 {
		t.Errorf("应恰好保存一次")
	}
}

func TestLookup_NormalizesAndCaps(t *testing.T) {
	var now = time.Now()
	svc := newTestService(t, &stubRepo{}, &stubFetcher{calls: map[string]int{}, result: map[string]FetchResult{}}, &stubCovers{}, func() time.Time { return now })

	// 大小写主机归一后去重；非法项丢弃。
	got := svc.Lookup(context.Background(), []string{"HTTPS://Example.COM:443/a", "https://example.com/a", "not-a-url"})
	if len(got) != 0 {
		t.Fatalf("无缓存时结果应为空: %v", got)
	}
}

// 编译期确认 stub 满足端口。
var _ PageFetcher = (*stubFetcher)(nil)
var _ CoverSaver = (*stubCovers)(nil)
var _ domainlink.LinkCardRepository = (*stubRepo)(nil)
var _ = shared.NewID
