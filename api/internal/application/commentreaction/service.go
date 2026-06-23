// Package commentreaction 提供评论反应的应用用例。
package commentreaction

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	domaincr "blog-api/internal/domain/commentreaction"
)

// Service 评论反应用例服务
type Service struct {
	store domaincr.CommentReactionStore
}

// NewService 构造评论反应服务
func NewService(store domaincr.CommentReactionStore) *Service {
	return &Service{store: store}
}

// List 查询评论的反应列表
func (s *Service) List(ctx context.Context, commentID string) ([]domaincr.Reaction, error) {
	return s.store.ListByComment(ctx, commentID)
}

// AddInput 添加反应入参
type AddInput struct {
	CommentID string
	EmojiID   int32
	UserID    string
	IPAddress string
}

// Add 添加反应
func (s *Service) Add(ctx context.Context, in AddInput) error {
	ipHash := hashIP(in.IPAddress)
	return s.store.Add(ctx, in.CommentID, in.UserID, ipHash, in.EmojiID)
}

// Remove 移除反应
func (s *Service) Remove(ctx context.Context, commentID, userID, ipAddress string, emojiID int32) error {
	return s.store.Remove(ctx, commentID, userID, hashIP(ipAddress), emojiID)
}

// Batch 批量查询
func (s *Service) Batch(ctx context.Context, commentIDs []string) ([]domaincr.BatchResult, error) {
	return s.store.BatchByComments(ctx, commentIDs)
}

func hashIP(ip string) string {
	h := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(h[:])
}
