package siteimpression

import (
	"context"
	"encoding/base64"
	"sync"
	"testing"

	domainsiteimpression "blog-api/internal/domain/siteimpression"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memoryRepository struct {
	mu     sync.Mutex
	hashes map[domainsiteimpression.TokenHash]struct{}
}

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{hashes: make(map[domainsiteimpression.TokenHash]struct{})}
}

func (r *memoryRepository) Ensure(_ context.Context, hash domainsiteimpression.TokenHash) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.hashes[hash] = struct{}{}
	return nil
}

func (r *memoryRepository) Count(context.Context) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return int64(len(r.hashes)), nil
}

func (r *memoryRepository) Contains(_ context.Context, hash domainsiteimpression.TokenHash) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, exists := r.hashes[hash]
	return exists, nil
}

func TestImpressIssues128BitTokenAndReportsCookieState(t *testing.T) {
	repository := newMemoryRepository()
	service := NewService(repository, []byte("site-impression-token-key"))

	first, token, err := service.Impress(context.Background(), "")
	require.NoError(t, err)
	assert.Equal(t, StateDTO{Count: 1, Impressed: true}, first)
	rawToken, err := base64.RawURLEncoding.Strict().DecodeString(token)
	require.NoError(t, err)
	assert.Len(t, rawToken, tokenSize)

	repeated, replacement, err := service.Impress(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, StateDTO{Count: 1, Impressed: true}, repeated)
	assert.Empty(t, replacement)

	known, err := service.Get(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, StateDTO{Count: 1, Impressed: true}, known)
	anonymous, err := service.Get(context.Background(), "")
	require.NoError(t, err)
	assert.Equal(t, StateDTO{Count: 1, Impressed: false}, anonymous)
}

func TestImpressReplacesMalformedCookie(t *testing.T) {
	service := NewService(newMemoryRepository(), []byte("site-impression-token-key"))

	state, replacement, err := service.Impress(context.Background(), "not-a-128-bit-token")
	require.NoError(t, err)
	assert.True(t, state.Impressed)
	assert.NotEmpty(t, replacement)
	decoded, err := base64.RawURLEncoding.Strict().DecodeString(replacement)
	require.NoError(t, err)
	assert.Len(t, decoded, tokenSize)
}

func TestImpressConcurrentSameTokenCountsOnce(t *testing.T) {
	repository := newMemoryRepository()
	key := []byte("site-impression-token-key")
	service := NewService(repository, key)
	rawToken := []byte("0123456789abcdef")
	token := base64.RawURLEncoding.EncodeToString(rawToken)

	const requests = 32
	results := make(chan StateDTO, requests)
	errors := make(chan error, requests)
	var wait sync.WaitGroup
	for range requests {
		wait.Add(1)
		go func() {
			defer wait.Done()
			state, replacement, err := service.Impress(context.Background(), token)
			if replacement != "" {
				errors <- assert.AnError
				return
			}
			if err != nil {
				errors <- err
				return
			}
			results <- state
		}()
	}
	wait.Wait()
	close(results)
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	for state := range results {
		assert.Equal(t, StateDTO{Count: 1, Impressed: true}, state)
	}

	count, err := repository.Count(context.Background())
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	_, stored := repository.hashes[domainsiteimpression.NewTokenHash(key, rawToken)]
	assert.True(t, stored)
}
