package series

import (
	"context"
	"errors"
	"strings"
	"testing"

	domain "blog-api/internal/domain/series"
	"blog-api/internal/domain/shared"
)

// stubImageClient 可控的生图客户端 stub。
type stubImageClient struct {
	images []GeneratedImage
	err    error
	prompt string
}

func (s *stubImageClient) GenerateImages(ctx context.Context, prompt string, n int) ([]GeneratedImage, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.prompt = prompt
	if len(s.images) > n {
		return s.images[:n], nil
	}
	return s.images, nil
}

// stubCoverStore 封面落库 stub。
type stubCoverStore struct {
	data     []byte
	savedURL string
	err      error
}

func (s *stubCoverStore) SaveGeneratedCover(ctx context.Context, ownerID shared.ID, data []byte, ext string) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	s.data = data
	s.savedURL = "/uploads/material/cover." + ext
	return s.savedURL, nil
}

// 编译期接口断言。
var (
	_ CoverGenerator   = (*stubImageClient)(nil)
	_ GeneratedCoverStore = (*stubCoverStore)(nil)
)

func newCoverTestService(t *testing.T) (*Service, *stubRepo, *stubBus, *stubImageClient, *stubCoverStore) {
	t.Helper()
	repo := newStubRepo()
	bus := &stubBus{}
	img := &stubImageClient{images: []GeneratedImage{{B64: "AAAA"}, {B64: "BBBB"}}}
	store := &stubCoverStore{}
	svc := NewService(repo, bus)
	svc.coverGenerator = img
	svc.coverStore = store
	return svc, repo, bus, img, store
}

func TestGenerateCoverSuggestions_HappyPath(t *testing.T) {
	svc, repo, _, img, store := newCoverTestService(t)
	ctx := context.Background()

	userID := shared.NewID()
	series, err := domain.NewSeries(shared.NewID(), userID, "我的书", "my-book", "讲透 JVM", "")
	if err != nil {
		t.Fatalf("seed series: %v", err)
	}
	if err := repo.Save(ctx, series); err != nil {
		t.Fatal(err)
	}

	urls, err := svc.GenerateCoverSuggestions(ctx, series.ID().String(), userID.String(), "", 2)
	if err != nil {
		t.Fatalf("GenerateCoverSuggestions() error = %v", err)
	}
	if len(urls) != 2 {
		t.Fatalf("len(urls) = %d, want 2", len(urls))
	}
	for _, u := range urls {
		if !strings.HasPrefix(u, "/uploads/") {
			t.Errorf("url %q 不在站内 uploads 下", u)
		}
	}
	if store.data == nil {
		t.Error("封面字节未落素材库")
	}
	// 默认 prompt 应包含书名与简介语义
	if !strings.Contains(img.prompt, "我的书") || !strings.Contains(img.prompt, "讲透 JVM") {
		t.Errorf("prompt 未含书名/简介: %q", img.prompt)
	}
	// 生成封面不应直接改动书（设封面是显式 PATCH）
	updated, _ := repo.FindByID(ctx, series.ID())
	if updated.CoverImage() != "" {
		t.Errorf("生成候选不应直接改封面，实际 = %q", updated.CoverImage())
	}
}

func TestGenerateCoverSuggestions_Unconfigured(t *testing.T) {
	repo := newStubRepo()
	bus := &stubBus{}
	svc := NewService(repo, bus) // 未注入 generator/store
	ctx := context.Background()
	userID := shared.NewID()
	series, _ := domain.NewSeries(shared.NewID(), userID, "书", "book-x", "", "")
	_ = repo.Save(ctx, series)

	_, err := svc.GenerateCoverSuggestions(ctx, series.ID().String(), userID.String(), "", 1)
	if err == nil || !strings.Contains(err.Error(), "未配置") {
		t.Fatalf("期望未配置错误，实际 = %v", err)
	}
}

func TestGenerateCoverSuggestions_GeneratorError(t *testing.T) {
	svc, repo, _, img, _ := newCoverTestService(t)
	img.err = errors.New("LLM 接口返回 404: model not found")
	ctx := context.Background()
	userID := shared.NewID()
	series, _ := domain.NewSeries(shared.NewID(), userID, "书", "book-y", "", "")
	_ = repo.Save(ctx, series)

	_, err := svc.GenerateCoverSuggestions(ctx, series.ID().String(), userID.String(), "", 1)
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("应透传端点错误给前端展示，实际 = %v", err)
	}
}
