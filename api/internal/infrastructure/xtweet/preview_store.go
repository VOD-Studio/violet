package xtweet

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"

	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
)

type PreviewStore struct{ redis *redis.Client }

func NewPreviewStore(client *redis.Client) *PreviewStore { return &PreviewStore{redis: client} }

func previewKey(token string) string {
	hash := sha256.Sum256([]byte(token))
	return "tweet:external:preview:" + hex.EncodeToString(hash[:])
}

func (s *PreviewStore) Put(ctx context.Context, token string, binding tweet.ExternalPreviewBinding, ttl time.Duration) error {
	data, err := json.Marshal(binding)
	if err != nil {
		return err
	}
	return s.redis.Set(ctx, previewKey(token), data, ttl).Err()
}

func (s *PreviewStore) Get(ctx context.Context, token string) (*tweet.ExternalPreviewBinding, error) {
	data, err := s.redis.Get(ctx, previewKey(token)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, shared.NewError("EXTERNAL_PREVIEW_EXPIRED", "预览已过期，请重新预览后确认")
	}
	if err != nil {
		return nil, shared.Internal("读取预览凭证失败", err)
	}
	var binding tweet.ExternalPreviewBinding
	if err := json.Unmarshal(data, &binding); err != nil {
		return nil, shared.Internal("读取预览凭证失败", err)
	}
	return &binding, nil
}

func (s *PreviewStore) GetFailure(ctx context.Context, id string) (*apptweet.ExternalFetchError, error) {
	data, err := s.redis.Get(ctx, "tweet:external:failure:"+id).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, shared.Internal("读取原文获取状态失败", err)
	}
	var failure apptweet.ExternalFetchError
	if err := json.Unmarshal(data, &failure); err != nil {
		return nil, err
	}
	return &failure, nil
}

func (s *PreviewStore) PutFailure(ctx context.Context, id string, failure *apptweet.ExternalFetchError, ttl time.Duration) error {
	data, err := json.Marshal(failure)
	if err != nil {
		return err
	}
	return s.redis.Set(ctx, "tweet:external:failure:"+id, data, ttl).Err()
}
