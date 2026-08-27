package mcp

import (
	"context"
	"testing"
	"time"

	domainapitoken "blog-api/internal/domain/api_token"
)

type stubLookup struct {
	pat *domainapitoken.PAT
}

func (s *stubLookup) FindByHash(ctx context.Context, hash string) (*domainapitoken.PAT, error) {
	if s.pat != nil && s.pat.TokenHash() == hash {
		return s.pat, nil
	}
	return nil, domainapitoken.ErrNotFound
}

func (s *stubLookup) TouchLastUsed(ctx context.Context, id string, now time.Time) error {
	return nil
}

func TestVerify_InteractiveProjection(t *testing.T) {
	pat := domainapitoken.Reconstruct("id", "u1", "n", domainapitoken.HashToken("raw-token"),
		[]string{domainapitoken.ScopePostsRead}, time.Time{}, time.Time{}, time.Now(), false)
	v := NewPATVerifier(&stubLookup{pat: pat})

	info, err := v.Verify(context.Background(), "raw-token", nil)
	if err != nil {
		t.Fatal(err)
	}
	if Interactive(info) {
		t.Error("interactive=false 的 PAT 应投影为 false")
	}
}

func TestInteractive_DefaultTrue(t *testing.T) {
	if !Interactive(nil) {
		t.Error("nil TokenInfo 应默认 true")
	}
}
