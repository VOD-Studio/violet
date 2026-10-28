package linkpreview

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	applp "blog-api/internal/application/linkpreview"
	domainlink "blog-api/internal/domain/linkpreview"
)

type progressRepository struct {
	mu    sync.Mutex
	rows  map[string]*domainlink.LinkCard
	saved chan struct{}
}

func (r *progressRepository) FindByURLs(_ context.Context, urls []string) ([]*domainlink.LinkCard, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rows := make([]*domainlink.LinkCard, 0, len(urls))
	for _, u := range urls {
		if row := r.rows[u]; row != nil {
			rows = append(rows, row)
		}
	}
	return rows, nil
}

func (r *progressRepository) Save(_ context.Context, row *domainlink.LinkCard) error {
	r.mu.Lock()
	r.rows[row.URL()] = row
	r.mu.Unlock()
	r.saved <- struct{}{}
	return nil
}

type progressFetcher struct{ release <-chan struct{} }

func (f progressFetcher) Fetch(ctx context.Context, u string) (applp.FetchResult, error) {
	select {
	case <-f.release:
	case <-ctx.Done():
		return applp.FetchResult{}, ctx.Err()
	}
	if strings.Contains(u, "blocked") {
		return applp.FetchResult{}, errors.New("upstream HTTP 403")
	}
	return applp.FetchResult{Title: "异步得到的标题"}, nil
}

func TestLookupProgress_PendingThenReadyAndTerminalFailure(t *testing.T) {
	gate := make(chan struct{})
	var release sync.Once
	t.Cleanup(func() { release.Do(func() { close(gate) }) })
	repo := &progressRepository{rows: make(map[string]*domainlink.LinkCard), saved: make(chan struct{}, 2)}
	h := NewHandler(applp.NewService(context.Background(), repo, progressFetcher{release: gate}, nil, 2))
	request := func() struct {
		Cards       map[string]applp.LinkCardDTO `json:"cards"`
		Pending     []string                     `json:"pending"`
		Unavailable []string                     `json:"unavailable"`
	} {
		t.Helper()
		w := httptest.NewRecorder()
		h.Lookup(w, httptest.NewRequest(http.MethodPost, "/lookup", strings.NewReader(`{"urls":["https://example.com/ready","https://example.com/blocked"]}`)))
		if w.Code != http.StatusOK {
			t.Fatalf("lookup status %d: %s", w.Code, w.Body.String())
		}
		var result struct {
			Data struct {
				Cards       map[string]applp.LinkCardDTO `json:"cards"`
				Pending     []string                     `json:"pending"`
				Unavailable []string                     `json:"unavailable"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result.Data
	}
	first := request()
	if len(first.Pending) != 2 {
		t.Fatalf("后台抓取期间必须报告 pending 以驱动自动回填；收到 %+v", first)
	}
	release.Do(func() { close(gate) })
	for range 2 {
		select {
		case <-repo.saved:
		case <-time.After(2 * time.Second):
			t.Fatal("后台抓取未完成")
		}
	}
	settled := request()
	if settled.Cards["https://example.com/ready"].Title != "异步得到的标题" {
		t.Fatalf("未返回抓取结果: %+v", settled)
	}
	if len(settled.Pending) != 0 {
		t.Fatalf("结束后不能继续轮询: %+v", settled)
	}
	if len(settled.Unavailable) != 1 || settled.Unavailable[0] != "https://example.com/blocked" {
		t.Fatalf("403 必须成为终态而不是永远等待: %+v", settled)
	}
}
