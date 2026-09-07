// Package siteimpression 定义匿名设备印记的身份摘要与持久化端口。
package siteimpression

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
)

// TokenHash 是服务端 HMAC 后的设备令牌摘要；原始令牌不得进入持久化层。
type TokenHash [sha256.Size]byte

// NewTokenHash 使用模块专属密钥计算设备令牌摘要。
func NewTokenHash(key, token []byte) TokenHash {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(token)
	var hash TokenHash
	copy(hash[:], mac.Sum(nil))
	return hash
}

// Repository 以令牌摘要维护去重后的匿名设备集合。
type Repository interface {
	// Ensure 幂等写入摘要；并发冲突由数据库唯一约束消解。
	Ensure(ctx context.Context, hash TokenHash) error
	// Count 返回已留下印记的匿名设备数。
	Count(ctx context.Context) (int64, error)
	// Contains 判断摘要是否已留下印记。
	Contains(ctx context.Context, hash TokenHash) (bool, error)
}
